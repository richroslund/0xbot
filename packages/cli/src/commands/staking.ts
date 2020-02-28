import { SupportedProvider, Web3Wrapper, TxData } from '@0x/web3-wrapper';
import { ContractWrappers } from '@0x/contract-wrappers';
import { Staking, DECIMALS, ZrxApi, PoolWithStats, StakingUtilities } from '@0x/lib';
import _ from 'lodash';
import chalk from 'chalk';
import { Argv } from 'yargs';
import { BigNumber } from '0x.js';
import { transactionOptions } from './utilities';

export class Stake {
  private staking: Staking;
  constructor(provider: SupportedProvider, contracts: ContractWrappers) {
    this.staking = new Staking(provider, contracts);
  }
  public staked = async (address: string) => {
    const stakedAmount = await this.staking.getStake(address).then(val => Web3Wrapper.toUnitAmount(new BigNumber(val), DECIMALS).toNumber());
    console.log(`Staked amount: ${chalk.blue(stakedAmount)}`);
  };
  public unstake = async (address: string) => {
    const { unstake, amount } = await this.staking.unstakeMaker(address);
    const transaction = unstake.sendTransactionAsync({ from: address });
    console.log(`unstaking ${chalk.blue(amount)} zrx - ${transaction}`);
    return unstake;
  };
  public list = async () => {
    const { stakingPools } = await new ZrxApi().getStakingPools();
    stakingPools.forEach((pool: PoolWithStats) => {
      const poolId = parseInt(pool.poolId);
      const poolIdHex = StakingUtilities.encodePoolId(poolId);
      console.log(`${poolId}`, chalk.yellow(`${poolIdHex}`), ' - operator:', `${pool.operatorAddress}`);
    });
  };
  public setupMaker = async (address: string, poolId: string, amount = 100, gasPrice?: number) => {
    const { transactions } = await this.staking.setupMaker(address, poolId, amount, gasPrice);
    const { approve, stake, move, join } = transactions;
    console.log('Setting up maker...');
    console.log(`approve - ${chalk.blue(approve)}`);
    console.log(`stake - ${chalk.blue(stake)}`);
    console.log(`move - ${chalk.blue(move)}`);
    console.log(`join - ${chalk.blue(join)}`);
  };
  public joinAsMaker = async (address: string, poolId: string, transactionDefaults?: Partial<TxData>) => {
    const transaction = await this.staking.joinAsMaker(address, poolId, transactionDefaults || { from: address });
    console.log(`joinAsMaker - ${chalk.blue(transaction)}`);
  };
}

export const setupStakingCommands = <T = {}>(yargs: Argv<T>, _provider: SupportedProvider, _contracts: ContractWrappers, address: string) => {
  const staking = new Stake(_provider, _contracts);
  return yargs
    .command(
      ['total'],
      'total amount staked',
      () => {},
      async () => {
        return await staking.staked(address);
      }
    )
    .command(
      ['list'],
      'list pool info',
      () => {},
      async () => {
        return await staking.list();
      }
    )
    .command(
      ['unstake'],
      'unstake a market maker',
      () => {},
      async () => {
        console.log('unstaking...');
        return await staking.unstake(address);
      }
    )
    .command(
      'join',
      'join pool as maker',
      yy => {
        return yy.options({
          pool: {
            describe: 'poolid to join',
            require: true,
            alias: 'p',
            type: 'string',
          },
        });
      },
      async argv => {
        const { pool } = argv;

        if (pool) {
          return await staking.joinAsMaker(address, pool);
        } else {
          console.log('no actions to perform');
        }
      }
    )
    .command(
      ['setup'],
      'staking setup maker or pool',
      yy => {
        return transactionOptions(yy).options({
          maker: { alias: 'm', describe: 'setup as a maker', type: 'boolean' },
          amount: { alias: 'a', describe: 'amount to stake', type: 'number', default: 100 },
          poolId: { alias: 'p', describe: 'pool to stake with', type: 'string', require: true },
        });
      },
      async argv => {
        const { maker, amount, poolId, gasprice } = argv;

        if (maker) {
          console.log(`setting ${address} up as pool maker`);
          return await staking.setupMaker(address, poolId, amount, gasprice);
        } else {
          console.log('no actions to perform');
        }
      }
    );
};
