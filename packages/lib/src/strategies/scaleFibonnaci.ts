import { getIndicators } from './../ta/index';
import { Timeframes } from './../types';
import { ContractWrappers } from '@0x/contract-wrappers';
import { SupportedProvider } from '0x.js';
import { coinbase, Account, EthDaiOrders } from '..';
import _ from 'lodash';

const min = (prices: number[], lastPrice: number) => {
  const maxPrice = _.max(prices) || lastPrice;
  return _.min([maxPrice, lastPrice]) || lastPrice;
};

export class ScaleFibonnaci {
  private provider: SupportedProvider;
  private contracts: ContractWrappers;
  private config: { minEthPerOrder: number; minDaiPerOrder: number };
  constructor(providerEngine: SupportedProvider, contractWrappers: ContractWrappers, config: { minEthPerOrder: number; minDaiPerOrder: number }) {
    this.provider = providerEngine;
    this.contracts = contractWrappers;
    this.config = config;
  }
  private getPriceInfo = async (symbol: string, timeframe: Timeframes) => {
    const { ticker } = await coinbase.getTicker(symbol);
    if (ticker === undefined) {
      const tErr = 'ticker is null';
      throw tErr;
    }
    const lastPrice = parseFloat(ticker.price) || -1;
    const history = await coinbase.historicalCandles(symbol, timeframe);
    const indicator = getIndicators(history, lastPrice);

    //logFib('hour', lastPrice, hourly);
    return { indicator, lastPrice };
  };
  private priceRange = (fibBands: number[], lastPrice: number) => {
    const orderedFibs = _.orderBy(fibBands);
    const orderedFibsWithLastPrice = _.orderBy([...fibBands, lastPrice]);
    const topOfBands = _.last(orderedFibsWithLastPrice) === lastPrice;
    const topOfBandsValue = min(fibBands, lastPrice);
    const currPriceIndex = _.indexOf(orderedFibsWithLastPrice, lastPrice);
    if (topOfBands) {
      return {
        bid: {
          min:
            _(orderedFibs)
              .dropRight(1)
              .last() || lastPrice,
          max: topOfBandsValue,
        },
        ask: {
          min: lastPrice,
          max: lastPrice,
        },
      };
    } else if (_.first(orderedFibsWithLastPrice) === lastPrice) {
      return {
        bid: {
          min: lastPrice,
          max: lastPrice,
        },
        ask: {
          min: lastPrice,
          max:
            _(orderedFibs)
              .drop(1)
              .first() || lastPrice,
        },
      };
    } else {
      const currRangeBid = orderedFibsWithLastPrice[currPriceIndex - 1];
      const currRangeAsk = orderedFibsWithLastPrice[currPriceIndex + 1];
      const rangeDiff = currRangeAsk - currRangeBid;
      let maxAsk = 0.15 * rangeDiff > currRangeAsk - lastPrice ? rangeDiff * 0.25 + currRangeAsk : currRangeAsk;
      let minBid = 0.15 * rangeDiff > lastPrice - currRangeBid ? currRangeBid - rangeDiff * 0.25 : currRangeBid;
      return {
        bid: {
          min: minBid,
          max: lastPrice,
        },
        ask: {
          min: lastPrice,
          max: maxAsk,
        },
      };
    }
  };

  private getOrderPrice = (minPrice: number, maxPrice: number, totalOrders: number, index: number) => {
    const diff = maxPrice - minPrice;
    const orderRange = diff / totalOrders;
    const currMin = minPrice + index * orderRange;
    const currMax = _.min([minPrice + (index + 1) * orderRange, maxPrice]) || maxPrice;
    const price = _.random(currMin, currMax, true);
    return price;
  };
  private generateBidAskOrders = (range: { min: number; max: number } | undefined, count: number, totalAmount: number, minAmount: number) => {
    if (range === undefined) {
      return [];
    } else if (range.min === range.max) {
      return [{ price: range.max, amount: _.max([totalAmount, minAmount]) || minAmount }];
    } else {
      return _.times(count, num => {
        return {
          price: this.getOrderPrice(range.min, range.max, count, num),
          amount: _.max([totalAmount / count, minAmount]) || minAmount,
        };
      });
    }
  };
  private filterOrdersBasedOffAvailableBalance<T extends { amount: number }>(orders: T[], totalAmount: number, order: 'desc' | 'asc') {
    const orderedOrders = _.orderBy(orders, o => o.amount, order);
    return _.reduce(
      orderedOrders,
      (results: T[], curr: T): T[] => {
        const currTotal = _(results)
          .union([curr])
          .map(o => o.amount)
          .sum();
        if (currTotal > totalAmount) {
          return results;
        } else {
          return [...results, curr];
        }
      },
      []
    );
  }

  public generateOrders = async (
    address: string,
    symbol: string,
    options: {
      bidtimeframe: Timeframes;
      asktimeframe: Timeframes;
      count: number;
      percentageOfBalance: number;
      expiresInSeconds: number;
    }
  ) => {
    const { bidtimeframe, asktimeframe, count, percentageOfBalance, expiresInSeconds } = options;
    const bidIndicator = await this.getPriceInfo(symbol, bidtimeframe);
    const askIndicator = await this.getPriceInfo(symbol, asktimeframe);
    if (!bidIndicator || !askIndicator) {
      console.warn('indicators is null');
      return {
        bids: [],
        asks: [],
        base: {
          bids: [],
          asks: [],
        },
      };
    }
    const { balances } = await new Account().getBalancesAsync(this.provider, this.contracts, address);
    const availableDai = balances.dai * percentageOfBalance;
    const availableWeth = balances.weth * percentageOfBalance;
    let generatedBids: { price: number; amount: number }[] = [];
    let generatedAsks: { price: number; amount: number }[] = [];
    if (bidIndicator.indicator) {
      const bidrange = this.priceRange(bidIndicator.indicator.fibBands || [], bidIndicator.lastPrice);
      generatedBids = this.filterOrdersBasedOffAvailableBalance(this.generateBidAskOrders(bidrange.bid, count, availableDai, this.config.minDaiPerOrder), availableDai, 'desc');
    }
    if (askIndicator.indicator) {
      const askrange = this.priceRange(askIndicator.indicator.fibBands || [], askIndicator.lastPrice);

      generatedAsks = this.filterOrdersBasedOffAvailableBalance(this.generateBidAskOrders(askrange.ask, count, availableWeth, this.config.minEthPerOrder), availableWeth, 'asc');
      console.log(askrange.ask, generatedAsks, askrange.ask, count, availableWeth);
    }
    const ethDaiorders = new EthDaiOrders(this.contracts);
    return {
      base: {
        bids: generatedBids,
        asks: generatedAsks,
      },
      bids: generatedBids.filter(go => go.price > 0).map(go => ethDaiorders.buy(go.price, go.amount, address, expiresInSeconds)),
      asks: generatedAsks.filter(go => go.price > 0).map(go => ethDaiorders.sell(go.price, go.amount, address, expiresInSeconds)),
    };
  };
  // logBalances(balances);

  // console.log(chalk.yellow(`${bid} - ${ask}`));
}
