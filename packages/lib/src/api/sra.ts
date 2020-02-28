import { HttpClient } from '@0x/connect';
import { SignedOrder, Order } from '0x.js';
import * as _ from 'lodash';

export class SRAWrapper {
  private url = 'https://api.0x.org/sra/v3';

  constructor(relayOrUrl?: string) {
    const cleanRelayVal = _.toLower(relayOrUrl || '').trim();
    if (['radarrelay', 'radar'].includes(cleanRelayVal)) {
      this.url = 'https://api.radarrelay.com/0x/v3';
    } else if (relayOrUrl === undefined) {
      this.url = 'https://api.0x.org/sra/v3';
    } else {
      this.url = relayOrUrl;
    }
  }
  private sra = () => new HttpClient(this.url);
  public orderWithConfig = async (order: Order) => {
    const configOrder = await this.sra().getOrderConfigAsync(order);
    return {
      ...order,
      ...configOrder,
    };
  };
  public signOrderWithConfig = async (order: Order, signOrder: (order: Order) => Promise<SignedOrder>) => {
    const updated = await this.orderWithConfig(order);
    return await signOrder(updated);
  };
  public signOrdersWithConfig = async (orders: Order[], signOrder: (order: Order) => Promise<SignedOrder>) => {
    return await _.reduce(
      orders,
      async (acc: Promise<SignedOrder[]>, o: Order) => {
        const res = await acc;

        const currOrder = await this.signOrderWithConfig(o, signOrder);
        return [...res, currOrder];
      },
      Promise.resolve([])
    );
  };
  public postOrders = async (orders: SignedOrder[]) => {
    const push = await Promise.all(
      _.map(orders, async (o: SignedOrder) => {
        return await this.sra()
          .submitOrderAsync(o)
          .then(() => ({ success: true, order: o }))
          .catch(reason => {
            console.log('error submitting order', reason, o);
            return {
              success: false,
              order: o,
            };
          });
      })
    );
    return push;
  };
}
