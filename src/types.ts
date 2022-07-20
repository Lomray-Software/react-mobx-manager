import type Manager from './manager';

export interface IConstructorParams {
  storeManager: Manager;
}

export interface IStoreLifecycle {
  onDestroy?: () => void;
  onMount?: () => void | (() => void);
}

export interface IStore extends IStoreLifecycle {
  id?: string; // static
  isSingleton?: boolean; // static
  init?: () => void;
  toJSON?: () => Record<string, any>;
}

export interface IStorePersisted extends IStore {
  addOnChangeListener?: (store: IStorePersisted, manager: Manager) => (() => void) | undefined;
  wakeup?: TWakeup;
}

export type TInitStore<TSto extends IStore | IStorePersisted = IStore> = TSto &
  (IStorePersisted | IStore);

export type IConstructableStore<TSto extends IStore = IStore> = (new (
  props: IConstructorParams,
) => TInitStore<TSto>) &
  Partial<IStorePersisted>;

export type TStoreDefinition<TSto extends IStore | IStorePersisted = any> =
  | IConstructableStore<TSto>
  | { store: IConstructableStore<TSto>; id: string };

export type TMapStores = Record<string, TStoreDefinition>;

export interface IManagerParams {
  storesParams: Omit<IConstructorParams, 'storeManager'>;
  storage?: IStorage;
  options?: IManagerOptions;
  initState?: Record<string, any>;
}

export type TWakeup = (
  store: IStore,
  state: {
    initState?: Record<string, any>;
    persistedState?: Record<string, any>;
  },
) => void;

export interface IStorage {
  get: () => Record<string, any> | undefined | Promise<Record<string, any> | undefined>;
  set: (
    value: Record<string, any> | undefined,
  ) => Record<string, any> | undefined | Promise<any> | void;
  flush: () => void | Promise<any>;
}

export interface IManagerOptions {
  shouldDisablePersist?: boolean; // e.g. in server side
  shouldRemoveInitState?: boolean; // remove init state for store after initialize
}

export type TStores = { [storeKey: string]: IStore | IStorePersisted };
