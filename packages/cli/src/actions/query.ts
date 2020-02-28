import { ContractWrappers } from '@0x/contract-wrappers';
import { AssetData, CHAINID, PopulatedSignedOrders, PopulatedSignedZrxOrders } from '@0x/lib';
import { ORDERSIZETHRESHOLD } from '../config';
import _ from 'lodash';
import { ZrxApi } from '@0x/lib';
import { OrderStatus } from '@0x/types';
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

export const queryOrders = async (contracts: ContractWrappers, assets: AssetData) => {
  const orders = await new ZrxApi().getOrderbookAsync(assets.eth, assets.dai);
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
