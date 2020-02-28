import { Account } from '@0x/lib';
import { ContractWrappers } from '@0x/contract-wrappers';

import { Argv } from 'yargs';
import { SupportedProvider } from '0x.js';

export const balanceCommand = <T = {}>(yargs: Argv<T>, provider: SupportedProvider, contracts: ContractWrappers, address: string) => {
  return yargs.command(
    'balances',
    'get address balances',
    () => {},
    async () => await new Account().getBalancesAsync(provider, contracts, address)
  );
};
