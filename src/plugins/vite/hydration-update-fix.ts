import { extname } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Fix mobx lite suspense hydration
 * @constructor
 */
function HydrationUpdateFix(): Plugin {
  return {
    name: '@lomray/react-mobx-manager-hydration-fix',
    transform(code, id) {
      const extName = extname(id).split('?')[0]!;

      if (!['.js', '.ts', '.tsx'].includes(extName) || !code.includes('function useObserver')) {
        return;
      }

      return {
        code: code.replace(/(}\);[^f]+)(forceUpdate\(\);)/s, '$1/*$2*/'),
        map: { mappings: '' },
      };
    },
  };
}

export default HydrationUpdateFix;
