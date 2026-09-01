/**
 * ESLint設定（CODING_STANDARDS.md 1.1節「コンパイラ/リンター推奨設定」に準拠）。
 * backend/.eslintrc.cjsと同じ方針（型情報を用いたtype-checked解析、import/order）に、
 * フロントエンド固有のReact Hooksルール・JSXのFast Refresh検証を追加している。
 */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint", "import", "react", "react-hooks", "react-refresh"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier",
  ],
  settings: {
    react: { version: "detect" },
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
    // WHY(CODING_STANDARDS.md 2章「React.FCは使わない」): JSXの型はTypeScriptの関数戻り値推論で
    // 十分検証できるため、React 17+のnew JSX transform前提のreact/react-in-jsx-scope等は無効化する。
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
  },
  ignorePatterns: [".eslintrc.cjs", "dist", "node_modules"],
};
