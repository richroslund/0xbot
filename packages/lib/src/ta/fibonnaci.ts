import { CONSTANTS } from './../config';
import { SMA, ATR } from 'technicalindicators';
import _ from 'lodash';
import { Candle, FibonnaciBands, AtrValues, FibStats } from '../types';
import { fibonnaciLevels } from '../constants';

export const fibonnaciBands = (candles: Candle[]) => {
  const orderedcandles = _.orderBy(candles, c => c.time, 'asc');
  const fibResult = _.reduce(
    orderedcandles,
    (acc, c) => {
      const prev = _.reduce(
        acc,
        pre => {
          return {
            ...pre,
            high: [...pre.high, c.high],
            low: [...pre.low, c.low],
            close: [...pre.close, c.close],
          };
        },
        { high: [], low: [], close: [] } as AtrValues
      );
      const sma = new SMA({ period: CONSTANTS.ta.smaPeriod, values: prev.close });
      const atr = new ATR({ ...prev, period: CONSTANTS.ta.atrPeriod });
      const last = {
        sma: sma.nextValue(c.close) || 0,
        atr: atr.nextValue(c) || 0,
      };
      const fib = {
        upperThird: last.sma + fibonnaciLevels.third * last.atr,
        upperSecond: last.sma + fibonnaciLevels.second * last.atr,
        upperFirst: last.sma + fibonnaciLevels.first * last.atr,
        lowerFirst: last.sma - fibonnaciLevels.first * last.atr,
        lowerSecond: last.sma - fibonnaciLevels.second * last.atr,
        lowerThird: last.sma - fibonnaciLevels.third * last.atr,
      };
      return [
        ...acc,
        {
          ...c,
          ...last,
          fib,
        },
      ];
    },
    [] as FibStats[]
  );
  return fibResult;
};

export const multipleTimeframeFibonnaciBands = (fibs: { quarterHour: FibStats[]; hourly: FibStats[]; sixHour: FibStats[]; daily: FibStats[] }): { [keyValue: string]: number } => {
  const fibResult = {
    '15M': _.last(fibs.quarterHour),
    '1H': _.last(fibs.hourly),
    '6H': _.last(fibs.sixHour),
    '1D': _.last(fibs.daily),
  };
  const fibLevels = _(fibResult)
    .map((v, timeframe) => {
      if (v === undefined) {
        return [];
      }
      const timeFib = _.map(v.fib, (tfv, key) => {
        return {
          key: `${timeframe}-${key}`,
          value: tfv,
        };
      });
      return timeFib;
    })
    .flatten()
    .orderBy(fl => fl.value, 'desc')
    .reduce((acc, v) => {
      return {
        ...acc,
        [v.key]: v.value,
      };
    }, {});
  return fibLevels;
};

export const AverageFibBands = (fibs: { quarterHour: FibStats[]; hourly: FibStats[]; sixHour: FibStats[]; daily: FibStats[] }, weight: { quarterHour: number; hourly: number; sixHour: number; daily: number }): FibonnaciBands => {
  const fibResult = {
    quarterHour: _.last(fibs.quarterHour),
    hourly: _.last(fibs.hourly),
    sixHour: _.last(fibs.sixHour),
    daily: _.last(fibs.daily),
  };
  const allFibs = [
    { value: fibResult.quarterHour, weight: weight.quarterHour },
    { value: fibResult.hourly, weight: weight.hourly },
    { value: fibResult.sixHour, weight: weight.sixHour },
    { value: fibResult.daily, weight: weight.daily },
  ];
  const totalWeight = _.sum([weight.daily, weight.hourly, weight.sixHour, weight.quarterHour]);
  return {
    upperThird: _.sum(allFibs.map(f => (f.value ? f.value.fib.upperThird * f.weight : 0))) / totalWeight,
    upperSecond: _.sum(allFibs.map(f => (f.value ? f.value.fib.upperSecond * f.weight : 0))) / totalWeight,
    upperFirst: _.sum(allFibs.map(f => (f.value ? f.value.fib.upperFirst * f.weight : 0))) / totalWeight,
    lowerFirst: _.sum(allFibs.map(f => (f.value ? f.value.fib.lowerFirst * f.weight : 0))) / totalWeight,
    lowerSecond: _.sum(allFibs.map(f => (f.value ? f.value.fib.lowerSecond * f.weight : 0))) / totalWeight,
    lowerThird: _.sum(allFibs.map(f => (f.value ? f.value.fib.lowerThird * f.weight : 0))) / totalWeight,
  };
};
