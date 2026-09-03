import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../../lib/api-client";
import type { EventFeedbacksResponse } from "../api";

import { FeedbackList } from "./FeedbackList";

vi.mock("../../../lib/api-client", () => ({
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

const MEMBER_ME = { id: "user_1", name: "山田太郎", email: "yamada@example.com", role: "MEMBER" as const };
const ADMIN_ME = { id: "admin_1", name: "管理者太郎", email: "admin@example.com", role: "ADMIN" as const };

/**
 * `apiClient.get`はGET /auth/me（useMe）とGET /events/:id/feedbacks（useEventFeedbacks）の
 * 2つのクエリから呼ばれる。呼び出し順序に依存させないよう、パスに応じて返却するレスポンスを出し分ける。
 */
function mockApiGet(me: typeof MEMBER_ME | typeof ADMIN_ME, feedbacks: EventFeedbacksResponse) {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === "/auth/me") {
      return Promise.resolve(me);
    }
    if (path.endsWith("/feedbacks")) {
      return Promise.resolve(feedbacks);
    }
    return Promise.reject(new Error(`unexpected path: ${path}`));
  });
}

function renderFeedbackList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FeedbackList eventId="event_1" />
    </QueryClientProvider>,
  );
}

describe("FeedbackList", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it("非管理者には、匿名投稿の投稿者名の代わりに固定文言「匿名希望」が表示されること", async () => {
    mockApiGet(MEMBER_ME, {
      averageRating: 4,
      feedbacks: [
        {
          id: "fb_1",
          rating: 4,
          comment: "良かったです",
          isAnonymous: true,
          author: null,
          isMine: false,
        },
      ],
    });

    renderFeedbackList();

    expect(await screen.findByText("匿名希望")).toBeInTheDocument();
    expect(screen.queryByText("管理者太郎")).not.toBeInTheDocument();
  });

  it("管理者には、匿名投稿でも投稿者名が表示されること", async () => {
    mockApiGet(ADMIN_ME, {
      averageRating: 4,
      feedbacks: [
        {
          id: "fb_1",
          rating: 4,
          comment: "良かったです",
          isAnonymous: true,
          author: { id: "user_1", name: "山田太郎" },
          isMine: false,
          isHidden: false,
        },
      ],
    });

    renderFeedbackList();

    expect(await screen.findByText("山田太郎（匿名投稿）")).toBeInTheDocument();
  });

  it("非管理者には「非公開化」ボタンが表示されないこと", async () => {
    mockApiGet(MEMBER_ME, {
      averageRating: 5,
      feedbacks: [
        { id: "fb_1", rating: 5, comment: "最高でした", isAnonymous: false, author: { id: "user_2", name: "鈴木花子" }, isMine: false },
      ],
    });

    renderFeedbackList();

    await screen.findByText("鈴木花子");
    expect(screen.queryByRole("button", { name: "非公開化" })).not.toBeInTheDocument();
  });

  it("管理者には「非公開化」ボタンが表示されること", async () => {
    mockApiGet(ADMIN_ME, {
      averageRating: 5,
      feedbacks: [
        {
          id: "fb_1",
          rating: 5,
          comment: "最高でした",
          isAnonymous: false,
          author: { id: "user_2", name: "鈴木花子" },
          isMine: false,
          isHidden: false,
        },
      ],
    });

    renderFeedbackList();

    expect(await screen.findByRole("button", { name: "非公開化" })).toBeInTheDocument();
  });

  it("平均評価・件数がヘッダーに表示されること", async () => {
    mockApiGet(MEMBER_ME, {
      averageRating: 3.5,
      feedbacks: [
        { id: "fb_1", rating: 3, comment: "普通でした", isAnonymous: false, author: { id: "user_2", name: "鈴木花子" }, isMine: false },
        { id: "fb_2", rating: 4, comment: "良かったです", isAnonymous: false, author: { id: "user_3", name: "田中一郎" }, isMine: false },
      ],
    });

    renderFeedbackList();

    expect(await screen.findByText("レビュー（平均 ★3.5、2件）")).toBeInTheDocument();
  });

  it("「非公開化」クリックで確認モーダルが開き、確定でhideFeedbackが呼ばれること", async () => {
    const user = userEvent.setup();
    mockApiGet(ADMIN_ME, {
      averageRating: 5,
      feedbacks: [
        {
          id: "fb_1",
          rating: 5,
          comment: "最高でした",
          isAnonymous: false,
          author: { id: "user_2", name: "鈴木花子" },
          isMine: false,
          isHidden: false,
        },
      ],
    });
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      id: "fb_1",
      rating: 5,
      comment: "最高でした",
      isAnonymous: false,
      author: { id: "user_2", name: "鈴木花子" },
      isMine: false,
      isHidden: true,
    });

    renderFeedbackList();

    await user.click(await screen.findByRole("button", { name: "非公開化" }));

    expect(await screen.findByText("このフィードバックを非公開化します。非公開化したフィードバックは元に戻せません。よろしいですか？")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "非公開化する" }));

    expect(apiClient.post).toHaveBeenCalledWith("/feedbacks/fb_1/hide");
  });
});
