import { extendObservable, observable, runInAction } from 'mobx';
import type { TInitStore } from './types';

interface IPromise<TReturn> extends Promise<TReturn> {
  status?: 'fulfilled' | 'pending' | 'rejected';
  value?: TReturn;
  reason?: any;
}

interface ISuspenseQueryParams {
  fieldName?: string; // field name in target store for save suspense state
}

/**
 * Run request and cache promise
 * Sync suspense status between server and client
 */
class SuspenseQuery {
  /**
   * @private
   */
  protected promise: Promise<any> | undefined;

  /**
   * @private
   */
  protected error?: Error;

  /**
   * Target store
   * @private
   */
  protected readonly store: TInitStore;

  /**
   * @protected
   */
  protected readonly params: Required<ISuspenseQueryParams>;

  /**
   * @constructor
   */
  constructor(
    store: TInitStore,
    { fieldName = 'isSuspenseDone', ...rest }: ISuspenseQueryParams = {},
  ) {
    this.store = store;
    this.params = { ...rest, fieldName };

    extendObservable(
      store,
      { [fieldName]: false },
      {
        [fieldName]: observable,
      },
    );
  }

  /**
   * Run request
   * Save request resolve status
   */
  public query = <TReturn>(promise: () => Promise<TReturn>): TReturn | undefined => {
    const { fieldName } = this.params;

    if (this.store[fieldName]) {
      return;
    }

    if (!this.promise) {
      this.promise = promise();

      this.promise.then(
        () => {
          runInAction(() => {
            this.store[fieldName] = true;
          });
        },
        (e) => {
          runInAction(() => {
            this.store[fieldName] = true;
            this.error = e;
          });
        },
      );
    }

    return SuspenseQuery.run<TReturn>(this.promise);
  };

  /**
   * Change status of promise.
   * Throw promise to react suspense
   */
  public static run = <TReturn>(promise: IPromise<TReturn> | undefined): TReturn | undefined => {
    if (!promise) {
      return;
    }

    switch (promise.status) {
      case 'fulfilled':
        return promise.value;

      case 'pending':
        throw promise;

      case 'rejected':
        throw promise.reason;

      default:
        promise.status = 'pending';

        promise.then(
          (result) => {
            promise.status = 'fulfilled';
            promise.value = result;
          },
          (reason) => {
            promise.status = 'rejected';
            promise.reason = reason;
          },
        );
    }

    throw promise;
  };
}

export default SuspenseQuery;
