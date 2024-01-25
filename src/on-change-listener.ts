import { reaction, toJS } from 'mobx';
import type { IStorePersisted } from './types';

/**
 * Listen persist store changes
 */
const onChangeListener: IStorePersisted['addOnChangeListener'] = (store, manager) => {
  if (manager.options.shouldDisablePersist || !manager.storage) {
    return;
  }

  return reaction(
    () => store.toJSON?.() ?? toJS(store),
    () => {
      void manager.savePersistedStore(store);
    },
  );
};

export default onChangeListener;
