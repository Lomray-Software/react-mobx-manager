import deepCompare from '../deep-compare';
import type { IPersistOptions, IStorage, IStorePersisted } from '../types';

interface ICombinedStorage {
  [name: string]: IStorage;
}

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
  protected persistData: Record<string, any> = {};

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
        Object.values(this.storages).map((storage) => storage.get() || {}),
      );

      this.persistData = Object.keys(this.storages).reduce(
        (res, key, index) => ({
          ...res,
          [key]: data[index],
        }),
        {},
      );

      return this.persistData;
    } catch (e) {
      return {};
    }
  }

  /**
   * @inheritDoc
   */
  public flush(): void | Promise<any> {
    return Promise.all(Object.values(this.storages).map((storage) => storage.flush()));
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
   * Return store persist data
   */
  public getStoreData(store: IStorePersisted): Record<string, any> | undefined {
    const storeId = store.libStoreId!;
    const { attributes } = this.getStoreOptions(store);

    return Object.entries(attributes!).reduce((res, [storageId, attr]) => {
      const storageData = this.persistData[storageId]?.[storeId] ?? {};
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
  public async saveStoreData(
    store: IStorePersisted,
    data: Record<string, any> | undefined,
  ): Promise<void> {
    const storeId = store.libStoreId!;
    const { attributes, behaviour } = this.getStoreOptions(store);
    const dataKeys = new Set(Object.keys(data ?? {}));

    const dataByStorages = Object.entries(attributes!).map(([storageId, attr]) => {
      const storeData = (attr[0] === '*' ? [...dataKeys] : attr).reduce((r, attrName) => {
        if (!dataKeys.has(attrName)) {
          return r;
        }

        if (behaviour === 'exclude') {
          dataKeys.delete(attrName);
        }

        return {
          ...r,
          [attrName]: data?.[attrName],
        };
      }, {});

      const newData = {
        ...(this.persistData?.[storageId] ?? {}),
        [storeId]: storeData,
      } as Record<string, any>;

      // skip updating if nothing changed
      if (deepCompare(this.persistData?.[storageId]?.[storeId] ?? {}, storeData)) {
        return null;
      }

      if (!this.persistData[storageId]) {
        this.persistData[storageId] = {};
      }

      if (!this.persistData[storageId]?.[storeId]) {
        this.persistData[storageId][storeId] = {};
      }

      this.persistData[storageId][storeId] = storeData;

      return this.set(newData, storageId);
    });

    await Promise.all(dataByStorages);
  }
}

export default CombinedStorage;
