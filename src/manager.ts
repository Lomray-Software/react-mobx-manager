import EventManager from '@lomray/event-manager';
import { toJS, isObservableProp } from 'mobx';
import Events from './events';
import onChangeListener from './on-change-listener';
import type StreamStores from './server/stream-stores';
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
    { ids: Set<string>; parentId: string | null; componentName?: string }
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
   * Attached stream store service
   * @see StreamStores.create
   */
  public streamStores?: StreamStores;

  /**
   * @constructor
   */
  public constructor({ initState, storesParams, storage, options }: IManagerParams = {}) {
    this.initState = initState || {};
    this.storesParams = storesParams || {};
    this.storage = storage;

    Object.assign(this.options, options || {});

    Manager.instance = this;

    // only client side
    if (typeof window !== 'undefined' && !window.mobxManager) {
      window.mobxManager = { pushInit: this.pushInitState };
    }
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
   * Get all stores
   */
  public getStores(): Manager['stores'] {
    return this.stores;
  }

  /**
   * Get stores relations
   */
  public getStoresRelations(): Manager['storesRelations'] {
    return this.storesRelations;
  }

  /**
   * Get persisted stores ids
   */
  public static getPersistedStoresIds(): Set<string> {
    return Manager.persistedStores;
  }

  /**
   * Push initial state dynamically
   * E.g. when stream html
   */
  public pushInitState = (storesState: Record<string, any> = {}): void => {
    for (const [storeId, state] of Object.entries(storesState)) {
      this.initState[storeId] = state;
    }
  };

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

    if (store.libStoreId) {
      return store.libStoreId;
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
        componentName: 'root-app',
        componentProps: {},
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
    const { id, contextId, parentId, componentName, componentProps } = params;

    // only for singleton store
    if ((store.isSingleton || isSSR) && this.stores.has(id)) {
      return this.stores.get(id) as T;
    }

    const newStore = new store({
      ...this.storesParams,
      storeManager: this,
      getStore: <TS>(
        targetStore: IConstructableStore<TS>,
        targetParams = { contextId, parentId },
      ) => this.getStore(targetStore, targetParams),
      componentProps,
    });

    // assign params to new store
    newStore.libStoreId = id;
    newStore.isSingleton = store.isSingleton;
    newStore.libStoreContextId = store.isSingleton ? 'singleton' : contextId;
    newStore.libStoreParentId =
      store.isSingleton || !parentId || parentId === contextId ? 'root' : parentId;
    newStore.libStoreComponentName = componentName;

    const initState = this.initState[id];
    const persistedState = this.persistData[id];

    if (initState) {
      Object.assign(newStore, initState);
    }

    EventManager.publish(Events.CREATE_STORE, { store });

    // Detect persisted store and restore state
    if ('wakeup' in newStore && Manager.persistedStores.has(id)) {
      newStore.wakeup?.(newStore, { initState, persistedState });
    }

    newStore.init?.();
    this.prepareStore(newStore);

    if (newStore.isSingleton || isSSR) {
      this.prepareMount(newStore);
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
    componentName: string,
    componentProps: Record<string, any> = {},
  ): TStores {
    return map.reduce((res, [key, store]) => {
      const [s, id] =
        'store' in store
          ? [store.store, store.id!]
          : [store, this.getStoreId(store, { key, contextId })];

      return {
        ...res,
        [key]: this.createStore(s, { id, contextId, parentId, componentName, componentProps }),
      };
    }, {});
  }

  /**
   * Prepare store before usage
   * @protected
   */
  protected prepareStore(store: TStores[string]): void {
    const storeId = store.libStoreId!;
    const contextId = store.libStoreContextId!;

    if (!this.storesRelations.has(contextId)) {
      this.storesRelations.set(contextId, {
        ids: new Set(),
        parentId:
          !store.libStoreParentId || store.libStoreParentId === contextId
            ? 'root'
            : store.libStoreParentId,
        componentName: store.libStoreComponentName,
      });
    }

    const { ids } = this.storesRelations.get(contextId)!;

    // add store to manager
    if (!this.stores.has(storeId)) {
      this.stores.set(storeId, store);
      ids.add(storeId);
      EventManager.publish(Events.ADD_STORE, { store });
    }
  }

  /**
   * Prepare store before mount to component
   * @protected
   */
  protected prepareMount(store: TStores[string]): Required<IStoreLifecycle>['onDestroy'][] {
    const { shouldRemoveInitState } = this.options;
    const storeId = store.libStoreId!;
    const unmountCallbacks: Required<IStoreLifecycle>['onDestroy'][] = [];

    // track changes in persisted store
    if (Manager.persistedStores.has(storeId) && 'addOnChangeListener' in store) {
      unmountCallbacks.push(store.addOnChangeListener!(store, this)!);
    }

    // cleanup init state
    if (shouldRemoveInitState && this.initState[storeId]) {
      delete this.initState[storeId];
    }

    return unmountCallbacks;
  }

  /**
   * Mount stores to component
   */
  public mountStores(stores: TStores): () => void {
    const unmountCallbacks: Required<IStoreLifecycle>['onDestroy'][] = [];

    Object.values(stores).forEach((store) => {
      /**
       * Fix react 18 concurrent mode, twice mount etc.
       */
      this.prepareStore(store);

      unmountCallbacks.push(...this.prepareMount(store));
      EventManager.publish(Events.MOUNT_STORE, { store });

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
        const storeId = store.libStoreId!;

        EventManager.publish(Events.UNMOUNT_STORE, { store });

        if (!store.isSingleton) {
          const { ids } = this.storesRelations.get(store.libStoreContextId!) ?? { ids: new Set() };

          this.stores.delete(storeId);
          ids.delete(storeId);
          EventManager.publish(Events.DELETE_STORE, { store });

          // cleanup
          if (!ids.size) {
            this.storesRelations.delete(store.libStoreContextId!);
          }
        }
      });
    };
  }

  /**
   * Get store's state
   */
  public toJSON(ids?: string[]): Record<string, any> {
    const result = {};
    const stores =
      ids?.reduce((res, id) => {
        if (this.stores.has(id)) {
          res.set(id, this.stores.get(id)!);
        }

        return res;
      }, new Map<string, TInitStore>()) ?? this.stores;

    for (const [storeId, store] of stores.entries()) {
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
      console.warn(`Duplicate serializable store key: ${id}`);

      return store;
    }

    Manager.persistedStores.add(id);

    store.libStoreId = id;

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
