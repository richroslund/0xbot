import { toNumberVal, toUnit } from './../../utils';
import { Candle } from '../../types';
import { StrategyDataProvider } from '..';
import _ from 'lodash';

export class BaseTradingStrategy<T extends StrategyDataProvider = StrategyDataProvider> {
  public name: string;
  protected provider: T;
  constructor(strategyName: string, provider: T) {
    this.name = strategyName;
    this.provider = provider;
  }
  public CandleValues = async (getCandles: () => Promise<Candle[]>, field: keyof Candle) =>
    await getCandles().then(res => {
      return _(res)
        .orderBy(c => c.time, 'asc')
        .map(c => c[field])
        .value();
    });
  protected toUnit = toUnit;
  protected toNumber = toNumberVal;
  protected getGasPrice = async (speed: 'safe' | 'fast' = 'safe') => {
    const gasPrices = await this.provider.getGasPrices();
    return gasPrices ? parseFloat(speed === 'safe' ? gasPrices.SafeGasPrice : gasPrices.ProposeGasPrice) : undefined;
  };
}
