import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient, ApiError } from "../../../../lib/api-client";

import { DeleteCategoryConfirmModal } from "./DeleteCategoryConfirmModal";

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

const CATEGORY = { id: "cat_1", name: "勉強会" };

function renderModal(props?: { onClose?: () => void }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = props?.onClose ?? vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <DeleteCategoryConfirmModal isOpen category={CATEGORY} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

describe("DeleteCategoryConfirmModal", () => {
  beforeEach(() => {
    vi.mocked(apiClient.delete).mockReset();
  });

  it("確定クリックで、DELETE /categories/:idが呼ばれること", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    renderModal({ onClose });

    await user.click(screen.getByRole("button", { name: "削除する" }));

    expect(apiClient.delete).toHaveBeenCalledWith("/categories/cat_1");
    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("紐づくイベントが存在する場合の409エラーメッセージが、モーダル内にそのまま表示されること", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    vi.mocked(apiClient.delete).mockRejectedValueOnce(
      new ApiError(409, "ConflictException", "このカテゴリには紐づくイベントが存在するため削除できません"),
    );
    renderModal({ onClose });

    await user.click(screen.getByRole("button", { name: "削除する" }));

    expect(
      await screen.findByText("このカテゴリには紐づくイベントが存在するため削除できません"),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
