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
  IStoreParams,
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
  protected readonly stores = new Map<string, TInitStore>();

  /**
   * Relations between stores
   * @protected
   */
  protected readonly storesRelations = new Map<
    string, // contextId
    { ids: Set<string>; parentId: string | null }
  >();

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
   */
  public readonly options: IManagerOptions = {
    shouldDisablePersist: false,
    shouldRemoveInitState: true,
    isSSR: false,
  };

  /**
   * @constructor
   */
  public constructor({ initState, storesParams, storage, options }: IManagerParams = {}) {
    this.initState = initState || {};
    this.storesParams = storesParams || {};
    this.storage = storage;

    Object.assign(this.options, options || {});

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
  protected getStoreId<T>(
    store: IConstructableStore<T> | TInitStore,
    params: IStoreParams = {},
  ): string {
    const { id, contextId, key } = params;

    if (id) {
      return id;
    }

    if (store.id) {
      return store.id;
    }

    let storeId = (store['name'] as string) || store.constructor.name;

    if (store.isSingleton) {
      return storeId;
    }

    storeId = `${storeId}--${contextId!}`;

    return key ? `${storeId}--${key}` : storeId;
  }

  /**
   * Generate new context id
   */
  public createContextId(id?: string): string {
    return `ctx${id || this.storesRelations.size + 1}`;
  }

  /**
   * Get exist store
   */
  public getStore<T>(store: IConstructableStore<T>, params: IStoreParams = {}): T | undefined {
    const storeId = this.getStoreId(store, params);

    // full match
    if (this.stores.has(storeId)) {
      return this.stores.get(storeId) as T;
    }

    // in case with singleton (create if not exist)
    if (store.isSingleton) {
      return this.createStore(store, {
        id: storeId,
        contextId: 'singleton',
        parentId: 'root',
      });
    }

    // try to look up store in current or parent context
    return this.lookupStore(storeId, params);
  }

  /**
   * Lookup store
   * @protected
   */
  protected lookupStore<T>(id: string, params: IStoreParams): TInitStore<T> | undefined {
    const { contextId, parentId: defaultParentId } = params;
    const clearId = id.split('--')?.[0];
    const { ids, parentId } = this.storesRelations.get(contextId!) ?? {
      ids: new Set(),
      parentId: defaultParentId,
    };

    const matchedIds = [...ids].filter((storeId) => storeId.startsWith(`${clearId}--`));

    if (matchedIds.length === 1) {
      return this.stores.get(matchedIds[0]) as T;
    } else if (matchedIds.length > 1) {
      console.error(
        'Parent context has multiple stores with the same id, please pass key to getStore function.',
      );

      return undefined;
    }

    if (!parentId || parentId === 'root') {
      return undefined;
    }

    return this.lookupStore(id, { contextId: parentId });
  }

  /**
   * Create new store instance
   * @protected
   */
  protected createStore<T>(
    store: IConstructableStore<T>,
    params: Omit<Required<IStoreParams>, 'key'>,
  ): T {
    const { isSSR } = this.options;
    const { id, contextId, parentId } = params;

    // only for singleton store
    if ((store.isSingleton || isSSR) && this.stores.has(id)) {
      return this.stores.get(id) as T;
    }

    const newStore = new store({
      storeManager: this,
      getStore: <TS>(
        targetStore: IConstructableStore<TS>,
        targetParams = { contextId, parentId },
      ) => this.getStore(targetStore, targetParams),
      ...this.storesParams,
    });

    // assign params to new store
    newStore.id = id;
    newStore.isSingleton = store.isSingleton;
    newStore.contextId = store.isSingleton ? 'singleton' : contextId;
    newStore.parentId =
      store.isSingleton || !parentId || parentId === contextId ? 'root' : parentId;

    const initState = this.initState[id];
    const persistedState = this.persistData[id];

    if (initState) {
      Object.assign(newStore, initState);
    }

    // Detect persisted store and restore state
    if ('wakeup' in newStore && Manager.persistedStores.has(id)) {
      newStore.wakeup?.(newStore, { initState, persistedState });
    }

    newStore.init?.();

    if (newStore.isSingleton || isSSR) {
      this.prepareStore(newStore);
    }

    return newStore as T;
  }

  /**
   * Create stores for component
   */
  public createStores(
    map: [string, TStoreDefinition][],
    parentId: string,
    contextId: string,
  ): TStores {
    return map.reduce((res, [key, store]) => {
      const [s, id] =
        'store' in store
          ? [store.store, store.id!]
          : [store, this.getStoreId(store, { key, contextId })];

      return {
        ...res,
        [key]: this.createStore(s, { id, contextId, parentId }),
      };
    }, {});
  }

  /**
   * Prepare store before usage
   * @protected
   */
  protected prepareStore(store: TStores[string]): Required<IStoreLifecycle>['onDestroy'][] {
    const { shouldRemoveInitState } = this.options;
    const storeId = store.id!;
    const contextId = store.contextId!;
    const unmountCallbacks: Required<IStoreLifecycle>['onDestroy'][] = [];

    if (!this.storesRelations.has(contextId)) {
      this.storesRelations.set(contextId, {
        ids: new Set(),
        parentId: !store.parentId || store.parentId === contextId ? 'root' : store.parentId,
      });
    }

    const { ids } = this.storesRelations.get(contextId)!;

    // track changes in persisted store
    if (Manager.persistedStores.has(storeId) && 'addOnChangeListener' in store) {
      unmountCallbacks.push(store.addOnChangeListener!(store, this)!);
    }

    // cleanup init state
    if (shouldRemoveInitState && this.initState[storeId]) {
      delete this.initState[storeId];
    }

    // add store to manager
    if (!this.stores.has(storeId)) {
      this.stores.set(storeId, store);
      ids.add(storeId);
    }

    return unmountCallbacks;
  }

  /**
   * Mount stores to component
   */
  public mountStores(stores: TStores): () => void {
    const unmountCallbacks: Required<IStoreLifecycle>['onDestroy'][] = [];

    Object.values(stores).forEach((store) => {
      unmountCallbacks.push(...this.prepareStore(store));

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
        const storeId = store.id!;

        if (!store.isSingleton) {
          const { ids } = this.storesRelations.get(store.contextId!) ?? { ids: new Set() };

          this.stores.delete(storeId);
          ids.delete(storeId);

          // cleanup
          if (!ids.size) {
            this.storesRelations.delete(store.contextId!);
          }
        }
      });
    };
  }

  /**
   * Get store's state
   */
  public toJSON(): Record<string, any> {
    const result = {};

    for (const [storeId, store] of this.stores.entries()) {
      result[storeId] = store.toJSON?.() ?? Manager.getObservableProps(store);
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
    if (Manager.persistedStores.has(id)) {
      console.error(`Duplicate serializable store key: ${id}`);

      return store;
    }

    Manager.persistedStores.add(id);

    store.id = id;

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
