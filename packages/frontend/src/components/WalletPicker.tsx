import React, { useMemo, useCallback } from 'react';
import { InputProps, Input, ButtonGroup, Button, SegmentGroup, Segment, Dropdown } from 'semantic-ui-react';

const walletOptions = [
  {
    key: 'web3',
    text: 'Web3',
    value: 'web3',
    image: { avatar: true, src: '/images/avatar/small/jenny.jpg' },
  },
  {
    key: 'walletconnect',
    text: 'Wallet Connect',
    value: 'walletconnect',
    image: { avatar: true, src: '/images/avatar/small/elliot.jpg' },
  },
];

export const WalletPicker: React.FC<{ onChange: (value: any) => void }> = ({ onChange, ...props }) => {
  return (
    <>
      <Dropdown placeholder="Select wallet" fluid selection onChange={(e, { name, value }) => onChange(value)} options={walletOptions} />
    </>
  );
};
