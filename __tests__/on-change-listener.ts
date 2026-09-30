import { extendObservable, makeObservable, observable, runInAction } from 'mobx';
import sinon from 'sinon';
import { afterEach, describe, expect, it } from 'vitest';
import { makeExported } from '@src/make-exported';
import Manager from '@src/manager';
import onChangeListener from '@src/on-change-listener';
import CombinedStorage from '@src/storages/combined-storage';
import type { IConstructorParams, IManagerOptions, IStorePersisted } from '@src/types';

describe('onChangeListener', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
    Manager.getPersistedStoresIds().clear();
  });

  class SessionStore {
    public static isGlobal = true;

    public counter = 0;

    constructor() {
      makeObservable(this, { counter: observable });
    }
  }

  /**
   * Fresh store class: persistStore keeps options in the class prototype
   */
  const createFeedStore = () =>
    class FeedStore {
      public static isGlobal = true;

      public items: string[] = [];

      public page = 1;

      public isFetching = false;

      public sessionStore: SessionStore;

      constructor({ getStore }: IConstructorParams) {
        this.sessionStore = getStore(SessionStore)!;

        makeObservable(this, { items: observable, page: observable, isFetching: observable });
      }
    };

  /**
   * Create manager with sync storage
   */
  const createManager = async (options: IManagerOptions = {}, data: Record<string, any> = {}) => {
    const set = sandbox.stub();
    const manager = new Manager({
      storage: new CombinedStorage({ local: { get: () => data, set, flush: sandbox.stub() } }),
      options,
      logger: { level: 0 },
    });

    await manager.init();

    return { manager, set };
  };

  it('should return undefined when persist is disabled', () => {
    const result = onChangeListener!({ toJSON: () => ({}) }, {
      options: { shouldDisablePersist: true },
    } as never);

    expect(result).to.be.undefined;
  });

  it('should return undefined when manager has no storage', () => {
    expect(onChangeListener!({}, new Manager())).to.be.undefined;
  });

  it('should track only persisted attributes and save changes in batches', async () => {
    const FeedStore = createFeedStore();

    Manager.persistStore(FeedStore, 'feed', {
      behaviour: 'include',
      attributes: { local: ['items', 'page'] },
    });

    const clock = sandbox.useFakeTimers();
    const { manager, set } = await createManager();
    const store = manager.getStore(FeedStore)!;

    runInAction(() => {
      store.isFetching = true;
    });
    runInAction(() => {
      store.sessionStore.counter += 1;
    });
    await clock.tickAsync(1000);

    sinon.assert.notCalled(set);

    runInAction(() => {
      store.items.push('a');
    });
    runInAction(() => {
      store.items.push('b');
      store.page = 2;
    });

    sinon.assert.notCalled(set);

    await clock.tickAsync(99);

    sinon.assert.notCalled(set);

    await clock.tickAsync(1);

    sinon.assert.calledOnceWithExactly(set, { feed: { items: ['a', 'b'], page: 2 } });

    runInAction(() => {
      store.items[0] = 'c';
    });
    await clock.tickAsync(100);

    sinon.assert.calledTwice(set);
    sinon.assert.calledWithExactly(set.secondCall, { feed: { items: ['c', 'b'], page: 2 } });
  });

  it('should persist all observable props by default without traversing other stores', async () => {
    const FeedStore = createFeedStore();

    Manager.persistStore(FeedStore, 'feed');

    const clock = sandbox.useFakeTimers();
    const { manager, set } = await createManager();
    const store = manager.getStore(FeedStore)!;

    runInAction(() => {
      store.sessionStore.counter += 1;
    });
    await clock.tickAsync(100);

    sinon.assert.notCalled(set);

    runInAction(() => {
      store.isFetching = true;
    });
    await clock.tickAsync(100);

    sinon.assert.calledOnceWithExactly(set, {
      feed: { items: [], page: 1, isFetching: true },
    });
  });

  it('should serialize store once per batch', async () => {
    const toJSON = sandbox.stub();

    class CustomStore {
      public static isGlobal = true;

      public value = 0;

      constructor() {
        makeObservable(this, { value: observable });
        toJSON.callsFake(() => ({ doubled: this.value * 2 }));
      }

      public toJSON() {
        return toJSON() as Record<string, any>;
      }
    }

    Manager.persistStore(CustomStore, 'custom');

    const clock = sandbox.useFakeTimers();
    const { manager, set } = await createManager();
    const store = manager.getStore(CustomStore)!;

    sinon.assert.calledOnce(toJSON);

    for (let index = 0; index < 5; index++) {
      runInAction(() => {
        store.value += 1;
      });
    }

    await clock.tickAsync(100);

    sinon.assert.calledTwice(toJSON);
    sinon.assert.calledOnceWithExactly(set, { custom: { doubled: 10 } });
  });

  it('should save on every change when persist delay is 0', async () => {
    const FeedStore = createFeedStore();

    Manager.persistStore(FeedStore, 'feed', { attributes: { local: ['page'] } });

    const { manager, set } = await createManager({ persistDelay: 0 });
    const store = manager.getStore(FeedStore)!;

    runInAction(() => {
      store.page = 2;
    });

    sinon.assert.calledOnceWithExactly(set, { feed: { page: 2 } });

    runInAction(() => {
      store.page = 3;
    });

    sinon.assert.calledTwice(set);
  });

  it('should save immediately on the server', async () => {
    const FeedStore = createFeedStore();

    Manager.persistStore(FeedStore, 'feed', { attributes: { local: ['page'] } });

    const { manager, set } = await createManager();

    manager.isServer = true;

    const store = manager.getStore(FeedStore)!;

    runInAction(() => {
      store.page = 2;
    });

    sinon.assert.calledOnceWithExactly(set, { feed: { page: 2 } });
  });

  it('should save scheduled changes before store is destroyed', async () => {
    const onDestroy = sandbox.stub();

    class DraftStore {
      public text = '';

      public onDestroy = onDestroy;

      constructor() {
        makeObservable(this, { text: observable });
      }
    }

    Manager.persistStore(DraftStore, 'draft');

    const clock = sandbox.useFakeTimers();
    const { manager, set } = await createManager();
    const { relativeStores } = manager.createStores(
      [['draft', DraftStore]],
      'parent',
      'context',
      'suspense',
      'Component',
    );
    const store = relativeStores.draft as DraftStore;

    runInAction(() => {
      store.text = 'hello';
    });
    manager.destroy();

    sinon.assert.calledOnceWithExactly(set, { draft: { text: 'hello' } });
    expect(set.calledBefore(onDestroy)).to.equal(true);

    await clock.tickAsync(1000);

    sinon.assert.calledOnce(set);
  });

  it('should save scheduled changes when page is hidden', async () => {
    const FeedStore = createFeedStore();

    Manager.persistStore(FeedStore, 'feed', { attributes: { local: ['page'] } });

    const clock = sandbox.useFakeTimers();
    const { manager, set } = await createManager();
    const store = manager.getStore(FeedStore)!;

    runInAction(() => {
      store.page = 2;
    });
    window.dispatchEvent(new Event('pagehide'));

    sinon.assert.calledOnceWithExactly(set, { feed: { page: 2 } });

    runInAction(() => {
      store.page = 3;
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    delete (document as { visibilityState?: string }).visibilityState;

    sinon.assert.calledTwice(set);
    sinon.assert.calledWithExactly(set.secondCall, { feed: { page: 3 } });

    await clock.tickAsync(1000);

    sinon.assert.calledTwice(set);
  });

  it('should stop tracking after dispose', async () => {
    class PlainStore {
      public libStoreId = 'plain';

      public value = 1;

      constructor() {
        makeObservable(this, { value: observable });
      }
    }

    const clock = sandbox.useFakeTimers();
    const { manager, set } = await createManager();
    const store = new PlainStore();
    const dispose = onChangeListener!(store, manager)!;

    runInAction(() => {
      store.value = 2;
    });
    await clock.tickAsync(100);

    sinon.assert.calledOnceWithExactly(set, { plain: { value: 2 } });

    dispose();
    runInAction(() => {
      store.value = 3;
    });
    await clock.tickAsync(100);

    sinon.assert.calledOnce(set);
  });

  it('should track props added later and exported props', async () => {
    class ProfileStore {
      public static isGlobal = true;

      public name = 'a';

      public settings = { theme: 'light' };

      public session: SessionStore;

      constructor({ getStore }: IConstructorParams) {
        this.session = getStore(SessionStore)!;

        makeObservable(this, { name: observable, settings: observable });
        makeExported(this, { session: 'observable' });
      }
    }

    Manager.persistStore(ProfileStore, 'profile');

    const clock = sandbox.useFakeTimers();
    const { manager, set } = await createManager();
    const store = manager.getStore(ProfileStore)!;

    runInAction(() => {
      extendObservable(store, { avatar: 'x.png' });
    });
    await clock.tickAsync(100);

    sinon.assert.calledOnceWithExactly(set, {
      profile: {
        name: 'a',
        settings: { theme: 'light' },
        session: { counter: 0 },
        avatar: 'x.png',
      },
    });

    runInAction(() => {
      (store as ProfileStore & { avatar: string }).avatar = 'y.png';
      store.session.counter = 5;
    });
    await clock.tickAsync(100);

    sinon.assert.calledWithExactly(set.secondCall, {
      profile: {
        name: 'a',
        settings: { theme: 'light' },
        session: { counter: 5 },
        avatar: 'y.png',
      },
    });
  });

  it('should save merged init state restored on wakeup', async () => {
    class SettingsStore {
      public static isGlobal = true;

      public theme = 'light';

      public lang = 'en';

      constructor() {
        makeObservable(this, { theme: observable, lang: observable });
      }
    }

    Manager.persistStore(SettingsStore, 'settings');

    const clock = sandbox.useFakeTimers();
    const set = sandbox.stub();
    const manager = new Manager({
      storage: new CombinedStorage({
        local: { get: () => ({ settings: { theme: 'dark' } }), set, flush: sandbox.stub() },
      }),
      initState: { settings: { lang: 'de' } },
    });

    await manager.init();

    const store = manager.getStore(SettingsStore)!;

    expect(store.theme).to.equal('dark');
    expect(store.lang).to.equal('de');

    await clock.tickAsync(100);

    sinon.assert.calledOnceWithExactly(set, { settings: { theme: 'dark', lang: 'de' } });
  });

  it('should keep tracking changes when persist is disabled at runtime', async () => {
    const FeedStore = createFeedStore();

    Manager.persistStore(FeedStore, 'feed', { attributes: { local: ['page'] } });

    const clock = sandbox.useFakeTimers();
    const { manager, set } = await createManager();
    const store = manager.getStore(FeedStore)!;

    runInAction(() => {
      store.page = 2;
    });
    manager.options.shouldDisablePersist = true;

    expect(await manager.flushPersist()).to.equal(false);

    runInAction(() => {
      store.page = 3;
    });
    await clock.tickAsync(100);

    sinon.assert.notCalled(set);

    manager.options.shouldDisablePersist = false;
    runInAction(() => {
      store.page = 4;
    });
    await clock.tickAsync(100);

    sinon.assert.calledOnceWithExactly(set, { feed: { page: 4 } });
  });

  it('should track store created inside action', async () => {
    const FeedStore = createFeedStore();

    Manager.persistStore(FeedStore, 'feed', { attributes: { local: ['page'] } });

    const clock = sandbox.useFakeTimers();
    const { manager, set } = await createManager();
    const store = runInAction(() => manager.getStore(FeedStore)!);

    runInAction(() => {
      store.page = 2;
    });
    await clock.tickAsync(100);

    sinon.assert.calledOnceWithExactly(set, { feed: { page: 2 } });
  });

  it('should report store serialization error and keep tracking', async () => {
    class ValueStore {
      public static isGlobal = true;

      public value = 0;

      constructor() {
        makeObservable(this, { value: observable });
      }

      public toJSON() {
        if (this.value === 1) {
          throw new Error('broken value');
        }

        return { value: this.value };
      }
    }

    Manager.persistStore(ValueStore, 'value');

    const clock = sandbox.useFakeTimers();
    const set = sandbox.stub();
    const err = sandbox.stub();
    const manager = new Manager({
      storage: new CombinedStorage({ local: { get: () => ({}), set, flush() {} } }),
      logger: { log: sandbox.stub(), err, warn: sandbox.stub(), debug: sandbox.stub() } as never,
    });

    await manager.init();

    const store = manager.getStore(ValueStore)!;

    runInAction(() => {
      store.value = 1;
    });

    expect(await manager.flushPersist()).to.equal(false);
    sinon.assert.calledOnce(err);
    sinon.assert.notCalled(set);

    runInAction(() => {
      store.value = 2;
    });
    await clock.tickAsync(100);

    sinon.assert.calledOnceWithExactly(set, { value: { value: 2 } });
  });

  it('should report failed flush', async () => {
    const store: IStorePersisted = {
      libStoreId: 'broken',
      toJSON: () => {
        throw new Error('boom');
      },
    };
    const err = sandbox.stub();
    const manager = new Manager({
      storage: new CombinedStorage({ local: { get: () => ({}), set: sandbox.stub(), flush() {} } }),
      logger: { log: sandbox.stub(), err, warn: sandbox.stub(), debug: sandbox.stub() } as never,
    });

    manager.schedulePersist(store);

    expect(await manager.flushPersist()).to.equal(false);
    sinon.assert.calledOnce(err);
    expect(await manager.flushPersist()).to.equal(true);
  });
});
