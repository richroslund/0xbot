import React, { useEffect, useRef, useState } from 'react';
import { ContractWrappers } from '@0x/contract-wrappers';
import { AccountBalances } from './Balances';
import { BestPrices } from './BestPrices';
import { coinbase, ZrxApi, getProviderFromKeystore, KEYSTORE, PASSWORD, CHAINID, ADDRESSES, getCurrentUnixTimestampSec, SignedOrderWithMetadata } from '@0x/lib';
import _ from 'lodash';
import { PriceContext } from './PriceContext';
import { Web3ProviderEngine } from '0x.js';
import { AccountContext } from './AccountContext';

const symbol = 'ETH-USD';

const filterExpired = (orders: SignedOrderWithMetadata[], includeExpired?: boolean) => (includeExpired === true ? orders : _.filter(orders, o => o.order.expirationTimeSeconds.isGreaterThan(getCurrentUnixTimestampSec())));

export const App: React.FC<{ timeout?: number }> = ({ timeout }) => {
  const providerRef = useRef<Web3ProviderEngine>();
  const contractsRef = useRef<ContractWrappers>();

  const timer = useRef<NodeJS.Timer>();
  const [lastPrice, setLastPrice] = useState<number>();
  const [openOrders, setOpenOrders] = useState<number>(0);
  const [address, setAddress] = useState<string>('UNKNOWN');
  useEffect(() => {
    const setup = async () => {
      const { providerEngine, address } = await getProviderFromKeystore(KEYSTORE, PASSWORD);
      setAddress(address);
      providerRef.current = providerEngine;
      const contracts = new ContractWrappers(providerEngine, { chainId: CHAINID });
      contractsRef.current = contracts;
      timer.current = setInterval(async () => {
        const { ticker } = await coinbase.getTicker(symbol);
        const price = ticker ? parseFloat(ticker.price) : undefined;
        if (price && !_.isNaN(price)) {
          setLastPrice(price);
        }
        const accountOrders = await new ZrxApi().getOpenOrders(address, ADDRESSES.dai, contracts.contractAddresses.etherToken);
        const { bids, asks, others } = {
          bids: filterExpired(accountOrders.bids, false),
          asks: filterExpired(accountOrders.asks, false),
          others: filterExpired(accountOrders.others, false),
        };
        const amt = _.flatMap([bids, asks, others]).filter(v => v !== undefined).length;
        setOpenOrders(amt);
      }, timeout || 5000);
    };
    setup();
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [timeout]);
  return (
    <>
      <AccountContext.Provider value={{ openOrders }}>
        <PriceContext.Provider value={{ lastPrice }}>
          <AccountBalances />
          <BestPrices symbol={symbol} address={address} />
        </PriceContext.Provider>
      </AccountContext.Provider>
    </>
  );
};
