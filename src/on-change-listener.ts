import { reaction } from 'mobx';
import type { IStorePersisted } from './types';

/**
 * Listen persist store changes
 *
 * Tracks only attributes which are saved to storages (other stores referenced by the store
 * are not traversed). The reaction is re-run by the manager in batches: many changes
 * during Manager.options.persistDelay are serialized and saved once.
 */
const onChangeListener: IStorePersisted['addOnChangeListener'] = (store, manager) => {
  if (manager.options.shouldDisablePersist || !manager.storage) {
    return;
  }

  let run: (() => void) | undefined;
  let result: { state?: Record<string, any>; error?: unknown } | undefined;
  let version = 0;

  /**
   * Re-run reaction: collect store state and track dependencies again
   */
  const getState = (): Record<string, any> | undefined => {
    const runReaction = run;

    run = undefined;
    result = {};
    runReaction?.();

    const { state, error } = result;

    result = undefined;

    if (error) {
      throw error;
    }

    return state;
  };

  return reaction(
    () => {
      // the first run only subscribes to changes: result is collected by getState
      try {
        const state = manager.getPersistState(store);

        if (result) {
          result.state = state;
        }
      } catch (error) {
        if (result) {
          result.error = error;
        }
      }

      // don't keep the state inside reaction
      return ++version;
    },
    () => undefined,
    {
      scheduler: (runReaction) => {
        run = runReaction;
        manager.schedulePersist(store, getState);
      },
    },
  );
};

export default onChangeListener;
