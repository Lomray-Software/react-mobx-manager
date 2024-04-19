import type { FC, ReactElement } from 'react';
import React, { useContext, useEffect, useState } from 'react';
import { ROOT_CONTEXT_ID } from './constants';
import type Manager from './manager';
import type { TStores } from './types';

interface IStoreManagerProvider {
  storeManager: Manager;
  shouldInit?: boolean;
  fallback?: ReactElement;
  children?: React.ReactNode;
}

interface IStoreManagerParentProvider {
  parentId: string;
  children?: React.ReactNode;
  touchableStores?: TStores;
}

/**
 * Mobx store manager context
 */
const StoreManagerContext = React.createContext<Manager>({} as Manager);

/**
 * To spread relationships
 */
const StoreManagerParentContext =
  React.createContext<IStoreManagerParentProvider['parentId']>(ROOT_CONTEXT_ID);

/**
 * Mobx store manager parent provider
 * @constructor
 */
const StoreManagerParentProvider: FC<Omit<IStoreManagerParentProvider, 'contextId'>> = ({
  parentId,
  children,
  touchableStores,
}) => {
  const storeManager = useStoreManager();

  if (touchableStores) {
    storeManager.touchedStores(touchableStores);
  }

  return <StoreManagerParentContext.Provider value={parentId} children={children} />;
};

/**
 * Mobx store manager provider
 * @constructor
 */
const StoreManagerProvider: FC<IStoreManagerProvider> = ({
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
        console.error('Failed initialized store manager: ', e);
      });
  }, [shouldInit, storeManager]);

  return (
    <StoreManagerContext.Provider value={storeManager}>
      <StoreManagerParentProvider parentId="root">
        {isInit ? children : fallback || children}
      </StoreManagerParentProvider>
    </StoreManagerContext.Provider>
  );
};

const useStoreManager = (): Manager => useContext(StoreManagerContext);

const useStoreManagerParent = (): IStoreManagerParentProvider['parentId'] =>
  useContext(StoreManagerParentContext);

export {
  StoreManagerContext,
  StoreManagerParentContext,
  StoreManagerProvider,
  StoreManagerParentProvider,
  useStoreManager,
  useStoreManagerParent,
};
