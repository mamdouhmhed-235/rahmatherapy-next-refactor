"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import {
  fetchAuditPage,
  type AuditCursor,
  type AuditFilters,
  type AuditPage,
} from "./queries";

// ⛔ F-SCALE-04. There was a `export type { AuditCursor, AuditEventRow,
// AuditFilters, AuditPage };` here, re-exporting IMPORTED type names from a
// "use server" module. Types are erased at compile time, but the server-actions
// transform still emitted them as runtime exports — the built chunk carried
// `ensureServerEntryExports([…, AuditCursor, …])` — so evaluating the module
// threw `ReferenceError: AuditCursor is not defined` and every "Load more"
// click returned 500 with nothing shown to the user.
//
// ⚠️ It only failed in a PRODUCTION build, which is why `tsc` and the unit
// suite were both green while the button was completely dead.
//
// ⛔ A "use server" file may only export async functions. Consumers now import
// these types straight from `./queries`, which is where they are declared.

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
