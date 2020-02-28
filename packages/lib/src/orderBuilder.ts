import { ContractWrappers } from '@0x/contract-wrappers';
import { ADDRESSES, CHAINID, NULL_ADDRESS, DECIMALS, NULL_BYTES, ZERO } from './config';
import { ZrxOrderInfo } from './types';
import { Order, BigNumber, assetDataUtils } from '0x.js';
import { getFutureDateInSeconds, getCurrentUnixTimestampSec } from './utils';
import { Web3Wrapper } from '@0x/web3-wrapper';
export class ZrxOrderBuilder {
  private contracts: ContractWrappers;
  private orderInfo: Partial<ZrxOrderInfo> = {};
  constructor(contracts: ContractWrappers) {
    this.contracts = contracts;
  }
  private getTokenAddress = (token: 'dai' | 'weth' | string) => {
    if (token === 'dai') {
      return ADDRESSES.dai;
    } else if (['eth', 'weth'].includes(token)) {
      return this.contracts.contractAddresses.etherToken;
    } else {
      return token;
    }
  };
  public maker = (makerAddress: string) => {
    this.orderInfo.makerAddress = makerAddress;
    return this;
  };
  public expiresIn = (expiresInSeconds: number) => {
    this.orderInfo.expiresInSeconds = expiresInSeconds;
    return this;
  };
  public for = (amount: number, token: 'dai' | 'weth' | string) => {
    this.orderInfo.takerTokenAddress = this.getTokenAddress(token);
    this.orderInfo.takerAmount = amount;
    return this;
  };
  public sell = (amount: number, token: 'dai' | 'weth' | string) => {
    this.orderInfo.makerTokenAddress = this.getTokenAddress(token);
    this.orderInfo.makerAmount = amount;
    return this;
  };
  public toValue = (): ZrxOrderInfo => {
    const { makerTokenAddress, takerTokenAddress, makerAddress, expiresInSeconds, makerAmount, takerAmount } = this.orderInfo;
    if (makerTokenAddress && takerTokenAddress && makerAddress && expiresInSeconds && makerAmount && takerAmount) {
      return { makerTokenAddress, takerTokenAddress, makerAddress, expiresInSeconds, makerAmount, takerAmount };
    } else {
      const partialError = 'order info only partially filled out';
      throw partialError;
    }
  };
  public toOrder = () => {
    const { makerAmount, takerAmount, makerAddress, expiresInSeconds, makerTokenAddress, takerTokenAddress } = this.toValue();
    const order: Order = {
      chainId: CHAINID,
      exchangeAddress: this.contracts.contractAddresses.exchange,
      makerAddress: makerAddress,
      takerAddress: NULL_ADDRESS,
      senderAddress: NULL_ADDRESS,
      feeRecipientAddress: NULL_ADDRESS,
      expirationTimeSeconds: getFutureDateInSeconds(expiresInSeconds),
      salt: getCurrentUnixTimestampSec(),
      makerAssetAmount: Web3Wrapper.toBaseUnitAmount(new BigNumber(makerAmount), DECIMALS),
      takerAssetAmount: Web3Wrapper.toBaseUnitAmount(new BigNumber(takerAmount), DECIMALS),
      makerAssetData: assetDataUtils.encodeERC20AssetData(makerTokenAddress),
      takerAssetData: assetDataUtils.encodeERC20AssetData(takerTokenAddress),
      makerFeeAssetData: NULL_BYTES,
      takerFeeAssetData: NULL_BYTES,
      makerFee: ZERO,
      takerFee: ZERO,
    };
    return order;
  };
}
