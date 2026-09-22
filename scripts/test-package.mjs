import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = mkdtempSync(path.join(tmpdir(), 'react-mobx-manager-package-'));
const lib = path.join(root, 'lib');
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const env = { ...process.env };

delete env.NO_COLOR;

/**
 * Resolve npm from the current invocation or Node installation without searching PATH.
 */
const npmCli =
  process.env.npm_execpath ??
  path.join(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js');

/**
 * Run consumer checks with the same Node binary as this script.
 */
const run = (args, cwd = temporary, capture = false) =>
  execFileSync(process.execPath, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    timeout: 120_000,
  });

try {
  /**
   * Match release preparation without changing the checkout manifest or running Husky.
   */
  run([npmCli, 'pkg', 'delete', 'scripts.prepare'], lib);
  const [pack] = JSON.parse(
    run([npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', temporary], lib, true),
  );
  const files = new Set(pack.files.map(({ path: filename }) => filename));
  const modules = readdirSync(path.join(root, 'src'), { recursive: true })
    .filter((filename) => /\.tsx?$/.test(filename))
    .map((filename) => filename.replace(/\.tsx?$/, '.js'))
    .sort();

  assert.deepEqual([...files].filter((filename) => filename.endsWith('.js')).sort(), modules);
  for (const filename of modules) {
    assert.ok(files.has(filename.replace(/\.js$/, '.d.ts')), `Missing declaration: ${filename}`);
    assert.ok(files.has(`${filename}.map`), `Missing source map: ${filename}`);
  }
  for (const filename of ['package.json', 'README.md', 'LICENSE']) {
    assert.ok(files.has(filename), `Missing package file: ${filename}`);
  }

  const dependencies = Object.fromEntries(
    [
      ...Object.keys(manifest.peerDependencies),
      '@types/hoist-non-react-statics',
      '@types/lodash',
      '@types/node',
      '@types/react',
      '@types/react-dom',
      'jsdom',
      'react-dom',
      'typescript',
      'vite',
    ].map((name) => [
      name,
      JSON.parse(readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8'))
        .version,
    ]),
  );

  /**
   * The existing provider probe exercises React 19 ref-as-prop support.
   */
  dependencies.react = '19.2.8';
  dependencies['react-dom'] = '19.2.8';
  writeFileSync(
    path.join(temporary, 'package.json'),
    JSON.stringify({ name: 'mobx-manager-consumer', private: true, type: 'module', dependencies }),
  );
  run([
    npmCli,
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    path.join(temporary, pack.filename),
  ]);

  const installed = JSON.parse(
    readFileSync(path.join(temporary, 'node_modules', manifest.name, 'package.json'), 'utf8'),
  );
  for (const field of ['main', 'types', 'type', 'exports', 'peerDependencies']) {
    assert.deepEqual(installed[field], manifest[field], `Changed public metadata: ${field}`);
  }
  cpSync(path.join(root, '__probes__'), temporary, { recursive: true });
  for (const probe of [
    'package-imports',
    'docs-probes',
    'vite-cache',
    'provider-init',
    'ssr-isolated',
  ]) {
    run([`${probe}.mjs`]);
  }
  for (const resolution of ['bundler', 'node16']) {
    run(['node_modules/typescript/bin/tsc', '--project', `tsconfig.${resolution}.json`]);
    console.info(`PASS ${resolution} declarations (skipLibCheck=false).`);
  }
  console.info(
    `PASS packed package: ${modules.length} modules, declarations, maps, and all probes.`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
