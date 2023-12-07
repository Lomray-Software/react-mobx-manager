import type Events from './events';
import type Manager from './manager';
import type StoreStatus from './store-status';

export interface IWindowManager {
  push: (state: Record<string, any>) => void;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Window {
    mbxM: Record<string, any>[] | IWindowManager;
  }
}

export interface IConstructorParams<TProps = Record<string, any>> {
  storeManager: Manager;
  getStore: <T>(store: IConstructableStore<T>, params?: Partial<IStoreParams>) => T | undefined;
  componentProps: TProps;
}

export interface IStoreLifecycle {
  onDestroy?: () => void;
}

export interface IStore extends IStoreLifecycle {
  libStoreId?: string; // static
  libStoreContextId?: string; // static
  libStoreParentId?: string; // static
  libStoreSuspenseId?: string; // static
  libStoreComponentName?: string; // static
  libStoreStatus?: StoreStatus; // static
  libDestroyTimer?: NodeJS.Timeout;
  isGlobal?: boolean; // static
  init?: () => void;
  toJSON?: () => Record<string, any>;
}

export interface IStorePersisted extends IStore {
  addOnChangeListener?: (store: IStorePersisted, manager: Manager) => (() => void) | undefined;
  wakeup?: TWakeup;
}

export type TInitStore<TSto = IStore> = TSto & TAnyStore;

export type IConstructableStore<TSto = IStore> = (new (
  props: IConstructorParams,
) => TInitStore<TSto>) &
  Partial<IStorePersisted>;

/**
 * Store params
 */
export type IStoreConfig = { id?: string };

export type TStoreDefinition<TSto extends TAnyStore = any> =
  | IConstructableStore<TSto>
  | ({ store: IConstructableStore<TSto> } & IStoreConfig);

export type TMapStores = Record<string, TStoreDefinition>;

export interface IManagerParams {
  storesParams?: Omit<IConstructorParams, 'storeManager' | 'getStore' | 'componentProps'>;
  storage?: IStorage;
  options?: IManagerOptions;
  initState?: Record<string, any>;
}

export type TWakeup = (state: {
  initState?: Record<string, any>;
  persistedState?: Record<string, any>;
}) => void;

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
  destroyTimers?: {
    init?: number;
    touched?: number; // NOTE: set to max timeout request
    unused?: number;
  };
}

export type TAnyStore = IStore | IStorePersisted;

export type TStores = { [storeKey: string]: TAnyStore };

/**
 * Convert class type to class constructor
 */
export type ClassReturnType<T> = T extends new (...args: any) => infer R
  ? R
  : T extends { store: any }
    ? ClassReturnType<T['store']>
    : never;

/**
 * Stores map to type
 */
export type StoresType<TSt> = {
  [keys in keyof TSt]: ClassReturnType<TSt[keys]>;
};

export interface IStoreParams {
  id?: string;
  key?: string;
  contextId?: string;
  parentId?: string;
  suspenseId?: string;
  componentName?: string;
  componentProps?: Record<string, any>;
}

export interface IWithStoreOptions {
  customContextId?: string;
}

export interface IMobxManagerEvents {
  [Events.CREATE_STORE]: {
    store: IConstructableStore;
  };
  [Events.MOUNT_STORE]: {
    store: TAnyStore;
  };
  [Events.UNMOUNT_STORE]: {
    store: TAnyStore;
  };
  [Events.DELETE_STORE]: {
    store: TAnyStore;
  };
}
