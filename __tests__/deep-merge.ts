import { expect } from 'chai';
import { observable, runInAction } from 'mobx';
import { describe, it } from 'vitest';
import deepMerge from '@src/deep-merge';

describe('deepMerge', () => {
  it('should replace shorter, empty and nested arrays while preserving the target array', () => {
    const items = ['default-a', 'default-b'];
    const target = { items, nested: { values: [[1, 2], [3]], keep: true } };

    expect(deepMerge(target, { items: ['server'], nested: { values: [[]] } })).to.equal(true);
    expect(target).to.deep.equal({ items: ['server'], nested: { values: [[]], keep: true } });
    expect(target.items).to.equal(items);
    deepMerge(target, { items: [], nested: { values: [] } });
    expect(target.items).to.deep.equal([]);
    expect(target.nested.values).to.deep.equal([]);
  });

  it('should truncate observable arrays and retain their identity', () => {
    const target = observable({ items: ['default-a', 'default-b'], nested: [[1, 2], [3]] });
    // Keep a reference to assert restoration preserves the live property identity.
    // eslint-disable-next-line prefer-destructuring
    const items = target.items;

    runInAction(() => {
      deepMerge(target, { items: ['server'], nested: [[4]] });
    });
    expect(target.items).to.equal(items);
    expect([...target.items]).to.deep.equal(['server']);
    expect(target.nested.map((row) => [...row])).to.deep.equal([[4]]);
    runInAction(() => {
      deepMerge(target.items, []);
    });
    expect(target.items.length).to.equal(0);
  });

  it('should replace properties when only one side is an array', () => {
    const target = { array: [1, 2], object: { old: true } };

    deepMerge(target, { array: { next: true }, object: [] });
    expect(target).to.deep.equal({ array: { next: true }, object: [] });
    expect(deepMerge(null, {})).to.equal(false);
  });
});
