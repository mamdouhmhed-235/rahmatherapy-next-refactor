"use server";

// B-2 — Reports Insights stripe persistent dismissal.
//
// Writes a row to public.insight_dismissals (created in migration
// 20260522122000) so the dismissed insight stays hidden across reloads + sessions.
// Mirrors the auth + admin-client pattern from staff/[staffId]/availability/actions.ts:
// authenticate via getStaffProfile() then write through createSupabaseAdminClient()
// with manual staff_id scoping (RLS still enforces app_private.current_active_staff_id()
// when authenticated clients write, but the admin client bypasses RLS — explicit
// scoping in code is the safety net).
//
// Plan: redesign/plans/B-phase/B2-metric-backend-plan.md (step 6).

import { revalidatePath, updateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/rbac";

export interface DismissInsightResult {
  success?: boolean;
  error?: string;
}

export async function dismissInsight(insightId: string): Promise<DismissInsightResult> {
  if (!insightId || typeof insightId !== "string") {
    return { error: "Insight ID required." };
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile) return { error: "Sign in to dismiss insights." };
  if (!profile.active) return { error: "Inactive accounts cannot dismiss insights." };

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("insight_dismissals")
    .insert({ staff_id: profile.id, insight_id: insightId });

  // 23505 = unique_violation. Idempotent: a re-dismiss is success, not error.
  if (error && error.code !== "23505") {
    return { error: error.message };
  }

  // Next 16: updateTag for read-your-own-writes inside server actions; the
  // page revalidation path remains explicit so the /admin/reports route gets
  // a fresh render after the dismiss insert.
  updateTag("report-data");
  revalidatePath("/admin/reports");
  return { success: true };
}
