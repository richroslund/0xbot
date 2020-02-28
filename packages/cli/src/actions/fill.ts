import { Web3Wrapper } from '@0x/web3-wrapper';
import { SignedOrder, BigNumber } from '0x.js';
import { ContractWrappers } from '@0x/contract-wrappers';
import { DECIMALS, TX_DEFAULTS, calculateProtocolFee } from '@0x/lib';
export const fillOrder = async (contractWrappers: ContractWrappers, address: string, signedOrder: SignedOrder, amount: number) => {
  return await contractWrappers.exchange.fillOrder(signedOrder, Web3Wrapper.toBaseUnitAmount(new BigNumber(amount), DECIMALS), signedOrder.signature).awaitTransactionSuccessAsync({
    from: address,
    ...TX_DEFAULTS,
    value: calculateProtocolFee([signedOrder]),
  });
};
