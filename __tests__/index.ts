import { expect } from 'chai';
import { afterEach, describe, it, vi } from 'vitest';

describe('index', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@src/with-stores');
  });

  it('should re-export public api', async () => {
    const withStores = () => 'with-stores';

    vi.doMock('@src/with-stores', () => ({
      default: withStores,
    }));

    const api = await import('@src/index');
    const { default: Manager } = await import('@src/manager');
    const { default: Logger } = await import('@src/logger');
    const { default: Events } = await import('@src/events');
    const { default: wakeup } = await import('@src/wakeup');
    const { default: onChangeListener } = await import('@src/on-change-listener');

    expect(api.Manager).to.equal(Manager);
    expect(api.Logger).to.equal(Logger);
    expect(api.Events).to.equal(Events);
    expect(api.wakeup).to.equal(wakeup);
    expect(api.onChangeListener).to.equal(onChangeListener);
    expect(api.withStores).to.equal(withStores);
    expect(api.StoreManagerProvider).to.be.a('function');
    expect(api.makeExported).to.be.a('function');
    expect(api.makeFetching).to.equal((await import('@src/make-fetching')).default);
  });
});
