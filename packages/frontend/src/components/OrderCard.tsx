import React, { useCallback } from 'react';
import { Card, Item, Statistic, Label, Segment, Button } from 'semantic-ui-react';
import _, { fill } from 'lodash';
import { rnd, fromNow, PopulatedSignedZrxOrders, KnownTokens } from '@0x/lib';
import { Ticker } from './QuotesAndBalances';
import { useSelector } from 'react-redux';
import { AppState, withChange } from '../state/state';
import { NumberInput } from './NumberInput';
import { useNumberValue } from '../hooks/useNumberValue';
import { useZrx } from '../hooks/useZrx';
import { FillOrder } from './orders/FillOrder';

export interface OrderInfoProps {
  order: withChange<PopulatedSignedZrxOrders>;
  label?: string;
  price: number;
  amount: number;
  expires: Date;
  makerAddress: string;
  changed?: number;
  actionLabel: string;
  priceAsset: KnownTokens;
}

export const OrderCard: React.FC<OrderInfoProps> = ({ price, changed, amount, expires, makerAddress, order, actionLabel, priceAsset }) => {
  const address = useSelector((s: AppState) => s.address);
  const amt = rnd(amount);
  const prc = `$${_.round(price, 2)}`;
  const exp = `expires ${fromNow(expires)}`;
  const color = changed ? (changed > 0 ? 'green' : 'red') : 'black';
  const balances = useSelector((s: AppState) => (s.balances.balances ? s.balances.balances : undefined));
  const max = _([balances ? balances[priceAsset] : undefined, order?.amt])
    .filter(v => v !== undefined)
    .min();
  const [sellAmount, setSellAmt, incrementSell, decrementSell, sellMax, sellValue] = useNumberValue(0.01, max);

  return (
    <>
      <Item>
        <Item.Content>
          <Statistic color={color} size="mini" horizontal label={`x ${amt}`} value={prc} />
        </Item.Content>

        <Item.Meta>
          {exp} {address === makerAddress && <Label color="purple">you</Label>}
        </Item.Meta>
      </Item>
      <Item>
        <Item.Content>
          <NumberInput max={sellMax} placeholder={'amount'} value={sellAmount} onChange={ev => setSellAmt(ev.target.value)} increment={incrementSell} decrement={decrementSell} />
          <Item.Extra>{address && <FillOrder label={actionLabel} order={order} address={address} sellValue={sellValue} />}</Item.Extra>
        </Item.Content>
      </Item>
    </>
  );
};
