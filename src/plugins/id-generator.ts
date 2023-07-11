import { extname } from 'node:path';
import { cwd } from 'node:process';
import type { Plugin } from 'vite';

export interface IPluginOptions {
  root?: string; // default: process.cwd()
  isProd?: boolean;
}

/**
 * Get next letter
 */
const getNextLetter = (str = ''): string => {
  const letters = str.split('');
  const letter = letters.pop() ?? '`'; // default char code is '`' and next is 'a'

  if (letter === 'z') {
    return [...letters, 'A'].join('');
  } else if (letter === 'Z') {
    const prevLetter = letters.pop();

    if (!prevLetter) {
      return 'aa';
    }

    return [getNextLetter([...letters, prevLetter].join('')), 'a'].join('');
  }

  return [...letters, String.fromCharCode(letter.charCodeAt(0) + 1)].join('');
};

/**
 * Generate unique store id's
 * @constructor
 */
function IdGenerator({ root = cwd(), isProd = false }: IPluginOptions = {}): Plugin {
  const cache = new Map<string, { storeId: string; classname: string }>();
  let lastId = ''; // keep last generated production store id

  /**
   * Inject store id
   */
  const injectId = (code: string, fileId: string) => {
    const { classname, storeId } = cache.get(fileId)!;
    const regexp = new RegExp(`(class\\s${classname}\\s+?{)`);

    return code.replace(regexp, `$1static id = '${storeId}';`);
  };

  /**
   * Get production store id
   */
  const getProdId = (): string => {
    const nextLetter = getNextLetter(lastId);
    const id = `S-${nextLetter}`;

    lastId = nextLetter;

    return id;
  };

  return {
    name: '@lomray/react-mobx-manager-id-generator',
    transform(code, id) {
      const extName = extname(id);

      if (
        id.includes('node_modules') ||
        !['.js', '.ts', '.tsx'].includes(extName) ||
        !/(makeObservable|makeAutoObservable)\(/.test(code)
      ) {
        return;
      }

      if (cache.has(id)) {
        return {
          code: injectId(code, id),
          map: { mappings: '' },
        };
      }

      const { classname, staticId } =
        code.match(
          /class\s(?<classname>\w+)\s+?{(?<staticId>.+(static\sid[^=]+=))?.+(makeObservable|makeAutoObservable)/s,
        )?.groups ?? {};

      if (staticId || !classname) {
        return;
      }

      if (!cache.has(id)) {
        const cleanPath = isProd
          ? ''
          : id
              .replace(root, '')
              .replace(/\/index.(js|ts|tsx)/, '')
              .split('/')
              .filter(Boolean)
              .join('-');
        const storeId = isProd ? getProdId() : `${cleanPath}-${classname}`;

        cache.set(id, { classname, storeId });
      }

      return {
        code: injectId(code, id),
        map: { mappings: '' },
      };
    },
  };
}

export default IdGenerator;
