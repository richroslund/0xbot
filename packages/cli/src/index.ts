/* eslint-disable react-app/import/first */
require('dotenv').config();

import { ContractWrappers } from '@0x/contract-wrappers';

import { getProviderFromKeystore, CHAINID } from '@0x/lib';
import { KEYSTORE, PASSWORD } from './config';
import { setupCommand } from './commands/setup';
import yargs from 'yargs';
import { setupStakingCommands } from './commands/staking';
import { watchPrice } from './commands/watch';
import { tradeCommand } from './commands/trade';
import { balanceCommand } from './commands/balances';
import { queryCommand } from './commands/query';
import { marketMakerCommand } from './commands/marketmaker';
import { setupOrderCommands } from './commands/orders';
import { setupSwapCommands } from './commands/swap';

// export const trade = async (providerEngine: SupportedProvider, address: string, contracts: ContractWrappers, _timeout = 5000) => {
//   //console.log(process.env.KEYSTORE, jsonStr.toString());

//   //console.log(wallet.address);

//   const symbol = 'ETH-USD';
//   // const fibAsync = getFibs(symbol);
//   const daiToken = ADDRESSES.dai;
//   // await fibAsync;
//   const ticker = await coinbase.getTicker(symbol);
//   const tickerPrice = ticker.ticker ? parseFloat(ticker.ticker.ask) : undefined;
//   console.log('price', tickerPrice);
//   // const wrappedEth: TransactionReceiptWithDecodedLogs = await wrapEth(contracts, address, 0.75);
//   // console.log('wrapped eth', wrappedEth.transactionIndex);
//   const amountToSell = 0.05;
//   const sellPrice = 170;
//   const signed = await createAndSignOrder(providerEngine, contracts, {
//     makerAddress: address,
//     makerTokenAddress: contracts.contractAddresses.etherToken,
//     takerTokenAddress: daiToken,
//     makerAmount: amountToSell,
//     takerAmount: amountToSell * sellPrice,
//     expiresInSeconds: 60 * 10,
//   });
//   const sendResult = await zrxApi.sendOrder(signed);
//   console.log('send order result', sendResult.status.toString() === '200' ? 'success!' : 'error :(');
//   const assets = getAssets(contracts.contractAddresses);
//   const wethToken = new ERC20TokenContract(contracts.contractAddresses.etherToken, providerEngine);
//   setInterval(async () => {
//     const { best } = await queryOrders(assets);
//     const bid = best.bid;
//     const currentWethBig = await wethToken.balanceOf(address).callAsync();
//     const wethAmt = Web3Wrapper.toUnitAmount(new BigNumber(currentWethBig), DECIMALS).toNumber();
//     if (bid && wethAmt > 0.5) {
//       const fillOrder = await fill(contracts, address, bid.signedOrder, 0.1);
//       console.log('filledOrder', fillOrder);
//     }
//   }, _timeout);
// };
const cli = async () => {
  const { providerEngine, address } = await getProviderFromKeystore(KEYSTORE, PASSWORD);

  const contracts = new ContractWrappers(providerEngine, { chainId: CHAINID });
  try {
    const tradeYargs = tradeCommand(yargs, providerEngine, contracts, address);
    const bYargs = balanceCommand(tradeYargs, providerEngine, contracts, address);
    const query = queryCommand(bYargs, providerEngine, contracts, address);
    const marketMaker = marketMakerCommand(query, providerEngine, contracts, address);
    const finalYargs = marketMaker;
    // .command('trade', 'start trading bot', { handler: async () => await trade(providerEngine, address, contracts, 5000) })
    return setupCommand(finalYargs, providerEngine, contracts, address)
      .command(
        ['order', 'orders'],
        'order commands',
        yarg => {
          return setupOrderCommands(yarg, providerEngine, contracts, address);
        },
        async () => {
          console.log('base order command');
        }
      )
      .command(
        ['staking', 'stake'],
        'staking commands',
        yarg => {
          return setupStakingCommands(yarg, providerEngine, contracts, address);
        },
        async () => {
          console.log('base stake command');
        }
      )
      .command(
        ['swap'],
        'swap commands',
        yarg => {
          return setupSwapCommands(yarg, providerEngine, contracts, address);
        },
        async () => {
          console.log('base swap command');
        }
      )
      .command(
        'watch',
        'watch price movement',
        yarg => {
          return yarg.option('price', { alias: 'p', default: false, type: 'boolean', describe: 'follow prices' });
        },
        async argv => {
          return await watchPrice(contracts, argv.price, 5000);
        }
      )
      .help().argv;
  } catch (e) {
    console.log('error', e);
    providerEngine.stop();
    process.exit(1);
  }
};
void (async () => {
  await cli();
  //process.exit();
})();
