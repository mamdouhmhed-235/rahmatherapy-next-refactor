import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { AvailabilityOverridesManager } from "./AvailabilityOverridesManager";
import { AvailabilityRulesManager } from "./AvailabilityRulesManager";
import { BlockedDatesManager } from "./BlockedDatesManager";

export const metadata = {
  title: "Availability - Rahma Therapy Admin",
};

export default async function AvailabilityPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!profile.permissions.has(PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL)) {
    return (
      <div>
        <h1 className="mb-2 font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
          Availability
        </h1>
        <div
          className="mt-6 rounded-2xl border bg-white px-6 py-8 text-center"
          style={{ borderColor: "var(--rahma-border)" }}
        >
          <ShieldCheck className="mx-auto mb-3 size-8 text-[var(--rahma-muted)]" />
          <p className="font-medium text-[var(--rahma-charcoal)]">
            Insufficient permissions
          </p>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            You need the{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              manage_availability_global
            </code>{" "}
            permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  const [rulesResult, blockedDatesResult, overridesResult] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("*")
      .order("day_of_week", { ascending: true }),
    supabase
      .from("blocked_dates")
      .select("*")
      .order("blocked_date", { ascending: true }),
    supabase
      .from("availability_overrides")
      .select("*")
      .order("override_date", { ascending: true }),
  ]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
          Availability
        </h1>
        <p className="mt-1 text-sm text-[var(--rahma-muted)]">
          Manage global working days, blocked dates, and date-specific hours
          used by booking rules.
        </p>
      </div>

      <div className="grid gap-6">
        <AvailabilityRulesManager initialRules={rulesResult.data ?? []} />
        <BlockedDatesManager blockedDates={blockedDatesResult.data ?? []} />
        <AvailabilityOverridesManager overrides={overridesResult.data ?? []} />
      </div>
    </div>
  );
}
