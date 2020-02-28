import React, { useEffect, useRef, useState, useMemo, useContext } from 'react';
import { ContractWrappers } from '@0x/contract-wrappers';
import { Box, Color } from 'ink';
import { getProviderFromKeystore, KEYSTORE, PASSWORD, CHAINID, Account, Balances } from '@0x/lib';
import _ from 'lodash';
import { Web3ProviderEngine } from '0x.js';
import { getBalanceValue } from '../actions/balances';
import { PriceContext } from './PriceContext';
import { AccountContext } from './AccountContext';

const TokenBalance: React.FC<{ name: string; amount?: number }> = ({ amount, name }) => {
  const value = useMemo(() => (amount !== undefined ? _.round(amount, 4) : undefined), [amount]);
  return (
    <>
      {value !== undefined && (
        <>
          {`${name}:`}
          <Color magenta={true}>{value}</Color>
        </>
      )}
    </>
  );
};
const OpenOrders: React.FC<{}> = () => {
  const { openOrders } = useContext(AccountContext);
  return (
    <>
      <Color cyan={openOrders > 0} gray={openOrders === 0}>
        {openOrders}
      </Color>
    </>
  );
};

const AccountBalanceDisplay: React.FC<{ eth?: number; weth?: number; dai?: number; zrx?: number; total?: number }> = ({ eth, weth, dai, zrx, total }) => {
  return (
    <>
      <Box>
        <TokenBalance name="eth" amount={eth} />
        {` `}
        <TokenBalance name="weth" amount={weth} />
        {` `}
        <TokenBalance name="dai" amount={dai} />
        {` `}
        <TokenBalance name="zrx" amount={zrx} />
        {` -- Total: `}$<Color blue>{total || '?'}</Color>
      </Box>
      <Box>
        {`Open Orders: `}
        <OpenOrders />
      </Box>
    </>
  );
};

const Balance = React.memo(AccountBalanceDisplay);

export const AccountBalances: React.FC<{ timeout?: number }> = ({ timeout }) => {
  const providerRef = useRef<Web3ProviderEngine>();
  const contracts = useRef<ContractWrappers>();
  const timer = useRef<NodeJS.Timer>();
  const { lastPrice } = useContext(PriceContext);
  const [balances, setBalances] = useState<Balances>();
  const timeoutVal = useMemo(() => timeout || 5000, [timeout]);
  const weth = useMemo(() => balances?.balances.weth, [balances]);
  useEffect(() => {
    const setup = async () => {
      const { providerEngine, address } = await getProviderFromKeystore(KEYSTORE, PASSWORD);
      providerRef.current = providerEngine;

      contracts.current = new ContractWrappers(providerEngine, { chainId: CHAINID });

      timer.current = setInterval(async () => {
        if (!providerRef.current || !contracts.current) {
          return;
        }
        const balances = await new Account().getBalancesAsync(providerRef.current, contracts.current, address);
        setBalances(balances);
      }, timeoutVal);
    };
    setup();
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [timeoutVal]);
  const totalValue = useMemo(() => {
    if (balances && lastPrice) {
      return _.round(getBalanceValue(balances, lastPrice), 4);
    }
    return undefined;
  }, [balances, lastPrice]);
  return <Balance eth={balances?.ethBalance} weth={weth} dai={balances?.balances.dai} zrx={balances?.balances.zrx} total={totalValue} />;
};
