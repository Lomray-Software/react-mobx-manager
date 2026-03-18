import { expect } from 'chai';
import { describe, it } from 'vitest';
import {
  isPropExcludedFromExport,
  isPropObservableExported,
  isPropSimpleExported,
  makeExported,
} from '@src/make-exported';

describe('makeExported', () => {
  it('should append exported config by default', () => {
    const store = { libExported: { oldProp: 'simple' } } as Record<string, any>;

    makeExported(store, { newProp: 'observable' });

    expect(store.libExported).to.deep.equal({
      oldProp: 'simple',
      newProp: 'observable',
    });
  });

  it('should replace exported config when shouldExtend is disabled', () => {
    const store = { libExported: { oldProp: 'simple' } } as Record<string, any>;

    makeExported(store, { nextProp: 'excluded' }, false);

    expect(store.libExported).to.deep.equal({
      nextProp: 'excluded',
    });
  });

  it('should detect observable, simple and excluded props', () => {
    const store = {} as Record<string, any>;

    makeExported(store, {
      observableProp: 'observable',
      simpleProp: 'simple',
      hiddenProp: 'excluded',
    });

    expect(isPropObservableExported(store, 'observableProp')).to.equal(true);
    expect(isPropSimpleExported(store, 'simpleProp')).to.equal(true);
    expect(isPropExcludedFromExport(store, 'hiddenProp')).to.equal(true);
  });

  it('should exclude all props for persisted stores marked as not exported', () => {
    const store = {
      libStorageOptions: {
        isNotExported: true,
      },
    };

    expect(isPropExcludedFromExport(store, 'random')).to.equal(true);
    expect(isPropExcludedFromExport(store, 'random', true)).to.equal(false);
  });
});
