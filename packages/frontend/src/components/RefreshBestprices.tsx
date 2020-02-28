import React from 'react';
import { useBestprices } from '../hooks/useBestPrice';
import { Button, Icon, Item } from 'semantic-ui-react';
export const RefreshBestprices: React.FC<{}> = ({}) => {
  const { fetch } = useBestprices();
  return (
    <>
      <Button fluid attached="bottom" primary onClick={() => fetch()} size="massive" icon="refresh"></Button>
    </>
  );
};
