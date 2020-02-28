import { MESHPROVIDER } from './config';
import { getContractAddressesForChainOrThrow } from '0x.js';
import { WSClient, OrderInfo } from '@0x/mesh-rpc-client';
import { PopulatedZrxOrders, getAssets, CHAINID, PopulateOrders } from '.';
const orderSizeThreshold = 0.001;

export const onlyOf = (orders: OrderInfo[], assetType: string) => orders.filter(oi => [oi.signedOrder.takerAssetData, oi.signedOrder.makerAssetData].includes(assetType));

export const startOrderWatchAsync = async (onOrdersReceived: (orders: PopulatedZrxOrders[]) => void, assetData: string, assetName: string, options?: { orderSizeThreshold: number }) => {
  const meshSocket = new WSClient(MESHPROVIDER, { reconnectDelay: 2000 });
  const opts = options || { orderSizeThreshold };
  const assets = getAssets(getContractAddressesForChainOrThrow(CHAINID));
  meshSocket.getOrdersAsync().then(res => {
    const daiOrders = onlyOf(res.ordersInfos, assets.dai);
    const assetDaiOrders = onlyOf(daiOrders, assetData);
    const ordsWithPrice: PopulatedZrxOrders[] = PopulateOrders(assetDaiOrders, { otherAssetData: assetData, assetName: assetName, daiAssetData: assets.dai })
      .filter(o => o.amt > opts.orderSizeThreshold)
      .filter(o => o.expiresInSeconds > 0);
    onOrdersReceived(ordsWithPrice);

    // const buys = ordsWithPrice
    //   .filter(o => o.action === 'buy')
    //   .sort((a, b) => a.price - b.price)
    //   .reverse();
    // const sells = ordsWithPrice.filter(o => o.action === 'sell').sort((a, b) => a.price - b.price);

    // console.log('buys', buys);
    // console.log('sells', sells);
  });
  return meshSocket;
};
