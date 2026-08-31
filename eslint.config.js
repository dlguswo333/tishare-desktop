import globals from 'globals';
import stylistic from '@stylistic/eslint-plugin'
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactPlugin from 'eslint-plugin-react';
import tsParser from "@typescript-eslint/parser";
import js from "@eslint/js";

/** @type {import('eslint').Linter.Config.RulesRecord} */
const globalRules = {
  '@stylistic/indent': ['error', 2, {'SwitchCase': 0}],
  '@stylistic/quotes': ['error', 'single'],
  '@stylistic/semi': ['error', 'always'],
  '@stylistic/space-infix-ops': 'error',
  '@stylistic/keyword-spacing': 'error',
  '@stylistic/eol-last': 'error',

  '@stylistic/comma-dangle': ['error', {
    arrays: 'never',
    objects: 'only-multiline',
    imports: 'never',
    exports: 'never',
    functions: 'never',
  }],

  '@stylistic/object-curly-spacing': 'error',
  '@stylistic/space-before-function-paren': ['error', 'always'],
  '@stylistic/space-before-blocks': ['error', 'always'],
  '@stylistic/arrow-spacing': 'error',
};

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    name: 'global',
    files: ['src/**/*'],
    ignores: ['**/*.d.ts', 'build/**/*', 'dist/**/*', 'node_modules/**/*', 'src/back/ts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@stylistic': stylistic,
    },
    rules: globalRules,
  },
  {
    name: 'front',
    files: ['src/front/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      parser: tsParser,
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      '@stylistic': stylistic,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      '@stylistic/jsx-quotes': ['error', 'prefer-single'],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      ...globalRules,
    },
  },
  {
    name: 'back',
    files: ['src/back/**/*.{js,ts}'],
    ignores: ['src/back/ts/**/*.js'],
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.commonjs,
        ...globals.node,
        ...globals.mocha,
      }
    },
    rules: {
      ...globalRules,
      ...js.configs.recommended.rules,
    }
  }
];
