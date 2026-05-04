import { describe, expect, it } from "vitest";
import {
  getBusinessDate,
  getBusinessDayOfWeek,
  isOutsideMinimumNotice,
  toBusinessDateTime,
} from "./london";

describe("Europe/London time helpers", () => {
  it("uses London calendar date rather than server UTC date", () => {
    expect(getBusinessDate(new Date("2026-05-03T23:30:00.000Z"))).toBe(
      "2026-05-04"
    );
  });

  it("converts summer business time with BST offset", () => {
    expect(toBusinessDateTime("2026-06-01", "10:00").toISOString()).toBe(
      "2026-06-01T09:00:00.000Z"
    );
  });

  it("converts winter business time without BST offset", () => {
    expect(toBusinessDateTime("2026-01-15", "10:00").toISOString()).toBe(
      "2026-01-15T10:00:00.000Z"
    );
  });

  it("compares minimum notice using London-local requested time", () => {
    expect(
      isOutsideMinimumNotice({
        date: "2026-06-01",
        time: "10:00",
        now: new Date("2026-06-01T06:30:00.000Z"),
        minimumNoticeHours: 2,
      })
    ).toBe(true);

    expect(
      isOutsideMinimumNotice({
        date: "2026-06-01",
        time: "10:00",
        now: new Date("2026-06-01T08:30:00.000Z"),
        minimumNoticeHours: 2,
      })
    ).toBe(false);
  });

  it("keeps day-of-week stable across runtime timezones", () => {
    expect(getBusinessDayOfWeek("2026-06-01")).toBe(1);
  });
});
