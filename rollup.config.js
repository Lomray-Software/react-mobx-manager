import typescript from 'rollup-plugin-ts';
import ttypescript from 'ttypescript';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'lib',
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
  ],
};
