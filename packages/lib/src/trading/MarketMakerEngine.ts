import { Balances } from './../types';
import { MarketMakingEngineProvider, MarketMakerStrategyConfig, MarketMakerStrategy, MarketMakerPosition, ZrxOrderWithPrice } from './types';
import _ from 'lodash';
import { resolveOrderStatus, getPositionsWithPendingOrders, createPositionForOrder, convertToOrdersWithHash, getUnallocatedBaseAmount, getUnallocatedQuoteAmount, displayCurrentState } from './TradingUtilities';
import { Order } from '0x.js';
import { BaseEngine } from './BaseEngine';
export class MarketMakerEngine extends BaseEngine {
  private defaultConfig: MarketMakerStrategyConfig;
  private instanceKey: string;
  private interval: NodeJS.Timeout | undefined;
  private provider: MarketMakingEngineProvider;
  public constructor(provider: MarketMakingEngineProvider, key?: string) {
    super();
    this.provider = provider;
    this.defaultConfig = provider.config;
    this.instanceKey = key || `MarketMakerEngine-${new Date().valueOf()}`;
  }

  private getStrategy = async () => await this.provider.data.getMarketMakerStrategy(this.instanceKey, strat => strat.meta.instanceKey === this.instanceKey);
  private saveStrategy = async (value: MarketMakerStrategy) => {
    const existing = await this.getStrategy();
    if (!existing) {
      // eslint-disable-next-line no-throw-literal
      throw 'strategy doesnt exist';
    }
    return await this.provider.data.saveMarketMakerStrategy(this.instanceKey, value);
  };
  private createStrategy = async (value: MarketMakerStrategy) => {
    const existing = await this.getStrategy();
    if (existing) {
      // eslint-disable-next-line no-throw-literal
      throw 'strategy already exists';
    }
    return await this.provider.data.saveMarketMakerStrategy(this.instanceKey, value);
  };
  private saveStrategyPositions = async (positions: MarketMakerPosition[]) => {
    const existing = await this.getStrategy();
    if (!existing) {
      // eslint-disable-next-line no-throw-literal
      throw 'strategy doesnt exist';
    }
    const value: MarketMakerStrategy = {
      ...existing,
      positions: positions,
    };
    return await this.provider.data.saveMarketMakerStrategy(this.instanceKey, value);
  };

  private signAndPlaceOrder = async (order: Order) => {
    const signed = await this.provider.data.signOrder(order);
    await this.provider.data.placeOrder(signed);
    console.log(` placed order`, signed);
    return signed;
  };
  private tryResolveExistingPositions = async () => {
    const strategy = await this.getStrategy();
    if (strategy === undefined) {
      return undefined;
    }
    const { positions } = strategy;
    const { filled, expired } = await resolveOrderStatus(this.provider.contracts, getPositionsWithPendingOrders(positions));
    const positionInfo = _.reduce(
      positions,
      (acc: Pick<MarketMakerStrategy, 'positions'>, position: MarketMakerPosition): Pick<MarketMakerStrategy, 'positions'> => {
        const { id, pendingOrder } = position;
        let status = position.status;
        const open = position.open;
        const closePosition = position.close;

        const filledOrder = _.find(filled, fo => fo.id === id);
        const expiredOrder = _.find(expired, fo => fo.id === id);
        let pending = pendingOrder;
        let expiredOrders = position.expiredOrders;
        if (filledOrder) {
          pending = undefined;
          status = status === 'open' ? 'closed' : 'open';
        } else if (expiredOrder) {
          expiredOrders = [...position.expiredOrders, expiredOrder.pendingOrder.order];
          pending = undefined;
        }
        return { positions: [...acc.positions, { ...position, pendingOrder: pending, status, expiredOrders: expiredOrders, close: closePosition, open }] };
      },
      { positions: [] }
    );
    return await this.saveStrategy({ ...strategy, ...positionInfo });
  };
  private refreshOpenPositions = async () => {
    const strategy = await this.getStrategy();
    if (strategy === undefined) {
      return undefined;
    }
    const updatedPositions = await Promise.all(
      await _.map(strategy.positions, async p => {
        if (p.status === 'open' && _.isNil(p.pendingOrder)) {
          const closeInfo = await this.provider.closeStrategy.getClosePositionInfo(p);
          const closeOrder = await convertToOrdersWithHash(strategy, this.provider.contracts, [closeInfo.order]).then(res => _.first(res));
          if (closeOrder) {
            console.log(`creating close position ${closeInfo.order.action} ${closeInfo.order.baseAmount} @ $${closeInfo.order.price}`);
            const signed = await this.signAndPlaceOrder(closeOrder.order);
            const pendingOrder: ZrxOrderWithPrice = {
              order: signed,
              price: closeOrder.price,
              orderHash: closeOrder.orderHash,
            };
            return { ...p, pendingOrder };
          } else {
            console.log(`error trying to close position ${closeInfo.order.action} ${closeInfo.order.baseAmount} @ $${closeInfo.order.price}`);
          }
        }
        return p;
      })
    );
    return await this.saveStrategyPositions(updatedPositions);
  };

  private tryCreateNewPositions = async (balances: Balances) => {
    const strategy = await this.getStrategy();
    if (strategy === undefined) {
      console.log('initial strategy is null');
      return undefined;
    }

    const { positions, baseToken, quoteToken, openStrategyConfig } = strategy;
    const openPositionCount = _.filter(positions, p => p.status !== 'closed').length;
    if (openPositionCount >= this.defaultConfig.maxOpenPositions) {
      console.log('already at max open positions');
      return undefined;
    }
    const tokenBalances = this.getTokenBalances(balances, baseToken, quoteToken);
    const baseAmount = getUnallocatedBaseAmount(strategy, strategy.positions, tokenBalances.base);
    const quoteAmount = getUnallocatedQuoteAmount(strategy, strategy.positions, tokenBalances.quote);
    const sells = baseAmount > 0 ? await this.provider.openStrategy.generateSellOrders(openStrategyConfig, baseAmount).then(ords => convertToOrdersWithHash(strategy, this.provider.contracts, ords)) : [];
    const placedSells = await Promise.all(_.map(sells, async sellOrder => ({ ...sellOrder, signed: await this.signAndPlaceOrder(sellOrder.order) })));
    const buys = quoteAmount > 0 ? await this.provider.openStrategy.generateBuyOrders(openStrategyConfig, quoteAmount).then(ords => convertToOrdersWithHash(strategy, this.provider.contracts, ords)) : [];
    const placedBuys = await Promise.all(_.map(buys, async o => ({ ...o, signed: await this.signAndPlaceOrder(o.order) })));
    const newPositions = [...placedSells, ...placedBuys].map(o => createPositionForOrder(this.instanceKey, o.signed, o.baseAmount, o.orderHash, baseToken, balances));

    return await this.saveStrategyPositions(_.union(strategy.positions, newPositions));
  };
  public startEngine = async () => {
    const initialStrategy = await this.getStrategy();
    if (!initialStrategy) {
      console.log('initial strategy is null');
      return undefined;
    }
    const balances = await this.provider.data.getBalances();
    displayCurrentState(initialStrategy, balances);
    await this.tryResolveExistingPositions();
    await this.refreshOpenPositions();
    await this.tryCreateNewPositions(balances);
  };

  public start = async (intervalSeconds?: number) => {
    let initialStrategy = await this.getStrategy();
    if (!initialStrategy) {
      initialStrategy = { ...this.defaultConfig, positions: [] };
      await this.createStrategy(initialStrategy);
    } else {
      await this.saveStrategy(initialStrategy);
    }
    const interval = (intervalSeconds || initialStrategy.intervalSeconds) * 1000;
    console.log('starting engine with', interval, 'interval');
    try {
      await this.startEngine();
    } catch (err) {
      console.error(err);
    }
    this.interval = setInterval(async () => {
      try {
        await this.startEngine();
      } catch (err) {
        console.error(err);
      }
    }, interval);
  };
  public stop = () => {
    if (this.interval) {
      clearTimeout(this.interval);
    }
    return true;
  };
}
