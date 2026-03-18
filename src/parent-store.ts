import type { IConstructableStore, IStoreConfig } from './types';

/**
 * Mark store definition as parent store
 */
const parentStore = <TStore extends IConstructableStore>(
  store: TStore,
): { store: TStore } & IStoreConfig => ({
  store,
  isParent: true as const,
});

export default parentStore;
