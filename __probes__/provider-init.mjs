import assert from 'node:assert/strict';
import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { makeAutoObservable } from 'mobx';
import { Manager, StoreManagerProvider, withStores } from '@lomray/react-mobx-manager';
import { ConsistentSuspenseProvider } from '@lomray/consistent-suspense';
import { JSDOM } from 'jsdom';
const h = React.createElement;
const dom = new JSDOM('<div id="root"></div>', { url: 'https://audit.test' });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
});
class UserStore {
  name = 'default';
  constructor() {
    makeAutoObservable(this);
  }
}
Manager.persistStore(UserStore, 'user');
const View = withStores(({ store }) => h('p', null, store.name), { store: UserStore });
for (const hasFallback of [false, true]) {
  let finishInit;
  const manager = new Manager({
    storage: {
      get: () =>
        new Promise((resolve) => {
          finishInit = () => resolve({ user: { name: 'persisted' } });
        }),
      set: () => {},
      flush: () => {},
    },
  });
  const root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      h(
        ConsistentSuspenseProvider,
        null,
        h(
          StoreManagerProvider,
          {
            storeManager: manager,
            shouldInit: true,
            ...(hasFallback ? { fallback: h('i', null, 'loading') } : {}),
          },
          h(View),
        ),
      ),
    ),
  );
  assert.equal(document.getElementById('root').textContent, hasFallback ? 'loading' : '');
  assert.equal(manager.getStores().size, 0);
  await act(async () => {
    finishInit();
  });
  const actual = document.getElementById('root').textContent;
  console.log(
    JSON.stringify({
      shouldInit: true,
      hasFallback,
      storage: manager.storage.getStoreData({ libStoreId: 'user' }),
      rendered: actual,
    }),
  );
  assert.equal(actual, 'persisted');
  await act(async () => root.unmount());
  manager.destroy();
}
const manager = new Manager();
const ref = createRef();
const RefView = withStores(({ ref: inputRef }) => h('input', { ref: inputRef }), {
  store: UserStore,
});
const root = createRoot(document.getElementById('root'));
await act(async () =>
  root.render(
    h(
      ConsistentSuspenseProvider,
      null,
      h(StoreManagerProvider, { storeManager: manager }, h(RefView, { ref })),
    ),
  ),
);
assert.equal(ref.current?.tagName, 'INPUT');
console.log('React 19 ref-as-prop through withStores: INPUT');
await act(async () => root.unmount());
manager.destroy();
dom.window.close();
