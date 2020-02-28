import { Subprovider } from '@0x/subproviders';
import WalletConnectProvider from '@walletconnect/eth-provider';
import { Web3ProviderEngine, MetamaskSubprovider, RPCSubprovider } from '0x.js';
import { Config } from '../../config';
import { Web3Wrapper } from '@0x/web3-wrapper';
import { SignerSubprovider } from '@0x/subproviders';

export const getProvider = async (type: 'web3' | 'walletconnect', onConnect?: (web3: Web3Wrapper) => Promise<void>) => {
  // Create a Web3 Provider Engine
  const providerEngine = new Web3ProviderEngine();
  // Compose our Providers, order matters
  // Use the SignerSubprovider to wrap the browser extension wallet
  // All account based and signing requests will go through the SignerSubprovider
  let providerName: string | undefined = undefined;

  if (type === 'walletconnect') {
    // const walletConnector = new WalletConnect({
    //   bridge: 'https://bridge.walletconnect.org', // Required
    // });
    // // Check if connection is already established
    // if (!walletConnector.connected) {
    //   // create new session
    //   walletConnector.createSession().then(() => {
    //     // get uri for QR Code modal
    //     const uri = walletConnector.uri;
    //     // display QR Code modal
    //     WalletConnectQRCodeModal.open(uri, () => {
    //       console.log('QR Code Modal closed');
    //     });
    //     walletConnector.on('connect', (error, payload) => {
    //       if (error) {
    //         throw error;
    //       }

    //       // Close QR Code Modal
    //       WalletConnectQRCodeModal.close();

    //       // Get provided accounts and chainId
    //       const { accounts, chainId } = payload.params[0];

    //       console.log(accounts, chainId);
    //     });
    //   });
    // } else {
    //   console.log('wallet already connected!');
    // }
    //  Create WalletConnect Provider
    const walletConnectProvider = new WalletConnectProvider({
      infuraId: Config.INFURAKEY, // Required
      chainId: 1,
    });
    //await walletConnectProvider.enable();
    // return { provider: walletConnectProvider, name: providerName };

    // const cwWeb3 = new Web3(walletConnectProvider as any);
    // const cwProvider = cwWeb3.currentProvider;
    // if (cwProvider) {
    //   providerEngine.addProvider(new SignerSubprovider(cwWeb3.currentProvider as any));
    // }
    providerEngine.addProvider(new SignerSubprovider(walletConnectProvider));
  } else {
    let injectedProviderIfExists = (window as any).ethereum;
    if (injectedProviderIfExists !== undefined) {
      if (injectedProviderIfExists.enable !== undefined) {
        try {
          providerName = 'Browser';
          await injectedProviderIfExists.enable();
        } catch (err) {
          console.log(err);
        }
      }
    } else if ((window as any).web3) {
      const injectedWeb3IfExists = (window as any).web3;
      if (injectedWeb3IfExists !== undefined && injectedWeb3IfExists.currentProvider !== undefined) {
        providerName = 'Legacy browser';
        injectedProviderIfExists = injectedWeb3IfExists.currentProvider;
      } else {
        injectedProviderIfExists = undefined;
      }
    }
    if (injectedProviderIfExists) {
      providerEngine.addProvider(new MetamaskSubprovider(injectedProviderIfExists));
      //providerEngine.addProvider(new MetamaskSubprovider(injectedProviderIfExists));
    } else {
      console.error('no web3 found!');
    }
  }

  //  Create Web3
  //const wcWeb3 = new Web3(walletConnectProvider);

  providerEngine.addProvider(new RPCSubprovider(Config.RPCPROVIDER));
  const response = new Promise((resolve, reject) => {});
  providerEngine.start((...args: any[]) => console.log('on start', args));

  // Get all of the accounts via Web3Wrapper
  return { provider: providerEngine, name: providerName };
};
