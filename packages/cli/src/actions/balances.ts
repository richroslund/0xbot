import { Balances } from '@0x/lib';
import _ from 'lodash';
import chalk = require('chalk');

export const logBalances = ({ ethBalance, balances }: Balances) => {
  const log = console.log;

  const rnd = (val?: number) => (val ? _.round(val, 4) : 0);
  const amt = (val: number | undefined) => chalk.magenta(rnd(val));
  log(' ');
  log(`eth:${amt(ethBalance)} weth:${amt(balances.weth)} dai:${amt(balances.dai)} zrx:${amt(balances.zrx)}`);
  log(' ');
};

export const getBalanceValue = (balances: Balances, lastPrice: number) => {
  return _.sum([balances.balances.dai, balances.balances.weth * lastPrice]);
};
