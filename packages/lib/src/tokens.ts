import { Web3Wrapper } from '@0x/web3-wrapper';
import { DECIMALS } from './config';
import { ContractWrappers } from '@0x/contract-wrappers';
import { ERC20TokenContract, SupportedProvider } from '0x.js';
import { UNLIMITED_ALLOWANCE_IN_BASE_UNITS, TX_DEFAULTS } from '.';
import _ from 'lodash';

export const balance = async (address: string, providerEngine: SupportedProvider, erc20Token: string, decimals: number = DECIMALS) => {
  const bnBalance = await new ERC20TokenContract(erc20Token, providerEngine).balanceOf(address).callAsync();
  return Web3Wrapper.toUnitAmount(bnBalance, decimals).toNumber();
};
export const approveTokens = async (address: string, providerEngine: SupportedProvider, contractWrappers: ContractWrappers, erc20Tokens: string[]) => {
  const approvalResults = Promise.all(
    _.map(erc20Tokens, async token => {
      const approvalTransaction = new ERC20TokenContract(token, providerEngine).approve(contractWrappers.contractAddresses.erc20Proxy, UNLIMITED_ALLOWANCE_IN_BASE_UNITS);
      const approvalRes = await approvalTransaction.awaitTransactionSuccessAsync({ from: address });
      return approvalRes;
    })
  );
  return await approvalResults;
};

export const tryApproveToken = async (contracts: ContractWrappers, address: string, providerEngine: SupportedProvider, token: string) => {
  try {
    const tokenContract = new ERC20TokenContract(token, providerEngine);
    const alreadyApproved = await tokenContract.allowance(address, contracts.contractAddresses.erc20Proxy).callAsync();
    const isApproved = UNLIMITED_ALLOWANCE_IN_BASE_UNITS.isEqualTo(alreadyApproved);
    if (isApproved) {
      console.log(`${token} is already approved`);
      return true;
    } else {
      console.log(`approving ${token}`);
      const approvalTx = await tokenContract.approve(contracts.contractAddresses.erc20Proxy, UNLIMITED_ALLOWANCE_IN_BASE_UNITS).awaitTransactionSuccessAsync({ ...TX_DEFAULTS, from: address });
      return approvalTx.transactionIndex;
    }
  } catch (err) {
    console.log(`approving token error: ${token}`, err);
  }
  return false;
};

export class TokenWrapper {
  private contract: ERC20TokenContract;
  private contracts: ContractWrappers;
  constructor(provider: SupportedProvider, contractWrappers: ContractWrappers, token: string) {
    this.contract = new ERC20TokenContract(token, provider);
    this.contracts = contractWrappers;
  }
  public isApproved = async (address: string) => {
    const alreadyApproved = await this.contract.allowance(address, this.contracts.contractAddresses.erc20Proxy).callAsync();
    return UNLIMITED_ALLOWANCE_IN_BASE_UNITS.isEqualTo(alreadyApproved);
  };
  public approve = async (address: string) => {
    if (this.isApproved(address)) {
      return undefined;
    }
    return this.contract.approve(this.contracts.contractAddresses.erc20Proxy, UNLIMITED_ALLOWANCE_IN_BASE_UNITS);
  };
}
