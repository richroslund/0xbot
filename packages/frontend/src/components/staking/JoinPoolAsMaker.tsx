import React, { useCallback, useState, useMemo } from 'react';
import { Item, Form, FormProps } from 'semantic-ui-react';
import { useZrx } from '../../hooks/useZrx';
import { StakingUtilities } from '@0x/lib';
import _ from 'lodash';
export const JoinPoolAsMaker: React.FC<{}> = () => {
  const { staking } = useZrx();
  const [poolId, setPoolId] = useState('');
  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>, data: FormProps) => {
      const poolIdHex = StakingUtilities.encodePoolId(parseFloat(poolId));
      staking.joinAsMaker(poolIdHex);
    },
    [staking, poolId]
  );
  const hexValue = useMemo(() => {
    const intVal = parseFloat(poolId);
    if (_.isNaN(intVal)) {
      return '';
    } else {
      return StakingUtilities.encodePoolId(parseFloat(poolId));
    }
  }, [poolId]);
  return (
    <Item>
      <Item.Header>Join pool as maker</Item.Header>
      <Form onSubmit={onSubmit}>
        <Form.Group widths="equal">
          <Form.Input label="PoolId" placeholder="poolid" name="poolid" value={poolId} onChange={ev => setPoolId(ev.target.value)} />
          {hexValue}
        </Form.Group>

        <Form.Button>Submit</Form.Button>
      </Form>
    </Item>
  );
};
