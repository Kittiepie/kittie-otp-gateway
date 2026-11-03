import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/node_modules/', '**/dist/', '**/.next/', '**/coverage/', '**/src/generated/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // `_name` marks a value that is intentionally unused (e.g. pulled out of an object to drop it).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
]);
