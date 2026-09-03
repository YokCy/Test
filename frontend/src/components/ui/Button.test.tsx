import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

describe("Button", () => {
  it("isLoading=trueの場合、スピナーが表示されボタンがdisabledになること", () => {
    render(<Button isLoading>送信する</Button>);

    const button = screen.getByRole("button", { name: /送信する/ });
    expect(button).toBeDisabled();
    expect(screen.getByRole("status", { name: "読み込み中" })).toBeInTheDocument();
  });

  it("disabled指定時にクリックしてもonClickが呼ばれないこと", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        送信する
      </Button>,
    );

    await user.click(screen.getByRole("button", { name: "送信する" }));

    expect(handleClick).not.toHaveBeenCalled();
  });
});
