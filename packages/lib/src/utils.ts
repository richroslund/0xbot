import { Timeframes } from './types';
import { ContractWrappers } from '@0x/contract-wrappers';
import { SignedOrder } from '@0x/mesh-rpc-client';

import { BigNumber } from '0x.js';
import { Web3Wrapper, TransactionReceiptWithDecodedLogs } from '@0x/web3-wrapper';
import { TX_DEFAULTS, TEN_MINUTES_MS, ONE_SECOND_MS, DECIMALS } from './config';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { round } from 'lodash';
dayjs.extend(relativeTime);

export const calculateProtocolFee = (orders: SignedOrder[], gasPrice: BigNumber | number = TX_DEFAULTS.gasPrice): BigNumber => {
  return new BigNumber(150000).times(gasPrice).times(orders.length);
};
export const toNumber = (val: BigNumber, decimals = 18) => {
  return Web3Wrapper.toUnitAmount(val, decimals).toNumber();
};

export const getExpiration = (val: BigNumber | string) => {
  const bnVal = BigNumber.isBigNumber(val) ? val : new BigNumber(val);
  return dayjs.unix(bnVal.toNumber());
};

export const getRandomFutureDateInSeconds = (): BigNumber => {
  return new BigNumber(Date.now() + TEN_MINUTES_MS).div(ONE_SECOND_MS).integerValue(BigNumber.ROUND_CEIL);
};
export function getCurrentUnixTimestampSec(): BigNumber {
  const milisecondsInSecond = 1000;
  return new BigNumber(Date.now() / milisecondsInSecond).integerValue(BigNumber.ROUND_FLOOR);
}

export function secondsFromNow(val: BigNumber) {
  return val.minus(getCurrentUnixTimestampSec()).toNumber();
}
export function asDate(val: BigNumber) {
  return dayjs(val.toNumber() * ONE_SECOND_MS);
}

export const getFutureDateInSeconds = (seconds: number): BigNumber => {
  const secondsMs = seconds * 1000;
  return new BigNumber(Date.now() + secondsMs).div(ONE_SECOND_MS).integerValue(BigNumber.ROUND_CEIL);
};

export const wrapEth = async (contracts: ContractWrappers, address: string, amount: number): Promise<TransactionReceiptWithDecodedLogs> => {
  return await contracts.weth9.deposit().awaitTransactionSuccessAsync({
    from: address,
    value: Web3Wrapper.toBaseUnitAmount(new BigNumber(amount), 18),
  });
};
export const toWei = (gwei: number) => 1000000000 * gwei;

export function isTimeframe(val?: any | Timeframes): val is Timeframes {
  return ['quarterHour', 'hour', 'sixHour', 'daily'].includes(val);
}

export const rnd = (value: number) => round(value, 4);
export const fromNow = (date: Date) => {
  const diffSeconds = dayjs(date).diff(dayjs(), 'second');
  if (diffSeconds < 60) {
    return `${diffSeconds} seconds`;
  }
  return dayjs(date).fromNow();
};

export const toNumberVal = (value: string | number | BigNumber) => (typeof value === 'number' ? value : BigNumber.isBigNumber(value) ? value.toNumber() : new BigNumber(value).toNumber());
export const toUnit = (value: string | number | BigNumber) => Web3Wrapper.toUnitAmount(BigNumber.isBigNumber(value) ? value : new BigNumber(value), DECIMALS).toNumber();
