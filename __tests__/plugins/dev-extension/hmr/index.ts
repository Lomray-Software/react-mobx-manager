import { expect } from 'chai';
import sinon from 'sinon';
import { afterEach, describe, it } from 'vitest';
import {
  connectReactNativeHmr,
  connectViteHmr,
  connectWebpackHmr,
  ManagerHmr,
} from '@src/plugins/dev-extension/hmr';

describe('plugins/dev-extension/hmr/index', () => {
  const sandbox = sinon.createSandbox();
  const appId = 'hmr-adapter-test';
  const manager = {
    destroy: sandbox.stub(),
    getStoreState: sandbox.stub(),
    getStores: () => new Map(),
    pushInitState: sandbox.stub(),
  };

  afterEach(() => {
    sandbox.restore();
    new ManagerHmr({ manager: manager as never, appId }).clear();
  });

  it('should bind vite runtime and register accept and dispose handlers', () => {
    const accept = sandbox.stub();
    const dispose = sandbox.stub();

    const bridge = connectViteHmr(manager as never, { accept, dispose, data: {} }, { appId });

    expect(bridge).to.be.instanceOf(ManagerHmr);
    sinon.assert.calledOnce(accept);
    sinon.assert.calledOnce(dispose);
  });

  it('should restore snapshot without runtime for manual environments', () => {
    new ManagerHmr({
      appId,
      manager: {
        destroy: sandbox.stub(),
        getStoreState: sandbox.stub().returns({ value: 5 }),
        getStores: () => new Map([['Store', { libStoreId: 'Store' }]]),
        pushInitState: sandbox.stub(),
      } as never,
    }).save();

    connectReactNativeHmr(manager as never, undefined, { appId });

    sinon.assert.calledOnce(manager.pushInitState);
    expect(manager.pushInitState.firstCall.args[0]).to.deep.equal({
      Store: { value: 5 },
    });
  });

  it('should use the same runtime contract for webpack adapter', () => {
    const accept = sandbox.stub();
    const dispose = sandbox.stub();

    const bridge = connectWebpackHmr(manager as never, { accept, dispose, data: {} }, { appId });

    expect(bridge).to.be.instanceOf(ManagerHmr);
    sinon.assert.calledOnce(accept);
    sinon.assert.calledOnce(dispose);
  });
});
