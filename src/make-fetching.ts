import { runInAction } from 'mobx';

type TParams<T> = {
  [K in keyof T]?: keyof T;
};

/**
 * Wrap functions to manage their fetching indicator
 */
const makeFetching = <T extends Record<any, any>>(
  instance: T,
  params: TParams<T> = {},
  hasLock = false,
): void => {
  Object.entries(params).forEach(([funcName, propName]) => {
    const callback = instance[funcName] as (...arg: any[]) => any;
    const setValue = (value: boolean) => {
      runInAction(() => {
        // @ts-expect-error not necessary
        instance[propName] = value;
      });
    };

    // @ts-expect-error not necessary
    instance[funcName] = (...args: any[]) => {
      if (hasLock && instance[propName]) {
        return;
      }

      setValue(true);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = callback(...args);

      if (typeof result === 'object' && result.finally) {
        result.finally(() => {
          setValue(false);
        });
      } else {
        setValue(false);
      }

      return result;
    };
  });
};

export default makeFetching;
