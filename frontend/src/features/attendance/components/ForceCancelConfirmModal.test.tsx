import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ForceCancelConfirmModal } from "./ForceCancelConfirmModal";

describe("ForceCancelConfirmModal", () => {
  it("キャンセル可能期限を過ぎていても強制的にキャンセルする旨の警告文言が表示されること", () => {
    render(
      <ForceCancelConfirmModal
        isOpen
        targetName="山田太郎"
        isConfirming={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/山田太郎さんの参加登録を強制的にキャンセルします。キャンセル可能期限を過ぎていても取り消され、この操作は元に戻せません。/),
    ).toBeInTheDocument();
  });

  it("確定ボタンクリックでonConfirmが呼ばれること", async () => {
    const user = userEvent.setup();
    const handleConfirm = vi.fn();
    render(
      <ForceCancelConfirmModal
        isOpen
        targetName="山田太郎"
        isConfirming={false}
        onConfirm={handleConfirm}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "強制キャンセルする" }));

    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("isOpen=falseの場合、何も描画されないこと", () => {
    render(
      <ForceCancelConfirmModal
        isOpen={false}
        targetName="山田太郎"
        isConfirming={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByText(/強制的にキャンセルします/)).not.toBeInTheDocument();
  });
});
