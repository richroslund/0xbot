import { logOrder } from './../actions/log';
import { logBalances } from './../actions/balances';
import { ContractWrappers } from '@0x/contract-wrappers';
import { Argv } from 'yargs';

import { SupportedProvider } from '0x.js';

import { StakingPoolsResponse, ZrxApi, PoolWithStats, StakingUtilities, ADDRESSES, Account, SignedOrderWithMetadata, DECIMALS, getCurrentUnixTimestampSec } from '@0x/lib';
import { Web3Wrapper } from '@0x/web3-wrapper';
import _ from 'lodash';
import chalk from 'chalk';

const filterExpired = (orders: SignedOrderWithMetadata[], includeExpired?: boolean) => (includeExpired === true ? orders : _.filter(orders, o => o.order.expirationTimeSeconds.isGreaterThan(getCurrentUnixTimestampSec())));

const listOrders = async (contracts: ContractWrappers, address: string, includeExpired?: boolean) => {
  try {
    const accountOrders = await new ZrxApi().getOpenOrders(address, ADDRESSES.dai, contracts.contractAddresses.etherToken);
    const { bids, asks, others } = {
      bids: filterExpired(accountOrders.bids, includeExpired),
      asks: filterExpired(accountOrders.asks, includeExpired),
      others: filterExpired(accountOrders.others, includeExpired),
    };
    console.log('bids', bids.length, 'asks', asks.length, 'others', others.length);
    console.log(chalk.underline('Open orders'));
    asks.forEach((order: SignedOrderWithMetadata) => {
      logOrder('ask:', order.order.takerAssetAmount.dividedBy(order.order.makerAssetAmount), order.metaData.remainingFillableTakerAssetAmount, order.metaData.orderHash, order.order.expirationTimeSeconds);
    });
    bids.forEach((order: SignedOrderWithMetadata) => {
      logOrder('bid:', order.order.makerAssetAmount.dividedBy(order.order.takerAssetAmount), order.metaData.remainingFillableTakerAssetAmount, order.metaData.orderHash, order.order.expirationTimeSeconds);
    });

    others.forEach((order: SignedOrderWithMetadata) => {
      logOrder('other order', order.order.makerAssetAmount.dividedBy(order.order.takerAssetAmount), Web3Wrapper.toUnitAmount(order.metaData.remainingFillableTakerAssetAmount, DECIMALS), order.metaData.orderHash, order.order.expirationTimeSeconds);
    });

    return { bids, asks };
  } catch (err) {
    console.log('list orders error', err);
  }
};
const listPools = async () => {
  try {
    const { stakingPools }: StakingPoolsResponse = await new ZrxApi().getStakingPools();
    console.log(chalk.underline('Staking pools'));
    stakingPools.forEach((pool: PoolWithStats) => {
      const poolId = parseInt(pool.poolId);
      const poolIdHex = StakingUtilities.encodePoolId(poolId);
      console.log(`${poolId}`, chalk.yellow(`${poolIdHex}`), ' - operator:', `${pool.operatorAddress}`);
    });
    return stakingPools;
  } catch (err) {
    console.log('list pools error');
  }
};
export const queryCommand = <T = {}>(yargs: Argv<T>, provider: SupportedProvider, contracts: ContractWrappers, address: string) => {
  return yargs.command(
    'query',
    'query objects',
    yarg => {
      yarg

        .option('includeExpired', { alias: 'ie', describe: 'include expired orders in output', type: 'boolean' })
        .option('pools', { alias: 'p', describe: 'query staking pools', type: 'boolean' })
        .option('balances', { alias: 'b', describe: 'query balances', type: 'boolean' })
        .option('orders', { alias: 'o', describe: 'query orders', type: 'boolean' });
    },
    async (argv: { balances?: boolean; orders?: boolean; pools?: boolean; includeExpired?: boolean }) => {
      const { pools, orders, balances, includeExpired } = argv;
      if (pools) {
        return await listPools();
      }
      if (orders) {
        return await listOrders(contracts, address, includeExpired);
      }
      if (balances) {
        const balances = await new Account().getBalancesAsync(provider, contracts, address);
        logBalances(balances);
        return balances;
      }
    }
  );
};
