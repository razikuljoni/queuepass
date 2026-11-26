import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
  { files: ['test/**/*.js'], languageOptions: { globals: { module: 'readonly', require: 'readonly', process: 'readonly', __dirname: 'readonly' } } },
);
