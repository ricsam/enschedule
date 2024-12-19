const { resolve } = require("node:path");

const project = resolve(process.cwd(), "tsconfig.json");

/*
 * This is a custom ESLint configuration for use with
 * typescript packages.
 *
 * This config extends the Vercel Engineering Style Guide.
 * For more information, see https://github.com/vercel/style-guide
 *
 */

module.exports = {
  extends: [
    "@vercel/style-guide/eslint/node",
    "@vercel/style-guide/eslint/typescript",
  ].map(require.resolve),
  parserOptions: {
    project,
  },
  globals: {
    React: true,
    JSX: true,
  },
  settings: {
    "import/resolver": {
      typescript: {
        project,
      },
    },
  },
  rules: {
    "no-console": 0,
    "@typescript-eslint/explicit-function-return-type": 0,
    "@typescript-eslint/no-dynamic-delete": 0,
    "@typescript-eslint/no-unnecessary-condition": 0,
    "no-constant-condition": 0,
    "eslint-comments/no-unlimited-disable": 0,
  },
  ignorePatterns: ["node_modules/", "dist/", "coverage/", "*.test.ts"],
};
