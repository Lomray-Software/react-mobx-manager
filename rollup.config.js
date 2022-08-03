import typescript from 'rollup-plugin-ts';
import ttypescript from 'ttypescript';
import { terser } from 'rollup-plugin-terser';

const IS_DEVELOP_BUILD = process.env.BUILD === 'development'

export default {
  input: 'src/index.ts',
  output: {
    dir: IS_DEVELOP_BUILD ? 'example/lib' : 'lib',
    format: 'cjs',
    preserveModules: true,
    exports: 'auto',
  },
  external: ['react', 'mobx', 'hoist-non-react-statics', 'mobx-react-lite'],
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
