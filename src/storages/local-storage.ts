import type { IStorage } from '../types';

/**
 * Local storage for mobx store manager
 */
class LocalStorage implements IStorage {
  globalKey = 'stores';

  /**
   * @inheritDoc
   */
  get(): Record<string, any> | Promise<Record<string, any> | undefined> {
    try {
      return JSON.parse(localStorage.getItem(this.globalKey) || '{}') as Record<string, any>;
    } catch (e) {
      return {};
    }
  }

  /**
   * @inheritDoc
   */
  flush(): void | Promise<any> {
    return localStorage.removeItem(this.globalKey);
  }

  /**
   * @inheritDoc
   */
  set(value: Record<string, any> | undefined): void {
    return localStorage.setItem(this.globalKey, JSON.stringify(value || '{}'));
  }
}

export default LocalStorage;
