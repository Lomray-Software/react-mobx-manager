import type { IStorePersisted, TAnyStore } from '@src/types';

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
  (store as Record<string, any>)[exportedPropName] = {
    ...(shouldExtend ? ((store as Record<string, any>)?.[exportedPropName] ?? {}) : {}),
    ...props,
  };
};

/**
 * Excluded in persistStore level
 * @see IPersistOptions
 */
const isPropExcludedInPersist = (store: TAnyStore): boolean => {
  return (store as IStorePersisted)?.['libStorageOptions']?.isNotExported || false;
};

/**
 * Check if store prop is observable exported
 */
const isPropObservableExported = (store: TAnyStore, prop: string): boolean =>
  (store as Record<string, any>)?.[exportedPropName]?.[prop] === 'observable';

/**
 * Check if store prop is simple exported
 */
const isPropSimpleExported = (store: TAnyStore, prop: string): boolean =>
  (store as Record<string, any>)?.[exportedPropName]?.[prop] === 'simple';

/**
 * Check if store prop is excluded from export
 */
const isPropExcludedFromExport = (
  store: TAnyStore,
  prop: string,
  withNotExported = false,
): boolean =>
  (store as Record<string, any>)?.[exportedPropName]?.[prop] === 'excluded' ||
  (!withNotExported && isPropExcludedInPersist(store));

export { makeExported, isPropObservableExported, isPropSimpleExported, isPropExcludedFromExport };
