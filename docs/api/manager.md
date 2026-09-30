# Manager

## Constructor

```ts
new Manager({
  initState,
  storesParams,
  storage,
  options,
  logger,
});
```

## Options

```ts
new Manager({
  options: {
    // don't create persist listeners and don't save anything
    shouldDisablePersist: false,
    // batch persisted store changes and save them at most once per 100 ms
    persistDelay: 100,
  },
});
```

- `persistDelay` (default `100`): changes of persisted stores are collected and written at most once per this delay. `0` saves on every change, as older versions did. On the server (`manager.isServer`) changes are always saved immediately. In tests that read a storage right after a change, `await manager.flushPersist()` first or use `0`.

## Important methods

### `init(): Promise<Manager>`

Initializes manager storage and returns the manager itself.

### `getStore(Store, params?)`

Returns an existing store or creates it when needed.

### `createStores(map, parentId, contextId, suspenseId, componentName, componentProps?)`

Internal creation entry used by `withStores`.

### `mountStores(contextId, groupedStores)`

Mounts touchable stores and returns unmount cleanup.

### `touchedStores(stores)`

Moves relative stores from `init` to `touched` status when they are passed deeper into the tree.

### `getStoreState(store, withNotExported?)`

Returns serializable store state.

### `getPersistState(store)`

Returns the state of a persisted store that goes to storages: only attributes listed in `persistStore(...)` options (all exported attributes by default). Uses `store.toJSON()` when the store defines it.

### `savePersistedStore(store)`

Saves persisted store state through configured storage right now, without batching.

### `schedulePersist(store, getState?)`

Queues saving of a persisted store. The default change listener calls it: all stores queued during `persistDelay` are written together, each storage once.

### `flushPersist(): Promise<boolean>`

Writes queued changes right now and resolves when storage writes are finished (`false` if something failed or persist is disabled).

The manager flushes automatically when the browser page is hidden (`pagehide`, `visibilitychange`), before a store is destroyed and on `destroy()`. Call it yourself when the environment has no page events, e.g. when a React Native app goes to background:

```ts
AppState.addEventListener('change', (state) => {
  if (state !== 'active') {
    void manager.flushPersist();
  }
});
```

### `destroy()`

Destroys all stores of the current manager instance and runs cleanup hooks.

Use it for:

- SSR request teardown
- dev teardown
- explicit app reset flows
