import { extname } from 'node:path';
import { cwd } from 'node:process';
import type { Plugin } from 'vite';
import { Generator, saveCache } from '../helpers';

export interface IPluginOptions {
  root?: string; // default: process.cwd()
  isProd?: boolean;
}

/**
 * Generate unique store id's
 *
 * Detect mobx store:
 * - by makeObservable or makeAutoObservable
 * - by @mobx-store jsdoc before class
 * @constructor
 */
function IdGenerator({ root = cwd(), isProd = false }: IPluginOptions = {}): Plugin {
  const service = new Generator(root, isProd);

  return {
    name: '@lomray/react-mobx-manager-id-generator',
    transform(code, id) {
      const extName = extname(id).split('?')[0]!;

      if (
        id.includes('node_modules') ||
        !['.js', '.ts', '.tsx'].includes(extName) ||
        !/(makeObservable|makeAutoObservable)\(/.test(code)
      ) {
        return;
      }

      if (service.cache.has(id)) {
        return {
          code: service.injectId(code, id),
          map: { mappings: '' },
        };
      }

      const classname = service.matchMobxStore(code);

      if (!classname) {
        return;
      }

      if (!service.cache.has(id)) {
        const storeId = isProd ? service.getProdId() : service.getDevId(id, classname);

        service.cache.set(id, { classname, storeId });
      }

      return {
        code: service.injectId(code, id),
        map: { mappings: '' },
      };
    },
    buildEnd() {
      if (!isProd) {
        return;
      }

      saveCache(service.cache);
    },
  };
}

export default IdGenerator;
