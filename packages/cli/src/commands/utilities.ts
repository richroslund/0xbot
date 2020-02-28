import { Argv } from 'yargs';

export const transactionOptions = <T = {}>(yargs: Argv<T>) => {
  return yargs.option('nonce', { alias: 'n', describe: 'nonce', type: 'number' }).option('gasprice', { alias: 'g', describe: 'transaction gas price in gwei', type: 'number', default: 1 });
};
