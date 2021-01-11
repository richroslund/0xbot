import { Balances } from './../types';
import { CHAINID, NULL_ADDRESS, DECIMALS, NULL_BYTES, ZERO } from './../config';
import { ContractWrappers } from '@0x/contract-wrappers';
import { SignedOrder, assetDataUtils, BigNumber } from '0x.js';
import { TransactionWithPrice, PendingMarketMakerPosition, OrderAction, TradingPositionWithMeta, StrategyOrders, MarketMakerPosition, MarketMakerStrategyConfig, OrderWithPrice, PriceInfoWithOrder, MarketMakerStrategy } from './types';

import { toNumberVal, getCurrentUnixTimestampSec, getFutureDateInSeconds, toUnit } from '../utils';
import _ from 'lodash';
import { OrderStatus, Order } from '@0x/types';
import { Web3Wrapper } from '@0x/web3-wrapper';

export const getTransactionData = ({ transaction, price, baseAmount }: TransactionWithPrice, hash: string) => {
  const { gas, gasPrice, value } = transaction;
  return {
    price,
    hash,
    gasPrice: toNumberVal(gasPrice || 0),
    gas: toNumberVal(gas || 0),
    value: toNumberVal(value || 0),
    orderValueUSD: baseAmount * price,
  };
};
export const createNewPosition = (instanceKey: string, transaction: TransactionWithPrice, amount: number, action: OrderAction, hash: string): TradingPositionWithMeta => {
  return {
    type: 'test',
    amount,
    dateTime: new Date(),
    status: 'opening',
    open: getTransactionData(transaction, hash),
    context: {
      action,
    },
    meta: {
      instanceKey: instanceKey,
    },
  };
};
export const getOrderPrice = (order: SignedOrder, baseToken: string) => {
  const isSell = order.makerAssetData === assetDataUtils.encodeERC20AssetData(baseToken);
  if (isSell) {
    return new BigNumber(order.takerAssetAmount).dividedBy(new BigNumber(order.makerAssetAmount)).toNumber();
  } else {
    return new BigNumber(order.makerAssetAmount).dividedBy(new BigNumber(order.takerAssetAmount)).toNumber();
  }
};
export const createPositionForOrder = (instanceKey: string, order: SignedOrder, amount: BigNumber | number, hash: string, baseToken: string, balance: Balances): MarketMakerPosition => {
  const price = getOrderPrice(order, baseToken);

  const action = order.makerAssetData === assetDataUtils.encodeERC20AssetData(baseToken) ? 'sell' : 'buy';
  return {
    type: 'limit',
    id: `Position-${new Date().valueOf()}`,
    amount: typeof amount === 'number' ? amount : amount.toNumber(),
    dateTime: new Date(),
    status: 'pending',
    pendingOrder: { order, orderHash: hash, price },
    balanceOnOpen: balance,
    open: {
      price,
      orderHash: hash,
      order,
    },
    context: {
      action,
    },
    meta: {
      instanceKey: instanceKey,
    },
    expiredOrders: [],
  };
};
export const getPositionsWithPendingOrders = (positions: MarketMakerPosition[]) => {
  return positions.filter(p => p.pendingOrder !== undefined).map(p => ({ ...p, order: p.pendingOrder?.order } as PendingMarketMakerPosition));
};

export async function resolveOrderStatus(contracts: ContractWrappers, orderWrappers: PendingMarketMakerPosition[]) {
  const orders = _.map(orderWrappers, o => o.pendingOrder.order);
  const [orderStates] = await contracts.devUtils
    .getOrderRelevantStates(
      orders,
      orders.map(o => o.signature)
    )
    .callAsync();
  return _.reduce(
    orderWrappers,
    (results: StrategyOrders<PendingMarketMakerPosition>, wrapped: PendingMarketMakerPosition, index: number): StrategyOrders<PendingMarketMakerPosition> => {
      console.log(orderStates);
      const { orderStatus, orderTakerAssetFilledAmount, orderHash } = orderStates[index] || { orderStatus: undefined, orderTakerAssetFilledAmount: new BigNumber(-1) };
      const partiallyFilled = orderTakerAssetFilledAmount.toNumber() > 0;
      const expired = orderStatus === OrderStatus.Expired ? [...results.expired, wrapped] : results.expired;
      let filled = results.filled;
      if (orderStatus === OrderStatus.FullyFilled || (orderStatus === OrderStatus.Expired && partiallyFilled)) {
        filled = [...filled, { ...wrapped, orderStatus, orderTakerAssetFilledAmount, orderHash }];
      }
      const open = orderStatus === OrderStatus.Fillable ? [...results.open, wrapped] : results.open;
      return {
        expired,
        open,
        filled,
      };
    },
    { open: [], expired: [], filled: [] }
  );
}

export const createOrderFromPriceInfo = (config: MarketMakerStrategyConfig, orderInfo: OrderWithPrice, exchangeAddress: string): Order => {
  const { address, baseToken, quoteToken, expirationSeconds } = config;
  const { action, price, baseAmount } = orderInfo;
  const isBuy = action === 'buy';
  const makerToken = isBuy ? quoteToken : baseToken;
  const takerToken = isBuy ? baseToken : quoteToken;
  const makerAmount = isBuy ? baseAmount * price : baseAmount;
  const takerAmount = isBuy ? baseAmount : baseAmount * price;
  return {
    chainId: CHAINID,
    exchangeAddress,
    makerAddress: address,
    takerAddress: NULL_ADDRESS,
    senderAddress: NULL_ADDRESS,
    feeRecipientAddress: NULL_ADDRESS,
    expirationTimeSeconds: getFutureDateInSeconds(expirationSeconds),
    salt: getCurrentUnixTimestampSec(),
    makerAssetAmount: Web3Wrapper.toBaseUnitAmount(new BigNumber(makerAmount), DECIMALS),
    takerAssetAmount: Web3Wrapper.toBaseUnitAmount(new BigNumber(takerAmount), DECIMALS),
    makerAssetData: assetDataUtils.encodeERC20AssetData(makerToken),
    takerAssetData: assetDataUtils.encodeERC20AssetData(takerToken),
    makerFeeAssetData: NULL_BYTES,
    takerFeeAssetData: NULL_BYTES,
    makerFee: ZERO,
    takerFee: ZERO,
  };
};

const reduceOrdersWithInfo = (config: MarketMakerStrategyConfig, contracts: ContractWrappers) => async (resultsAsync: Promise<PriceInfoWithOrder[]>, order: OrderWithPrice): Promise<PriceInfoWithOrder[]> => {
  const results: PriceInfoWithOrder[] = await resultsAsync;
  const orderValue = createOrderFromPriceInfo(config, order, contracts.contractAddresses.exchange);
  const orderHash = await contracts.devUtils.getOrderHash(orderValue, new BigNumber(CHAINID), contracts.contractAddresses.exchange).callAsync();
  return [...results, { ...order, order: orderValue, orderHash }];
};

export const convertToOrdersWithHash = async (config: MarketMakerStrategyConfig, contracts: ContractWrappers, orders: OrderWithPrice[]) => {
  return await _.reduce(orders, reduceOrdersWithInfo(config, contracts), Promise.resolve([]));
};

export const getUnallocatedQuoteAmount = (strategy: MarketMakerStrategy, positions: MarketMakerPosition[], currentQuoteBalance: number) => {
  const { maxQuoteOrderAmount, minQuoteOrderAmount, positionPercent, quoteToken, minQuoteBalance } = strategy;
  const allocatedQuoteAmount = _(positions)
    .map(p => {
      const { pendingOrder } = p;
      return pendingOrder && pendingOrder.order.makerAssetData === assetDataUtils.encodeERC20AssetData(quoteToken) ? toUnit(pendingOrder.order.makerAssetAmount) : 0;
    })
    .sum();
  const availableQuoteBalance = currentQuoteBalance - minQuoteBalance - allocatedQuoteAmount;
  const positionAmount = _.min([availableQuoteBalance * positionPercent, maxQuoteOrderAmount]) || 0;

  return positionAmount >= minQuoteOrderAmount ? positionAmount : 0;
};
export const getUnallocatedBaseAmount = (strategy: MarketMakerStrategy, positions: MarketMakerPosition[], currentBaseAmount: number) => {
  const { maxBaseOrderAmount, minQuoteOrderAmount, positionPercent, baseToken, minBaseBalance } = strategy;
  const allocatedBaseAmount = _(positions)
    .map(p => {
      const { pendingOrder } = p;
      const { order } = pendingOrder || { order: undefined };
      return order && order.makerAssetData === assetDataUtils.encodeERC20AssetData(baseToken) ? toUnit(order.makerAssetAmount) : 0;
    })
    .sum();
  const availableQuoteBalance = currentBaseAmount - minBaseBalance - allocatedBaseAmount;
  const positionOpenAmount = availableQuoteBalance * positionPercent;
  const positionAmount = _.min([positionOpenAmount, maxBaseOrderAmount]) || 0;

  return positionAmount >= minQuoteOrderAmount ? positionAmount : 0;
};

export const displayCurrentState = (strategy: MarketMakerStrategy, balances: Balances) => {
  const { positions, closed } = strategy;
  const walletInfo = {
    eth: balances.ethBalance,
    ...balances.balances,
  };
  const pInfo = (filter: (ppos: MarketMakerPosition) => boolean) => {
    const curr = _(positions)
      .filter(filter)
      .value();
    const total = curr.length;
    if (total <= 0) {
      return total;
    }

    // const amounts = curr.reduce((acc: string[], p: MarketMakerPosition) => {
    //   return [...acc, _.round(p.amount, 3).toString()];
    // }, []);
    //return `${total} - ${amounts.join('/')}`;
    return total;
  };
  const positionInfo = {
    'buy to open': pInfo(p => p.status === 'pending' && p.context.action === 'buy'),
    'buy to close': pInfo(p => p.status === 'open' && p.context.action === 'sell'),
    'sell to open': pInfo(p => p.status === 'pending' && p.context.action === 'sell'),
    'sell to close': pInfo(p => p.status === 'open' && p.context.action === 'buy'),
    closed: closed?.length,
    expired: _.flatMap(positions, p => p.expiredOrders).length,
  };
  console.log(`\n***`);
  console.table(walletInfo);
  console.table(positionInfo);
  console.log(`\n***`);
};
