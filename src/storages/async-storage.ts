import type { IStorage } from '../types';

interface IAsyncStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

interface IAsyncStorageOptions {
  storage: IAsyncStorage;
  globalKey?: string;
}

/**
 * Async storage for mobx store manager
 */
class AsyncStorage implements IStorage {
  /**
   * Cookie storage key
   */
  protected globalKey: string;

  /**
   * @protected
   */
  protected storage: IAsyncStorage;

  /**
   * @constructor
   */
  constructor({ storage, globalKey }: IAsyncStorageOptions) {
    this.storage = storage;
    this.globalKey = globalKey ?? 'stores';
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
      console.error('Failed to get item from async storage:', e);

      return {};
    }
  }

  /**
   * @inheritDoc
   */
  async flush(): Promise<any> {
    try {
      return await this.storage.removeItem(this.globalKey);
    } catch (e) {
      console.error('Failed to flush async storage key:', e);
    }
  }

  /**
   * @inheritDoc
   */
  async set(value: Record<string, any> | undefined): Promise<void> {
    try {
      return await this.storage.setItem(this.globalKey, JSON.stringify(value || '{}'));
    } catch (e) {
      console.error('Failed to set value to async storage:', e);
    }
  }
}

export default AsyncStorage;
