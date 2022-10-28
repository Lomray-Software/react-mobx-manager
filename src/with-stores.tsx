import hoistNonReactStatics from 'hoist-non-react-statics';
import { observer } from 'mobx-react-lite';
import type { FC } from 'react';
import React, { useEffect, useState } from 'react';
import {
  useStoreManagerContext,
  useStoreManagerParentContext,
  StoreManagerParentProvider,
} from './context';
import type { TMapStores } from './types';

/**
 * Make component observable and pass stores as props
 */
const withStores = <T extends Record<string, any>, TS extends TMapStores>(
  Component: FC<T>,
  stores: TS,
  customContextId?: string,
): FC<Omit<T, keyof TS>> => {
  const ObservableComponent = observer(Component) as FC;
  const manualContextId = customContextId || (Component['contextId'] as string);
  const componentName = Component.displayName || Component.name;

  const Element: FC<Omit<T, keyof TS>> = ({ ...props }) => {
    const storeManager = useStoreManagerContext();
    const { parentId } = useStoreManagerParentContext();
    const id = React.useId?.();
    const [{ contextId, initStores }] = useState(() => {
      const ctxId = storeManager.createContextId(manualContextId || id);
      const initS = storeManager.createStores(
        Object.entries(stores),
        parentId,
        ctxId,
        componentName,
      );

      return { contextId: ctxId, initStores: initS };
    });

    /**
     * - Check if store has 'onMount' (call if exist)
     * - Check if store has 'onDestroy' method (call if exist)
     */
    useEffect(() => storeManager.mountStores(initStores), [initStores, storeManager]);

    return (
      <StoreManagerParentProvider parentId={contextId}>
        <ObservableComponent {...initStores} {...props} />
      </StoreManagerParentProvider>
    );
  };

  hoistNonReactStatics(Element, Component);
  Element.displayName = `Mobx(${componentName})`;

  return Element;
};

export default withStores;
