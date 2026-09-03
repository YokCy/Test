import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../lib/api-client";

import { FeedbackForm } from "./FeedbackForm";

vi.mock("../../../lib/api-client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
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

function renderFeedbackForm(props?: Partial<Parameters<typeof FeedbackForm>[0]>) {
  const onSubmit = props?.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  const onIneligible = props?.onIneligible ?? vi.fn();
  render(
    <FeedbackForm
      defaultValues={props?.defaultValues}
      submitLabel={props?.submitLabel ?? "投稿する"}
      onSubmit={onSubmit}
      onIneligible={onIneligible}
    />,
  );
  return { onSubmit, onIneligible };
}

async function fillValidRating(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: "3" }));
}

describe("FeedbackForm", () => {
  it("評価未選択のまま送信すると、バリデーションエラーを表示し送信されないこと", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderFeedbackForm();

    await user.type(screen.getByLabelText("コメント"), "とても良かったです");
    await user.click(screen.getByRole("button", { name: "投稿する" }));

    expect(await screen.findByText("評価は1〜5で指定してください")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("コメントが1000文字を超えると、バリデーションエラーを表示し送信されないこと", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderFeedbackForm();

    await fillValidRating(user);
    fireEvent.change(screen.getByLabelText("コメント"), { target: { value: "あ".repeat(1001) } });
    await user.click(screen.getByRole("button", { name: "投稿する" }));

    expect(await screen.findByText("String must contain at most 1000 character(s)")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("星をクリックすると、該当の評価値が選択状態になること", async () => {
    const user = userEvent.setup();
    renderFeedbackForm();

    const star3 = screen.getByRole("radio", { name: "3" });
    await user.click(star3);

    expect(star3).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "4" })).toHaveAttribute("aria-checked", "false");
  });

  it("「匿名で投稿する」をチェックして送信すると、isAnonymous: trueが送信データに含まれること", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderFeedbackForm();

    await fillValidRating(user);
    await user.type(screen.getByLabelText("コメント"), "とても良かったです");
    await user.click(screen.getByLabelText("匿名で投稿する"));
    await user.click(screen.getByRole("button", { name: "投稿する" }));

    expect(onSubmit).toHaveBeenCalledWith({
      rating: 3,
      comment: "とても良かったです",
      isAnonymous: true,
    });
  });

  it("「匿名で投稿する」をチェックせずに送信すると、isAnonymous: falseが送信データに含まれること", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderFeedbackForm();

    await fillValidRating(user);
    await user.type(screen.getByLabelText("コメント"), "とても良かったです");
    await user.click(screen.getByRole("button", { name: "投稿する" }));

    expect(onSubmit).toHaveBeenCalledWith({
      rating: 3,
      comment: "とても良かったです",
      isAnonymous: false,
    });
  });

  it("onSubmitが403のApiErrorを投げた場合、onIneligibleがサーバーメッセージとともに呼ばれること", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(403, "ForbiddenException", "出席していないため投稿できません"));
    const { onIneligible } = renderFeedbackForm({ onSubmit });

    await fillValidRating(user);
    await user.type(screen.getByLabelText("コメント"), "とても良かったです");
    await user.click(screen.getByRole("button", { name: "投稿する" }));

    expect(await screen.findByText("投稿する")).toBeInTheDocument();
    expect(onIneligible).toHaveBeenCalledWith("出席していないため投稿できません");
  });

  it("onSubmitが400のApiErrorを投げた場合、フォームを閉じずにフォーム全体のエラーとして表示すること", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(400, "BadRequestException", "入力内容を確認してください"));
    renderFeedbackForm({ onSubmit });

    await fillValidRating(user);
    await user.type(screen.getByLabelText("コメント"), "とても良かったです");
    await user.click(screen.getByRole("button", { name: "投稿する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("入力内容を確認してください");
  });
});
