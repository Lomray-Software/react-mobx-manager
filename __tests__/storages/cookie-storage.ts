import { expect } from 'chai';
import sinon from 'sinon';
import { afterEach, describe, it } from 'vitest';
import CookieStorage from '@src/storages/cookie-storage';

describe('CookieStorage', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('should read parsed value from cookies storage', () => {
    const storage = {
      get: sandbox.stub().returns('{"foo":"bar"}'),
      set: sandbox.stub(),
      remove: sandbox.stub(),
    };

    const result = new CookieStorage({ storage, globalKey: 'cookie-key' }).get();

    expect(result).to.deep.equal({ foo: 'bar' });
    sinon.assert.calledWith(storage.get, 'cookie-key');
  });

  it('should return empty object on invalid json', () => {
    const storage = {
      get: sandbox.stub().returns('{'),
      set: sandbox.stub(),
      remove: sandbox.stub(),
    };

    const result = new CookieStorage({ storage }).get();

    expect(result).to.deep.equal({});
  });

  it('should delegate set and flush with cookie attributes', () => {
    const storage = {
      get: sandbox.stub(),
      set: sandbox.stub(),
      remove: sandbox.stub(),
    };
    const cookieAttr = { path: '/', sameSite: 'lax' as const };
    const target = new CookieStorage({ storage, cookieAttr });

    void target.set({ foo: 'bar' });
    void target.flush();

    sinon.assert.calledWith(storage.set, 'stores', '{"foo":"bar"}', cookieAttr);
    sinon.assert.calledWith(storage.remove, 'stores', cookieAttr);
  });
});
