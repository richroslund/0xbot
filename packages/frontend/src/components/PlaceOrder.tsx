import React, { useState, useCallback, useMemo } from 'react';
import { ButtonGroup, Button, Segment, Header, Icon, Form, Grid, InputOnChangeData, DropdownItemProps, Divider, List, Label, Item } from 'semantic-ui-react';
import _ from 'lodash';
import { useSelector } from 'react-redux';
import { AppState } from '../state/state';
import { KnownTokens } from '@0x/lib';
import { useZrx, CreateOrderRequest } from '../hooks/useZrx';
import { toNumberOrDef } from '../utilities';
import { OrderInfo } from './OrderInfo';

const handleChange = (setValue: (val: any) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
  setValue(event.target.value);
};
type ExpirationUnits = 'minute' | 'hour' | 'day';
const expireUnits: ExpirationUnits[] = ['minute', 'hour', 'day'];

export const PlaceOrder: React.FC<{}> = ({}) => {
  const [baseAsset, setBaseAsset] = useState<KnownTokens>('dai');
  const [quoteAsset, setQuoteAsset] = useState<KnownTokens>('weth');
  const [expiresAmount, setExpiresAmount] = useState(1);
  const [buy, setBuy] = useState<boolean>(true);
  const [expiresUnit, setExpiresUnit] = useState<ExpirationUnits>('hour');
  const [price, setOrderPrice] = useState<string | number>('');
  const [amount, setAmount] = useState<string>('');
  const { ask, bid, coinbase } = useSelector((s: AppState) => {
    const best = s.mesh.best;
    return {
      ask: best.ask ? best.ask.price : undefined,
      bid: best.bid ? best.bid.price : undefined,
      coinbase: s.ticker['ETH-USD'] ? s.ticker['ETH-USD'].price : undefined,
    };
  });

  const setPrice = useCallback(
    (value?: string | number) => {
      if (value) {
        setOrderPrice(value);
      }
    },
    [setOrderPrice]
  );

  const priceValue = useMemo(() => toNumberOrDef(price, undefined), [price]);
  const balances = useSelector((s: AppState) => (s.balances.balances ? s.balances.balances : undefined));
  const amounts = useMemo(() => {
    return _.reduce(
      [0.25, 0.5, 0.75, 1],
      (acc: { key: string; value: number | undefined }[], val: number): { key: string; value: number | undefined }[] => {
        const makerAsset = buy ? baseAsset : quoteAsset;
        const key = `${val * 100}%`;
        let value: number | undefined = undefined;
        if (balances && priceValue) {
          const makerAmount = balances[makerAsset] * val;
          value = buy ? _.round(makerAmount / priceValue, 4) : _.round(makerAmount, 4);
        }
        return _.union(acc, [
          {
            key,
            value,
          },
        ]);
      },
      {} as { key: string; value: number }[]
    );
  }, [balances, baseAsset, buy, priceValue, quoteAsset]);

  const decrementExpiresAmount = useCallback(() => setExpiresAmount(expiresAmount - 1), [expiresAmount]);
  const incrementExpiresAmount = useCallback(() => setExpiresAmount(expiresAmount + 1), [expiresAmount]);

  const { create } = useZrx();
  const createOrderRequest = useMemo(() => {
    const expirationBaseUnits = expiresUnit === 'minute' ? 60 : expiresUnit === 'hour' ? 60 * 60 : 60 * 60 * 24;
    const amt = toNumberOrDef(amount, undefined);
    const prc = toNumberOrDef(price, undefined);
    if (amt && prc) {
      const createOrderRequest: CreateOrderRequest = {
        expiresInSeconds: expiresAmount * expirationBaseUnits,
        makerToken: buy ? baseAsset : quoteAsset,
        takerToken: buy ? quoteAsset : baseAsset,
        makerAmount: buy ? amt * prc : amt,
        takerAmount: buy ? amt : amt * prc,
      };
      return createOrderRequest;
    }
  }, [amount, baseAsset, buy, expiresAmount, expiresUnit, price, quoteAsset]);

  const onCreateOrder = useCallback(() => {
    if (createOrderRequest) {
      create(createOrderRequest);
    }
  }, [create, createOrderRequest]);
  return (
    <Segment basic>
      <Header as="h3">Place order</Header>
      <Form>
        <ButtonGroup>
          <Button basic={!buy} positive active={buy} onClick={() => setBuy(true)}>
            Buy
          </Button>
          <Button negative basic={buy} active={!buy} onClick={() => setBuy(false)}>
            Sell
          </Button>
        </ButtonGroup>
        {'  '}
        <ButtonGroup>
          <Button content="Bid" disabled={ask === undefined} onClick={() => setPrice(bid)} />
          <Button content="Ask" disabled={ask === undefined} onClick={() => setPrice(ask)} />
          <Button content="Coinbase" disabled={ask === undefined} onClick={() => setPrice(coinbase)} />
        </ButtonGroup>
        <Form.Group>
          <Form.Input value={price} onChange={ev => setPrice(ev.target.value)} label="Price" placeholder="price" />

          <Form.Input value={amount} onChange={ev => setAmount(ev.target.value)} label="Amount" placeholder="amount" />

          {_.map(amounts, v => {
            return (
              <Button labelPosition="right" onClick={() => setAmount(v.value ? v.value.toString() : '0')}>
                <Button>{v.key}</Button>
                {/* {v.value && (
                  <Label as="a" basic pointing="left">
                    {v.value}
                  </Label>
                )} */}
              </Button>
            );
          })}
          {/* <Button onClick={() => setAmountPercentage(0.25)}>25%</Button> */}
        </Form.Group>

        <Item>
          <Item.Header>Expires</Item.Header>
          <Item.Content>
            <Form.Group inline>
              <Form.Input placeholder="expires" name="expiresAmount" value={expiresAmount} onChange={ev => handleChange(setExpiresAmount)(ev)} />
              <ButtonGroup inline vertical>
                <Button content="+" onClick={incrementExpiresAmount} />
                <Button content="-" onClick={decrementExpiresAmount} />
              </ButtonGroup>
            </Form.Group>
            <ButtonGroup>
              {_.map(expireUnits, u => (
                <Button key={u} active={expiresUnit === u} grey={expiresUnit === u ? 'true' : 'false'} onClick={() => setExpiresUnit(u)}>
                  {u}
                </Button>
              ))}
            </ButtonGroup>
          </Item.Content>
        </Item>

        <Divider />
      </Form>
      {createOrderRequest && (
        <Segment>
          <Label color="red">
            {createOrderRequest.makerAmount} {createOrderRequest.makerToken}
          </Label>
          <Label color="green">
            {createOrderRequest.takerAmount} {createOrderRequest.takerToken}
          </Label>
        </Segment>
      )}
      <OrderInfo />
      <Button primary content="Create" onClick={onCreateOrder} />
    </Segment>
  );
};
