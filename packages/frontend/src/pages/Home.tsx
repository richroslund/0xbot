import React, { useEffect, useState, useCallback } from 'react';
import { Grid, Container, Header, Divider, Button, Icon } from 'semantic-ui-react';
import { BestpricesProvider } from '../hooks/useBestPrice';
import { BestPrices } from '../components/BestPrice';
import { Web3Provider } from '../hooks/useWeb3';
import { RefreshBestprices } from '../components/RefreshBestprices';
import { ZrxContextProvider } from '../hooks/useZrx';
import { GasPrice } from '../components/GasPrice';
import { Quotes, Balances } from '../components/QuotesAndBalances';
import { PlaceOrder } from '../components/PlaceOrder';
import { ZrxInstant } from '../components/Instant';
import { AccountInfo } from '../components/AccountInfo';
import { WalletPicker } from '../components/WalletPicker';
import { WalletType } from '../types';

export const Home: React.FC<{}> = () => {
  return (
    <ZrxContextProvider>
      <BestpricesProvider>
        <Grid reversed="mobile" doubling columns={2}>
          <Grid.Row>
            <Grid.Column>
              <AccountInfo />
            </Grid.Column>
            <Grid.Column>
              <Balances intervalMs={5000} />
            </Grid.Column>
          </Grid.Row>
        </Grid>
        <Grid doubling columns={2}>
          <Grid.Row>
            <Grid.Column>
              <BestPrices />
            </Grid.Column>
            <Grid.Column>
              <Quotes intervalMs={5000} />
            </Grid.Column>
          </Grid.Row>
          <Grid.Row columns={1}>
            <PlaceOrder />
          </Grid.Row>
          <Grid.Row columns={1}>
            <ZrxInstant feePercentage={0.0025} />
            {/* <Button.Or />
        <Button primary onClick={showPlaceOrder}>{`Create`}</Button> */}
          </Grid.Row>
        </Grid>
        <Divider />
        <GasPrice intervalMs={10000} />
        <Divider />
        <RefreshBestprices />
      </BestpricesProvider>
    </ZrxContextProvider>
  );
};
