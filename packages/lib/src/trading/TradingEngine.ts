import { Web3Wrapper } from '@0x/web3-wrapper';
import { TradingStrategy, ClosePositionStrategy, TradingDataProvider, TradingPosition, TradingEngineProvider, TradingConfig, TradingPositionWithMeta, PositionStatusOpening, PositionStatusClosing } from './types';
import _ from 'lodash';
import { createNewPosition, getTransactionData } from './TradingUtilities';
import { BaseEngine } from './BaseEngine';

export class TradingEngine extends BaseEngine {
  private openStrategy: TradingStrategy;
  private closeStrategy: ClosePositionStrategy;
  private engineConfig: TradingConfig;
  private data: TradingDataProvider;
  private instanceKey: string;
  private web3: Web3Wrapper;
  private interval: NodeJS.Timeout | undefined;
  public constructor(provider: TradingEngineProvider, key?: string) {
    super();
    this.web3 = provider.web3;
    this.openStrategy = provider.openStrategy;
    this.closeStrategy = provider.closeStrategy;
    this.engineConfig = provider.config;
    this.data = provider.data;
    this.instanceKey = key || _.uniqueId('Trading');
  }
  private tryResolvePosition = async (position: TradingPosition) => {
    console.log('waiting for pending positions');
    if (position && position.type === 'test') {
      return await this.data.savePosition(this.instanceKey, { ...position, status: 'open', meta: { instanceKey: this.instanceKey } });
    }
    const { status, open, close } = position;
    if (status === PositionStatusOpening && open) {
      const receipt = await this.web3.getTransactionReceiptIfExistsAsync(open.hash);
      if (receipt) {
        const positionStatus = receipt.status === 1 ? 'open' : 'failed';

        return await this.data.savePosition(this.instanceKey, { ...position, status: positionStatus, open: { ...open, receipt }, meta: { instanceKey: this.instanceKey } });
      }
    } else if (status === PositionStatusClosing && close) {
      const receipt = await this.web3.getTransactionReceiptIfExistsAsync(close.hash);
      if (receipt) {
        const positionStatus = receipt.status === 1 ? 'closed' : 'failed';

        return await this.data.savePosition(this.instanceKey, { ...position, status: positionStatus, close: { ...close, receipt }, meta: { instanceKey: this.instanceKey } });
      }
    } else {
      console.log('cannot resolve position', position);
    }
  };
  private getBuyRequest = (quoteBalance: number) => {
    const { minQuoteBalance, positionSize } = this.engineConfig;
    const remainingQuoteBalance = quoteBalance - minQuoteBalance;
    const amount = remainingQuoteBalance > 0 ? positionSize * remainingQuoteBalance : 0;
    return { quoteAmount: amount };
  };
  private getSellRequest = (baseBalance: number) => {
    const { minBaseBalance, positionSize } = this.engineConfig;
    const remainingQuoteBalance = baseBalance - minBaseBalance;
    const amount = remainingQuoteBalance > 0 ? positionSize * remainingQuoteBalance : 0;
    return { baseAmount: amount };
  };

  public tryOpenNewPosition = async () => {
    const { baseToken, quoteToken, openStrategyConfig } = this.engineConfig;
    const balances = await this.data.getBalances();
    const tokenBalances = this.getTokenBalances(balances, baseToken, quoteToken);
    const buyRequest = this.getBuyRequest(tokenBalances.quote);
    const sellRequest = this.getSellRequest(tokenBalances.base);
    const buy = buyRequest.quoteAmount > 0 ? await this.openStrategy.isBuyLevel(openStrategyConfig, buyRequest) : false;
    const sell = sellRequest.baseAmount > 0 ? await this.openStrategy.isSellLevel(openStrategyConfig, sellRequest) : false;
    let newPosition: TradingPositionWithMeta | undefined = undefined;
    if (buy) {
      const buyTransaction = await this.openStrategy.tryMarketBuy(buyRequest);
      if (buyTransaction) {
        const hash = await this.web3.sendTransactionAsync(buyTransaction.transaction);
        console.log('buy with protocol fee', buyTransaction.transaction.value);
        newPosition = createNewPosition(this.instanceKey, buyTransaction, buyRequest.quoteAmount / buyTransaction.price, 'buy', hash);
      }
    } else if (sell) {
      const sellTransaction = await this.openStrategy.tryMarketSell(sellRequest);
      if (sellTransaction) {
        const hash = await this.web3.sendTransactionAsync(sellTransaction.transaction);
        console.log('sell with protocol fee', sellTransaction.transaction.value);
        newPosition = createNewPosition(this.instanceKey, sellTransaction, sellRequest.baseAmount, 'sell', hash);
      }
    }
    if (newPosition !== undefined) {
      await this.data.savePosition(this.instanceKey, newPosition);
      console.log('opened position ', newPosition);
      return newPosition;
    }
  };
  public tryClose = async (position: TradingPositionWithMeta) => {
    const { close, transaction } = await this.closeStrategy.shouldClosePosition(position);

    if (close && transaction) {
      //EXECUTE
      //const hash = await this.web3.sendTransactionAsync(transaction.transaction);
      const hash = 'HASH';
      const closingPosition = {
        ...position,
        close: getTransactionData(transaction, hash),
        status: PositionStatusClosing,
      };
      await this.data.savePosition(this.instanceKey, closingPosition);
      return true;
    }
    return false;
  };
  public startEngine = async () => {
    const position = await this.data.getPosition(this.instanceKey, p => p.status === 'open' || p.status === PositionStatusClosing || p.status === PositionStatusOpening);
    if (position && [PositionStatusOpening, PositionStatusClosing].includes(position.status)) {
      return await this.tryResolvePosition(position);
    } else if (position && position.status === 'open') {
      console.log('trying to close existing position');
      return await this.tryClose(position);
    } else {
      return await this.tryOpenNewPosition();
    }
  };

  public start = async (intervalSeconds?: number) => {
    const interval = (intervalSeconds || this.engineConfig.intervalSeconds) * 1000;
    console.log('starting engine with', interval, 'interval');
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
