import { expect } from 'chai';
import { describe, it } from 'vitest';
import deepCompare from '@src/deep-compare';

describe('deepCompare', () => {
  it('should return true for equal primitive values', () => {
    expect(deepCompare(1, 1)).to.equal(true);
    expect(deepCompare('value', 'value')).to.equal(true);
  });

  it('should return false for different primitive values', () => {
    expect(deepCompare(1, 2)).to.equal(false);
    expect(deepCompare('value', null)).to.equal(false);
  });

  it('should compare nested objects recursively', () => {
    expect(deepCompare({ foo: { bar: 1 } }, { foo: { bar: 1 } })).to.equal(true);
    expect(deepCompare({ foo: { bar: 1 } }, { foo: { bar: 2 } })).to.equal(false);
  });

  it('should return false when objects have different keys length', () => {
    expect(deepCompare({ foo: 1 }, { foo: 1, bar: 2 })).to.equal(false);
  });
});
