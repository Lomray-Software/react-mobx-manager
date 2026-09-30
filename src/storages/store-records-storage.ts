import type { IStorage, IStorageChanges } from '../types';

export interface IStoreRecordsStorageOptions {
  /**
   * Storage with previously persisted stores (e.g. LocalStorage or AsyncStorage).
   * Its data is moved on the first start and removed on flush.
   */
  migrateFrom?: IStorage;
  /**
   * Remove data from `migrateFrom` right after migration.
   * Default: false - keep it (e.g. for app version rollback)
   */
  shouldRemoveMigrated?: boolean;
}

/**
 * Serialize stores state: store id => store state JSON
 */
const serializeStores = (data: Record<string, any>): Map<string, string> => {
  const result = new Map<string, string>();

  for (const [storeId, state] of Object.entries(data)) {
    // undefined for unsupported values, e.g. undefined
    const json = JSON.stringify(state) ?? '';

    if (json) {
      result.set(storeId, json);
    }
  }

  return result;
};

/**
 * Base storage which saves every persisted store as a separate record
 */
abstract class StoreRecordsStorage implements IStorage {
  /**
   * Legacy storage
   */
  protected migrateFrom?: IStorage;

  /**
   * Remove legacy data after migration
   */
  protected shouldRemoveMigrated: boolean;

  /**
   * Stores moved from legacy storage are not saved yet: the next save writes all stores
   */
  protected isMigrationPending = false;

  /**
   * @constructor
   */
  protected constructor({ migrateFrom, shouldRemoveMigrated }: IStoreRecordsStorageOptions) {
    this.migrateFrom = migrateFrom;
    this.shouldRemoveMigrated = shouldRemoveMigrated ?? false;
  }

  /**
   * @inheritDoc
   */
  public abstract get(): Promise<Record<string, any> | undefined>;

  /**
   * @inheritDoc
   */
  public abstract set(value: Record<string, any> | undefined): Promise<void>;

  /**
   * @inheritDoc
   */
  public abstract flush(): Promise<void>;

  /**
   * Write stores state JSON
   */
  protected abstract write(changes: Map<string, string>): Promise<void>;

  /**
   * @inheritDoc
   */
  public saveChanges({ value, changes }: IStorageChanges): Promise<void> {
    return this.isMigrationPending ? this.saveMigrated(value) : this.write(changes);
  }

  /**
   * Move stores from legacy storage
   * Legacy data is returned even if it can't be saved: saving is retried on the next change.
   */
  protected async migrate(): Promise<Record<string, any>> {
    if (!this.migrateFrom) {
      return {};
    }

    const data = (await this.migrateFrom.get()) ?? {};

    this.isMigrationPending = true;

    try {
      await this.saveMigrated(data);
    } catch (e) {
      console.error('Failed to move persisted stores, retry on the next save:', e);
    }

    return data;
  }

  /**
   * Save all stores, then remove legacy data if needed
   */
  protected async saveMigrated(data: Record<string, any>): Promise<void> {
    const changes = serializeStores(data);

    if (changes.size > 0) {
      await this.write(changes);
    }

    if (this.shouldRemoveMigrated) {
      await this.migrateFrom?.flush();
    }

    this.isMigrationPending = false;
  }
}

export { serializeStores };

export default StoreRecordsStorage;
