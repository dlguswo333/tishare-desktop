import globals from 'globals';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactPlugin from 'eslint-plugin-react';

/** @type {import('eslint').Linter.Config.RulesRecord} */
const globalRules = {
  indent: ['error', 2],
  quotes: ['error', 'single'],
  semi: ['error', 'always'],
  'space-infix-ops': 'error',
  'keyword-spacing': 'error',
  'eol-last': 'error',

  'comma-dangle': ['error', {
    arrays: 'never',
    objects: 'only-multiline',
    imports: 'never',
    exports: 'never',
    functions: 'never',
  }],

  'object-curly-spacing': 'error',
  'space-before-function-paren': ['error', 'always'],
  'space-before-blocks': ['error', 'always'],
  'arrow-spacing': 'error',
};

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    name: 'global',
    files: ['src/**/*'],
    ignores: ['**/*.d.ts', 'build/**/*', 'dist/**/*', 'node_modules/**/*'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: globalRules,
  },
  {
    name: 'front',
    files: ['src/front/**/*.{js,jsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'jsx-quotes': ['error', 'prefer-single'],
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
    files: ['back/**/*.js'],
    extends: ['eslint:recommended'],
    languageOptions: {
      parserOptions: {
        globals: {
          ...globals.commonjs,
          ...globals.node,
          ...globals.mocha,
        }
      }
    },
    rules: {
      ...globalRules,
    }
  }
];
