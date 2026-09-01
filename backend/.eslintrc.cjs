/**
 * ESLint設定（CODING_STANDARDS.md 1.1節「コンパイラ/リンター推奨設定」に準拠）。
 * `plugin:@typescript-eslint/recommended-type-checked`は型情報を用いた解析のため
 * `parserOptions.project`でtsconfig.jsonを指定する必要がある。
 */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier",
  ],
  settings: {
    "import/resolver": {
      typescript: true,
      node: true,
    },
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/consistent-type-imports": "error",
    "import/order": ["error", { "newlines-between": "always", alphabetize: { order: "asc" } }],
  },
  ignorePatterns: [".eslintrc.cjs", "dist", "node_modules"],
};
