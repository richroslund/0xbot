import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ContractWrappers } from '@0x/contract-wrappers';
import constate from 'constate';
import { useWeb3 } from './useWeb3';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBestPricesThunk, fillOrder, ThunkResult } from '../state/thunks';
import { SignedOrder, Web3ProviderEngine, signatureUtils, Order, SupportedProvider } from '0x.js';
import { ZrxOrderBuilder, ZrxApi, SRAWrapper, signOrder } from '@0x/lib';
import { getAddress } from '../state/selector';
import { actions } from '../state/state';
import { joinPool } from './zrx/stakingCommands';
import { JoinPoolAsMaker } from '../components/staking/JoinPoolAsMaker';
import _ from 'lodash';

export interface CreateOrderRequest {
  expiresInSeconds: number;
  makerToken: string;
  makerAmount: number;
  takerToken: string;
  takerAmount: number;
}

const createMeshOrder = (web3: SupportedProvider, contracts: ContractWrappers) => (request: CreateOrderRequest): ThunkResult<Promise<any>> => {
  const { expiresInSeconds, makerAmount, makerToken, takerAmount, takerToken } = request;
  const buildAndSignOrder = async (address: string) => {
    const builder = new ZrxOrderBuilder(contracts)
      .expiresIn(expiresInSeconds)
      .maker(address)
      .sell(makerAmount, makerToken)
      .for(takerAmount, takerToken);
    const order = builder.toOrder();
    const signedOrder = await signatureUtils.ecSignOrderAsync(web3, order, address).catch(err => {
      alert(`sign order error: ${_.toString(err)}`);
      throw err;
    });
    return { signed: signedOrder, order };
  };
  return function(dispatch, getState) {
    const address = getAddress(getState());
    if (address) {
      return buildAndSignOrder(address).then(async ({ order, signed }) => {
        dispatch(actions.order.created({ order: signed }));
        const radarRelay = new SRAWrapper('radarrelay');
        const signedRadarOrders = await radarRelay.signOrdersWithConfig([order], (ord: Order) => signOrder(web3, ord, address));
        const radarRelayPostOrder = radarRelay.postOrders(signedRadarOrders);
        return Promise.all([new ZrxApi().postOrder(signed), radarRelayPostOrder]);
      });
    } else {
      return Promise.resolve(false);
    }
  };
};

function useZrxContext() {
  const { web3, contracts } = useWeb3();
  const dispatch = useDispatch();
  const create = useCallback(
    (request: CreateOrderRequest) => {
      if (web3 && contracts) {
        dispatch(createMeshOrder(web3, contracts)(request));
      } else {
        console.error('order creation cancelled, web3 or contracts are null');
      }
    },
    [dispatch, web3, contracts]
  );
  const fill = useCallback(
    (address: string, order: SignedOrder, amount: number) => {
      if (contracts) {
        return dispatch(fillOrder(contracts)(address, order, amount));
      }
    },
    [contracts, dispatch]
  );
  const staking = useMemo(() => {
    if (web3 && contracts) {
      return {
        joinAsMaker: (poolid: string) => dispatch(joinPool(web3, contracts)(poolid)),
      };
    } else {
      return {
        joinAsMaker: (poolid: string) => console.log('web3 or contracts are null'),
      };
    }
  }, [contracts, dispatch, web3]);
  return {
    fill,
    create,
    staking: staking,
  };
}
export const [ZrxContextProvider, useZrx] = constate(useZrxContext);
