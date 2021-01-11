import { Balances } from './../types';
import { ContractWrappers } from '@0x/contract-wrappers';
import { QuoteRequest, TransformedQuoteResponse } from './../api/zrxApi';
import { Web3Wrapper, TransactionReceipt, TxData } from '@0x/web3-wrapper';
import { EtherscanGasPrices, Candle } from '../types';
import { BigNumber, SignedOrder } from '0x.js';
import { OrderStatus, Order } from '@0x/types';

export type IndicatorStrength = 'very weak' | 'weak' | 'moderate' | 'strong' | 'very strong';
export type OrderAction = 'buy' | 'sell';
export type TransactionHash = string;

export type PositionStatus = 'opening' | 'pending' | 'open' | 'closing' | 'closed' | 'failed';
export const PositionStatusOpening: PositionStatus = 'opening';
export const PositionStatusClosing: PositionStatus = 'closing';
export const PositionStatusPending: PositionStatus = 'pending';
export interface OrderTransactionData {
  orderValueUSD: number;
  price: number;
  hash: TransactionHash;
  gasPrice: number | string | BigNumber;
  gas: number | string | BigNumber;
  value: number | string | BigNumber;
  receipt?: TransactionReceipt;
}
export interface Position<T> {
  id?: string;
  type: 'live' | 'test' | 'limit';
  amount: number;
  dateTime: Date;
  status: PositionStatus;

  open?: T;
  close?: T;
  context: {
    action: OrderAction;
    strength?: IndicatorStrength;
  };
}
export interface MetaData {
  meta: {
    instanceKey: string;
  };
}
export type WithMeta<T> = T & {
  meta: {
    instanceKey: string;
  };
};
interface ZrxOrder {
  price: number;
  order: SignedOrder;
}
export interface ZrxOrderWithPrice extends ZrxOrder {
  orderHash?: string;
  orderStatus?: number;
  orderTakerAssetFilledAmount?: BigNumber;
}
export type PositionWithMeta<T> = WithMeta<Position<T>>;
export type MarketMakerPosition = PositionWithMeta<ZrxOrderWithPrice> & {
  balanceOnOpen?: Balances;
  pendingOrder?: ZrxOrderWithPrice;
  expiredOrders: SignedOrder[];
};
export type PendingMarketMakerPosition = Omit<MarketMakerPosition, 'pendingOrder'> & { pendingOrder: ZrxOrderWithPrice };
export type TradingPosition = Position<OrderTransactionData>;
export interface TradingPositionWithMeta extends TradingPosition {
  meta: {
    instanceKey: string;
  };
}

export interface NewPositionForQuoteRequest {
  quoteAmount: number;
}
export interface NewPositionForBaseRequest {
  baseAmount: number;
}

export interface TradingConfig<OS extends StrategyConfiguration = StrategyConfiguration> {
  openStrategyConfig: OS;
  baseToken: string;
  quoteToken: string;
  intervalSeconds: number;
  positionSize: number;
  minQuoteBalance: number;
  minBaseBalance: number;
}
export interface BaseQuoteBalance {
  base: number;
  quote: number;
}
export interface MarketMakerStrategyConfig<OS extends StrategyConfiguration = StrategyConfiguration> extends MetaData {
  openStrategyConfig: OS;
  id?: string;
  address: string;
  intervalSeconds: number;
  baseToken: string;
  quoteToken: string;
  expirationSeconds: number;
  positionPercent: number;
  minBaseOrderAmount: number;
  maxBaseOrderAmount: number;

  minQuoteOrderAmount: number;
  maxQuoteOrderAmount: number;
  minQuoteBalance: number;
  minBaseBalance: number;
  maxOpenPositions: number;
}

export interface MarketMakerStrategy<OS extends StrategyConfiguration = StrategyConfiguration> extends MarketMakerStrategyConfig<OS> {
  positions: MarketMakerPosition[];
  closed?: MarketMakerPosition[];
}

export interface TradingDataProvider {
  getGasPrices: () => Promise<Pick<EtherscanGasPrices, 'ProposeGasPrice' | 'SafeGasPrice'> | undefined>;
  getBalances: () => Promise<Balances>;
  // getPerformance: (
  //   address: string
  // ) => Promise<{
  //   initial: { USD: number; eth: number };
  //   current: { USD: number; eth: number };
  //   difference: { USD: number; eth: number };
  // }>;
  signOrder: (order: Order) => Promise<SignedOrder>;
  placeOrder: (order: SignedOrder) => Promise<boolean>;
  getMarketMakerStrategy: (key: string, filter: (pos: MarketMakerStrategy) => boolean) => Promise<MarketMakerStrategy | undefined>;
  saveMarketMakerStrategy: (key: string, strategy: MarketMakerStrategy) => Promise<MarketMakerStrategy>;
  getPosition: (key: string, filter: (pos: TradingPositionWithMeta) => boolean) => Promise<TradingPositionWithMeta | undefined>;
  savePosition: (key: string, position: TradingPositionWithMeta) => Promise<TradingPositionWithMeta>;
}

export interface ClosePositionStrategy {
  shouldClosePosition: (position: TradingPositionWithMeta) => Promise<{ close: boolean; transaction: TransactionWithPrice | undefined; profit?: { amount: number; token: string } }>;
}
export interface OrderWithPrice {
  price: number;
  baseAmount: number;
  action: 'buy' | 'sell';
}
export interface TransactionWithPrice {
  transaction: TxData;
  price: number;
  baseAmount: number;
}
export interface TradingStrategy<T extends StrategyConfiguration = StrategyConfiguration> {
  name: string;
  isBuyLevel: (config: T, req: NewPositionForQuoteRequest) => Promise<boolean>;
  isSellLevel: (config: T, req: NewPositionForBaseRequest) => Promise<boolean>;
  tryMarketBuy: (req: NewPositionForQuoteRequest) => Promise<TransactionWithPrice | undefined>;
  tryMarketSell: (req: NewPositionForBaseRequest) => Promise<TransactionWithPrice | undefined>;
}
export interface MarketMakingStrategy<T extends StrategyConfiguration = StrategyConfiguration> {
  name: string;
  generateBuyOrders: (config: T, quoteAmount: number) => Promise<OrderWithPrice[]>;
  generateSellOrders: (config: T, baseAmount: number) => Promise<OrderWithPrice[]>;
}

export interface CloseMarketMakerPositionStrategy {
  getClosePositionInfo: (position: MarketMakerPosition) => Promise<{ order: OrderWithPrice; transaction?: TransactionWithPrice }>;
}
export interface StrategyConfiguration {
  kind: string;
}
export interface EMAConfig extends StrategyConfiguration {
  period: number;
  field: keyof Candle;
}
export interface CurrentPriceConfig extends StrategyConfiguration {
  priceOffset: number;
}
export interface BollingerBandConfig extends StrategyConfiguration {
  kind: 'bollingerband';
  period: number;
  stdDev: number;
  field: keyof Candle;
  priceOffset: number;
}

export interface TradingEngineProvider<T = TradingConfig, O = TradingStrategy, C = ClosePositionStrategy> {
  config: T;
  openStrategy: O;
  closeStrategy: C;
  data: TradingDataProvider;
  web3: Web3Wrapper;
}
export interface MarketMakingEngineProvider extends TradingEngineProvider<MarketMakerStrategyConfig, MarketMakingStrategy, CloseMarketMakerPositionStrategy> {
  contracts: ContractWrappers;
}

export interface StrategyDataProvider {
  getGasPrices: () => Promise<Pick<EtherscanGasPrices, 'ProposeGasPrice' | 'SafeGasPrice'> | undefined>;
  getCurrentPrice: () => Promise<number | undefined>;
  sellQuoteAsset: (amount: number, options?: Partial<QuoteRequest>) => Promise<TransformedQuoteResponse | undefined>;
  sellBaseAsset: (amount: number, options?: Partial<QuoteRequest>) => Promise<TransformedQuoteResponse | undefined>;
}
export interface CandleStrategyDataProvider extends StrategyDataProvider {
  getCandles: () => Promise<Candle[]>;
}
export type withOrderData<T> = T & { orderStatus?: OrderStatus; orderTakerAssetFilledAmount?: BigNumber; orderHash?: string };
export interface StrategyOrders<T extends PendingMarketMakerPosition> {
  open: T[];
  expired: T[];
  filled: withOrderData<T>[];
}

export interface PriceInfoWithOrder extends OrderWithPrice {
  orderHash: string;
  order: Order;
}
