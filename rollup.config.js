import { rmSync } from 'node:fs';
import typescript from '@rollup/plugin-typescript';
import { folderInput } from 'rollup-plugin-folder-input';
import copy from 'rollup-plugin-copy';
import terser from '@rollup/plugin-terser';
import { replaceTscAliasPaths } from 'tsc-alias';

const dest = 'lib';

/**
 * Remove stale modules and declarations from previous builds.
 */
rmSync(dest, { force: true, recursive: true });

const typescriptPlugin = typescript({ tsconfig: './tsconfig.build.json', filterRoot: '.' });

export default {
  input: ['src/**/*.ts*'],
  output: {
    dir: dest,
    format: 'es',
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: 'src',
    exports: 'auto',
  },
  external: [
    'node:process',
    'node:path',
    'node:fs',
    'node:url',
    'react',
    'mobx',
    'lodash',
    'hoist-non-react-statics',
    'mobx-react-lite',
    '@lomray/event-manager',
    '@lomray/consistent-suspense',
  ],
  plugins: [
    folderInput(),
    typescriptPlugin,
    terser(),
    copy({
      targets: [
        { src: 'package.json', dest: dest },
        { src: 'README.md', dest: dest },
        { src: 'LICENSE', dest: dest },
      ],
    }),
    {
      name: 'resolve-declaration-imports',
      /**
       * Resolve aliases and relative declaration imports for Node ESM consumers.
       */
      async writeBundle() {
        await replaceTscAliasPaths({
          configFile: './tsconfig.build.json',
          resolveFullPaths: true,
          resolveFullExtension: '.js',
        });
      },
    },
  ],
};
