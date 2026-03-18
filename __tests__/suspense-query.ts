import { expect } from 'chai';
import { afterEach, describe, it } from 'vitest';
import SuspenseQuery from '@src/suspense-query';
import type { IPromise } from '@src/suspense-query';

describe('SuspenseQuery', () => {
  const subqueryId = 'subquery-id';

  afterEach(() => undefined);

  it('should mark exported suspense field on store', () => {
    const store = {};

    new SuspenseQuery(store as never, { fieldName: 'requestState' });

    expect(store).to.deep.include({
      libExported: {
        requestState: 'simple',
      },
    });
  });

  it('should throw pending promise and mark query as done after resolve', async () => {
    let resolvePromise: ((value: string) => void) | undefined;
    const store: Record<string, unknown> = {};
    const target = new SuspenseQuery(store as never);

    try {
      target.query(
        () =>
          new Promise<string>((resolve) => {
            resolvePromise = resolve;
          }),
        { hash: 'hash-1' },
      );
    } catch (e) {
      expect(e).to.be.instanceOf(Promise);
    }

    expect(store.sR).to.deep.equal({ hash: 'hash-1', done: false });

    resolvePromise?.('done');
    await Promise.resolve();
    await Promise.resolve();

    expect(store.sR).to.deep.equal({ hash: 'hash-1', done: true });
    expect(target.query(() => Promise.resolve('unused'), { hash: 'hash-1' })).to.be.undefined;
  });

  it('should serialize error and rethrow it from init wrapper', async () => {
    const store: Record<string, any> = {
      init: () => 'init-called',
    };
    const target = new SuspenseQuery(store);

    try {
      target.query(() => Promise.reject(new TypeError('broken')), { hash: 'hash-2' });
    } catch {
      // the promise is expected to be thrown for suspense
    }

    await Promise.resolve();
    await Promise.resolve();

    expect(store.sR.error.toJSON()).to.deep.equal({
      name: 'TypeError',
      message: 'broken',
    });

    expect(() => store.init()).to.throw('broken');
  });

  it('should manage subqueries by id and hash', async () => {
    let resolvePromise: ((value: string) => void) | undefined;
    const target = new SuspenseQuery({} as never);

    expect(target.subquery(() => Promise.resolve('first'), { id: subqueryId, hash: 'hash-1' })).to
      .be.undefined;

    try {
      target.subquery(
        () =>
          new Promise<string>((resolve) => {
            resolvePromise = resolve;
          }),
        { id: subqueryId, hash: 'hash-2' },
      );
    } catch (e) {
      expect(e).to.be.instanceOf(Promise);
    }

    resolvePromise?.('ready');
    await Promise.resolve();
    await Promise.resolve();

    expect(
      target.subquery(() => Promise.resolve('unused'), { id: subqueryId, hash: 'hash-2' }),
    ).to.equal('ready');
  });

  it('should resolve static run by promise status', () => {
    const fulfilled = Promise.resolve('done') as IPromise<string>;

    fulfilled.status = 'fulfilled';
    fulfilled.value = 'done';

    expect(SuspenseQuery.run(fulfilled)).to.equal('done');

    const rejected = Promise.resolve('done') as IPromise<string>;

    rejected.status = 'rejected';
    rejected.reason = new Error('broken');

    expect(() => SuspenseQuery.run(rejected)).to.throw('broken');
  });
});
