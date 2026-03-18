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
    expect(storage.getItem).to.have.been.calledWith('custom');
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

  it('should delegate set and flush to underlying storage', () => {
    const storage = {
      getItem: sandbox.stub(),
      removeItem: sandbox.stub(),
      setItem: sandbox.stub(),
    };
    const target = new LocalStorage({ storage: storage as unknown as Storage });

    void target.set({ foo: 'bar' });
    void target.flush();

    expect(storage.setItem).to.have.been.calledWith('stores', '{"foo":"bar"}');
    expect(storage.removeItem).to.have.been.calledWith('stores');
  });
});
