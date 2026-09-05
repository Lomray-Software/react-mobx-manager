import React from 'react';
import { makeFetching as rootMakeFetching } from '@lomray/react-mobx-manager';
import * as api from '@lomray/react-mobx-manager';
import SuspenseQuery from '@lomray/react-mobx-manager/suspense-query.js';
import ManagerStream from '@lomray/react-mobx-manager/manager-stream.js';
import makeFetching from '@lomray/react-mobx-manager/make-fetching.js';
import LocalStorage from '@lomray/react-mobx-manager/storages/local-storage.js';
import SessionStorage from '@lomray/react-mobx-manager/storages/session-storage.js';
import CookieStorage from '@lomray/react-mobx-manager/storages/cookie-storage.js';
import AsyncStorage from '@lomray/react-mobx-manager/storages/async-storage.js';
import CombinedStorage from '@lomray/react-mobx-manager/storages/combined-storage.js';
import vitePlugin from '@lomray/react-mobx-manager/plugins/vite/index.js';
import connectDevExtension from '@lomray/react-mobx-manager/plugins/dev-extension/index.js';
import {
  connectViteHmr,
  connectWebpackHmr,
  connectReactNativeHmr,
  connectHmrRuntime,
  ManagerHmr,
} from '@lomray/react-mobx-manager/plugins/dev-extension/hmr/index.js';
import { defineConfig } from 'vite';
class Store {
  value = 1;
}
const View = api.withStores(({ store }: { store: Store }) => <p>{store.value}</p>, {
  store: Store,
});
const manager = new api.Manager();
const tree = (
  <api.StoreManagerProvider storeManager={manager}>
    <View />
  </api.StoreManagerProvider>
);
const config = defineConfig({ plugins: [vitePlugin()] });
void [
  rootMakeFetching,
  tree,
  config,
  SuspenseQuery,
  ManagerStream,
  makeFetching,
  LocalStorage,
  SessionStorage,
  CookieStorage,
  AsyncStorage,
  CombinedStorage,
  connectDevExtension,
  connectViteHmr,
  connectWebpackHmr,
  connectReactNativeHmr,
  connectHmrRuntime,
  ManagerHmr,
];
