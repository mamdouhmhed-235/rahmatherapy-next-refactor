// Server-only audit log query. Used by both the initial render in page.tsx
// and the auditLoadMore server action so the filter pipeline stays in one
// place. The query runs against the admin client (RLS bypass) — permission
// is enforced upstream at the page level (manage_audit_logs).
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  ACTION_TYPES_BY_FAMILY,
  type ActionFamily,
  type DateRangePresetKey,
} from "./format";

export const AUDIT_PAGE_SIZE = 100;

export interface AuditEventRow {
  id: string;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  actor_staff_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditFilters {
  q?: string;
  actor?: string;
  family?: ActionFamily;
  target_type?: string;
  range?: DateRangePresetKey;
  from?: string;
  to?: string;
}

export interface AuditCursor {
  created_at: string;
  id: string;
}

export interface AuditPage {
  rows: AuditEventRow[];
  nextCursor: AuditCursor | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function dayMs(n: number) {
  return n * 24 * 60 * 60 * 1000;
}

// Resolves a filter `range` preset + optional from/to into ISO timestamp
// boundaries. Returns `{ fromTs?, toTs? }` — both omitted means "lifetime".
//
// `from` / `to` are inclusive YYYY-MM-DD day boundaries when range='custom'.
// The "to" timestamp is the end of that day (next-day 00:00 exclusive).
function resolveDateBoundaries(filters: AuditFilters): {
  fromTs?: string;
  toTs?: string;
} {
  const now = Date.now();
  switch (filters.range) {
    case "today":
      return { fromTs: new Date(now - dayMs(1)).toISOString() };
    case "this_week":
      return { fromTs: new Date(now - dayMs(7)).toISOString() };
    case "this_month":
      return { fromTs: new Date(now - dayMs(30)).toISOString() };
    case "last_30_days":
      return { fromTs: new Date(now - dayMs(30)).toISOString() };
    case "custom": {
      const fromTs =
        filters.from && !Number.isNaN(new Date(filters.from).getTime())
          ? new Date(filters.from).toISOString()
          : undefined;
      const toTs =
        filters.to && !Number.isNaN(new Date(filters.to).getTime())
          ? new Date(new Date(filters.to).getTime() + dayMs(1)).toISOString()
          : undefined;
      // Swap silently if the operator inverted the range.
      if (fromTs && toTs && fromTs > toTs) {
        return { fromTs: toTs, toTs: fromTs };
      }
      return { fromTs, toTs };
    }
    default:
      return {};
  }
}

export async function fetchAuditPage({
  filters,
  cursor,
}: {
  filters: AuditFilters;
  cursor: AuditCursor | null;
}): Promise<AuditPage> {
  const adminClient = createSupabaseAdminClient();
  let query = adminClient
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(AUDIT_PAGE_SIZE);

  // Family expansion: only narrow when the family has known action types.
  // Unknown / empty families would produce `IN ()` (a Postgres syntax error
  // via Supabase JS), so guard with `length > 0`.
  if (filters.family) {
    const actionTypes = ACTION_TYPES_BY_FAMILY[filters.family];
    if (actionTypes.length > 0) {
      query = query.in("action_type", actionTypes);
    }
  }

  // Actor filter: ignore non-UUID values rather than letting Postgres throw.
  if (filters.actor && isUuid(filters.actor)) {
    query = query.eq("actor_staff_id", filters.actor);
  }

  if (filters.target_type) {
    query = query.eq("target_type", filters.target_type);
  }

  // ID lookup across id / target_id / actor_staff_id. Postgres won't apply
  // `ilike` to a uuid column (no operator), and PostgREST has no cast syntax
  // in filter params — so we restrict the search to *full* UUIDs and do an
  // exact-equality match across the three columns. A short prefix is no-op
  // (returns the unfiltered set) rather than erroring; the 4-char client-side
  // guard surfaces "keep typing" UX before submission anyway.
  if (filters.q && isUuid(filters.q)) {
    query = query.or(
      `id.eq.${filters.q},target_id.eq.${filters.q},actor_staff_id.eq.${filters.q}`
    );
  }

  const { fromTs, toTs } = resolveDateBoundaries(filters);
  if (fromTs) {
    query = query.gte("created_at", fromTs);
  }
  if (toTs) {
    query = query.lt("created_at", toTs);
  }

  // Compound cursor on (created_at, id) — tie-safe pagination. Postgres
  // ORDER BY both DESC then WHERE created_at < $1 OR (created_at = $1 AND
  // id < $2). Supabase JS expresses the OR via .or() with embedded and(...).
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query.returns<AuditEventRow[]>();
  if (error) {
    console.error("fetchAuditPage supabase error:", error);
    return { rows: [], nextCursor: null };
  }
  const rows = data ?? [];
  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === AUDIT_PAGE_SIZE && last
      ? { created_at: last.created_at, id: last.id }
      : null;

  return { rows, nextCursor };
}
