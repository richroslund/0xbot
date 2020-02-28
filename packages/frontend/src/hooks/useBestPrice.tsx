import React, { useState, useRef, useEffect, useCallback } from 'react';
import constate from 'constate';
import { useWeb3 } from './useWeb3';
import { useDispatch } from 'react-redux';
import { fetchBestPricesThunk } from '../state/thunks';

export const [BestPricesContextProvider, useBestprices] = constate(({ fetch }: { fetch: () => void }) => ({ fetch }));

export const BestpricesProvider: React.FC<{ intervalMs?: number }> = ({ intervalMs, children }) => {
  const timeout = useRef<NodeJS.Timeout>();
  const { contracts } = useWeb3();
  const dispatch = useDispatch();
  const fetch = useCallback(() => (contracts ? dispatch(fetchBestPricesThunk(contracts)) : console.log('contracts is null')), [contracts, dispatch]);
  useEffect(() => {
    const setup = async () => {
      if (timeout && timeout.current) {
        clearInterval(timeout.current);
      }
      timeout.current = setInterval(async () => {
        fetch();
      }, intervalMs || 5000);
    };

    setup();
    fetch();
    return () => {
      if (timeout.current) {
        clearInterval(timeout.current);
      }
    };
  }, [fetch, intervalMs]);

  return <BestPricesContextProvider fetch={fetch}>{children}</BestPricesContextProvider>;
};
