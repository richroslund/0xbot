import React, { useState, useCallback } from 'react';
import { Button } from 'semantic-ui-react';
import { useZrx } from '../../hooks/useZrx';
import { withChange } from '../../state/state';
import { PopulatedSignedZrxOrders } from '@0x/lib';
import _ from 'lodash';
export const FillOrder: React.FC<{ label: string; address: string; order: withChange<PopulatedSignedZrxOrders>; sellValue: number | undefined }> = ({ label, order, address, sellValue }) => {
  const { fill } = useZrx();
  const take = useCallback(() => (address && order?.signedOrder && sellValue ? fill(address, order?.signedOrder, sellValue) : console.log('address or bid is null')), [address, fill, order, sellValue]);
  return (
    <>
      <Button primary onClick={take}>
        {label}
      </Button>{' '}
      {!_.isNaN(sellValue) && !_.isNil(sellValue) && <>= {_.round(sellValue * order.price, 3)} dai</>}
    </>
  );
};
