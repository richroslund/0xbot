import { AssetData } from './../assets';
import { PopulatedSignedZrxOrders, PopulatedSignedOrders } from './../orders';
import { ContractWrappers } from '@0x/contract-wrappers';
import { StakingPoolsResponse } from './../zrxApiTypes';
import { BigNumber, SignedOrder, assetDataUtils } from '0x.js';
import axios, { AxiosError } from 'axios';
import * as qs from 'qs';
import { APIURL, DECIMALS, CHAINID, ORDERSIZETHRESHOLD } from '../config';
import { Orderbook, SignedOrderWithMetadata, PaginatedOrders, OrdersRequest } from '../types';
import { toWei } from '../utils';
import _ from 'lodash';
import { Web3Wrapper } from '@0x/web3-wrapper';
import { OrderStatus } from '@0x/types';
const big = (val: any) => new BigNumber(val);

export const sendOrder = async (order: SignedOrder) => {
  return await axios.post(`${APIURL}/sra/v3/order`, order);
};

const setupOrders = (records: SignedOrderWithMetadata[]) =>
  records
    .map(
      (o: SignedOrderWithMetadata): SignedOrderWithMetadata => {
        const order = o.order;

        const { makerFee, takerFee, expirationTimeSeconds, salt } = order;
        const takerAssetAmount = big(order.takerAssetAmount);
        const makerAssetAmount = big(order.makerAssetAmount);

        return {
          ...o,
          order: {
            ...order,
            takerAssetAmount,
            makerAssetAmount,
            makerFee: big(makerFee),
            takerFee: big(takerFee),
            expirationTimeSeconds: big(expirationTimeSeconds),
            salt: big(salt),
          },
          metaData: {
            orderHash: o.metaData.orderHash,
            remainingFillableTakerAssetAmount: big(o.metaData.remainingFillableTakerAssetAmount),
          },
        };
      }
    )
    .filter(o => BigNumber.isBigNumber(o.order.takerAssetAmount) === true && BigNumber.isBigNumber(o.order.makerAssetAmount) === true);

type OrderOrUndef = PopulatedSignedZrxOrders | undefined;
const getBestValidOrder = (contracts: ContractWrappers, orders: PopulatedSignedZrxOrders[], isBetterThan: (currentBest: PopulatedSignedZrxOrders, value: PopulatedSignedZrxOrders) => boolean) =>
  orders.reduce(async (bestValueAsync: Promise<OrderOrUndef>, ord: PopulatedSignedZrxOrders) => {
    const best = await bestValueAsync;
    if (best === undefined || isBetterThan(best, ord)) {
      const [{ orderStatus }, remainingFillableAmount, isValidSignature] = await contracts.devUtils.getOrderRelevantState(ord.signedOrder, ord.signedOrder.signature).callAsync();
      if (orderStatus === OrderStatus.Fillable && remainingFillableAmount.isGreaterThan(0) && isValidSignature) {
        return ord;
      }
    }
    return best;
  }, Promise.resolve(undefined));

export interface OrderBookAndBestPriceType {
  bids: PopulatedSignedZrxOrders[];
  asks: PopulatedSignedZrxOrders[];
  best: {
    bid: PopulatedSignedZrxOrders | undefined;
    ask: PopulatedSignedZrxOrders | undefined;
  };
}

export interface QuoteRequest {
  slippagePercentage?: number;
  gasPrice?: number;
  sellAmount?: number | BigNumber;
  buyToken: string;
  sellToken: string;
  buyAmount?: number | BigNumber;
  takerAddress?: string;
}
export interface QuoteResponse {
  price: string;
  to: string;
  data: string;
  value: string;
  gasPrice: string;
  gas: string;
  protocolFee: string;
  buyAmount: string;
  sellAmount: string;
  orders: SignedOrder[];
  sources: { name: string; proportion: string }[];
}
export class ZrxApi {
  public sendOrder = sendOrder;

  public getOrderbookAsync = async (baseAssetData: string, quoteAssetData: string): Promise<Orderbook> => {
    const bookResponse = await axios.get<Orderbook>(`${APIURL}/sra/v3/orderbook`, { params: { baseAssetData, quoteAssetData, perPage: 100 } });

    return {
      ...bookResponse.data,
      bids: {
        ...bookResponse.data.bids,
        records: setupOrders(bookResponse.data.bids.records),
      },
      asks: {
        ...bookResponse.data.asks,
        records: setupOrders(bookResponse.data.asks.records),
      },
    };
  };
  public getStakingPools = async () => {
    const { data } = await axios.get<StakingPoolsResponse>(`${APIURL}/staking/pools`);
    return data;
  };

  public postOrder = async (signedOrder: SignedOrder) => {
    try {
      const orderRes = await axios.post(`${APIURL}/sra/v3/order`, signedOrder).then(res => {
        console.log('create order result', { status: res.status, statusText: res.statusText });
        return res.data;
      });

      return orderRes;
    } catch (err) {
      console.error('signedOrder before error', signedOrder);
      const response = _.get(err, 'response', undefined);
      if (response) {
        console.error('data', _.get(response, 'data', undefined));
        const validationErrors = _.get(response, 'data.validationErrors', []);
        if (validationErrors.length > 0) {
          validationErrors.map((er: any) => {
            console.log('Validation Error: ', er);
          });
        }
      }

      throw err;
    }
  };
  public postOrders = async (orders: SignedOrder[]) => {
    return await _.reduce(
      orders,
      async (postResults: Promise<any[]>, order: SignedOrder) => {
        const results = await postResults;
        const curr = await this.postOrder(order);
        return [...results, curr];
      },
      Promise.resolve([])
    );
  };
  public getOrders = async (ordersRequest?: OrdersRequest) => {
    const requestUrl = `${APIURL}/sra/v3/orders${ordersRequest ? '?' + qs.stringify(ordersRequest) : ''}`;
    const res = await axios.get<PaginatedOrders>(requestUrl).then(res => ({ ...res.data, records: setupOrders(res.data.records) }));
    return res;
  };
  public quote = async ({ sellAmount, buyAmount, ...params }: QuoteRequest) => {
    const gasPrice = params.gasPrice ? toWei(params.gasPrice) : undefined;
    const queryString = qs.stringify({
      ...params,
      gasPrice,
      sellAmount: sellAmount ? (BigNumber.isBigNumber(sellAmount) ? sellAmount.toString() : Web3Wrapper.toBaseUnitAmount(sellAmount, DECIMALS).toString()) : undefined,
      buyAmount: buyAmount ? (BigNumber.isBigNumber(buyAmount) ? buyAmount.toString() : Web3Wrapper.toBaseUnitAmount(buyAmount, DECIMALS).toString()) : undefined,
    });
    const quoteUrl = `${APIURL}/swap/v0/quote?${queryString}`;
    console.log(quoteUrl);
    return await axios
      .get<QuoteResponse>(quoteUrl)
      .then(res => res.data)
      .catch((err: AxiosError<any>) => {
        console.log('request quote error', err.code, err.response?.data);
        return undefined;
      });
  };

  public getOrderBookAndBestPriceAsync = async (contracts: ContractWrappers, assets: AssetData, assetValues?: { base: string; quote: string }): Promise<OrderBookAndBestPriceType> => {
    const baseAsset = assetValues ? assetValues.base : assets.eth;
    const quoteAsset = assetValues ? assetValues.quote : assets.dai;
    const orders = await this.getOrderbookAsync(baseAsset, quoteAsset);
    const orderConfig = { assetName: 'WETH', daiAssetData: assets.dai, chainId: CHAINID };
    const { asks, bids } = { bids: PopulatedSignedOrders(orders.bids.records, orderConfig), asks: PopulatedSignedOrders(orders.asks.records, orderConfig) };
    const orderedBids = _(bids)
      .filter(o => o.amt > ORDERSIZETHRESHOLD && !o.expired)

      .orderBy(o => o.price, 'desc');
    const orderedAsks = _(asks)
      .filter(o => o.amt > ORDERSIZETHRESHOLD && !o.expired)
      .orderBy(o => o.price, 'asc');
    const bestBid: PopulatedSignedZrxOrders | undefined = await getBestValidOrder(contracts, orderedBids.value(), (c: PopulatedSignedZrxOrders, n: PopulatedSignedZrxOrders) => n.price > c.price);
    const bestAsk: PopulatedSignedZrxOrders | undefined = await getBestValidOrder(contracts, orderedAsks.value(), (c: PopulatedSignedZrxOrders, n: PopulatedSignedZrxOrders) => n.price < c.price);
    if (bestBid || bestAsk) {
      return {
        best: {
          bid: bestBid,
          ask: bestAsk,
        },
        bids: orderedBids.value(),
        asks: orderedAsks.value(),
      };
    } else {
      console.log('bid or ask was null');
      return {
        best: {
          bid: undefined,
          ask: undefined,
        },
        bids: [],
        asks: [],
      };
    }
  };
  public getOpenOrders = async (address: string, bidMakerAsset: string, bidTakerAsset: string, minimumAmount?: BigNumber) => {
    const minValueFilter = (order: SignedOrderWithMetadata) => order.metaData.remainingFillableTakerAssetAmount.isGreaterThan(minimumAmount || new BigNumber(0));
    const { records } = await new ZrxApi().getOrders({ makerAddress: _.toLower(address) });
    const makerAsset = [bidMakerAsset, assetDataUtils.encodeERC20AssetData(bidMakerAsset)];
    const takerAsset = [bidTakerAsset, assetDataUtils.encodeERC20AssetData(bidTakerAsset)];
    const assets = [...makerAsset, ...takerAsset];
    const pairOrder = _.filter(records, o => assets.includes(_.toLower(o.order.makerAssetData)) || assets.includes(_.toLower(o.order.takerAssetData)));
    const bids = _(pairOrder)
      .filter(o => makerAsset.includes(o.order.makerAssetData))
      .filter(minValueFilter)
      .value();
    const asks = _(pairOrder)
      .filter(o => takerAsset.includes(o.order.makerAssetData))
      .filter(minValueFilter)
      .value();
    const others = _(records)
      .filter(o => !_.some(pairOrder, po => po.metaData.orderHash === o.metaData.orderHash))
      .filter(minValueFilter)
      .value();
    return { all: records, bids, asks, others };
  };
}
