import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient, ApiError } from "../../../lib/api-client";
import type { EventFeedbacksResponse } from "../api";

import { FeedbackPage } from "./FeedbackPage";

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

/**
 * `apiClient.get`はGET /events/:id（ヘッダー用）とGET /events/:id/feedbacks（既存投稿検出用）の
 * 2つのクエリから呼ばれる。呼び出し順序に依存させないよう、パスに応じて返却するレスポンスを出し分ける。
 */
function mockApiGet(feedbacks: EventFeedbacksResponse, title = "社内勉強会") {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path.endsWith("/feedbacks")) {
      return Promise.resolve(feedbacks);
    }
    return Promise.resolve({ title });
  });
}

function renderFeedbackPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/events/event_1/feedback"]}>
        <Routes>
          <Route path="/events/:eventId/feedback" element={<FeedbackPage />} />
          <Route path="/events/:eventId" element={<p>イベント詳細画面</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FeedbackPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.put).mockReset();
  });

  it("投稿条件未充足（403）の場合、フォームの代わりに理由メッセージと戻り導線のみが表示されること", async () => {
    const user = userEvent.setup();
    mockApiGet({ averageRating: null, feedbacks: [] });
    vi.mocked(apiClient.post).mockRejectedValueOnce(
      new ApiError(403, "ForbiddenException", "出席していないため投稿できません"),
    );

    renderFeedbackPage();

    await user.click(await screen.findByRole("radio", { name: "3" }));
    await user.type(screen.getByLabelText("コメント"), "良かったです");
    await user.click(screen.getByRole("button", { name: "投稿する" }));

    expect(await screen.findByText("出席していないため投稿できません")).toBeInTheDocument();
    expect(screen.queryByLabelText("コメント")).not.toBeInTheDocument();
    expect(screen.getByText("← イベント詳細へ")).toBeInTheDocument();
  });

  it("自分の投稿が既にある場合、フォームが投稿済み内容で初期化され、ボタン文言が「更新する」になること", async () => {
    mockApiGet({
      averageRating: 4,
      feedbacks: [
        { id: "fb_1", rating: 4, comment: "とても良かったです", isAnonymous: false, author: { id: "me", name: "山田太郎" }, isMine: true },
      ],
    });

    renderFeedbackPage();

    expect(await screen.findByLabelText("コメント")).toHaveValue("とても良かったです");
    expect(screen.getByRole("radio", { name: "4" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("匿名で投稿する")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "更新する" })).toBeInTheDocument();
  });

  it("自分の投稿が匿名投稿（author: null）でも、isMineにより編集モードとして検出されること", async () => {
    mockApiGet({
      averageRating: 4,
      feedbacks: [
        { id: "fb_1", rating: 5, comment: "匿名で投稿しました", isAnonymous: true, author: null, isMine: true },
      ],
    });

    renderFeedbackPage();

    expect(await screen.findByLabelText("コメント")).toHaveValue("匿名で投稿しました");
    expect(screen.getByLabelText("匿名で投稿する")).toBeChecked();
    expect(screen.getByRole("button", { name: "更新する" })).toBeInTheDocument();
  });

  it("未投稿の場合、フォームが空で初期化され、ボタン文言が「投稿する」になること", async () => {
    mockApiGet({ averageRating: null, feedbacks: [] });

    renderFeedbackPage();

    expect(await screen.findByLabelText("コメント")).toHaveValue("");
    expect(screen.getByRole("radio", { name: "1" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "投稿する" })).toBeInTheDocument();
  });

  it("未投稿からの送信では、submitFeedback（POST）が呼ばれること", async () => {
    const user = userEvent.setup();
    mockApiGet({ averageRating: null, feedbacks: [] });
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      id: "fb_new",
      rating: 5,
      comment: "初めての投稿です",
      isAnonymous: false,
      author: { id: "me", name: "山田太郎" },
      isMine: true,
    });

    renderFeedbackPage();

    await user.click(await screen.findByRole("radio", { name: "5" }));
    await user.type(screen.getByLabelText("コメント"), "初めての投稿です");
    await user.click(screen.getByRole("button", { name: "投稿する" }));

    expect(apiClient.post).toHaveBeenCalledWith("/events/event_1/feedbacks", {
      rating: 5,
      comment: "初めての投稿です",
      isAnonymous: false,
    });
    expect(apiClient.put).not.toHaveBeenCalled();
  });

  it("投稿済みからの送信では、updateFeedback（PUT /feedbacks/:id）が呼ばれること", async () => {
    const user = userEvent.setup();
    mockApiGet({
      averageRating: 4,
      feedbacks: [
        { id: "fb_1", rating: 4, comment: "とても良かったです", isAnonymous: false, author: { id: "me", name: "山田太郎" }, isMine: true },
      ],
    });
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      id: "fb_1",
      rating: 4,
      comment: "更新後のコメントです",
      isAnonymous: false,
      author: { id: "me", name: "山田太郎" },
      isMine: true,
    });

    renderFeedbackPage();

    const commentInput = await screen.findByLabelText("コメント");
    await user.clear(commentInput);
    await user.type(commentInput, "更新後のコメントです");
    await user.click(screen.getByRole("button", { name: "更新する" }));

    expect(apiClient.put).toHaveBeenCalledWith("/feedbacks/fb_1", {
      rating: 4,
      comment: "更新後のコメントです",
      isAnonymous: false,
    });
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("ヘッダー情報・フィードバック一覧の取得中は、ローディング表示になること", () => {
    vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}));

    renderFeedbackPage();

    expect(screen.getByRole("status", { name: "読み込み中" })).toBeInTheDocument();
    expect(screen.queryByLabelText("コメント")).not.toBeInTheDocument();
  });

  it("ヘッダー情報・フィードバック一覧の取得に失敗した場合、エラー表示になること", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new ApiError(500, "InternalServerErrorException", "取得に失敗しました"));

    renderFeedbackPage();

    expect(await screen.findByText("フィードバック投稿画面の情報取得に失敗しました。")).toBeInTheDocument();
  });
});
