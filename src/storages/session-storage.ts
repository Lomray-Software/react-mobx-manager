import LocalStorage, { type ILocalStorageOptions } from './local-storage';

/**
 * Session storage for mobx store manager
 */
class SessionStorage extends LocalStorage {
  /**
   * @constructor
   */
  constructor({ storage, globalKey }: ILocalStorageOptions) {
    super({ globalKey, storage: storage ?? sessionStorage });
  }
}

export default SessionStorage;
