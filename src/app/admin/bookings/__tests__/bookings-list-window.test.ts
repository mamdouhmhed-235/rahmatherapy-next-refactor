// ITEM K.1 — which rows the reader sees, and what the pager says about them.
//
// The paging ARITHMETIC is covered by `paginateInMemory` in
// src/lib/pagination.test.ts. What is covered here is the CHOICE between the
// two branches, which used to be four independent ternaries in page.tsx (the
// rows, then `page`, `pageCount` and `total` on PaginationBar). Any one of
// them could be flipped alone and every suite stayed green — a therapist would
// silently get the clinic-wide branch's `pageCount: 1` back and lose page 2,
// or a manager's already-windowed page would be sliced a second time.
import { describe, expect, it } from "vitest";
import { LIST_PAGE_SIZE } from "@/lib/pagination";
import { resolveBookingsWindow } from "../page";
import type { BookingsListPage } from "../bookings-list-data";
import type { BookingRecord } from "../types";

const rows = (n: number, prefix = "r") =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }) as BookingRecord);

/** What `getBookingsListPage` returns for the therapist-scoped branch. */
const scopedListPage = (all: BookingRecord[]): BookingsListPage => ({
  rows: all,
  total: all.length,
  page: 1,
  pageCount: 1,
});

describe("resolveBookingsWindow — clinic-wide", () => {
  it("passes the SQL-windowed page straight through, unsliced", () => {
    // 25 rows are one full page of a 90-row result set on page 3. Slicing them
    // again would leave page 3 showing rows 1-25 of its own 25.
    const page3 = rows(LIST_PAGE_SIZE);
    const listPage: BookingsListPage = {
      rows: page3,
      total: 90,
      page: 3,
      pageCount: 4,
    };

    const result = resolveBookingsWindow({
      canViewAll: true,
      rows: page3,
      listPage,
      rawPage: "3",
    });

    expect(result.rows).toHaveLength(LIST_PAGE_SIZE);
    expect(result.rows[0].id).toBe("r0");
    expect({ page: result.page, pageCount: result.pageCount, total: result.total }).toEqual({
      page: 3,
      pageCount: 4,
      total: 90,
    });
  });

  it("ignores `?page=` entirely — the data layer already applied it", () => {
    const listPage: BookingsListPage = { rows: rows(5), total: 90, page: 3, pageCount: 4 };

    // A stale or hostile value must not re-window a set that was windowed and
    // counted by the same predicate plan in SQL.
    for (const rawPage of ["1", "99", "abc", undefined]) {
      const result = resolveBookingsWindow({ canViewAll: true, rows: rows(5), listPage, rawPage });
      expect({ page: result.page, pageCount: result.pageCount }).toEqual({ page: 3, pageCount: 4 });
      expect(result.rows).toHaveLength(5);
    }
  });
});

describe("resolveBookingsWindow — therapist-scoped", () => {
  const all = rows(60);

  it("windows the post-oracle set instead of trusting `pageCount: 1`", () => {
    const result = resolveBookingsWindow({
      canViewAll: false,
      rows: all,
      listPage: scopedListPage(all),
      rawPage: "2",
    });

    expect(result.rows).toHaveLength(LIST_PAGE_SIZE);
    expect(result.rows[0].id).toBe("r25");
    expect({ page: result.page, pageCount: result.pageCount, total: result.total }).toEqual({
      page: 2,
      pageCount: 3,
      total: 60,
    });
  });

  it("counts the set the reader is paging, not the rows on screen", () => {
    // `total` is 60 while only 25 render — this is what makes the pager read
    // "Showing 1-25 of 60" rather than "of 25".
    const result = resolveBookingsWindow({
      canViewAll: false,
      rows: all,
      listPage: scopedListPage(all),
      rawPage: undefined,
    });

    expect(result.total).toBe(60);
    expect(result.rows).toHaveLength(LIST_PAGE_SIZE);
  });

  it("clamps a page past the end rather than rendering an empty list", () => {
    const result = resolveBookingsWindow({
      canViewAll: false,
      rows: all,
      listPage: scopedListPage(all),
      rawPage: "99",
    });

    expect(result.page).toBe(3);
    expect(result.rows).toHaveLength(10);
  });

  it("reports a single page when the set fits on one", () => {
    const short = rows(4);
    const result = resolveBookingsWindow({
      canViewAll: false,
      rows: short,
      listPage: scopedListPage(short),
      rawPage: undefined,
    });

    // PaginationBar renders nothing at one page — pinned so the therapist
    // branch cannot start showing a pager to a four-row list.
    expect({ page: result.page, pageCount: result.pageCount, total: result.total }).toEqual({
      page: 1,
      pageCount: 1,
      total: 4,
    });
  });
});

describe("the two branches cannot be swapped", () => {
  it("disagree on the same inputs, so flipping the flag is observable", () => {
    // The regression this file exists to catch: if `canViewAll` stopped being
    // consulted, one of these two would silently become the other.
    const all = rows(60);
    const listPage: BookingsListPage = { rows: all, total: 200, page: 4, pageCount: 8 };

    const wide = resolveBookingsWindow({ canViewAll: true, rows: all, listPage, rawPage: "2" });
    const scoped = resolveBookingsWindow({ canViewAll: false, rows: all, listPage, rawPage: "2" });

    expect(wide.rows).toHaveLength(60);
    expect(scoped.rows).toHaveLength(LIST_PAGE_SIZE);
    expect(wide.total).toBe(200);
    expect(scoped.total).toBe(60);
    expect(wide.pageCount).toBe(8);
    expect(scoped.pageCount).toBe(3);
  });
});
