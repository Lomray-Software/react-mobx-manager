import { expect } from 'chai';
import sinon from 'sinon';
import { afterEach, describe, it } from 'vitest';
import ManagerHmr from '@src/plugins/dev-extension/hmr/service';

describe('plugins/dev-extension/hmr/service', () => {
  const sandbox = sinon.createSandbox();
  const appId = 'hmr-service-test';

  afterEach(() => {
    sandbox.restore();
    new ManagerHmr({
      appId,
      manager: {
        destroy: () => undefined,
        getStoreState: () => ({}),
        getStores: () => new Map(),
        pushInitState: () => undefined,
      } as never,
    }).clear();
  });

  it('should save and restore stores state by libStoreId', () => {
    const saveManager = {
      destroy: sandbox.stub(),
      getStoreState: sandbox.stub().callsFake((store) => ({ value: store.value })),
      getStores: () =>
        new Map([
          ['GlobalStore', { libStoreId: 'GlobalStore', value: 1 }],
          ['RelativeStore--T--field', { libStoreId: 'RelativeStore--T--field', value: 2 }],
        ]),
      pushInitState: sandbox.stub(),
    };
    const pushInitState = sandbox.stub();
    const existingStore = { libStoreId: 'GlobalStore', value: 0, nested: { prev: true } };
    const restoreManager = {
      destroy: sandbox.stub(),
      getStoreState: sandbox.stub(),
      getStores: () => new Map([['GlobalStore', existingStore]]),
      pushInitState,
    };

    new ManagerHmr({ manager: saveManager as never, appId }).save();

    const hasRestored = new ManagerHmr({ manager: restoreManager as never, appId }).restore();

    expect(hasRestored).to.equal(true);
    sinon.assert.calledOnce(pushInitState);
    expect(pushInitState.firstCall.args[0]).to.deep.equal({
      GlobalStore: { value: 1 },
      'RelativeStore--T--field': { value: 2 },
    });
    expect(existingStore).to.deep.equal({
      libStoreId: 'GlobalStore',
      value: 1,
      nested: { prev: true },
    });
  });

  it('should save snapshot and destroy manager on dispose', () => {
    const destroy = sandbox.stub();
    const manager = {
      destroy,
      getStoreState: sandbox.stub().returns({ value: 1 }),
      getStores: () => new Map([['GlobalStore', { libStoreId: 'GlobalStore' }]]),
      pushInitState: sandbox.stub(),
    };
    const restoreManager = {
      destroy: sandbox.stub(),
      getStoreState: sandbox.stub(),
      getStores: () => new Map(),
      pushInitState: sandbox.stub(),
    };

    new ManagerHmr({ manager: manager as never, appId }).dispose();

    sinon.assert.calledOnce(destroy);

    const hasRestored = new ManagerHmr({ manager: restoreManager as never, appId }).restore();

    expect(hasRestored).to.equal(true);
  });
});
