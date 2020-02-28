import React, { useMemo, useCallback } from 'react';
import { InputProps, Input, ButtonGroup, Button, SegmentGroup, Segment } from 'semantic-ui-react';

export const NumberInput: React.FC<InputProps & { increment: () => void; decrement: () => void; max: () => void }> = ({ increment, decrement, max, ...props }) => {
  return (
    <>
      <Input size={'mini'} {...props}>
        <input />
        <ButtonGroup compact>
          <Button content="-" onClick={decrement} />
          <Button content="+" onClick={increment} />
          <Button content="max" onClick={max} />
        </ButtonGroup>
      </Input>
    </>
  );
};
