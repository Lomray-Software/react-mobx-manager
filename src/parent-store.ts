import type { IConstructableStore, TAnyStore } from './types';

/**
 * Mark store definition as parent store
 */
const parentStore = <TSto extends TAnyStore>(store: IConstructableStore<TSto>) => ({
  store,
  isParent: true as const,
});

export default parentStore;
