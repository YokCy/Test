import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MyStatsResponse } from "../api";

import { StatsSummary } from "./StatsSummary";

describe("StatsSummary", () => {
  it("累計参加数・出席率・カテゴリ別集計がレスポンスの値のまま表示されること", () => {
    const stats: MyStatsResponse = {
      totalParticipations: 12,
      attendanceRate: 0.75,
      byCategory: [
        { category: "勉強会", count: 5 },
        { category: "懇親会", count: 3 },
      ],
    };

    render(<StatsSummary stats={stats} />);

    expect(screen.getByText(/累計参加数: 12件/)).toBeInTheDocument();
    expect(screen.getByText(/出席率: 75%/)).toBeInTheDocument();
    expect(screen.getByText(/勉強会5.*懇親会3/)).toBeInTheDocument();
  });

  it("attendanceRateがnullの場合、NaN%や0%ではなく代替表示（―）になること", () => {
    const stats: MyStatsResponse = {
      totalParticipations: 0,
      attendanceRate: null,
      byCategory: [],
    };

    render(<StatsSummary stats={stats} />);

    expect(screen.getByText(/出席率: ―/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/出席率: 0%/)).not.toBeInTheDocument();
  });

  it("カテゴリ別集計が0件の場合、「データなし」表示になること", () => {
    const stats: MyStatsResponse = {
      totalParticipations: 0,
      attendanceRate: null,
      byCategory: [],
    };

    render(<StatsSummary stats={stats} />);

    expect(screen.getByText("カテゴリ別: データなし")).toBeInTheDocument();
  });
});
