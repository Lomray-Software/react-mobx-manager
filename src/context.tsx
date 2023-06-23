import type { IConsistentSuspense } from '@lomray/consistent-suspense';
import { ConsistentSuspenseProvider } from '@lomray/consistent-suspense';
import type { FC, ReactElement } from 'react';
import React, { useContext, useEffect, useState } from 'react';
import type Manager from './manager';

interface IStoreManagerProvider {
  storeManager: Manager;
  shouldInit?: boolean;
  fallback?: ReactElement;
  children?: React.ReactNode;
  suspenseProvider?: Partial<IConsistentSuspense>;
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
const StoreManagerParentContext =
  React.createContext<IStoreManagerParentProvider['parentId']>('root');

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
  suspenseProvider = {},
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
    <ConsistentSuspenseProvider {...suspenseProvider}>
      <StoreManagerContext.Provider value={storeManager}>
        <StoreManagerParentProvider parentId="root">
          {isInit ? children : fallback || children}
        </StoreManagerParentProvider>
      </StoreManagerContext.Provider>
    </ConsistentSuspenseProvider>
  );
};

const useStoreManagerContext = (): Manager => useContext(StoreManagerContext);

const useStoreManagerParentContext = (): IStoreManagerParentProvider['parentId'] =>
  useContext(StoreManagerParentContext);

export {
  StoreManagerContext,
  StoreManagerParentContext,
  StoreManagerProvider,
  StoreManagerParentProvider,
  useStoreManagerContext,
  useStoreManagerParentContext,
};
