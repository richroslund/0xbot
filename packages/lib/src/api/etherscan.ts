import { ETHERSCANKEY } from './../config';
import { EtherscanGasOracleResponse } from './../types';
import axios, { AxiosError } from 'axios';
export class EtherscanApi {
  public getGasPrices = async () => {
    return await axios.get<EtherscanGasOracleResponse>(`https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${ETHERSCANKEY}`).catch((err: AxiosError<any>) => {
      console.log('request gas price error', err.code, err.response?.data);
      return undefined;
    });
  };
}
