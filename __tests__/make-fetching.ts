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

  it('should toggle multiple flags from a single method when given an array', () => {
    const observed: { isLoading: boolean; isBusy: boolean }[] = [];
    const instance = {
      isLoading: false,
      isBusy: false,
      run() {
        observed.push({ isLoading: instance.isLoading, isBusy: instance.isBusy });

        return 'done';
      },
    };

    makeFetching(instance, { run: ['isLoading', 'isBusy'] });

    const result = instance.run();

    expect(result).to.equal('done');
    expect(observed).to.deep.equal([{ isLoading: true, isBusy: true }]);
    expect(instance.isLoading).to.equal(false);
    expect(instance.isBusy).to.equal(false);
  });

  it('should flip all flags true on call and false on settle for async multi-flag methods', async () => {
    let resolvePromise: ((value: string) => void) | undefined;
    const instance = {
      isLoading: false,
      isRefreshing: false,
      run() {
        return new Promise<string>((resolve) => {
          resolvePromise = resolve;
        });
      },
    };

    makeFetching(instance, { run: ['isLoading', 'isRefreshing'] });

    const promise = instance.run();

    expect(instance.isLoading).to.equal(true);
    expect(instance.isRefreshing).to.equal(true);

    resolvePromise?.('done');
    await promise;

    expect(instance.isLoading).to.equal(false);
    expect(instance.isRefreshing).to.equal(false);
  });

  it('should ignore an empty flag array without wrapping the method', () => {
    let callCount = 0;
    const instance = {
      isLoading: false,
      run() {
        callCount += 1;

        return 'done';
      },
    };
    const originalRun = instance.run;

    makeFetching(instance, { run: [] });

    expect(instance.run).to.equal(originalRun);

    const result = instance.run();

    expect(result).to.equal('done');
    expect(callCount).to.equal(1);
    expect(instance.isLoading).to.equal(false);
  });

  it('should block repeated calls only when every lock flag is already set in multi-flag mode', async () => {
    const resolvers: ((value: string) => void)[] = [];
    let callCount = 0;
    const instance = {
      isLoading: false,
      isBusy: false,
      run() {
        callCount += 1;

        return new Promise<string>((resolve) => {
          resolvers.push(resolve);
        });
      },
    };

    makeFetching(instance, { run: ['isLoading', 'isBusy'] }, true);

    const firstPromise = instance.run();

    expect(callCount).to.equal(1);
    expect(instance.isLoading).to.equal(true);
    expect(instance.isBusy).to.equal(true);

    // Every lock flag is set — the second call must be dropped.
    const secondResult = instance.run();

    expect(secondResult).to.be.undefined;
    expect(callCount).to.equal(1);

    resolvers[0]?.('done');
    await firstPromise;

    expect(instance.isLoading).to.equal(false);
    expect(instance.isBusy).to.equal(false);

    // After settle, both flags are false — new call goes through.
    const thirdPromise = instance.run();

    expect(callCount).to.equal(2);

    resolvers[1]?.('done-again');
    await thirdPromise;
  });

  it('should not block when only some lock flags are already set in multi-flag mode', () => {
    const observed: { isLoading: boolean; isBusy: boolean }[] = [];
    let callCount = 0;
    const instance = {
      isLoading: false,
      isBusy: true,
      run() {
        callCount += 1;
        observed.push({ isLoading: instance.isLoading, isBusy: instance.isBusy });
      },
    };

    makeFetching(instance, { run: ['isLoading', 'isBusy'] }, true);

    // `isBusy` is true but `isLoading` is not — `.every()` is false, call proceeds.
    instance.run();

    expect(callCount).to.equal(1);
    expect(observed).to.deep.equal([{ isLoading: true, isBusy: true }]);
  });
});
