import React from 'react';
import { Divider } from 'semantic-ui-react';
import { ZrxContextProvider } from '../hooks/useZrx';
import { JoinPoolAsMaker } from '../components/staking/JoinPoolAsMaker';

export const Staking: React.FC<{}> = () => {
  return (
    <ZrxContextProvider>
      <Divider />
      <JoinPoolAsMaker />
      <Divider />
    </ZrxContextProvider>
  );
};
