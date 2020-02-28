import { useState, useCallback, useMemo } from 'react';
import { toNumberOrDef } from '../utilities';
import _ from 'lodash';

export const useNumberValue = (incrementAmount = 1, max = 0): [string | number, React.Dispatch<React.SetStateAction<string | number>>, () => void, () => void, () => void, number | undefined] => {
  const [value, setValue] = useState<string | number>('');

  const numValue = useMemo(() => toNumberOrDef(value, undefined), [value]);
  const increment = useCallback(() => setValue(_.isNumber(numValue) ? _.round(numValue + incrementAmount, 3) : 0), [incrementAmount, numValue]);
  const decrement = useCallback(() => setValue(_.isNumber(numValue) ? _.round(numValue - incrementAmount, 3) : 0), [incrementAmount, numValue]);
  const setMax = useCallback(() => setValue(max), [setValue, max]);
  return [value, setValue, increment, decrement, setMax, numValue];
};
