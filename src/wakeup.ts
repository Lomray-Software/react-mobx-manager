import deepMerge from './deep-merge';
import type { TStores, TWakeup } from './types';

/**
 * Restore persisted store state
 */
function wakeup(this: TStores[string], { persistedState }: Parameters<TWakeup>[0]) {
  if (persistedState) {
    deepMerge(this, persistedState);
  }
}

export default wakeup;
