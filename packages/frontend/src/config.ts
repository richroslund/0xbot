import _ from 'lodash';

const windowConfig = _.get(window, '_env_', {});
const getConfigVal = (key: string, defaultValue: string) => _.get(windowConfig, key, undefined) || _.get(process.env, `${key}`, undefined) || defaultValue;
export const Config = {
  RPCPROVIDER: getConfigVal('REACT_APP_RPCPROVIDER', 'https://mainnet.infura.io/'),
  CHAINID: parseInt(getConfigVal('REACT_APP_CHAINID', '1')),
  INFURAKEY: getConfigVal('REACT_APP_INFURA_KEY', 'UNKNOWN'),
  ETHERSCANKEY: parseInt(getConfigVal('REACT_APP_ETHERSCANKEY', '1')),
};
