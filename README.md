<p align="center">
    <img  src="https://user-images.githubusercontent.com/95251720/180519123-eb8a36e7-e7af-41f2-9a01-ae6d6b6a94f3.svg" alt="Bootstrap logo" width="200" height="165">
</p>

<h3 align='center'>Mobx stores manager for React</h3>

[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_react-mobx-manager)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_react-mobx-manager)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_react-mobx-manager)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_react-mobx-manager)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=bugs)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_react-mobx-manager)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_react-mobx-manager)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FLomray-Software%2Freact-mobx-manager.svg?type=small)](https://app.fossa.com/projects/git%2Bgithub.com%2FLomray-Software%2Freact-mobx-manager?ref=badge_small)

## Table of contents

- [Getting started](#getting-started)
- [Support SSR](#support-ssr)
- [React Native Debug Plugin](#react-native-debug-plugin)
- [Bugs and feature requests](#bugs-and-feature-requests)
- [Copyright](#copyright)


## Getting started

The React-mobx-manager package is distributed using [npm](https://www.npmjs.com/), the node package manager.

```
npm i --save @lomray/react-mobx-manager
```

_Optional:_ Configure your bundler for keep classnames and function names in production OR use `id` for each store:
 
**React:** (craco or webpack config, terser options)
```bash
terserOptions.keep_classnames = true;
terserOptions.keep_fnames = true;
```

**React Native:** (metro bundler config)
```
transformer: {
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: true,
  },
}
```

Import `Manager, StoreManagerProvider` from `@lomray/react-mobx-manager` into your index file after wrap `<App/>` with `<StoreManagerProvider/>`

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { Manager, StoreManagerProvider } from '@lomray/react-mobx-manager';
import App from './app';

const storeManager = new Manager();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <StoreManagerProvider storeManager={storeManager} shouldInit>
      <App />
    </StoreManagerProvider>
  </React.StrictMode>,
);
```

Connect mobx store to manager, and you're good to go!

```typescript
import { withStores } from '@lomray/react-mobx-manager';
import { makeAutoObservable } from 'mobx';

/**
 * Mobx user store
 */
class UserStore {
  /**
   * Required only if we don't configure our bundler for keep classnames and function names 
   */  
  static id = 'user';
    
  name = 'Matthew'

  constructor() {
    makeAutoObservable()
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

[See example app](example) for more understanding.

# Support SSR
Does this library support SSR? Short answer - yes, but we need some steps for prepare our framework.
 - Look at [Razzle project](https://github.com/Lomray-Software/microservices-dashboard/blob/staging/src/pages/user/index.tsx#L82) for more understanding.
 - Look at [NextJS example](https://github.com/Lomray-Software/nextjs-mobx-store-manager-example) for more understanding (need write wrapper).

## React Native debug plugin
For debug state you can use [Reactotron debug plugin](https://github.com/Lomray-Software/reactotron-mobx-store-manager) 

## Bugs and feature requests

Bug or a feature request, [please open a new issue](https://github.com/Lomray-Software/react-mobx-manager/issues/new).

## Copyright

Code and documentation copyright 2022 the [Lomray Software](https://lomray.com/). 
