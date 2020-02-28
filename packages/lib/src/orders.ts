import { OrderInfo } from '@0x/mesh-rpc-client';
import { SupportedProvider } from '@0x/subproviders';
import { Order, signatureUtils, BigNumber, assetDataUtils, SignedOrder } from '0x.js';
import { ContractWrappers } from '@0x/contract-wrappers';
import { Web3Wrapper } from '@0x/web3-wrapper';
import _ from 'lodash';
import { secondsFromNow, getFutureDateInSeconds, getCurrentUnixTimestampSec, asDate } from './utils';
import { DECIMALS, CHAINID, NULL_ADDRESS, NULL_BYTES, ZERO, ADDRESSES } from './config';
import { Distributions, distributions, ScaledOrderOptions, ScaledOrderConfig, PartialEthDaiOrder, ScaledOrderState, directions, SignedOrderWithMetadata } from './types';

export interface PartialOrderParams extends Partial<Pick<SignedOrder, 'makerFeeAssetData' | 'takerFeeAssetData' | 'takerFee' | 'makerFee' | 'feeRecipientAddress'>> {
  makerTokenAddress: string;
  takerTokenAddress: string;
  makerAddress: string;
  expiresInSeconds: number;
  makerAmount: number;
  takerAmount: number;
}

interface OrderConfig {
  otherAssetData: string;
  assetName: string;
  daiAssetData: string;
}
export const PopulatedSignedOrder = (signedOrder: SignedOrderWithMetadata, options: { assetName: string; daiAssetData: string; chainId: number }) => {
  const { assetName, daiAssetData, chainId } = options;
  const { expirationTimeSeconds, makerAssetAmount, takerAssetAmount, takerAssetData, takerFee } = signedOrder.order;
  const { remainingFillableTakerAssetAmount, orderHash } = signedOrder.metaData;
  const realPrice = takerAssetAmount.dividedBy(makerAssetAmount).toNumber();
  const isSell = takerAssetData === daiAssetData;
  const action = isSell ? 'sell' : 'buy';
  const price = isSell ? makerAssetAmount.dividedBy(takerAssetAmount).toNumber() : realPrice;

  let amount = Web3Wrapper.toUnitAmount(remainingFillableTakerAssetAmount, DECIMALS).toNumber();
  amount = isSell ? amount * price : amount;
  const fee = Web3Wrapper.toUnitAmount(takerFee, DECIMALS).toNumber();
  const feeAsset = isSell ? 'Dai' : assetName;
  const exp = secondsFromNow(expirationTimeSeconds);
  return {
    price: 1 / price,
    realPrice,
    daiPrice: price,
    action,
    id: orderHash,
    amt: amount,
    ord: signedOrder,
    fee,
    feeAsset,
    takerToken: takerAssetData === daiAssetData ? 'dai' : assetName,
    makerToken: takerAssetData === daiAssetData ? assetName : 'dai',
    expiresInSeconds: exp,
    expired: exp < 0 ? true : false,
    expirationDate: asDate(expirationTimeSeconds),
    signedOrder: {
      ...signedOrder.order,
      makerFeeAssetData: _.get(signedOrder.order, 'makerFeeAssetData'),
      takerFeeAssetData: _.get(signedOrder.order, 'takerFeeAssetData'),

      chainId: chainId,
    },
  };
};
export type PopulatedSignedZrxOrders = ReturnType<typeof PopulatedSignedOrder>;
export const PopulatedSignedOrders = (orders: SignedOrderWithMetadata[], orderConfig: { assetName: string; daiAssetData: string; chainId: number }): PopulatedSignedZrxOrders[] => _.map(orders, o => PopulatedSignedOrder(o, orderConfig));

const PopulateOrder = (oi: OrderInfo, info: OrderConfig, chainId = 1) => {
  const { assetName, daiAssetData } = info;
  const { makerAssetAmount, takerAssetAmount, takerAssetData, takerFee } = oi.signedOrder;

  const realPrice = takerAssetAmount.dividedBy(makerAssetAmount).toNumber();

  const isSell = takerAssetData === daiAssetData;
  const action = isSell ? 'sell' : 'buy';
  const price = isSell ? makerAssetAmount.dividedBy(takerAssetAmount).toNumber() : realPrice;

  let amount = Web3Wrapper.toUnitAmount(oi.fillableTakerAssetAmount, DECIMALS).toNumber();
  amount = isSell ? amount * price : amount;
  const fee = Web3Wrapper.toUnitAmount(takerFee, DECIMALS).toNumber();
  const feeAsset = isSell ? 'Dai' : assetName;
  return {
    price: 1 / price,
    realPrice,
    daiPrice: price,
    action,
    id: oi.orderHash,
    amt: amount,
    ord: oi,
    fee,
    feeAsset,
    takerToken: oi.signedOrder.takerAssetData === daiAssetData ? 'dai' : assetName,
    makerToken: oi.signedOrder.takerAssetData === daiAssetData ? assetName : 'dai',
    expiresInSeconds: secondsFromNow(oi.signedOrder.expirationTimeSeconds),
    signedOrder: {
      ...oi.signedOrder,
      makerFeeAssetData: _.get(oi.signedOrder, 'makerFeeAssetData'),
      takerFeeAssetData: _.get(oi.signedOrder, 'takerFeeAssetData'),

      chainId: chainId,
    },
  };
};
export type PopulatedZrxOrders = ReturnType<typeof PopulateOrder>;
export const PopulateOrders = (orders: OrderInfo[], info: OrderConfig, chainId = 1): PopulatedZrxOrders[] => {
  return orders.map(o => PopulateOrder(o, info, chainId));
};

const toPercentageOrDefault = (val: string | undefined, def: number) => {
  const floatOrUndefined = val && !_.isNaN(parseFloat(val)) ? parseFloat(val) : undefined;
  return _.isNil(floatOrUndefined) || _.isNaN(floatOrUndefined) ? def : floatOrUndefined / 100;
};
const getDistributionWeight = (total: number, index: number, dist: Distributions, isBuy: boolean) => {
  if (dist === distributions.flat) {
    return 1;
  }
  const half = total / 2;
  const weight = half / (index + 1);
  const inverse = (index + 1) / half;
  if (dist === distributions.ascending) {
    return isBuy ? weight : inverse;
  } else {
    return isBuy ? inverse : weight;
  }
};
const generateDirectionOrders = (options: ScaledOrderOptions, config: ScaledOrderConfig, isBuy: boolean): PartialEthDaiOrder[] => {
  const { priceLower, priceUpper, orderCount, totalAmount } = options;
  const { distribute } = config;
  const priceNoise = toPercentageOrDefault(config.priceNoise, 0);
  const amountNoise = toPercentageOrDefault(config.amountNoise, 0);
  const diff = priceUpper - priceLower;
  const stepDiff = diff / orderCount;

  const stepValues = _.times(orderCount, ind => _.random(1 - priceNoise, 1 + priceNoise) * stepDiff * (1 + ind));
  const orders = _(stepValues).reduce((acc: PartialEthDaiOrder[], sv: number, ind: number) => {
    const weight = getDistributionWeight(orderCount, ind, distribute, isBuy);
    const price = _.round(sv + priceLower, 4);
    const currentAmount = _(acc)
      .map(v => v.amount)
      .sum();
    const remainingAmount = totalAmount - currentAmount;
    const isLast = ind === orderCount - 1;
    const randAmountNoise = _.random(1 - amountNoise, 1 + amountNoise);
    const generatedAmount = _.round(totalAmount / orderCount, 2) * randAmountNoise * weight;
    const amt = isLast ? remainingAmount : _.min([generatedAmount, remainingAmount * 0.8]) || remainingAmount;
    return [
      ...acc,
      {
        price,
        amount: _.floor(amt, 2),
        total: _.floor(amt * price, 2),
        buy: isBuy,
      },
    ];
  }, []);
  return _.orderBy(orders, 'price', 'desc');
};

export const generateScaledOrders = (state: ScaledOrderState): { buy: PartialEthDaiOrder[]; sell: PartialEthDaiOrder[] } => {
  const { buy, sell, direction, ...config } = state;
  const hasBuy = buy && (direction === directions.both || direction === directions.buy);
  const hasSell = sell && (direction === directions.both || direction === directions.sell);
  return {
    buy: buy && hasBuy ? generateDirectionOrders(buy, config, true) : [],
    sell: sell && hasSell ? generateDirectionOrders(sell, config, false) : [],
  };
};

export const getOrderEpoch = async (contracts: ContractWrappers, makerAddress: string, senderAddress: string) => {
  return await contracts.exchange.orderEpoch(makerAddress, senderAddress).callAsync();
};

export const createNewOrder = async (contractWrappers: ContractWrappers, info: PartialOrderParams) => {
  const { makerAmount, takerAmount, makerAddress, expiresInSeconds, makerTokenAddress, takerTokenAddress, feeRecipientAddress, takerFeeAssetData, takerFee } = info;
  // Create the order
  //const currentEpoch = await getOrderEpoch(contractWrappers, makerAddress, NULL_ADDRESS);
  const order: Order = {
    chainId: CHAINID,
    exchangeAddress: contractWrappers.contractAddresses.exchange,
    makerAddress: makerAddress,
    takerAddress: NULL_ADDRESS,
    senderAddress: NULL_ADDRESS,
    feeRecipientAddress: feeRecipientAddress || NULL_ADDRESS,
    expirationTimeSeconds: getFutureDateInSeconds(expiresInSeconds),
    salt: getCurrentUnixTimestampSec(),
    makerAssetAmount: Web3Wrapper.toBaseUnitAmount(new BigNumber(makerAmount), DECIMALS),
    takerAssetAmount: Web3Wrapper.toBaseUnitAmount(new BigNumber(takerAmount), DECIMALS),
    makerAssetData: assetDataUtils.encodeERC20AssetData(makerTokenAddress),
    takerAssetData: assetDataUtils.encodeERC20AssetData(takerTokenAddress),
    makerFeeAssetData: NULL_BYTES,
    takerFeeAssetData: takerFeeAssetData || NULL_BYTES,
    makerFee: ZERO,
    takerFee: takerFee || ZERO,
  };

  // Generate the order hash and sign it
  return order;
};
export const signOrder = async (providerEngine: SupportedProvider, order: Order, address: string) => {
  // Create the order

  // Generate the order hash and sign it
  return await signatureUtils.ecSignOrderAsync(providerEngine, order, address);
};
export const createAndSignOrder = async (providerEngine: SupportedProvider, contractWrappers: ContractWrappers, info: PartialOrderParams) => {
  const { makerAddress } = info;
  // Create the order
  const order: Order = await createNewOrder(contractWrappers, info);

  // Generate the order hash and sign it
  return await signOrder(providerEngine, order, makerAddress);
};

export const createAndSignOrders = async (providerEngine: SupportedProvider, contractWrappers: ContractWrappers, infos: PartialOrderParams[]) => {
  return await Promise.all(_.map(infos, async i => await createAndSignOrder(providerEngine, contractWrappers, i)));
};

export class EthDaiOrders {
  private contracts: ContractWrappers;
  constructor(contracts: ContractWrappers) {
    this.contracts = contracts;
  }

  private createEthDaiOrder = (makerToken: string, takerToken: string) => (ethPrice: number, amount: number, makerAddress: string, expiresInSeconds: number) => {
    const ethBuy = ADDRESSES.dai === makerToken;
    const takerAmount = ethBuy ? amount / ethPrice : amount * ethPrice;
    return { makerTokenAddress: makerToken, takerTokenAddress: takerToken, makerAddress, expiresInSeconds, makerAmount: amount, takerAmount: takerAmount };
  };
  public sell(ethPrice: number, amount: number, makerAddress: string, expiresInSeconds: number) {
    return this.createEthDaiOrder(this.contracts.contractAddresses.etherToken, ADDRESSES.dai)(ethPrice, amount, makerAddress, expiresInSeconds);
  }
  public buy(ethPrice: number, amount: number, makerAddress: string, expiresInSeconds: number) {
    return this.createEthDaiOrder(ADDRESSES.dai, this.contracts.contractAddresses.etherToken)(ethPrice, amount, makerAddress, expiresInSeconds);
  }
}
