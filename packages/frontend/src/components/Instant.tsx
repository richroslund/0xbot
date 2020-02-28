import React, { useEffect, useState, useLayoutEffect } from 'react';
import { useSelector } from 'react-redux';
import { AppState } from '../state/state';
import { useWeb3 } from '../hooks/useWeb3';
import { ContractWrappers } from '@0x/contract-wrappers';
import { getAssets } from '@0x/lib';
import { Button } from 'semantic-ui-react';
export const ZrxInstant: React.FC<{ feePercentage: number }> = ({ feePercentage }) => {
  const [show, setShow] = useState(false);
  const address = useSelector((state: AppState) => state.address);
  const { contracts } = useWeb3();
  useLayoutEffect(() => {
    const setup = async (con: ContractWrappers, feeRecipient: string) => {
      const assets = await getAssets(con.contractAddresses);
      (window as any).zeroExInstant.render(
        {
          orderSource: 'https://api.0x.org/sra/',
          affiliateInfo: {
            feeRecipient,
            feePercentage,
          },
          defaultSelectedAssetData: assets.dai,
          onClose: () => {
            setShow(false);
          },
        },
        '#instant'
      );
    };
    if (address && contracts && show) {
      setup(contracts, address);
    }
  }, [address, contracts, feePercentage, show]);
  return (
    <Button fluid color="black" onClick={() => setShow(true)}>
      Instant
      <div id="instant"> </div>
    </Button>
  );
};
