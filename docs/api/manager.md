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

### `savePersistedStore(store)`

Saves persisted store state through configured storage.

### `destroy()`

Destroys all stores of the current manager instance and runs cleanup hooks.

Use it for:

- SSR request teardown
- dev teardown
- explicit app reset flows
