import { ZrxApi } from '../api/zrxApi';
import { ContractWrappers } from '@0x/contract-wrappers';
import { createNewOrder, signOrder } from '../orders';
import { WalletBalance } from '../wallet';
import { MarketMakingConfig, PartialOrder } from '../types';
import _ from 'lodash';
import { SignedOrder, SupportedProvider, Order } from '0x.js';

const getWeightForIndex = (increaseAmount: number, totalCount: number, currentIndex: number, totalAmount: number) => {
  const totalWeight = _.sum(_.times(totalCount, (ind: number) => 1 + ind * increaseAmount));
  const amountUnit = totalAmount / totalWeight;
  const currentWeight = 1 + currentIndex * increaseAmount;
  return _.round(currentWeight * amountUnit, 4);
};

export class MarketMaker {
  private _config: MarketMakingConfig;
  private _wallet: WalletBalance;
  private provider: SupportedProvider;
  constructor(tradingConfig: MarketMakingConfig, wallet: WalletBalance, provider: SupportedProvider) {
    this._config = tradingConfig;
    this._wallet = wallet;
    this.provider = provider;
  }

  private availableBalance = async (address: string, token: string, skew?: number) =>
    await this._wallet.Balance(token, address).then(bal => {
      if (skew) {
        return bal - skew;
      }
      return bal;
    });

  public orders = async (address: string): Promise<PartialOrder[]> => {
    const { quoteToken, baseToken, priceFeed, strategy, thresholdFromMid, bidAskJump, inventorySkew, minAmount } = this._config;
    let price = await priceFeed.getMidPrice();

    let orders: PartialOrder[] = [];
    if (price === undefined) {
      const priceErr = {
        reason: 'price returned undefined',
      };
      throw priceErr;
    }

    const availableBase = _.floor(await this.availableBalance(address, baseToken, inventorySkew.base), 2);
    const availableQuote = _.floor(await this.availableBalance(address, quoteToken, inventorySkew.quote), 2);
    if (baseToken === priceFeed.quoteToken && quoteToken === priceFeed.baseToken) {
      price = 1 / price;
    }
    console.log({ availableBase, availableQuote });

    if (strategy.kind === 'multiple') {
      const bidAsk = bidAskJump && priceFeed.getBidAskPrices ? await priceFeed.getBidAskPrices() : { bid: undefined, ask: undefined };
      const { orderCount, priceIncrease, amountIncrease } = strategy;
      const baseAskPrice = bidAskJump && bidAsk.ask ? bidAsk.ask - 0.01 : (1 + thresholdFromMid.ask) * price;
      const askPriceIncrease = priceIncrease.ask;
      const minBase = minAmount.base || 0.01;
      if (availableBase > minBase) {
        const askPrices = _.times(orderCount.ask).reduce((acc: PartialOrder[], ind: number) => {
          const newPrice = (1 + ind * askPriceIncrease) * baseAskPrice;
          const amount = getWeightForIndex(amountIncrease.ask, orderCount.ask, ind, availableBase);
          const partial = {
            price: newPrice,
            amount: amount,
            total: newPrice * amount,
            buy: false,
          };
          if (partial.amount < minBase) {
            return acc;
          }
          return [...acc, partial];
        }, []);
        orders = [...orders, ...askPrices];
      }

      const baseBidPrice = bidAskJump && bidAsk.bid ? bidAsk.bid + 0.01 : (1 - thresholdFromMid.bid) * price;
      const bidPriceIncrease = priceIncrease.bid;
      const minQuote = minAmount.quote || 0.01;
      if (availableQuote > minQuote) {
        const bids = _.times(orderCount.bid).reduce((acc: PartialOrder[], ind: number) => {
          const newPrice = (1 - ind * bidPriceIncrease) * baseBidPrice;
          const amount = getWeightForIndex(amountIncrease.bid, orderCount.bid, ind, availableQuote);
          const partial = {
            price: newPrice,
            amount: amount,
            total: amount / newPrice,
            buy: true,
          };
          if (partial.amount < minQuote) {
            return acc;
          }
          return [...acc, partial];
        }, []);
        orders = [...orders, ...bids];
      }
    } else if (strategy.kind === 'multipleByRange') {
      const { askPrices, bidPrices, amountIncrease } = strategy;

      const minBase = minAmount.base || 0.01;
      if (availableBase > minBase) {
        const askOrders = _.reduce(
          askPrices,
          (acc: PartialOrder[], price: number, ind: number) => {
            const amount = getWeightForIndex(amountIncrease.ask, askPrices.length, ind, availableBase);
            const partial = {
              price: price,
              amount: amount,
              total: price * amount,
              buy: false,
            };
            if (partial.amount < minBase) {
              return acc;
            }
            return [...acc, partial];
          },
          []
        );
        orders = [...orders, ...askOrders];
      }

      const minQuote = minAmount.quote || 0.01;
      if (availableQuote > minQuote) {
        const bids = _.reduce(
          bidPrices,
          (acc: PartialOrder[], price: number, ind: number) => {
            const amount = getWeightForIndex(amountIncrease.bid, bidPrices.length, ind, availableQuote);
            const partial = {
              price: price,
              amount,
              total: amount / price,
              buy: true,
            };
            console.log(partial, amount);
            if (partial.amount < minQuote) {
              return acc;
            }
            return [...acc, partial];
          },
          []
        );
        orders = [...orders, ...bids];
      }
    } else {
      console.log('unknown order type', strategy);
    }
    return _.orderBy(orders, o => o.price, 'desc');
  };
  public signOrders = async (contracts: ContractWrappers, orders: PartialOrder[], baseToken: string, quoteToken: string, expiresInSeconds: number, maker: string, presignTransform?: (order: Order) => Promise<Order>) => {
    const feeData = this._config.fees;
    const fee = feeData
      ? {
          feeRecipientAddress: feeData.recipient,
          takerFee: feeData.takerFee || undefined,
          takerFeeAssetData: feeData.takerFeeAssetData || undefined,
        }
      : {};
    return await _.reduce(
      orders,
      async (acc: Promise<SignedOrder[]>, partOrder: PartialOrder) => {
        const results = await acc;

        const order: Order = await createNewOrder(contracts, {
          ...fee,
          makerTokenAddress: partOrder.buy ? quoteToken : baseToken,
          makerAmount: partOrder.amount,
          takerTokenAddress: partOrder.buy ? baseToken : quoteToken,
          takerAmount: partOrder.buy ? partOrder.amount / partOrder.price : partOrder.amount * partOrder.price,
          expiresInSeconds,
          makerAddress: maker,
        }).then(ord => (presignTransform ? presignTransform(ord) : ord));

        // Generate the order hash and sign it
        const signed = await signOrder(this.provider, order, maker);
        // const signed = await createAndSignOrder(this.provider, contracts, currentOrder);
        return _.concat(results, signed);
      },
      Promise.resolve([] as SignedOrder[])
    );
  };
  public postOrders = async (orders: SignedOrder[]) => await new ZrxApi().postOrders(orders);
}
