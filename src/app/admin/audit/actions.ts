"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import {
  fetchAuditPage,
  type AuditCursor,
  type AuditEventRow,
  type AuditFilters,
  type AuditPage,
} from "./queries";

export type { AuditCursor, AuditEventRow, AuditFilters, AuditPage };

export async function auditLoadMore({
  filters,
  cursor,
}: {
  filters: AuditFilters;
  cursor: AuditCursor | null;
}): Promise<AuditPage> {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (
    !profile ||
    !profile.active ||
    !profile.permissions.has(PERMISSIONS.MANAGE_AUDIT_LOGS)
  ) {
    return { rows: [], nextCursor: null };
  }
  return fetchAuditPage({ filters, cursor });
}
