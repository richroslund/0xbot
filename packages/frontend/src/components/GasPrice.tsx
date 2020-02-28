import React, { useCallback, useEffect, useRef } from 'react';
import { ButtonGroup, Button, Statistic, ButtonProps, StatisticProps, Segment, Header, Label, Icon } from 'semantic-ui-react';
import { useDispatch, useSelector } from 'react-redux';
import { actions, AppState } from '../state/state';
import { getGasPrices } from '../state/thunks';
import _ from 'lodash';

const GasPriceValue: React.FC<{ label: string } & StatisticProps> = ({ label, value, ...rest }) => {
  return <Statistic {...rest} label={label} value={value}></Statistic>;
};

export const GasPrice: React.FC<{ intervalMs: number }> = ({ intervalMs }) => {
  const timer = useRef<NodeJS.Timer>();
  const dispatch = useDispatch();
  useEffect(() => {
    const setup = async () => {
      dispatch(getGasPrices());
      timer.current = setInterval(() => {
        dispatch(getGasPrices());
      }, intervalMs);
    };
    setup();
    return () => {
      if (timer && timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [dispatch, intervalMs]);
  const setPrice = useCallback(
    (price?: number) => {
      if (price) {
        dispatch(actions.setGasPrice(price));
      } else {
        console.error('invalid gas value', price);
      }
    },
    [dispatch]
  );
  const { SafeGasPrice, ProposeGasPrice, currentIsFast, currentIsSafe } = useSelector((s: AppState) => {
    const prices = s.gas.prices ? s.gas.prices : { SafeGasPrice: undefined, ProposeGasPrice: undefined };

    return {
      ...prices,
      currentIsFast: s.gas.price === prices.ProposeGasPrice ? true : false,
      currentIsSafe: s.gas.price === prices.SafeGasPrice ? true : false,
      price: s.gas.price,
    };
  });
  return (
    <Segment>
      <Header as="h5">
        <Icon name="gulp" />
        Gas
      </Header>
      <Button onClick={() => setPrice(SafeGasPrice)}>
        <GasPriceValue active={currentIsSafe ? 'true' : 'false'} color={currentIsSafe ? 'blue' : 'grey'} label={'safe'} value={SafeGasPrice || '?'} />
      </Button>
      <Button onClick={() => setPrice(ProposeGasPrice)}>
        <GasPriceValue active={currentIsFast ? 'true' : 'false'} color={currentIsFast ? 'blue' : 'grey'} label={'fast'} value={ProposeGasPrice || '?'} />
      </Button>
    </Segment>
  );
};
