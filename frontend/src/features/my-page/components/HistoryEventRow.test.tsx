import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { HistoryItem } from "../api";

import { HistoryEventRow } from "./HistoryEventRow";

const BASE_EVENT: HistoryItem = {
  id: "event_1",
  title: "参加履歴イベントA",
  startAt: "2026-09-01T10:00:00.000Z",
  category: { id: "cat_1", name: "勉強会" },
  attendanceStatus: "ATTENDED",
};

function renderRow(event: HistoryItem) {
  return render(
    <MemoryRouter>
      <HistoryEventRow event={event} />
    </MemoryRouter>,
  );
}

describe("HistoryEventRow", () => {
  it("formatEventDateTimeによるフォーマット済み日時が表示されること", () => {
    renderRow(BASE_EVENT);

    expect(screen.getByText(/09\/01\(火\)19:00〜/)).toBeInTheDocument();
  });

  it("出席（ATTENDED）の場合、「出席」バッジが表示されること", () => {
    renderRow(BASE_EVENT);

    expect(screen.getByText("出席")).toBeInTheDocument();
  });

  it("欠席（ABSENT）の場合、「欠席」バッジが表示されること", () => {
    renderRow({ ...BASE_EVENT, attendanceStatus: "ABSENT" });

    expect(screen.getByText("欠席")).toBeInTheDocument();
  });

  it("未マーク（null）の場合、出席/欠席と区別できる「未マーク」表示になること", () => {
    renderRow({ ...BASE_EVENT, attendanceStatus: null });

    expect(screen.getByText("未マーク")).toBeInTheDocument();
    expect(screen.queryByText("出席")).not.toBeInTheDocument();
    expect(screen.queryByText("欠席")).not.toBeInTheDocument();
  });
});
