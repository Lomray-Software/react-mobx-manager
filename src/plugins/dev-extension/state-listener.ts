import { spy, untracked } from 'mobx';
import { ROOT_CONTEXT_ID } from '@src/constants';
import Manager from '../../manager';

enum Listeners {
  SPY = 'spy',
}

type SpyEvent = Parameters<Parameters<typeof spy>[0]>[0];

/**
 * Assign a value at a dot separated path, creating the objects on the way
 */
const setPath = (target: Record<string, any>, path: string, value: unknown): void => {
  const keys = path.split('.');
  let current = target;

  for (let index = 0; index < keys.length - 1; index++) {
    const key = keys[index];

    if (current[key] === null || typeof current[key] !== 'object') {
      current[key] = {};
    }

    current = current[key] as Record<string, any>;
  }

  current[keys[keys.length - 1]] = value;
};

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
  protected static listeners: Record<Listeners | string, () => void> = {};

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
   * Pending batch
   * @private
   */
  private _emitTimer: ReturnType<typeof setTimeout> | null = null;

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

              setPath(state, `${key}.stores.${id}`, storeState);
              setPath(state, `${key}.componentName`, componentName);
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
    const safe: Record<string, unknown> = {};

    for (const [key, v] of Object.entries(event as Record<string, unknown>)) {
      if (v === undefined) {
        continue;
      }

      if (v === null) {
        safe[key] = v;

        continue;
      }

      const t = typeof v;

      if (t === 'string' || t === 'number' || t === 'boolean') {
        safe[key] = v;
      } else if (Array.isArray(v)) {
        safe[key] = { length: v.length };
      } else if (t === 'object') {
        safe[key] = { objectType: v.constructor?.name ?? 'Object' };
      }
    }

    return safe as SpyEvent;
  }

  /**
   * Batch sending: one trailing call per throttle window
   * @private
   */
  private emitChange = (): void => {
    if (this._emitTimer) {
      return;
    }

    this._emitTimer = setTimeout(() => {
      this._emitTimer = null;

      const payload = {
        event: this._lastEvent,
        storesState: this.getStoresState(),
      };

      (this.manager as Manager & { __devOnChange?: (value: typeof payload) => void })?.[
        '__devOnChange'
      ]?.(payload);
      this._lastEvent = null;
    }, this._throttleMs);
  };

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
