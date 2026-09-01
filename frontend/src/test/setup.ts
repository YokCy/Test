// Vitestの各テストファイルで自動的に読み込まれる共通セットアップ。
// `toBeInTheDocument()`等のDOM向けマッチャーをVitestの`expect`に追加する。
import "@testing-library/jest-dom/vitest";
