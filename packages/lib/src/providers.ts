import { PrivateKeyWalletSubprovider } from '@0x/subproviders';
import { readFileSync, existsSync } from 'fs';
import { ethers } from 'ethers';
import { Web3ProviderEngine, RPCSubprovider } from '0x.js';
import _ from 'lodash';
import { RPCURL } from './config';
import { WalletInfo } from './wallet';
export * from 'ethers';
export const getProviderFromKeystore = async (keystore: string, password: string) => {
  if (!existsSync(keystore)) {
    const exception = 'keystore (' + keystore + ') doesnt exist!';
    throw exception;
  }
  const jsonStr = readFileSync(keystore);
  const wallet = await ethers.Wallet.fromEncryptedJson(jsonStr.toString(), password);
  const providerEngine = new Web3ProviderEngine();
  const pk = _.take(wallet.privateKey, 2).join('') === '0x' ? _.drop(wallet.privateKey, 2).join('') : wallet.privateKey;
  providerEngine.addProvider(new PrivateKeyWalletSubprovider(pk));
  providerEngine.addProvider(new RPCSubprovider(RPCURL));
  providerEngine.start();
  return { providerEngine, address: wallet.address, wallet: new WalletInfo(providerEngine, wallet.address) };
};
