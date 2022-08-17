import type { FC } from 'react';
import React, { useEffect } from 'react';
import type { StoreProps } from './index.stores';

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

export default ExtraInfo;
