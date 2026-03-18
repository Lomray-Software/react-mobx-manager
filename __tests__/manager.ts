import { expect } from 'chai';
import { makeAutoObservable } from 'mobx';
import sinon from 'sinon';
import { describe, it, afterEach } from 'vitest';
import { makeExported } from '@src/make-exported';
import Manager from '@src/manager';
import onChangeListener from '@src/on-change-listener';
import CombinedStorage from '@src/storages/combined-storage';
import StoreStatus from '@src/store-status';
import type { IConstructableStore } from '@src/types';
import wakeup from '@src/wakeup';

type TPersistedStoreCtor = IConstructableStore & {
  libStoreId?: string;
  prototype: {
    wakeup?: typeof wakeup;
    addOnChangeListener?: typeof onChangeListener;
  };
};

describe('Manager', () => {
  const sandbox = sinon.createSandbox();
  const componentName = 'SampleComponent';
  const contextId = 'current-context';
  const managedComponentName = 'ComponentName';
  const managedContextId = 'context-id';
  const parentContextId = 'parent-context';
  const persistedStoreId = 'persisted-id';
  const suspenseId = 'suspense-id';

  afterEach(() => {
    sandbox.restore();
    Manager.getPersistedStoresIds().clear();
    delete (window as Partial<Window>).mbxM;
    (Manager as unknown as { instance?: Manager }).instance = undefined;
  });

  it('should throw error if manager instance is not initialized', () => {
    expect(() => Manager.get()).to.throw('Store manager is not initialized.');
  });

  it('should apply queued init state from window on construction', () => {
    window.mbxM = [{ store1: { fromQueue: true } }];

    const manager = new Manager();

    expect((manager as unknown as { initState: Record<string, any> }).initState).to.deep.equal({
      store1: { fromQueue: true },
    });
    expect((window.mbxM as { push: unknown }).push).to.be.a('function');
  });

  it('should create global store if it does not exist', () => {
    class GlobalStore {
      public static isGlobal = true;

      public libStoreId?: string;

      public isGlobal?: boolean;

      constructor() {}
    }

    const manager = new Manager();

    const store = manager.getStore(GlobalStore);

    expect(store).to.be.instanceOf(GlobalStore);
    expect(store?.libStoreId).to.equal('GlobalStore');
    expect(store?.isGlobal).to.equal(true);
    expect(manager.getStores().has('GlobalStore')).to.equal(true);
  });

  it('should mark creation failure if parent store is not found', () => {
    class RelativeStore {
      public libStoreId?: string;

      public isGlobal?: boolean;

      constructor() {}
    }

    const manager = new Manager({
      options: { failedCreationStrategy: 'empty' },
    });

    const result = manager.createStores(
      [['parentStore', { store: RelativeStore, isParent: true }]],
      parentContextId,
      contextId,
      suspenseId,
      componentName,
    );

    expect(result.hasCreationFailure).to.equal(true);
    expect(result.parentStores).to.deep.equal({});
    expect(manager.getStoresRelations().has(contextId)).to.equal(true);
  });

  it('should serialize only requested stores ids', () => {
    const manager = new Manager();

    (manager.getStores() as Map<string, any>).set('store-1', {
      toJSON: () => ({ value: 1 }),
    });
    (manager.getStores() as Map<string, any>).set('store-2', {
      toJSON: () => ({ value: 2 }),
    });

    const result = manager.toJSON(['store-1', 'missing-id']);

    expect(result).to.deep.equal({
      'store-1': { value: 1 },
    });
  });

  it('should return false from savePersistedStore when persist is disabled', async () => {
    const storage = {
      get: sandbox.stub().resolves({}),
      set: sandbox.stub(),
      flush: sandbox.stub(),
    };

    const manager = new Manager({
      storage: new CombinedStorage({ local: storage }),
      options: { shouldDisablePersist: true },
    });

    const shouldPersist = await manager.savePersistedStore({
      libStoreId: persistedStoreId,
      toJSON: () => ({ value: 1 }),
    });

    expect(shouldPersist).to.equal(false);
  });

  it('should return false from savePersistedStore when storage save fails', async () => {
    const logger = {
      log: sandbox.stub(),
      err: sandbox.stub(),
      warn: sandbox.stub(),
      info: sandbox.stub(),
      debug: sandbox.stub(),
    };
    const storage = new CombinedStorage({
      local: {
        get: sandbox.stub().resolves({}),
        set: sandbox.stub(),
        flush: sandbox.stub(),
      },
    });

    sandbox.stub(storage, 'saveStoreData').rejects(new Error('boom'));

    const manager = new Manager({ storage, logger: logger as any });

    const shouldPersist = await manager.savePersistedStore({
      libStoreId: persistedStoreId,
      toJSON: () => ({ value: 1 }),
    });

    expect(shouldPersist).to.equal(false);
    sinon.assert.calledWith(logger.err, 'Failed to persist stores: ');
  });

  it('should attach default persisted handlers on persistStore', () => {
    class PersistedStore {}

    const persistedStoreCtor = PersistedStore as unknown as TPersistedStoreCtor;

    Manager.persistStore(persistedStoreCtor, persistedStoreId);

    expect(persistedStoreCtor.libStoreId).to.equal(persistedStoreId);
    expect(persistedStoreCtor.prototype.wakeup).to.equal(wakeup);
    expect(persistedStoreCtor.prototype.addOnChangeListener).to.equal(onChangeListener);
    expect(Manager.getPersistedStoresIds().has(persistedStoreId)).to.equal(true);
  });

  it('should not override existing persisted handlers on persistStore', () => {
    const customWakeup = sandbox.stub();
    const customListener = sandbox.stub();

    class PersistedStore {}
    const persistedStoreCtor = PersistedStore as unknown as TPersistedStoreCtor;

    persistedStoreCtor.prototype.wakeup = customWakeup;
    persistedStoreCtor.prototype.addOnChangeListener = customListener;

    Manager.persistStore(persistedStoreCtor, persistedStoreId);

    expect(persistedStoreCtor.prototype.wakeup).to.equal(customWakeup);
    expect(persistedStoreCtor.prototype.addOnChangeListener).to.equal(customListener);
  });

  it('should initialize storage and return manager instance', async () => {
    const storage = new CombinedStorage({
      local: {
        get: sandbox.stub().resolves({}),
        set: sandbox.stub(),
        flush: sandbox.stub(),
      },
    });
    const get = sandbox.stub(storage, 'get').resolves({});
    const manager = new Manager({ storage });

    const result = await manager.init();

    sinon.assert.calledOnce(get);
    expect(result).to.equal(manager);
  });

  it('should log initialization error when storage throws', async () => {
    const logger = {
      log: sandbox.stub(),
      err: sandbox.stub(),
      warn: sandbox.stub(),
      info: sandbox.stub(),
      debug: sandbox.stub(),
    };
    const storage = new CombinedStorage({
      local: {
        get: sandbox.stub().resolves({}),
        set: sandbox.stub(),
        flush: sandbox.stub(),
      },
    });

    sandbox.stub(storage, 'get').rejects(new Error('init-failed'));

    await new Manager({ storage, logger: logger as never }).init();

    sinon.assert.calledWith(logger.err, 'Failed initialized store manager: ');
  });

  it('should lookup relative store in parent context and report duplicates', () => {
    class LookupStore {
      public libStoreId?: string;
    }

    const logger = {
      log: sandbox.stub(),
      err: sandbox.stub(),
      warn: sandbox.stub(),
      info: sandbox.stub(),
      debug: sandbox.stub(),
    };
    const manager = new Manager({ logger: logger as never });
    const stores = manager.getStores() as Map<string, { id: string }>;

    stores.set('LookupStore--parent', { id: 'single' });
    manager.getStoresRelations().set('parent', {
      ids: new Set(['LookupStore--parent']),
      parentId: 'root',
      componentName: 'Parent',
    });

    expect(manager.getStore(LookupStore, { contextId: 'child', parentId: 'parent' })).to.deep.equal(
      {
        id: 'single',
      },
    );

    stores.set('LookupStore--parent--a', { id: 'first' });
    stores.set('LookupStore--parent--b', { id: 'second' });
    manager.getStoresRelations().set('parent-many', {
      ids: new Set(['LookupStore--parent--a', 'LookupStore--parent--b']),
      parentId: 'root',
      componentName: 'Parent',
    });

    expect(manager.getStore(LookupStore, { contextId: 'child-2', parentId: 'parent-many' })).to.be
      .undefined;
    sinon.assert.calledWith(
      logger.err,
      'Parent context has multiple stores with the same id, please pass key to getStore function.',
    );
  });

  it('should create dummy, parent and global stores through createStores', () => {
    class RelativeStore {
      public libStoreId?: string;

      constructor() {}
    }

    class GlobalStore {
      public static isGlobal = true;

      public libStoreId?: string;

      public isGlobal?: boolean;

      constructor() {}
    }

    const manager = new Manager({
      options: { failedCreationStrategy: 'dummy', destroyTimers: { init: 0 } },
    });
    const parentStoreId = 'RelativeStore--parent-context';
    const parentStore = { libStoreId: parentStoreId };

    (manager.getStores() as Map<string, unknown>).set(parentStoreId, parentStore);
    manager.getStoresRelations().set(parentContextId, {
      ids: new Set([parentStoreId]),
      parentId: 'root',
      componentName: 'Parent',
    });

    const result = manager.createStores(
      [
        ['parentStore', { store: RelativeStore, isParent: true }],
        ['globalStore', GlobalStore],
        ['dummyStore', { store: RelativeStore, isParent: true, id: 'dummy-id' }],
        ['relativeStore', RelativeStore],
      ],
      parentContextId,
      managedContextId,
      suspenseId,
      managedComponentName,
    );

    expect(result.parentStores.parentStore).to.equal(parentStore);
    expect(result.globalStores.globalStore).to.be.instanceOf(GlobalStore);
    expect(result.parentStores.dummyStore).to.be.instanceOf(RelativeStore);
    expect(result.relativeStores.relativeStore).to.be.instanceOf(RelativeStore);
    expect(result.hasCreationFailure).to.equal(false);
  });

  it('should pass component props only to relative stores', () => {
    const relativeCtor = sandbox.spy();
    const globalCtor = sandbox.spy();

    class RelativeStore {
      public libStoreId?: string;

      constructor(params: Record<string, any>) {
        relativeCtor(params.componentProps);
      }
    }

    class GlobalStore {
      public static isGlobal = true;

      public libStoreId?: string;
      public isGlobal?: boolean;

      constructor(params: Record<string, any>) {
        globalCtor(params.componentProps);
      }
    }

    const manager = new Manager();

    manager.createStores(
      [
        ['relativeStore', RelativeStore],
        ['globalStore', GlobalStore],
      ],
      parentContextId,
      managedContextId,
      suspenseId,
      managedComponentName,
      { foo: 'bar' },
    );

    sinon.assert.calledOnceWithExactly(relativeCtor, { foo: 'bar' });
    sinon.assert.calledOnceWithExactly(globalCtor, {});
  });

  it('should mount, touch, unmount and remove relative stores by timers', async () => {
    const clock = sandbox.useFakeTimers();
    const onDestroy = sandbox.stub();

    class RelativeStore {
      public libStoreId?: string;
      public libStoreStatus?: StoreStatus;
      public libDestroyTimer?: ReturnType<typeof setTimeout>;
      public isGlobal?: boolean;
      public onDestroy = onDestroy;

      constructor() {}
    }

    const manager = new Manager({
      options: {
        destroyTimers: {
          init: 0,
          touched: 5,
          unused: 5,
        },
      },
    });
    const result = manager.createStores(
      [['relativeStore', RelativeStore]],
      parentContextId,
      managedContextId,
      suspenseId,
      managedComponentName,
    );
    const store = result.relativeStores.relativeStore as RelativeStore;

    expect(store.libStoreStatus).to.equal(StoreStatus.init);

    manager.touchedStores({ relativeStore: store });
    expect(store.libStoreStatus).to.equal(StoreStatus.touched);

    const unmount = manager.mountStores(managedContextId, result);

    expect(store.libStoreStatus).to.equal(StoreStatus.inUse);

    unmount();

    expect(store.libStoreStatus).to.equal(StoreStatus.unused);

    await clock.tickAsync(5);

    expect(manager.getStores().has(store.libStoreId!)).to.equal(false);
    expect(manager.getSuspenseRelations().get(suspenseId)?.has(store.libStoreId!)).to.equal(false);
    sinon.assert.calledOnce(onDestroy);

    clock.restore();
  });

  it('should run cleanup returned from init when store is destroyed', async () => {
    const clock = sandbox.useFakeTimers();
    const onDestroy = sandbox.stub();
    const initCleanup = sandbox.stub();

    class RelativeStore {
      public libStoreId?: string;
      public libStoreStatus?: StoreStatus;
      public libDestroyTimer?: ReturnType<typeof setTimeout>;
      public isGlobal?: boolean;
      public onDestroy = onDestroy;

      public init() {
        return initCleanup;
      }
    }

    const manager = new Manager({
      options: {
        destroyTimers: {
          init: 0,
          unused: 5,
        },
      },
    });
    const result = manager.createStores(
      [['relativeStore', RelativeStore]],
      parentContextId,
      managedContextId,
      suspenseId,
      managedComponentName,
    );
    const unmount = manager.mountStores(managedContextId, result);

    unmount();
    await clock.tickAsync(5);

    sinon.assert.calledOnce(initCleanup);
    sinon.assert.calledOnce(onDestroy);

    clock.restore();
  });

  it('should destroy all manager stores and call their cleanup hooks', () => {
    const globalOnDestroy = sandbox.stub();
    const globalInitCleanup = sandbox.stub();
    const relativeOnDestroy = sandbox.stub();
    const relativeInitCleanup = sandbox.stub();

    class GlobalStore {
      public static isGlobal = true;

      public libStoreId?: string;
      public libDestroyTimer?: ReturnType<typeof setTimeout>;
      public isGlobal?: boolean;
      public onDestroy = globalOnDestroy;

      public init() {
        return globalInitCleanup;
      }
    }

    class RelativeStore {
      public libStoreId?: string;
      public libDestroyTimer?: ReturnType<typeof setTimeout>;
      public isGlobal?: boolean;
      public onDestroy = relativeOnDestroy;

      public init() {
        return relativeInitCleanup;
      }
    }

    const manager = new Manager();

    manager.getStore(GlobalStore);
    manager.createStores(
      [['relativeStore', RelativeStore]],
      parentContextId,
      managedContextId,
      suspenseId,
      managedComponentName,
    );

    manager.destroy();

    expect(manager.getStores().size).to.equal(0);
    expect(manager.getStoresRelations().size).to.equal(0);
    expect(manager.getSuspenseRelations().size).to.equal(0);
    sinon.assert.calledOnce(globalInitCleanup);
    sinon.assert.calledOnce(globalOnDestroy);
    sinon.assert.calledOnce(relativeInitCleanup);
    sinon.assert.calledOnce(relativeOnDestroy);
  });

  it('should return true when persisted store is saved successfully', async () => {
    const storage = new CombinedStorage({
      local: {
        get: sandbox.stub().resolves({}),
        set: sandbox.stub(),
        flush: sandbox.stub(),
      },
    });

    sandbox.stub(storage, 'saveStoreData').resolves();

    const shouldPersist = await new Manager({ storage }).savePersistedStore({
      libStoreId: persistedStoreId,
      toJSON: () => ({ value: 1 }),
    });

    expect(shouldPersist).to.equal(true);
  });

  it('should export observable props including nested exported observables', () => {
    const store = makeAutoObservable({
      visible: 1,
      nested: makeAutoObservable({
        value: 2,
      }),
      hidden: 3,
      plainValue: 'plain',
    });

    makeExported(store, {
      nested: 'observable',
      hidden: 'excluded',
      plainValue: 'simple',
    });

    expect(Manager.getObservableProps(store as never)).to.deep.equal({
      visible: 1,
      nested: {
        value: 2,
      },
      plainValue: 'plain',
    });
  });
});
