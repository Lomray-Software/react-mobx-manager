import type { IStorage, IStorageChanges } from '../types';

/**
 * Browsers ignore cookies bigger than ~4KB
 */
const MAX_COOKIE_SIZE = 4096;

let hasSizeWarning = false;

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- cookie adapters (js-cookie, universal-cookie) return library-specific values that are passed through as-is.
    return this.storage.remove(this.globalKey, this.cookieAttr);
  }

  /**
   * @inheritDoc
   */
  public set(value: Record<string, any> | undefined): void {
    return this.write(JSON.stringify(value ?? {}));
  }

  /**
   * @inheritDoc
   */
  public saveChanges({ value, toJSON }: IStorageChanges): void {
    // keep custom serialization of subclasses
    if (this.set !== CookieStorage.prototype.set) {
      return this.set(value);
    }

    return this.write(toJSON());
  }

  /**
   * Write cookie
   */
  protected write(json: string): void {
    if (!hasSizeWarning && encodeURIComponent(json).length > MAX_COOKIE_SIZE) {
      hasSizeWarning = true;
      console.warn(
        `Persisted stores cookie "${this.globalKey}" is bigger than ${MAX_COOKIE_SIZE} bytes and can be ignored by browsers. Move big attributes to another storage.`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- cookie adapters (js-cookie, universal-cookie) return library-specific values that are passed through as-is.
    return this.storage.set(this.globalKey, json, this.cookieAttr);
  }
}

export default CookieStorage;
