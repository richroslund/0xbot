import { SupportedProvider } from '@0x/web3-wrapper';
import { ContractWrappers } from '@0x/contract-wrappers';
import { tryApproveToken, Staking, ADDRESSES } from '@0x/lib';
import _ from 'lodash';
import chalk from 'chalk';
import { Argv } from 'yargs';
export class Setup {
  private provider: SupportedProvider;
  private contracts: ContractWrappers;
  constructor(providerEngine: SupportedProvider, contractWrappers: ContractWrappers) {
    this.provider = providerEngine;
    this.contracts = contractWrappers;
  }
  public approveTokens = async (address: string, tokens: string[]) => {
    try {
      const transactions = await Promise.all(
        tokens.map(async token => {
          const approved = await tryApproveToken(this.contracts, address, this.provider, token);
          if (approved) {
            console.log(chalk.blue(`approved ${token}`, approved));
          } else {
            console.log(chalk.blue(`token ${token} not approved`));
          }

          return approved;
        })
      );

      return transactions;
    } catch (err) {
      console.log(chalk.red('approving token error!', err));
    }
    return Promise.resolve({});
  };

  public createPool = async (address: string): Promise<string | undefined> => {
    try {
      const createResult = await new Staking(this.provider, this.contracts).createPool(address, 90);
      const poolId = _.get(createResult, 'poolId', undefined);
      console.log(chalk.blue(`created staking pool`, chalk.underline.green(poolId)));
      return poolId;
    } catch (err) {
      console.log('setup staking pool maker error');
    }
  };
  public setupMaker = async (address: string, poolId: string, zrxAmount: number) => {
    try {
      const setupMakerRes = new Staking(this.provider, this.contracts).setupMaker(address, poolId, zrxAmount);
      console.log(chalk.blue(`setup`, chalk.green(address), 'as maker of', chalk.underline.green(poolId)));
      return setupMakerRes;
    } catch (err) {
      console.log('setup staking pool maker error');
    }
  };
}
export const setupCommand = <T = {}>(yargs: Argv<T>, provider: SupportedProvider, contracts: ContractWrappers, address: string) => {
  return yargs.command(
    'setup',
    'setup the account',
    yarg => {
      return yarg
        .option('maker', { alias: 'm', type: 'boolean', describe: 'setup address as maker' })
        .option('stake', { alias: 's', type: 'number', describe: 'amount to stake' })
        .option('pool', { alias: 'p', type: 'string', describe: 'pool to stake with' });
    },
    async argv => {
      const defaultOptions: { createpool: boolean; pool?: string; maker?: boolean; stake?: number } = {
        createpool: false,
        pool: undefined,
        maker: false,
        stake: undefined,
      };
      const { createpool, pool, maker, stake } = { ...defaultOptions, ...argv };
      const setup = new Setup(provider, contracts);
      await setup.approveTokens(address, [contracts.contractAddresses.etherToken, contracts.contractAddresses.zrxToken, ADDRESSES.dai]);
      let poolId: string | undefined = pool;
      if (createpool) {
        poolId = await setup.createPool(address);
      }
      if (maker) {
        if (stake === undefined || poolId === undefined) {
          const invalidOpts = {
            error: 'stake cannot be undefined and either set poolid or create a new pool',
          };
          throw invalidOpts;
        } else if (stake) {
          await setup.setupMaker(address, poolId, stake);
        }
        return;
      }
    }
  );
};
