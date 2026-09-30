import sinon from 'sinon';
import { afterEach, describe, expect, it } from 'vitest';
import AsyncStorage from '@src/storages/async-storage';
import CombinedStorage from '@src/storages/combined-storage';
import KeyValueStorage from '@src/storages/key-value-storage';
import LocalStorage from '@src/storages/local-storage';

describe('KeyValueStorage', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  /**
   * In-memory adapter
   */
  const createAdapter = (initial: Record<string, string> = {}, isAsync = false) => {
    const data = new Map(Object.entries(initial));
    const wrap = <T>(value: T) => (isAsync ? Promise.resolve(value) : value);

    return {
      data,
      getItem: sandbox.spy((key: string) => wrap(data.get(key) ?? null)),
      setItem: sandbox.spy((key: string, value: string) => wrap(void data.set(key, value))),
      removeItem: sandbox.spy((key: string) => wrap(void data.delete(key))),
    };
  };

  it('should save every store under own key', async () => {
    const adapter = createAdapter();
    const target = new CombinedStorage({ local: new KeyValueStorage({ storage: adapter }) });

    expect(await target.get()).to.deep.equal({ local: {} });

    await target.saveStoresData([
      [{ libStoreId: 'feed' }, { items: [1, 2] }],
      [{ libStoreId: 'settings' }, { theme: 'dark' }],
    ]);

    expect(Object.fromEntries(adapter.data)).to.deep.equal({
      'stores:feed': '{"items":[1,2]}',
      'stores:settings': '{"theme":"dark"}',
      'stores-keys': '["feed","settings"]',
    });

    adapter.setItem.resetHistory();
    await target.saveStoreData({ libStoreId: 'feed' }, { items: [3] });

    sinon.assert.calledOnceWithExactly(adapter.setItem, 'stores:feed', '{"items":[3]}');

    const restored = new CombinedStorage({ local: new KeyValueStorage({ storage: adapter }) });

    expect(await restored.get()).to.deep.equal({
      local: { feed: { items: [3] }, settings: { theme: 'dark' } },
    });
  });

  it('should skip broken store and missing values', async () => {
    const adapter = createAdapter(
      {
        'app-keys': '["broken","missing","valid"]',
        'app:broken': '{',
        'app:valid': '{"a":1}',
      },
      true,
    );
    const error = sandbox.stub(console, 'error');

    expect(await new KeyValueStorage({ storage: adapter, prefix: 'app' }).get()).to.deep.equal({
      valid: { a: 1 },
    });
    sinon.assert.calledOnce(error);
  });

  it('should migrate legacy data once and keep it by default', async () => {
    const adapter = createAdapter({ stores: '{"feed":{"items":[1]},"user":{"name":"a"}}' }, true);
    // async adapter
    const legacy = new AsyncStorage({ storage: adapter as never });
    const target = new KeyValueStorage({ storage: adapter, migrateFrom: legacy });

    expect(await target.get()).to.deep.equal({ feed: { items: [1] }, user: { name: 'a' } });
    expect(adapter.data.get('stores:feed')).to.equal('{"items":[1]}');
    expect(adapter.data.get('stores-keys')).to.equal('["feed","user"]');
    expect(adapter.data.has('stores')).to.equal(true);

    adapter.data.set('stores', '{"feed":{"items":["stale"]}}');

    expect(
      await new KeyValueStorage({ storage: adapter, migrateFrom: legacy }).get(),
    ).to.deep.equal({ feed: { items: [1] }, user: { name: 'a' } });
  });

  it('should remove legacy data after migration when requested', async () => {
    const adapter = createAdapter({ stores: '{"feed":{"items":[1]}}' });
    const target = new KeyValueStorage({
      storage: adapter,
      prefix: 'v2',
      migrateFrom: new LocalStorage({ storage: adapter as unknown as Storage }),
      shouldRemoveMigrated: true,
    });

    expect(await target.get()).to.deep.equal({ feed: { items: [1] } });
    expect(Object.fromEntries(adapter.data)).to.deep.equal({
      'v2:feed': '{"items":[1]}',
      'v2-keys': '["feed"]',
    });
  });

  it('should return legacy data and retry migration on the next save', async () => {
    const adapter = createAdapter({ stores: '{"feed":{"items":[1]},"user":{"name":"a"}}' });
    const error = sandbox.stub(console, 'error');
    const { setItem } = adapter;
    let isFull = true;

    adapter.setItem = sandbox.spy((key: string, value: string) => {
      if (isFull) {
        throw new Error('disk is full');
      }

      return setItem(key, value);
    });

    const target = new KeyValueStorage({
      storage: adapter,
      migrateFrom: new LocalStorage({ storage: adapter as unknown as Storage }),
      shouldRemoveMigrated: true,
    });

    expect(await target.get()).to.deep.equal({ feed: { items: [1] }, user: { name: 'a' } });
    expect([...adapter.data.keys()]).to.deep.equal(['stores']);

    isFull = false;
    await target.saveChanges({
      value: { feed: { items: [2] }, user: { name: 'a' } },
      changes: new Map([['feed', '{"items":[2]}']]),
      toJSON: () => '',
    });

    expect(Object.fromEntries(adapter.data)).to.deep.equal({
      'stores:feed': '{"items":[2]}',
      'stores:user': '{"name":"a"}',
      'stores-keys': '["feed","user"]',
    });
    sinon.assert.calledOnce(error);
  });

  it('should replace all stores on set and remove everything on flush', async () => {
    const adapter = createAdapter({
      'stores-keys': '["a","b"]',
      'stores:a': '{}',
      'stores:b': '{}',
      'stores:orphan': '{}',
      stores: '{"legacy":{}}',
    });
    const target = new KeyValueStorage({
      storage: adapter,
      migrateFrom: new LocalStorage({ storage: adapter as unknown as Storage }),
    });

    await target.get();
    await target.set({ b: { value: 1 }, c: { value: 2 } });

    expect(Object.fromEntries(adapter.data)).to.deep.equal({
      'stores-keys': '["b","c"]',
      'stores:b': '{"value":1}',
      'stores:c': '{"value":2}',
      'stores:orphan': '{}',
      stores: '{"legacy":{}}',
    });

    await target.flush();

    expect(Object.fromEntries(adapter.data)).to.deep.equal({ 'stores:orphan': '{}' });
  });

  it('should keep stores list when it cannot be read', async () => {
    const adapter = createAdapter({
      'stores-keys': '["feed","settings"]',
      'stores:feed': '{"items":[1]}',
      'stores:settings': '{"theme":"dark"}',
    });
    const error = sandbox.stub(console, 'error');
    const target = new KeyValueStorage({ storage: adapter });

    adapter.getItem = sandbox.spy((key: string): string | null => {
      throw new Error(`read failed: ${key}`);
    });

    expect(await target.get()).to.deep.equal({});

    await target.saveChanges({
      value: {},
      changes: new Map([['profile', '{"name":"a"}']]),
      toJSON: () => '',
    });

    expect(Object.fromEntries(adapter.data)).to.deep.equal({
      'stores-keys': '["feed","settings"]',
      'stores:feed': '{"items":[1]}',
      'stores:settings': '{"theme":"dark"}',
      'stores:profile': '{"name":"a"}',
    });
    sinon.assert.called(error);
  });

  it('should add stores to saved list without reading stores first', async () => {
    const adapter = createAdapter({ 'stores-keys': '["feed"]', 'stores:feed': '{}' }, true);

    await new KeyValueStorage({ storage: adapter }).saveChanges({
      value: {},
      changes: new Map([['settings', '{}']]),
      toJSON: () => '',
    });

    expect(adapter.data.get('stores-keys')).to.equal('["feed","settings"]');
  });

  it('should replace broken stores list on the next save', async () => {
    const adapter = createAdapter({ 'stores-keys': '{', 'stores:feed': '{}' });
    const error = sandbox.stub(console, 'error');
    const target = new KeyValueStorage({ storage: adapter });

    expect(await target.get()).to.deep.equal({});

    await target.saveChanges({
      value: {},
      changes: new Map([['settings', '{}']]),
      toJSON: () => '',
    });

    expect(adapter.data.get('stores-keys')).to.equal('["settings"]');
    sinon.assert.calledOnce(error);
  });

  it('should restore other stores when one of them cannot be read', async () => {
    const adapter = createAdapter({
      'stores-keys': '["feed","settings"]',
      'stores:feed': '{"items":[1]}',
      'stores:settings': '{"theme":"dark"}',
    });
    const error = sandbox.stub(console, 'error');
    const { getItem } = adapter;

    adapter.getItem = sandbox.spy((key: string) => {
      if (key === 'stores:feed') {
        throw new Error('read failed');
      }

      return getItem(key);
    });

    expect(await new KeyValueStorage({ storage: adapter }).get()).to.deep.equal({
      settings: { theme: 'dark' },
    });
    sinon.assert.calledOnce(error);
  });

  it('should return empty object when storage fails', async () => {
    const error = sandbox.stub(console, 'error');
    const target = new KeyValueStorage({
      storage: {
        getItem: () => Promise.reject(new Error('boom')),
        setItem: sandbox.stub(),
        removeItem: sandbox.stub(),
      },
    });

    expect(await target.get()).to.deep.equal({});
    sinon.assert.calledOnce(error);
  });
});
