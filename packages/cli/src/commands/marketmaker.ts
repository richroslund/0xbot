import _ from 'lodash';
import { ContractWrappers } from '@0x/contract-wrappers';
import { Argv } from 'yargs';
import { coinbase, Timeframes, isTimeframe, ADDRESSES, Account, SignedOrderWithMetadata, ZrxApi, getIndicators, ScaleFibonnaci, createAndSignOrder, getFutureDateInSeconds } from '@0x/lib';
import { SupportedProvider } from '0x.js';
import { logFib, logOrder } from '../actions/log';
import chalk from 'chalk';

const getFibs = async (symbol: string, timeframe: Timeframes) => {
  const { ticker } = await coinbase.getTicker(symbol);
  if (ticker === undefined) {
    const err = 'ticker is null';
    throw err;
  }
  const lastPrice = parseFloat(ticker.price) || -1;
  const history = await coinbase.historicalCandles(symbol, timeframe);
  const indicator = getIndicators(history, lastPrice);

  //logFib('hour', lastPrice, hourly);
  return { indicator, lastPrice };
};
const priceRange = (fibBands: number[], lastPrice: number) => {
  const orderedFibs = _.orderBy([...fibBands, lastPrice]);

  const ind = _.indexOf(orderedFibs, lastPrice);
  const bid = _.first(orderedFibs) === lastPrice ? undefined : orderedFibs[ind - 1];
  const ask = _.last(orderedFibs) === lastPrice ? undefined : orderedFibs[ind + 1];
  return {
    bid,
    ask,
  };
};
const createEthSellOrder = (contracts: ContractWrappers, ask: number, amount: number, makerAddress: string, options: { expiresInSeconds: number }) => {
  const { expiresInSeconds } = options;
  const price = ask;
  const takerAmount = amount * price;
  const askLeg = { makerTokenAddress: contracts.contractAddresses.etherToken, takerTokenAddress: ADDRESSES.dai, makerAddress, expiresInSeconds, makerAmount: amount, takerAmount: takerAmount };

  return askLeg;
};
const createEthBuyOrder = (contracts: ContractWrappers, bid: number, amount: number, makerAddress: string, options: { expiresInSeconds: number }) => {
  const { expiresInSeconds } = options;
  const price = bid;
  const takerAmount = amount / price;
  return { makerTokenAddress: ADDRESSES.dai, takerTokenAddress: contracts.contractAddresses.etherToken, makerAddress, expiresInSeconds, makerAmount: amount, takerAmount: takerAmount };
};
const startMarketMaker = async (provider: SupportedProvider, contracts: ContractWrappers, address: string, symbol: string, timeframe: Timeframes, expiresInSeconds: number, options: { minDai: number; minEth: number; bidOffset: number; askOffset: number; bidPercentage: number; askPercentage: number }) => {
  const { bidPercentage, askPercentage, bidOffset, askOffset, minDai, minEth } = options;
  const { indicator, lastPrice } = await getFibs(symbol, timeframe);

  if (indicator) {
    const { ask, bid } = priceRange(indicator.fibBands, lastPrice);
    const { bids, asks } = await new ZrxApi().getOpenOrders(address, ADDRESSES.dai, contracts.contractAddresses.etherToken);
    const { balances } = await new Account().getBalancesAsync(provider, contracts, address);

    const createBid = bids.length === 0 && bid && bid > 0;
    const bidVal = bid ? bid * (1 + bidOffset) : undefined;
    const askval = ask ? ask * (1 - askOffset) : undefined;
    if (balances.weth <= minEth) {
      console.log(chalk.magenta('at or below min eth: ', minEth, '>', balances.weth));
    } else if (asks.length === 0 && askval && askval > 0 && askval > lastPrice) {
      const signedAsk = await createAndSignOrder(provider, contracts, createEthSellOrder(contracts, askval, balances.weth * askPercentage, address, { expiresInSeconds }));
      await new ZrxApi().postOrder(signedAsk);
      logOrder('ask created: ', signedAsk.takerAssetAmount.dividedBy(signedAsk.makerAssetAmount), signedAsk.makerAssetAmount);
    } else if (asks.length > 0) {
      _.map(asks, (askVal: SignedOrderWithMetadata) => {
        logOrder('ask exists', askVal.order.takerAssetAmount.dividedBy(askVal.order.makerAssetAmount), askVal.metaData.remainingFillableTakerAssetAmount, askVal.metaData.orderHash, askVal.order.expirationTimeSeconds);
      });
    } else if (ask && ask <= lastPrice) {
      console.log('ask price is less than lastPrice');
    }

    if (balances.dai <= minDai) {
      console.log(chalk.magenta('at or below min DAI: ', minDai, '>', balances.dai));
    } else if (createBid && bidVal && bidVal < lastPrice) {
      const signedBid = await createAndSignOrder(provider, contracts, createEthBuyOrder(contracts, bidVal, balances.dai * bidPercentage, address, { expiresInSeconds }));
      await new ZrxApi().postOrder(signedBid);
      logOrder('bid created: ', signedBid.makerAssetAmount.dividedBy(signedBid.takerAssetAmount), signedBid.makerAssetAmount);
    } else if (bids.length > 0) {
      _.map(bids, (bidVal: SignedOrderWithMetadata) => {
        logOrder('existing bid', bidVal.order.makerAssetAmount.dividedBy(bidVal.order.takerAssetAmount), bidVal.metaData.remainingFillableTakerAssetAmount, bidVal.metaData.orderHash, bidVal.order.expirationTimeSeconds);
      });
    } else if (bidVal && bidVal >= lastPrice) {
      console.log('bid greater than last price');
    }

    const selected = [ask, bid];
    console.log(`last price: ${chalk.underline('$', lastPrice)}`, 'projected', `[${chalk.red(bidVal)} - ${chalk.green(askval)}]`);
    logFib(timeframe.toString(), lastPrice, indicator, { selected, header: false });

    // logBalances(balances);

    // console.log(chalk.yellow(`${bid} - ${ask}`));
  }
};
const createScaledOrders = async (provider: SupportedProvider, contracts: ContractWrappers, address: string, expiration: number, bidtimeframe: Timeframes, asktimeframe: Timeframes, dryrun: boolean) => {
  const { bids, asks, base } = await new ScaleFibonnaci(provider, contracts, { minEthPerOrder: 0.05, minDaiPerOrder: 25 }).generateOrders(address, 'ETH-USD', { bidtimeframe, asktimeframe, count: 5, percentageOfBalance: 1, expiresInSeconds: getFutureDateInSeconds(expiration).toNumber() });
  if (!dryrun) {
    console.log('posting', bids.length + asks.length, 'orders');
    const allOrders = await Promise.all(
      _(bids)
        .union(asks)
        .map(async o => {
          const signedOrder = await createAndSignOrder(provider, contracts, o);
          const posted = await new ZrxApi().postOrder(signedOrder);
          return { posted, signedOrder };
        })
        .value()
    );
    console.log('posted', allOrders.length, 'orders');
  }

  //await new ZrxApi().postOrder(signedAsk);
  console.log('step orders', base ? { bids: base.bids, asks: base.asks } : { bids: [], asks: [] });
};

export const marketMakerCommand = <T = {}>(yargs: Argv<T>, provider: SupportedProvider, contracts: ContractWrappers, address: string) => {
  return yargs.command(
    'marketmaker',
    'start the marketmaker',
    yarg => {
      return yarg
        .option('bidPercentage', { alias: 'b', type: 'number', default: 0.25, describe: 'percentage of bid to put on market' })
        .option('askPercentage', { alias: 'a', type: 'number', default: 0.25, describe: 'percentage of ask to put on market' })
        .option('bidOffset', { alias: 'bo', type: 'number', default: 0.001, describe: 'offset percentage in regards to price' })
        .option('askOffset', { alias: 'ao', type: 'number', default: 0.001, describe: 'offset percentage in regards to price' })
        .option('minEth', { alias: 'me', type: 'number', default: 0.1, describe: 'min eth before ordering stops' })
        .option('minDai', { alias: 'md', type: 'number', default: 10, describe: 'min dai before ordering stops' })
        .option('interval', { alias: 'i', type: 'number', default: 5000, describe: 'interval to check orders (ms)' })
        .option('timeframe', { alias: 't', type: 'string', describe: 'timeframe options: [quarterHour, hour, sixHour, daily]' })
        .option('bidtimeframe', { alias: 'bt', type: 'string', describe: 'bid timeframe options: [quarterHour, hour, sixHour, daily]' })
        .option('asktimeframe', { alias: 'at', type: 'string', describe: 'ask timeframe options: [quarterHour, hour, sixHour, daily]' })
        .option('expiration', { alias: 'e', type: 'number', default: 300, describe: 'expires in [EXPIRATION] seconds' })
        .option('strategy', { alias: 's', type: 'string', describe: 'strategy for creating orders: FIB|NULL' })
        .option('dryrun', { alias: 'd', type: 'boolean', describe: 'dryrun' });
    },
    async argv => {
      const { interval, timeframe, expiration, bidPercentage, askPercentage, bidOffset, askOffset, minDai, minEth, strategy, bidtimeframe, asktimeframe, dryrun } = argv;
      if (bidPercentage > 1 || bidPercentage < 0) {
        console.error('bidPercentage must be between 0 and 1');
      } else if (askPercentage > 1 || askPercentage < 0) {
        console.error('askPercentage must be between 0 and 1');
      } else if (strategy === 'FIB' && isTimeframe(bidtimeframe) && isTimeframe(asktimeframe)) {
        return await createScaledOrders(provider, contracts, address, expiration, bidtimeframe, asktimeframe, dryrun || false);
      } else {
        if (!isTimeframe(timeframe)) {
          console.error('invalid timeframe', timeframe);
          return;
        }
        setInterval(async () => {
          console.log(' ');
          console.log(' ');
          return await startMarketMaker(provider, contracts, address, 'ETH-USD', timeframe, expiration, { bidPercentage, askPercentage, bidOffset, askOffset, minDai, minEth });
        }, interval);
      }
    }
  );
};
