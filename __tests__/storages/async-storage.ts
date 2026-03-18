import { expect } from 'chai';
import sinon from 'sinon';
import { afterEach, describe, it } from 'vitest';
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
});
