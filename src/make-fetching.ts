import { runInAction } from 'mobx';

type AnyFn = (...args: any[]) => any;

type MethodKeys<T> = {
  [K in keyof T]-?: T[K] extends AnyFn ? K : never;
}[keyof T];

type BooleanKeys<T> = {
  [K in keyof T]-?: T[K] extends boolean ? K : never;
}[keyof T];

type StrictParams<T> = Partial<Record<MethodKeys<T>, BooleanKeys<T>>>;
type UnsafeParams = Record<string, string>;

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
  Object.entries(params).forEach(([funcName, propName]) => {
    const callback = instance[funcName] as (...arg: any[]) => any;
    let inFlight = 0;
    const setValue = (value: boolean): void => {
      runInAction(() => {
        // @ts-expect-error not necessary
        instance[propName] = value;
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
      if (hasLock && instance[propName]) {
        return;
      }

      increment();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = callback(...args);

      if (typeof result === 'object' && result.finally) {
        result.finally(() => {
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
