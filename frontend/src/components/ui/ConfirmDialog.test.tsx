import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("isOpen=falseの場合、何も描画されないこと", () => {
    render(
      <ConfirmDialog
        isOpen={false}
        message="本当に削除しますか？"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByText("本当に削除しますか？")).not.toBeInTheDocument();
  });

  it("確定ボタンクリックでonConfirmが呼ばれること", async () => {
    const user = userEvent.setup();
    const handleConfirm = vi.fn();
    render(
      <ConfirmDialog
        isOpen
        message="本当に削除しますか？"
        onConfirm={handleConfirm}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "確定" }));

    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("キャンセルボタンクリックでonCancelが呼ばれること", async () => {
    const user = userEvent.setup();
    const handleCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen
        message="本当に削除しますか？"
        onConfirm={vi.fn()}
        onCancel={handleCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it("背景クリックでonCancelが呼ばれること（Modal基盤のonClose経由）", async () => {
    const user = userEvent.setup();
    const handleCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen
        message="本当に削除しますか？"
        onConfirm={vi.fn()}
        onCancel={handleCancel}
      />,
    );

    await user.click(screen.getByText("本当に削除しますか？").closest("div.fixed") as HTMLElement);

    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it("isConfirming=trueの間、確定ボタンがdisabled・ローディング表示になること", () => {
    render(
      <ConfirmDialog
        isOpen
        isConfirming
        message="本当に削除しますか？"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /確定/ })).toBeDisabled();
    expect(screen.getByRole("status", { name: "読み込み中" })).toBeInTheDocument();
  });

  it("isDanger指定時に確定ボタンが危険色（danger）のスタイルになること", () => {
    render(
      <ConfirmDialog
        isOpen
        isDanger
        message="本当に削除しますか？"
        confirmLabel="削除する"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "削除する" }).className).toContain("bg-red-600");
  });
});
