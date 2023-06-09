<p align="center">
    <img  src="https://user-images.githubusercontent.com/95251720/180519123-eb8a36e7-e7af-41f2-9a01-ae6d6b6a94f3.svg" alt="Bootstrap logo" width="200" height="165">
</p>

<h1 align='center'>Mobx stores manager for React</h1>

- One way to escape state tree 🌲🌳🌴.
- Manage your Mobx stores like a boss - debug like a hacker.
- Simple idea - simple implementation.
- Small package size.
- Support render to stream.
- Support code splitting out of the box.
- Access stores from other stores.
- Can be a replacement for react context.
- And many other nice things 😎

<p align="center">
  <img src="https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=reliability_rating" alt="reliability">
  <img src="https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=security_rating" alt="Security Rating">
  <img src="https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=sqale_rating" alt="Maintainability Rating">
  <img src="https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=vulnerabilities" alt="Vulnerabilities">
  <img src="https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=bugs" alt="Bugs">
  <img src="https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=ncloc" alt="Lines of Code">
  <img src="https://img.shields.io/bundlephobia/minzip/@lomray/react-mobx-manager" alt="size">
  <img src="https://img.shields.io/npm/l/@lomray/react-mobx-manager" alt="size">
  <img src="https://img.shields.io/npm/v/@lomray/react-mobx-manager?label=semantic%20release&logo=semantic-release" alt="semantic version">
  <img src="https://app.fossa.com/api/projects/git%2Bgithub.com%2FLomray-Software%2Freact-mobx-manager.svg?type=small" alt="FOSSA Status">
</p>

## Table of contents

- [Getting started](#getting-started)
- [Usage](#usage)
- [Support SSR](#support-ssr)
- [Important Tips](#important-tips)
- [Documentation](#documentation)
  - [Manager](#manager)
  - [withStores](#withstores)
  - [StoreManagerProvider](#storemanagerprovider)
  - [useStoreManagerContext](#usestoremanagercontext)
  - [useStoreManagerParentContext](#usestoremanagerparentcontext)
  - [Store](#store)
- [React Native Debug Plugin](#react-native-debug-plugin)
- [Bugs and feature requests](#bugs-and-feature-requests)
- [License](#license)

## Getting started

The React-mobx-manager package is distributed using [npm](https://www.npmjs.com/), the node package manager.

```
npm i --save @lomray/react-mobx-manager
```

**Optional:** Configure your bundler to keep classnames and function names in production OR use `id` for each store:

- **React:** (craco or webpack config, terser options)
```bash
terserOptions.keep_classnames = true;
terserOptions.keep_fnames = true;
```

- **React Native:** (metro bundler config)
```
transformer: {
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: true,
  },
}
```

## Usage

Import `Manager, StoreManagerProvider` from `@lomray/react-mobx-manager` into your index file and wrap `<App/>` with `<StoreManagerProvider/>`

```typescript jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { Manager, StoreManagerProvider, MobxLocalStorage } from '@lomray/react-mobx-manager';
import App from './app';
import MyApiClient from './services/my-api-client';

const apiClient = new MyApiClient();
const storeManager = new Manager({
  storage: new MobxLocalStorage(), // optional: needs for persisting stores
  storesParams: { apiClient }, // optional: we can provide our api client for access from the store
});

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <StoreManagerProvider storeManager={storeManager} shouldInit>
      <App />
    </StoreManagerProvider>
  </React.StrictMode>,
);
```

Connect mobx store to the manager, and you're good to go!

```typescript
import { withStores, Manager } from '@lomray/react-mobx-manager';
import { makeObservable, observable, action } from 'mobx';
import type { IConstructorParams, ClassReturnType } from '@lomray/react-mobx-manager';

/**
 * Mobx user store
 *
 * Usually store like that are related to the global store,
 * because they store information about the current user,
 * which may be needed in different places of the application.
 * 
 * You may also want to save the state of the store, for example, 
 * to local storage, so that it can be restored after page reload,
 * in this case, just export wrap export with 'persist':
 * export default Manager.persistStore(UserStore, 'user');
 */
class UserStore {
  /**
   * Required only if we don't configure our bundler to keep classnames and function names 
   * Default: current class name
   */  
  static id = 'user';

  /**
   * You can also enable 'singleton' behavior for global application stores
   * Default: false
   */
  static isSingleton = true;

  /**
   * Our state
   */
  public name = 'Matthew'

  /**
   * Our API client
   */
  private apiClient: MyApiClient;

  /**
   * @constructor
   */
  constructor({ getStore, apiClient }: IConstructorParams) {
    this.apiClient = apiClient;
    // if we need, we can get a global store or store from the parent context
    // this.otherStore = getStore(SomeOtherStore);

    makeObservable(this, {
      name: observable,
      setName: action.bound,
    });
  }

  /**
   * Set user name
   */
  public setName(name: string): void {
    this.name = name;
  }

  /**
   * Example async
   * Call this func from component
   */
  public getNameFromApi = async (userId: number) => {
    const name = await this.apiClient.fetchName(userId);
    
    this.setName(name);
  }
}

/**
 * Define stores for component
 */
const stores = {
  userStore: UserStore
};

// support typescript
type TProps = StoresType <typeof stores>;

/**
 * User component
 */
const User: FC<TProps> = ({ userStore: { name } }) => {
  return (
    <div>{name}</div>
  )
}

/**
 * Connect stores to component
 */
export default withStores(User, stores);
```

[See app example](example) for a better understanding.

## Support SSR
Does this library support SSR? Short answer - yes, but we need some steps to prepare our framework.
- Look at [After.js (razzle) based project](https://github.com/Lomray-Software/microservices-dashboard/blob/staging/src/pages/user/index.tsx#L82) for a better understanding.
- Look at [NextJS example](https://github.com/Lomray-Software/nextjs-mobx-store-manager-example) for a better understanding (needs writing a wrapper).

## Important Tips
- Create **singleton** store only for global stores e.g, for application settings, logged user, etc.
- To get started, stick to the concept: Store for Component. Don't connect (through withStores) not singleton store to several components.

## Documentation

### Manager
```typescript
import { Manager, MobxLocalStorage, MobxAsyncStorage } from '@lomray/react-mobx-manager';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// Params
const storeManager = new Manager({
  /**
   * Optional: needs for persisting stores when you use Manager.persistStore
   * Available: MobxLocalStorage and MobxAsyncStorage
   * Default: none
   */
  storage: new MobxLocalStorage(), // React
  // storage: new MobxAsyncStorage(AsyncStorage), // React Native
  /**
   * Optional: provide some params for access from store constructor
   * E.g. we can provide our api client for access from the store
   * Default: {}
   */
  storesParams: { apiClient },
  /**
   * Initial stores state.
   * E.g. in SSR case, restore client state from a server
   * Default: {}
   */
  initState: { storeId: { param: 'test' } },
  /**
   * Additional manager options
   */
  options: {
    /**
     * Disable persisting stores
     * E.g., it should be 'true' on a server-side (SSR)
     * Default: false
     */
    shouldDisablePersist: false,
    /**
     * Remove the initial store state after initialization
     * Default: true
     */
    shouldRemoveInitState: true,
    /**
     * Enable this option if your application support server-side rendering (on both side, client and server)
     * Default: false
     */
    isSSR: false,
  }
});

// Methods

/**
 * Optional: Call this method to load persisting data from persist storage
 * E.g., you may want manually to do this before the app render
 * Default: StoreManagerProvider does this automatically with 'shoudInit' prop
 */
await storeManager.init();

/**
 * Get all-created stores
 */
const managerStores = storeManager.getStores();

/**
 * Get specific store
 */
const store = storeManager.getStore(SomeSingletonStore);
const store2 = storeManager.getStore(SomeStore, { contextId: 'necessary-context-id' });

/**
 * Get stores context's and relations
 */
const relations = storeManager.getStoresRelations();

/**
 * Generate unique context id
 */
const contextId = storeManager.createContextId();

/**
 * Manually create stores for component
 * NOTE: 'withStores' wrapper use this method, probably you won't need it
 */
const stores = storeManager.createStores(['someStore', MyStore], 'parent-id', 'context-id', 'HomePage');

/**
 * Mount/Unmount simple stores to component
 */
const unmount = storeManager.mountStores(stores);

/**
 * Get all-stores state
 */
const storesState = storeManager.toJSON();

/**
 * Get all persisted store's state
 */
const persistedStoresState = storeManager.toPersistedJSON();

/**
 * Get only persisted stores id's
 */
const persistedIds = Manager.getPersistedStoresIds();

/**
 * Get store observable props
 */
const observableProps = Manager.getObservableProps(store);

/**
 * Static method for access to manager from anywhere
 * NOTE: Be careful with this, especially with SSR on server-side
 */
const manager = Manager.get();

/**
 * Enable persisting state for store 
 */
const storeClass = Manager.persistStore(class MyStore {}, 'my-store');
```

### withStores
```typescript
import { withStores } from '@lomray/react-mobx-manager';

/**
 * Create and connect 'stores' to component
 * NOTE: In most cases, you don't need to pass a third argument (contextId). 
 */
withStores(Component, stores, 'optional-context-id');

const stores = { myStore: MyStore, anotherStore: AnotherStore };
```

### StoreManagerProvider
```typescript jsx
import { StoreManagerProvider } from '@lomray/react-mobx-manager';

/**
 * Wrap your application for a pass-down store manager, context id, and init persisted state
 * 
 * shouldInit - default: false, enable initialize peristed state
 * fallback - show loader while the manager has initialized
 */
<StoreManagerProvider storeManager={storeManager} shouldInit fallback={<Loader />}>
  {/* your components */}
</StoreManagerProvider>
```

### useStoreManagerContext
```typescript jsx
import { useStoreManagerContext } from '@lomray/react-mobx-manager';

const MyComponent: FC = () => {
  /**
   * Get store manager inside your function component
   */
  const storeManager = useStoreManagerContext();
}
```

### useStoreManagerParentContext
```typescript jsx
import { useStoreManagerParentContext } from '@lomray/react-mobx-manager';

const MyComponent: FC = () => {
  /**
   * Get parent context id
   */
  const { parentId } = useStoreManagerParentContext();
}
```

### Store

```typescript
import { makeObservable, observable, action } from 'mobx';

class MyStore {
  /**
   * Required only if we don't configure our bundler to keep classnames and function names
   * Default: current class name
   */
  static id = 'user';

  /**
   * You can also enable 'singleton' behavior for global application stores
   * Default: false
   */
  static isSingleton = true;
    
  /**
   * Store observable state
   */
  public state = {
    name: 'Matthew',
    username: 'meow',
  }

  /**
   * @private
   */
  private someParentStore: ClassReturnType<typeof SomeParentStore>;

  /**
   * @constructor
   * 
   * getStore - get parent store or singleton store
   * storeManager - access to store manager
   * apiClient - your custom param, see 'storesParams' in Manager
   */
  constructor({ getStore, storeManager, apiClient, componentProps }: IConstructorParams) {
    this.apiClient = apiClient;
    this.someParentStore = getStore(SomeParentStore);
    
    // In case when store is't singletone you can get access to component props
    console.log(componentProps);

    makeObservable(this, {
      state: observable,
    });
  }

  /**
   * Define this method if you want to do something after initialize the store
   * State restored, store ready for usage
   * Optional.
   * @private
   */
  private init(): void {
    // do something
  }

  /**
   * Define this method if you want to do something when a component with this store is mount
   * @private
   */
  private onMount(): void {
    // do something
  }

  /**
   * Define this method if you want to do something when a component with this store is unmount
   * @private
   */
  private onDestroy(): void {
    // do something
  }

  /**
   * Custom method for return store state
   * Optional.
   * Default: @see Manager.toJSON
   */
  public toJSON(): Record<string, any> {
    return { state: { username: this.state.username } };
  }
}
```

Lifecycles:
 - constructor
 - wakeup (restore state from persisted store)
 - init
 - onMount
 - onDestroy

## React Native debug plugin
For debug state, you can use [Reactotron debug plugin](https://github.com/Lomray-Software/reactotron-mobx-store-manager)

## Bugs and feature requests

Bug or a feature request, [please open a new issue](https://github.com/Lomray-Software/react-mobx-manager/issues/new).

## License
Made with 💚

Published under [MIT License](./LICENSE).
