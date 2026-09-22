import lomrayConfig from '@lomray/eslint-config-react';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'lib/**', 'coverage/**', 'docs/**'] },
  ...lomrayConfig.config({
    files: ['src/**/*.{ts,tsx}', '__tests__/**/*.{ts,tsx}', '__helpers__/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, NodeJS: true },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    settings: {
      'import-x/resolver': { typescript: { project: './tsconfig.json' } },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }),
  {
    files: ['__tests__/**/*.{ts,tsx}', '__helpers__/**/*.{ts,tsx}'],
    rules: {
      'sonarjs/no-duplicate-string': 'off',
      // Vitest convention directories are wrapped in double underscores.
      'unicorn/filename-case': 'off',
    },
  },
];
