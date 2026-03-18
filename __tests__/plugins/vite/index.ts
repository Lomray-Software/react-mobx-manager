import { expect } from 'chai';
import sinon from 'sinon';
import { afterEach, describe, it, vi } from 'vitest';

describe('plugins/vite/index', () => {
  const callConfigResolved = (hook: unknown, config: unknown) =>
    (hook as (config: unknown) => unknown)(config);
  const callTransform = (hook: unknown, ctx: unknown, code: string, id: string) =>
    (hook as { call: (ctx: unknown, code: string, id: string) => unknown }).call(ctx, code, id);
  const callBuildEnd = (hook: unknown, ctx: unknown) =>
    (hook as { call: (ctx: unknown) => unknown }).call(ctx);

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@src/plugins/vite/id-generator');
    delete process.env.NODE_ENV;
  });

  it('should proxy transform and buildEnd to configured id generator plugin', async () => {
    const transform = sinon.stub().returns({ code: 'transformed' });
    const buildEnd = sinon.stub();
    const IdGenerator = sinon.stub().returns({
      name: 'generator',
      transform,
      buildEnd,
    });

    vi.doMock('@src/plugins/vite/id-generator', () => ({
      default: IdGenerator,
    }));

    process.env.NODE_ENV = 'production';

    const { default: ViteReactMobxManager } = await import('@src/plugins/vite/index');
    const [plugin] = ViteReactMobxManager();

    callConfigResolved(plugin.configResolved, { root: '/root' });

    expect(callTransform(plugin.transform, { meta: 'ctx' }, 'code', '/file.ts')).to.deep.equal({
      code: 'transformed',
    });

    callBuildEnd(plugin.buildEnd, { meta: 'ctx' });

    expect(IdGenerator.lastCall.args[0]).to.deep.equal({ root: '/root', isProd: true });
    sinon.assert.calledOnce(transform);
    sinon.assert.calledOnce(buildEnd);
  });
});
