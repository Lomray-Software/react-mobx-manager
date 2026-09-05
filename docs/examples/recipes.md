# Examples / Recipes

## Demo

Explore the [demo app](https://github.com/Lomray-Software/vite-template) to see the library in a real project setup.

## Global store with component usage

```tsx
import { makeObservable, observable, action } from 'mobx';

class UserStore {
  static isGlobal = true;

  public name = 'Matthew';

  constructor() {
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

const User = ({ userStore: { name, setName } }) => {
  return <button onClick={() => setName('John')}>{name}</button>;
};

export default withStores(User, stores);
```

## Relative store for a screen or form

Use relative stores by default when state belongs to a component subtree.

```ts
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
```

Why:

- lifecycle follows the component subtree
- `componentProps` work here
- `onComponentPropsUpdate(props)` works here

## Screen store with DI, async state, and computed values

```ts
import type { IConstructorParams, ClassReturnType } from '@lomray/react-mobx-manager';
import { computed, makeObservable, observable } from 'mobx';
import UserStore from './stores/user-store';

class FeatureScreenStore {
  public data = null;
  public isLoading = false;
  public error: string | null = null;

  private readonly userStore: ClassReturnType<typeof UserStore>;
  protected readonly endpoints: IConstructorParams['endpoints'];

  constructor({ getStore, endpoints, componentProps }: IConstructorParams<{ id: string }>) {
    this.userStore = getStore(UserStore)!;
    this.endpoints = endpoints;

    makeObservable(this, {
      data: observable,
      isLoading: observable,
      error: observable,
      isReady: computed,
    });
  }

  public get isReady() {
    return this.data && !this.isLoading;
  }
}
```

This pattern is useful when a screen needs:

- injected app services
- access to another store through `getStore(...)`
- local async state
- derived values kept out of JSX

## Connect a screen store to a component

```ts
import { type StoresType, withStores } from '@lomray/react-mobx-manager';

const stores = {
  featureStore: FeatureScreenStore,
};

type Props = StoresType<typeof stores>;

const FeatureScreen = ({ featureStore: { isReady, load } }: Props) => {
  // UI only reads ready-to-use state
  return null;
};

export default withStores(FeatureScreen, stores);
```

## Reuse a parent store in children

Prefer `parentStore(Store)` over inline config:

```ts
import { parentStore } from '@lomray/react-mobx-manager';

const stores = {
  someOtherStore: parentStore(SomeOtherStore),
};
```

Use this when the child should consume a store created in an ancestor context instead of creating a new one.

Full shape:

```tsx
const parentStores = {
  someOtherStore: SomeOtherStore,
};

const childStores = {
  someOtherStore: parentStore(SomeOtherStore),
};
```

## Nested component reads parent store without prop drilling

```ts
import { parentStore, type StoresType, withStores } from '@lomray/react-mobx-manager';
import FeatureScreenStore from './FeatureScreen.store';

const stores = {
  featureStore: parentStore(FeatureScreenStore),
};

const FeatureCard = ({ featureStore: { data } }: StoresType<typeof stores>) => {
  return null;
};

export default withStores(FeatureCard, stores);
```

This is a good fit when a nested UI block needs access to feature state but should not receive a long chain of props from parent components.

## Global store for app-wide state

```ts
import { makeObservable, observable } from 'mobx';

class UserStore {
  static isGlobal = true;

  public name = 'Matthew';

  constructor() {
    makeObservable(this, {
      name: observable,
    });
  }
}
```

Minimal shape:

```ts
class UserStore {
  public static isGlobal = true;
  public isAuthProcess = false;
}
```

Good fit:

- current user
- theme
- app settings

Bad fit:

- form state
- screen-specific async state
- props-derived UI state

## Local child store that depends on a parent store and a global store

```ts
import type {
  IConstructorParams,
  ClassReturnType,
  IRelativeStore,
} from '@lomray/react-mobx-manager';
import { reaction } from 'mobx';
import FeatureScreenStore from './FeatureScreen.store';
import UserStore from './stores/user-store';

class FeatureActionsStore implements IRelativeStore {
  private readonly featureStore: ClassReturnType<typeof FeatureScreenStore>;
  private readonly userStore: ClassReturnType<typeof UserStore>;

  constructor({ getStore }: IConstructorParams) {
    this.featureStore = getStore(FeatureScreenStore)!; // this is a parent store, not a global one
    this.userStore = getStore(UserStore)!;
  }

  public init() {
    const unsubscribe = reaction(
      () => this.featureStore.isRefreshing,
      (isRefreshing) => {
        if (isRefreshing) {
          void this.syncSomething();
        }
      }
    );

    return unsubscribe;
  }

  private async syncSomething() {}
}
```

This is a good pattern when a local UI block has its own logic but still depends on screen-level and app-level state.

## Sync component props into a relative store

```ts
import { makeObservable, observable } from 'mobx';

class SomeOtherStore {
  public userId = '';

  constructor({ componentProps }: IConstructorParams<{ userId: string }>) {
    this.userId = componentProps.userId;

    makeObservable(this, {
      userId: observable,
    });
  }

  onComponentPropsUpdate(props: { userId: string }) {
    this.userId = props.userId;
  }
}
```

This is supported only for relative stores.

## Persist only truly long-lived data

```ts
import { Manager } from '@lomray/react-mobx-manager';

class UserStore {
  // profile, settings, preferences, history
}

export default Manager.persistStore(UserStore, 'user');
```

Use persistence for durable state. Avoid using it for temporary screen state, loading flags, or one-off UI flows.

## Persist a store across multiple storages

```ts
export default Manager.persistStore(StorageStore, 'storage', {
  // storage order matters when behaviour is "exclude"
  attributes: {
    // these props will be saved in cookies
    cookie: ['theme', 'searchParams'],
    // all remaining props will be saved in local storage
    local: ['*'],
  },
  // disable default export of all observable props
  // useful when you want to persist only attributes explicitly routed to storages
  isNotExported: true,
});
```

What this means:

- `'storage'` is the persisted store id
- `attributes` splits the persisted payload by storage id
- `cookie: ['theme', 'searchParams']` sends these fields to the `cookie` storage
- `local: ['*']` means all remaining exported fields go to the `local` storage
- storage order matters because the default `behaviour` is `exclude`
- `isNotExported: true` turns off the default “export all observable props” behavior for persistence
- with `isNotExported: true`, persistence should be treated as explicit and controlled

In the storage layer, `CombinedStorage` reads `attributes` and writes each slice of the store state into the matching storage. The first storage acts as the default target when no custom mapping is provided.

## Explicit export control with `makeExported(...)`

```ts
import { makeExported } from '@lomray/react-mobx-manager';

class DebugStore {
  public filters = {};
  public meta = { version: 1 };
  public internalTimer = null;

  constructor() {
    makeExported(this, {
      filters: 'observable',
      meta: 'simple',
      internalTimer: 'excluded',
    });
  }
}
```

Use this when the default export behavior is too broad or when persistence must stay explicit and predictable.

## Combined storage with cookies, local storage, and SSR init state

```ts
import Cookie from 'js-cookie';

const initState = getServerState(StateKey.storeManager, IS_PROD);

const storeManager = new MobxManager({
  initState: {
    ...initState,
  },
  logger: {
    level: 4,
  },
  storage: new CombinedStorage({
    cookie: new CookieStorage({
      cookieAttr: { expires: 365 },
      storage: Cookie,
    }),
    local: new MobxLocalStorage(),
  }),
});
```

What each part does:

- `getServerState(...)` restores manager state pushed from SSR or stream rendering into the client
- `initState` is merged into the manager so stores can restore their initial request state
- `CombinedStorage(...)` lets one manager work with several storages at once
- `cookie` and `local` are storage ids referenced by `attributes` in `persistStore(...)`
- `CookieStorage(...)` persists JSON under one cookie key
- `cookieAttr: { expires: 365 }` configures cookie lifetime
- `MobxLocalStorage()` handles browser local storage for the remaining long-lived data

This setup is useful when:

- some fields must be available through cookies
- other fields fit better in local storage
- SSR or stream rendering must hydrate the manager before the app starts

## Suspense query pattern for SSR and stream rendering

If your project wraps the internal suspense helper with something like `createSuspenseQuery(this)`, the usage can look like this:

```ts
this.suspense = createSuspenseQuery(this);
```

```tsx
suspense.query(() => getData(props), {
  hash: JSON.stringify(props),
});
```

Why this pattern is useful:

- it runs a request and throws the promise for React Suspense
- it stores request completion state on the store
- it syncs suspense state between server and client
- it avoids rerunning the same suspense query when the `hash` is unchanged
- it can restore and rethrow serialized errors on the client

Under the hood, the internal `suspense-query.ts` helper also marks its request state field with `makeExported(...)` so the suspense status can participate in serialization.

## Clean up listeners in `init`

```ts
import { makeObservable, observable } from 'mobx';

class UserStore {
  public isReady = false;

  constructor() {
    makeObservable(this, {
      isReady: observable,
    });
  }

  init() {
    const unsubscribe = someEmitter.subscribe(() => undefined);

    return () => {
      unsubscribe();
    };
  }
}
```

That cleanup runs on destroy.

## SSR request lifecycle

```ts
const manager = new Manager();

try {
  await manager.init();
  // render request
} finally {
  manager.destroy();
}
```

Use one manager per request.

## HMR in development

```ts
import { connectViteHmr } from '@lomray/react-mobx-manager/plugins/dev-extension/hmr';

const manager = new Manager();

if (import.meta.env.DEV) {
  connectViteHmr(manager, import.meta.hot, { appId: 'app' });
}
```

This restores state by `libStoreId`. If ids change, restore is skipped.

HMR support is experimental and is still being tested.

## Important Tips

- Create `global` stores only for things like application settings, logged user, theme, and other app-wide state.
- To get started, stick to the concept: one component subtree owns one `relative` store subtree.
- Do not connect the same non-global store to several unrelated components through `withStores`.
- Prefer `relative` stores by default. Reach for `global` only when the state truly belongs to the whole app.

## Best Practices

### One store per business scope

If a screen owns loading, refresh, optimistic updates, error state, and modal refs, that is usually one screen store.

That is much better than:

- keeping everything in `useState` and `useEffect`
- spreading logic across many hooks
- passing callbacks and flags through several component layers

### Make a store global only when it is truly global

If a store must exist in a single shared instance across the app, mark it with `static isGlobal = true`.

Typical examples:

- auth
- user or session
- app settings
- localization
- navigation-level coordination

Do not make a store global just because it feels easier to import.

### Parent-child store composition beats prop drilling

If a component lives inside a feature scope, do not push `data`, `isLoading`, `error`, `refresh`, and a long list of callbacks down through props.

Use `parentStore(FeatureStore)` instead.

This gives you:

- less prop noise
- fewer brittle component interfaces
- easier layout refactors without rewriting contracts

### Async state should live in the store

Flags like `isLoading`, `isRefreshing`, `isSubmitting`, or `isAuthProcess` should live next to the async methods that control them.

Strong pattern:

- `makeFetching(this, { getSomeData: 'isLoading' })`
- `makeFetching(this, { refreshSomeData: 'isRefreshing' })`

This is cleaner than repeating manual `try/finally` loading control in every screen.

### Keep computed values in stores, not in JSX

Derived values like:

- `isAuth`
- `isFiltersChanged`

belong in the store, not inside render logic.

Components should read ready answers instead of recalculating domain logic during render.

### Reactions and subscriptions should live near the owning store

If one piece of state should trigger another behavior, prefer `reaction` inside the store.

Examples:

- filters changed -> refetch the list
- search history opened -> disable list scroll
- parent store started refreshing -> child store loaded fresh data

This is usually much clearer than scattering magic `useEffect` blocks across the component tree.

### Persist only long-lived state

`Manager.persistStore(...)` is a good fit for:

- user
- localization
- debug settings

Do not persist temporary screen state, loading flags, or one-off UI flows.

### UI refs may live in stores when they are part of the flow

Refs such as `actionMenuModalRef`, `plainNavRef`, or `flashListRef` are fine in a store when they are part of the business flow.

This is especially useful in React Native, where refs often participate in navigation, modal control, and gesture-driven flows.

### Stores should depend on app abstractions, not on JSX

It is normal for a store to know about:

- `apiService`
- `AlertService`
- `NavigationStore`
- `UserStore`

It is a bad sign when a store knows about specific JSX structure or layout details.

## Useful links

- [Vite template example](https://github.com/Lomray-Software/vite-template)
- [Reactotron React Native debug plugin](https://github.com/Lomray-Software/reactotron-mobx-store-manager)
