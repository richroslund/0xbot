import React, { useMemo, useCallback, useState } from 'react';
import { useBestprices } from '../hooks/useBestPrice';
import { OrderCard, OrderInfoProps } from './OrderCard';
import { Button, Icon, Item, List, ListItem, Statistic, Card, Segment, Grid } from 'semantic-ui-react';
import { MeshBestPriceState, AppState } from '../state/state';
import { useSelector } from 'react-redux';
import { orderToValues } from '../utilities';
import { useZrx } from '../hooks/useZrx';
import { NumberInput } from './NumberInput';
import { useNumberValue } from '../hooks/useNumberValue';
import _ from 'lodash';
export type BestPriceProps = Pick<OrderInfoProps, 'label'>;
export const BestPrices: React.FC<BestPriceProps> = ({ ...rest }) => {
  const { bid, ask, address } = useSelector((s: AppState) => ({ bid: s.mesh.best.bid, ask: s.mesh.best.ask, address: s.address }));
  // const [buyAmount, setBuyAmount, incrementBuy, decrementBuy, setBuyMax, buyValue] = useNumberValue(0.01, ask?.amt);

  // const buy = useCallback(() => (address && bid?.signedOrder && buyValue ? fill(address, bid?.signedOrder, buyValue) : console.log('address or bid is null')), [address, bid, fill, buyValue]);
  const bidValues = bid ? orderToValues(bid) : undefined;
  const askValues = ask ? orderToValues(ask) : undefined;

  return (
    <>
      <Segment>
        <Grid columns={2} stackable textAlign="center">
          <Grid.Row verticalAlign="middle">
            <Grid.Column>{bid && bidValues && <OrderCard priceAsset={'weth'} actionLabel="Fill" order={bid} {...rest} changed={bid.changed} price={bidValues.price} amount={bidValues.amount} expires={bidValues.expires.toDate()} makerAddress={bidValues.maker} />}</Grid.Column>

            <Grid.Column>
              {ask && askValues && (
                <>
                  <OrderCard priceAsset={'weth'} actionLabel="Fill" order={ask} {...rest} changed={ask.changed} price={askValues.price} amount={askValues.amount} expires={askValues.expires.toDate()} makerAddress={askValues.maker} />

                  {/* <Item>
                    <Item.Content>
                      <NumberInput max={setBuyMax} placeholder={'amount'} value={buyAmount} onChange={ev => setBuyAmount(ev.target.value)} increment={incrementBuy} decrement={decrementBuy} />
                      <Item.Extra>
                        <Button positive onClick={buy}>{`Buy`}</Button>
                        {buyValue && <>= {_.round(buyValue * ask.price, 3)} dai</>}
                      </Item.Extra>
                    </Item.Content>
                  </Item> */}
                </>
              )}
            </Grid.Column>
          </Grid.Row>
        </Grid>
      </Segment>
    </>
  );
};
