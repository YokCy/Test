import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { UpcomingItem } from "../api";

import { UpcomingEventRow } from "./UpcomingEventRow";

const BASE_EVENT: UpcomingItem = {
  id: "event_1",
  title: "参加予定イベントA",
  startAt: "2026-10-01T10:00:00.000Z",
  category: { id: "cat_1", name: "勉強会" },
  status: "CONFIRMED",
  position: null,
};

function renderRow(event: UpcomingItem) {
  return render(
    <MemoryRouter>
      <UpcomingEventRow event={event} />
    </MemoryRouter>,
  );
}

describe("UpcomingEventRow", () => {
  it("formatEventDateTimeによるフォーマット済み日時が表示されること", () => {
    renderRow(BASE_EVENT);

    expect(screen.getByText(/10\/01\(木\)19:00〜/)).toBeInTheDocument();
  });

  it("参加確定（CONFIRMED）の場合、「参加確定」バッジが表示されること", () => {
    renderRow(BASE_EVENT);

    expect(screen.getByText("参加確定")).toBeInTheDocument();
  });

  it("キャンセル待ちでposition指定ありの場合、順位付きのバッジが表示されること", () => {
    renderRow({ ...BASE_EVENT, status: "WAITLISTED", position: 2 });

    expect(screen.getByText("キャンセル待ち 2番目")).toBeInTheDocument();
  });

  it("キャンセル待ちでposition未指定（null）の場合、順位無しのバッジが表示されること", () => {
    renderRow({ ...BASE_EVENT, status: "WAITLISTED", position: null });

    expect(screen.getByText("キャンセル待ち")).toBeInTheDocument();
  });
});
