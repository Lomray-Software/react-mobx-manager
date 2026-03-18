import { expect } from 'chai';
import sinon from 'sinon';
import { afterEach, describe, it, vi } from 'vitest';

describe('plugins/dev-extension/state-listener', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unmock('mobx');
  });

  it('should build context keys and collect stores state', async () => {
    const spy = sinon.stub().returns(() => undefined);

    vi.doMock('mobx', () => ({
      spy,
      untracked: (callback: () => unknown) => callback(),
    }));

    const { default: StateListener } = await import('@src/plugins/dev-extension/state-listener');
    const manager = {
      getStores: () =>
        new Map([
          ['store-1', { toJSON: () => ({ foo: 1 }) }],
          ['store-2', { toJSON: () => ({ bar: 2 }) }],
        ]),
      getStoresRelations: () =>
        new Map([
          ['root', { ids: new Set(), parentId: null, componentName: 'Root' }],
          ['ctx-1', { ids: new Set(['store-1']), parentId: 'root', componentName: 'Page' }],
          ['ctx-2', { ids: new Set(['store-2']), parentId: 'ctx-1', componentName: 'Widget' }],
        ]),
    };
    const target = new StateListener(manager as never);

    expect(target['getContextKey']('root')).to.equal('root');
    expect(target['getContextKey']('ctx-2')).to.equal('root.ctx-1.ctx-2');
    expect(target['getStoresState']()).to.deep.equal({
      root: {
        'ctx-1': {
          componentName: 'Page',
          stores: {
            'store-1': { foo: 1 },
          },
          'ctx-2': {
            componentName: 'Widget',
            stores: {
              'store-2': { bar: 2 },
            },
          },
        },
      },
    });
  });

  it('should subscribe on spy events and emit safe payloads', async () => {
    const sandbox = sinon.createSandbox();
    const clock = sandbox.useFakeTimers();
    let listener: ((event: Record<string, unknown>) => void) | undefined;
    const unsubscribe = sandbox.stub();

    vi.doMock('mobx', () => ({
      spy: (callback: typeof listener) => {
        listener = callback;

        return unsubscribe;
      },
      untracked: (callback: () => unknown) => callback(),
    }));

    const { default: StateListener } = await import('@src/plugins/dev-extension/state-listener');
    const manager = {
      __devOnChange: sandbox.stub(),
      getStores: () => new Map(),
      getStoresRelations: () => new Map(),
    };
    const target = new StateListener(manager as never);

    target.subscribe();
    listener?.({
      type: 'action',
      name: 'update',
      array: [1, 2],
      callback: () => undefined,
      nested: { foo: 'bar' },
    });
    await clock.tickAsync(20);

    expect(manager.__devOnChange).to.have.been.calledWith({
      event: {
        type: 'action',
        name: 'update',
        array: { length: 2 },
        nested: { objectType: 'Object' },
      },
      storesState: { root: {} },
    });

    manager.__devOnChange.resetHistory();
    listener?.({ type: 'report-end' });
    await clock.tickAsync(20);

    expect(manager.__devOnChange).to.have.callCount(0);

    clock.restore();
    sandbox.restore();
  });
});
