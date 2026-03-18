import { expect } from 'chai';
import sinon from 'sinon';
import { afterEach, describe, it } from 'vitest';
import CombinedStorage from '@src/storages/combined-storage';

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
    expect(set).to.have.been.calledWith({ foo: 'bar' });
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

    expect(setPrimary).to.have.been.calledOnceWith({ store: { foo: 1 } });
    expect(setSecondary).to.have.been.calledOnceWith({ store: { bar: 2 } });
  });

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

    expect(setPrimary).to.have.been.calledOnceWith({ store: { foo: 1 } });
    expect(setSecondary).to.have.been.calledOnceWith({ store: { foo: 1 } });
    expect(flushPrimary).to.have.been.calledOnce;
    expect(flushSecondary).to.have.been.calledOnce;
  });
});
