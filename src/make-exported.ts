import type { TAnyStore } from '@src/types';

const exportedPropName = 'libExported';

/**
 * Make store props exported for Manager.toJSON
 * @see Manager.toJSON
 */
const makeExported = <T extends object>(
  store: T,
  props: {
    [P in Exclude<keyof T, 'toString'>]?: 'observable' | 'simple' | 'excluded';
  },
  shouldExtend = true,
): void => {
  // @ts-ignore
  store[exportedPropName] = { ...(shouldExtend ? store?.[exportedPropName] ?? {} : {}), ...props };
};

/**
 * Excluded in persistStore level
 * @see IPersistOptions
 */
const isPropExcludedInPersist = (store: TAnyStore): boolean => {
  // @ts-ignore
  return store?.['libStorageOptions']?.isNotExported || false;
};

/**
 * Check if store prop is observable exported
 */
const isPropObservableExported = (store: TAnyStore, prop: string): boolean =>
  // @ts-ignore
  store?.[exportedPropName]?.[prop] === 'observable';

/**
 * Check if store prop is simple exported
 */
const isPropSimpleExported = (store: TAnyStore, prop: string): boolean =>
  // @ts-ignore
  store?.[exportedPropName]?.[prop] === 'simple';

/**
 * Check if store prop is excluded from export
 */
const isPropExcludedFromExport = (
  store: TAnyStore,
  prop: string,
  withNotExported = false,
): boolean =>
  // @ts-ignore
  store?.[exportedPropName]?.[prop] === 'excluded' ||
  (!withNotExported && isPropExcludedInPersist(store));

export { makeExported, isPropObservableExported, isPropSimpleExported, isPropExcludedFromExport };
