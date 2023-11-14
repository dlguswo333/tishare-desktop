/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  ignorePatterns: ['*.cjs', '*.d.ts', 'build/**/*'],
  env: {
    es2021: true
  },
  rules: {
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'jsx-quotes': ['error', 'prefer-single'],
    'space-infix-ops': 'error',
    'keyword-spacing': 'error',
    'eol-last': 'error',
    'comma-dangle': ['error', {
      'arrays': 'never',
      'objects': 'only-multiline',
      'imports': 'never',
      'exports': 'never',
      'functions': 'never'
    }],
    'object-curly-spacing': 'error',
    'space-before-function-paren': ['error', 'always'],
    'space-before-blocks': ['error', 'always'],
    'arrow-spacing': 'error',
  },
};
