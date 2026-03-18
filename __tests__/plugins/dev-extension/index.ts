import { expect } from 'chai';
import sinon from 'sinon';
import { afterEach, describe, it, vi } from 'vitest';

describe('plugins/dev-extension/index', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unmock('@src/plugins/dev-extension/state-listener');
    delete (window as unknown as Record<string, unknown>).__MOBX_STORE_MANAGER__;
  });

  it('should connect manager to dev extension state listener', async () => {
    const subscribe = sinon.stub().returns('subscribed-manager');
    const StateListener = sinon.stub().returns({ subscribe });

    vi.doMock('@src/plugins/dev-extension/state-listener', () => ({
      default: StateListener,
    }));

    const { default: connectDevExtension } = await import('@src/plugins/dev-extension/index');
    const manager = { id: 'manager' };

    connectDevExtension(manager as never);

    expect(StateListener).to.have.been.calledWithNew;
    expect(subscribe).to.have.been.calledOnce;
    expect((window as unknown as Record<string, unknown>).__MOBX_STORE_MANAGER__).to.equal(
      'subscribed-manager',
    );
  });
});
