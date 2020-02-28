import React, { useRef, useEffect } from 'react';
import { Item, List } from 'semantic-ui-react';
import { useSelector } from 'react-redux';
import { AppState } from '../state/state';

export const OrderInfo: React.FC = () => {
  const { error, success } = useSelector((s: AppState) => s.orders);
  return (
    <Item>
      <Item.Header>Order info</Item.Header>
      <Item.Content>
        <List>{success && <>Success: {success}</>}</List>
        <List>{error && <>Error: {error}</>}</List>
      </Item.Content>
    </Item>
  );
};
