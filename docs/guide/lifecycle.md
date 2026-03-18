# Lifecycle

## Available hooks

Stores can define lifecycle hooks:

```ts
class MyStore {
  init?(): void | (() => void) {}
  onDestroy?(): void {}
  onComponentPropsUpdate?(props: Record<string, any>): void {}
}
```

## `init`

`init` runs when the store is prepared by the manager.

It may return a cleanup callback:

```ts
class MyStore {
  init() {
    const unsubscribe = someEmitter.subscribe(() => undefined);

    return () => {
      unsubscribe();
    };
  }
}
```

That cleanup runs when the store is destroyed.

## `onDestroy`

`onDestroy` runs on store teardown.

It is chained with:

- persisted store listeners cleanup
- cleanup returned from `init`
- explicit `manager.destroy()`

For relative stores:

- it runs when the store dies with its component ownership lifecycle

For global stores:

- it does not run automatically from component lifecycle
- it runs when the manager is explicitly destroyed

## `onComponentPropsUpdate`

This hook is called only for relative stores.

It does not run on initial mount. It runs on component props updates:

```ts
class UserStore {
  onComponentPropsUpdate(props: Record<string, any>) {
    this.userId = props.userId;
  }
}
```

If you need previous props, compare them manually inside the store.
