import React, { useRef, useEffect } from 'react';
import { Item, List } from 'semantic-ui-react';
import { useSelector } from 'react-redux';
import { AppState } from '../state/state';
export const AccountInfo: React.FC = () => {
  const addresses = useSelector((s: AppState) => s.addresses);
  return (
    <Item>
      <Item.Header>Addresses</Item.Header>
      <Item.Content>
        <List>
          {addresses.map(a => (
            <List.Item>{a}</List.Item>
          ))}
        </List>
      </Item.Content>
    </Item>
  );
};
