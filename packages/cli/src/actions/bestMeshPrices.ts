import { SignedOrder } from '@0x/order-utils';
import { ContractWrappers } from '@0x/contract-wrappers';
import { getAssets, coinbase } from '@0x/lib';
import { queryOrders } from './query';
import { PriceChangeValues, PriceValues, ChangeDirections } from '../types';
import _ from 'lodash';

export type BestPricesResult = {
  bid: {
    price: number | undefined;
    change: ChangeDirections;
    maker: string | undefined;
    order: SignedOrder | undefined;
  };
  ask: {
    price: number | undefined;
    change: ChangeDirections;
    maker: string | undefined;
    order: SignedOrder | undefined;
  };
  lastPrice: {
    price: number | undefined;
    change: ChangeDirections;
  };
};

interface LastPriceValues {
  [symbol: string]: {
    ask?: number;
    bid?: number;
    lastPrice?: number;
  };
}
const getPriceChanges = (prices: PriceValues, existingPrices: PriceValues): PriceChangeValues => {
  const res = _.reduce(
    prices,
    (acc: PriceChangeValues, v: string | number | undefined, k) => {
      const existing = existingPrices[k];
      let currValue: ChangeDirections = 0;
      if (_.isEqual(existing, v)) {
        currValue = 0;
      } else if (existing === undefined) {
        currValue = 1;
      } else if (v === undefined) {
        currValue = -1;
      } else {
        const existingNum = _.isNumber(existing) ? existing : parseFloat(existing);
        const currNum = _.isNumber(v) ? v : parseFloat(v);
        currValue = currNum > existingNum ? 1 : -1;
      }

      return { ...acc, [k]: currValue };
    },
    {}
  );
  return res;
};
const bestPrices = async (contracts: ContractWrappers, lastPrices: LastPriceValues, symbol: string) => {
  const existing = lastPrices[symbol] || {
    bid: undefined,
    ask: undefined,
    lastPrice: undefined,
  };
  const { ticker } = await coinbase.getTicker(symbol);
  const { best } = await queryOrders(contracts, getAssets(contracts.contractAddresses));
  if (ticker === undefined) {
    const err = 'ticker is null';
    throw err;
  }
  const currPrices = {
    bid: best.bid?.price,
    ask: best.ask?.price,
    lastPrice: parseFloat(ticker.price),
  };
  const priceChanges = getPriceChanges(currPrices, existing);
  lastPrices[symbol] = currPrices;
  return {
    bid: {
      price: currPrices.bid,
      change: priceChanges.bid,
      maker: best.bid?.ord.order.makerAddress,
      order: best.bid?.ord.order,
    },
    ask: {
      price: currPrices.ask,
      change: priceChanges.ask,
      maker: best.ask?.ord.order.makerAddress,
      order: best.ask?.ord.order,
    },
    lastPrice: {
      price: currPrices.lastPrice,
      change: priceChanges.lastPrice,
    },
  };
};

export class PriceWatcher {
  private contracts: ContractWrappers;
  private lastPrices: LastPriceValues;
  constructor(contracts: ContractWrappers) {
    this.contracts = contracts;
    this.lastPrices = {};
  }
  public getBestPrices = async (symbol: string) => bestPrices(this.contracts, this.lastPrices, symbol);
}
