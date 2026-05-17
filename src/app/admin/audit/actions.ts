"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import type { ActionFamily, DateRangePresetKey } from "./format";

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

export interface AuditPage {
  rows: AuditEventRow[];
  nextCursor: string | null;
  totalEstimate: number | null;
}

// FAKE: BUILD-audit-filter-and-pagination
// The full cursor + filter implementation is gated on backend plan
// `BUILD-audit-filter-and-pagination.md`. Until that lands, this action:
//   1. Reads the next page from `audit_logs` ordered by created_at DESC.
//   2. Uses a `created_at` cursor (the last row's timestamp from the prior page).
//   3. Ignores filter params (server returns the unfiltered top-100 slice).
// The component layer surfaces filters as deep-linkable URL params and a chip strip;
// once the BUILD plan lands, this action wires filter params into the query.
export async function auditLoadMore({
  cursor,
}: {
  filters: AuditFilters;
  cursor: string | null;
}): Promise<AuditPage> {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active || !profile.permissions.has(PERMISSIONS.MANAGE_AUDIT_LOGS)) {
    return { rows: [], nextCursor: null, totalEstimate: null };
  }

  const adminClient = createSupabaseAdminClient();
  const query = adminClient
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (cursor) {
    query.lt("created_at", cursor);
  }

  const { data } = await query.returns<AuditEventRow[]>();
  const rows = data ?? [];
  const nextCursor = rows.length === 100 ? rows[rows.length - 1].created_at : null;

  return { rows, nextCursor, totalEstimate: null };
}
