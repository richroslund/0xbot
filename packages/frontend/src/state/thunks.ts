import { Config } from '../config';
import { Web3Wrapper } from '@0x/web3-wrapper';
import { SignedOrder, SupportedProvider } from '0x.js';
import { ContractWrappers } from '@0x/contract-wrappers';
import { ThunkAction } from 'redux-thunk';
import { AppState, AppActions, actions } from './state';
import { toWei, calculateProtocolFee, OrderBookAndBestPriceType, getOrderBookAndBestPriceAsync, getAssets, DECIMALS, EtherscanGasOracleResponse, Account, coinbase } from '@0x/lib';

export const Dispatcher = {};
export type ThunkResult<R> = ThunkAction<R, AppState, undefined, AppActions>;

export function fetchBestPricesThunk(contracts: ContractWrappers): ThunkResult<Promise<OrderBookAndBestPriceType>> {
  const fetchBestPrice = async () => getOrderBookAndBestPriceAsync(contracts, getAssets(contracts.contractAddresses));
  return function(dispatch) {
    dispatch(actions.requestMeshPrices());
    return fetchBestPrice().then(res => {
      dispatch(actions.receiveMeshPrices(res));
      return res;
    });
  };
}

export const fillOrder = (contracts: ContractWrappers) => (address: string, order: SignedOrder, amount: number): ThunkResult<Promise<string>> => {
  const tryfill = (gasPriceValue?: number) => {
    const gasPrice = gasPriceValue ? gasPriceValue * 1000000000 : undefined;
    const transaction = contracts.exchange.fillOrder(order, Web3Wrapper.toBaseUnitAmount(amount, DECIMALS), order.signature);
    return transaction.sendTransactionAsync({ from: address, gasPrice, value: calculateProtocolFee([order], gasPrice) });
  };
  return function(dispatch, getState) {
    const gasPrice = getState().gas.price;
    return tryfill(gasPrice).then(
      resp => {
        dispatch(actions.fillOrderStarted({ transaction: resp }));
        return resp;
      },
      err => {
        dispatch(actions.fillOrderErrored({ error: err }));
        console.log('error', err);
        return 'error';
      }
    );
  };
};

export const getGasPrices = (): ThunkResult<Promise<any>> => {
  const queryGasPrices = () =>
    fetch(`https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${Config.ETHERSCANKEY}`)
      .then(res => res.json())
      .then(res => res as EtherscanGasOracleResponse);
  return function(dispatch) {
    return queryGasPrices().then(gasResponse => {
      dispatch(actions.receiveGasPrices(gasResponse.result));
      return gasResponse.result;
    });
  };
};

export const fetchBalances = (provider: SupportedProvider, contracts: ContractWrappers): ThunkResult<Promise<any>> => {
  return function(dispatch, getState) {
    const address = getState().address;
    if (address === null) {
      console.warn('doing nothing, address is null');
      return Promise.resolve(false);
    }
    return new Account().getBalancesAsync(provider, contracts, address).then(resp => {
      dispatch(actions.receiveBalances(resp));
      return resp;
    });
  };
};

export const fetchCoinbaseTicker = (symbol: string): ThunkResult<Promise<any>> => {
  return function(dispatch) {
    return coinbase.getTicker(symbol).then(({ ticker }) => {
      if (ticker) {
        dispatch(actions.receiveTicker({ symbol, ticker }));
      }

      return ticker;
    });
  };
};
