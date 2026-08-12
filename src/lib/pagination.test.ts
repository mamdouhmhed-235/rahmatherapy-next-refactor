import { describe, expect, it } from "vitest";
import {
  LIST_PAGE_SIZE,
  LOG_PAGE_SIZE,
  clampPage,
  pageRange,
  paginateInMemory,
} from "./pagination";

describe("clampPage", () => {
  it("clamps 0 to page 1", () => {
    expect(clampPage(0, 10)).toBe(1);
  });

  it("clamps a negative page to page 1", () => {
    expect(clampPage(-5, 10)).toBe(1);
  });

  it("clamps NaN to page 1", () => {
    expect(clampPage(Number.NaN, 10)).toBe(1);
  });

  it("clamps a non-numeric string to page 1", () => {
    expect(clampPage("abc", 10)).toBe(1);
  });

  it("defaults undefined to page 1", () => {
    expect(clampPage(undefined, 10)).toBe(1);
  });

  it("clamps a value far beyond pageCount down to the last page", () => {
    expect(clampPage(9999, 10)).toBe(10);
  });

  it("passes through an in-range page unchanged", () => {
    expect(clampPage(5, 10)).toBe(5);
  });

  it("accepts a numeric-looking string", () => {
    expect(clampPage("3", 10)).toBe(3);
  });

  it("never returns 0 when pageCount itself is 0 (empty list, 1 page)", () => {
    // Per the plan: a 0-row list must still resolve to pageCount = 1 upstream
    // (e.g. Math.max(1, Math.ceil(total / pageSize))), and clampPage must
    // clamp any bookmarked page into that single page rather than 0.
    const pageCount = Math.max(1, Math.ceil(0 / LIST_PAGE_SIZE));
    expect(pageCount).toBe(1);
    expect(clampPage(1, pageCount)).toBe(1);
    expect(clampPage(99, pageCount)).toBe(1);
    expect(clampPage(0, pageCount)).toBe(1);
  });
});

describe("pageRange", () => {
  it("computes the range for page 1", () => {
    expect(pageRange(1, 25)).toEqual({ from: 0, to: 24 });
  });

  it("computes the range for page 2", () => {
    expect(pageRange(2, 25)).toEqual({ from: 25, to: 49 });
  });

  it("computes the range for an arbitrary later page", () => {
    expect(pageRange(7, 25)).toEqual({ from: 150, to: 174 });
  });

  it("computes the range using LOG_PAGE_SIZE", () => {
    expect(pageRange(3, LOG_PAGE_SIZE)).toEqual({ from: 200, to: 299 });
  });
});

describe("paginateInMemory", () => {
  const rows = Array.from({ length: 57 }, (_, i) => `r${i}`);

  it("returns the first window and the true total", () => {
    const result = paginateInMemory(rows, undefined, 25);
    expect(result.page).toBe(1);
    expect(result.pageCount).toBe(3);
    expect(result.total).toBe(57);
    expect(result.rows).toHaveLength(25);
    expect(result.rows[0]).toBe("r0");
  });

  it("returns a middle window without overlapping the first", () => {
    expect(paginateInMemory(rows, "2", 25).rows[0]).toBe("r25");
  });

  it("returns the short final window rather than padding it", () => {
    const result = paginateInMemory(rows, "3", 25);
    expect(result.rows).toHaveLength(7);
    expect(result.rows.at(-1)).toBe("r56");
  });

  it("clamps a bookmarked page beyond the end onto the last page", () => {
    // The therapist case that motivated this: filtering shrinks the set under
    // a `?page=` that was valid a moment ago, and an unclamped slice would
    // render an empty list that looks like "you have no bookings".
    const result = paginateInMemory(rows, "99", 25);
    expect(result.page).toBe(3);
    expect(result.rows).toHaveLength(7);
  });

  it("reports one page for an empty set, so the pager stays hidden", () => {
    const result = paginateInMemory([], "4", 25);
    expect(result).toEqual({ rows: [], total: 0, page: 1, pageCount: 1 });
  });

  it("does not mutate the array it is given", () => {
    const original = [...rows];
    paginateInMemory(rows, "2", 25);
    expect(rows).toEqual(original);
  });
});

describe("page-size constants", () => {
  it("fixes LIST_PAGE_SIZE at 25", () => {
    expect(LIST_PAGE_SIZE).toBe(25);
  });

  it("fixes LOG_PAGE_SIZE at 100 (matching AUDIT_PAGE_SIZE)", () => {
    expect(LOG_PAGE_SIZE).toBe(100);
  });
});
