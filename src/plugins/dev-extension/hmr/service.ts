import deepMerge from '@src/deep-merge';
import type { TAnyStore } from '@src/types';
import type { IHmrOptions, IHmrRuntime, IHmrSnapshot } from './types';

const HMR_GLOBAL_KEY = '__MOBX_STORE_MANAGER_HMR__';

/**
 * Dev-only HMR snapshot bridge for store manager
 */
class ManagerHmr {
  /**
   * @protected
   */
  protected readonly manager: IHmrOptions['manager'];

  /**
   * @protected
   */
  protected readonly appId: string;

  /**
   * @constructor
   */
  public constructor({ manager, appId = 'default' }: IHmrOptions) {
    this.manager = manager;
    this.appId = appId;
  }

  /**
   * Get shared HMR storage
   */
  protected getStorage(): Record<string, IHmrSnapshot | undefined> {
    const scope = globalThis as typeof globalThis & {
      [HMR_GLOBAL_KEY]?: Record<string, IHmrSnapshot | undefined>;
    };

    if (!scope[HMR_GLOBAL_KEY]) {
      scope[HMR_GLOBAL_KEY] = {};
    }

    return scope[HMR_GLOBAL_KEY];
  }

  /**
   * Get current snapshot if exists
   */
  protected getSnapshot(runtimeData?: Record<string, unknown>): IHmrSnapshot | undefined {
    const dataSnapshot = runtimeData?.[this.appId];

    if (dataSnapshot) {
      return dataSnapshot as IHmrSnapshot;
    }

    return this.getStorage()[this.appId];
  }

  /**
   * Save current stores snapshot
   */
  public save(runtimeData?: Record<string, unknown>): IHmrSnapshot {
    const stores = Array.from(this.manager.getStores().values()).reduce(
      (result, store) => {
        const storeId = store.libStoreId;

        if (!storeId) {
          return result;
        }

        result[storeId] = this.manager.getStoreState(store as TAnyStore, true);

        return result;
      },
      {} as IHmrSnapshot['stores'],
    );
    const snapshot = { stores };

    this.getStorage()[this.appId] = snapshot;

    if (runtimeData) {
      runtimeData[this.appId] = snapshot;
    }

    return snapshot;
  }

  /**
   * Restore stores snapshot
   */
  public restore(runtimeData?: Record<string, unknown>): boolean {
    const snapshot = this.getSnapshot(runtimeData);

    if (!snapshot) {
      return false;
    }

    this.manager.pushInitState(snapshot.stores);

    this.manager.getStores().forEach((store, storeId) => {
      const state = snapshot.stores[storeId];

      if (!state) {
        return;
      }

      deepMerge(store, state);
    });

    this.clear(runtimeData);

    return true;
  }

  /**
   * Clear saved snapshot
   */
  public clear(runtimeData?: Record<string, unknown>): void {
    delete this.getStorage()[this.appId];

    if (runtimeData) {
      delete runtimeData[this.appId];
    }
  }

  /**
   * Save state and destroy manager instance
   */
  public dispose(runtimeData?: Record<string, unknown>): void {
    this.save(runtimeData);
    this.manager.destroy();
  }

  /**
   * Bind to HMR runtime
   */
  public bind(runtime: IHmrRuntime): ManagerHmr {
    this.restore(runtime.data);
    runtime.accept(() => undefined);
    runtime.dispose((data) => {
      this.dispose(data);
    });

    return this;
  }
}

export default ManagerHmr;
