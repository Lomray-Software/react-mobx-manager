# Getting Started

## Install

```bash
npm i @lomray/react-mobx-manager @lomray/consistent-suspense
```

`@lomray/consistent-suspense` is used to generate stable ids inside Suspense boundaries.

## Choose store id strategy

Store ids are required for stable store identity.

If you do not want to manually assign an id to every store, use one of the automatic strategies:

1. Keep class names and function names in your bundler.
2. Define static `id` on stores manually.
3. Use the Vite plugin from this package.

Recommended:

- use `keep_classnames` / `keep_fnames` when possible
- use the Vite plugin if you are on Vite and want the smoothest setup
- use manual ids only if you want to control ids explicitly store by store

### Keep class names

Good default if you want to avoid manual ids.

```js
terserOptions.keep_classnames = true;
terserOptions.keep_fnames = true;
```

React Native:

```js
module.exports = {
  transformer: {
    minifierConfig: {
      keep_classnames: true,
      keep_fnames: true,
    },
  },
};
```

### Manual id

Choose this only if you want to explicitly manage ids yourself.

```ts
class UserStore {
  static id = 'user';
}
```

### Vite plugin

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import MobxManager from '@lomray/react-mobx-manager/plugins/vite/index';

export default defineConfig({
  plugins: [react(), MobxManager()],
});
```

If you use Vite, this is the recommended option.

## Create a manager

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConsistentSuspenseProvider } from '@lomray/consistent-suspense';
import { Manager, StoreManagerProvider } from '@lomray/react-mobx-manager';
import App from './app';
import MyApiClient from './services/my-api-client';

const apiClient = new MyApiClient();
const storeManager = new Manager({
  storesParams: { apiClient },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ConsistentSuspenseProvider>
      <StoreManagerProvider storeManager={storeManager} shouldInit>
        <App />
      </StoreManagerProvider>
    </ConsistentSuspenseProvider>
  </React.StrictMode>,
);
```

## Connect stores to a component

Global store example:

```tsx
import { withStores, Manager } from '@lomray/react-mobx-manager';
import { makeObservable, observable, action } from 'mobx';
import type { IConstructorParams, StoresType } from '@lomray/react-mobx-manager';

class UserStore {
  static id = 'user';
  static isGlobal = true;

  public name = 'Matthew';
  private apiClient: MyApiClient;

  constructor({ getStore, apiClient }: IConstructorParams) {
    this.apiClient = apiClient;
    // this.otherStore = getStore(SomeOtherStore);

    makeObservable(this, {
      name: observable,
      setName: action,
    });
  }

  public setName = (name: string): void => {
    this.name = name;
  };
}

const stores = {
  userStore: UserStore,
};

type TProps = StoresType<typeof stores>;

const User = ({ userStore: { name } }: TProps) => {
  return <div>{name}</div>;
};

export default withStores(User, stores);
```

Relative store example:

```tsx
import { withStores } from '@lomray/react-mobx-manager';
import { makeObservable, observable, action } from 'mobx';

class SomeOtherStore {
  public value = '';

  constructor() {
    makeObservable(this, {
      value: observable,
      setValue: action,
    });
  }

  public setValue = (value: string): void => {
    this.value = value;
  };
}

const stores = {
  someOtherStore: SomeOtherStore,
};

const SomeComponent = ({ someOtherStore: { value, setValue } }) => {
  return <button onClick={() => setValue('next')}>{value}</button>;
};

export default withStores(SomeComponent, stores);
```

## Parent lookup helper

Prefer `parentStore(Store)` over inline config for better DX:

```ts
import { parentStore } from '@lomray/react-mobx-manager';

const stores = {
  someOtherStore: parentStore(SomeOtherStore),
  userStore: UserStore,
};
```

Use this when a child component should reuse a relative store created in an ancestor component.

## Useful links

- [Vite template example](https://github.com/Lomray-Software/vite-template)
