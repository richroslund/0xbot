import { Timeframes } from './../types';
import * as CoinbasePro from 'coinbase-pro';
import * as _ from 'lodash';
import { Candle, HistoricalCandles } from '../types';
import axios from 'axios';

export { ProductTicker } from 'coinbase-pro';

const getTicker = async (symbol: string) => {
  try {
    //const ticker = await new CoinbasePro.PublicClient().getProductTicker(symbol);
    const ticker = await axios.get<CoinbasePro.ProductTicker>(`https://api.pro.coinbase.com/products/ETH-USD/ticker`).then(res => res.data);
    return {
      ticker,
      symbol,
    };
  } catch (err) {
    console.error('get ticker error', err.data);
    console.error('ticker err', err);
    return { ticker: undefined, symbol };
  }
};

const getHistoricRates = async (symbol: string, granularity: number) => {
  const rates: Candle[] = await new CoinbasePro.PublicClient().getProductHistoricRates(symbol, { granularity }).then(res => {
    const resVals = res as [number, number, number, number, number, number][];
    const mapRes = _.map(
      resVals,
      (b): Candle => {
        const [time, low, high, open, close, volume] = b;
        return { time, low, high, open, close, volume } as Candle;
      }
    );
    return mapRes;
  });
  return rates;
};
export const historicalCandles = async (symbol: string, timeframe: Timeframes) => {
  const hourSeconds = 3600;
  switch (timeframe) {
    case 'quarterHour': {
      return await getHistoricRates(symbol, hourSeconds / 4);
    }
    case 'hour': {
      return await getHistoricRates(symbol, hourSeconds);
    }
    case 'sixHour': {
      return await getHistoricRates(symbol, hourSeconds * 6);
    }
    case 'daily': {
      return await getHistoricRates(symbol, hourSeconds * 24);
    }

    default: {
      return [];
    }
  }
};
const historical = async (symbol: string): Promise<HistoricalCandles & { symbol: string }> => {
  const quarterHour = await historicalCandles(symbol, 'quarterHour');
  const hour = await historicalCandles(symbol, 'hour');
  const sixHour = await historicalCandles(symbol, 'sixHour');
  const daily = await historicalCandles(symbol, 'daily');
  return {
    quarterHour,
    hour,
    sixHour,
    daily,
    symbol,
  };
};
export const coinbase = {
  historical,
  getHistoricRates,
  getTicker,
  historicalCandles,
};
