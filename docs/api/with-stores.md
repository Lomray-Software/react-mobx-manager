# withStores

## Basic usage

```tsx
import { withStores } from '@lomray/react-mobx-manager';
import { makeObservable, observable } from 'mobx';

class UserStore {
  public name = 'Matthew';

  constructor() {
    makeObservable(this, {
      name: observable,
    });
  }
}

const stores = {
  userStore: UserStore,
};

export default withStores(User, stores);
```

## Parent store

Use `parentStore(Store)`:

```ts
import { parentStore } from '@lomray/react-mobx-manager';

const stores = {
  someOtherStore: parentStore(SomeOtherStore),
};
```

This is preferred over:

```ts
const stores = {
  someOtherStore: { isParent: true, store: SomeOtherStore },
};
```

because it keeps runtime behavior the same while improving DX and readability.

## What `withStores` does

- creates stores for the component context
- mounts them on component mount
- unmounts relative stores on component unmount
- injects resolved stores as component props
- updates relative store props through `onComponentPropsUpdate(props)`
