import sinon from 'sinon';
import { afterEach, describe, expect, it } from 'vitest';
import CombinedStorage from '@src/storages/combined-storage';
import type { IStorageChanges } from '@src/types';

describe('CombinedStorage', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('should load data from all storages', async () => {
    const target = new CombinedStorage({
      primary: {
        get: sandbox.stub().resolves({ store: { foo: 1 } }),
        set: sandbox.stub(),
        flush: sandbox.stub(),
      },
      secondary: {
        get: sandbox.stub().resolves({ store: { bar: 2 } }),
        set: sandbox.stub(),
        flush: sandbox.stub(),
      },
    });

    const result = await target.get();

    expect(result).to.deep.equal({
      primary: { store: { foo: 1 } },
      secondary: { store: { bar: 2 } },
    });
  });

  it('should return empty object when loading fails', async () => {
    const target = new CombinedStorage({
      primary: {
        get: sandbox.stub().rejects(new Error('boom')),
        set: sandbox.stub(),
        flush: sandbox.stub(),
      },
    });

    const result = await target.get();

    expect(result).to.deep.equal({});
  });

  it('should delegate set to target storage and ignore missing storage', () => {
    const set = sandbox.stub();
    const target = new CombinedStorage({
      primary: {
        get: sandbox.stub(),
        set,
        flush: sandbox.stub(),
      },
    });

    const shouldSet = target.set({ foo: 'bar' });
    const shouldSkip = target.set({ foo: 'bar' }, 'missing');

    expect(shouldSet).to.equal(set.firstCall.returnValue);
    expect(shouldSkip).to.be.undefined;
    sinon.assert.calledWith(set, { foo: 'bar' });
  });

  it('should merge persisted store data by configured attributes', async () => {
    const target = new CombinedStorage({
      primary: {
        get: sandbox.stub().resolves({ store: { foo: 1, bar: 2 } }),
        set: sandbox.stub(),
        flush: sandbox.stub(),
      },
      secondary: {
        get: sandbox.stub().resolves({ store: { baz: 3 } }),
        set: sandbox.stub(),
        flush: sandbox.stub(),
      },
    });

    await target.get();

    const result = target.getStoreData({
      libStoreId: 'store',
      libStorageOptions: {
        attributes: {
          primary: ['foo'],
          secondary: ['*'],
        },
      },
    });

    expect(result).to.deep.equal({ foo: 1, baz: 3 });
  });

  it('should save split store data and skip unchanged writes', async () => {
    const setPrimary = sandbox.stub().resolves();
    const setSecondary = sandbox.stub().resolves();
    const target = new CombinedStorage({
      primary: {
        get: sandbox.stub().resolves({}),
        set: setPrimary,
        flush: sandbox.stub(),
      },
      secondary: {
        get: sandbox.stub().resolves({}),
        set: setSecondary,
        flush: sandbox.stub(),
      },
    });

    await target.get();

    const store = {
      libStoreId: 'store',
      libStorageOptions: {
        behaviour: 'exclude' as const,
        attributes: {
          primary: ['foo'],
          secondary: ['*'],
        },
      },
    };

    await target.saveStoreData(store, { foo: 1, bar: 2 });
    await target.saveStoreData(store, { foo: 1, bar: 2 });

    sinon.assert.calledOnceWithExactly(setPrimary, { store: { foo: 1 } });
    sinon.assert.calledOnceWithExactly(setSecondary, { store: { bar: 2 } });
  });

  it.each(['A', 'B'])(
    'should save %s after flush without skipping or resurrecting data',
    async (id) => {
      let durable: Record<string, unknown> = {};
      const set = sandbox.spy((value: Record<string, unknown> | undefined) => {
        durable = value ?? {};
      });
      const target = new CombinedStorage({
        primary: {
          get: () => durable,
          set,
          flush: async () => {
            await Promise.resolve();
            durable = {};
          },
        },
      });

      await target.get();
      await target.saveStoreData({ libStoreId: 'A' }, { count: 1 });
      await target.flush();
      expect(durable).to.deep.equal({});
      expect(target.getStoreData({ libStoreId: 'A' })).to.deep.equal({});
      await target.saveStoreData({ libStoreId: id }, { count: 1 });
      expect(durable).to.deep.equal({ [id]: { count: 1 } });
      sinon.assert.calledTwice(set);
    },
  );

  it('should support include behaviour and flush all storages', async () => {
    const flushPrimary = sandbox.stub().resolves();
    const flushSecondary = sandbox.stub().resolves();
    const setPrimary = sandbox.stub().resolves();
    const setSecondary = sandbox.stub().resolves();
    const target = new CombinedStorage({
      primary: {
        get: sandbox.stub().resolves({}),
        set: setPrimary,
        flush: flushPrimary,
      },
      secondary: {
        get: sandbox.stub().resolves({}),
        set: setSecondary,
        flush: flushSecondary,
      },
    });

    await target.get();
    await target.saveStoreData(
      {
        libStoreId: 'store',
        libStorageOptions: {
          behaviour: 'include',
          attributes: {
            primary: ['foo'],
            secondary: ['foo'],
          },
        },
      },
      { foo: 1 },
    );
    await target.flush();

    sinon.assert.calledOnceWithExactly(setPrimary, { store: { foo: 1 } });
    sinon.assert.calledOnceWithExactly(setSecondary, { store: { foo: 1 } });
    sinon.assert.calledOnce(flushPrimary);
    sinon.assert.calledOnce(flushSecondary);
  });

  it('should return persisted attributes of store', () => {
    const target = new CombinedStorage({
      primary: { get: sandbox.stub(), set: sandbox.stub(), flush: sandbox.stub() },
      secondary: { get: sandbox.stub(), set: sandbox.stub(), flush: sandbox.stub() },
    });

    expect(target.getStoreAttributes({ libStoreId: 'store' })).to.be.undefined;
    expect(
      target.getStoreAttributes({
        libStoreId: 'store',
        libStorageOptions: { attributes: { primary: ['foo', 'bar'], secondary: ['bar', 'baz'] } },
      }),
    ).to.deep.equal(['foo', 'bar', 'baz']);
    expect(
      target.getStoreAttributes({
        libStoreId: 'store',
        libStorageOptions: { attributes: { primary: ['foo'], secondary: ['*'] } },
      }),
    ).to.be.undefined;
    expect(
      target.getStoreAttributes({ libStoreId: 'store', libStorageOptions: { attributes: {} } }),
    ).to.deep.equal([]);
  });

  it('should write every changed storage once for many stores', async () => {
    const setPrimary = sandbox.stub();
    const setSecondary = sandbox.stub();
    const target = new CombinedStorage({
      primary: { get: () => ({ old: { value: 0 } }), set: setPrimary, flush: sandbox.stub() },
      secondary: { get: () => ({}), set: setSecondary, flush: sandbox.stub() },
    });

    await target.get();
    await target.saveStoresData([
      [{ libStoreId: 'first' }, { value: 1 }],
      [{ libStoreId: 'second' }, { value: 2 }],
      [{ libStoreId: 'old' }, { value: 0 }],
    ]);

    sinon.assert.calledOnceWithExactly(setPrimary, {
      old: { value: 0 },
      first: { value: 1 },
      second: { value: 2 },
    });
    sinon.assert.notCalled(setSecondary);
  });

  it('should compare serialized data to skip unchanged writes', async () => {
    const set = sandbox.stub();
    const target = new CombinedStorage({
      primary: { get: () => ({ store: { date: '2020-01-01T00:00:00.000Z' } }), set, flush() {} },
    });

    await target.get();
    await target.saveStoreData({ libStoreId: 'store' }, { date: new Date('2020-01-01') });
    await target.saveStoreData({ libStoreId: 'empty' }, { skipped: undefined });

    sinon.assert.notCalled(set);

    await target.saveStoreData({ libStoreId: 'store' }, { date: new Date('2021-01-01') });

    sinon.assert.calledOnceWithExactly(set, { store: { date: new Date('2021-01-01') } });
  });

  it('should pass changes to storages with incremental save', async () => {
    const saveChanges = sandbox.stub<[IStorageChanges], void>();
    const set = sandbox.stub();
    const loaded = {
      'user-store': { name: 'Émilie "E" 🚀', tags: ['a', 'b'], nested: { deep: [1, { x: null }] } },
      '10': { numeric: true },
    };
    const target = new CombinedStorage({
      primary: {
        get: () => JSON.parse(JSON.stringify(loaded)) as typeof loaded,
        set,
        flush() {},
        saveChanges,
      },
    });

    await target.get();
    await target.saveStoresData([
      [{ libStoreId: 'feed' }, { items: [{ id: 1, text: 'line\nbreak' }], empty: undefined }],
      [{ libStoreId: 'user-store' }, { ...loaded['user-store'], name: 'Emily' }],
    ]);

    sinon.assert.notCalled(set);
    sinon.assert.calledOnce(saveChanges);

    const [{ value, changes, toJSON }] = saveChanges.firstCall.args;

    expect([...changes]).to.deep.equal([
      ['feed', JSON.stringify({ items: [{ id: 1, text: 'line\nbreak' }] })],
      ['user-store', JSON.stringify({ ...loaded['user-store'], name: 'Emily' })],
    ]);
    expect(toJSON()).to.equal(JSON.stringify(value));
    expect(JSON.parse(toJSON())).to.deep.equal({
      ...loaded,
      'user-store': { ...loaded['user-store'], name: 'Emily' },
      feed: { items: [{ id: 1, text: 'line\nbreak' }] },
    });
  });

  it('should write other storages and reject when storage fails', async () => {
    const setSecondary = sandbox.stub();
    const target = new CombinedStorage({
      primary: {
        get: () => ({}),
        set: () => {
          throw new Error('quota');
        },
        flush() {},
      },
      secondary: { get: () => ({}), set: setSecondary, flush() {} },
    });

    await target.get();

    const result = target.saveStoreData(
      {
        libStoreId: 'store',
        libStorageOptions: {
          behaviour: 'include',
          attributes: { primary: ['a'], secondary: ['b'] },
        },
      },
      { a: 1, b: 2 },
    );

    sinon.assert.calledOnceWithExactly(setSecondary, { store: { b: 2 } });
    await expect(result).rejects.toThrow('quota');
  });

  it('should save other stores and reject when store data is not serializable', async () => {
    const set = sandbox.stub();
    const target = new CombinedStorage({ primary: { get: () => ({}), set, flush() {} } });

    await target.get();

    await expect(
      target.saveStoresData([
        [{ libStoreId: 'broken' }, { value: 1n }],
        [{ libStoreId: 'valid' }, { value: 1 }],
      ]),
    ).rejects.toThrow(TypeError);
    sinon.assert.calledOnceWithExactly(set, { valid: { value: 1 } });
  });
});
