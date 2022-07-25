
<p align="center">
    <img  src="https://user-images.githubusercontent.com/95251720/180519123-eb8a36e7-e7af-41f2-9a01-ae6d6b6a94f3.svg" alt="Bootstrap logo" width="200" height="165">
</p>

<h3 align='center'>Mobx stores manager for React</h3>

## Table of contents

- [Getting started](#getting-started)
- [Status](#status)
- [Bugs and feature requests](#bugs-and-feature-requests)
- [Copyright](#copyright)


## Getting started

The React-mobx-manager package is distributed using [npm](https://www.npmjs.com/), the node package manager.

```
npm i --save-dev @lomray/react-mobx-manager
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

Connection mobx store to manager and you're good to go!

```jsx
import { withStores } from '@lomray/react-mobx-manager';
import stores from './index.stores';
import User from './index';

export default withStores(User, stores);
```

## Status

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_react-mobx-manager)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_react-mobx-manager)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_react-mobx-manager)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_react-mobx-manager)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_react-mobx-manager)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=bugs)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_react-mobx-manager)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_react-mobx-manager)

## Bugs and feature requests

Bug or a feature request, [please open a new issue](hhttps://github.com/Lomray-Software/react-mobx-manager/issues/new).

## Copyright

Code and documentation copyright 2022 the [Lomray Software](https://lomray.com/). 
