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
      const storageData = this.persistData?.[storageId]?.[storeId] ?? {};
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
    const { attributes } = this.getStoreOptions(store);
    const dataKeys = Object.keys(data ?? {});

    const dataByStorages = Object.entries(attributes!).map(([storageId, attr]) => {
      const storeData =
        attr[0] === '*'
          ? data
          : attr.reduce(
              (r, attrName) => ({
                ...r,
                ...(dataKeys.includes(attrName) ? { [attrName]: data?.[attrName] } : {}),
              }),
              {},
            );

      return this.set(
        {
          ...(this.persistData?.[storageId] ?? {}),
          [storeId]: storeData,
        } as Record<string, any>,
        storageId,
      );
    });

    await Promise.all(dataByStorages);
  }
}

export default CombinedStorage;
