import { expect } from 'chai';
import sinon from 'sinon';
import { afterEach, describe, it, vi } from 'vitest';

describe('onChangeListener', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('mobx');
  });

  it('should return undefined when persist is disabled', async () => {
    const { default: onChangeListener } = await import('@src/on-change-listener');
    const listener = onChangeListener!;

    const result = listener({ toJSON: () => ({}) }, {
      options: { shouldDisablePersist: true },
    } as never);

    expect(result).to.be.undefined;
  });

  it('should subscribe with reaction and persist store changes', async () => {
    const dispose = sinon.stub();
    const reaction = sinon.stub().callsFake((track, effect) => {
      track();
      effect();

      return dispose;
    });
    const toJS = sinon.stub().returns({ fromToJs: true });

    vi.doMock('mobx', () => ({
      reaction,
      toJS,
    }));

    const { default: onChangeListener } = await import('@src/on-change-listener');
    const listener = onChangeListener!;
    const manager = {
      options: { shouldDisablePersist: false },
      storage: {},
      savePersistedStore: sinon.stub(),
    };
    const store = {};

    const result = listener(store, manager as never);

    sinon.assert.calledOnce(reaction);
    sinon.assert.calledWith(toJS, store);
    sinon.assert.calledWith(manager.savePersistedStore, store);
    expect(result).to.equal(dispose);
  });
});
