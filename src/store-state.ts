import { isObservableObject, isObservableProp, keys, toJS } from 'mobx';
import {
  isPropExcludedFromExport,
  isPropObservableExported,
  isPropSimpleExported,
} from './make-exported';
import type { IStorePersisted, TAnyStore } from './types';

/**
 * Own enumerable store keys. Observable objects also report keys changes to mobx
 */
const getStoreKeys = (store: TAnyStore): string[] =>
  (isObservableObject(store) ? keys(store) : Object.keys(store)) as string[];

/**
 * Check if store prop is included in store state
 */
const isExportedProp = (store: TAnyStore, prop: string, withNotExported = false): boolean =>
  isPropObservableExported(store, prop) ||
  isPropSimpleExported(store, prop) ||
  (isObservableProp(store, prop) && !isPropExcludedFromExport(store, prop, withNotExported));

/**
 * Convert exported props to plain object
 * @param store
 * @param withNotExported - include props of stores with isNotExported persist option
 * @param attributes - only these props, undefined - all
 */
const getExportedProps = (
  store: TAnyStore,
  withNotExported: boolean,
  attributes?: Set<string>,
): Record<string, any> => {
  const result: Record<string, any> = {};

  if (typeof store !== 'object' || store === null) {
    return result;
  }

  for (const prop of getStoreKeys(store)) {
    if ((attributes && !attributes.has(prop)) || !isExportedProp(store, prop, withNotExported)) {
      continue;
    }

    const value = (store as Record<string, unknown>)[prop];

    result[prop] = isPropObservableExported(store, prop)
      ? getExportedProps(value as TAnyStore, false)
      : toJS(value);
  }

  return result;
};

/**
 * Get observable store props (fields)
 *
 * Converts only exported props: plain fields holding other stores are not traversed.
 */
const getObservableProps = (store: TAnyStore, withNotExported = false): Record<string, any> =>
  getExportedProps(store, withNotExported);

/**
 * Get store state for persist: only attributes saved in storages
 * @param store
 * @param attributes - persisted attributes, undefined - all
 */
const getPersistState = (store: IStorePersisted, attributes?: string[]): Record<string, any> =>
  store.toJSON?.() ?? getExportedProps(store, true, attributes && new Set(attributes));

export { getObservableProps, getPersistState };
