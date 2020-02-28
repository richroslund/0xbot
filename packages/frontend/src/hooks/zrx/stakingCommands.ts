import { getAddress } from './../../state/selector';
import { ThunkResult } from './../../state/thunks';
import { ContractWrappers } from '@0x/contract-wrappers';
import { Staking } from '@0x/lib';
import { Web3ProviderEngine, SupportedProvider } from '0x.js';

export const joinPool = (web3: SupportedProvider, contracts: ContractWrappers) => (poolId: string): ThunkResult<Promise<any>> => {
  return function(dispatch, getState) {
    const address = getAddress(getState());
    if (address) {
      return new Staking(web3, contracts).joinAsMaker(address, poolId, { from: address }).then(ord => {
        console.log(ord);
        //   const signedRadarOrders = await radarRelay.signOrdersWithConfig([order], (ord: Order) => signOrder(this.provider, ord, address));
        // return await Promise.all([new ZrxApi().postOrder(signed), radarRelay.postOrders(signedRadarOrders)]);
        return ord;
      });
    } else {
      return Promise.resolve(false);
    }
  };
};
