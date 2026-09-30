import { IDBFactory } from 'fake-indexeddb';
import { makeObservable, observable, runInAction } from 'mobx';
import sinon from 'sinon';
import { afterEach, describe, expect, it } from 'vitest';
import Manager from '@src/manager';
import CombinedStorage from '@src/storages/combined-storage';
import IndexedDBStorage from '@src/storages/indexed-db-storage';
import LocalStorage from '@src/storages/local-storage';

describe('IndexedDBStorage', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
    Manager.getPersistedStoresIds().clear();
  });

  /**
   * In-memory localStorage
   */
  const createLocalStorage = (initial: Record<string, string> = {}) => {
    const data = new Map(Object.entries(initial));

    return {
      data,
      storage: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => void data.set(key, value),
        removeItem: (key: string) => void data.delete(key),
      } as unknown as Storage,
    };
  };

  it('should save every store as own record', async () => {
    const indexedDB = new IDBFactory();
    const target = new CombinedStorage({ local: new IndexedDBStorage({ indexedDB }) });

    expect(await target.get()).to.deep.equal({ local: {} });

    await target.saveStoresData([
      [{ libStoreId: 'feed' }, { items: [1, 2] }],
      [{ libStoreId: 'settings' }, { theme: 'dark' }],
    ]);
    await target.saveStoreData({ libStoreId: 'feed' }, { items: [3] });

    const restored = new IndexedDBStorage({ indexedDB });

    expect(await restored.get()).to.deep.equal({
      feed: { items: [3] },
      settings: { theme: 'dark' },
    });
  });

  it('should migrate legacy data once and keep it by default', async () => {
    const indexedDB = new IDBFactory();
    const { data, storage } = createLocalStorage({ stores: '{"feed":{"items":[1]}}' });
    const migrateFrom = new LocalStorage({ storage });

    expect(await new IndexedDBStorage({ indexedDB, migrateFrom }).get()).to.deep.equal({
      feed: { items: [1] },
    });
    expect(data.has('stores')).to.equal(true);

    data.set('stores', '{"feed":{"items":["stale"]}}');

    expect(await new IndexedDBStorage({ indexedDB, migrateFrom }).get()).to.deep.equal({
      feed: { items: [1] },
    });
  });

  it('should remove legacy data after migration when requested', async () => {
    const indexedDB = new IDBFactory();
    const { data, storage } = createLocalStorage({ stores: '{"feed":{"items":[1]}}' });
    const target = new IndexedDBStorage({
      indexedDB,
      dbName: 'app',
      migrateFrom: new LocalStorage({ storage }),
      shouldRemoveMigrated: true,
    });

    expect(await target.get()).to.deep.equal({ feed: { items: [1] } });
    expect(data.size).to.equal(0);
    expect(await new IndexedDBStorage({ indexedDB, dbName: 'app' }).get()).to.deep.equal({
      feed: { items: [1] },
    });
  });

  it('should return legacy data and retry migration on the next save', async () => {
    const indexedDB = new IDBFactory();
    const { storage } = createLocalStorage({
      stores: '{"feed":{"items":[1]},"user":{"name":"a"}}',
    });
    const error = sandbox.stub(console, 'error');
    const target = new IndexedDBStorage({ indexedDB, migrateFrom: new LocalStorage({ storage }) });
    const write = sandbox.stub(target as unknown as { write: () => Promise<void> }, 'write');

    write.callThrough();
    write.onFirstCall().rejects(new Error('quota exceeded'));

    expect(await target.get()).to.deep.equal({ feed: { items: [1] }, user: { name: 'a' } });

    await target.saveChanges({
      value: { feed: { items: [2] }, user: { name: 'a' } },
      changes: new Map([['feed', '{"items":[2]}']]),
      toJSON: () => '',
    });

    expect(await new IndexedDBStorage({ indexedDB }).get()).to.deep.equal({
      feed: { items: [2] },
      user: { name: 'a' },
    });
    sinon.assert.calledOnce(error);
  });

  it('should reopen database after connection is closed', async () => {
    const indexedDB = new IDBFactory();
    const target = new IndexedDBStorage({ indexedDB });

    await target.get();

    const { db } = target as unknown as { db: IDBDatabase };

    db.close();
    db.onclose?.(new Event('close'));

    await target.saveChanges({
      value: {},
      changes: new Map([['feed', '{"items":[1]}']]),
      toJSON: () => '',
    });

    expect(await new IndexedDBStorage({ indexedDB }).get()).to.deep.equal({
      feed: { items: [1] },
    });
  });

  it('should replace all stores on set and clear everything on flush', async () => {
    const indexedDB = new IDBFactory();
    const { data, storage } = createLocalStorage({ stores: '{"legacy":{}}' });
    const target = new IndexedDBStorage({ indexedDB, migrateFrom: new LocalStorage({ storage }) });

    await target.get();
    await target.set({ b: { value: 1 } });

    expect(await new IndexedDBStorage({ indexedDB }).get()).to.deep.equal({ b: { value: 1 } });

    await target.flush();

    expect(await new IndexedDBStorage({ indexedDB }).get()).to.deep.equal({});
    expect(data.size).to.equal(0);
  });

  it('should use legacy storage when IndexedDB is not available', async () => {
    const { data, storage } = createLocalStorage({ stores: '{"feed":{"items":[1]}}' });
    const target = new CombinedStorage({
      local: new IndexedDBStorage({ migrateFrom: new LocalStorage({ storage }) }),
    });

    // jsdom doesn't implement IndexedDB
    expect(globalThis.indexedDB).to.be.undefined;
    expect(await target.get()).to.deep.equal({ local: { feed: { items: [1] } } });

    await target.saveStoreData({ libStoreId: 'feed' }, { items: [2] });

    expect(data.get('stores')).to.equal('{"feed":{"items":[2]}}');
  });

  it('should return empty object when database cannot be opened', async () => {
    const error = sandbox.stub(console, 'error');
    const indexedDB = new IDBFactory();

    sandbox.stub(indexedDB, 'open').throws(new Error('denied'));

    const target = new IndexedDBStorage({ indexedDB });

    expect(await target.get()).to.deep.equal({});
    await target.saveChanges({ value: {}, changes: new Map([['a', '{}']]), toJSON: () => '' });
    sinon.assert.calledOnce(error);
  });

  it('should persist manager stores', async () => {
    class SettingsStore {
      public static isGlobal = true;

      public theme = 'light';

      constructor() {
        makeObservable(this, { theme: observable });
      }
    }

    Manager.persistStore(SettingsStore, 'settings');

    const indexedDB = new IDBFactory();
    const manager = new Manager({
      storage: new CombinedStorage({ local: new IndexedDBStorage({ indexedDB }) }),
    });

    await manager.init();

    const store = manager.getStore(SettingsStore)!;

    runInAction(() => {
      store.theme = 'dark';
    });

    expect(await manager.flushPersist()).to.equal(true);
    expect(await new IndexedDBStorage({ indexedDB }).get()).to.deep.equal({
      settings: { theme: 'dark' },
    });
  });
});
