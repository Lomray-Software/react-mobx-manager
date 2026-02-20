import { expect } from 'chai';
import sinon from 'sinon';
import { describe, it, afterEach } from 'vitest';
import Manager from '@src/manager';
import onChangeListener from '@src/on-change-listener';
import CombinedStorage from '@src/storages/combined-storage';
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
  const persistedStoreId = 'persisted-id';

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
      'parent-context',
      'current-context',
      'suspense-id',
      'SampleComponent',
    );

    expect(result.hasCreationFailure).to.equal(true);
    expect(result.parentStores).to.deep.equal({});
    expect(manager.getStoresRelations().has('current-context')).to.equal(true);
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
    expect(logger.err).to.have.been.calledWith('Failed to persist stores: ');
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
});
