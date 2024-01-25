import { expect } from 'chai';
import { describe, it } from 'vitest';
import wakeup from '@src/wakeup';

describe('wakeup', () => {
  it('should restore persisted store state', () => {
    const persistedState = { prop1: 'value1', prop2: 'value2' };
    const stores = { prop1: 'initialValue1', prop2: 'initialValue2' };

    const context = {
      persistedState,
    };

    wakeup.call(stores, context);

    expect(stores.prop1).to.equal(persistedState.prop1);
    expect(stores.prop2).to.equal(persistedState.prop2);
  });

  it('should not modify store if persistedState is undefined', () => {
    const stores = { prop1: 'initialValue1', prop2: 'initialValue2' };

    const context = {
      persistedState: undefined,
    };

    wakeup.call(stores, context);

    // Ensure that the stores remain unchanged
    expect(stores.prop1).to.equal('initialValue1');
    expect(stores.prop2).to.equal('initialValue2');
  });
});
