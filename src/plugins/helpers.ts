import fs from 'node:fs';

type ICache = Map<string, { storeId: string; classname: string }>;

const cacheFolder = `${
  __dirname.split('node_modules')[0]
}node_modules/.cache/@lomray/react-mobx-manager`;
const cacheFile = `${cacheFolder}/store-ids.json`;

/**
 * Load cached store id's by file name
 */
const loadCache = (isProd = false): ICache => {
  if (isProd && fs.existsSync(cacheFile)) {
    const cache = JSON.parse(fs.readFileSync(cacheFile, { encoding: 'utf-8' }));

    return new Map(cache as any[]);
  }

  return new Map();
};

/**
 * Save store id's cache
 */
const saveCache = (cache: ICache): void => {
  if (!fs.existsSync(cacheFolder)) {
    fs.mkdirSync(cacheFolder, { recursive: true });
  }

  fs.writeFileSync(cacheFile, JSON.stringify([...cache.entries()], null, 2), { encoding: 'utf-8' });
};

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
 * Store is generator
 */
class Generator {
  public cache: ICache;
  protected root: string; // project root
  protected lastId: string; // keep last generated production store id (letter)

  constructor(root: string, isProd = false) {
    this.cache = loadCache(isProd);
  }

  /**
   * Inject store id
   */
  public injectId = (code: string, fileId: string): string => {
    const { classname, storeId } = this.cache.get(fileId)!;
    const regexp = new RegExp(`(class\\s${classname}\\s+?{)`);

    return code.replace(regexp, `$1static id = '${storeId}';`);
  };

  /**
   * Get development id
   */
  public getDevId = (id: string, classname: string): string => {
    const cleanPath = id
      .replace(this.root, '')
      .replace(/\/index.(js|ts|tsx)/, '')
      .split('/')
      .filter(Boolean)
      .join('-');

    return `${cleanPath}-${classname}`;
  };

  /**
   * Get production store id
   */
  public getProdId = (): string => {
    const nextLetter = getNextLetter(this.lastId);
    const id = `S${nextLetter}`;

    this.lastId = nextLetter;

    return id;
  };

  /**
   * Try to find mobx store
   */
  public matchMobxStore = (code: string): string | undefined => {
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
}

export { saveCache, loadCache, getNextLetter, Generator };
