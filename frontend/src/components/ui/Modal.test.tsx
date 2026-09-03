import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Modal } from "./Modal";

describe("Modal", () => {
  it("isOpen=falseの場合、内容が描画されないこと", () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()}>
        <p>モーダルの内容</p>
      </Modal>,
    );

    expect(screen.queryByText("モーダルの内容")).not.toBeInTheDocument();
  });

  it("背景クリックでonCloseが呼ばれること", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(
      <Modal isOpen onClose={handleClose} testId="test-modal">
        <p>モーダルの内容</p>
      </Modal>,
    );

    await user.click(screen.getByTestId("test-modal"));

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("モーダル内側パネルのクリックではonCloseが呼ばれないこと（背景クリックとの伝播分離）", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(
      <Modal isOpen onClose={handleClose}>
        <p>モーダルの内容</p>
      </Modal>,
    );

    await user.click(screen.getByText("モーダルの内容"));

    expect(handleClose).not.toHaveBeenCalled();
  });
});
