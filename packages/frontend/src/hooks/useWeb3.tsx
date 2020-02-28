import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ContractWrappers } from '@0x/contract-wrappers';
import constate from 'constate';
import { Config } from '../config';
import { SupportedProvider, Web3Wrapper } from '@0x/web3-wrapper';
import { useDispatch } from 'react-redux';
import { actions } from '../state/state';
import { TokenWrapper } from '@0x/lib';
import { getProvider } from './zrx/web3Provider';
import { WalletType } from '../types';

// 1️⃣ Create a custom hook as usual
function useWeb3Engine({ web3 }: { web3: SupportedProvider }) {
  const contracts = new ContractWrappers(web3, { chainId: Config.CHAINID });
  const tokenFactory = useCallback((token: string) => new TokenWrapper(web3, contracts, token), [contracts, web3]);
  return { web3, contracts, tokenFactory };
}
export const [Web3ContextProvider, useWeb3] = constate(useWeb3Engine);
export const Web3Provider: React.FC<{ type: WalletType }> = ({ type, children }) => {
  const [web3, setWeb3] = useState<SupportedProvider>();
  const [shouldLoadAddress, setShouldLoadAddress] = useState(false);
  const [, setProviderName] = useState<string>();
  const addressTimeout = useRef<NodeJS.Timeout>();
  const dispatch = useDispatch();
  useEffect(() => {
    const setup = async () => {
      const { provider, name } = await getProvider(type);
      if (provider) {
        setWeb3(provider);
        setShouldLoadAddress(true);
      }
      if (name) {
        setProviderName(name);
      }
    };
    setup();
  }, [dispatch, type]);
  useEffect(() => {
    if (shouldLoadAddress && web3) {
      addressTimeout.current = setInterval(async () => {
        console.log('polling for addresses');
        const addresses = await new Web3Wrapper(web3).getAvailableAddressesAsync();
        if (addresses === undefined || addresses.length === 0) {
          console.log('addresses', addresses);
        } else {
          setShouldLoadAddress(false);
          if (addressTimeout.current) {
            clearInterval(addressTimeout.current);
          }
          dispatch(actions.setAddress({ addresses, address: addresses[0] }));
        }
      }, 1000);
    }
    return () => {
      if (addressTimeout.current) {
        clearInterval(addressTimeout.current);
      }
    };
  }, [dispatch, shouldLoadAddress, web3]);
  return (
    <>
      {web3 && <Web3ContextProvider web3={web3}>{children}</Web3ContextProvider>}
      {!web3 && <>{`web3 loading or not found!`}</>}
    </>
  );
};
