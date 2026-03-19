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
      setName: action.bound,
    });
  }

  public setName(name: string): void {
    this.name = name;
  }
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
      setValue: action.bound,
    });
  }

  public setValue(value: string): void {
    this.value = value;
  }
}

const stores = {
  someOtherStore: SomeOtherStore,
};
```

Why:

- lifecycle follows the component subtree
- `componentProps` work here
- `onComponentPropsUpdate(props)` works here

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

Good fit:

- current user
- theme
- app settings

Bad fit:

- form state
- screen-specific async state
- props-derived UI state

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
