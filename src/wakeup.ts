import type { IStorePersisted } from './types';

/**
 * Restore store state from initial state
 */
const wakeup: IStorePersisted['wakeup'] = (store, { persistedState }) => {
  if (persistedState) {
    Object.assign(store, persistedState);
  }
};

export default wakeup;
