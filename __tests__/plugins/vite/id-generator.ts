import { expect } from 'chai';
import sinon from 'sinon';
import { afterEach, describe, it, vi } from 'vitest';

describe('plugins/vite/id-generator', () => {
  const callTransform = (hook: unknown, ...args: unknown[]) =>
    (hook as (code: string, id: string) => unknown)(args[0] as string, args[1] as string);
  const callBuildEnd = (hook: unknown) => (hook as () => unknown)();

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@src/plugins/helpers');
  });

  it('should skip unsupported files', async () => {
    const { default: IdGenerator } = await import('@src/plugins/vite/id-generator');
    const plugin = IdGenerator();

    expect(callTransform(plugin.transform, 'const a = 1;', '/file.css')).to.be.undefined;
    expect(callTransform(plugin.transform, 'makeObservable()', '/node_modules/file.ts')).to.be
      .undefined;
  });

  it('should inject an id for a tagged store without observable helper calls', async () => {
    const { default: IdGenerator } = await import('@src/plugins/vite/id-generator');
    const plugin = IdGenerator({ root: '/root' });
    const code = '/** @mobx-store */ class Tagged { value = 1; }';
    const result = callTransform(plugin.transform, code, '/root/tagged.ts') as { code: string };

    expect(result.code).to.include("static id = 'tagged.ts-Tagged';");
    expect(callTransform(plugin.transform, 'class Plain { value = 1; }', '/root/plain.ts')).to.be
      .undefined;
  });

  it('should inject id from cache or generated class match', async () => {
    const cachedFileId = '/cached.ts';
    const transformedCode = 'cached-code';
    const saveCache = sinon.stub();
    const generator = {
      cache: new Map<string, { classname: string; storeId: string }>([
        [cachedFileId, { classname: 'CachedStore', storeId: 'S1' }],
      ]),
      injectId: sinon.stub().returns(transformedCode),
      matchMobxStore: sinon.stub().returns('UsersStore'),
      getProdId: sinon.stub().returns('Sa'),
      getDevId: sinon.stub().returns('dev-id'),
    };
    const Generator = sinon.stub();

    Generator.onFirstCall().returns(generator);
    Generator.onSecondCall().returns({
      ...generator,
      cache: new Map(),
    });

    vi.doMock('@src/plugins/helpers', () => ({
      Generator,
      saveCache,
    }));

    const { default: IdGenerator } = await import('@src/plugins/vite/id-generator');
    const cachedPlugin = IdGenerator();
    const freshPlugin = IdGenerator({ isProd: true, root: '/root' });

    expect(callTransform(cachedPlugin.transform, 'makeObservable()', cachedFileId)).to.deep.equal({
      code: transformedCode,
      map: { mappings: '' },
    });

    const result = callTransform(
      freshPlugin.transform,
      'class UsersStore { constructor() { makeObservable(this); } }',
      '/root/src/store.ts',
    );

    expect(result).to.deep.equal({
      code: transformedCode,
      map: { mappings: '' },
    });

    callBuildEnd(freshPlugin.buildEnd);

    sinon.assert.calledOnce(saveCache);
  });
});
