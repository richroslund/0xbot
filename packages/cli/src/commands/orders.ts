import { startCLI } from './../ui/index';
import { logOrder } from './../actions/log';
import { SupportedProvider, Web3Wrapper } from '@0x/web3-wrapper';
import { ContractWrappers } from '@0x/contract-wrappers';
import { SRAWrapper, calculateProtocolFee, Account, ZrxApi, ADDRESSES, DECIMALS, SignedOrderWithMetadata, getCurrentUnixTimestampSec, ZrxOrderBuilder, createNewOrder, signOrder, ZrxWrapper, getAssets, TX_DEFAULTS } from '@0x/lib';
import _ from 'lodash';
import chalk from 'chalk';
import { Argv } from 'yargs';
import { BigNumber, Order } from '0x.js';
import { queryOrders } from './../actions/query';
import { transactionOptions } from './utilities';
const rnd = (val: number) => _.round(val, 4);

const transactionVals = (orderOptions: { nonce?: number; gasprice?: number; gasmax?: number }) => {
  const { nonce, gasprice } = orderOptions;
  const gasPrice = gasprice ? 1000000000 * gasprice : undefined;
  return nonce
    ? {
        nonce,
        gasPrice,
      }
    : { gasPrice };
};

export class Orders {
  private provider: SupportedProvider;
  private contracts: ContractWrappers;
  constructor(providerEngine: SupportedProvider, contractWrappers: ContractWrappers) {
    this.provider = providerEngine;
    this.contracts = contractWrappers;
  }
  public market = async (address: string, options: { price: number; buy: boolean; asset: 'weth' | 'dai'; amount: number; dryrun?: boolean }, orderOptions: { nonce?: number; gasprice?: number; gasmax?: number }) => {
    const { dryrun, amount, asset, buy, price } = options;
    const { nonce, gasprice } = orderOptions;

    const gasPrice = gasprice ? 1000000000 * gasprice : new BigNumber(TX_DEFAULTS.gasPrice);

    const transactionData = nonce
      ? {
          nonce,
          gasPrice,
        }
      : { gasPrice };

    const wrapper = new ZrxWrapper(this.contracts);
    const orders = await queryOrders(this.contracts, getAssets(this.contracts.contractAddresses));

    const { balances } = await new Account().getBalancesAsync(this.provider, this.contracts, address);
    if (buy && orders.asks.length > 0) {
      const asks = _.filter(orders.asks, o => o.price < price);
      const bal = _.get(balances, asset, 0);
      const buyAmt = _.min([amount, bal]) || 0;

      if (asks.length === 0) {
        console.log(chalk.red(`not placing order because no orders exist with price < ${price}`));
      } else {
        console.log(`found ${asks.length} matching orders`, '[', asks.map(o => o.price).join(','), ']');
        const amountToBuy = Web3Wrapper.toBaseUnitAmount(buyAmt, DECIMALS);
        const marketOrders = _.take(
          asks.map(o => o.signedOrder),
          4
        );
        const trans = wrapper.marketBuyFillOrKillTransaction(marketOrders, amountToBuy);
        console.log('buying', `${Web3Wrapper.toUnitAmount(amountToBuy, DECIMALS).toNumber()} ETH at or below ${price}`);
        if (!dryrun) {
          console.log('executing...');
          const fee = calculateProtocolFee(marketOrders, transactionData.gasPrice);
          const txData = { ...transactionData, from: address, value: fee };
          const gas = await trans.transaction.estimateGasAsync(txData);
          const res = await trans.transaction.sendTransactionAsync({ ...txData, gas });
          console.log('transaction...', chalk.blue(res));
        }
      }
    } else if (!buy && orders.bids.length > 0) {
      const bids = _.filter(orders.bids, o => o.price > price);
      const bal = _.get(balances, asset, 0);
      const baseAmt = _.min([amount, bal]) || 0;
      if (bids.length === 0) {
        console.log(chalk.red(`not placing order because no orders exist with price > ${price}`));
      } else {
        console.log(`found ${bids.length} matching orders`, '[', bids.map(o => o.price).join(','), ']');
        const amountToBuy = Web3Wrapper.toBaseUnitAmount(baseAmt, DECIMALS);
        const marketOrders = _.take(
          bids.map(o => o.signedOrder),
          4
        );
        const trans = wrapper.marketSellFillOrKillTransaction(marketOrders, amountToBuy);
        console.log('selling', `${Web3Wrapper.toUnitAmount(amountToBuy, DECIMALS).toNumber()} ETH at or above ${price}`);
        if (!dryrun) {
          console.log('executing...');
          const fee = calculateProtocolFee(marketOrders, transactionData.gasPrice);
          const txData = { ...transactionData, from: address, value: fee };
          const gas = await trans.transaction.estimateGasAsync(txData);
          const res = await trans.transaction.sendTransactionAsync({ ...txData, gas });

          console.log('transaction...', chalk.blue(res));
        }
      }
    }

    return true;

    // if (dryrun) {
    //   console.log(order);
    //   return order;
    // } else {
    //   let signed = await signOrder(this.provider, order, address);
    //   return await new ZrxApi().postOrder(signed);
    // }
  };
  public createOrder = async (address: string, options: { price: number; buy: boolean; asset: 'weth' | 'dai'; amount: number; expiresIn: number; dryrun?: boolean }) => {
    const { expiresIn, dryrun, amount, asset, buy, price } = options;
    const { balances } = await new Account().getBalancesAsync(this.provider, this.contracts, address);
    const buyWeth = (asset === 'weth' && buy) || (asset === 'dai' && !buy);
    let wethAmount = amount;
    if (buy && asset === 'weth') {
      const maxAmount = price * balances.dai;
      wethAmount = _.min([amount, maxAmount]) || 0;
    } else {
      wethAmount = asset === 'weth' ? _.min([amount, balances.weth]) || 0 : price / (_.min([amount, balances.dai]) || 0);
    }
    const builder = new ZrxOrderBuilder(this.contracts).expiresIn(expiresIn).maker(address);
    const orderInfo = buyWeth
      ? builder
          .sell(amount * price, 'dai')
          .for(amount, 'weth')
          .toValue()
      : builder
          .sell(amount, 'weth')
          .for(amount * price, 'dai')
          .toValue();
    const order = await createNewOrder(this.contracts, { ...orderInfo });
    console.log('-', chalk.yellow(`${rnd(price)} x ${rnd(wethAmount)} = ${Web3Wrapper.toUnitAmount(order.takerAssetAmount, DECIMALS).toNumber()}`, '- current date', new Date().valueOf() / 1000));
    if (dryrun) {
      console.log('Dryrun! Would have sent', order);
      return order;
    } else {
      const radarRelay = new SRAWrapper('radarrelay');

      const signed = await signOrder(this.provider, order, address);
      const signedRadarOrders = await radarRelay.signOrdersWithConfig([order], (ord: Order) => signOrder(this.provider, ord, address));
      return await Promise.all([new ZrxApi().postOrder(signed), radarRelay.postOrders(signedRadarOrders)]);
    }
  };
}

const filterExpired = (orders: SignedOrderWithMetadata[], includeExpired?: boolean) => (includeExpired === true ? orders : _.filter(orders, o => o.order.expirationTimeSeconds.isGreaterThan(getCurrentUnixTimestampSec())));
const listOrders = async (contracts: ContractWrappers, address: string, includeExpired?: boolean) => {
  try {
    const accountOrders = await new ZrxApi().getOpenOrders(address, ADDRESSES.dai, contracts.contractAddresses.etherToken);
    const { bids, asks, others } = {
      bids: filterExpired(accountOrders.bids, includeExpired),
      asks: filterExpired(accountOrders.asks, includeExpired),
      others: filterExpired(accountOrders.others, includeExpired),
    };
    console.log('bids', bids.length, 'asks', asks.length, 'others', others.length);
    console.log(chalk.underline('Open orders'));
    const askResults = asks.map(async (order: SignedOrderWithMetadata) => {
      const orderInfo = await contracts.exchange.getOrderInfo(order.order).callAsync();
      const title = `ask: ${chalk.yellow(orderInfo.orderStatus)}:`;
      logOrder(title, order.order.takerAssetAmount.dividedBy(order.order.makerAssetAmount), order.metaData.remainingFillableTakerAssetAmount, order.metaData.orderHash, order.order.expirationTimeSeconds);
    });
    await Promise.all(askResults);
    const bidResults = bids.map(async (order: SignedOrderWithMetadata) => {
      const orderInfo = await contracts.exchange.getOrderInfo(order.order).callAsync();
      const title = `bid: ${chalk.yellow(orderInfo.orderStatus)}:`;
      logOrder(title, order.order.makerAssetAmount.dividedBy(order.order.takerAssetAmount), order.metaData.remainingFillableTakerAssetAmount, order.metaData.orderHash, order.order.expirationTimeSeconds);
    });
    await Promise.all(bidResults);

    others.forEach((order: SignedOrderWithMetadata) => {
      logOrder('other order', order.order.makerAssetAmount.dividedBy(order.order.takerAssetAmount), Web3Wrapper.toUnitAmount(order.metaData.remainingFillableTakerAssetAmount, DECIMALS), order.metaData.orderHash, order.order.expirationTimeSeconds);
    });

    return { bids, asks };
  } catch (err) {
    console.log('list orders error', err);
  }
};
const cancelAllOpenOrders = async (contracts: ContractWrappers, address: string, orderOptions: { nonce?: number; gasprice?: number; gasmax?: number }) => {
  const accountOrders = await new ZrxApi().getOpenOrders(address, ADDRESSES.dai, contracts.contractAddresses.etherToken);
  const { bids, asks, others } = {
    bids: filterExpired(accountOrders.bids, false),
    asks: filterExpired(accountOrders.asks, false),
    others: filterExpired(accountOrders.others, false),
  };
  const maxSalt = _([bids, asks, others])
    .flatten()
    .map(o => o.order.salt)
    .max();
  if (maxSalt) {
    const trans = contracts.exchange.cancelOrdersUpTo(new BigNumber(maxSalt));
    const txData = { ...transactionVals(orderOptions), from: address };
    const gas = await trans.estimateGasAsync(txData);
    const res = await trans.sendTransactionAsync({ ...txData, gas });
    return res;
  } else {
    console.log('no orders exist!');
  }
};
const cancelOrderBySalt = async (contracts: ContractWrappers, address: string, salt: number) => {
  return await contracts.exchange.cancelOrdersUpTo(new BigNumber(salt)).sendTransactionAsync({
    from: address,
  });
};

export const setupOrderCommands = <T = {}>(yargs: Argv<T>, provider: SupportedProvider, contracts: ContractWrappers, address: string) => {
  return yargs
    .command(
      'create <asset>',
      'create order',
      yy => {
        return transactionOptions(yy)
          .positional('asset', {
            describe: 'order asset',
            type: 'string',
            choices: ['eth', 'weth', 'dai'],
          })
          .option('buy', {
            alias: 'b',
            describe: 'specifying buy order and price',
            type: 'number',
          })
          .option('sell', {
            alias: 's',
            describe: 'specifying sell order and price',
            type: 'number',
          })
          .option('amount', { alias: 'a', describe: 'amount of asset for order', type: 'number', required: true })
          .option('market', { describe: 'create as a market order', type: 'boolean', default: false })
          .option('dryrun', { describe: 'dryrun?', type: 'boolean', default: false })
          .option('expires', { alias: 'e', describe: 'lifespan of order in seconds', type: 'number', default: 900 });
      },
      async argv => {
        const { amount, expires, dryrun, asset, buy, sell, market, nonce, gasprice } = argv;
        if (asset === undefined) {
          const error = 'amount|asset|(sell|buy) must be defined';
          throw error;
        }
        const cleanAsset = asset.toLocaleLowerCase().trim();
        const assetValue = _.includes(['weth', 'eth', 'dai'], cleanAsset) ? (cleanAsset === 'dai' ? 'dai' : 'weth') : undefined;
        if (assetValue === undefined) {
          const unknownAsset = 'Unknown asset ' + asset;
          throw unknownAsset;
        }
        if (!buy && !sell) {
          const actionErr = 'you must choose --buy or --sell';
          throw actionErr;
        }
        const actions: Promise<any>[] = [];
        const orderHandler = new Orders(provider, contracts);
        if (market === true) {
          if (buy) {
            actions.push(orderHandler.market(address, { price: buy, amount, buy: true, asset: assetValue, dryrun }, { nonce, gasprice }));
          }
          if (sell) {
            actions.push(new Orders(provider, contracts).market(address, { price: sell, amount, buy: false, asset: assetValue, dryrun }, { nonce, gasprice }));
          }
        } else {
          if (buy) {
            actions.push(orderHandler.createOrder(address, { price: buy, amount, buy: true, asset: assetValue, dryrun, expiresIn: expires }));
          }
          if (sell) {
            actions.push(orderHandler.createOrder(address, { price: sell, amount, buy: false, asset: assetValue, dryrun, expiresIn: expires }));
          }
        }
        return await Promise.all(actions).then(() => process.exit());
      }
    )
    .command(
      'watch',
      'watch 0x orders',
      () => {},
      async () => {
        return await startCLI();
      }
    )
    .command(
      'list',
      'list 0x orders',
      () => {},
      async () => {
        return await listOrders(contracts, address, true);
      }
    )
    .command(
      'cancel [salt]',
      'cancel 0x order',
      y => {
        return transactionOptions(y).positional('salt', { type: 'number', describe: 'order salt to cancel up to' });
      },
      async argv => {
        const { salt, nonce, gasprice } = argv;
        if (salt) {
          const cancelled = await cancelOrderBySalt(contracts, address, salt);
          console.log('order cancelled!', salt, cancelled);
          return cancelled;
        } else {
          const cancelled = await cancelAllOpenOrders(contracts, address, { nonce, gasprice });
          console.log('order cancelled!', cancelled);
        }
      }
    );
};
