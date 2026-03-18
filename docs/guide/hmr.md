# HMR

## Dev-only HMR bridge

The package ships a dev extension bridge in:

```ts
@lomray/react-mobx-manager/plugins/dev-extension/hmr
```

It restores store state by `libStoreId` and destroys the previous manager on HMR dispose.

This is best-effort support:

- if `libStoreId` stays stable, state is restored
- if store id changes, restore is skipped for that store

## Vite

```ts
import { Manager } from '@lomray/react-mobx-manager';
import { connectViteHmr } from '@lomray/react-mobx-manager/plugins/dev-extension/hmr';

const storeManager = new Manager();

if (import.meta.env.DEV) {
  connectViteHmr(storeManager, import.meta.hot, { appId: 'app' });
}
```

## Webpack

```ts
import { Manager } from '@lomray/react-mobx-manager';
import { connectWebpackHmr } from '@lomray/react-mobx-manager/plugins/dev-extension/hmr';

const storeManager = new Manager();

if (process.env.NODE_ENV === 'development' && module.hot) {
  connectWebpackHmr(storeManager, module.hot, { appId: 'app' });
}
```

## React Native

```ts
import { Manager } from '@lomray/react-mobx-manager';
import { connectReactNativeHmr } from '@lomray/react-mobx-manager/plugins/dev-extension/hmr';

const storeManager = new Manager();

if (__DEV__) {
  connectReactNativeHmr(storeManager, undefined, { appId: 'app' });
}
```

## Notes

- Relative stores usually restore correctly while their ids stay stable.
- Global stores restore especially well because their ids are naturally stable.
- HMR support is not a guarantee of instance identity reuse. It restores state, not old object instances.
