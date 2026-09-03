import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { RegistrationRow } from "../api";

import { AttendanceRow } from "./AttendanceRow";

const BASE_REGISTRATION: RegistrationRow = {
  userId: "user_1",
  name: "山田太郎",
  status: "CONFIRMED",
  attendanceStatus: null,
};

describe("AttendanceRow", () => {
  it("未マークの場合、出席/欠席どちらのボタンも非選択（●無し）かつ活性で表示されること", () => {
    render(
      <AttendanceRow
        registration={BASE_REGISTRATION}
        isMarkingDisabled={false}
        isMarkPending={false}
        onMark={vi.fn()}
        canForceCancel={false}
        onForceCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "出席" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "欠席" })).toBeEnabled();
  });

  it("出席マーク済みの場合、出席ボタンが選択状態（●出席）で表示されること", () => {
    render(
      <AttendanceRow
        registration={{ ...BASE_REGISTRATION, attendanceStatus: "ATTENDED" }}
        isMarkingDisabled={false}
        isMarkPending={false}
        onMark={vi.fn()}
        canForceCancel={false}
        onForceCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "●出席" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "欠席" })).toBeInTheDocument();
  });

  it("欠席マーク済みの場合、欠席ボタンが選択状態（●欠席）で表示されること", () => {
    render(
      <AttendanceRow
        registration={{ ...BASE_REGISTRATION, attendanceStatus: "ABSENT" }}
        isMarkingDisabled={false}
        isMarkPending={false}
        onMark={vi.fn()}
        canForceCancel={false}
        onForceCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "●欠席" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "出席" })).toBeInTheDocument();
  });

  it("出席ボタンクリックでonMark(userId, \"ATTENDED\")が呼ばれること", async () => {
    const user = userEvent.setup();
    const handleMark = vi.fn();
    render(
      <AttendanceRow
        registration={BASE_REGISTRATION}
        isMarkingDisabled={false}
        isMarkPending={false}
        onMark={handleMark}
        canForceCancel={false}
        onForceCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "出席" }));

    expect(handleMark).toHaveBeenCalledWith("user_1", "ATTENDED");
  });

  it("欠席ボタンクリックでonMark(userId, \"ABSENT\")が呼ばれること", async () => {
    const user = userEvent.setup();
    const handleMark = vi.fn();
    render(
      <AttendanceRow
        registration={BASE_REGISTRATION}
        isMarkingDisabled={false}
        isMarkPending={false}
        onMark={handleMark}
        canForceCancel={false}
        onForceCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "欠席" }));

    expect(handleMark).toHaveBeenCalledWith("user_1", "ABSENT");
  });

  it("マーク済みボタンの再クリック（訂正）で確認モーダルを挟まず、即座にonMarkが呼ばれること", async () => {
    const user = userEvent.setup();
    const handleMark = vi.fn();
    render(
      <AttendanceRow
        registration={{ ...BASE_REGISTRATION, attendanceStatus: "ATTENDED" }}
        isMarkingDisabled={false}
        isMarkPending={false}
        onMark={handleMark}
        canForceCancel={false}
        onForceCancel={vi.fn()}
      />,
    );

    // 既に出席済みの状態から、欠席ボタンを押して訂正する操作。
    await user.click(screen.getByRole("button", { name: "欠席" }));

    expect(handleMark).toHaveBeenCalledTimes(1);
    expect(handleMark).toHaveBeenCalledWith("user_1", "ABSENT");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("isMarkingDisabled=trueの場合、出席/欠席ボタンがdisabledになること", () => {
    render(
      <AttendanceRow
        registration={BASE_REGISTRATION}
        isMarkingDisabled
        isMarkPending={false}
        onMark={vi.fn()}
        canForceCancel={false}
        onForceCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "出席" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "欠席" })).toBeDisabled();
  });

  it("isMarkPending=trueの場合、対象行の出席/欠席ボタンがdisabledになること", () => {
    render(
      <AttendanceRow
        registration={BASE_REGISTRATION}
        isMarkingDisabled={false}
        isMarkPending
        onMark={vi.fn()}
        canForceCancel={false}
        onForceCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "出席" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "欠席" })).toBeDisabled();
  });

  it("canForceCancel=trueの場合のみ「強制キャンセル」ボタンが表示されること", () => {
    const { rerender } = render(
      <AttendanceRow
        registration={BASE_REGISTRATION}
        isMarkingDisabled={false}
        isMarkPending={false}
        onMark={vi.fn()}
        canForceCancel={false}
        onForceCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "強制キャンセル" })).not.toBeInTheDocument();

    rerender(
      <AttendanceRow
        registration={BASE_REGISTRATION}
        isMarkingDisabled={false}
        isMarkPending={false}
        onMark={vi.fn()}
        canForceCancel
        onForceCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "強制キャンセル" })).toBeInTheDocument();
  });

  it("「強制キャンセル」クリックでonForceCancel(userId, name)が呼ばれること", async () => {
    const user = userEvent.setup();
    const handleForceCancel = vi.fn();
    render(
      <AttendanceRow
        registration={BASE_REGISTRATION}
        isMarkingDisabled={false}
        isMarkPending={false}
        onMark={vi.fn()}
        canForceCancel
        onForceCancel={handleForceCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: "強制キャンセル" }));

    expect(handleForceCancel).toHaveBeenCalledWith("user_1", "山田太郎");
  });
});
