# Component Props

## Constructor props

`componentProps` are passed into store constructor only for relative stores.

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
}
```

## Update hook

If component props change later, use `onComponentPropsUpdate(props)`:

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

## Hard rule

`componentProps` are not a supported contract for:

- global stores

That is intentional. Global stores are shared outside a single component owner, so component props would be ambiguous there.
