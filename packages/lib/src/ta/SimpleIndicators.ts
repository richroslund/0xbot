import { CONSTANTS } from './../config';
import { SMA, ATR, CandleData, StochasticRSI } from 'technicalindicators';
import { Candle, AtrValues } from '../types';

import _ from 'lodash';
import { fibonnaciLevels } from '../constants';
export class SimpleIndicators {
  private candles: Candle[];
  constructor(values: Candle[]) {
    this.candles = values;
  }
  private candleValues = (field: keyof Candle) =>
    _(this.candles)
      .orderBy(c => c.time, 'asc')
      .map(c => c[field])
      .value();
  public sma = (field: keyof Candle) => {
    return new SMA({ period: CONSTANTS.ta.smaPeriod, values: this.candleValues(field) });
  };
  public atr = () => {
    const orderedcandles = _.orderBy(this.candles, c => c.time, 'asc');
    const candleValues = _.reduce(
      orderedcandles,
      (acc, c) => {
        return {
          ...acc,
          high: [...acc.high, c.high],
          low: [...acc.low, c.low],
          close: [...acc.close, c.close],
        };
      },
      { high: [], low: [], close: [] } as AtrValues
    );
    return new ATR({ ...candleValues, period: CONSTANTS.ta.atrPeriod });
  };

  public rsi = (field: keyof Candle = 'close', rsiPeriod = 14, stochasticPeriod = 14) => new StochasticRSI({ values: this.candleValues(field), rsiPeriod, stochasticPeriod, kPeriod: CONSTANTS.ta.stochRSI_k, dPeriod: CONSTANTS.ta.stochRSI_d });

  public fibonnaciBands = (latest: CandleData, price: number) => {
    const atr = this.atr().nextValue(latest);
    const sma = this.sma('close').nextValue(price);
    if (sma === undefined || atr === undefined) {
      return [];
    }
    return [sma - fibonnaciLevels.third * atr, sma - fibonnaciLevels.second * atr, sma - fibonnaciLevels.first * atr, sma + fibonnaciLevels.first * atr, sma + fibonnaciLevels.second * atr, sma + fibonnaciLevels.third * atr];
  };
}
