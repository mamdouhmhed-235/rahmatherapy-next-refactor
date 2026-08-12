// Shared pagination primitives (C-16 Phase B). Two page-size constants plus
// the clamp/range math every list surface needs — no generic query wrapper:
// Supabase builders don't compose generically without type loss, so each
// surface runs its filtered query twice (count: "exact", head: true for the
// total; .range(from, to) for the rows) through these helpers directly.

export const LIST_PAGE_SIZE = 25; // row-card lists
export const LOG_PAGE_SIZE = 100; // dense log-style tables (matches AUDIT_PAGE_SIZE)

export interface PaginatedResult<T> {
  rows: T[];
  total: number;
  page: number; // 1-based, clamped
  pageCount: number; // >= 1
}

export function clampPage(rawPage: unknown, pageCount: number): number {
  const n = Number.parseInt(String(rawPage ?? "1"), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, pageCount));
}

export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/**
 * The same clamp/range math against rows already in memory (ITEM K.1).
 *
 * Most surfaces window in SQL and never need this. A surface needs it when its
 * final predicate cannot be expressed in SQL — `/admin/bookings`' therapist
 * branch is the case that forced it: its view rule is a JS oracle over merged
 * reads, so the window can only be taken after that oracle has run, and a
 * window taken any earlier is a window of the wrong set.
 *
 * `total` is the size of the set the caller passes in, so it describes the rows
 * the reader is paging through rather than the table behind them.
 */
export function paginateInMemory<T>(
  rows: readonly T[],
  rawPage: unknown,
  pageSize: number
): PaginatedResult<T> {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = clampPage(rawPage, pageCount);
  const { from, to } = pageRange(page, pageSize);
  return { rows: rows.slice(from, to + 1), total: rows.length, page, pageCount };
}
