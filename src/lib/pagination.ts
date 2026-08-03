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
