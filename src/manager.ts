import { toJS, isObservableProp } from 'mobx';
import onChangeListener from './on-change-listener';
import type {
  IConstructableStore,
  IManagerParams,
  IStorage,
  IStore,
  TStoreDefinition,
  IManagerOptions,
  TStores,
  IStoreLifecycle,
  TInitStore,
} from './types';
import wakeup from './wakeup';

/**
 * Mobx stores manager
 */
class Manager {
  /**
   * Manger instance
   */
  protected static instance: Manager;

  /**
   * Created stores
   */
  private readonly stores = new Map<string, TInitStore>();

  /**
   * Save persisted stores identities
   * @private
   */
  protected static readonly persistedStores = new Set<string>();

  /**
   * Initial stores state (local storage, custom etc.)
   * @private
   */
  protected readonly initState: Record<string, any>;

  /**
   * Storage for persisted stores
   * @private
   */
  public readonly storage: IStorage | undefined;

  /**
   * Restored persist storage data
   * @protected
   */
  protected persistData: Record<string, any> = {};

  /**
   * Additional store's constructor params
   * @private
   */
  protected readonly storesParams: IManagerParams['storesParams'];

  /**
   * Manager options
   * @private
   */
  public readonly options: IManagerOptions = {
    shouldDisablePersist: false,
    shouldRemoveInitState: true,
  };

  /**
   * @constructor
   */
  public constructor({ initState, storesParams, storage, options }: IManagerParams) {
    this.initState = initState || {};
    this.storesParams = storesParams;
    this.storage = storage;

    Object.assign(this.options, options);

    Manager.instance = this;
  }

  /**
   * Init store manager
   */
  public async init(): Promise<Manager> {
    if (this.storage) {
      this.persistData = (await this.storage.get()) || {};
    }

    return this;
  }

  /**
   * Get manager instance
   * NOTE: Need call 'init' before call this method
   */
  public static get(): Manager {
    if (!Manager.instance) {
      throw new Error('Store manager is not initialized.');
    }

    return Manager.instance;
  }

  /**
   * Get store identity
   * @protected
   */
  protected static getStoreKey<T>(store: IConstructableStore<T> | TInitStore, id?: string): string {
    return id || store.id || (store['name'] as string) || store.constructor.name;
  }

  /**
   * Get exist store
   */
  public getStore<T>(store: IConstructableStore<T>, id?: string): T | undefined {
    const storeKey = Manager.getStoreKey(store, id);

    if (this.stores.has(storeKey)) {
      return this.stores.get(storeKey) as T;
    }

    // in case get from another store
    if (store.isSingleton) {
      return this.createStore(store, id);
    }

    return undefined;
  }

  /**
   * Create new store instance
   * @protected
   */
  protected createStore<T>(store: IConstructableStore<T>, id?: string): T {
    const storeKey = Manager.getStoreKey(store, id);
    const existStore = this.stores.get(storeKey);

    if (existStore) {
      return existStore as T;
    }

    const newStore = new store({ storeManager: this, ...this.storesParams });

    // assign id to new store
    newStore.id = storeKey;
    newStore.isSingleton = store.isSingleton;

    const initState = this.initState[storeKey];
    const persistedState = this.persistData[storeKey];

    if (initState) {
      Object.assign(newStore, initState);

      if (this.options.shouldRemoveInitState) {
        delete this.initState[storeKey];
      }
    }

    // Detect persisted store and restore state
    if ('wakeup' in newStore && Manager.persistedStores.has(storeKey)) {
      newStore.wakeup?.(newStore, { initState, persistedState });
      newStore.addOnChangeListener?.(newStore, this);
    }

    this.stores.set(storeKey, newStore);
    newStore.init?.();

    return newStore as T;
  }

  /**
   * Create stores for component
   */
  public createStores(map: [string, TStoreDefinition][]): TStores {
    return map.reduce((res, [key, store]) => {
      const [s, id] = 'store' in store ? [store.store, store.id] : [store];

      return {
        ...res,
        [key]: this.createStore(s, id),
      };
    }, {});
  }

  /**
   * Mount stores to component
   */
  public mountStores(stores: TStores): () => void {
    const unmountCallbacks: Required<IStoreLifecycle>['onDestroy'][] = [];

    Object.values(stores).forEach((store) => {
      if ('onMount' in store) {
        const unsubscribe = store.onMount?.();

        if (typeof unsubscribe === 'function') {
          unmountCallbacks.push(unsubscribe);
        }
      }

      if ('onDestroy' in store) {
        unmountCallbacks.push(() => store.onDestroy?.());
      }
    });

    return () => {
      unmountCallbacks.forEach((callback) => callback());
      Object.values(stores).forEach((store) => {
        const storeKey = Manager.getStoreKey(store);

        if (!store.isSingleton) {
          this.stores.delete(storeKey);
        }
      });
    };
  }

  /**
   * Get store's state
   */
  public toJSON(): Record<string, any> {
    const result = {};

    for (const [storeKey, store] of this.stores.entries()) {
      result[storeKey] = store.toJSON?.() ?? Manager.getObservableProps(store);
    }

    return result;
  }

  /**
   * Get persisted store's data
   */
  public toPersistedJSON(): Record<string, any> {
    const result = {};

    for (const storeKey of Manager.persistedStores) {
      const store = this.stores.get(storeKey);

      if (!store) {
        continue;
      }

      result[storeKey] = store['toJSON']?.() ?? Manager.getObservableProps(store);
    }

    return result;
  }

  /**
   * Get observable store props (fields)
   * @private
   */
  public static getObservableProps(store: IStore): Record<string, any> {
    const props = toJS(store);

    return Object.entries(props).reduce(
      (res, [prop, value]) => ({
        ...res,
        ...(isObservableProp(store, prop) ? { [prop]: value } : {}),
      }),
      {},
    );
  }

  /**
   * Persist store
   */
  public static persistStore<TSt>(
    store: IConstructableStore<TSt>,
    id: string,
  ): IConstructableStore<TSt> {
    const storeKey = Manager.getStoreKey(store, id);

    if (Manager.persistedStores.has(storeKey)) {
      throw new Error(`Duplicate serializable store key: ${storeKey}`);
    }

    Manager.persistedStores.add(id);

    store.id = storeKey;

    // add default wakeup handler
    if (!('wakeup' in store.prototype)) {
      store.prototype.wakeup = wakeup;
    }

    // add default changes listener
    if (!('addOnChangeListener' in store.prototype)) {
      store.prototype.addOnChangeListener = onChangeListener;
    }

    return store;
  }
}

export default Manager;
