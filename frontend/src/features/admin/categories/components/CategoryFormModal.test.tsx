import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient, ApiError } from "../../../../lib/api-client";

import { CategoryFormModal } from "./CategoryFormModal";

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

function renderModal(props?: { isOpen?: boolean; initialValue?: { id: string; name: string }; onClose?: () => void }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = props?.onClose ?? vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <CategoryFormModal isOpen={props?.isOpen ?? true} initialValue={props?.initialValue} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

describe("CategoryFormModal", () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.put).mockReset();
  });

  it("カテゴリ名が未入力のまま送信すると、バリデーションエラーを表示し送信されないこと", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "追加する" }));

    expect(await screen.findByText("カテゴリ名は必須です")).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("カテゴリ名が51文字以上の場合、バリデーションエラーを表示し送信されないこと", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText("カテゴリ名"), "あ".repeat(51));
    await user.click(screen.getByRole("button", { name: "追加する" }));

    expect(await screen.findByText("カテゴリ名は50文字以内で入力してください")).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("新規モードで送信すると、POST /categoriesが呼ばれること", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    vi.mocked(apiClient.post).mockResolvedValueOnce({ id: "cat_1", name: "勉強会" });
    renderModal({ onClose });

    await user.type(screen.getByLabelText("カテゴリ名"), "勉強会");
    await user.click(screen.getByRole("button", { name: "追加する" }));

    expect(apiClient.post).toHaveBeenCalledWith("/categories", { name: "勉強会" });
    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("編集モードで送信すると、PUT /categories/:idが呼ばれること", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    vi.mocked(apiClient.put).mockResolvedValueOnce({ id: "cat_1", name: "懇親会" });
    renderModal({ initialValue: { id: "cat_1", name: "勉強会" }, onClose });

    const nameInput = screen.getByLabelText("カテゴリ名");
    await user.clear(nameInput);
    await user.type(nameInput, "懇親会");
    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(apiClient.put).toHaveBeenCalledWith("/categories/cat_1", { name: "懇親会" });
    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("編集モードで開くと、対象カテゴリの名前で初期化されること", () => {
    renderModal({ initialValue: { id: "cat_1", name: "勉強会" } });

    expect(screen.getByLabelText("カテゴリ名")).toHaveValue("勉強会");
    expect(screen.getByRole("button", { name: "保存する" })).toBeInTheDocument();
  });

  it("同名カテゴリ重複（409）発生時、モーダルを閉じずフィールドエラーとして表示すること", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    vi.mocked(apiClient.post).mockRejectedValueOnce(
      new ApiError(409, "ConflictException", "同名のカテゴリが既に存在します"),
    );
    renderModal({ onClose });

    await user.type(screen.getByLabelText("カテゴリ名"), "勉強会");
    await user.click(screen.getByRole("button", { name: "追加する" }));

    expect(await screen.findByText("同名のカテゴリが既に存在します")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    // モーダルが閉じていないこと（入力フィールドが引き続き存在すること）を確認する
    expect(screen.getByLabelText("カテゴリ名")).toBeInTheDocument();
  });
});
