import type { IStorage } from '../types';

/**
 * Local storage for mobx store manager
 */
class LocalStorage implements IStorage {
  globalKey = 'stores';

  /**
   * @protected
   */
  protected storage: Storage;

  /**
   * @constructor
   */
  constructor(storage: Storage = localStorage) {
    this.storage = storage;
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
