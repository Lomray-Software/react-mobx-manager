import type { IPersistOptions, IStorage, IStorePersisted } from '../types';

interface ICombinedStorage {
  [name: string]: IStorage;
}

/**
 * Persisted data of one storage: store id => store attributes
 */
type TStorageData = Record<string, Record<string, unknown>>;

/**
 * Store and the state to save
 */
export type TStoreStateEntry = [IStorePersisted, Record<string, unknown> | undefined];

/**
 * Combined storage for mobx store manager
 */
class CombinedStorage implements IStorage {
  /**
   * @protected
   */
  protected storages: ICombinedStorage;

  /**
   * Restored persist storage data
   * @protected
   */
  protected persistData: Record<string, TStorageData> = {};

  /**
   * Serialized persist data: storage id => store id => store state JSON
   * @protected
   */
  protected persistJSON: Record<string, Map<string, string>> = {};

  /**
   * Default storage id
   * @protected
   */
  protected defaultId: string;

  /**
   * @constructor
   *
   * First storage will be used as default
   */
  constructor(storages: ICombinedStorage) {
    this.storages = storages;
    this.defaultId = Object.keys(storages)?.[0];
  }

  /**
   * @inheritDoc
   */
  public async get(): Promise<Record<string, any> | undefined> {
    try {
      const data = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/await-thenable -- IStorage.get may be synchronous; Promise.all accepts plain values.
        Object.values(this.storages).map((storage) => storage.get() || ({} as TStorageData)),
      );

      this.persistData = Object.keys(this.storages).reduce(
        (res, key, index) => ({
          ...res,
          [key]: data[index],
        }),
        {},
      );
      this.persistJSON = {};

      return this.persistData;
    } catch {
      return {};
    }
  }

  /**
   * @inheritDoc
   */
  public async flush(): Promise<void> {
    await Promise.all(
      Object.values(this.storages).map((storage) => Promise.resolve(storage.flush())),
    );
    this.persistData = {};
    this.persistJSON = {};
  }

  /**
   * @inheritDoc
   */
  public set(
    value: Record<string, any> | undefined,
    storageId?: string,
  ): ReturnType<IStorage['set']> {
    const storage = this.storages[storageId ?? this.defaultId];

    if (!storage) {
      return;
    }

    return storage.set(value);
  }

  /**
   * Return store storage options
   */
  protected getStoreOptions(store: IStorePersisted): IPersistOptions {
    return {
      attributes: {
        [this.defaultId]: ['*'],
      },
      behaviour: 'exclude',
      ...(store.libStorageOptions ?? {}),
    };
  }

  /**
   * Return store attributes saved in any storage
   * undefined - all attributes
   */
  public getStoreAttributes(store: IStorePersisted): string[] | undefined {
    const { attributes } = this.getStoreOptions(store);
    const result = new Set<string>();

    for (const attr of Object.values(attributes ?? {})) {
      if (attr[0] === '*') {
        return undefined;
      }

      attr.forEach((attrName) => result.add(attrName));
    }

    return [...result];
  }

  /**
   * Return store persist data
   */
  public getStoreData(store: IStorePersisted): Record<string, any> | undefined {
    const storeId = store.libStoreId!;
    const { attributes } = this.getStoreOptions(store);

    return Object.entries(attributes!).reduce<Record<string, unknown>>((res, [storageId, attr]) => {
      const storageData: Record<string, unknown> = this.persistData[storageId]?.[storeId] ?? {};
      const allowedData =
        attr[0] === '*'
          ? storageData
          : attr.reduce(
              (r, attrName) => ({
                ...r,
                ...(storageData[attrName] !== undefined
                  ? { [attrName]: storageData[attrName] }
                  : {}),
              }),
              {},
            );

      return {
        ...res,
        ...allowedData,
      };
    }, {});
  }

  /**
   * Save store data in storage
   */
  public saveStoreData(
    store: IStorePersisted,
    data: Record<string, unknown> | undefined,
  ): Promise<void> {
    return this.saveStoresData([[store, data]]);
  }

  /**
   * Save data of many stores: every changed storage is written once
   *
   * NOTE: storages are called synchronously, before the returned promise settles
   */
  public async saveStoresData(entries: TStoreStateEntry[]): Promise<void> {
    const changed = new Map<string, Map<string, string>>();
    let error: unknown;

    for (const [store, data] of entries) {
      try {
        this.applyStoreData(store, data, changed);
      } catch (e) {
        error = error ?? e;
      }
    }

    const writes: Promise<unknown>[] = [];

    for (const [storageId, changes] of changed) {
      try {
        writes.push(Promise.resolve(this.write(storageId, changes)));
      } catch (e) {
        writes.push(Promise.reject(e as Error));
      }
    }

    await Promise.all(writes);

    if (error) {
      throw error;
    }
  }

  /**
   * Serialized stores of storage
   */
  protected getStorageJSON(storageId: string): Map<string, string> {
    if (!this.persistJSON[storageId]) {
      this.persistJSON[storageId] = new Map();
    }

    return this.persistJSON[storageId];
  }

  /**
   * Split store data by storages and remember changed stores
   */
  protected applyStoreData(
    store: IStorePersisted,
    data: Record<string, unknown> | undefined,
    changed: Map<string, Map<string, string>>,
  ): void {
    const storeId = store.libStoreId!;
    const { attributes, behaviour } = this.getStoreOptions(store);
    const dataKeys = new Set(Object.keys(data ?? {}));

    for (const [storageId, attr] of Object.entries(attributes!)) {
      const storeData: Record<string, unknown> = {};

      for (const attrName of attr[0] === '*' ? [...dataKeys] : attr) {
        if (!dataKeys.has(attrName)) {
          continue;
        }

        if (behaviour === 'exclude') {
          dataKeys.delete(attrName);
        }

        storeData[attrName] = data?.[attrName];
      }

      const storeJSON = JSON.stringify(storeData);
      const storageJSON = this.getStorageJSON(storageId);
      const prevData = this.persistData[storageId]?.[storeId];
      let prevJSON = storageJSON.get(storeId);

      if (prevJSON === undefined && prevData) {
        prevJSON = JSON.stringify(prevData);
        storageJSON.set(storeId, prevJSON);
      }

      // skip updating if nothing changed
      if (storeJSON === (prevJSON ?? '{}')) {
        continue;
      }

      if (!this.persistData[storageId]) {
        this.persistData[storageId] = {};
      }

      this.persistData[storageId][storeId] = storeData;
      storageJSON.set(storeId, storeJSON);

      if (!changed.has(storageId)) {
        changed.set(storageId, new Map());
      }

      changed.get(storageId)!.set(storeId, storeJSON);
    }
  }

  /**
   * Write storage changes
   */
  protected write(storageId: string, changes: Map<string, string>): ReturnType<IStorage['set']> {
    const storage = this.storages[storageId];

    if (!storage) {
      return;
    }

    const value = { ...this.persistData[storageId] };

    if (typeof storage.saveChanges === 'function') {
      return storage.saveChanges({
        value,
        changes,
        toJSON: () => this.toJSON(storageId, value),
      });
    }

    return this.set(value, storageId);
  }

  /**
   * Storage data JSON assembled from cached stores JSON.
   * Equal to JSON.stringify(value).
   */
  protected toJSON(storageId: string, value: TStorageData): string {
    const storageJSON = this.getStorageJSON(storageId);
    const parts: string[] = [];

    for (const storeId of Object.keys(value)) {
      let storeJSON = storageJSON.get(storeId);

      if (storeJSON === undefined) {
        // undefined for unsupported values, e.g. undefined
        storeJSON = JSON.stringify(value[storeId]) ?? '';
        storageJSON.set(storeId, storeJSON);
      }

      if (!storeJSON) {
        continue;
      }

      parts.push(`${JSON.stringify(storeId)}:${storeJSON}`);
    }

    return `{${parts.join(',')}}`;
  }
}

export default CombinedStorage;
