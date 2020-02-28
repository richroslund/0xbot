import { BigNumber } from '0x.js';
import _ from 'lodash';

import chalk from 'chalk';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { DECIMALS, getExpiration, getCurrentUnixTimestampSec, IndicatorResult, coinbase, getIndicators } from '@0x/lib';
import { Web3Wrapper } from '@0x/web3-wrapper';
dayjs.extend(relativeTime);
export const log = console.log;
const rnd = _.round;
type ChangeDirections = -1 | 0 | 1;
interface LogFibOptions {
  selected?: (number | undefined)[];
  header?: boolean;
}
export const logFib = (name: string, lastPrice: number, indicators?: IndicatorResult, options?: LogFibOptions) => {
  if (indicators === undefined) {
    return;
  }
  const selectedValues = options && options.selected ? options.selected : [];
  const includeHeader = options?.header === true;

  const getStyle = (lastPrice: number, v: number) => {
    const base = selectedValues.length === 0 ? chalk : chalk.dim;
    if (_.some(selectedValues, sel => sel === v)) {
      return chalk.rgb(255, 105, 0);
    } else if (lastPrice < v) {
      return base.green;
    } else {
      return base.red;
    }
  };
  log(' ');
  if (includeHeader) {
    const rsi = _(indicators.indicators.rsi().result)
      .map(r => rnd(r.stochRSI, 4))
      .last();
    log(`${chalk.blue(name)}`, '-', `$${lastPrice}`, '-', `RSI: ${rsi}`);
  }

  const orderedFibs = _.orderBy(indicators.fibBands, 'desc');
  const low = _.take(orderedFibs, 3);
  const high = _.drop(orderedFibs, 3);
  _.times(3, ind => {
    const l = low[2 - ind];
    const h = high[ind];

    log(getStyle(lastPrice, l)(rnd(l, 4)), '-', getStyle(lastPrice, h)(rnd(h, 4)), `\t\t-Band ${ind}`);
  });
};
export const logPrice = (val: number | string | undefined, changed: ChangeDirections) => {
  const numVal = _.isString(val) ? parseFloat(val) : val;
  if (numVal === undefined || _.isNaN(numVal)) {
    return chalk.gray('UNKNOWN');
  }
  let style = chalk.blue;
  if (changed === 0) {
    style = chalk.gray;
  } else if (changed === -1) {
    style = chalk.yellow;
  } else if (changed === 1) {
    style = chalk.green;
  }

  return style(rnd(numVal, 4));
};

export const logOrder = (title: string, price: BigNumber, amt: BigNumber, hash?: string, expirationTime?: BigNumber) => {
  const askPrice = _.round(price.toNumber(), 4);
  const remainingAmount = _.round(Web3Wrapper.toUnitAmount(amt, DECIMALS).toNumber(), 4);
  const hashStr = hash ? chalk.blue(hash) : '';
  const isExpired = expirationTime && expirationTime.isLessThan(getCurrentUnixTimestampSec()) ? true : undefined;
  const exp = expirationTime ? (isExpired ? 'expired' : `expires in ${chalk.rgb(255, 100, 0)(dayjs(getExpiration(expirationTime)).fromNow())}`) : '';
  console.log(`${title} $${chalk.yellow(askPrice, 'x', remainingAmount)} - ${exp} - ${hashStr}`);
};

export const getAndLogFibs = async (symbol: string) => {
  const { ticker } = await coinbase.getTicker(symbol);
  if (ticker === undefined) {
    const tErr = 'ticker is null';
    throw tErr;
  }
  const lastPrice = parseFloat(ticker.price) || -1;
  const history = await coinbase.historical(symbol);
  // const fibs = {
  //   quarterHour: ta.fibonnaci.fibonnaciBands(history.quarterHour),
  //   hourly: ta.fibonnaci.fibonnaciBands(history.hour),
  //   sixHour: ta.fibonnaci.fibonnaciBands(history.sixHour),
  //   daily: ta.fibonnaci.fibonnaciBands(history.daily),
  // };
  const quarterHour = getIndicators(history.quarterHour, lastPrice);
  const hourly = getIndicators(history.hour, lastPrice);
  const sixHour = getIndicators(history.sixHour, lastPrice);
  const daily = getIndicators(history.daily, lastPrice);

  logFib('15 minute', lastPrice, quarterHour, { header: true });
  logFib('hour', lastPrice, hourly, { header: true });
  logFib('6 hour', lastPrice, sixHour, { header: true });
  logFib('daily', lastPrice, daily, { header: true });

  log(' ');
  log('Price', chalk.magenta(lastPrice));
  log(' \n');
};
