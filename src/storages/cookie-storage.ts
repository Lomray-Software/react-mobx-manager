import type { IStorage } from '../types';

interface ICookiesStorageOptions {
  expires?: number | Date | undefined;
  path?: string | undefined;
  domain?: string | undefined;
  secure?: boolean | undefined;
  sameSite?: 'strict' | 'Strict' | 'lax' | 'Lax' | 'none' | 'None' | undefined;
  [property: string]: any;
}

interface ICookieStorage {
  get: (key: string) => string | null | undefined;
  set: (key: string, value: string, options: ICookiesStorageOptions) => any;
  remove: (key: string, options: ICookiesStorageOptions) => any;
}

/**
 * Cookie storage for mobx store manager
 */
class CookieStorage implements IStorage {
  globalKey = 'stores';

  /**
   * @protected
   */
  protected storage: ICookieStorage;

  /**
   * Cookie options
   */
  protected options: ICookiesStorageOptions;

  /**
   * @constructor
   */
  constructor(storage: ICookieStorage, options: ICookiesStorageOptions = {}) {
    this.storage = storage;
    this.options = options;
  }

  /**
   * @inheritDoc
   */
  public get(): Record<string, any> | Promise<Record<string, any> | undefined> {
    try {
      return JSON.parse(this.storage.get(this.globalKey) || '{}') as Record<string, any>;
    } catch (e) {
      return {};
    }
  }

  /**
   * @inheritDoc
   */
  public flush(): void | Promise<any> {
    return this.storage.remove(this.globalKey, this.options);
  }

  /**
   * @inheritDoc
   */
  public set(value: Record<string, any> | undefined): void {
    return this.storage.set(this.globalKey, JSON.stringify(value || '{}'), this.options);
  }
}

export default CookieStorage;
