import { runInAction } from 'mobx';

type AnyFn = (...args: any[]) => any;

type MethodKeys<T> = {
  [K in keyof T]-?: T[K] extends AnyFn ? K : never;
}[keyof T];

type BooleanKeys<T> = {
  [K in keyof T]-?: T[K] extends boolean ? K : never;
}[keyof T];

type AtLeastTwo<T> = readonly [T, T, ...T[]];
type StrictParamValue<T> = BooleanKeys<T> | AtLeastTwo<BooleanKeys<T>>;
type StrictParams<T> = Partial<Record<MethodKeys<T>, StrictParamValue<T>>>;
type UnsafeParams = Record<string, string | readonly string[]>;

function makeFetching<T extends Record<any, any>>(
  instance: T,
  params: StrictParams<T>,
  hasLock?: boolean,
): void;
function makeFetching<T extends Record<any, any>>(
  instance: T,
  params: UnsafeParams,
  hasLock?: boolean,
): void;

function makeFetching<T extends Record<any, any>>(
  instance: T,
  params: StrictParams<T> | UnsafeParams = {},
  hasLock = false,
): void {
  Object.entries(params).forEach(([funcName, propNameOrNames]) => {
    const propNames = (Array.isArray(propNameOrNames) ? propNameOrNames : [propNameOrNames]).filter(
      Boolean,
    ) as string[];

    if (propNames.length === 0) {
      return;
    }

    const callback = instance[funcName] as (...arg: any[]) => any;
    let inFlight = 0;
    const setValue = (value: boolean): void => {
      runInAction(() => {
        for (const propName of propNames) {
          // @ts-expect-error not necessary
          instance[propName] = value;
        }
      });
    };
    const increment = (): void => {
      inFlight += 1;

      if (inFlight === 1) {
        setValue(true);
      }
    };
    const decrement = (): void => {
      inFlight = Math.max(inFlight - 1, 0);

      if (inFlight === 0) {
        setValue(false);
      }
    };

    // @ts-expect-error not necessary
    instance[funcName] = (...args: any[]) => {
      if (hasLock && propNames.every((name) => instance[name])) {
        return;
      }

      increment();

      let result: unknown;

      try {
        result = callback.apply(instance, args);
      } catch (error) {
        decrement();
        throw error;
      }

      if (
        result &&
        typeof result === 'object' &&
        typeof (result as { finally?: unknown }).finally === 'function'
      ) {
        void (result as Promise<unknown>).finally(() => {
          decrement();
        });
      } else {
        decrement();
      }

      return result;
    };
  });
}

export default makeFetching;
