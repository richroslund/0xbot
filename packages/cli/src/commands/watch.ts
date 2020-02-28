import { PriceWatcher } from './../actions/bestMeshPrices';
import { ContractWrappers } from '@0x/contract-wrappers';
import _ from 'lodash';

import { getAndLogFibs, log, logPrice } from '../actions/log';

export const watchPrice = async (contracts: ContractWrappers, watchPrice = false, _timeout = 5000) => {
  //console.log(process.env.KEYSTORE, jsonStr.toString());

  //console.log(wallet.address);

  const symbol = 'ETH-USD';
  await getAndLogFibs(symbol);
  // const wrappedEth: TransactionReceiptWithDecodedLogs = await wrapEth(contracts, address, 0.75);
  // console.log('wrapped eth', wrappedEth.transactionIndex);

  if (watchPrice) {
    const priceWatcher = new PriceWatcher(contracts);
    setInterval(async () => {
      const bestPrices = await priceWatcher.getBestPrices(symbol);
      const priceChanges = [bestPrices.ask.change, bestPrices.bid.change];
      if (_.some(priceChanges, v => v !== 0)) {
        log('Mesh: [', logPrice(bestPrices.bid.price, bestPrices.bid.change), '-', logPrice(bestPrices.ask.price, bestPrices.ask.change), ']', 'Coinbase:', logPrice(bestPrices.lastPrice.price, bestPrices.lastPrice.change));
      }
    }, _timeout);
  } else {
    process.exit();
  }
};
