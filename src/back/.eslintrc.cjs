/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['eslint:recommended'],
  ignorePatterns: ['*.cjs', '*.d.ts'],
  env: {
    browser: false,
    commonjs: true,
    node: true,
    es2022: true,
    mocha: true,
  },
  root: false,
  ignorePatterns: ['*.cjs', '*.d.ts'],
  overrides: [{
    files: ["**/*.js"]
  }]
};
