import { extendObservable, observable, runInAction } from 'mobx';
import type { TInitStore } from './types';

export interface IPromise<TReturn> extends Promise<TReturn> {
  status?: 'fulfilled' | 'pending' | 'rejected';
  value?: TReturn;
  reason?: any;
}

interface ISuspenseQueryParams {
  fieldName?: string; // field name in target store for save suspense state
  errorFields?: string[];
}

interface ISuspenseSubqueryOptions {
  id: string;
  hash: unknown;
}

/**
 * Run request and cache promise
 * Sync suspense status between server and client
 */
class SuspenseQuery {
  /**
   * @protected
   */
  protected promise: Promise<any> | undefined;

  /**
   * Subqueries info
   */
  protected subqueries: Map<string, { hash: unknown; promise?: IPromise<any> }> = new Map();

  /**
   * Target store
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
    { fieldName = 'sR', errorFields = ['name', 'message'] }: ISuspenseQueryParams = {},
  ) {
    this.store = store;
    this.params = { fieldName, errorFields };

    const defaultInit = store.init?.bind(store);

    store.init = () => {
      this.isComplete(); // throw error immediately from server side if exist
      defaultInit?.();
    };

    extendObservable(
      store,
      { [fieldName]: false },
      {
        [fieldName]: observable,
      },
    );
  }

  /**
   * Error to json
   */
  protected errorJson(e: any): void {
    e.toJSON = () =>
      this.params.errorFields.reduce(
        (res, name) => ({
          ...res,
          [name]: e?.[name],
        }),
        {},
      );
  }

  /**
   * Assign custom error fields to error
   */
  protected jsonToError(e: Error, values: Record<string, any>): Error {
    this.params.errorFields.forEach((name) => {
      e[name] = values?.[name];
    });

    return e;
  }

  /**
   * Detect if suspense is restored from server side:
   *  - throw error if exist
   *  - skip run suspense if already completed
   */
  protected isComplete(): boolean {
    const value = this.store[this.params.fieldName];
    const valueType = typeof value;

    // pass error to error boundary
    if (valueType !== 'boolean') {
      throw this.jsonToError(
        new Error((value?.message ?? value?.name) as string),
        value as Record<string, any>,
      );
    }

    return value === true;
  }

  /**
   * Run request
   * Save request resolve status
   */
  public query = <TReturn>(promise: () => Promise<TReturn>): TReturn | undefined => {
    const { fieldName } = this.params;

    if (this.isComplete()) {
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
            this.errorJson(e);

            this.store[fieldName] = e;
          });
        },
      );
    }

    return SuspenseQuery.run<TReturn>(this.promise);
  };

  /**
   * Run subquery
   * Re-fetch data from query by hash changes in children components
   * NOTE: only client side
   */
  public subquery = <TReturn>(
    promise: () => Promise<TReturn>,
    options: ISuspenseSubqueryOptions,
  ): TReturn | undefined => {
    const { id, hash } = options;
    const subquery = this.subqueries.get(id);

    // skip first run
    if (!subquery) {
      this.subqueries.set(id, { hash });

      return undefined;
    }

    if (subquery?.hash === hash) {
      return SuspenseQuery.run<TReturn>(subquery?.promise);
    }

    const newQuery = promise();

    this.subqueries.set(id, { hash, promise: newQuery });

    return SuspenseQuery.run<TReturn>(newQuery);
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
