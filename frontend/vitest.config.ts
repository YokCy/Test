import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // WHY: `frontend/tests/`はPlaywright（E2E）専用ディレクトリ（`playwright.config.ts`のtestDir）。
    // Vitestの既定挙動だとリポジトリ全体から`*.spec.ts`を拾ってしまい、Playwright専用のAPI
    // （`test.describe`等）をVitestが実行しようとしてエラーになるため、明示的に対象をsrc配下に絞る。
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
