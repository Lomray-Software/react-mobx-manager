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
 * Try to find mobx store
 */
const matchMobxStore = (code: string): string | undefined => {
  /**
   * Match store pattern 1
   *
   * 1. Match 'class Classname' (capture Classname)
   * 2. Except 'static id ='
   * 3. Include makeObservable or makeAutoObservable
   * 4. Except persistStore(Classname
   */
  const { classname } =
    code.match(
      /class\s(?<classname>\w+)\s+?{(?!.*static\sid\s*=.*).+(makeObservable|makeAutoObservable)(?!.*persistStore\(\1.*)/s,
    )?.groups ?? {};

  if (classname) {
    return classname;
  }

  /**
   * Match store pattern 2
   *
   * 1. Match '@mobx-store' in jsdoc before class
   * 2. Match 'class Classname' (capture Classname)
   * 3. Except 'static id ='
   * 4. Except persistStore(Classname
   */
  const { classname: classnameSecond } =
    code.match(
      /(@mobx-store).+class\s(?<classname>\w+)\s+?{(?!.*static\sid\s*=.*).+}(?!.*persistStore.*)/s,
    )?.groups ?? {};

  return classnameSecond;
};

/**
 * Generate unique store id's
 *
 * Detect mobx store:
 * - by makeObservable or makeAutoObservable
 * - by @mobx-store jsdoc before class
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

  /**
   * Get development id
   */
  const getDevId = (id: string, classname: string): string => {
    const cleanPath = id
      .replace(root, '')
      .replace(/\/index.(js|ts|tsx)/, '')
      .split('/')
      .filter(Boolean)
      .join('-');

    return `${cleanPath}-${classname}`;
  };

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

      if (cache.has(id)) {
        return {
          code: injectId(code, id),
          map: { mappings: '' },
        };
      }

      const classname = matchMobxStore(code);

      if (!classname) {
        return;
      }

      if (!cache.has(id)) {
        const storeId = isProd ? getProdId() : getDevId(id, classname);

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
