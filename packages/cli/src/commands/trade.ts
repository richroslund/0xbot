import { ContractWrappers } from '@0x/contract-wrappers';
import { getAssets, Account } from '@0x/lib';
import { queryOrders } from '../actions/query';
import _ from 'lodash';

import chalk from 'chalk';
import { Argv } from 'yargs';
import { SupportedProvider } from '0x.js';
import { fillOrder } from '../actions/fill';
const log = console.log;
const rnd = (val?: number) => (val ? _.round(val, 4) : undefined);
export const tradeCommand = <T = {}>(yargs: Argv<T>, provider: SupportedProvider, contracts: ContractWrappers, address: string) => {
  return yargs.command(
    'trade',
    'fill or create orders',
    yarg => {
      return yarg
        .option('buy', { alias: 'b', type: 'boolean', describe: 'buy order' })
        .option('sell', { alias: 's', type: 'boolean', describe: 'sell order' })
        .option('fill', { alias: 'f', type: 'boolean' })
        .option('price', { alias: 'p', type: 'number', describe: 'order price. buy ? price or less : price or greater' })
        .option('amount', { alias: 'amt', type: 'number', describe: 'order amount' });
    },
    async argv => {
      const { action, fill, buy, sell, price, amount } = argv;

      if (fill && (buy || sell) && price && amount) {
        const assets = getAssets(contracts.contractAddresses);
        const { best } = await queryOrders(contracts, assets);
        const bestBid = best.bid ? best.bid.price : undefined;
        const bestAsk = best.ask ? best.ask.price : undefined;
        console.log('best prices', { bid: rnd(bestBid), ask: rnd(bestAsk) });
        const ask = best.ask;
        const bid = best.bid;
        if (buy && bestAsk && ask && bestAsk <= price) {
          log(chalk.blue('buying', amount, ` ETH for ${amount * price} at`, rnd(bestAsk)));
          const tx = await fillOrder(contracts, address, ask.signedOrder, amount * price);
          log(chalk.gray(`${tx.transactionIndex} - ${tx.status}`));
          log(chalk.blue('bought', amount, ` ETH for ${amount * price} DAI`));
        } else if (buy && bestAsk) {
          log(chalk.gray(`no sell exists at or below $${price} (best: $${rnd(bestAsk)})`));
        } else if (action === 'sell' && bestBid && bid && bestBid >= price) {
          log(chalk.green('selling', amount, ` ETH for ${amount * price} at`, rnd(bestBid)));
          return await fillOrder(contracts, address, bid.signedOrder, amount);
        } else {
          log(chalk.gray(`no buys exists at or above $${price} (best: $${rnd(bestBid)})`));
        }
      } else {
        log(chalk.redBright(`options are invalid`));
      }
      await new Account().getBalancesAsync(provider, contracts, address);
      return;
    }
  );
};
