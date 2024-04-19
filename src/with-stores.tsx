import { useConsistentSuspense, useId } from '@lomray/consistent-suspense';
import hoistNonReactStatics from 'hoist-non-react-statics';
import { observer } from 'mobx-react-lite';
import type { FC } from 'react';
import React, { useEffect, useState } from 'react';
import { useStoreManager, useStoreManagerParent, StoreManagerParentProvider } from './context';
import type { TMapStores, IWithStoreOptions } from './types';

/**
 * Make component observable and pass stores as props
 */
const withStores = <T extends Record<string, any>, TS extends TMapStores>(
  Component: FC<T>,
  stores: TS,
  { customContextId }: IWithStoreOptions = {},
): FC<Omit<T, keyof TS>> => {
  const ObservableComponent = observer(Component) as FC;
  const manualContextId = customContextId || (Component['libStoreContextId'] as string);
  const componentName = Component.displayName || Component.name;

  const Element: FC<Omit<T, keyof TS>> = (props) => {
    const storeManager = useStoreManager();
    const parentId = useStoreManagerParent();
    const { suspenseId } = useConsistentSuspense();
    const id = useId();
    const [{ contextId, componentStores, touchableStores, mountStores }] = useState(() => {
      const ctxId = manualContextId || id;
      const groupedStores = storeManager.createStores(
        Object.entries(stores),
        parentId,
        ctxId,
        suspenseId,
        componentName,
        props,
      );
      const { globalStores, relativeStores, parentStores } = groupedStores;
      const tStores = { ...relativeStores, ...globalStores };

      return {
        touchableStores: tStores,
        componentStores: { ...tStores, ...parentStores },
        contextId: ctxId,
        mountStores: () => storeManager.mountStores(ctxId, groupedStores),
      };
    });

    useEffect(mountStores, [mountStores]);

    return (
      <StoreManagerParentProvider parentId={contextId} touchableStores={touchableStores}>
        <ObservableComponent {...props} {...componentStores} />
      </StoreManagerParentProvider>
    );
  };

  hoistNonReactStatics(Element, Component);
  Element.displayName = `Mobx(${componentName})`;

  return Object.defineProperty(Element, 'name', {
    value: Element.displayName,
    writable: false,
    enumerable: false,
  });
};

export default withStores;
