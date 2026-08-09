import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addBusinessDays,
  getBookingDateBounds,
  getBusinessDate,
  getBusinessDayOfWeek,
  isDateInBusinessWindow,
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

// C-14 Phase D. The picker and the server must accept exactly the same set of
// dates, so both now derive from getBookingDateBounds. These pin the boundary
// arithmetic and prove the isDateInBusinessWindow refactor changed nothing.
describe("getBookingDateBounds", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("makes `latest` today + bookingWindowDays, inclusive", () => {
    // Live business_settings value at time of writing: booking_window_days=29.
    expect(
      getBookingDateBounds({
        now: new Date("2026-08-09T09:00:00.000Z"),
        bookingWindowDays: 29,
      })
    ).toEqual({ earliest: "2026-08-09", latest: "2026-09-07" });
  });

  it("counts the window from the London date, not the server's UTC date", () => {
    // 23:30Z on 8 Aug is already 9 Aug in BST — the window must start there.
    expect(
      getBookingDateBounds({
        now: new Date("2026-08-08T23:30:00.000Z"),
        bookingWindowDays: 29,
      })
    ).toEqual({ earliest: "2026-08-09", latest: "2026-09-07" });
  });

  it("defaults `earliest` to today when no minimum notice is given", () => {
    const { earliest } = getBookingDateBounds({
      now: new Date("2026-08-09T22:59:00.000Z"),
      bookingWindowDays: 29,
    });

    expect(earliest).toBe("2026-08-09");
  });

  it("keeps today bookable while the notice still fits inside it", () => {
    // 09:00 London + 4h = 13:00 the same day.
    expect(
      getBookingDateBounds({
        now: new Date("2026-08-09T08:00:00.000Z"),
        bookingWindowDays: 29,
        minimumNoticeHours: 4,
      }).earliest
    ).toBe("2026-08-09");
  });

  it("pushes `earliest` to tomorrow once the notice crosses midnight", () => {
    // 22:30 London + 4h = 02:30 the next day.
    expect(
      getBookingDateBounds({
        now: new Date("2026-08-09T21:30:00.000Z"),
        bookingWindowDays: 29,
        minimumNoticeHours: 4,
      }).earliest
    ).toBe("2026-08-10");
  });

  it("applies the notice floor in London time across the BST→GMT change", () => {
    // 2026-10-25 is the clock change: 00:30 BST + 4h lands at 03:30 GMT the
    // same London day, because the hour 01:00–02:00 happens twice.
    expect(
      getBookingDateBounds({
        now: new Date("2026-10-24T23:30:00.000Z"),
        bookingWindowDays: 29,
        minimumNoticeHours: 4,
      })
    ).toEqual({ earliest: "2026-10-25", latest: "2026-11-23" });
  });

  it("reads the clock when `now` is omitted", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-09T09:00:00.000Z"));

    expect(getBookingDateBounds({ bookingWindowDays: 29 })).toEqual({
      earliest: "2026-08-09",
      latest: "2026-09-07",
    });
  });
});

describe("isDateInBusinessWindow", () => {
  const now = new Date("2026-08-09T09:00:00.000Z");

  it("accepts today and the last day of the window, and nothing outside", () => {
    const inWindow = (date: string) =>
      isDateInBusinessWindow({ date, now, bookingWindowDays: 29 });

    expect(inWindow("2026-08-08")).toBe(false); // yesterday
    expect(inWindow("2026-08-09")).toBe(true); // today
    expect(inWindow("2026-09-07")).toBe(true); // today + 29, the last one
    expect(inWindow("2026-09-08")).toBe(false); // one past the window
  });

  it("is unchanged by the refactor — matches the pre-refactor algorithm", () => {
    // The exact two lines isDateInBusinessWindow held before it started
    // deriving from getBookingDateBounds.
    const legacy = ({
      date,
      now: at,
      bookingWindowDays,
    }: {
      date: string;
      now: Date;
      bookingWindowDays: number;
    }) => {
      const today = getBusinessDate(at);
      const lastBookableDate = addBusinessDays(today, bookingWindowDays);
      return date >= today && date <= lastBookableDate;
    };

    const instants = [
      "2026-08-09T09:00:00.000Z", // mid-morning BST
      "2026-08-08T23:30:00.000Z", // already tomorrow in London
      "2026-10-24T23:30:00.000Z", // BST→GMT change
      "2026-01-15T00:30:00.000Z", // GMT, just after midnight
      "2026-12-31T23:00:00.000Z", // year rollover in London
    ].map((value) => new Date(value));

    for (const at of instants) {
      for (const bookingWindowDays of [0, 1, 29, 30, 365]) {
        for (let offset = -2; offset <= 33; offset += 1) {
          const date = addBusinessDays(getBusinessDate(at), offset);
          expect({
            date,
            offset,
            bookingWindowDays,
            result: isDateInBusinessWindow({ date, now: at, bookingWindowDays }),
          }).toEqual({
            date,
            offset,
            bookingWindowDays,
            result: legacy({ date, now: at, bookingWindowDays }),
          });
        }
      }
    }
  });
});
