import { ContractWrappers } from '@0x/contract-wrappers';
import _ from 'lodash';
import { SupportedProvider } from '0x.js';
import { balance } from './tokens';
import { ADDRESSES } from './config';
import { WalletInfo } from './wallet';
import { Balances } from './types';

export class Account {
  public getBalancesAsync = async (provider: SupportedProvider, contracts: ContractWrappers, address: string): Promise<Balances> => {
    const balances = {
      zrx: await balance(address, provider, contracts.contractAddresses.zrxToken),
      weth: await balance(address, provider, contracts.contractAddresses.etherToken),
      dai: await balance(address, provider, ADDRESSES.dai),
    };
    const ethBalance = await new WalletInfo(provider, address).Balance();

    return { balances, ethBalance };
  };
}
