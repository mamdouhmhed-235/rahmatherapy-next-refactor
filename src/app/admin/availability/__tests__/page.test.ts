// C-14 — pure helpers behind the availability page's multi-row (segments)
// consumers: the weekly capacity strip's per-day rule rendering and the
// week-adjustments map. Guards the defect this plan fixed — a day/date with
// more than one stored row must render every segment, not just whichever
// one `.find()` / last-row-wins happened to keep.
import { describe, expect, it } from "vitest";
import {
  formatSegments,
  groupOverridesByDate,
  resolveWeekdayRule,
} from "../page";

function rule(
  overrides: Partial<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_working_day: boolean;
  }> = {}
) {
  return {
    id: "id",
    day_of_week: 1,
    start_time: "09:00:00",
    end_time: "18:00:00",
    is_working_day: true,
    ...overrides,
  };
}

function override(
  overrides: Partial<{
    id: string;
    override_date: string;
    start_time: string;
    end_time: string;
    reason: string | null;
  }> = {}
) {
  return {
    id: "id",
    override_date: "2026-08-10",
    start_time: "09:00:00",
    end_time: "18:00:00",
    reason: null,
    ...overrides,
  };
}

describe("formatSegments", () => {
  it("formats a single segment", () => {
    expect(
      formatSegments([{ start_time: "08:00:00", end_time: "20:00:00" }])
    ).toBe("08:00–20:00");
  });

  it("joins multiple segments with ' · ', sorted by start time regardless of input order", () => {
    const segments = [
      { start_time: "15:00:00", end_time: "20:00:00" },
      { start_time: "08:00:00", end_time: "12:30:00" },
    ];
    expect(formatSegments(segments)).toBe("08:00–12:30 · 15:00–20:00");
  });

  it("returns an empty string for no segments", () => {
    expect(formatSegments([])).toBe("");
  });
});

describe("resolveWeekdayRule", () => {
  it("a single-segment working day (no break)", () => {
    const rows = [rule({ start_time: "08:00:00", end_time: "20:00:00" })];
    const result = resolveWeekdayRule(rows, 1);
    expect(result.isOpen).toBe(true);
    expect(formatSegments(result.segments)).toBe("08:00–20:00");
  });

  it("a two-segment working day (one break)", () => {
    const rows = [
      rule({ id: "a", start_time: "08:00:00", end_time: "12:30:00" }),
      rule({ id: "b", start_time: "15:00:00", end_time: "20:00:00" }),
    ];
    const result = resolveWeekdayRule(rows, 1);
    expect(result.isOpen).toBe(true);
    expect(formatSegments(result.segments)).toBe("08:00–12:30 · 15:00–20:00");
  });

  it("a three-segment working day (two breaks), independent of query row order", () => {
    const rows = [
      rule({ id: "c", start_time: "16:00:00", end_time: "20:00:00" }),
      rule({ id: "a", start_time: "08:00:00", end_time: "10:00:00" }),
      rule({ id: "b", start_time: "10:30:00", end_time: "13:00:00" }),
    ];
    const result = resolveWeekdayRule(rows, 1);
    expect(result.isOpen).toBe(true);
    expect(formatSegments(result.segments)).toBe(
      "08:00–10:00 · 10:30–13:00 · 16:00–20:00"
    );
  });

  it("a closed day — the memo row keeps hours but is not a bookable segment", () => {
    const rows = [
      rule({
        is_working_day: false,
        start_time: "09:00:00",
        end_time: "18:00:00",
      }),
    ];
    const result = resolveWeekdayRule(rows, 1);
    expect(result.isOpen).toBe(false);
    expect(result.segments).toEqual([]);
  });

  it("only reads rows for the requested weekday", () => {
    const rows = [
      rule({ id: "mon", day_of_week: 1 }),
      rule({
        id: "tue",
        day_of_week: 2,
        start_time: "10:00:00",
        end_time: "16:00:00",
      }),
    ];
    const result = resolveWeekdayRule(rows, 2);
    expect(formatSegments(result.segments)).toBe("10:00–16:00");
  });
});

describe("groupOverridesByDate", () => {
  it("a date with two override segments groups without last-row-wins loss", () => {
    const rows = [
      override({
        id: "a",
        start_time: "15:00:00",
        end_time: "20:00:00",
      }),
      override({
        id: "b",
        start_time: "08:00:00",
        end_time: "12:30:00",
      }),
    ];
    const result = groupOverridesByDate(rows);
    const segments = result.get("2026-08-10");
    expect(segments).toHaveLength(2);
    expect(formatSegments(segments!)).toBe("08:00–12:30 · 15:00–20:00");
  });

  it("keeps different dates separate", () => {
    const rows = [
      override({ id: "a", override_date: "2026-08-10" }),
      override({ id: "b", override_date: "2026-08-11" }),
    ];
    const result = groupOverridesByDate(rows);
    expect(result.size).toBe(2);
  });
});
