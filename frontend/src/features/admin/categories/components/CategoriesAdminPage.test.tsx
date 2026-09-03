import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../../../lib/api-client";
import type { CategoryListItem } from "../api";

import { CategoriesAdminPage } from "./CategoriesAdminPage";

vi.mock("../../../../lib/api-client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

const CATEGORIES: CategoryListItem[] = [
  { id: "cat_1", name: "勉強会", eventCount: 3 },
  { id: "cat_2", name: "懇親会", eventCount: 0 },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CategoriesAdminPage />
    </QueryClientProvider>,
  );
}

function getRowByCategoryName(name: string): HTMLElement {
  const cell = screen.getByText(name);
  const row = cell.closest("tr");
  if (!row) {
    throw new Error(`row not found for category: ${name}`);
  }
  return row;
}

describe("CategoriesAdminPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("各カテゴリ行に、紐づくイベント数が表示されること", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(CATEGORIES);
    renderPage();

    await screen.findByText("勉強会");
    expect(getRowByCategoryName("勉強会")).toHaveTextContent("3");
    expect(getRowByCategoryName("懇親会")).toHaveTextContent("0");
  });

  it("紐づくイベント数が0件でない場合でも、削除ボタンがフロント側で無効化されないこと", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(CATEGORIES);
    renderPage();

    await screen.findByText("勉強会");
    const row = getRowByCategoryName("勉強会");
    expect(within(row).getByRole("button", { name: "削除" })).toBeEnabled();
  });

  it("「＋追加」クリックで、新規モードのカテゴリ追加モーダルが開くこと", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValueOnce(CATEGORIES);
    renderPage();

    await screen.findByText("勉強会");
    await user.click(screen.getByRole("button", { name: "＋追加" }));

    expect(await screen.findByText("カテゴリの追加")).toBeInTheDocument();
    expect(screen.getByLabelText("カテゴリ名")).toHaveValue("");
  });

  it("「編集」クリックで、対象カテゴリの値で初期化された編集モーダルが開くこと", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValueOnce(CATEGORIES);
    renderPage();

    await screen.findByText("勉強会");
    const row = getRowByCategoryName("勉強会");
    await user.click(within(row).getByRole("button", { name: "編集" }));

    expect(await screen.findByText("カテゴリの編集")).toBeInTheDocument();
    expect(screen.getByLabelText("カテゴリ名")).toHaveValue("勉強会");
  });

  it("「削除」クリックで、削除確認モーダルが開くこと", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValueOnce(CATEGORIES);
    renderPage();

    await screen.findByText("勉強会");
    const row = getRowByCategoryName("勉強会");
    await user.click(within(row).getByRole("button", { name: "削除" }));

    expect(await screen.findByText("カテゴリの削除")).toBeInTheDocument();
  });
});
