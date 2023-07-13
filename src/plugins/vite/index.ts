import * as process from 'node:process';
import type { Plugin, TransformResult } from 'vite';
import HydrationUpdateFix from './hydration-update-fix';
import IdGenerator from './id-generator';

const isProduction = (mode?: string): boolean =>
  mode === 'production' || process.env.NODE_ENV === 'production';

/**
 * Mobx manager vite plugins
 * @constructor
 */
function ViteReactMobxManager(): Plugin[] {
  let idGeneratorPlugin: Plugin;

  return [
    HydrationUpdateFix(),
    {
      name: IdGenerator().name,
      configResolved({ root }) {
        idGeneratorPlugin = IdGenerator({ root, isProd: isProduction() });
      },
      transform(...args) {
        return idGeneratorPlugin.transform?.['call'](this, ...args) as TransformResult | undefined;
      },
    },
  ];
}

export default ViteReactMobxManager;
