import type { ReactElement } from 'react';
import React, { useContext, useEffect, useState } from 'react';
import type { FCC } from '@interfaces/fc-with-children';
import type Manager from './manager';

interface IStoreManagerProvider {
  storeManager: Manager;
  shouldInit?: boolean;
  fallback?: ReactElement;
}

/**
 * Mobx store manager context
 */
const StoreManagerContext = React.createContext<Manager>({} as Manager);

/**
 * Mobx store manager provider
 * @constructor
 */
const StoreManagerProvider: FCC<IStoreManagerProvider> = ({
  children,
  storeManager,
  fallback,
  shouldInit = false,
}) => {
  const [isInit, setInit] = useState(!shouldInit);

  useEffect(() => {
    if (!shouldInit) {
      return;
    }

    storeManager
      .init()
      .then(() => setInit(true))
      .catch((e: Error) => {
        console.error('Failed initiated store manager: ', e);
      });
  }, [shouldInit, storeManager]);

  return (
    <StoreManagerContext.Provider
      value={storeManager}
      children={isInit ? children : fallback || children}
    />
  );
};

const useStoreManagerContext = (): Manager => useContext(StoreManagerContext);

export { StoreManagerProvider, StoreManagerContext, useStoreManagerContext };
