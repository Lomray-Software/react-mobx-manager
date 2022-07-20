import hoistNonReactStatics from 'hoist-non-react-statics';
import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';
import type { FCC } from '@interfaces/fc-with-children';
import { useStoreManagerContext } from './context';
import type { TMapStores } from './types';

/**
 * Make component observable and pass stores as props
 */
const withStores = <T extends Record<string, any>, TS extends TMapStores>(
  Component: FCC<T>,
  stores: TS,
): FCC<Omit<T, keyof TS>> => {
  const storesMap = Object.entries(stores);
  const ObservableComponent = observer(Component) as FCC;
  const componentName = Component.displayName || Component.name;

  const Element: FCC<Omit<T, keyof TS>> = React.memo(({ children, ...props }) => {
    const storeManager = useStoreManagerContext();
    const [initStores] = useState(() => storeManager.createStores(storesMap));

    /**
     * - Check if store has 'onMount' (call if exist)
     * - Check if store has 'onDestroy' method (call if exist)
     */
    useEffect(() => storeManager.mountStores(initStores), [initStores, storeManager]);

    return <ObservableComponent children={children} {...initStores} {...props} />;
  });

  hoistNonReactStatics(Element, Component);
  Element.displayName = `Mobx(${componentName})`;

  return Element;
};

export default withStores;
