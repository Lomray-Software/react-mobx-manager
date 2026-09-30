import sinon from 'sinon';
import { afterEach, describe, expect, it } from 'vitest';
import AsyncStorage from '@src/storages/async-storage';

describe('AsyncStorage', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('should read parsed value from async storage', async () => {
    const storage = {
      getItem: sandbox.stub().resolves('{"foo":"bar"}'),
      setItem: sandbox.stub().resolves(),
      removeItem: sandbox.stub().resolves(),
    };

    const result = await new AsyncStorage({ storage, globalKey: 'async-key' }).get();

    expect(result).to.deep.equal({ foo: 'bar' });
    sinon.assert.calledWith(storage.getItem, 'async-key');
  });

  it('should return empty object and log error on invalid json', async () => {
    const storage = {
      getItem: sandbox.stub().resolves('{'),
      setItem: sandbox.stub().resolves(),
      removeItem: sandbox.stub().resolves(),
    };
    const error = sandbox.stub(console, 'error');

    const result = await new AsyncStorage({ storage }).get();

    expect(result).to.deep.equal({});
    sinon.assert.calledOnce(error);
  });

  it('should round trip undefined as an empty object', async () => {
    let raw: string | undefined;
    const storage = {
      getItem: sandbox.stub().callsFake(() => Promise.resolve(raw ?? null)),
      setItem: sandbox.stub().callsFake((_key: string, value: string) => {
        raw = value;

        return Promise.resolve();
      }),
      removeItem: sandbox.stub(),
    };
    const target = new AsyncStorage({ storage });

    await Promise.resolve(target.set(undefined));
    expect(raw).to.equal('{}');
    expect(await Promise.resolve(target.get())).to.deep.equal({});
  });

  it('should delegate set and flush and handle storage failures', async () => {
    const storage = {
      getItem: sandbox.stub().resolves('{}'),
      setItem: sandbox.stub().rejects(new Error('set-failed')),
      removeItem: sandbox.stub().rejects(new Error('remove-failed')),
    };
    const error = sandbox.stub(console, 'error');
    const target = new AsyncStorage({ storage });

    await target.set({ foo: 'bar' });
    await target.flush();

    sinon.assert.calledWith(storage.setItem, 'stores', '{"foo":"bar"}');
    sinon.assert.calledWith(storage.removeItem, 'stores');
    sinon.assert.calledTwice(error);
  });

  it('should save assembled json on incremental save and log errors', async () => {
    const storage = {
      getItem: sandbox.stub().resolves(null),
      setItem: sandbox.stub().resolves(),
      removeItem: sandbox.stub().resolves(),
    };
    const error = sandbox.stub(console, 'error');
    const target = new AsyncStorage({ storage });

    await target.saveChanges({ value: {}, changes: new Map(), toJSON: () => '{"a":1}' });

    sinon.assert.calledOnceWithExactly(storage.setItem, 'stores', '{"a":1}');

    storage.setItem.rejects(new Error('disk'));
    await target.saveChanges({ value: {}, changes: new Map(), toJSON: () => '{}' });

    sinon.assert.calledOnce(error);
  });

  it('should keep overridden set of subclasses on incremental save', async () => {
    const storage = {
      getItem: sandbox.stub().resolves(null),
      setItem: sandbox.stub().resolves(),
      removeItem: sandbox.stub().resolves(),
    };
    const set = sandbox.stub().resolves();

    class CustomStorage extends AsyncStorage {
      set(value: Record<string, any> | undefined): Promise<void> {
        return set(value) as Promise<void>;
      }
    }

    await new CustomStorage({ storage }).saveChanges({
      value: { a: 1 },
      changes: new Map(),
      toJSON: () => '',
    });

    sinon.assert.calledOnceWithExactly(set, { a: 1 });
    sinon.assert.notCalled(storage.setItem);
  });
});
