/**
 * LyricLens — ESLint flat config (ESLint 10).
 *
 * Deliberately uses the *legacy* rule objects (`plugin.configs.x.rules`) and
 * re-wraps them in flat-config blocks. That keeps us compatible regardless of
 * whether each plugin has shipped a native flat-config export yet.
 */
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import nextPlugin from '@next/eslint-plugin-next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const IGNORES = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/out/**',
  '**/storybook-static/**',
  '**/coverage/**',
  '**/.turbo/**',
  '**/target/**',
  '**/.venv/**',
  'var/**',
  'storage/**',
  '**/*.woff2',
  // Python is linted by ruff, not ESLint. Without this, ESLint tries to parse
  // .py files as JavaScript and reports nonsense parse errors.
  '**/*.py',
  '**/*.pyi',
];

const TS_FILES = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];

export default tseslint.config(
  { ignores: IGNORES },
  js.configs.recommended,
  tseslint.configs.recommended,

  // `_`-prefixed parameters are the repo's convention for "deliberately unused"
  // (interface conformance, e.g. a driver method that must accept a key it has
  // no use for). Apply that consistently rather than only in tests.
  {
    files: TS_FILES,
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // ---- Node / tooling surfaces -------------------------------------------
  {
    files: ['**/*.{js,mjs,cjs}', 'scripts/**/*.{js,mjs}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },

  // ---- React / TSX -------------------------------------------------------
  {
    files: TS_FILES,
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    // Pin the version instead of 'detect': version detection calls
    // `context.getFilename()`, which ESLint 10 removed, and crashes the linter.
    settings: { react: { version: '19.0' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react/prop-types': 'off',
      'react/display-name': 'off',
      '@next/next/no-img-element': 'off',
    },
  },

  // ---- Next.js app -------------------------------------------------------
  {
    files: ['apps/web/**/*.{ts,tsx,js,mjs}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // This rule assumes the legacy Pages router and errors out on an App
      // Router project with no `pages/` or `src/pages/` directory.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },

  // ---- Tests are allowed to be loose about unused vars and magic numbers --
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // ---- Generated / vendored ---------------------------------------------
  {
    files: ['packages/ui/src/**/*.stories.tsx'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },

  prettier,
);
