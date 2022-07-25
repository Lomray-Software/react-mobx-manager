import hoistNonReactStatics from 'hoist-non-react-statics';
import { observer } from 'mobx-react-lite';
import type { FC } from 'react';
import React, { useEffect, useState } from 'react';
import { useStoreManagerContext } from './context';
import type { TMapStores } from './types';

/**
 * Make component observable and pass stores as props
 */
const withStores = <T extends Record<string, any>, TS extends TMapStores>(
  Component: FC<T>,
  stores: TS,
): FC<Omit<T, keyof TS>> => {
  const storesMap = Object.entries(stores);
  const ObservableComponent = observer(Component) as FC;
  const componentName = Component.displayName || Component.name;

  const Element: FC<Omit<T, keyof TS>> = ({ ...props }) => {
    const storeManager = useStoreManagerContext();
    const [initStores] = useState(() => storeManager.createStores(storesMap));

    /**
     * - Check if store has 'onMount' (call if exist)
     * - Check if store has 'onDestroy' method (call if exist)
     */
    useEffect(() => storeManager.mountStores(initStores), [initStores, storeManager]);

    return <ObservableComponent {...initStores} {...props} />;
  };

  hoistNonReactStatics(Element, Component);
  Element.displayName = `Mobx(${componentName})`;

  return Element;
};

export default withStores;
