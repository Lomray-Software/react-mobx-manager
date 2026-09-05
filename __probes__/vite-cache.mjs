import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { build } from 'vite';
import plugin from '@lomray/react-mobx-manager/plugins/vite/index.js';
const root = path.resolve('vite-app');
fs.mkdirSync(root, { recursive: true });
fs.rmSync('node_modules/.cache/@lomray/react-mobx-manager/store-ids.json', { force: true });
fs.writeFileSync(
  root + '/a.js',
  'import {makeAutoObservable} from "mobx";export class A {static isGlobal=true;value=1; constructor(){makeAutoObservable(this);} }',
);
fs.writeFileSync(root + '/entry.js', 'export {A} from "./a.js";');
const compile = async () => {
  const result = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: plugin(),
    build: {
      write: false,
      minify: false,
      lib: { entry: root + '/entry.js', formats: ['es'] },
      rollupOptions: { external: ['mobx'] },
    },
  });
  return result[0].output.find((o) => o.type === 'chunk').code;
};
const a = await compile();
fs.writeFileSync(
  root + '/b.js',
  'import {makeAutoObservable} from "mobx";export class B {static isGlobal=true;value=2; constructor(){makeAutoObservable(this);} }',
);
fs.writeFileSync(root + '/entry.js', 'export {A} from "./a.js";export {B} from "./b.js";');
const b = await compile();
const ids = (s) => [...s.matchAll(/static id = ["'](.*?)["']/g)].map((m) => m[1]);
console.log('Vite 8.2.2 first build static IDs: ' + JSON.stringify(ids(a)));
console.log('Vite 8.2.2 second build static IDs: ' + JSON.stringify(ids(b)));
assert.deepEqual(ids(a), ['Sa']);
assert.deepEqual(ids(b), ['Sa', 'Sb']);

fs.writeFileSync('vite-output.mjs', b);
const { A, B } = await import('./vite-output.mjs');
const { Manager } = await import('@lomray/react-mobx-manager');
const manager = new Manager();
const storeA = manager.getStore(A),
  storeB = manager.getStore(B);
console.log(
  'Global store lookup: ' +
    JSON.stringify({
      sameInstance: storeA === storeB,
      requestedBValue: storeB.value,
      expectedBValue: 2,
    }),
);
assert.notEqual(storeA, storeB);
assert.equal(storeB.value, 2);
manager.destroy();

const cacheFile = 'node_modules/.cache/@lomray/react-mobx-manager/store-ids.json';
const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
cache[1][1].storeId = cache[0][1].storeId;
fs.writeFileSync(cacheFile, JSON.stringify(cache));
await assert.rejects(compile, /Duplicate store ID/);
fs.rmSync(cacheFile);
console.log('Duplicate loaded cache rejected');
