import EventManager from '@lomray/event-manager';
import { isObservableProp, toJS } from 'mobx';
import { ROOT_CONTEXT_ID } from './constants';
import deepMerge from './deep-merge';
import Events from './events';
import Logger from './logger';
import {
  isPropExcludedFromExport,
  isPropObservableExported,
  isPropSimpleExported,
} from './make-exported';
import onChangeListener from './on-change-listener';
import CombinedStorage from './storages/combined-storage';
import StoreStatus from './store-status';
import type {
  IConstructableStore,
  IGroupedStores,
  IManagerOptions,
  IManagerParams,
  IPersistOptions,
  IStoreParams,
  IStorePersisted,
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
   */
  protected readonly storesRelations = new Map<
    string, // contextId
    { ids: Set<string>; parentId: string | null; componentName?: string }
  >();

  /**
   * Save persisted stores identities
   */
  protected static readonly persistedStores = new Set<string>();

  /**
   * Initial stores state (local storage, custom etc.)
   */
  protected readonly initState: Record<string, any>;

  /**
   * Storage for persisted stores
   */
  public readonly storage?: CombinedStorage;

  /**
   * Additional store's constructor params
   */
  protected readonly storesParams: IManagerParams['storesParams'];

  /**
   * Manager options
   */
  public readonly options: IManagerOptions = {
    shouldDisablePersist: false,
    shouldRemoveInitState: true,
    failedCreationStrategy: 'empty',
  };

  /**
   * Suspense stores relations
   * @see withStores
   */
  protected suspenseRelations: Map<string, Set<string>> = new Map();

  /**
   * Mobx manager logger
   */
  protected readonly logger: Logger;

  /**
   * @constructor
   */
  public constructor({ initState, storesParams, storage, options, logger }: IManagerParams = {}) {
    this.initState = initState || {};
    this.storesParams = storesParams || {};
    this.logger =
      logger && 'log' in logger
        ? logger
        : new Logger({ level: 3, ...(logger ?? {}), manager: this });
    this.storage =
      storage instanceof CombinedStorage
        ? storage
        : storage
          ? new CombinedStorage({ default: storage })
          : undefined;

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
    try {
      if (this.storage) {
        await this.storage.get();
      }
    } catch (e) {
      this.logger.err('Failed initialized store manager: ', e);
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
        parentId: ROOT_CONTEXT_ID,
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
      this.logger.err(
        'Parent context has multiple stores with the same id, please pass key to getStore function.',
      );

      return undefined;
    }

    if (!parentId || parentId === ROOT_CONTEXT_ID) {
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
      initState: this.initState[id],
    });

    // assign params to new store
    newStore.libStoreId = id;
    newStore.isGlobal = store.isGlobal;
    newStore.libStoreContextId = store.isGlobal ? 'global' : contextId;
    newStore.libStoreParentId =
      store.isGlobal || !parentId || parentId === contextId ? ROOT_CONTEXT_ID : parentId;
    newStore.libStoreSuspenseId = suspenseId;
    newStore.libStoreComponentName = componentName;

    this.setStoreStatus(newStore, store.isGlobal ? StoreStatus.inUse : StoreStatus.init);
    this.prepareStore(newStore);
    EventManager.publish(Events.CREATE_STORE, { store });

    return newStore as T;
  }

  /**
   * Create stores for component
   *
   * NOTE: use only inside withStores wrapper
   */
  public createStores(
    map: [string, TStoreDefinition][],
    parentId: string,
    contextId: string,
    suspenseId: string,
    componentName: string,
    componentProps: Record<string, any> = {},
  ): IGroupedStores {
    const { failedCreationStrategy } = this.options;

    const result = map.reduce(
      (res, [key, store]) => {
        const {
          id,
          store: s,
          isParent = false,
        } = 'store' in store ? store : { store, id: undefined, isParent: false };
        let storeId =
          id ||
          (isParent
            ? (this.getStore(s, { contextId, parentId })?.libStoreId as string)
            : this.getStoreId(s, { key, contextId }));

        if (!storeId) {
          const msg = `Cannot find or create store '${key}': '${this.getStoreId(s)}'`;

          this.logger.warn(msg);
          this.logger.debug(
            msg,
            { contextId, parentId, suspenseId, componentName, isParent },
            true,
          );

          if (failedCreationStrategy === 'dummy') {
            // try to force create store
            storeId = this.getStoreId(s, { key, contextId });
          } else {
            if (failedCreationStrategy === 'empty') {
              res.hasCreationFailure = true;
            }

            return res;
          }
        }

        const storeInstance = this.createStore(s, {
          id: storeId,
          contextId,
          parentId,
          suspenseId,
          componentName,
          componentProps: !s.isGlobal && !isParent ? componentProps : {},
        });

        if (isParent) {
          res.parentStores[key] = storeInstance;
        } else if (storeInstance.isGlobal) {
          res.globalStores[key] = storeInstance;
        } else {
          res.relativeStores[key] = storeInstance;
        }

        return res;
      },
      { relativeStores: {}, parentStores: {}, globalStores: {}, hasCreationFailure: false },
    );

    // need create context relation in case when component doesn't include relative stores
    this.createRelationContext(contextId, parentId, componentName);

    return result;
  }

  /**
   * Create empty relation context
   */
  protected createRelationContext(
    contextId: string,
    parentId?: string,
    componentName?: string,
  ): void {
    if (this.storesRelations.has(contextId)) {
      return;
    }

    this.storesRelations.set(contextId, {
      ids: new Set(),
      parentId: !parentId || parentId === contextId ? ROOT_CONTEXT_ID : parentId,
      componentName,
    });
  }

  /**
   * Delete relation context id
   */
  protected removeRelationContext(contextId: string): void {
    const storesRelations = this.storesRelations.get(contextId);

    if (!storesRelations || contextId === ROOT_CONTEXT_ID || storesRelations.ids.size > 0) {
      return;
    }

    this.storesRelations.delete(contextId);
  }

  /**
   * Append callback to store destroy lifecycle
   */
  protected appendDestroyCallback(store: TStores[string], callback?: () => void): void {
    if (!callback) {
      return;
    }

    const onDestroyDefault = store.onDestroy?.bind(store);

    store.onDestroy = (): void => {
      callback();
      onDestroyDefault?.();
    };
  }

  /**
   * Prepare store before usage
   */
  protected prepareStore(store: TStores[string]): void {
    const storeId = store.libStoreId!;
    const contextId = store.libStoreContextId!;
    const suspenseId = store.libStoreSuspenseId!;

    if (this.stores.has(storeId)) {
      return;
    }

    // restore initial state from server
    const initState = this.initState[storeId];

    if (initState) {
      deepMerge(store, initState);
    }

    // restore persisted state
    if ('wakeup' in store && Manager.persistedStores.has(storeId)) {
      store.wakeup?.({
        initState,
        persistedState: this.storage?.getStoreData(store),
        manager: this,
      });
    }

    // track changes in persisted store
    if (Manager.persistedStores.has(storeId) && 'addOnChangeListener' in store) {
      const removeListener = store.addOnChangeListener!(store, this);

      this.appendDestroyCallback(store, removeListener);
    }

    const initCleanup = store.init?.();

    if (typeof initCleanup === 'function') {
      this.appendDestroyCallback(store, initCleanup);
    }

    this.createRelationContext(contextId, store.libStoreParentId, store.libStoreComponentName);

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

    this.removeRelationContext(store.libStoreContextId!);

    if ('onDestroy' in store) {
      store.onDestroy?.();
    }

    EventManager.publish(Events.DELETE_STORE, { store });
  }

  /**
   * Mount stores to component
   *
   * NOTE: use only inside withStores wrapper
   */
  public mountStores(
    contextId: string,
    { globalStores = {}, relativeStores = {} }: Partial<IGroupedStores>,
  ): () => void {
    const { shouldRemoveInitState } = this.options;
    const touchableStores = { ...globalStores, ...relativeStores };

    Object.values(touchableStores).forEach((store) => {
      const storeId = store.libStoreId!;

      // cleanup init state
      if (shouldRemoveInitState && this.initState[storeId]) {
        delete this.initState[storeId];
      }

      this.setStoreStatus(store, StoreStatus.inUse);
      EventManager.publish(Events.MOUNT_STORE, { store });
    });

    return () => {
      Object.values(touchableStores).forEach((store) => {
        if (store.isGlobal) {
          return;
        }

        this.setStoreStatus(store, StoreStatus.unused);
        EventManager.publish(Events.UNMOUNT_STORE, { store });
      });

      this.removeRelationContext(contextId);
    };
  }

  /**
   * Destroy manager stores and detach internal relations
   */
  public destroy(): void {
    for (const store of Array.from(this.stores.values())) {
      clearTimeout(store.libDestroyTimer);
      this.removeStore(store);
    }

    this.storesRelations.clear();
    this.suspenseRelations.clear();
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
   * Get store state
   */
  public getStoreState(store: TAnyStore, withNotExported = false): Record<string, any> {
    return store.toJSON?.() ?? Manager.getObservableProps(store, withNotExported);
  }

  /**
   * Get store's state
   */
  public toJSON(ids?: string[], isIncludeExported = false): Record<string, any> {
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
      result[storeId] = this.getStoreState(store, isIncludeExported);
    }

    return result;
  }

  /**
   * Save persisted store state to provided storage
   */
  public async savePersistedStore(store: IStorePersisted): Promise<boolean> {
    if (this.options.shouldDisablePersist || !this.storage) {
      return false;
    }

    try {
      await this.storage.saveStoreData(store, this.getStoreState(store, true));

      return true;
    } catch (e) {
      this.logger.err('Failed to persist stores: ', e);
    }

    return false;
  }

  /**
   * Get observable store props (fields)
   */
  public static getObservableProps(store: TAnyStore, withNotExported = false): Record<string, any> {
    const props = toJS(store);

    return Object.entries(props).reduce(
      (res, [prop, value]) => ({
        ...res,
        ...((isObservableProp(store, prop) &&
          !isPropExcludedFromExport(store, prop, withNotExported)) ||
        isPropSimpleExported(store, prop)
          ? { [prop]: value }
          : {}),
        ...(isPropObservableExported(store, prop)
          ? { [prop]: Manager.getObservableProps(store[prop] as TAnyStore) }
          : {}),
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
    options: IPersistOptions = {},
  ): IConstructableStore<TSt> {
    Manager.persistedStores.add(id);

    store.libStoreId = id;

    // add storage options
    if (!('libStorageOptions' in store.prototype)) {
      store.prototype.libStorageOptions = options;
    }

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
