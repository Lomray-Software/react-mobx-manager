import sinon from 'sinon';
import { afterEach, describe, expect, it } from 'vitest';
import LocalStorage from '@src/storages/local-storage';

describe('LocalStorage', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('should read parsed value from storage', () => {
    const storage = {
      getItem: sandbox.stub().returns('{"foo":"bar"}'),
      removeItem: sandbox.stub(),
      setItem: sandbox.stub(),
    };

    const result = new LocalStorage({
      storage: storage as unknown as Storage,
      globalKey: 'custom',
    }).get();

    expect(result).to.deep.equal({ foo: 'bar' });
    sinon.assert.calledWith(storage.getItem, 'custom');
  });

  it('should return empty object on invalid json', () => {
    const storage = {
      getItem: sandbox.stub().returns('{'),
      removeItem: sandbox.stub(),
      setItem: sandbox.stub(),
    };

    const result = new LocalStorage({ storage: storage as unknown as Storage }).get();

    expect(result).to.deep.equal({});
  });

  it('should round trip undefined as an empty object', async () => {
    let raw: string | undefined;
    const storage = {
      getItem: sandbox.stub().callsFake(() => raw),
      setItem: sandbox.stub().callsFake((_key: string, value: string) => {
        raw = value;
      }),
      removeItem: sandbox.stub(),
    };
    const target = new LocalStorage({ storage: storage as unknown as Storage });

    await Promise.resolve(target.set(undefined));
    expect(raw).to.equal('{}');
    expect(await Promise.resolve(target.get())).to.deep.equal({});
  });

  it('should delegate set and flush to underlying storage', () => {
    const storage = {
      getItem: sandbox.stub(),
      removeItem: sandbox.stub(),
      setItem: sandbox.stub(),
    };
    const target = new LocalStorage({ storage: storage as unknown as Storage });

    void target.set({ foo: 'bar' });
    void target.flush();

    sinon.assert.calledWith(storage.setItem, 'stores', '{"foo":"bar"}');
    sinon.assert.calledWith(storage.removeItem, 'stores');
  });

  it('should save assembled json on incremental save', () => {
    const storage = {
      getItem: sandbox.stub(),
      removeItem: sandbox.stub(),
      setItem: sandbox.stub(),
    };
    const target = new LocalStorage({ storage: storage as unknown as Storage });

    target.saveChanges({ value: { a: {} }, changes: new Map(), toJSON: () => '{"a":{}}' });

    sinon.assert.calledOnceWithExactly(storage.setItem, 'stores', '{"a":{}}');
  });

  it('should keep overridden set of subclasses on incremental save', () => {
    const storage = {
      getItem: sandbox.stub(),
      removeItem: sandbox.stub(),
      setItem: sandbox.stub(),
    };
    const toJSON = sandbox.stub();

    class EncodedStorage extends LocalStorage {
      set(value: Record<string, any> | undefined): void {
        this.storage.setItem(this.globalKey, btoa(JSON.stringify(value)));
      }
    }

    new EncodedStorage({ storage: storage as unknown as Storage }).saveChanges({
      value: { a: 1 },
      changes: new Map(),
      toJSON,
    });

    sinon.assert.notCalled(toJSON);
    sinon.assert.calledOnceWithExactly(storage.setItem, 'stores', btoa('{"a":1}'));
  });
});
