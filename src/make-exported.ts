import type { TAnyStore } from '@src/types';

const exportedPropName = 'libExported';

/**
 * Make store props exported for Manager.toJSON
 * @see Manager.toJSON
 */
const makeExported = <T extends object>(
  store: T,
  props: {
    [P in Exclude<keyof T, 'toString'>]?: 'observable' | 'simple';
  },
): void => {
  store[exportedPropName] = props;
};

/**
 * Check if store prop is observable exported
 */
const isPropObservableExported = (store: TAnyStore, prop: string): boolean =>
  store?.[exportedPropName]?.[prop] === 'observable';

/**
 * Check if store prop is simple exported
 */
const isPropSimpleExported = (store: TAnyStore, prop: string): boolean =>
  store?.[exportedPropName]?.[prop] === 'simple';

export { makeExported, isPropObservableExported, isPropSimpleExported };
