import { ClosePositionStrategy, TradingPosition, StrategyDataProvider, CloseMarketMakerPositionStrategy, MarketMakerPosition, TransactionWithPrice, OrderWithPrice } from '../types';
import { BaseTradingStrategy } from './BaseTradingStrategy';
import _ from 'lodash';

export class ProfitableClose extends BaseTradingStrategy implements ClosePositionStrategy, CloseMarketMakerPositionStrategy {
  private minProfitability: number;
  private address: string;
  constructor(provider: StrategyDataProvider, minProfitability: number, address: string) {
    super('profitclose', provider);
    this.minProfitability = minProfitability;
    this.address = address;
  }
  public shouldClosePosition = async (position: TradingPosition) => {
    const { open, amount, context } = position;
    const openPositionIsBuy = context.action === 'buy';
    const gasPrice = await this.getGasPrice();
    const currentPrice = await this.provider.getCurrentPrice();
    const quoteOptions = { gasPrice, takerAddress: this.address };
    if (open === undefined) {
      return { close: false, transaction: undefined };
    }
    const bestQuote = openPositionIsBuy ? await this.provider.sellBaseAsset(amount, quoteOptions) : await this.provider.sellQuoteAsset(open.price * amount, quoteOptions);
    const bestPrice = bestQuote ? (openPositionIsBuy ? bestQuote.price : 1 / bestQuote.price) : undefined;
    if (open && bestQuote && bestPrice && currentPrice) {
      const previousGasAmount = open.receipt ? this.toUnit(open.receipt.cumulativeGasUsed) : 0.001;
      const previousGasValue = previousGasAmount * currentPrice;
      const protocolFeeValue = this.toUnit(bestQuote.protocolFee) * currentPrice;
      const gasValue = this.toUnit(bestQuote.gas) * currentPrice;
      const baggage = previousGasValue + protocolFeeValue + gasValue;
      let close = false;
      if (openPositionIsBuy) {
        const valueOfTrade = bestPrice * position.amount - baggage;
        const minValueOfTrade = open.price * (1 + this.minProfitability) * position.amount;

        close = valueOfTrade >= minValueOfTrade;
        console.log(`sell to close: ${close}`, minValueOfTrade, '<', valueOfTrade);
      } else if (!openPositionIsBuy) {
        const valueOfTrade = bestPrice * position.amount + baggage;
        const maxValueOfTrade = open.price * (1 - this.minProfitability) * position.amount;

        close = valueOfTrade <= maxValueOfTrade;
        console.log(`buy to close:${close}`, `cost of trade ($${valueOfTrade}) is too expensive (max cost $${maxValueOfTrade})`);
      }
      return { close: close, transaction: { transaction: bestQuote, price: bestQuote.price, baseAmount: position.amount } };
    }
    return { close: false, transaction: undefined };
  };
  public getClosePositionInfo = async (position: MarketMakerPosition): Promise<{ order: OrderWithPrice; transaction?: TransactionWithPrice }> => {
    const { open, context, amount } = position;
    if (open === undefined) {
      // eslint-disable-next-line no-throw-literal
      throw 'position has no open';
    }
    const openPrice = open.price;
    const sellToClose = context.action === 'buy';
    const currentPrice = await this.provider.getCurrentPrice();
    const targetPrice = sellToClose ? openPrice * (1 + this.minProfitability) : openPrice * (1 - this.minProfitability);
    let price = targetPrice;
    if (sellToClose && currentPrice && currentPrice > targetPrice) {
      const halfOfDiff = (currentPrice - targetPrice) / 2;
      price = targetPrice + halfOfDiff;
    } else if (!sellToClose && currentPrice && currentPrice < targetPrice) {
      const halfOfDiff = (targetPrice - currentPrice) / 2;
      price = targetPrice - halfOfDiff;
    }
    const order: OrderWithPrice = { price, baseAmount: amount, action: sellToClose ? 'sell' : 'buy' };
    return { order };
  };
}
