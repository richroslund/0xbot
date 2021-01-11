import { Balances } from './../types';
import _ from 'lodash';
export class BaseEngine {
  protected getTokenBalances = (balances: Balances, baseToken: string, quoteToken: string) => {
    const base = _.get(balances.balancesByAddress, baseToken, 0);
    const quote = _.get(balances.balancesByAddress, quoteToken, 0);
    return {
      base,
      quote,
    };
  };
}
