import { reaction, toJS } from 'mobx';
import type { IStorePersisted } from './types';

/**
 * Listen persist store changes
 */
const onChangeListener: IStorePersisted['addOnChangeListener'] = (store, manager) => {
  const { shouldDisablePersist } = manager.options;

  if (shouldDisablePersist || !manager.storage) {
    return;
  }

  return reaction(
    () => store.toJSON?.() ?? toJS(store),
    () => {
      try {
        manager.storage?.set(manager.toPersistedJSON())?.catch((e: Error) => {
          console.error('Failed to persist stores #1: ', e);
        });
      } catch (e) {
        console.error('Failed to persist stores #2: ', e);
      }
    },
  );
};

export default onChangeListener;
