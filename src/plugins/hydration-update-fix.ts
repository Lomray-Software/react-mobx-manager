import type { Plugin } from 'vite';

/**
 * Fix mobx lite suspense hydration
 * @constructor
 */
function HydrationUpdateFix(): Plugin {
  return {
    name: '@lomray/react-mobx-manager-hydration-fix',
    transform(code, id) {
      if (!id.includes('mobx-react-lite') || !code.includes('function useObserver')) {
        return;
      }

      console.log(code.replace(/(}\);[^f]+)(forceUpdate\(\);)/s, '$1/*$2*/'));

      return {
        code: code.replace(/(}\);[^f]+)(forceUpdate\(\);)/s, '$1/*$2*/'),
        map: { mappings: '' },
      };
    },
  };
}

export default HydrationUpdateFix;
