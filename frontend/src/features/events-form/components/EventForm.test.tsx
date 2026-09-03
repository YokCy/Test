import type { CreateEventInput } from "@eventboard/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../../lib/api-client";
import type { CategoryOption } from "../api";

import { EventForm } from "./EventForm";

vi.mock("../../../lib/api-client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
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

const CATEGORY_ID = "clcategory0000000000000";

const categoryOptions: CategoryOption[] = [{ id: CATEGORY_ID, name: "勉強会", eventCount: 2 }];

function renderForm(props: Partial<Parameters<typeof EventForm>[0]> = {}) {
  vi.mocked(apiClient.get).mockResolvedValue(categoryOptions);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  const onCancel = props.onCancel ?? vi.fn();
  return {
    onSubmit,
    onCancel,
    ...render(
      <QueryClientProvider client={queryClient}>
        <EventForm
          defaultValues={props.defaultValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitLabel={props.submitLabel ?? "保存する"}
        />
      </QueryClientProvider>,
    ),
  };
}

/** 必須項目（タイトル・開催日時・定員・カテゴリ）を有効な値で埋める。任意項目は空欄のまま残す。 */
async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("option", { name: "勉強会" });
  await user.type(screen.getByLabelText("タイトル"), "新しい勉強会");
  await user.selectOptions(screen.getByLabelText("カテゴリ"), CATEGORY_ID);
  await user.type(screen.getByLabelText("開催日時"), "2026-10-01T10:00");
}

describe("EventForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("必須項目（タイトル・開催日時・定員・カテゴリ）が未入力の場合、バリデーションエラーを表示し送信しない", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await screen.findByRole("option", { name: "勉強会" });

    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(await screen.findByText("タイトルは必須です")).toBeInTheDocument();
    expect(screen.getByText("カテゴリを選択してください")).toBeInTheDocument();
    expect(screen.getByText("開催日時の形式が正しくありません")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("定員に0を入力した場合、送信されないこと（input[min=1]のネイティブ制約により不正な値として扱われる）", async () => {
    // WHY: <input type="number" min={1}>には`noValidate`が付与されていないため（EventForm.tsx）、
    // 定員0はブラウザのネイティブ制約検証（rangeUnderflow）でsubmitイベント自体がブロックされ、
    // 送信ハンドラ（したがってZodの`定員は1以上で入力してください`カスタムメッセージ）には到達しない。
    // ここではその実際の挙動（ネイティブ制約により送信されないこと）を検証する。
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await fillRequiredFields(user);
    fireEvent.change(screen.getByLabelText("定員"), { target: { value: "0" } });

    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(screen.getByLabelText<HTMLInputElement>("定員").validity.rangeUnderflow).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("終了日時・登録締切・キャンセル期限が未入力の場合、送信データは空文字ではなくundefinedになる", async () => {
    // WHY: Zodの`z.string().datetime().optional()`は値がundefinedの場合のみ検証をスキップし、
    // 空文字""は不正な日時として弾かれる（過去の400再発防止のための回帰テスト）。
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm({ onSubmit });
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: "保存する" }));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    const firstCall = onSubmit.mock.calls[0];
    if (!firstCall) {
      throw new Error("onSubmitが呼ばれていません");
    }
    const submitted = firstCall[0] as CreateEventInput;
    expect(submitted.endAt).toBeUndefined();
    expect(submitted.registrationDeadline).toBeUndefined();
    expect(submitted.cancellationDeadline).toBeUndefined();
  });

  it("タグをEnterで追加できる", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByRole("option", { name: "勉強会" });

    await user.type(screen.getByLabelText("タグ"), "react{Enter}");

    expect(screen.getByText("react")).toBeInTheDocument();
  });

  it("同じタグを重複して追加しようとした場合、1つにまとめられる", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByRole("option", { name: "勉強会" });

    await user.type(screen.getByLabelText("タグ"), "react{Enter}");
    await user.type(screen.getByLabelText("タグ"), "react{Enter}");

    expect(screen.getAllByText("react")).toHaveLength(1);
  });

  it("タグの削除ボタンクリックでタグが除去される", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByRole("option", { name: "勉強会" });

    await user.type(screen.getByLabelText("タグ"), "react{Enter}");
    expect(screen.getByText("react")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "タグ「react」を削除" }));

    expect(screen.queryByText("react")).not.toBeInTheDocument();
  });

  it("送信中は保存ボタンがdisabledかつローディング表示になる", async () => {
    const user = userEvent.setup();
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    renderForm({ onSubmit });
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(screen.getByRole("button", { name: /保存する/ })).toBeDisabled();

    resolveSubmit?.();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "保存する" })).toBeEnabled();
    });
  });

  it("サーバー側バリデーションエラー（400）発生時、フォームを閉じずフィールドエラーとして表示する", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("../../../lib/api-client");
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(400, "BadRequestException", "開催日時は未来の日時にしてください"));
    renderForm({ onSubmit });
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("開催日時は未来の日時にしてください");
    // WHY: サーバーエラー時もフォーム自体は表示され続け、再送信可能な状態を保つ
    expect(screen.getByRole("button", { name: "保存する" })).toBeInTheDocument();
  });

  it("編集時（defaultValues指定あり）は初期値がフォームに反映され、日時未設定項目は空欄になる", async () => {
    const defaultValues: CreateEventInput = {
      title: "既存の勉強会",
      description: "既存の説明",
      categoryId: CATEGORY_ID,
      tags: ["typescript"],
      startAt: "2026-11-01T01:00:00.000Z",
      endAt: undefined,
      capacity: 20,
      registrationDeadline: undefined,
      cancellationDeadline: undefined,
    };
    renderForm({ defaultValues });
    await screen.findByRole("option", { name: "勉強会" });

    expect(screen.getByLabelText("タイトル")).toHaveValue("既存の勉強会");
    expect(screen.getByLabelText("定員")).toHaveValue(20);
    expect(screen.getByText("typescript")).toBeInTheDocument();
    expect(screen.getByLabelText("終了日時(任意)")).toHaveValue("");
    expect(screen.getByLabelText("登録締切(任意)")).toHaveValue("");
    expect(screen.getByLabelText("キャンセル期限(任意)")).toHaveValue("");
  });
});
