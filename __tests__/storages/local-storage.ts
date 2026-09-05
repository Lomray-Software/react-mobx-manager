import { expect } from 'chai';
import sinon from 'sinon';
import { afterEach, describe, it } from 'vitest';
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
});
