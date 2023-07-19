import { withStores } from '@lomray/react-mobx-manager';
import type { FC } from 'react';
import React, { useEffect } from 'react';
import type { StoreProps } from './index.stores';
import stores from './index.stores';

/**
 * ExtraInfo (children) component
 * Demonstrate working with store in children component
 * @constructor
 */
const ExtraInfo: FC<StoreProps> = ({ extraInfoStore: { phone, getExtraInfo } }) => {
  useEffect(() => {
    void getExtraInfo();
  }, [getExtraInfo]);

  return <span>{phone || '...'}</span>;
};

const ExtraInfoWrapper = withStores(ExtraInfo, stores);

export default ExtraInfoWrapper;
