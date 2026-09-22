import type { IStorePersisted, TAnyStore } from '@src/types';

const exportedPropName = 'libExported';

type TExportedKind = 'observable' | 'simple' | 'excluded';

/**
 * Store shape after makeExported marked its props
 */
interface IExportedStore {
  [exportedPropName]?: Record<string, TExportedKind | undefined>;
}

/**
 * Make store props exported for Manager.toJSON
 * @see Manager.toJSON
 */
const makeExported = <T extends object>(
  store: T,
  props: {
    [P in Exclude<keyof T, 'toString'>]?: TExportedKind;
  },
  shouldExtend = true,
): void => {
  (store as IExportedStore)[exportedPropName] = {
    ...(shouldExtend ? ((store as IExportedStore)?.[exportedPropName] ?? {}) : {}),
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
  (store as IExportedStore)?.[exportedPropName]?.[prop] === 'observable';

/**
 * Check if store prop is simple exported
 */
const isPropSimpleExported = (store: TAnyStore, prop: string): boolean =>
  (store as IExportedStore)?.[exportedPropName]?.[prop] === 'simple';

/**
 * Check if store prop is excluded from export
 */
const isPropExcludedFromExport = (
  store: TAnyStore,
  prop: string,
  withNotExported = false,
): boolean =>
  (store as IExportedStore)?.[exportedPropName]?.[prop] === 'excluded' ||
  (!withNotExported && isPropExcludedInPersist(store));

export { makeExported, isPropObservableExported, isPropSimpleExported, isPropExcludedFromExport };
