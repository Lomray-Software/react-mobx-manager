import type { IStorage, IStorageChanges } from '../types';
import StoreRecordsStorage, {
  type IStoreRecordsStorageOptions,
  serializeStores,
} from './store-records-storage';

// eslint-disable-next-line @typescript-eslint/naming-convention -- IndexedDB is the API name.
export interface IIndexedDBStorageOptions extends IStoreRecordsStorageOptions {
  /**
   * Database name. Default: 'mobx-manager'
   */
  dbName?: string;
  /**
   * IndexedDB factory. Default: globalThis.indexedDB
   */
  indexedDB?: IDBFactory;
  /**
   * Storage with previously persisted stores (e.g. LocalStorage).
   * Its data is moved on the first start and removed on flush.
   * It is also used when IndexedDB is not available.
   */
  migrateFrom?: IStorage;
}

/**
 * Object store name
 */
const STORE_NAME = 'stores';

/**
 * Promisify IndexedDB request
 */
const promisify = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });

/**
 * IndexedDB storage for mobx store manager
 *
 * Every store is saved as its own record: a change writes only the changed stores,
 * writes don't block the main thread and the quota is much bigger than localStorage.
 */
class IndexedDBStorage extends StoreRecordsStorage {
  /**
   * Database name
   */
  protected dbName: string;

  /**
   * IndexedDB factory
   */
  protected factory?: IDBFactory;

  /**
   * Opened database
   */
  protected db?: IDBDatabase;

  /**
   * Opening database
   */
  protected opening?: Promise<IDBDatabase | undefined>;

  /**
   * @constructor
   */
  constructor({ dbName, indexedDB, ...options }: IIndexedDBStorageOptions = {}) {
    super(options);
    this.dbName = dbName ?? 'mobx-manager';
    this.factory =
      indexedDB ?? (typeof globalThis !== 'undefined' ? globalThis.indexedDB : undefined);
  }

  /**
   * Open database. Resolves undefined when IndexedDB is not available.
   */
  protected open(): Promise<IDBDatabase | undefined> {
    if (this.db) {
      return Promise.resolve(this.db);
    }

    if (!this.opening) {
      this.opening = new Promise<IDBDatabase | undefined>((resolve) => {
        if (!this.factory) {
          resolve(undefined);

          return;
        }

        try {
          const request = this.factory.open(this.dbName, 1);

          request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE_NAME)) {
              request.result.createObjectStore(STORE_NAME);
            }
          };
          request.onsuccess = () => {
            const db = request.result;
            const reset = (): void => {
              this.db = undefined;
              this.opening = undefined;
            };

            // let other tabs upgrade the database
            db.onversionchange = () => {
              db.close();
              reset();
            };
            // e.g. database is deleted: reopen on the next save
            db.onclose = reset;
            this.db = db;
            resolve(db);
          };
          request.onerror = () => {
            console.error('Failed to open IndexedDB:', request.error);
            resolve(undefined);
          };
        } catch (e) {
          console.error('Failed to open IndexedDB:', e);
          resolve(undefined);
        }
      });
    }

    return this.opening;
  }

  /**
   * @inheritDoc
   */
  public async get(): Promise<Record<string, any> | undefined> {
    try {
      const db = await this.open();

      if (!db) {
        return (await this.migrateFrom?.get()) ?? {};
      }

      const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
      const [keys, values] = await Promise.all([
        promisify(store.getAllKeys()),
        promisify(store.getAll() as IDBRequest<string[]>),
      ]);

      if (keys.length === 0) {
        return await this.migrate();
      }

      const result: Record<string, any> = {};

      keys.forEach((key, index) => {
        try {
          result[key as string] = JSON.parse(values[index]) as unknown;
        } catch (e) {
          console.error(`Failed to parse persisted store "${key as string}":`, e);
        }
      });

      return result;
    } catch (e) {
      console.error('Failed to get stores from IndexedDB:', e);

      return {};
    }
  }

  /**
   * Write stores in one transaction
   */
  protected write(changes: Map<string, string>, shouldClear = false): Promise<void> {
    const transaction = (db: IDBDatabase): Promise<void> =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite', { durability: 'relaxed' });
        const store = tx.objectStore(STORE_NAME);

        if (shouldClear) {
          store.clear();
        }

        changes.forEach((json, storeId) => store.put(json, storeId));

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
      });

    // start transaction synchronously when possible (e.g. on page hide)
    if (this.db) {
      return transaction(this.db);
    }

    return this.open().then((db) => (db ? transaction(db) : undefined));
  }

  /**
   * @inheritDoc
   */
  public async saveChanges(changes: IStorageChanges): Promise<void> {
    if (!this.db && !(await this.open())) {
      return this.saveFallback(changes);
    }

    return super.saveChanges(changes);
  }

  /**
   * Save to legacy storage when IndexedDB is not available
   */
  protected async saveFallback(changes: IStorageChanges): Promise<void> {
    const { migrateFrom } = this;

    if (!migrateFrom) {
      return;
    }

    if (typeof migrateFrom.saveChanges === 'function') {
      await migrateFrom.saveChanges(changes);

      return;
    }

    await migrateFrom.set(changes.value);
  }

  /**
   * @inheritDoc
   */
  public async set(value: Record<string, any> | undefined): Promise<void> {
    const data = value ?? {};

    if (!this.db && !(await this.open())) {
      await this.migrateFrom?.set(data);

      return;
    }

    return this.write(serializeStores(data), true);
  }

  /**
   * @inheritDoc
   */
  public async flush(): Promise<void> {
    const db = await this.open();

    this.isMigrationPending = false;

    await Promise.all([
      db &&
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');

          tx.objectStore(STORE_NAME).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
          tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
        }),
      this.migrateFrom?.flush(),
    ]);
  }
}

export default IndexedDBStorage;
