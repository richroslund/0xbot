import { SupportedProvider, ERC20TokenContract } from '0x.js';
import { Web3Wrapper } from '@0x/web3-wrapper';
import { toNumber } from './utils';
import { DECIMALS } from './config';
export class WalletInfo {
  private provider: SupportedProvider;
  private address: string;
  constructor(providerEngine: SupportedProvider, ethAddress: string) {
    this.provider = providerEngine;
    this.address = ethAddress;
  }
  public Balance = async () => {
    const weiBalance = await new Web3Wrapper(this.provider).getBalanceInWeiAsync(this.address);
    return toNumber(weiBalance);
  };
}
export class WalletBalance {
  private provider: SupportedProvider;
  constructor(providerEngine: SupportedProvider) {
    this.provider = providerEngine;
  }
  public Balance = async (token: string, address: string, decimals: number = DECIMALS) => {
    console.log(token, 'balance of', address);
    const bnBalance = await new ERC20TokenContract(token, this.provider).balanceOf(address).callAsync();
    return Web3Wrapper.toUnitAmount(bnBalance, decimals).toNumber();
  };
}
