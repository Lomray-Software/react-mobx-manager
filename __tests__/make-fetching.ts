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

  it('should keep fetching flag enabled until all concurrent async calls are settled', async () => {
    const resolvers: ((value: string) => void)[] = [];
    const instance = {
      isLoading: false,
      run() {
        return new Promise<string>((resolve) => {
          resolvers.push(resolve);
        });
      },
    };

    makeFetching(instance, { run: 'isLoading' });

    const firstPromise = instance.run();
    const secondPromise = instance.run();

    expect(instance.isLoading).to.equal(true);

    resolvers[0]?.('first');
    await firstPromise;

    expect(instance.isLoading).to.equal(true);

    resolvers[1]?.('second');
    await secondPromise;

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

  it('should block concurrent async calls when lock is enabled and allow retry after settle', async () => {
    let resolvePromise: ((value: string) => void) | undefined;
    let callCount = 0;
    const instance = {
      isLoading: false,
      run() {
        callCount += 1;

        return new Promise<string>((resolve) => {
          resolvePromise = resolve;
        });
      },
    };

    makeFetching(instance, { run: 'isLoading' }, true);

    const firstPromise = instance.run();
    const secondResult = instance.run();

    expect(callCount).to.equal(1);
    expect(secondResult).to.be.undefined;
    expect(instance.isLoading).to.equal(true);

    resolvePromise?.('done');
    await firstPromise;

    expect(instance.isLoading).to.equal(false);

    const thirdPromise = instance.run();

    expect(callCount).to.equal(2);
    expect(instance.isLoading).to.equal(true);

    resolvePromise?.('done-again');
    await thirdPromise;

    expect(instance.isLoading).to.equal(false);
  });
});
