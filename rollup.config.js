import typescript from 'rollup-plugin-ts';
import { folderInput } from 'rollup-plugin-folder-input';
import copy from 'rollup-plugin-copy';
import terser from '@rollup/plugin-terser';

const IS_DEVELOP_BUILD = process.env.BUILD === 'development'
const dest = IS_DEVELOP_BUILD ? 'example/node_modules/@lomray/react-mobx-manager' : 'lib';

export default {
  input: [
    'src/**/*.ts*',
  ],
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
    typescript({
      tsconfig: resolvedConfig => ({
        ...resolvedConfig,
        declaration: true,
        importHelpers: true,
        plugins: [
          {
            "transform": "@zerollup/ts-transform-paths",
            "exclude": ["*"]
          }
        ]
      }),
    }),
    terser(),
    copy({
      targets: [
        { src: 'package.json', dest: dest },
        { src: 'README.md', dest: dest },
        { src: 'LICENSE', dest: dest },
      ]
    })
  ],
};
