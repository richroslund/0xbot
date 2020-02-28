import { Web3Wrapper } from '@0x/web3-wrapper';
import { ContractWrappers } from '@0x/contract-wrappers';
import { getAssets, DECIMALS } from '@0x/lib';
import _ from 'lodash';
import { BigNumber } from '0x.js';
export const checkBalancesAndAllowances = async (contracts: ContractWrappers, address: string) => {
  const assets = getAssets(contracts.contractAddresses);
  const [balances, allowances] = await contracts.devUtils.getBatchBalancesAndAssetProxyAllowances(address, [assets.dai, assets.weth]).callAsync();
  return _.map(balances, (ba, ind) => {
    const name = ind === 0 ? 'dai' : 'weth';
    const toNum = (val: BigNumber) => Web3Wrapper.toUnitAmount(val, DECIMALS).toNumber();
    const allowance = allowances[ind];
    console.log(`${name}: balance: ${toNum(ba)} allowance: ${toNum(allowance)}`);
  });
};
