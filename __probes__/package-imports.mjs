import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFetching } from '@lomray/react-mobx-manager';
import fetching from '@lomray/react-mobx-manager/make-fetching.js';

const name = '@lomray/react-mobx-manager';
const root = dirname(fileURLToPath(import.meta.resolve(`${name}/package.json`)));
const files = readdirSync(root, { recursive: true }).filter((file) => file.endsWith('.js'));
for (const file of files) {
  const explicit = await import(`${name}/${file}`);
  const extensionless = await import(`${name}/${file.slice(0, -3)}`);
  assert.equal(extensionless, explicit);
}
for (const entry of ['plugins/vite', 'plugins/dev-extension', 'plugins/dev-extension/hmr']) {
  assert.equal(await import(`${name}/${entry}`), await import(`${name}/${entry}/index.js`));
}
const metadata = await import(`${name}/package.json`, { with: { type: 'json' } });
assert.equal(metadata.default.name, name);
assert.equal(typeof makeFetching, 'function');
assert.equal(makeFetching, fetching);
console.log(
  `Native Node ESM: ${files.length} .js paths + ${files.length} extensionless paths + 3 directory aliases + root + package.json passed`,
);
console.log('makeFetching root export: function (matches subpath default)');
