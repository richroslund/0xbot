import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ContractWrappers } from '@0x/contract-wrappers';
import { Color, Box } from 'ink';
import { PriceWatcher, BestPricesResult } from '../actions/bestMeshPrices';
import { getProviderFromKeystore, KEYSTORE, PASSWORD, CHAINID, DECIMALS } from '@0x/lib';
import _ from 'lodash';
import { ChangeDirections } from '../types';
import { BigNumber } from '0x.js';
import { Web3Wrapper } from '@0x/web3-wrapper';

const Price: React.FC<{ change: ChangeDirections; price?: number; makerAddress?: string; leftRight?: 'left' | 'right'; amount?: number | BigNumber }> = ({ price, change, makerAddress, leftRight, amount }) => {
  const colors = useMemo(() => {
    if (change === 1) {
      return { green: true };
    } else if (change === -1) {
      return { red: true };
    } else {
      return { gray: true, dim: true };
    }
  }, [change]);
  const amt = useMemo(() => {
    const amtVal = BigNumber.isBigNumber(amount) ? Web3Wrapper.toUnitAmount(amount, DECIMALS).toNumber() : amount;
    return amtVal ? `${_.round(amtVal, 2)}` : undefined;
  }, [amount]);
  const mkr = useMemo(() => {
    return makerAddress ? `(..${_.takeRight(makerAddress, 4).join('')})` : undefined;
  }, [makerAddress]);
  return (
    <>
      {leftRight === 'left' && (
        <>
          {mkr} {amt} x [
        </>
      )}
      <Color {...colors}>${price}</Color>
      {leftRight === 'right' && (
        <>
          ] x {amt} {mkr}
        </>
      )}
    </>
  );
};

export const BestPrices: React.FC<{ address?: string; symbol: string; timeout?: number }> = ({ symbol, timeout }) => {
  const watcherRef = useRef<PriceWatcher>();
  const timer = useRef<NodeJS.Timer>();
  const [prices, setPrices] = useState<BestPricesResult>();
  const timeoutVal = useMemo(() => timeout || 2500, [timeout]);
  useEffect(() => {
    const setup = async () => {
      const { providerEngine } = await getProviderFromKeystore(KEYSTORE, PASSWORD);

      const contracts = new ContractWrappers(providerEngine, { chainId: CHAINID });
      watcherRef.current = new PriceWatcher(contracts);
      timer.current = setInterval(async () => {
        if (watcherRef.current) {
          const { bid, ask, lastPrice } = await watcherRef.current.getBestPrices(symbol);
          const existingChanges = [prices?.ask.change, prices?.bid.change, prices?.lastPrice.change];
          if ([bid.change, ask.change, lastPrice.change].every(v => v === 0) && existingChanges.every(v => v === 0)) {
            return;
          }
          const priceVals = {
            bid: {
              ...bid,
              price: bid.price ? _.round(bid.price, 2) : undefined,
            },
            ask: {
              ...ask,
              price: ask.price ? _.round(ask.price, 2) : undefined,
            },
            lastPrice: {
              ...lastPrice,
              price: lastPrice.price ? _.round(lastPrice.price, 2) : undefined,
            },
          };
          setPrices(priceVals);
        }
      }, timeoutVal);
    };
    setup();
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
    // eslint-disable-next-line react-app/react-hooks/exhaustive-deps
  }, [symbol, timeoutVal]);

  return (
    <>
      <Box>
        {prices && (
          <>
            <Price change={prices.bid.change} price={prices.bid.price} leftRight="left" amount={prices.bid.order?.takerAssetAmount} />
            {`-`}
            <Price change={prices.ask.change} price={prices.ask.price} leftRight="right" amount={prices.ask.order?.makerAssetAmount} />
            {` Coinbase: `}
            <Price change={prices.lastPrice.change} price={prices.lastPrice.price} />
          </>
        )}
      </Box>
      <Box></Box>
    </>
  );
};
