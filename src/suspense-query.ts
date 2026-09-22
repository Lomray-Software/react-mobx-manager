import { makeExported } from './make-exported';
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

interface ISuspenseQueryOptions {
  hash?: unknown;
}

interface ISuspenseSubqueryOptions {
  id: string;
  hash: unknown;
}

/**
 * Suspense state kept on the target store under params.fieldName
 */
interface ISuspenseState {
  hash?: unknown;
  done?: boolean;
  error?: Record<string, unknown>;
}

type TSuspenseStore = Record<string, ISuspenseState | undefined>;

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

    const defaultInit = store.init?.bind(store) as TInitStore['init'];

    store.init = () => {
      this.throwError(); // throw error immediately from server side if exist

      return defaultInit?.();
    };

    makeExported(store, { [fieldName]: 'simple' });
  }

  /**
   * Error to json
   */
  protected errorJson(e: Record<string, unknown>): void {
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
  protected jsonToError(e: Error, values: Record<string, unknown>): Error {
    this.params.errorFields.forEach((name) => {
      (e as unknown as Record<string, unknown>)[name] = values?.[name];
    });

    return e;
  }

  /**
   * Throw suspense error
   */
  protected throwError(): void {
    const value = (this.store as TSuspenseStore)[this.params.fieldName];

    // pass error to error boundary
    if (value?.error) {
      throw this.jsonToError(
        new Error((value?.error?.message ?? value?.error?.name) as string),
        value?.error,
      );
    }
  }

  /**
   * Detect if suspense is restored from server side:
   *  - throw error if exist
   *  - skip run suspense if already completed
   */
  protected isComplete(hash: unknown): boolean {
    const value = (this.store as TSuspenseStore)[this.params.fieldName];

    // pass error to error boundary
    if (value?.error) {
      this.throwError();
    }

    return value?.done === true && value.hash === hash;
  }

  /**
   * Run request
   * Save request resolve status
   */
  public query = <TReturn>(
    promise: () => Promise<TReturn>,
    options: ISuspenseQueryOptions = {},
  ): TReturn | undefined => {
    const { hash = '' } = options;
    const { fieldName } = this.params;

    if (this.isComplete(hash)) {
      return;
    }

    if ((this.store as TSuspenseStore)[fieldName]?.hash !== hash) {
      (this.store as TSuspenseStore)[fieldName] = { hash, done: false };
      this.promise = undefined;
    }

    if (!this.promise) {
      const pending = promise();

      this.promise = pending;
      pending.then(
        () => {
          if (this.promise !== pending) {
            return;
          }

          (this.store as TSuspenseStore)[fieldName] = { hash, done: true };
        },
        (e: Record<string, unknown>) => {
          if (this.promise !== pending) {
            return;
          }

          this.errorJson(e);

          (this.store as TSuspenseStore)[fieldName] = { error: e };
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
          (reason: unknown) => {
            promise.status = 'rejected';
            promise.reason = reason;
          },
        );
    }

    throw promise;
  };
}

export default SuspenseQuery;
