import type { IStorage } from '../types';

interface IAsyncStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

class AsyncStorage implements IStorage {
  globalKey = 'stores';

  /**
   * @protected
   */
  protected storage: IAsyncStorage;

  /**
   * @constructor
   */
  constructor(AsyncStoragePackage: IAsyncStorage) {
    this.storage = AsyncStoragePackage;
  }

  /**
   * @inheritDoc
   */
  async get(): Promise<Record<string, any> | undefined> {
    try {
      return JSON.parse((await this.storage.getItem(this.globalKey)) || '{}') as Record<
        string,
        any
      >;
    } catch (e) {
      return {};
    }
  }

  /**
   * @inheritDoc
   */
  flush(): Promise<any> {
    return this.storage.removeItem(this.globalKey);
  }

  /**
   * @inheritDoc
   */
  set(value: Record<string, any> | undefined): Promise<void> {
    return this.storage.setItem(this.globalKey, JSON.stringify(value || '{}'));
  }
}

export default AsyncStorage;
