import type { FC, ReactElement } from 'react';
import React, { useContext, useEffect, useState } from 'react';
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

interface IStoreManagerSuspenseProvider {
  children?: React.ReactNode;
  id: string | null;
}

/**
 * Mobx store manager context
 */
const StoreManagerContext = React.createContext<Manager>({} as Manager);

/**
 * To spread relationships
 */
const StoreManagerParentContext =
  React.createContext<IStoreManagerParentProvider['parentId']>('root');

/**
 * Generate id for suspended component stores
 */
const StoreManagerSuspenseContext = React.createContext<IStoreManagerSuspenseProvider['id']>(null);

/**
 * Mobx store manager parent provider
 * @constructor
 */
const StoreManagerSuspenseProvider: FC<IStoreManagerSuspenseProvider> = ({ children, id }) => (
  <StoreManagerSuspenseContext.Provider value={id} children={children} />
);

/**
 * Mobx store manager parent provider
 * @constructor
 */
const StoreManagerParentProvider: FC<Omit<IStoreManagerParentProvider, 'contextId'>> = ({
  children,
  parentId,
}) => <StoreManagerParentContext.Provider value={parentId} children={children} />;

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

const useStoreManagerParentContext = (): IStoreManagerParentProvider['parentId'] =>
  useContext(StoreManagerParentContext);

const useStoreManagerSuspenseContext = (): IStoreManagerSuspenseProvider['id'] =>
  useContext(StoreManagerSuspenseContext);

export {
  StoreManagerContext,
  StoreManagerParentContext,
  StoreManagerSuspenseContext,
  StoreManagerProvider,
  StoreManagerParentProvider,
  StoreManagerSuspenseProvider,
  useStoreManagerContext,
  useStoreManagerParentContext,
  useStoreManagerSuspenseContext,
};
