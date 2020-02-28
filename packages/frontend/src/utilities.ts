import { PopulatedSignedZrxOrders } from './../../lib/src/orders';
import _ from 'lodash';

export const orderToValues = (ord: PopulatedSignedZrxOrders) => {
  return {
    price: ord.price,
    amount: ord.amt,
    expires: ord.expirationDate,
    maker: ord.signedOrder.makerAddress,
  };
};

export const comparePrices = (incoming: number | undefined, existing: number | undefined) => {
  if (incoming === undefined) {
    return 0;
  } else {
    if (existing === undefined || incoming > existing) {
      return 1;
    } else if (existing === incoming) {
      return 0;
    } else {
      return -1;
    }
  }
};

export function toNumberOrDef<T, TT>(value: T, def: TT) {
  if (value === undefined) {
    return def;
  }
  const amtNum = _.isNumber(value) ? value : parseFloat(_.toString(value));
  return amtNum !== undefined ? _.round(amtNum, 4) : def;
}
