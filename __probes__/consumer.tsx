import React from 'react';
import { makeFetching as rootMakeFetching } from '@lomray/react-mobx-manager';
import * as api from '@lomray/react-mobx-manager';
import SuspenseQuery from '@lomray/react-mobx-manager/suspense-query';
import ManagerStream from '@lomray/react-mobx-manager/manager-stream';
import makeFetching from '@lomray/react-mobx-manager/make-fetching';
import LocalStorage from '@lomray/react-mobx-manager/storages/local-storage';
import SessionStorage from '@lomray/react-mobx-manager/storages/session-storage';
import CookieStorage from '@lomray/react-mobx-manager/storages/cookie-storage';
import AsyncStorage from '@lomray/react-mobx-manager/storages/async-storage';
import CombinedStorage from '@lomray/react-mobx-manager/storages/combined-storage';
import vitePlugin from '@lomray/react-mobx-manager/plugins/vite';
import connectDevExtension from '@lomray/react-mobx-manager/plugins/dev-extension';
import {
  connectViteHmr,
  connectWebpackHmr,
  connectReactNativeHmr,
  connectHmrRuntime,
  ManagerHmr,
} from '@lomray/react-mobx-manager/plugins/dev-extension/hmr';
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
