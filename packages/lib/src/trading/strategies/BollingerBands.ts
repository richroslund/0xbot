import { TradingStrategy, NewPositionForBaseRequest, BollingerBandConfig, NewPositionForQuoteRequest, TransactionWithPrice, MarketMakingStrategy, OrderWithPrice, CandleStrategyDataProvider, StrategyConfiguration } from '../types';
import { BollingerBands } from 'technicalindicators';
import _ from 'lodash';
import { TxData } from '@0x/web3-wrapper';
import { BigNumber } from '0x.js';
import { BaseTradingStrategy } from './BaseTradingStrategy';

function isBollingerbandConfig<T>(config: T | BollingerBandConfig): config is BollingerBandConfig {
  return config && _.get(config, 'kind', undefined) === 'bollingerband';
}
const invalidConfig = { reason: 'invalid strategy config' };
export class BollingerBandStrategy extends BaseTradingStrategy<CandleStrategyDataProvider> implements TradingStrategy, MarketMakingStrategy {
  constructor(provider: CandleStrategyDataProvider) {
    super('BollingerBands', provider);
  }
  private getBollingerBands = async (config: BollingerBandConfig) => {
    const { stdDev, period, field } = config;
    const values = await this.CandleValues(this.provider.getCandles, field);
    return new BollingerBands({ stdDev, period, values });
  };

  private isPriceAtBuyLevel = async (config: BollingerBandConfig, price: number) => {
    const bb = await this.getBollingerBands(config);
    const current = bb.nextValue(price);
    const isBuy = current && current.lower >= price ? true : false;
    return isBuy;
  };
  private isPriceAtSellLevel = async (config: BollingerBandConfig, price: number) => {
    const bb = await this.getBollingerBands(config);
    const current = bb.nextValue(price);
    const isSell = current && current.upper <= price ? true : false;
    return isSell;
  };
  public isSellLevel = async (config: StrategyConfiguration, { baseAmount }: NewPositionForBaseRequest) => {
    if (isBollingerbandConfig(config)) {
      const res = await this.provider.sellBaseAsset(baseAmount);
      return res ? this.isPriceAtSellLevel(config, res.price) : false;
    } else {
      throw invalidConfig;
    }
  };
  public isBuyLevel = async (config: StrategyConfiguration, { quoteAmount }: NewPositionForQuoteRequest) => {
    if (isBollingerbandConfig(config)) {
      const res = await this.provider.sellQuoteAsset(quoteAmount);
      return res ? this.isPriceAtBuyLevel(config, 1 / res.price) : false;
    } else {
      throw invalidConfig;
    }
  };
  public tryMarketBuy = async ({ quoteAmount }: NewPositionForQuoteRequest): Promise<TransactionWithPrice | undefined> => {
    const bestBuy = await this.provider.sellQuoteAsset(quoteAmount);

    if (bestBuy === undefined) {
      return undefined;
    }
    const basePrice = 1 / bestBuy.price;
    const baseAmount = this.toUnit(new BigNumber(bestBuy.buyAmount));
    console.log('tryBuy', baseAmount, `for $${basePrice}`);
    return { transaction: bestBuy as TxData, price: basePrice, baseAmount };
  };
  public tryMarketSell = async ({ baseAmount }: NewPositionForBaseRequest): Promise<TransactionWithPrice | undefined> => {
    const bestSell = await this.provider.sellBaseAsset(baseAmount);
    if (bestSell === undefined) {
      return undefined;
    }
    console.log('trySell', baseAmount, `for $${bestSell?.price}`);
    return { transaction: bestSell as TxData, price: bestSell?.price, baseAmount };
  };
  public generateBuyOrders = async (openStrategyConfig: StrategyConfiguration, quoteAmount: number): Promise<OrderWithPrice[]> => {
    if (isBollingerbandConfig(openStrategyConfig)) {
      const bb = await this.getBollingerBands(openStrategyConfig);

      const currentPrice = await this.provider.getCurrentPrice();
      if (currentPrice) {
        const bbResults = bb.nextValue(currentPrice);
        if (bbResults) {
          const offset = 1 + openStrategyConfig.priceOffset;
          const rawPrice = _.min([currentPrice, bbResults.lower]) || bbResults.lower;
          const targetPrice = rawPrice * offset;
          return [{ price: targetPrice, baseAmount: quoteAmount / targetPrice, action: 'buy' }];
        }
      }
      return [];
    }

    throw invalidConfig;
  };
  public generateSellOrders = async (config: StrategyConfiguration, baseAmount: number): Promise<OrderWithPrice[]> => {
    if (isBollingerbandConfig(config)) {
      const bb = await this.getBollingerBands(config);

      const currentPrice = await this.provider.getCurrentPrice();
      if (currentPrice) {
        const bbResults = bb.nextValue(currentPrice);
        if (bbResults) {
          const offset = 1 - config.priceOffset;
          const rawPrice = _.max([currentPrice, bbResults.upper]) || bbResults.upper;
          const targetPrice = rawPrice * offset;
          return [{ price: targetPrice, baseAmount, action: 'sell' }];
        }
      }

      return [];
    } else {
      throw invalidConfig;
    }
  };
}
