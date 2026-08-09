import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminEntityRow,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
} from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { AvailabilityManagersTabs } from "./AvailabilityManagersTabs";
import { AvailabilityOverridesManager } from "./AvailabilityOverridesManager";
import { AvailabilityRulesManager } from "./AvailabilityRulesManager";
import { BlockedDatesManager } from "./BlockedDatesManager";
import {
  AVAILABILITY_PAST_CAP,
  AVAILABILITY_PAST_VIEW_ALL_CAP,
  AVAILABILITY_UPCOMING_DEFENSIVE_CAP,
} from "./availability-data";

export const metadata = {
  title: "Availability - Rahma Therapy Admin",
};

interface AvailabilityPageProps {
  /** C-16 Step 14 (N3) — cap+view-all toggles for the two past-dated lists. */
  searchParams: Promise<{ closedPast?: string; adjPast?: string }>;
}

/** Preserves the OTHER toggle's state — no other query params exist on this page. */
function buildAvailabilityHref(toggles: { closedPast: boolean; adjPast: boolean }): string {
  const params = new URLSearchParams();
  if (toggles.closedPast) params.set("closedPast", "all");
  if (toggles.adjPast) params.set("adjPast", "all");
  const qs = params.toString();
  return qs ? `/admin/availability?${qs}` : "/admin/availability";
}

// Brief renders week as Mon → Sun. day_of_week column convention is 0 = Sunday.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const DAY_SHORT: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

const DAY_LONG: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

function formatTime(value: string) {
  return value.slice(0, 5);
}

function getCurrentWeekRange(reference: Date = new Date()) {
  // ISO week starts Monday. Walk back to nearest Monday.
  const local = new Date(reference);
  local.setHours(0, 0, 0, 0);
  const day = local.getDay(); // 0 = Sunday … 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(local);
  start.setDate(local.getDate() + diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function pluralize(noun: string, count: number) {
  return count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
}

interface AvailabilityRuleRow {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
}

interface BlockedDateRow {
  id: string;
  blocked_date: string;
  reason: string | null;
}

interface OverrideRow {
  id: string;
  override_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

interface StaffRow {
  id: string;
  name: string;
  gender: "male" | "female" | string | null;
  active: boolean;
  can_take_bookings: boolean;
  availability_mode: string;
}

/** Shape shared by any stored `HH:MM[:SS]` segment row — recurring rule or override. */
interface TimeSegment {
  start_time: string;
  end_time: string;
}

function sortByStartTime<T extends TimeSegment>(segments: T[]): T[] {
  return [...segments].sort((a, b) => a.start_time.localeCompare(b.start_time));
}

/**
 * C-14 — segments model: a day/date is stored as MULTIPLE rows, one per
 * bookable window, with the gaps between them being breaks. Renders every
 * segment in time order, formatted the same way WorkingHoursDayEditor's
 * "Bookable:" line and AvailabilityOverridesManager's OverrideRow do — "–"
 * inside a segment, " · " between segments (WorkingHoursDayEditor.tsx:184-190,
 * AvailabilityOverridesManager.tsx:479-482).
 */
export function formatSegments(segments: TimeSegment[]): string {
  return sortByStartTime(segments)
    .map((segment) => `${formatTime(segment.start_time)}–${formatTime(segment.end_time)}`)
    .join(" · ");
}

/**
 * One weekday's recurring-rule rows -> whether the clinic is open that day
 * and its working segments in time order. Open = ANY row for the day has
 * `is_working_day` true; a closed day still keeps one memo row (segments
 * model — working-hours-segments.ts), so `.find()` reading a single row was
 * wrong the moment a working day had more than one segment.
 */
export function resolveWeekdayRule(
  rules: AvailabilityRuleRow[],
  dayOfWeek: number
): { isOpen: boolean; segments: AvailabilityRuleRow[] } {
  const dayRules = rules.filter((rule) => rule.day_of_week === dayOfWeek);
  return {
    isOpen: dayRules.some((rule) => rule.is_working_day),
    segments: sortByStartTime(dayRules.filter((rule) => rule.is_working_day)),
  };
}

/**
 * Week-window override rows -> a map of `override_date` to that date's
 * segment rows. A unique constraint currently forbids two rows per date, but
 * C-14 Phase C's migration drops it — the old `new Map(rows.map(...))` was
 * last-row-wins and would silently drop segments the moment that lands.
 */
export function groupOverridesByDate(rows: OverrideRow[]): Map<string, OverrideRow[]> {
  const byDate = new Map<string, OverrideRow[]>();
  for (const row of rows) {
    const existing = byDate.get(row.override_date);
    if (existing) {
      existing.push(row);
    } else {
      byDate.set(row.override_date, [row]);
    }
  }
  return byDate;
}

export default async function AvailabilityPage({ searchParams }: AvailabilityPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!profile.permissions.has(PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL)) {
    return <DeniedSurface profile={profile} />;
  }

  // C-16 Step 14 (N3) — cap+view-all toggles for the two past-dated lists.
  const { closedPast: closedPastParam, adjPast: adjPastParam } = await searchParams;
  const closedPastViewAll = closedPastParam === "all";
  const adjPastViewAll = adjPastParam === "all";

  const today = toIsoDate(new Date());
  const { start: weekStart, end: weekEnd } = getCurrentWeekRange();
  const weekStartIso = toIsoDate(weekStart);
  const weekEndIso = toIsoDate(weekEnd);

  const [
    rulesResult,
    // `blocked_dates` / `availability_overrides` (C-16 Step 14, N3): three
    // queries each, replacing the old single unbounded `select("*")`.
    //  - "week" is scoped exactly to the current Mon-Sun window so
    //    CapacityPreview's grid stays correct regardless of the past cap
    //    below (the week can start up to 6 days before `today`) — see
    //    availability-data.ts's file header.
    //  - "upcoming" (`>= today`) is defensive-capped only, never paginated:
    //    business reality bounds it.
    //  - "past" (`< today`) is real cap+view-all, plus a true head-count.
    blockedWeekResult,
    blockedUpcomingResult,
    blockedUpcomingCountResult,
    blockedPastResult,
    blockedPastCountResult,
    overridesWeekResult,
    overridesUpcomingResult,
    overridesUpcomingCountResult,
    overridesPastResult,
    overridesPastCountResult,
  ] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("*")
      // C-14 segments model: a day is multiple rows now, one per bookable
      // window. `day_of_week` alone leaves segment order within a day
      // unspecified — the secondary order makes it deterministic.
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("blocked_dates")
      .select("*")
      .gte("blocked_date", weekStartIso)
      .lte("blocked_date", weekEndIso)
      .order("blocked_date", { ascending: true }),
    supabase
      .from("blocked_dates")
      .select("*")
      .gte("blocked_date", today)
      .order("blocked_date", { ascending: true })
      .limit(AVAILABILITY_UPCOMING_DEFENSIVE_CAP),
    // Fix round (verify-FAIL Check 2, non-blocking) — cheap head-count so the
    // "N upcoming" badge can say when the defensive cap was actually hit,
    // instead of staying silent at 501+. Mirrors the `past` bucket's own
    // count query below.
    supabase
      .from("blocked_dates")
      .select("id", { count: "exact", head: true })
      .gte("blocked_date", today),
    supabase
      .from("blocked_dates")
      .select("*")
      .lt("blocked_date", today)
      .order("blocked_date", { ascending: false })
      .limit(closedPastViewAll ? AVAILABILITY_PAST_VIEW_ALL_CAP : AVAILABILITY_PAST_CAP),
    supabase
      .from("blocked_dates")
      .select("id", { count: "exact", head: true })
      .lt("blocked_date", today),
    supabase
      .from("availability_overrides")
      .select("*")
      .gte("override_date", weekStartIso)
      .lte("override_date", weekEndIso)
      .order("override_date", { ascending: true }),
    supabase
      .from("availability_overrides")
      .select("*")
      .gte("override_date", today)
      .order("override_date", { ascending: true })
      .limit(AVAILABILITY_UPCOMING_DEFENSIVE_CAP),
    // Fix round (verify-FAIL Check 2, non-blocking) — same head-count as the
    // blocked-dates upcoming bucket above.
    supabase
      .from("availability_overrides")
      .select("id", { count: "exact", head: true })
      .gte("override_date", today),
    supabase
      .from("availability_overrides")
      .select("*")
      .lt("override_date", today)
      .order("override_date", { ascending: false })
      .limit(adjPastViewAll ? AVAILABILITY_PAST_VIEW_ALL_CAP : AVAILABILITY_PAST_CAP),
    supabase
      .from("availability_overrides")
      .select("id", { count: "exact", head: true })
      .lt("override_date", today),
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

  // Per-section "Last saved by {actor} on {date}" — latest audit_log per target_type.
  const adminClient = createSupabaseAdminClient();
  const [auditTrailResult, upcomingBookingsResult] = await Promise.all([
    adminClient
      .from("audit_logs")
      .select("target_type, action_type, created_at, actor_staff_id")
      .in("target_type", [
        "availability_rules",
        "blocked_dates",
        "availability_overrides",
      ])
      .order("created_at", { ascending: false })
      .limit(60),
    adminClient
      .from("bookings")
      .select("booking_date")
      .gte("booking_date", toIsoDate(new Date()))
      .neq("status", "cancelled"),
  ]);

  const rules = (rulesResult.data ?? []) as AvailabilityRuleRow[];
  // C-16 Step 14 (N3) — three buckets per table, replacing the old single
  // unbounded fetch. `weekClosures`/`weekAdjustments` (for CapacityPreview)
  // come directly from the dedicated week-window query — see the Promise.all
  // comment above for why that isn't derived from `upcoming`/`past`.
  const blockedUpcoming = (blockedUpcomingResult.data ?? []) as BlockedDateRow[];
  const blockedUpcomingTotal = blockedUpcomingCountResult.count ?? 0;
  const blockedPast = (blockedPastResult.data ?? []) as BlockedDateRow[];
  const blockedPastTotal = blockedPastCountResult.count ?? 0;
  const weekClosures = (blockedWeekResult.data ?? []) as BlockedDateRow[];
  const overridesUpcoming = (overridesUpcomingResult.data ?? []) as OverrideRow[];
  const overridesUpcomingTotal = overridesUpcomingCountResult.count ?? 0;
  const overridesPast = (overridesPastResult.data ?? []) as OverrideRow[];
  const overridesPastTotal = overridesPastCountResult.count ?? 0;
  const weekAdjustments = (overridesWeekResult.data ?? []) as OverrideRow[];
  const staffList = ((staffResult.data ?? []) as StaffRow[]).filter(
    (staff) => staff.active
  );
  const staffRules = new Set(
    (staffRulesResult.data ?? []).map((row) => row.staff_id)
  );
  const staffBlocked = new Set(
    (staffBlockedResult.data ?? []).map((row) => row.staff_id)
  );
  const staffOverrides = new Set(
    (staffOverridesResult.data ?? []).map((row) => row.staff_id)
  );

  const bookingStaff = staffList.filter((staff) => staff.can_take_bookings);
  const maleCapacity = bookingStaff.filter(
    (staff) => staff.gender === "male"
  ).length;
  const femaleCapacity = bookingStaff.filter(
    (staff) => staff.gender === "female"
  ).length;

  // Resolve each day of THIS calendar week to its actual state (closure
  // overrides override-times overrides recurring template).
  const weekClosuresByDate = new Map(
    weekClosures.map((row) => [row.blocked_date, row])
  );
  const weekAdjustmentsByDate = groupOverridesByDate(weekAdjustments);
  const resolvedWeek = WEEK_ORDER.map((dayOfWeek) => {
    const date = new Date(weekStart);
    const startDow = weekStart.getDay();
    const offset = (dayOfWeek - startDow + 7) % 7;
    date.setDate(weekStart.getDate() + offset);
    const isoDate = toIsoDate(date);
    const closure = weekClosuresByDate.get(isoDate);
    const adjustments = weekAdjustmentsByDate.get(isoDate) ?? [];
    const { isOpen: ruleIsOpen, segments: ruleSegments } = resolveWeekdayRule(
      rules,
      dayOfWeek
    );
    return {
      dayOfWeek,
      isoDate,
      shortLabel: `${DAY_SHORT[dayOfWeek]} ${date.getDate()}`,
      closure,
      adjustments,
      ruleIsOpen,
      ruleSegments,
    };
  });

  // Pre-fetched bookings → count per ISO date (used by BlockedDatesManager).
  const bookingsByDate: Record<string, number> = {};
  for (const row of upcomingBookingsResult.data ?? []) {
    const key = String(row.booking_date);
    bookingsByDate[key] = (bookingsByDate[key] ?? 0) + 1;
  }

  // Resolve actor names for audit-trail lines.
  const trailActorIds = Array.from(
    new Set(
      (auditTrailResult.data ?? [])
        .map((row) => row.actor_staff_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const trailActorsResult = trailActorIds.length
    ? await adminClient
        .from("staff_profiles")
        .select("id, name")
        .in("id", trailActorIds)
    : { data: [] as { id: string; name: string }[] };
  const actorNamesById = new Map<string, string>(
    (trailActorsResult.data ?? []).map((row) => [row.id, row.name])
  );

  function formatAuditTrail(targetType: string): string | null {
    const row = (auditTrailResult.data ?? []).find(
      (r) => r.target_type === targetType
    );
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

  const rulesTrail = formatAuditTrail("availability_rules");
  const blockedTrail = formatAuditTrail("blocked_dates");
  const overridesTrail = formatAuditTrail("availability_overrides");

  // C-16 Step 14 (N3) — hrefs for the two independent past-view-all toggles;
  // each preserves the OTHER toggle's current state (no other query params
  // exist on this page).
  const closedPastAllHref = buildAvailabilityHref({
    closedPast: true,
    adjPast: adjPastViewAll,
  });
  const closedPastRecentHref = buildAvailabilityHref({
    closedPast: false,
    adjPast: adjPastViewAll,
  });
  const adjPastAllHref = buildAvailabilityHref({
    closedPast: closedPastViewAll,
    adjPast: true,
  });
  const adjPastRecentHref = buildAvailabilityHref({
    closedPast: closedPastViewAll,
    adjPast: false,
  });

  return (
    <div className="grid gap-6">
      <AdminPageHeader
        title="Availability"
        description="Set the clinic's recurring working hours and block off any days that should run differently."
      />

      <CapacityPreview
        resolvedWeek={resolvedWeek}
        staffList={staffList}
        staffRules={staffRules}
        staffBlocked={staffBlocked}
        staffOverrides={staffOverrides}
        maleCapacity={maleCapacity}
        femaleCapacity={femaleCapacity}
        weekClosures={weekClosures.length}
        weekAdjustments={weekAdjustments.length}
      />

      <AvailabilityManagersTabs
        hoursSlot={
          <AvailabilityRulesManager
            initialRules={rules}
            lastSavedBy={rulesTrail}
          />
        }
        closedSlot={
          <BlockedDatesManager
            upcoming={blockedUpcoming}
            upcomingTotal={blockedUpcomingTotal}
            past={blockedPast}
            pastTotal={blockedPastTotal}
            pastViewAll={closedPastViewAll}
            pastAllHref={closedPastAllHref}
            pastRecentHref={closedPastRecentHref}
            lastSavedBy={blockedTrail}
            bookingsByDate={bookingsByDate}
          />
        }
        adjustmentsSlot={
          <AvailabilityOverridesManager
            upcoming={overridesUpcoming}
            upcomingTotal={overridesUpcomingTotal}
            past={overridesPast}
            pastTotal={overridesPastTotal}
            pastViewAll={adjPastViewAll}
            pastAllHref={adjPastAllHref}
            pastRecentHref={adjPastRecentHref}
            rules={rules}
            lastSavedBy={overridesTrail}
          />
        }
      />
    </div>
  );
}

interface ResolvedDay {
  dayOfWeek: number;
  isoDate: string;
  shortLabel: string;
  closure?: BlockedDateRow;
  adjustments: OverrideRow[];
  ruleIsOpen: boolean;
  ruleSegments: AvailabilityRuleRow[];
}

function CapacityPreview({
  resolvedWeek,
  staffList,
  staffRules,
  staffBlocked,
  staffOverrides,
  maleCapacity,
  femaleCapacity,
  weekClosures,
  weekAdjustments,
}: {
  resolvedWeek: ResolvedDay[];
  staffList: StaffRow[];
  staffRules: Set<string>;
  staffBlocked: Set<string>;
  staffOverrides: Set<string>;
  maleCapacity: number;
  femaleCapacity: number;
  weekClosures: number;
  weekAdjustments: number;
}) {
  const chips: { key: string; label: string; title: string }[] = [];
  if (weekClosures > 0) {
    chips.push({
      key: "closures",
      label: `${pluralize("closure", weekClosures)} this week`,
      title: "Closed dates falling inside the current Mon–Sun week.",
    });
  }
  if (weekAdjustments > 0) {
    chips.push({
      key: "adjustments",
      label: `${pluralize("adjustment", weekAdjustments)} this week`,
      title: "Hour adjustments falling inside the current Mon–Sun week.",
    });
  }

  return (
    <AdminPanel
      title="This week's capacity"
      description="Live picture of the rules below: which days are open, what hours, and how many therapists can cover them."
      badge={
        <>
          <CapacityPill
            label={`Male: ${maleCapacity}`}
            title={`${maleCapacity} active male therapists`}
          />
          <CapacityPill
            label={`Female: ${femaleCapacity}`}
            title={`${femaleCapacity} active female therapists`}
          />
          {chips.map((chip) => (
            <span key={chip.key} title={chip.title} className="inline-flex">
              <AdminStatusBadge value={chip.label} tone="info" />
            </span>
          ))}
        </>
      }
    >
      <div className="grid gap-5">
        <div
          className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
          role="group"
          aria-label="Weekly working hours preview"
        >
          <ul className="grid min-w-[40rem] list-none grid-cols-7 gap-2 pl-0 md:min-w-0 md:max-w-[56rem] md:[grid-template-columns:repeat(7,minmax(0,1fr))]">
            {resolvedWeek.map((day) => {
              const ruleTimes = day.ruleIsOpen
                ? formatSegments(day.ruleSegments)
                : null;
              const isClosure = Boolean(day.closure);
              const isAdjustment = day.adjustments.length > 0 && !isClosure;
              const isOpen = !isClosure && day.ruleIsOpen;
              // Every segment of a date is saved with the same reason;
              // tolerate older rows where only one of them carries it
              // (mirrors AvailabilityOverridesManager.tsx's groupByDate).
              const adjustmentTimes = isAdjustment
                ? formatSegments(day.adjustments)
                : null;
              const adjustmentReason = isAdjustment
                ? (day.adjustments.find((row) => row.reason)?.reason ?? null)
                : null;

              // Tones: closure → Restricted; adjustment → Pending (Attention); open → Confirmed/selected; recurring-closed → Restricted.
              const tone = isClosure
                ? "bg-[oklch(94.0%_0.008_280)]"
                : isAdjustment
                  ? "bg-[oklch(96.0%_0.038_75)]"
                  : isOpen
                    ? "bg-[var(--admin-selected-sky)]"
                    : "bg-[oklch(94.0%_0.008_280)]";

              const tooltip = isClosure
                ? `Closed ${day.shortLabel}${day.closure?.reason ? `: ${day.closure.reason}` : ""}`
                : isAdjustment
                  ? `Adjusted ${day.shortLabel}: ${adjustmentTimes}${adjustmentReason ? ` (${adjustmentReason})` : ""}`
                  : isOpen
                    ? `Open ${day.shortLabel} ${ruleTimes}`
                    : `Closed every ${DAY_LONG[day.dayOfWeek]}`;

              return (
                <li
                  key={day.dayOfWeek}
                  title={tooltip}
                  className={cn(
                    "grid gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] px-3 py-3 text-center",
                    tone
                  )}
                >
                  <span className="text-xs font-medium text-[var(--admin-text-muted)]">
                    {day.shortLabel}
                  </span>
                  {isClosure ? (
                    <span className="text-xs font-semibold text-[oklch(30%_0.020_280)]">
                      Closed
                    </span>
                  ) : isAdjustment ? (
                    <span className="font-mono text-xs text-[oklch(28%_0.120_55)]">
                      {adjustmentTimes}
                    </span>
                  ) : isOpen && ruleTimes ? (
                    <span className="font-mono text-xs text-[var(--admin-heading)]">
                      {ruleTimes}
                    </span>
                  ) : (
                    <span className="text-xs text-[oklch(30%_0.020_280)]">
                      Closed
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <StaffCapacityList
          staffList={staffList}
          staffRules={staffRules}
          staffBlocked={staffBlocked}
          staffOverrides={staffOverrides}
        />
      </div>
    </AdminPanel>
  );
}

function StaffCapacityList({
  staffList,
  staffRules,
  staffBlocked,
  staffOverrides,
}: {
  staffList: StaffRow[];
  staffRules: Set<string>;
  staffBlocked: Set<string>;
  staffOverrides: Set<string>;
}) {
  if (staffList.length === 0) {
    return (
      <EmptyState
        icon={Users}
        illustrationSrc="/images/admin/empty-states/staff.svg"
        title="No active staff yet"
        message="Add a therapist to see capacity here."
        action={{ label: "Add staff", href: "/admin/staff" }}
      />
    );
  }

  return (
    <ul className="grid list-none gap-2 pl-0" aria-label="Staff capacity">
      {staffList.map((staff) => {
        const isCustom = staff.availability_mode === "custom";
        const flags: string[] = [];
        if (staffRules.has(staff.id)) flags.push("custom rules");
        if (staffBlocked.has(staff.id)) flags.push("blocked dates");
        if (staffOverrides.has(staff.id)) flags.push("overrides");
        const profileHref = `/admin/staff/${staff.id}/availability`;

        return (
          <li key={staff.id}>
            <AdminEntityRow
              leading={<StaffAvatar name={staff.name} />}
              title={
                <Link
                  href={profileHref}
                  className="outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:text-[var(--admin-primary)] focus-visible:underline"
                >
                  {staff.name}
                </Link>
              }
              meta={
                <span>
                  {staff.gender ? capitalize(staff.gender) : "Unassigned"}
                  {staff.can_take_bookings ? null : " · not taking bookings"}
                </span>
              }
              badges={
                <>
                  <span
                    title={
                      isCustom
                        ? "Has their own working hours set"
                        : "Uses the clinic's weekly hours"
                    }
                    className="inline-flex"
                  >
                    <AdminStatusBadge
                      value={isCustom ? "Custom schedule" : "Global schedule"}
                      tone={isCustom ? "info" : "success"}
                      compact
                    />
                  </span>
                  {flags.map((flag) => (
                    <AdminStatusBadge
                      key={flag}
                      value={flag}
                      tone="restricted"
                      compact
                    />
                  ))}
                </>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

function CapacityPill({ label, title }: { label: string; title: string }) {
  // Brief copy: "Male: {n}" / "Female: {n}". DESIGN.md "Cormorant Exception"
  // reserves the serif for marquee dashboard stat-tile numerals only; pills
  // are badge-text → render the count in the same Work Sans 500 label step.
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(93.5%_0.038_155)] px-3 py-1 text-xs font-medium text-[oklch(22%_0.085_155)]"
    >
      <Users className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function StaffAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (Array.from(part)[0] ?? "").toUpperCase())
    .join("");

  return (
    <span
      aria-hidden="true"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-selected-sky)] text-xs font-semibold text-[var(--admin-primary)]"
    >
      {initials || "?"}
    </span>
  );
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function DeniedSurface({
  profile,
}: {
  profile: { id: string; role_name: string };
}) {
  const isTherapist = profile.role_name.toLowerCase() === "therapist";

  if (isTherapist) {
    return (
      <AdminAccessDenied
        title="This section is for the practice owner"
        message="Your working hours are on your availability page."
        variant="therapist"
        actions={
          <Link
            href={`/admin/staff/${profile.id}/availability`}
            className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            My availability
          </Link>
        }
      />
    );
  }

  return (
    <AdminAccessDenied
      title="You don't have access to this section"
      message="Availability settings are managed by the owner or practice manager."
      variant="coordinator"
      actions={
        <Link
          href="/admin/dashboard"
          className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          Back to dashboard
        </Link>
      }
    />
  );
}
