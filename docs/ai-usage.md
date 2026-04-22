# AI / LLM Guide

This document is the fastest accurate way for an AI agent to understand `@lomray/react-mobx-manager`.

If you only keep three ideas in memory, keep these:

1. This package is not "MobX but with more helpers". It is a store ownership and wiring layer for React + MobX.
2. There are only two real store modes: relative and global. "Parent" is a lookup mode for reusing a relative store from an ancestor subtree.
3. Relative stores are the default. Global stores are exceptional.

## Package In One Sentence

`@lomray/react-mobx-manager` adds scoped store ownership, lifecycle, dependency lookup, persistence hooks, SSR/stream hydration support, and dev tooling around plain MobX stores.

## Mental Model

Think of the manager as a React-aware store container with context-scoped dependency injection:

- React components declare which stores they need via `withStores(...)`.
- The manager creates or resolves those stores for the current component context.
- Relative stores belong to that context and die with it.
- Global stores belong to the manager instance and live until `manager.destroy()`.
- Parent stores are not created by the child. The child asks the manager to find an already-created relative store higher in the tree.

The package is intentionally store-class first:

- stores stay as plain classes
- MobX still handles observability and actions
- React components stay focused on rendering
- the manager handles ownership, lifecycle, lookup, hydration, and persistence glue

## How It Differs From Regular MobX

Vanilla MobX gives you observables, computed values, actions, and reactions. It does not define how store instances are owned, scoped, injected, reused, destroyed, serialized, or restored across React trees.

This package adds those missing policies.

| Concern | Regular MobX | `react-mobx-manager` |
| --- | --- | --- |
| Store creation | You instantiate stores manually | `withStores(...)` and `Manager` create/resolve stores for a React context |
| Ownership | Usually ad hoc | Explicit per-component relative ownership or manager-wide global ownership |
| Nested reuse | Usually prop drilling or custom contexts | `parentStore(Store)` walks the parent context chain |
| Cleanup | Manual, easy to forget | `init`, `onDestroy`, and manager-driven teardown |
| Persistence | Custom reactions and storage glue | `Manager.persistStore(...)`, `CombinedStorage`, `wakeup`, `onChangeListener` |
| SSR hydration | Manual serialization and restore | `toJSON`, `initState`, `window.mbxM`, `ManagerStream` |
| Suspense | Manual promise cache design | `SuspenseQuery` helper |
| HMR | Usually ad hoc | `ManagerHmr` bridge |

The practical consequence: this library is closer to a scoped DI/lifecycle framework for MobX stores than to a replacement for MobX itself.

## Store Ownership Rules

### Relative store

Use by default.

Properties:

- created for a specific component context
- receives `componentProps` in its constructor
- can react to later prop changes via `onComponentPropsUpdate(props)`
- transitions through manager statuses like `init`, `touched`, `in-use`, `unused`
- is destroyed automatically after its context is unused long enough

Use for:

- screen state
- form state
- modal or wizard state
- local async workflows
- feature-scoped dependencies

### Global store

Use only for truly app-wide state.

Properties:

- singleton per manager instance
- lazily created by `manager.getStore(GlobalStore)` or via `withStores(...)`
- does not receive meaningful `componentProps`
- is not destroyed by component unmounts
- is destroyed only when the whole manager is destroyed

Use for:

- current user
- auth/session
- app settings
- long-lived shared services

### Parent lookup

Parent is not a third store kind.

`parentStore(Store)` means:

- do not create a new store here
- look up an existing relative store with the same base id in the current/ancestor context chain
- if found, inject it into the child
- lifecycle still belongs to the owner context where it was originally created

Use parent lookup when a child component must reuse state owned by an ancestor subtree.

## Hard Rules For AI Agents

- Default to relative stores unless the state is genuinely app-wide.
- Never treat global stores as the default MobX pattern.
- Never rely on `componentProps` in global stores.
- Never rely on `componentProps` for parent lookup. Parent stores reuse an already-created relative store.
- Prefer `parentStore(Store)` over inline `{ store: Store, isParent: true }`.
- For SSR, create one `Manager` per request and call `manager.destroy()` in `finally`.
- If a store needs persistence, give it a stable id. `Manager.persistStore(Store, id, options)` does this.
- If ids must survive minification, use one of:
  - explicit static `id`
  - bundler settings that preserve class/function names
  - the package Vite plugin
- Do not assume every field is persisted or exported automatically.
- If a store attaches listeners in `init`, return a cleanup callback or implement `onDestroy`.
- Avoid `Manager.get()` in SSR or multi-manager scenarios. It is a static singleton pointer to the most recently constructed manager.

## Canonical Usage Pattern

```tsx
import { Manager, StoreManagerProvider, withStores } from '@lomray/react-mobx-manager';
import { ConsistentSuspenseProvider } from '@lomray/consistent-suspense';
import { action, makeObservable, observable } from 'mobx';

class CounterStore {
  public value = 0;

  constructor() {
    makeObservable(this, {
      value: observable,
      increment: action.bound,
    });
  }

  public increment(): void {
    this.value += 1;
  }
}

const stores = {
  counterStore: CounterStore,
};

const Counter = withStores(({ counterStore }) => {
  return <button onClick={() => counterStore.increment()}>{counterStore.value}</button>;
}, stores);

const manager = new Manager();

export function App() {
  return (
    <ConsistentSuspenseProvider>
      <StoreManagerProvider storeManager={manager} shouldInit>
        <Counter />
      </StoreManagerProvider>
    </ConsistentSuspenseProvider>
  );
}
```

## Important Runtime Behaviors

### Store identity

Store ids are derived in this order:

1. explicit `params.id`
2. static `libStoreId`
3. static `id`
4. class/function name

For non-global stores, the manager appends `--${contextId}` and optionally `--${key}`.

This means minified class names can break stability unless you use explicit ids or the Vite plugin.

### `componentProps`

`componentProps` are passed only to newly created relative stores. They are intentionally replaced with `{}` for:

- global stores
- parent lookups

Relative stores may react to later prop changes through `onComponentPropsUpdate(props)`. This hook is not called on initial mount.

### Lifecycle

When a store is prepared:

1. `initState[storeId]` is merged into the instance.
2. persisted state is restored for persisted stores through `wakeup(...)`.
3. a persistence listener may be attached through `addOnChangeListener(...)`.
4. `store.init?.()` is called.
5. any cleanup returned from `init()` is chained into `onDestroy`.

Relative stores are auto-destroyed using manager timers:

- `init`: default `500ms`
- `touched`: default `10000ms`
- `unused`: default `1000ms`

Global stores skip relative lifecycle teardown and live until `manager.destroy()`.

### Failed parent lookup

If `withStores(...)` asks for a parent store and the manager cannot find it, behavior depends on `failedCreationStrategy`:

- `'empty'` (default): mark failure and render nothing for that wrapped component
- `'dummy'`: force-create a fresh store instance instead
- `'none'`: silently skip the missing store

### Window hydration queue

On the client, the constructor replaces `window.mbxM` with an object whose `push(...)` method feeds additional init state into the manager. Any queued array entries already in `window.mbxM` are applied immediately.

This is how streamed SSR chunks can push more store state into the browser over time.

## Choosing The Right Store Shape

Use a relative store when:

- the state belongs to a component subtree
- constructor data should come from component props
- cleanup should happen with UI ownership

Use a global store when:

- the state is app-wide
- consumers across unrelated branches should share one instance
- component ownership should not matter

Use parent lookup when:

- the owner is an ancestor component
- the child should reuse that owner store instead of creating another one

## Persistence Model

Persistence is opt-in and manager-scoped.

The usual pattern is:

```ts
export default Manager.persistStore(UserStore, 'user', {
  behaviour: 'exclude',
  attributes: {
    local: ['token'],
    session: ['draft'],
  },
});
```

Runtime behavior:

- `Manager.persistStore(...)` records the persisted id in a static set
- it sets `store.libStoreId = id`
- it adds default `wakeup` and `addOnChangeListener` handlers if the store does not already define them
- `CombinedStorage` loads all registered storages on `manager.init()`
- store changes are saved through `manager.savePersistedStore(...)`

`IPersistOptions`:

- `behaviour: 'exclude' | 'include'`
- `attributes: { [storageId: string]: string[] }`
- `isNotExported?: boolean`

Important nuance:

- `'exclude'` means "write listed fields to that storage, then do not write those same fields again to later storages"
- by default, the first storage in `CombinedStorage` gets `['*']`
- `isNotExported: true` disables default observable export unless you explicitly mark fields with `makeExported(...)`

## Serialization And Export Rules

By default, store serialization comes from:

- `store.toJSON?.()`, if the store provides it
- otherwise `Manager.getObservableProps(store, withNotExported)`

`Manager.getObservableProps(...)` exports:

- observable props, unless explicitly excluded
- fields marked as `'simple'` via `makeExported(...)`
- recursively exported nested props marked as `'observable'`

Use `makeExported(store, map)` when:

- a store uses `isNotExported: true`
- you need extra non-observable metadata in exports
- you want exact control over what SSR or persistence sees

Markers:

- `'simple'`: include the field as-is
- `'observable'`: recurse into nested observable data
- `'excluded'`: always omit the field

## SSR, Streaming, Suspense, And HMR

### SSR

Recommended pattern:

```ts
const manager = new Manager({
  initState,
  options: { shouldDisablePersist: true },
});

try {
  await manager.init();
  // render
} finally {
  manager.destroy();
}
```

Notes:

- one manager per request
- do not rely on static `Manager.get()` across requests
- call `destroy()` even if GC would eventually collect instances, because listeners and other side effects need explicit teardown

### Streaming SSR

`ManagerStream` turns suspense-bound store snapshots into script chunks that push serialized state into `window.mbxM`.

Use `take(suspenseId)` to get the next `<script>...</script>` chunk for that Suspense boundary.

### Suspense

`SuspenseQuery` wraps a promise and stores suspense completion/error metadata on the store, defaulting to field name `sR`.

Use it when:

- a store must throw promises/errors for React Suspense
- server and client should agree on whether the query already completed

### HMR

`ManagerHmr` saves `manager.getStoreState(...)` by `libStoreId`, restores it into the next manager instance, and destroys the old manager on hot dispose.

This is best-effort state restore, not object identity reuse.

## Complete API Reference

This section lists the package surface in two layers:

1. stable root exports from `@lomray/react-mobx-manager`
2. shipped subpath modules that are importable because the build preserves module paths

The root export is the safest contract. Subpath imports are available in the published layout, but some of them are advanced or tooling-oriented.

### Root Module: `@lomray/react-mobx-manager`

#### Classes And Functions

`Manager`

- Constructor: `new Manager(params?: IManagerParams)`
- Purpose: core runtime for store creation, lookup, persistence, serialization, and teardown
- Key instance methods:
  - `init(): Promise<Manager>`
  - `getStores(): Map<string, TInitStore>`
  - `getStoresRelations(): Map<string, { ids: Set<string>; parentId: string | null; componentName?: string }>`
  - `getSuspenseRelations(): Map<string, Set<string>>`
  - `pushInitState(storesState?: Record<string, any>): void`
  - `getStore<T>(store: IConstructableStore<T>, params?: IStoreParams): T | undefined`
  - `createStores(map, parentId, contextId, suspenseId, componentName, componentProps?): IGroupedStores`
  - `mountStores(contextId, groupedStores): () => void`
  - `destroy(): void`
  - `touchedStores(stores: TStores): void`
  - `getStoreState(store: TAnyStore, withNotExported?: boolean): Record<string, any>`
  - `toJSON(ids?: string[], isIncludeExported?: boolean): Record<string, any>`
  - `savePersistedStore(store: IStorePersisted): Promise<boolean>`
- Key static methods:
  - `Manager.get(): Manager`
  - `Manager.getPersistedStoresIds(): Set<string>`
  - `Manager.getObservableProps(store: TAnyStore, withNotExported?: boolean): Record<string, any>`
  - `Manager.persistStore<T>(store: IConstructableStore<T>, id: string, options?: IPersistOptions): IConstructableStore<T>`

`withStores`

- Signature: `withStores<TProps, TStoresMap>(Component, stores, options?): FC<Omit<TProps, keyof TStoresMap>>`
- Purpose: wrap a React component with MobX observation and inject resolved stores as props
- Options:
  - `customContextId?: string`

`parentStore`

- Signature: `parentStore(Store)`
- Returns: `{ store: Store, isParent: true }`
- Purpose: mark a store request as ancestor lookup instead of local creation

`makeFetching`

- Signature: `makeFetching(instance, params, hasLock?)`
- Purpose: wrap methods so they toggle boolean loading flags around sync or async execution
- Notes:
  - supports multiple concurrent async calls
  - each method may map to a single flag (`'isLoading'`) or to a `readonly` tuple of flags (`['isLoading', 'isRefreshing'] as const`); tuple flags flip together inside one `runInAction`
  - with `hasLock = true`, it drops calls while **every** mapped flag is already `true`

`makeExported`

- Signature: `makeExported(store, props, shouldExtend?)`
- Purpose: define serialization markers for store fields

`isPropObservableExported`

- Signature: `isPropObservableExported(store, prop): boolean`

`isPropSimpleExported`

- Signature: `isPropSimpleExported(store, prop): boolean`

`isPropExcludedFromExport`

- Signature: `isPropExcludedFromExport(store, prop, withNotExported?): boolean`

`Events`

- Enum values:
  - `CREATE_STORE = 'mobx-manager:store-create'`
  - `MOUNT_STORE = 'mobx-manager:store-mount'`
  - `UNMOUNT_STORE = 'mobx-manager:store-unmount'`
  - `DELETE_STORE = 'mobx-manager:store-delete'`

`Logger`

- Constructor: `new Logger(opts: ILoggerOpts)`
- Methods:
  - `log(msg, opts): void`
  - `err(msg, err?, payload?): void`
  - `warn(msg, payload?): void`
  - `info(msg, payload?): void`
  - `debug(msg, payload?, hasSnapshot?): void`

`wakeup`

- Signature: `wakeup({ manager, initState, persistedState }): void`
- Purpose: default persisted-store restore strategy

`onChangeListener`

- Signature: `(store, manager) => (() => void) | undefined`
- Purpose: default persisted-store change subscription using MobX `reaction(...)`

#### React Context Exports

`StoreManagerContext`

- React context carrying the current `Manager`

`StoreManagerParentContext`

- React context carrying the current parent context id

`StoreManagerProvider`

- Props:
  - `storeManager: Manager`
  - `shouldInit?: boolean`
  - `fallback?: ReactElement`
  - `children?: ReactNode`
- Behavior:
  - optionally runs `await manager.init()` in an effect
  - seeds the root parent context

`StoreManagerParentProvider`

- Props:
  - `parentId: string`
  - `touchableStores?: TStores`
  - `children?: ReactNode`
- Behavior:
  - optionally marks provided stores as touched before rendering descendants

`useStoreManager`

- Signature: `(): Manager`

`useStoreManagerParent`

- Signature: `(): string`

#### Exported Types

These are re-exported from `src/types.ts` at the package root:

- `IWindowManager`
- `IConstructorParams<TProps = any>`
- `IStoreLifecycle`
- `IStore`
- `IRelativeStore`
- `IGlobalStore`
- `IStorePersisted`
- `TInitStore<TSto = IStore>`
- `IConstructableStore<TSto = IStore>`
- `IStoreConfig`
- `TStoreDefinition<TSto extends TAnyStore = any>`
- `TMapStores`
- `IManagerParams`
- `TWakeup`
- `IStorage`
- `IManagerOptions`
- `TAnyStore`
- `TStores`
- `ClassReturnType<T>`
- `StoresType<TSt>`
- `IStoreParams`
- `IWithStoreOptions`
- `IMobxManagerEvents`
- `IGroupedStores`
- `IPersistOptions`

Most important ones for app code:

- `IConstructorParams<TProps>`: constructor input for stores
- `StoresType<typeof stores>`: maps a `stores` object to injected prop types
- `IManagerParams`: manager constructor config
- `IPersistOptions`: persistence routing rules

### Shipped Subpath Modules

The package build preserves module paths under `src/`, so these imports are available in practice.

#### Context And Core

`@lomray/react-mobx-manager/context`

- `StoreManagerContext`
- `StoreManagerParentContext`
- `StoreManagerProvider`
- `StoreManagerParentProvider`
- `useStoreManager`
- `useStoreManagerParent`

`@lomray/react-mobx-manager/manager`

- default export `Manager`

`@lomray/react-mobx-manager/types`

- all root-exported types listed above

`@lomray/react-mobx-manager/events`

- default export `Events`

`@lomray/react-mobx-manager/logger`

- `ILoggerOpts`
- `ILoggerLogOpts`
- default export `Logger`

`@lomray/react-mobx-manager/wakeup`

- default export `wakeup`

`@lomray/react-mobx-manager/on-change-listener`

- default export `onChangeListener`

`@lomray/react-mobx-manager/with-stores`

- default export `withStores`

`@lomray/react-mobx-manager/parent-store`

- default export `parentStore`

`@lomray/react-mobx-manager/make-exported`

- `makeExported`
- `isPropObservableExported`
- `isPropSimpleExported`
- `isPropExcludedFromExport`

`@lomray/react-mobx-manager/make-fetching`

- default export `makeFetching`

#### Storages

`@lomray/react-mobx-manager/storages/local-storage`

- `ILocalStorageOptions`
- default export `LocalStorage`

`@lomray/react-mobx-manager/storages/session-storage`

- default export `SessionStorage`

`@lomray/react-mobx-manager/storages/cookie-storage`

- default export `CookieStorage`

`@lomray/react-mobx-manager/storages/async-storage`

- default export `AsyncStorage`

`@lomray/react-mobx-manager/storages/combined-storage`

- default export `CombinedStorage`
- important methods:
  - `get()`
  - `flush()`
  - `set(value, storageId?)`
  - `getStoreData(store)`
  - `saveStoreData(store, data)`

#### Vite Plugin

`@lomray/react-mobx-manager/plugins/vite/index`

- default export `ViteReactMobxManager(): Plugin[]`

`@lomray/react-mobx-manager/plugins/vite/id-generator`

- `IPluginOptions`
- default export `IdGenerator(options?): Plugin`

Behavior:

- detects store classes by `makeObservable(...)`, `makeAutoObservable(...)`, or `@mobx-store` JSDoc
- injects static `id`
- in production, writes compact ids and caches them in `node_modules/.cache/@lomray/react-mobx-manager/store-ids.json`

#### Dev Extension And HMR

`@lomray/react-mobx-manager/plugins/dev-extension/index`

- default export `connectDevExtension(storeManager): void`

`@lomray/react-mobx-manager/plugins/dev-extension/hmr`

- `IHmrOptions`
- `IHmrRuntime`
- `IHmrSnapshot`
- `connectReactNativeHmr(manager, runtime?, options?)`
- `connectViteHmr(manager, runtime?, options?)`
- `connectWebpackHmr(manager, runtime?, options?)`
- default export `connectHmrRuntime(manager, runtime?, options?)`
- `ManagerHmr`

`ManagerHmr` methods:

- `save(runtimeData?): IHmrSnapshot`
- `restore(runtimeData?): boolean`
- `clear(runtimeData?): void`
- `dispose(runtimeData?): void`
- `bind(runtime): ManagerHmr`

#### Advanced Utilities

`@lomray/react-mobx-manager/manager-stream`

- default export `ManagerStream`
- constructor: `new ManagerStream(manager)`
- method: `take(suspenseId): string | void`

`@lomray/react-mobx-manager/suspense-query`

- `IPromise<TReturn>`
- default export `SuspenseQuery`
- constructor: `new SuspenseQuery(store, params?)`
- methods:
  - `query(promiseFactory, options?): T | undefined`
  - `subquery(promiseFactory, { id, hash }): T | undefined`
  - static `run(promise): T | undefined`

#### Tooling Internals

These are shipped, but they are mostly implementation details rather than recommended app imports:

`@lomray/react-mobx-manager/plugins/helpers`

- `saveCache`
- `loadCache`
- `getNextLetter`
- `Generator`

`@lomray/react-mobx-manager/plugins/dev-extension/state-listener`

- default export `StateListener`

`@lomray/react-mobx-manager/store-status`

- default export `StoreStatus`

`@lomray/react-mobx-manager/constants`

- `ROOT_CONTEXT_ID`

`@lomray/react-mobx-manager/deep-merge`

- default export `deepMerge`

`@lomray/react-mobx-manager/deep-compare`

- default export `deepCompare`

## Decision Checklist For AI

Before suggesting code, answer these questions:

1. Is this state owned by one component subtree? Use a relative store.
2. Must unrelated branches share one instance? Use a global store.
3. Is a child reusing ancestor-owned state? Use `parentStore(...)`.
4. Does the store need stable identity across reloads or persistence? Ensure a stable id.
5. Does the store subscribe to anything external? Return cleanup from `init()` or implement `onDestroy()`.
6. Is this SSR? Create one manager per request and destroy it explicitly.

## What AI Should Not Suggest

- "Put everything in global MobX stores."
- "Use parent lookup as a hidden global dependency system."
- "Pass component props into global stores."
- "Rely on class names staying stable after minification without configuring ids."
- "Skip `manager.destroy()` in SSR because JavaScript has garbage collection."

## Recommended Explanation To Humans

If you need one short explanation for a teammate:

> This library keeps plain MobX stores, but adds React-aware ownership, scoped lookup, teardown, persistence, and SSR glue so feature state can live next to the UI that owns it instead of collapsing into one global tree.
