import type { IStorage } from '../types';

interface ICookiesStorageAttributes {
  expires?: number | Date | undefined;
  path?: string | undefined;
  domain?: string | undefined;
  secure?: boolean | undefined;
  sameSite?: 'strict' | 'Strict' | 'lax' | 'Lax' | 'none' | 'None' | undefined;
  [property: string]: any;
}

interface ICookieStorage {
  get: (key: string) => string | null | undefined;
  set: (key: string, value: string, options: ICookiesStorageAttributes) => any;
  remove: (key: string, options: ICookiesStorageAttributes) => any;
}

interface ICookiesStorageOptions {
  storage: ICookieStorage;
  globalKey?: string;
  cookieAttr?: ICookiesStorageAttributes;
}

/**
 * Cookie storage for mobx store manager
 */
class CookieStorage implements IStorage {
  /**
   * Cookie storage key
   */
  protected globalKey: string;

  /**
   * @protected
   */
  protected storage: ICookieStorage;

  /**
   * Cookie attributes
   */
  protected cookieAttr: ICookiesStorageAttributes;

  /**
   * @constructor
   */
  constructor({ storage, cookieAttr, globalKey }: ICookiesStorageOptions) {
    this.storage = storage;
    this.cookieAttr = cookieAttr ?? {};
    this.globalKey = globalKey ?? 'stores';
  }

  /**
   * @inheritDoc
   */
  public get(): Record<string, any> | Promise<Record<string, any> | undefined> {
    try {
      return JSON.parse(this.storage.get(this.globalKey) || '{}') as Record<string, any>;
    } catch {
      return {};
    }
  }

  /**
   * @inheritDoc
   */
  public flush(): void | Promise<any> {
    return this.storage.remove(this.globalKey, this.cookieAttr);
  }

  /**
   * @inheritDoc
   */
  public set(value: Record<string, any> | undefined): void {
    return this.storage.set(this.globalKey, JSON.stringify(value ?? {}), this.cookieAttr);
  }
}

export default CookieStorage;
