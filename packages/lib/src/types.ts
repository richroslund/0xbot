import { OrderInfo } from '@0x/mesh-rpc-client';
import { SignedOrder, BigNumber } from '0x.js';

export interface ZrxOrder {
  price: number;
  action: string;
  id: string;
  amt: any;
  ord: OrderInfo;
  fee: number;
  feeAsset: string;
  signedOrder: SignedOrder;
  takerToken: string;
  makerToken: string;
  daiPrice: number;
  realPrice: number;
  expiresInSeconds: number;
}

export interface PartialOrder {
  price: number;
  amount: number;
  buy: boolean;
  total: number;
}

export type PartialEthDaiOrder = PartialOrder;

export type Distributions = 'flat' | 'descending' | 'ascending';
export const distributions: { [D in Distributions]: Distributions } = {
  flat: 'flat',
  descending: 'descending',
  ascending: 'ascending',
};
export type Directions = 'buy' | 'sell' | 'both';
export const directions: { [D in Directions]: Directions } = {
  buy: 'buy',
  sell: 'sell',
  both: 'both',
};
export interface ScaledOrderOptions {
  totalAmount: number;
  orderCount: number;
  priceLower: number;
  priceUpper: number;
}
export interface ScaledOrderConfig {
  amountNoise?: string;
  priceNoise?: string;
  distribute: Distributions;
}
export interface ScaledOrderState extends ScaledOrderConfig {
  buy?: ScaledOrderOptions;
  sell?: ScaledOrderOptions;
  preview: boolean;
  show: boolean;
  generated: {
    buy: PartialEthDaiOrder[];
    sell: PartialEthDaiOrder[];
  };
  direction: Directions;
}

export interface SignedOrderWithMetadata {
  order: SignedOrder;
  metaData: {
    orderHash: string;
    remainingFillableTakerAssetAmount: BigNumber;
  };
}

export interface Candle {
  time: number;
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
}

export interface FibonnaciBands {
  upperThird: number;
  upperSecond: number;
  upperFirst: number;
  lowerThird: number;
  lowerSecond: number;
  lowerFirst: number;
}
export interface PaginatedOrders {
  total: number;
  page: number;
  perPage: number;
  records: SignedOrderWithMetadata[];
}
export interface Orderbook {
  bids: PaginatedOrders;
  asks: PaginatedOrders;
}

export interface FibStats {
  high: number;
  low: number;
  close: number;
  atr: number;
  sma: number;
  fib: FibonnaciBands;
}
export interface AtrValues {
  low: number[];
  high: number[];
  close: number[];
}

export interface HistoricalCandles {
  quarterHour: Candle[];
  hour: Candle[];
  sixHour: Candle[];
  daily: Candle[];
}
export type Timeframes = keyof HistoricalCandles;

export interface OrdersRequest {
  makerAddress?: string;
  page?: number;
  perPage?: number;
  makerAssetData?: string;
  takerAssetData?: string;
}
export interface TokenBalances {
  zrx: number;
  weth: number;
  dai: number;
}
export type KnownTokens = keyof TokenBalances;

export interface Balances {
  balances: TokenBalances;
  balancesByAddress: { [address: string]: number };
  ethBalance: number;
}

export interface ZrxOrderInfo {
  makerTokenAddress: string;
  takerTokenAddress: string;
  makerAddress: string;
  expiresInSeconds: number;
  makerAmount: number;
  takerAmount: number;
}

export interface EtherscanGasPrices {
  LastBlock: string;
  SafeGasPrice: string;
  ProposeGasPrice: string;
}

export interface EtherscanGasOracleResponse {
  status: string;
  message: string;
  result: EtherscanGasPrices;
}
export interface MultipleOrderMarketMaker {
  kind: 'multiple';
  orderCount: {
    ask: number;
    bid: number;
  };
  amountIncrease: {
    ask: number;
    bid: number;
  };
  priceIncrease: {
    ask: number;
    bid: number;
  };
}
export interface RangeOrderMarketMaker {
  kind: 'multipleByRange';
  amountIncrease: {
    ask: number;
    bid: number;
  };
  askPrices: number[];
  bidPrices: number[];
}

export type MarketMakerStrategies = MultipleOrderMarketMaker | RangeOrderMarketMaker;
export interface PriceFeed {
  baseToken: string;
  quoteToken: string;
  getBidAskPrices?: () => Promise<{ bid: number; ask: number }>;
  getMidPrice: () => Promise<number | undefined>;
}
export interface MarketMakingConfig {
  fees?: {
    recipient: string;
    makerFee?: BigNumber;
    takerFee?: BigNumber;
    takerFeeAssetData?: string;
  };
  baseToken: string;
  quoteToken: string;
  thresholdFromMid: {
    ask: number;
    bid: number;
  };
  bidAskJump: boolean;
  inventorySkew: { base?: number; quote?: number };
  minAmount: {
    quote?: number;
    base?: number;
  };

  strategy: MarketMakerStrategies;
  priceFeed: PriceFeed;
}
