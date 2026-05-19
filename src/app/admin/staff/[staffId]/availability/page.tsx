import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Lock } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";
import { AdminAccessDenied, AdminPanel } from "../../../components/admin-ui";
import { AvailabilityModeSelector } from "./AvailabilityModeSelector";
import { StaffAvailabilityRulesForm } from "./StaffAvailabilityRulesForm";
import { StaffBlockedDatesManager } from "./StaffBlockedDatesManager";
import { StaffAvailabilityOverridesManager } from "./StaffAvailabilityOverridesManager";
import { RESTRICTED_BG_SOFT, RESTRICTED_TEXT } from "./lib";

interface AvailabilityPageProps {
  params: Promise<{ staffId: string }>;
}

export const metadata = {
  title: "Staff Availability — Rahma Therapy Admin",
};

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function AvailabilityPage({ params }: AvailabilityPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  const { staffId } = await params;
  const isOwnProfile = profile.id === staffId;
  const canManageGlobal = profile.permissions.has(
    PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL
  );
  const canManageOwn = profile.permissions.has(
    PERMISSIONS.MANAGE_AVAILABILITY_OWN
  );

  if (!canManageGlobal && !(isOwnProfile && canManageOwn)) {
    return (
      <AdminAccessDenied
        title="Availability access limited"
        message="Availability access requires either own-availability permission (for your own profile) or global availability permission. Ask the owner if you need either."
        actions={
          canManageOwn ? (
            <Link
              href={`/admin/staff/${profile.id}/availability`}
              className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              Open my availability
            </Link>
          ) : (
            <Link
              href="/admin/staff"
              className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              Back to staff directory
            </Link>
          )
        }
      />
    );
  }

  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("id, name, active, availability_mode")
    .eq("id", staffId)
    .single();

  if (!staff) notFound();

  const adminClient = createSupabaseAdminClient();
  const [
    { data: availabilityRules },
    { data: blockedDatesData },
    { data: overridesData },
    { data: globalRulesData },
    { data: upcomingBookings },
    { data: auditTrail },
  ] = await Promise.all([
    supabase
      .from("staff_availability_rules")
      .select("id, day_of_week, start_time, end_time, is_working_day")
      .eq("staff_id", staffId)
      .order("day_of_week")
      .order("start_time"),
    supabase
      .from("staff_blocked_dates")
      .select("id, blocked_date, reason")
      .eq("staff_id", staffId)
      .order("blocked_date"),
    supabase
      .from("staff_availability_overrides")
      .select("id, override_date, start_time, end_time, reason")
      .eq("staff_id", staffId)
      .order("override_date"),
    supabase
      .from("availability_rules")
      .select("day_of_week, start_time, end_time, is_working_day")
      .order("day_of_week"),
    adminClient
      .from("bookings")
      .select("booking_date, staff_id")
      .eq("staff_id", staffId)
      .gte("booking_date", toIsoDate(new Date()))
      .neq("status", "cancelled"),
    adminClient
      .from("audit_logs")
      .select("target_type, created_at, actor_staff_id")
      .in("target_type", [
        "staff_availability_rules",
        "staff_blocked_dates",
        "staff_availability_overrides",
        "staff_profiles",
      ])
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  // Per-section "Last saved by …" line — fetch actor names for the trail rows.
  const actorIds = Array.from(
    new Set(
      (auditTrail ?? [])
        .map((row) => row.actor_staff_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const actorsResult = actorIds.length
    ? await adminClient.from("staff_profiles").select("id, name").in("id", actorIds)
    : { data: [] as { id: string; name: string }[] };
  const actorNamesById = new Map<string, string>(
    (actorsResult.data ?? []).map((row) => [row.id, row.name])
  );

  function formatAuditTrail(targetType: string): string | null {
    const row = (auditTrail ?? []).find((r) => r.target_type === targetType);
    if (!row) return null;
    const actor = row.actor_staff_id
      ? actorNamesById.get(row.actor_staff_id) ?? "Unknown staff"
      : "System";
    const when = new Date(row.created_at);
    if (Number.isNaN(when.getTime())) return null;
    const formatted = when.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `Last saved by ${actor} on ${formatted}.`;
  }

  const blockedTrail = formatAuditTrail("staff_blocked_dates");
  const overridesTrail = formatAuditTrail("staff_availability_overrides");

  // bookings-by-date map for the closure-guard inside StaffBlockedDatesManager
  const bookingsByDate: Record<string, number> = {};
  for (const row of upcomingBookings ?? []) {
    const key = String(row.booking_date);
    bookingsByDate[key] = (bookingsByDate[key] ?? 0) + 1;
  }

  const canEdit = canManageGlobal || (isOwnProfile && canManageOwn);
  const isSelfView = isOwnProfile;
  const subline = isSelfView ? "Your availability" : "Availability";
  const isCustomMode = staff.availability_mode === "custom";

  const initials = staff.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (Array.from(part)[0] ?? "").toUpperCase())
    .join("");

  return (
    <div className="grid gap-6 pb-16 md:pb-8">
      {/* Breadcrumb */}
      <div>
        <Link
          href={`/admin/staff/${staffId}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--admin-text-muted)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:text-[var(--admin-heading)] focus-visible:underline"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          {staff.name} Profile
        </Link>
      </div>

      {/* Flat page header */}
      <header className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[oklch(95.5%_0.012_155)] text-sm font-semibold",
            staff.active ? "text-[var(--admin-primary)]" : "text-[var(--admin-text-muted)]"
          )}
        >
          {initials || "?"}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-balance text-[clamp(1.5rem,2.4vw,2rem)] font-semibold leading-tight tracking-[-0.02em] text-[var(--admin-heading)]">
            {staff.name}
          </h1>
          <p
            className="text-sm text-[var(--admin-text-muted)]"
            title={isSelfView ? "These are your working hours and time off" : undefined}
          >
            {subline}
          </p>
        </div>
      </header>

      {/* Profile / Availability tab strip — momentum-scroll on mobile, never stacks */}
      <nav
        aria-label="Staff sections"
        className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        <div className="flex min-w-max gap-1 border-b border-[var(--admin-border)]">
          <Link
            href={`/admin/staff/${staffId}`}
            className="inline-flex h-10 items-center whitespace-nowrap rounded-t-[var(--admin-radius-control)] px-4 text-sm font-medium text-[var(--admin-text-muted)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Profile Settings
          </Link>
          <Link
            href={`/admin/staff/${staffId}/availability`}
            aria-current="page"
            style={{ color: "#ffffff" }}
            className="inline-flex h-10 items-center whitespace-nowrap rounded-t-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Availability
          </Link>
        </div>
      </nav>

      {/* Inactive-staff banner */}
      {!staff.active ? (
        <div
          role="note"
          className={cn(
            "flex items-start gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] p-4 text-sm",
            RESTRICTED_BG_SOFT,
            RESTRICTED_TEXT
          )}
        >
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            This staff member is inactive. Availability edits won&apos;t take
            effect until they&apos;re reactivated.
          </span>
        </div>
      ) : null}

      {/* Mode selector band */}
      <AvailabilityModeSelector
        staff={{ id: staff.id, availability_mode: staff.availability_mode }}
        canEdit={canEdit}
        isSelfView={isSelfView}
      />

      {/* Three-manager stack */}
      <StaffAvailabilityRulesForm
        staffId={staffId}
        initialRules={availabilityRules ?? []}
        canEdit={canEdit}
        globalModeLocked={!isCustomMode}
        globalRulesSeed={globalRulesData ?? []}
      />

      <StaffBlockedDatesManager
        staffId={staffId}
        blockedDates={blockedDatesData ?? []}
        bookingsByDate={bookingsByDate}
        lastSavedBy={blockedTrail}
      />

      <StaffAvailabilityOverridesManager
        staffId={staffId}
        overrides={overridesData ?? []}
        weeklyRules={availabilityRules ?? []}
        lastSavedBy={overridesTrail}
      />

      {!canEdit ? (
        <AdminPanel tone="restricted">
          <p className="text-sm text-[var(--admin-text-muted)]">
            Read-only view. Ask the owner if you need editing access.
          </p>
        </AdminPanel>
      ) : null}
    </div>
  );
}
