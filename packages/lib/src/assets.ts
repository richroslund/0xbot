import { ADDRESSES } from './config';
import { assetDataUtils, ContractAddresses } from '0x.js';
export const getAssets = (contractAddresses: ContractAddresses) => {
  return {
    eth: assetDataUtils.encodeERC20AssetData(contractAddresses.etherToken),
    weth: assetDataUtils.encodeERC20AssetData(contractAddresses.etherToken),
    dai: assetDataUtils.encodeERC20AssetData(ADDRESSES.dai),
    zrx: assetDataUtils.encodeERC20AssetData(contractAddresses.zrxToken),
  };
};
export type AssetData = ReturnType<typeof getAssets>;
