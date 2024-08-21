import type { IStorage } from '../types';

interface ILocalStorageOptions {
  globalKey?: string;
  storage?: Storage;
}

/**
 * Local storage for mobx store manager
 */
class LocalStorage implements IStorage {
  /**
   * Local storage key
   */
  protected globalKey: string;

  /**
   * @protected
   */
  protected storage: Storage;

  /**
   * @constructor
   */
  constructor({ storage, globalKey }: ILocalStorageOptions = {}) {
    this.storage = storage ?? localStorage;
    this.globalKey = globalKey ?? 'stores';
  }

  /**
   * @inheritDoc
   */
  get(): Record<string, any> | Promise<Record<string, any> | undefined> {
    try {
      return JSON.parse(this.storage.getItem(this.globalKey) || '{}') as Record<string, any>;
    } catch (e) {
      return {};
    }
  }

  /**
   * @inheritDoc
   */
  flush(): void | Promise<any> {
    return this.storage.removeItem(this.globalKey);
  }

  /**
   * @inheritDoc
   */
  set(value: Record<string, any> | undefined): void {
    return this.storage.setItem(this.globalKey, JSON.stringify(value || '{}'));
  }
}

export default LocalStorage;
