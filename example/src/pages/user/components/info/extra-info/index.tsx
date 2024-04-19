import { type StoresType, withStores } from "@lomray/react-mobx-manager";
import type { FC } from 'react';
import React, { useEffect } from 'react';
import ExtraInfoStore from './stores/main';

const stores = {
  extraInfoStore: ExtraInfoStore,
};

/**
 * ExtraInfo (children) component
 * Demonstrate working with store in children component
 * @constructor
 */
const ExtraInfo: FC<StoresType<typeof stores>> = ({ extraInfoStore: { phone, getExtraInfo } }) => {
  useEffect(() => {
    void getExtraInfo();
  }, [getExtraInfo]);

  return <span>{phone || '...'}</span>;
};

const ExtraInfoWrapper = withStores(ExtraInfo, stores);

export default ExtraInfoWrapper;
