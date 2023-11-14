/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['eslint:recommended'],
  ignorePatterns: ['*.cjs', '*.d.ts'],
  env: {
    browser: false,
    commonjs: true,
    node: true,
    es2021: true,
    mocha: true,
  },
  parserOptions: {
    sourceType: 'script',
  },
  root: false,
  ignorePatterns: ['*.cjs', '*.d.ts'],
  overrides: [{
    files: ["**/*.js"]
  }]
};
