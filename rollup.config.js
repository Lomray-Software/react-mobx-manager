import typescript from 'rollup-plugin-ts';
import ttypescript from 'ttypescript';
import terser from '@rollup/plugin-terser';

const IS_DEVELOP_BUILD = process.env.BUILD === 'development'

export default {
  input: [
    'src/index.ts',
    'src/suspense-query.ts',
    'src/manager-stream.ts',
    'src/storages/async-storage.ts',
    'src/storages/local-storage.ts',
    'src/plugins/index.ts',
  ],
  output: {
    dir: IS_DEVELOP_BUILD ? 'example/lib' : 'lib',
    format: 'cjs',
    preserveModules: true,
    preserveModulesRoot: 'src',
    exports: 'auto',
  },
  external: [
    'node:process',
    'node:path',
    'react',
    'mobx',
    'hoist-non-react-statics',
    'mobx-react-lite',
    '@lomray/event-manager',
    '@lomray/consistent-suspense',
  ],
  plugins: [
    typescript({
      typescript: ttypescript,
      tsconfig: resolvedConfig => ({
        ...resolvedConfig,
        declaration: true,
      }),
    }),
    terser(),
  ],
};
