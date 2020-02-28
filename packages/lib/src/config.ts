import { isNaN } from 'lodash';
import { BigNumber } from '0x.js';
import _ from 'lodash';

export function envInt(key: string, def: number) {
  const enval = parseInt(process.env[key] || '');
  return isNaN(enval) ? def : enval;
}
export function envStr(key: string, def: string) {
  return process.env[key] || def;
}
export const CHAINID = envInt('CHAINID', 1);
export const INFURAKEY = envStr('INFURAKEY', '');
export const RPCURL = envStr('RPCURL', `https://mainnet.infura.io/v3/${INFURAKEY}`);
interface NetworkAddress {
  dai: string;
}
const MAINNETADDRESSES: NetworkAddress = {
  dai: envStr('MAINNET_DAI_ADDRESS', '0x6b175474e89094c44da98b954eedeac495271d0f'),
};
const ROPSTENADDRESSES: NetworkAddress = {
  dai: envStr('ROPSTEN_DAI_ADDRESS', '0xad6d458402f60fd3bd25163575031acdce07538d'),
};
const KOVANADDRESSES: NetworkAddress = {
  dai: envStr('KOVAN_DAI_ADDRESS', '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa'),
};
export const NETWORKADDRESSES = {
  '1': MAINNETADDRESSES,
  '3': ROPSTENADDRESSES,
  '42': KOVANADDRESSES,
};
export const ADDRESSES: NetworkAddress = _.get(NETWORKADDRESSES, CHAINID ? CHAINID.toString() : '1', MAINNETADDRESSES);
export const MESHPROVIDER = envStr('MESHPROVIDER', 'http://localhost:60557');
export const TX_DEFAULTS = { gas: 800000, gasPrice: 2 * 1000000000 };
export const ONE_SECOND_MS = 1000;
// tslint:disable-next-line:custom-no-magic-numbers
export const ONE_MINUTE_MS = ONE_SECOND_MS * 60;
// tslint:disable-next-line:custom-no-magic-numbers
export const TEN_MINUTES_MS = ONE_MINUTE_MS * 10;
export const UNLIMITED_ALLOWANCE_IN_BASE_UNITS = new BigNumber(2).pow(256).minus(1);
export const DECIMALS = 18;
export const StakeStatus = {
  Undelegated: 0,
  Delegated: 1,
};
export const NIL_POOL_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
export const NULL_BYTES = '0x';
export const ZERO = new BigNumber(0);

export const APIURL = envStr('APIURL', 'https://api.0x.org');
export const ORDERSIZETHRESHOLD = 0.051;
export const KEYSTORE = envStr('KEYSTORE', '');
export const PASSWORD = envStr('PASSWORD', '');

export const CONSTANTS = {
  ta: {
    atrPeriod: 14,
    smaPeriod: 50,
    stochRSI_d: 3,
    stochRSI_k: 3,
  },
};
