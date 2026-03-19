# Helpers

## `parentStore(Store)`

Marks store definition as parent-scoped.

```ts
import { parentStore } from '@lomray/react-mobx-manager';

const stores = {
  someOtherStore: parentStore(SomeOtherStore),
};
```

Returned runtime value:

```ts
{
  store: SomeOtherStore,
  isParent: true
}
```

## `Manager.persistStore(Store, id?, options?)`

Marks store as persisted and wires default persistence hooks.

```ts
export default Manager.persistStore(UserStore, 'user');
```

## `makeFetching(instance, params, hasLock?)`

Wraps store methods and toggles boolean fetching flags around sync or async execution.

```ts
makeFetching(this, {
  getNameFromApi: 'isLoading',
});
```

## `makeExported(store, params)`

Controls what parts of the store become exportable or serializable.

```ts
makeExported(this, {
  someField: 'simple',
});
```

Use it when you want explicit control over what `Manager.toJSON()` or persistence-related export logic should include.

Markers:

- `'simple'` includes a plain field as-is
- `'observable'` exports nested observable data recursively
- `'excluded'` explicitly removes a field from export

This is especially useful when:

- a store uses `isNotExported: true` in `persistStore(...)`
- only a subset of fields should be serialized
- you need to export non-observable metadata together with observable state
