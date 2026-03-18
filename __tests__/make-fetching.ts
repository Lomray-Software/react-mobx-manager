import { expect } from 'chai';
import { describe, it } from 'vitest';
import makeFetching from '@src/make-fetching';

describe('makeFetching', () => {
  it('should toggle fetching flag around synchronous methods', () => {
    const calls: boolean[] = [];
    const instance = {
      isLoading: false,
      run() {
        calls.push(instance.isLoading);

        return 'done';
      },
    };

    makeFetching(instance, { run: 'isLoading' });

    const result = instance.run();

    expect(result).to.equal('done');
    expect(calls).to.deep.equal([true]);
    expect(instance.isLoading).to.equal(false);
  });

  it('should keep fetching flag until async method is settled', async () => {
    let resolvePromise: ((value: string) => void) | undefined;
    const instance = {
      isLoading: false,
      run() {
        return new Promise<string>((resolve) => {
          resolvePromise = resolve;
        });
      },
    };

    makeFetching(instance, { run: 'isLoading' });

    const promise = instance.run();

    expect(instance.isLoading).to.equal(true);

    resolvePromise?.('done');
    await promise;

    expect(instance.isLoading).to.equal(false);
  });

  it('should block repeated calls when lock is enabled', () => {
    let callCount = 0;
    const instance = {
      isLoading: true,
      run() {
        callCount += 1;
      },
    };

    makeFetching(instance, { run: 'isLoading' }, true);

    const result = instance.run();

    expect(result).to.be.undefined;
    expect(callCount).to.equal(0);
  });
});
