import { Candle } from './../types';
import * as fibonnaci from './fibonnaci';
import { SimpleIndicators } from './SimpleIndicators';

import * as _ from 'lodash';
export * from './SimpleIndicators';

export const getIndicators = (candles: Candle[], lastPrice: number) => {
  const orderedDaily = _.orderBy(candles, c => c.time, 'desc');
  const latest = _.first(orderedDaily);
  if (latest === undefined) {
    return;
  }
  const indicators = new SimpleIndicators(candles);
  const sma = lastPrice && !_.isNaN(lastPrice) ? indicators.sma('close').nextValue(lastPrice) : undefined;
  const atr = latest ? indicators.atr().nextValue(latest) : undefined;
  const fibBands = lastPrice && !_.isNaN(lastPrice) && latest ? indicators.fibonnaciBands(latest, lastPrice) : [];
  return { sma, atr, fibBands, indicators };
};
export type IndicatorResult = ReturnType<typeof getIndicators>;

export const ta = {
  fibonnaci,
};
