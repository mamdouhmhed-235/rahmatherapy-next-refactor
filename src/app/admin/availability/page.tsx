import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { AdminAccessDenied } from "../components/admin-ui";
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
      <AdminAccessDenied
        title="Availability access limited"
        message="You need global availability permission to access this page."
        permission="manage_availability_global"
      />
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
  const [
    staffResult,
    staffRulesResult,
    staffBlockedResult,
    staffOverridesResult,
  ] = await Promise.all([
    supabase
      .from("staff_profiles")
      .select("id, name, gender, active, can_take_bookings, availability_mode")
      .order("name"),
    supabase.from("staff_availability_rules").select("staff_id"),
    supabase.from("staff_blocked_dates").select("staff_id"),
    supabase.from("staff_availability_overrides").select("staff_id"),
  ]);
  const staffRules = new Set((staffRulesResult.data ?? []).map((row) => row.staff_id));
  const staffBlocked = new Set((staffBlockedResult.data ?? []).map((row) => row.staff_id));
  const staffOverrides = new Set((staffOverridesResult.data ?? []).map((row) => row.staff_id));
  const bookingStaff = (staffResult.data ?? []).filter(
    (staff) => staff.active && staff.can_take_bookings
  );
  const maleCapacity = bookingStaff.filter((staff) => staff.gender === "male").length;
  const femaleCapacity = bookingStaff.filter((staff) => staff.gender === "female").length;

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
        <section className="grid gap-4 rounded-lg border border-[var(--rahma-border)] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
                Weekly capacity preview
              </h2>
              <p className="mt-1 text-sm text-[var(--rahma-muted)]">
                Global hours, blocked dates, overrides, and staff booking capacity at a glance.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <CapacityPill label="Male" value={maleCapacity} />
              <CapacityPill label="Female" value={femaleCapacity} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-7">
            {Array.from({ length: 7 }, (_, day) => {
              const dayRules = (rulesResult.data ?? []).filter(
                (rule) => rule.day_of_week === day
              );
              return (
                <div
                  key={day}
                  className="rounded-lg border border-[var(--rahma-border)] bg-[var(--rahma-ivory)]/60 p-3 text-sm"
                >
                  <p className="font-semibold text-[var(--rahma-charcoal)]">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]}
                  </p>
                  <div className="mt-2 grid gap-1 text-xs text-[var(--rahma-muted)]">
                    {dayRules.length === 0 ? (
                      <span>No global hours</span>
                    ) : (
                      dayRules.map((rule) => (
                        <span key={rule.id}>
                          {rule.is_working_day
                            ? `${String(rule.start_time).slice(0, 5)}-${String(rule.end_time).slice(0, 5)}`
                            : "Closed"}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(staffResult.data ?? []).map((staff) => (
              <div key={staff.id} className="rounded-lg border border-[var(--rahma-border)] bg-white px-3 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-[var(--rahma-charcoal)]">
                    {staff.name}
                  </p>
                  <Users className="size-4 text-[var(--rahma-muted)]" />
                </div>
                <p className="mt-1 capitalize text-[var(--rahma-muted)]">
                  {staff.gender} - {staff.availability_mode.replace(/_/g, " ")}
                </p>
                <p className="mt-2 text-xs text-[var(--rahma-muted)]">
                  {staff.active && staff.can_take_bookings ? "Booking eligible" : "Not booking eligible"} ·{" "}
                  {staffRules.has(staff.id) ? "rules" : "no custom rules"} ·{" "}
                  {staffBlocked.has(staff.id) ? "blocked dates" : "no blocked dates"} ·{" "}
                  {staffOverrides.has(staff.id) ? "overrides" : "no overrides"}
                </p>
              </div>
            ))}
          </div>
        </section>
        <AvailabilityRulesManager initialRules={rulesResult.data ?? []} />
        <BlockedDatesManager blockedDates={blockedDatesResult.data ?? []} />
        <AvailabilityOverridesManager overrides={overridesResult.data ?? []} />
      </div>
    </div>
  );
}

function CapacityPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full bg-[var(--rahma-green)]/10 px-3 py-1 font-semibold text-[var(--rahma-green)]">
      {label}: {value}
    </span>
  );
}
