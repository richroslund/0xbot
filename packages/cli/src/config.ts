import { envStr } from '@0x/lib';

export const APIURL = envStr('APIURL', 'https://api.0x.org');
export const ORDERSIZETHRESHOLD = 0.001;
export const KEYSTORE = envStr('KEYSTORE', '');
export const PASSWORD = envStr('PASSWORD', '');
