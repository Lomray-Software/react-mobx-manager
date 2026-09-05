import { expect } from 'chai';
import sinon from 'sinon';
import { afterEach, describe, it, vi } from 'vitest';

describe('plugins/helpers', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('node:fs');
  });

  it('should load cache from file in production mode and save it back', async () => {
    const existsSync = sinon.stub();
    const readFileSync = sinon
      .stub()
      .returns(JSON.stringify([['file.ts', { storeId: 'S1', classname: 'Store' }]]));
    const mkdirSync = sinon.stub();
    const writeFileSync = sinon.stub();

    existsSync.onFirstCall().returns(true);
    existsSync.onSecondCall().returns(false);

    vi.doMock('node:fs', () => ({
      default: {
        existsSync,
        readFileSync,
        mkdirSync,
        writeFileSync,
      },
    }));

    const { loadCache, saveCache } = await import('@src/plugins/helpers');
    const cache = loadCache(true);

    saveCache(cache);

    expect([...cache.entries()]).to.deep.equal([
      ['file.ts', { storeId: 'S1', classname: 'Store' }],
    ]);
    sinon.assert.calledOnce(readFileSync);
    sinon.assert.calledOnce(mkdirSync);
    sinon.assert.calledOnce(writeFileSync);
  });

  it('should generate next letters and ids', async () => {
    const { Generator, getNextLetter } = await import('@src/plugins/helpers');
    const generator = new Generator('/root');

    expect(getNextLetter()).to.equal('a');
    expect(getNextLetter('z')).to.equal('A');
    expect(getNextLetter('Z')).to.equal('aa');
    expect(generator.getDevId('/root/src/store/index.ts', 'UsersStore')).to.equal(
      'src-store-UsersStore',
    );
    expect(generator.getProdId()).to.equal('Sa');
    expect(generator.getProdId()).to.equal('Sb');
  });

  it('should retain cached ids and allocate unused ids across production builds', async () => {
    let saved = '[]';

    vi.doMock('node:fs', () => ({
      default: {
        existsSync: () => true,
        readFileSync: () => saved,
        writeFileSync: (_file: string, value: string) => {
          saved = value;
        },
      },
    }));

    const { Generator, saveCache } = await import('@src/plugins/helpers');
    const first = new Generator('/root', true);

    first.cache.set('a.ts', { classname: 'A', storeId: first.getProdId() });
    saveCache(first.cache);
    const second = new Generator('/root', true);

    second.cache.set('b.ts', { classname: 'B', storeId: second.getProdId() });
    expect(second.cache.get('a.ts')?.storeId).to.equal('Sa');
    expect(second.cache.get('b.ts')?.storeId).to.equal('Sb');
    expect(second.getProdId()).to.equal('Sc');
  });

  it('should reject duplicate ids in a loaded production cache', async () => {
    vi.doMock('node:fs', () => ({
      default: {
        existsSync: () => true,
        readFileSync: () =>
          JSON.stringify([
            ['a.ts', { classname: 'A', storeId: 'Sa' }],
            ['b.ts', { classname: 'B', storeId: 'Sa' }],
          ]),
      },
    }));

    const { Generator } = await import('@src/plugins/helpers');

    expect(() => new Generator('/root', true)).to.throw('Duplicate store ID "Sa"');
  });

  it('should detect stores, inject ids and ignore unmatched classes', async () => {
    const { Generator } = await import('@src/plugins/helpers');
    const generator = new Generator('/root');
    const fileId = '/root/src/store.ts';
    const code = `
      class UsersStore {
        constructor() {
          makeObservable(this);
        }
      }
    `;

    expect(generator.matchMobxStore(code)).to.equal('UsersStore');
    expect(
      generator.matchMobxStore(`
        /**
         * @mobx-store
         */
        class ProfileStore {
          value = 1;
        }
      `),
    ).to.equal('ProfileStore');
    expect(generator.matchMobxStore('class PlainClass {}')).to.be.undefined;

    generator.cache.set(fileId, { classname: 'UsersStore', storeId: 'S1' });

    expect(generator.injectId(code, fileId)).to.include("static id = 'S1';");
  });
});
