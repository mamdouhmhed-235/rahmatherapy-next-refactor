import { describe, expect, it } from "vitest";
import { LIST_PAGE_SIZE, LOG_PAGE_SIZE, clampPage, pageRange } from "./pagination";

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

describe("page-size constants", () => {
  it("fixes LIST_PAGE_SIZE at 25", () => {
    expect(LIST_PAGE_SIZE).toBe(25);
  });

  it("fixes LOG_PAGE_SIZE at 100 (matching AUDIT_PAGE_SIZE)", () => {
    expect(LOG_PAGE_SIZE).toBe(100);
  });
});
