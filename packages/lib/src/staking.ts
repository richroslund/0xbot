import { StakeStatus, NIL_POOL_ID, ADDRESSES } from './config';
import { SupportedProvider, BigNumber, ERC20TokenContract } from '0x.js';
import { ContractWrappers, StakingContract } from '@0x/contract-wrappers';
import { Web3Wrapper, TransactionReceiptWithDecodedLogs, TxData } from '@0x/web3-wrapper';
import { DECIMALS, tryApproveToken } from '.';

export class Staking {
  private contracts: ContractWrappers;
  private providerEngine: SupportedProvider;
  constructor(provider: SupportedProvider, contractsWrappers: ContractWrappers) {
    this.providerEngine = provider;
    this.contracts = contractsWrappers;
  }
  public contract = (address: string) =>
    new StakingContract(this.contracts.contractAddresses.stakingProxy, this.providerEngine, {
      from: address,
    });

  public createPool = async (
    makerAddress: string,
    operatorSharePercentage: number
  ): Promise<{
    poolId: any;
    transaction: TransactionReceiptWithDecodedLogs;
  }> => {
    const staking = this.contract(makerAddress);
    if (operatorSharePercentage < 0 || operatorSharePercentage > 100) {
      const opShareError = { error: 'operator share should be between 0-100' };
      throw opShareError;
    }
    const opShare = (operatorSharePercentage / 100) * 1000000;
    const poolCreated = await staking.createStakingPool(opShare, true).awaitTransactionSuccessAsync({
      from: makerAddress,
    });

    const createStakingPoolLog = poolCreated.logs[0];
    const poolId = (createStakingPoolLog as any).args.poolId;
    return { poolId, transaction: poolCreated };
  };
  public tryStake = async (makerAddress: string, stakeAmount: BigNumber, gasPrice?: number) => {
    const transactionDefaults = {
      from: makerAddress,
      gasPrice,
    };
    const existingBalance = await new ERC20TokenContract(this.contracts.contractAddresses.zrxToken, this.providerEngine).balanceOf(makerAddress).callAsync();
    if (existingBalance.isLessThan(stakeAmount)) {
      console.log('not enough zrx to stake');
    } else {
      const staking = new StakingContract(this.contracts.contractAddresses.stakingProxy, this.providerEngine, transactionDefaults);

      const stakeTransaction = staking.stake(stakeAmount);
      const gas = await stakeTransaction.estimateGasAsync(transactionDefaults);
      const stakeTx = await stakeTransaction.sendTransactionAsync({ ...transactionDefaults, gas }).catch(err => console.log('error staking zrx', err));
      return stakeTx;
    }
  };
  public setupMaker = async (makerAddress: string, poolId: string, amountToStake: number, gasPrice?: number) => {
    const transactionDefaults = {
      from: makerAddress,
      gasPrice,
    };
    const approveZrx = await tryApproveToken(this.contracts, makerAddress, this.providerEngine, this.contracts.contractAddresses.zrxToken);
    const approveWeth = await tryApproveToken(this.contracts, makerAddress, this.providerEngine, this.contracts.contractAddresses.etherToken);
    const approveDai = await tryApproveToken(this.contracts, makerAddress, this.providerEngine, ADDRESSES.dai);
    console.log('approve tokens res', { zrx: approveZrx, weth: approveWeth, dai: approveDai });

    const stakeAmount = Web3Wrapper.toBaseUnitAmount(new BigNumber(amountToStake), DECIMALS);
    // Transfer the ZRX to the Staking Contract
    console.log('staking zrx', stakeAmount);
    const stakeTx = await this.tryStake(makerAddress, stakeAmount, gasPrice);
    const staking = new StakingContract(this.contracts.contractAddresses.stakingProxy, this.providerEngine, transactionDefaults);
    const moveTransaction = staking.moveStake({ status: StakeStatus.Undelegated, poolId: NIL_POOL_ID }, { status: StakeStatus.Delegated, poolId }, stakeAmount);

    const moveGas = await moveTransaction.estimateGasAsync(transactionDefaults);
    const moveStakeTx = await moveTransaction.sendTransactionAsync({ ...transactionDefaults, gas: moveGas });

    // Join the Pool with another maker address
    // This is useful if you wish to Market Make from different addresses
    const joinPoolAsMaker = await this.joinAsMaker(makerAddress, poolId, transactionDefaults);
    return {
      transactions: {
        approve: approveZrx,
        stake: stakeTx,
        move: moveStakeTx,
        join: joinPoolAsMaker,
      },
    };
  };
  public joinAsMaker = async (makerAddress: string, poolId: string, transactionDefaults: Partial<TxData>) => {
    const transactionDef = {
      ...transactionDefaults,
      from: makerAddress,
    };
    const staking = new StakingContract(this.contracts.contractAddresses.stakingProxy, this.providerEngine, transactionDef);
    const joinTransaction = staking.joinStakingPoolAsMaker(poolId);
    const joinGas = await joinTransaction.estimateGasAsync(transactionDef);
    const sendDefs = {
      ...transactionDef,
      gas: joinGas,
    };
    console.log('transaction info', sendDefs);
    const joinPoolAsMaker = await joinTransaction.sendTransactionAsync();
    return joinPoolAsMaker;
  };
  public getStake = (makerAddress: string) =>
    new StakingContract(this.contracts.contractAddresses.stakingProxy, this.providerEngine, {
      from: makerAddress,
    })
      .getTotalStake(makerAddress)
      .callAsync();
  public unstakeMaker = async (makerAddress: string) => {
    const staking = new StakingContract(this.contracts.contractAddresses.stakingProxy, this.providerEngine, {
      from: makerAddress,
    });
    const amountStaked = await this.getStake(makerAddress);
    //const stakeAmount = Web3Wrapper.toBaseUnitAmount(new BigNumber(amountToStake), DECIMALS);
    // Transfer the ZRX to the Staking Contract
    return { unstake: staking.unstake(amountStaked), amount: Web3Wrapper.toUnitAmount(amountStaked, DECIMALS).toNumber() };
  };
}
export const StakingUtilities = {
  parsePoolId: (poolId: string): BigNumber => {
    if (poolId.startsWith('0x')) {
      return new BigNumber(poolId, 16);
    }
    return new BigNumber(poolId);
  },
  encodePoolId: (poolId: number) => `0x${new BigNumber(poolId).toString(16).padStart(64, '0')}`,
  decodePoolId: (poolIdHex: string) => new BigNumber(poolIdHex, 16).toNumber(),
};
