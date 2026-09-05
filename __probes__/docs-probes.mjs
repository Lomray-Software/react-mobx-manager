import assert from 'node:assert/strict';
import * as hmr from '@lomray/react-mobx-manager/plugins/dev-extension/hmr/index.js';
import IdGenerator from '@lomray/react-mobx-manager/plugins/vite/id-generator.js';
import { Generator } from '@lomray/react-mobx-manager/plugins/helpers.js';
const code = '/** @mobx-store */ class Tagged { value = 1; }';
const service = new Generator('/audit');
const plugin = IdGenerator({ root: '/audit' });
console.log(
  'HMR barrel: ' +
    JSON.stringify({
      default: typeof hmr.default,
      connectHmrRuntime: typeof hmr.connectHmrRuntime,
    }),
);
console.log(
  'JSDoc-only store: ' +
    JSON.stringify({
      helperMatch: service.matchMobxStore(code),
      pluginResult: plugin.transform.call({}, code, '/audit/tagged.js') ?? null,
    }),
);
assert.equal(typeof hmr.default, 'undefined');
assert.equal(service.matchMobxStore(code), 'Tagged');
assert.match(plugin.transform.call({}, code, '/audit/tagged.js').code, /static id =/);
assert.equal(typeof hmr.connectHmrRuntime, 'function');
