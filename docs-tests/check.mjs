import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('context7.json', root), 'utf8'));
const schemaResponse = await fetch('https://context7.com/schema/context7.json');
assert.equal(schemaResponse.status, 200);
const schema = await schemaResponse.json();
const ajv = new Ajv({ strict: false, formats: { uri: true } });
const validate = ajv.compile(schema);
assert.ok(validate(config), JSON.stringify(validate.errors));
assert.equal(config.branch, 'prod');
assert.ok(config.excludeFolders.includes('docs-tests'));
assert.deepEqual(config.folders, ['docs']);
assert.ok(config.url && config.public_key, 'Preserve existing ownership fields');
console.log('PASS: Context7 schema, stable branch, docs path and existing ownership');
