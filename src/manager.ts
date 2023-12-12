import EventManager from '@lomray/event-manager';
import { isObservableProp, toJS } from 'mobx';
import Events from './events';
import onChangeListener from './on-change-listener';
import StoreStatus from './store-status';
import type {
  IConstructableStore,
  IManagerOptions,
  IManagerParams,
  IStorage,
  IStoreParams,
  TAnyStore,
  TInitStore,
  TStoreDefinition,
  TStores,
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
  };

  /**
   * Suspense stores relations
   * @see withStores
   */
  protected suspenseRelations: Map<string, Set<string>> = new Map();

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
    if (typeof window !== 'undefined') {
      const state = window.mbxM;

      window.mbxM = { push: this.pushInitState };

      (Array.isArray(state) ? state : []).forEach(this.pushInitState);
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
   * Get suspense relations with stores
   */
  public getSuspenseRelations(): Manager['suspenseRelations'] {
    return this.suspenseRelations;
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
  protected getStoreId<T extends TAnyStore>(
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

    let storeId = (store['id'] as string) || (store['name'] as string) || store.constructor.name;

    if (store.isGlobal) {
      return storeId;
    }

    storeId = `${storeId}--${contextId!}`;

    return key ? `${storeId}--${key}` : storeId;
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

    // in case with global store (create if not exist)
    if (store.isGlobal) {
      return this.createStore(store, {
        id: storeId,
        contextId: 'global',
        parentId: 'root',
        suspenseId: '',
        componentName: 'root-app',
        componentProps: {},
      });
    }

    // try to look up store in current or parent context
    return this.lookupStore(storeId, params) as T;
  }

  /**
   * Lookup store
   */
  protected lookupStore(id: string, params: IStoreParams): TInitStore<TAnyStore> | undefined {
    const { contextId, parentId: defaultParentId } = params;
    const clearId = id.split('--')?.[0];
    const { ids, parentId } = this.storesRelations.get(contextId!) ?? {
      ids: new Set(),
      parentId: defaultParentId,
    };

    const matchedIds = [...ids].filter((storeId) => storeId.startsWith(`${clearId}--`));

    if (matchedIds.length === 1) {
      return this.stores.get(matchedIds[0]);
    } else if (matchedIds.length > 1) {
      console.error(
        'Parent context has multiple stores with the same id, please pass key to getStore function.',
      );

      return undefined;
    }

    if (!parentId || parentId === 'root') {
      return undefined;
    }

    return this.lookupStore(id, { contextId: this.getBiggerContext(parentId, defaultParentId) });
  }

  /**
   * Get bigger context from two
   */
  protected getBiggerContext(ctx1?: string, ctx2?: string): string | undefined {
    if (!ctx1) {
      return ctx2;
    } else if (!ctx2) {
      return ctx1;
    }

    const regexp = /[^a-zA-Z]/g;

    return ctx1.replace(regexp, '') > ctx2.replace(regexp, '') ? ctx1 : ctx2;
  }

  /**
   * Create new store instance
   */
  protected createStore<T>(
    store: IConstructableStore<T>,
    params: Omit<Required<IStoreParams>, 'key'>,
  ): T {
    const { id, contextId, parentId, suspenseId, componentName, componentProps } = params;

    // only for global store
    if (this.stores.has(id)) {
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
    newStore.isGlobal = store.isGlobal;
    newStore.libStoreContextId = store.isGlobal ? 'global' : contextId;
    newStore.libStoreParentId =
      store.isGlobal || !parentId || parentId === contextId ? 'root' : parentId;
    newStore.libStoreSuspenseId = suspenseId;
    newStore.libStoreComponentName = componentName;

    this.setStoreStatus(newStore, store.isGlobal ? StoreStatus.inUse : StoreStatus.init);
    this.prepareStore(newStore);
    EventManager.publish(Events.CREATE_STORE, { store });

    return newStore as T;
  }

  /**
   * Create stores for component
   */
  public createStores(
    map: [string, TStoreDefinition][],
    parentId: string,
    contextId: string,
    suspenseId: string,
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
        [key]: this.createStore(s, {
          id,
          contextId,
          parentId,
          suspenseId,
          componentName,
          componentProps,
        }),
      };
    }, {});
  }

  /**
   * Prepare store before usage
   */
  protected prepareStore(store: TStores[string]): void {
    const storeId = store.libStoreId!;
    const contextId = store.libStoreContextId!;
    const suspenseId = store.libStoreSuspenseId!;

    // restore initial state from server
    const initState = this.initState[storeId];
    const persistedState = this.persistData[storeId];

    if (this.stores.has(storeId)) {
      return;
    }

    if (initState) {
      Object.assign(store, initState);
    }

    // restore persisted state
    if ('wakeup' in store && Manager.persistedStores.has(storeId)) {
      store.wakeup?.({ initState, persistedState });
    }

    // track changes in persisted store
    if (Manager.persistedStores.has(storeId) && 'addOnChangeListener' in store) {
      const onDestroyDefault = store.onDestroy?.bind(store);
      const removeListener = store.addOnChangeListener!(store, this);

      store.onDestroy = () => {
        removeListener?.();
        onDestroyDefault?.();
      };
    }

    store.init?.();

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

    if (!this.suspenseRelations.has(suspenseId)) {
      this.suspenseRelations.set(suspenseId, new Set());
    }

    const { ids } = this.storesRelations.get(contextId)!;

    // add store to manager
    this.stores.set(storeId, store);
    ids.add(storeId);
    // add store relation with suspense
    this.suspenseRelations.get(suspenseId)!.add(storeId);
  }

  /**
   * Remove store
   */
  protected removeStore(store: TStores[string]): void {
    const storeId = store.libStoreId!;
    const suspenseId = store.libStoreSuspenseId!;
    const { ids } = this.storesRelations.get(store.libStoreContextId!) ?? { ids: new Set() };

    if (!this.stores.has(storeId)) {
      return;
    }

    this.stores.delete(storeId);
    ids.delete(storeId);

    if (suspenseId && this.suspenseRelations.get(suspenseId)?.has(storeId)) {
      this.suspenseRelations.get(suspenseId)!.delete(storeId);
    }

    // cleanup store relations
    if (!ids.size) {
      this.storesRelations.delete(store.libStoreContextId!);
    }

    if ('onDestroy' in store) {
      store.onDestroy?.();
    }

    EventManager.publish(Events.DELETE_STORE, { store });
  }

  /**
   * Mount stores to component
   */
  public mountStores(stores: TStores): () => void {
    const { shouldRemoveInitState } = this.options;

    Object.values(stores).forEach((store) => {
      const storeId = store.libStoreId!;

      // cleanup init state
      if (shouldRemoveInitState && this.initState[storeId]) {
        delete this.initState[storeId];
      }

      this.setStoreStatus(store, StoreStatus.inUse);
      EventManager.publish(Events.MOUNT_STORE, { store });
    });

    return () => {
      Object.values(stores).forEach((store) => {
        if (store.isGlobal) {
          return;
        }

        this.setStoreStatus(store, StoreStatus.unused);
        EventManager.publish(Events.UNMOUNT_STORE, { store });
      });
    };
  }

  /**
   * Change the stores status to touched
   */
  public touchedStores(stores: TStores): void {
    Object.values(stores).forEach((store) => {
      if (store.libStoreStatus !== StoreStatus.init || store.isGlobal) {
        return;
      }

      this.setStoreStatus(store, StoreStatus.touched);
    });
  }

  /**
   * Change store status
   */
  protected setStoreStatus(store: TStores[string], status: StoreStatus): void {
    const { destroyTimers: { init = 500, touched = 10000, unused = 1000 } = {} } = this.options;

    store.libStoreStatus = status;

    clearTimeout(store.libDestroyTimer);

    let destroyTime = 0;

    switch (status) {
      case StoreStatus.init:
        destroyTime = init;
        break;

      case StoreStatus.touched:
        destroyTime = touched;
        break;

      case StoreStatus.unused:
        destroyTime = unused;
        break;
    }

    if (!destroyTime) {
      return;
    }

    store.libDestroyTimer = setTimeout(() => this.removeStore(store), destroyTime);
  }

  /**
   * Get store's state
   */
  public toJSON(ids?: string[]): Record<string, any> {
    const result = {};
    const stores = Array.isArray(ids)
      ? ids.reduce((res, id) => {
          if (this.stores.has(id)) {
            res.set(id, this.stores.get(id)!);
          }

          return res;
        }, new Map<string, TInitStore>())
      : this.stores;

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
   */
  public static getObservableProps(store: TAnyStore): Record<string, any> {
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
