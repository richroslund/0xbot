import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Label, Icon, SemanticICONS, Segment, Item, Statistic, Button, SemanticCOLORS } from 'semantic-ui-react';
import { useSelector, useDispatch } from 'react-redux';
import { AppState } from '../state/state';
import { useWeb3 } from '../hooks/useWeb3';
import { fetchBalances, fetchCoinbaseTicker } from '../state/thunks';
import _ from 'lodash';
import { ADDRESSES, TokenWrapper } from '@0x/lib';

export const useTokenBalance = (token: 'zrx' | 'weth' | 'dai' | 'eth') => {
  const value = useSelector((s: AppState) => {
    let tokenVal: number | undefined = undefined;
    if (token === 'eth') {
      tokenVal = s.balances.ethBalance ? s.balances.ethBalance : undefined;
    } else {
      tokenVal = s.balances.balances ? s.balances.balances[token] : undefined;
    }

    if (tokenVal !== undefined) {
      return _.round(tokenVal, 4).toString();
    } else {
      return '?';
    }
  });
  return value;
};

export const CoinInfo: React.FC<{ token: 'zrx' | 'weth' | 'dai' | 'eth'; icon?: SemanticICONS; wrapper?: TokenWrapper }> = ({ token, icon, wrapper }) => {
  const value = useTokenBalance(token);
  const address = useSelector((s: AppState) => s.address);

  const [isApproved, setIsApproved] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    const checkApproval = async (tokenW: TokenWrapper, addr: string) => {
      const isApproved = await tokenW.isApproved(addr);
      if (isApproved) {
        setIsApproved(true);
      } else {
        setIsApproved(false);
      }
    };
    if (wrapper) {
      if (address) {
        checkApproval(wrapper, address);
      }
    }
  }, [address, wrapper]);
  const color = useMemo(() => {
    if (wrapper) {
      if (isApproved === undefined) {
        return 'orange';
      } else if (isApproved) {
        return 'green';
      } else {
        return 'red';
      }
    } else {
      return 'grey';
    }
  }, [isApproved, wrapper]);
  const onClick = useCallback(() => {
    if (isApproved) {
      return console.log('token already approved');
    } else if (address) {
      wrapper?.approve(address);
    }
  }, [address, isApproved, wrapper]);
  return (
    <Button color={color} onClick={onClick}>
      {icon && <Icon name={icon} />}
      {token} {value}
    </Button>
  );
};

export const Ticker: React.FC<{ symbol: string }> = ({ symbol }) => {
  const price = useSelector((s: AppState) => {
    const value = s.ticker[symbol] ? s.ticker[symbol].lastPrice : undefined;
    if (value) {
      return _.round(value, 2).toString();
    } else {
      return '?';
    }
  });
  return <Statistic value={price} label={symbol} />;
};

export const Balances: React.FC<{ intervalMs: number }> = ({ intervalMs }) => {
  const timer = useRef<NodeJS.Timer>();
  const dispatch = useDispatch();
  const { web3, contracts, tokenFactory } = useWeb3();
  useEffect(() => {
    const setup = async () => {
      if (!contracts || !web3) {
        console.warn('contracts is null');
        return;
      }
      console.log('fetching balances');
      dispatch(fetchBalances(web3, contracts));
      timer.current = setInterval(() => {
        dispatch(fetchBalances(web3, contracts));
      }, intervalMs);
    };
    setup();

    return () => {
      if (timer && timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [contracts, dispatch, intervalMs, web3]);
  return (
    <Item>
      <Item.Header>Balances</Item.Header>
      <Item.Content>
        <Segment.Group horizontal compact>
          <CoinInfo token="eth" />
          <CoinInfo token="weth" wrapper={tokenFactory(contracts.contractAddresses.etherToken)} />
          <CoinInfo token="dai" wrapper={tokenFactory(ADDRESSES.dai)} />
          <CoinInfo token="zrx" wrapper={tokenFactory(contracts.contractAddresses.zrxToken)} />
        </Segment.Group>
      </Item.Content>
    </Item>
  );
};

export const Quotes: React.FC<{ intervalMs: number }> = ({ intervalMs }) => {
  const timer = useRef<NodeJS.Timer>();
  const dispatch = useDispatch();
  useEffect(() => {
    const setup = async () => {
      dispatch(fetchCoinbaseTicker('ETH-USD'));
      timer.current = setInterval(() => {
        dispatch(fetchCoinbaseTicker('ETH-USD'));
      }, intervalMs);
    };
    setup();

    return () => {
      if (timer && timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [dispatch, intervalMs]);
  return (
    <Item>
      <Item.Header>Coinbase</Item.Header>
      <Item.Content>
        <Ticker symbol="ETH-USD" />
      </Item.Content>
    </Item>
  );
};
