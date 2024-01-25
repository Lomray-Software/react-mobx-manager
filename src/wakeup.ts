import deepMerge from './deep-merge';
import type { TStores, TWakeup } from './types';

/**
 * Restore persisted store state
 */
function wakeup(
  this: TStores[string],
  { initState, persistedState, manager }: Parameters<TWakeup>[0],
) {
  const resState = {};

  deepMerge(resState, persistedState);

  const shouldSave = initState && deepMerge(resState, initState);

  deepMerge(this, resState);

  if (shouldSave) {
    void manager.savePersistedStore(this);
  }
}

export default wakeup;
