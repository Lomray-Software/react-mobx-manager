import deepMerge from './deep-merge';
import type { IStorePersisted, TWakeup } from './types';

/**
 * Restore persisted store state
 */
function wakeup(
  this: IStorePersisted,
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
