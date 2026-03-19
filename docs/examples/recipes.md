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

## Useful links

- [Vite template example](https://github.com/Lomray-Software/vite-template)
- [Reactotron React Native debug plugin](https://github.com/Lomray-Software/reactotron-mobx-store-manager)
