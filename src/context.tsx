import type { FC, ReactElement } from 'react';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import type Manager from './manager';

interface IStoreManagerProvider {
  storeManager: Manager;
  shouldInit?: boolean;
  fallback?: ReactElement;
  children?: React.ReactNode;
}

interface IStoreManagerParentProvider {
  children?: React.ReactNode;
  parentId: string;
}

/**
 * Mobx store manager context
 */
const StoreManagerContext = React.createContext<Manager>({} as Manager);

/**
 * To spread relationships
 */
const StoreManagerParentContext = React.createContext<IStoreManagerParentProvider>({
  parentId: 'root',
});

/**
 * Mobx store manager parent provider
 * @constructor
 */
const StoreManagerParentProvider: FC<Omit<IStoreManagerParentProvider, 'contextId'>> = ({
  children,
  parentId,
}) => {
  const value = useMemo(() => ({ parentId }), [parentId]);

  return <StoreManagerParentContext.Provider value={value} children={children} />;
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

const useStoreManagerContext = (): Manager => useContext(StoreManagerContext);

const useStoreManagerParentContext = (): Omit<IStoreManagerParentProvider, 'children'> =>
  useContext(StoreManagerParentContext);

export {
  StoreManagerProvider,
  StoreManagerContext,
  StoreManagerParentContext,
  useStoreManagerContext,
  StoreManagerParentProvider,
  useStoreManagerParentContext,
};
