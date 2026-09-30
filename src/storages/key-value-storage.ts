import StoreRecordsStorage, {
  type IStoreRecordsStorageOptions,
  serializeStores,
} from './store-records-storage';

/**
 * Key-value storage adapter: localStorage, sessionStorage, AsyncStorage, MMKV wrapper etc.
 */
export interface IKeyValueAdapter {
  getItem: (key: string) => string | null | undefined | Promise<string | null | undefined>;
  setItem: (key: string, value: string) => unknown;
  removeItem: (key: string) => unknown;
}

export interface IKeyValueStorageOptions extends IStoreRecordsStorageOptions {
  storage: IKeyValueAdapter;
  /**
   * Keys prefix: store state is saved under `${prefix}:${storeId}`,
   * list of saved stores under `${prefix}-keys`.
   * Default: 'stores'
   */
  prefix?: string;
}

/**
 * Key-value storage for mobx store manager
 *
 * Every store is saved under its own key: a change writes only the changed stores
 * instead of all persisted stores.
 */
class KeyValueStorage extends StoreRecordsStorage {
  /**
   * @protected
   */
  protected storage: IKeyValueAdapter;

  /**
   * Keys prefix
   */
  protected prefix: string;

  /**
   * Saved stores ids
   */
  protected storeIds = new Set<string>();

  /**
   * Saved stores list is read: it's safe to overwrite it
   */
  protected isIndexLoaded = false;

  /**
   * @constructor
   */
  constructor({ storage, prefix, ...options }: IKeyValueStorageOptions) {
    super(options);
    this.storage = storage;
    this.prefix = prefix ?? 'stores';
  }

  /**
   * Store state key
   */
  protected getKey(storeId: string): string {
    return `${this.prefix}:${storeId}`;
  }

  /**
   * Saved stores list key
   */
  protected getIndexKey(): string {
    return `${this.prefix}-keys`;
  }

  /**
   * Read saved stores ids. undefined - there is no list yet.
   * Throws when the storage can't be read.
   */
  protected async getIndex(): Promise<string[] | undefined> {
    const index = await Promise.resolve(this.storage.getItem(this.getIndexKey()));

    if (typeof index !== 'string') {
      return undefined;
    }

    try {
      const ids = JSON.parse(index) as unknown;

      if (Array.isArray(ids)) {
        return ids.map(String);
      }
    } catch {
      // broken list is replaced on the next save
    }

    console.error('Persisted stores list is broken:', index);

    return [];
  }

  /**
   * Read saved stores ids into storeIds
   * Returns false when the list can't be read: it must not be overwritten then.
   */
  protected async loadIndex(): Promise<boolean> {
    if (!this.isIndexLoaded) {
      try {
        (await this.getIndex())?.forEach((storeId) => this.storeIds.add(storeId));
        this.isIndexLoaded = true;
      } catch (e) {
        console.error('Failed to get persisted stores list:', e);
      }
    }

    return this.isIndexLoaded;
  }

  /**
   * Read store state
   */
  protected async getStore(storeId: string): Promise<unknown> {
    try {
      const value = await Promise.resolve(this.storage.getItem(this.getKey(storeId)));

      return typeof value === 'string' ? (JSON.parse(value) as unknown) : undefined;
    } catch (e) {
      console.error(`Failed to get persisted store "${storeId}":`, e);

      return undefined;
    }
  }

  /**
   * @inheritDoc
   */
  public async get(): Promise<Record<string, any> | undefined> {
    try {
      const ids = await this.getIndex();

      this.isIndexLoaded = true;

      if (!ids) {
        return await this.migrate();
      }

      ids.forEach((storeId) => this.storeIds.add(storeId));

      const values = await Promise.all(ids.map((storeId) => this.getStore(storeId)));
      const result: Record<string, any> = {};

      ids.forEach((storeId, index) => {
        if (values[index] !== undefined) {
          result[storeId] = values[index];
        }
      });

      return result;
    } catch (e) {
      console.error('Failed to get stores from key-value storage:', e);

      return {};
    }
  }

  /**
   * Write stores, then update saved stores list
   */
  protected async write(changes: Map<string, string>, removed: string[] = []): Promise<void> {
    const isIndexLoaded = await this.loadIndex();

    await Promise.all([
      ...[...changes].map(([storeId, json]) => this.storage.setItem(this.getKey(storeId), json)),
      ...removed.map((storeId) => this.storage.removeItem(this.getKey(storeId))),
    ]);

    const newIds = [...changes.keys()].filter((storeId) => !this.storeIds.has(storeId));

    if (newIds.length === 0 && removed.length === 0) {
      return;
    }

    newIds.forEach((storeId) => this.storeIds.add(storeId));
    removed.forEach((storeId) => this.storeIds.delete(storeId));

    // keep the list which can't be read, otherwise other stores are lost
    if (isIndexLoaded) {
      await this.storage.setItem(this.getIndexKey(), JSON.stringify([...this.storeIds]));
    }
  }

  /**
   * @inheritDoc
   */
  public async set(value: Record<string, any> | undefined): Promise<void> {
    // all saved stores: the rest of them are removed
    await this.loadIndex();

    const changes = serializeStores(value ?? {});

    await this.write(
      changes,
      [...this.storeIds].filter((storeId) => !changes.has(storeId)),
    );
  }

  /**
   * @inheritDoc
   */
  public async flush(): Promise<void> {
    const ids = new Set(this.storeIds);

    try {
      (await this.getIndex())?.forEach((storeId) => ids.add(storeId));
    } catch {
      // broken list, remove known stores
    }

    this.storeIds.clear();
    this.isIndexLoaded = true;
    this.isMigrationPending = false;

    await Promise.all([
      ...[...ids].map((storeId) => this.storage.removeItem(this.getKey(storeId))),
      this.storage.removeItem(this.getIndexKey()),
      this.migrateFrom?.flush(),
    ]);
  }
}

export default KeyValueStorage;
