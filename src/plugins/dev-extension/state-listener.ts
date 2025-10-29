import _ from 'lodash';
import { spy, untracked } from 'mobx';
import { ROOT_CONTEXT_ID } from '@src/constants';
import Manager from '../../manager';

enum Listeners {
  SPY = 'spy',
}

type SpyEvent = Parameters<Parameters<typeof spy>[0]>[0];

/**
 * State listener
 */
class StateListener {
  /**
   * @protected
   */
  protected manager: Manager;

  /**
   * Store global listeners
   * @protected
   */
  protected static listeners: Record<Listeners | string, () => void> = {} as never;

  /**
   * Last mobx event
   * @private
   */
  private _lastEvent: SpyEvent | null = null;

  /**
   * @private
   */
  private readonly _throttleMs = 16;

  /**
   * @constructor
   */
  public constructor(manager: Manager) {
    this.manager = manager;

    Object.values(StateListener.listeners).forEach((unsubscribe) => {
      unsubscribe();
    });
  }

  /**
   * Get context tree key
   * @protected
   */
  protected getContextKey(contextId: string, nestedKey?: string): string {
    if (contextId === ROOT_CONTEXT_ID) {
      return contextId;
    }

    const { parentId } = this.manager.getStoresRelations().get(contextId) ?? {};

    if (!parentId || parentId === ROOT_CONTEXT_ID) {
      return `${parentId ?? ROOT_CONTEXT_ID}.${nestedKey ?? contextId}`;
    }

    return this.getContextKey(parentId, `${parentId}.${nestedKey ?? contextId}`);
  }

  /**
   * Store snapshot WITHOUT creating mobx dependencies
   */
  protected getStoresState(): { root: Record<string, any> } {
    return untracked(() => {
      const state: { root: Record<string, any> } = { root: {} };

      try {
        const stores = this.manager.getStores();

        this.manager.getStoresRelations().forEach(({ ids, componentName }, contextId) => {
          const key = this.getContextKey(contextId);

          ids.forEach((id) => {
            const store = stores.get(id);

            if (store) {
              const storeState = store?.toJSON?.() ?? Manager.getObservableProps(store);

              _.set(state, `${key}.stores.${id}`, storeState);
              _.set(state, `${key}.componentName`, componentName);
            }
          });
        });
      } catch {
        // manager has not initialized yet
      }

      return state;
    });
  }

  /**
   * Safe clone
   * @private
   */
  private getSafeEvent(event: SpyEvent): SpyEvent {
    const normalized = _.mapValues(event, (v) => {
      if (v == null) {
        return v;
      }

      const t = typeof v;

      if (t === 'string' || t === 'number' || t === 'boolean') {
        return v;
      }

      if (Array.isArray(v)) {
        return { length: v.length };
      }

      if (t === 'function' || t === 'symbol') {
        return undefined;
      }

      if (t === 'object') {
        return { objectType: v?.constructor?.name ?? 'Object' };
      }

      return undefined;
    });

    return _.pickBy(normalized, (v) => v !== undefined) as SpyEvent;
  }

  /**
   * Batch sending
   * @private
   */
  private emitChange = _.throttle(
    () => {
      const payload = {
        event: this._lastEvent,
        storesState: this.getStoresState(),
      };

      this.manager?.['__devOnChange']?.(payload);
      this._lastEvent = null;
    },
    this._throttleMs,
    { leading: false, trailing: true },
  );

  /**
   * Subscribe on stores changes
   * @protected
   */
  public subscribe(): Manager {
    StateListener.listeners[Listeners.SPY] = spy((event) => {
      if (['report-end', 'reaction'].includes(event?.type)) {
        return;
      }

      this._lastEvent = this.getSafeEvent(event);

      this.emitChange();
    });

    return this.manager;
  }
}

export default StateListener;
