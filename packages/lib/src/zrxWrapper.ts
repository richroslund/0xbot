import { ContractWrappers } from '@0x/contract-wrappers';
import { SignedOrder, BigNumber } from '0x.js';
import { calculateProtocolFee } from './utils';
import { TX_DEFAULTS } from './config';
export class ZrxWrapper {
  private contracts: ContractWrappers;
  constructor(contractWrappers: ContractWrappers) {
    this.contracts = contractWrappers;
  }
  public fillOrKill = (order: SignedOrder, amount: BigNumber) => {
    return {
      transaction: this.contracts.exchange.fillOrder(order, amount, order.signature),
    };
  };
  public batchFillOrders = (orders: SignedOrder[], fillAmounts?: BigNumber[]) => {
    return {
      transaction: this.contracts.exchange.batchFillOrders(
        orders,
        fillAmounts || orders.map(o => o.takerAssetAmount),
        orders.map(o => o.signature)
      ),
    };
  };
  public marketBuyFillOrKillTransaction = (orders: SignedOrder[], amount: BigNumber) => {
    return {
      transaction: this.contracts.exchange.marketBuyOrdersFillOrKill(
        orders,
        amount,
        orders.map(o => o.signature)
      ),
      fee: calculateProtocolFee(orders),
    };
  };
  public marketBuyOrdersNoThrow = (orders: SignedOrder[], amount: BigNumber) => {
    return {
      transaction: this.contracts.exchange.marketBuyOrdersNoThrow(
        orders,
        amount,
        orders.map(o => o.signature)
      ),
      fee: calculateProtocolFee(orders),
    };
  };
  public marketBuy = async (address: string, orders: SignedOrder[], amount: BigNumber) => {
    const marketBuy = this.marketBuyFillOrKillTransaction(orders, amount);
    return await marketBuy.transaction.awaitTransactionSuccessAsync({ from: address, ...TX_DEFAULTS, value: calculateProtocolFee(orders) });
  };
  public marketSellFillOrKillTransaction = (orders: SignedOrder[], amount: BigNumber) => {
    return {
      transaction: this.contracts.exchange.marketSellOrdersFillOrKill(
        orders,
        amount,
        orders.map(o => o.signature)
      ),
      fee: calculateProtocolFee(orders),
    };
  };
  public marketSellOrdersNoThrowTransaction = (orders: SignedOrder[], amount: BigNumber) => {
    return {
      transaction: this.contracts.exchange.marketSellOrdersNoThrow(
        orders,
        amount,
        orders.map(o => o.signature)
      ),
      fee: calculateProtocolFee(orders),
    };
  };
  public marketSell = async (address: string, orders: SignedOrder[], amount: BigNumber) => {
    const { transaction } = this.marketSellFillOrKillTransaction(orders, amount);
    return await transaction.awaitTransactionSuccessAsync({ from: address, ...TX_DEFAULTS, value: calculateProtocolFee(orders) });
  };
}
