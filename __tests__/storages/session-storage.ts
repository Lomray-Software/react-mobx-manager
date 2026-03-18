import { expect } from 'chai';
import sinon from 'sinon';
import { describe, it } from 'vitest';
import SessionStorage from '@src/storages/session-storage';

describe('SessionStorage', () => {
  it('should use provided storage and delegate to local-storage behaviour', () => {
    const sessionKey = 'session-key';
    const storage = {
      getItem: sinon.stub().returns('{"foo":"bar"}'),
      removeItem: sinon.stub(),
      setItem: sinon.stub(),
    };
    const target = new SessionStorage({
      storage: storage as unknown as Storage,
      globalKey: sessionKey,
    });

    expect(target.get()).to.deep.equal({ foo: 'bar' });

    void target.set({ one: 1 });
    void target.flush();

    sinon.assert.calledWith(storage.setItem, sessionKey, '{"one":1}');
    sinon.assert.calledWith(storage.removeItem, sessionKey);
  });
});
