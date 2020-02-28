import { SupportedProvider, Web3Wrapper } from '@0x/web3-wrapper';
import { ContractWrappers } from '@0x/contract-wrappers';
import { ZrxApi } from '@0x/lib';
import _ from 'lodash';
import chalk from 'chalk';
import { Argv } from 'yargs';
import { BigNumber } from '0x.js';

export class Swap {
  private web3: Web3Wrapper;
  private address: string;
  constructor(provider: SupportedProvider, address: string) {
    this.address = address;
    this.web3 = new Web3Wrapper(provider);
  }
  private buyQuote = async (token: string, baseToken = 'DAI', amount: number, options: { address?: string; gasPrice?: number }) => {
    const { address, gasPrice } = options;
    const amt = amount || 1;
    const quote = await new ZrxApi().quote({ sellAmount: amt, sellToken: token, buyToken: baseToken, takerAddress: address, gasPrice });
    const price = quote?.price ? _.round(parseFloat(quote?.price), 4) : undefined;
    return { quote, price };
  };
  public quotes = async (token: string, baseToken = 'DAI', amount: number, options: { address?: string; gasPrice?: number }) => {
    const { address, gasPrice } = options;
    // await checkBalancesAndAllowances(this.contracts, this.address);
    const amt = amount || 1;
    const buy = await this.buyQuote(token, baseToken, amount, options);
    const sellQuote = await new ZrxApi().quote({ buyAmount: amt, sellToken: baseToken, buyToken: token, takerAddress: address, gasPrice });

    const sellprice = sellQuote?.price ? _.round(parseFloat(sellQuote?.price), 4) : undefined;
    console.log(`[$${chalk.blue(buy.price || '')} - $${chalk.blue(sellprice || '')}]`);

    return true;
  };
  public sell = async (minPrice: number, token: string, baseToken = 'DAI', amount: number, gasPrice?: number, nonce?: number) => {
    const { quote, price } = await this.buyQuote(token, baseToken, amount, { address: this.address, gasPrice });

    if (!quote || !price) {
      console.log(chalk.yellow('Quote or Price from API came back null'));
      return false;
    } else if (price < minPrice) {
      console.log(chalk.yellow(`Best quote`), chalk.red(`${price}`), chalk.yellow(`is under min price ($${minPrice})`));
      return false;
    }
    console.log(`selling ${amount} ${token} for ${baseToken} at ${chalk.blue(price || '')} from [${chalk.magenta(quote.sources.map(s => s.name).join(','))}]`);

    const transactionArgs = { from: this.address, gasPrice: new BigNumber(quote.gasPrice), value: new BigNumber(quote.value), nonce, gas: new BigNumber(quote.gas) };
    const trans = await this.web3.sendTransactionAsync(quote as any).catch(reason => {
      console.log(chalk.red('error executing transaction'), 'with args', transactionArgs, 'reason:', reason);
      throw reason;
    });
    console.log('transaction...', chalk.blue(trans));
    return true;
  };
  public runUntilSuccess = async (cmd: () => Promise<boolean>, timeout: number) => {
    const res = await cmd();
    if (res === false) {
      setTimeout(async () => {
        return await this.runUntilSuccess(cmd, timeout).catch((reason: any) => {
          console.warn('caught error', reason);
          return false;
        });
      }, timeout);
    } else {
      return true;
    }
  };
}

export const setupSwapCommands = <T = {}>(yargs: Argv<T>, _provider: SupportedProvider, _contracts: ContractWrappers, address: string) => {
  return yargs
    .command(
      ['quotes <token> [baseToken]', 'quote <token> [baseToken]'],
      'watch swap quotes',
      yy => {
        return yy
          .positional('token', {
            describe: 'token to check',
            type: 'string',
          })
          .positional('baseToken', {
            describe: 'baseToken to check',
            type: 'string',
            default: 'DAI',
          })
          .option('address', { alias: 'a', describe: 'include address in request', type: 'boolean' })
          .option('amount', { describe: 'amount for quote', type: 'number' })
          .option('watch', { describe: 'watch interval', type: 'number' })
          .option('gasPrice', { alias: 'g', describe: 'gas price to include in request', type: 'number' });
      },
      async argv => {
        const { token, baseToken, amount, gasPrice, watch } = argv;
        const includeAddress = argv.address || false;
        if (token === undefined) {
          const error = 'token must be defined';
          throw error;
        }
        if (amount === undefined) {
          const amtErr = 'Amount must be set (--amount)';
          throw amtErr;
        }
        const swapper = new Swap(_provider, address);
        await swapper.quotes(token, baseToken, amount, { address: includeAddress ? address : undefined, gasPrice });
        if (watch && watch > 0) {
          setInterval(async () => {
            await swapper.quotes(token, baseToken, amount, { address: includeAddress ? address : undefined, gasPrice });
          }, watch);
        }
      }
    )
    .command(
      ['sell'],
      'sell token for at least <price>',
      yy => {
        return yy.options({
          nonce: { alias: 'n', describe: 'nonce', type: 'number' },
          gasPrice: { alias: 'g', describe: 'gas price to include in request', type: 'number' },
          baseToken: {
            describe: 'baseToken to check',
            type: 'string',
            default: 'DAI',
          },
          token: {
            alias: 't',
            describe: 'token to check',
            type: 'string',
            require: true,
          },
          price: {
            alias: 'p',
            describe: 'min price to sell at',
            type: 'number',
            require: true,
          },
          amount: { alias: 'a', describe: 'amount for quote', type: 'number', require: true },
          wait: { alias: 'w', describe: 'watch for price to hit minprice, then execute', type: 'boolean' },
        });
      },
      async argv => {
        const { token, baseToken, amount, gasPrice, price, wait, nonce } = argv;
        if (token === undefined) {
          const error = 'token must be defined';
          throw error;
        }
        const swapper = new Swap(_provider, address);
        if (wait === true) {
          console.log(chalk.blue('Waiting until price is above minprice to execute'));
          return await swapper.runUntilSuccess(() => swapper.sell(price, token, baseToken, amount, gasPrice, nonce), 5000);
        } else {
          return await swapper.sell(price, token, baseToken, amount, gasPrice, nonce);
        }
      }
    );
};
