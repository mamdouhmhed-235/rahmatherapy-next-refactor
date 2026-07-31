// SERVER COMPONENT — Therapist worker-tool dashboard variant.
//
// A therapist's day revolves around three questions: "What's next?",
// "What do I have today?", "Is there work I can claim?". This variant
// stays mobile-first (375px primary canvas) and renders only what a
// worker on the road needs. The Owner/Admin variant's KPI grid and
// command-centre tiles are explicitly out of scope here.

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleCheck,
  Clock,
  Lock,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminPageScaffold, AdminStatusBadge } from "../components/admin-ui";
import { BusinessOverviewDisclosure } from "./dashboard-filters-client";
// C-11 Phase D — the shared blocks library is the composition surface for
// all three variants. `DashboardHeader` and `QuickHelpPanel` are re-exports
// of the canonical implementations (`dashboard-header.tsx` and
// `QuickHelpPanel.tsx`), so this is a re-point rather than a duplicate
// rendering — the Therapist surface renders exactly what it rendered before.
import { DashboardHeader, QuickHelpPanel } from "./blocks";
import { ProfileCompletionNudge } from "./ProfileCompletionNudge";
import { ClaimAssignmentButton } from "../bookings/ClaimAssignmentButton";
import type { ReportData, StaffScorecard } from "../reports/reporting";
import type {
  PersonalStripeTile,
  StripeRange,
} from "./dashboard-helpers-b5";
import { PersonalContributionStripe } from "./PersonalContributionStripe";
import { HighlightOrTipStrip } from "./HighlightOrTipStrip";
import { RecentClientsStrip } from "./RecentClientsStrip";
import {
  getRecentClientsForTherapist,
  getTherapistHighlightOrTip,
  quickHelpLinksForTherapist,
  type QuickHelpPermissions,
} from "./therapist-fullness";
import {
  getGreeting,
  getFirstName,
  formatHours,
  buildServiceLookup,
  FORMATTERS,
  type ServiceMeta,
} from "./shared-helpers";
import { PractitionerTodaySection } from "./PractitionerTodaySection";

interface TherapistDashboardProps {
  staffId: string;
  staffName: string;
  today: string;
  data: ReportData;
  weekCount: number;
  todayAppointments: ReportData["bookings"];
  nextAppointment: ReportData["bookings"][number] | null;
  activeRange?: string;
  // Profile-completion fields for the first-run onboarding nudge.
  // Pass-through from getStaffProfile(); the nudge hides itself once
  // profile_completed_at is set or all five visible fields are filled.
  profileCompletionFields: {
    phone: string | null;
    shortBio: string | null;
    specialties: string[] | null;
    languages: string[] | null;
    serviceAreas: string[] | null;
    profileCompletedAt: string | null;
  };
  // B-5 Personal Stripe + fullness pass inputs (step 9 wires them into the
  // rendered tier sequence). All optional so the component still renders
  // sensibly when the fullness flag is off OR when called from contexts that
  // pre-date the rebuild.
  personalStripeTiles?: PersonalStripeTile[];
  contribStripeRange?: StripeRange;
  preservedSearchParams?: Record<string, string>;
  stripeScorecard?: StaffScorecard;
  stripePriorScorecard?: StaffScorecard;
  quickHelpPermissions?: QuickHelpPermissions;
}

export function TherapistDashboard({
  staffId,
  staffName,
  today,
  data,
  weekCount,
  todayAppointments,
  nextAppointment,
  activeRange = "today",
  profileCompletionFields,
  personalStripeTiles,
  contribStripeRange,
  preservedSearchParams,
  stripeScorecard,
  stripePriorScorecard,
  quickHelpPermissions,
}: TherapistDashboardProps) {
  const greeting = getGreeting();
  const firstName = getFirstName(staffName);
  const hasName = firstName.trim().length > 0;
  const todayDate = new Date(`${today}T12:00:00Z`);
  const dateLabel = FORMATTERS.longDate.format(todayDate);
  const lastChecked = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date());
  const rangeLabelMap: Record<string, string> = {
    today: "Today",
    tomorrow: "Tomorrow",
    this_week: "This week",
    // `week` (rolling +7 business days) still mapped for backwards-compat in
    // case any deep-link survives from before the audit fix.
    week: "Next 7 days",
  };
  const rangeLabel = rangeLabelMap[activeRange] ?? "Today";

  // B-5 fullness pass (brief §5.6 + AUDIT R6). Default-on; disable via
  // NEXT_PUBLIC_B5_THERAPIST_FULLNESS=off without redeploy. Each new block is
  // additionally gated on its own input data being present so partial inputs
  // degrade gracefully.
  const fullnessEnabled =
    process.env.NEXT_PUBLIC_B5_THERAPIST_FULLNESS !== "off";
  const highlight =
    fullnessEnabled && stripeScorecard
      ? getTherapistHighlightOrTip(
          stripeScorecard,
          stripePriorScorecard ?? null,
          { id: staffId },
          contribStripeRange ?? "this_week"
        )
      : null;
  const fullnessRecentClients = fullnessEnabled
    ? getRecentClientsForTherapist(data, today, 30, 6)
    : [];
  const quickHelpLinks =
    fullnessEnabled && quickHelpPermissions
      ? quickHelpLinksForTherapist(staffId, quickHelpPermissions)
      : [];

  // The "My week" disclosure is a CALENDAR-WEEK snapshot regardless of the
  // page-level date filter — the heading literally says "This week" and the
  // panel exists to summarise the operator's calendar week. Computing from
  // the page filter (the previous behaviour) caused the same numbers to
  // show under "This week" even when the filter said Today / Tomorrow /
  // Next 7 days — audit-found 2026-05-25.
  const weekStartDate = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    const dow = d.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
    const daysFromMonday = dow === 0 ? 6 : dow - 1;
    d.setUTCDate(d.getUTCDate() - daysFromMonday);
    return d.toISOString().slice(0, 10);
  })();
  const weekEndDate = (() => {
    const d = new Date(`${weekStartDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
  })();
  const completedThisWeek = data.bookings.filter(
    (booking) =>
      booking.status === "completed" &&
      booking.booking_date >= weekStartDate &&
      booking.booking_date <= weekEndDate
  );
  const minutesThisWeek = completedThisWeek.reduce((acc, booking) => {
    if (!booking.start_time || !booking.end_time) return acc;
    const [sh, sm] = booking.start_time.split(":").map(Number);
    const [eh, em] = booking.end_time.split(":").map(Number);
    const minutes = eh * 60 + em - (sh * 60 + sm);
    return acc + (minutes > 0 ? minutes : 0);
  }, 0);

  const serviceLookup = buildServiceLookup(data.bookingItems);

  const claimable = data.bookings.filter(
    (booking) =>
      booking.assignment_status === "unassigned" &&
      booking.booking_date >= today &&
      !["cancelled", "no_show"].includes(booking.status)
  );

  // M3 fix (B-5 step 4 — AUDIT C4): map each claimable booking to its
  // unassigned assignment id so the inline <ClaimAssignmentButton> (which
  // takes `assignmentId` NOT `bookingId`) can fire the optimistic claim flow.
  // Therapist data layer (dashboard-data.ts) already filters assignments to
  // assigned-to-self + claimable-matching-gender, so the first unassigned
  // assignment per booking is the right target.
  const claimableAssignmentByBookingId = new Map<string, string>();
  for (const assignment of data.assignments) {
    if (
      assignment.assigned_staff_id === null &&
      assignment.status !== "completed" &&
      !claimableAssignmentByBookingId.has(assignment.booking_id)
    ) {
      claimableAssignmentByBookingId.set(assignment.booking_id, assignment.id);
    }
  }

  // C-FIELDWORK Phase D — this viewer's own assignment id on nextAppointment,
  // for PractitionerTodaySection's Mark-complete control (new in Phase C;
  // TherapistDashboard's previous NextVisitHero had no such button).
  const nextAppointmentAssignmentId = nextAppointment
    ? (data.assignments.find(
        (a) =>
          a.booking_id === nextAppointment.id && a.assigned_staff_id === staffId
      )?.id ?? null)
    : null;

  // Compute tomorrow's date (UTC-safe) for the "fully quiet" forward-anchor.
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrowKey = tomorrowDate.toISOString().slice(0, 10);
  const tomorrowVisitCount = data.bookings.filter(
    (booking) =>
      booking.booking_date === tomorrowKey &&
      !["cancelled", "no_show"].includes(booking.status)
  ).length;
  const fullyQuiet =
    !nextAppointment && todayAppointments.length === 0 && claimable.length === 0;

  // Today's-visits list excludes the Next Visit row to avoid duplication AND
  // excludes any unassigned booking (those belong to the Claimable strip, not
  // the therapist's personal Today's list — they're "open to anyone" not "yours").
  // Claimable strip promotion (B-5 brief §5.6 block 7): when Today + Next
  // Visit are both empty AND claimable work exists, the strip moves above
  // the hero AND uses the strong warning bg. Triggered only when fullness is
  // enabled — otherwise existing layout is preserved.
  const remainingToday = (
    nextAppointment
      ? todayAppointments.filter((booking) => booking.id !== nextAppointment.id)
      : todayAppointments
  ).filter((booking) => booking.assignment_status !== "unassigned");

  const claimablePromoted =
    fullnessEnabled &&
    !nextAppointment &&
    remainingToday.length === 0 &&
    claimable.length > 0;

  // C-11 Phase D follow-up — the dynamic hero eyebrow, restored verbatim from
  // the pre-C-FIELDWORK local NextVisitHero (`29ab66e` lines 257-270) and fed
  // to PractitionerTodaySection through its optional `eyebrow` prop. Restored
  // as-is, quirks included: the "Tomorrow's first visit" branch fires for ANY
  // non-today next appointment, not only tomorrow's.
  const heroIsToday = nextAppointment?.booking_date === today;
  const todayWeekday = todayDate.getUTCDay();
  const isMondayMorning = todayWeekday === 1;
  const lastCompletedVisit = completedThisWeek[completedThisWeek.length - 1];
  const lastVisitWasFriday =
    lastCompletedVisit?.booking_date &&
    new Date(`${lastCompletedVisit.booking_date}T12:00:00Z`).getUTCDay() === 5;
  const heroEyebrow = nextAppointment
    ? heroIsToday
      ? isMondayMorning && lastVisitWasFriday
        ? "First visit back"
        : "Next visit"
      : "Tomorrow's first visit"
    : "Next visit";

  // ── Day-at-a-glance computations ───────────────────────────────────────────
  // Working window = earliest start to latest end across today's assigned visits
  const assignedToday = todayAppointments.filter(
    (b) => b.assignment_status !== "unassigned"
  );
  const sortedToday = [...assignedToday].sort((a, b) =>
    (a.start_time ?? "").localeCompare(b.start_time ?? "")
  );
  const workingStart = sortedToday[0]?.start_time?.slice(0, 5) ?? null;
  const workingEnd =
    sortedToday[sortedToday.length - 1]?.end_time?.slice(0, 5) ?? null;
  const workingHoursLabel =
    workingStart && workingEnd ? `${workingStart}–${workingEnd}` : null;

  const todayCounts = {
    total: assignedToday.length,
    confirmed: assignedToday.filter((b) => b.status === "confirmed").length,
    pending: assignedToday.filter((b) => b.status === "pending").length,
    completed: assignedToday.filter((b) => b.status === "completed").length,
  };

  // ── Tier 2 "My week" data ──────────────────────────────────────────────────
  const weekHoursLabel = formatHours(minutesThisWeek);
  const totalAttempted = data.bookings.filter(
    (b) =>
      b.assignment_status !== "unassigned" &&
      ["completed", "no_show", "cancelled"].includes(b.status)
  ).length;
  const completedCount = completedThisWeek.length;
  const completionRate =
    totalAttempted > 0 ? Math.round((completedCount / totalAttempted) * 100) : null;
  const noShowCount = data.bookings.filter(
    (b) => b.assignment_status !== "unassigned" && b.status === "no_show"
  ).length;

  // Recent clients = up to 5 most recent completed visits, deduplicated by name
  const recentClientsSorted = [...completedThisWeek].sort((a, b) => {
    if (a.booking_date !== b.booking_date) {
      return b.booking_date.localeCompare(a.booking_date);
    }
    return (b.start_time ?? "").localeCompare(a.start_time ?? "");
  });
  const seenClients = new Set<string>();
  const recentClients: Array<{
    name: string;
    lastDate: string;
    bookingId: string;
  }> = [];
  for (const b of recentClientsSorted) {
    const key = b.contact_full_name?.trim() ?? "";
    if (!key || seenClients.has(key)) continue;
    seenClients.add(key);
    recentClients.push({
      name: key,
      lastDate: b.booking_date,
      bookingId: b.id,
    });
    if (recentClients.length >= 5) break;
  }

  // Service mix from booking items (completed this week)
  const completedIds = new Set(completedThisWeek.map((b) => b.id));
  const serviceMix = new Map<string, number>();
  for (const item of data.bookingItems) {
    if (!item.booking_id || !completedIds.has(item.booking_id)) continue;
    const name = item.service_name_snapshot?.trim();
    if (!name) continue;
    serviceMix.set(name, (serviceMix.get(name) ?? 0) + 1);
  }
  const serviceMixRows = Array.from(serviceMix.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const serviceMixTotal = serviceMixRows.reduce((acc, [, n]) => acc + n, 0);

  // Tier 2 has activity if any of these are non-empty
  const tierTwoHasActivity =
    completedCount > 0 || weekCount > 0 || recentClients.length > 0;

  // Subtitle context for the shared header — date plus working window + today count
  const subtitleParts: string[] = [dateLabel];
  if (workingHoursLabel) subtitleParts.push(workingHoursLabel);
  if (todayCounts.total > 0) {
    subtitleParts.push(
      `${todayCounts.total} visit${todayCounts.total === 1 ? "" : "s"} today`
    );
  }
  const headerTitle = hasName
    ? `${greeting}, ${firstName}.`
    : `${greeting}.`;

  return (
    <AdminPageScaffold className="therapist-dashboard-fade mx-auto w-full max-w-[640px] gap-6 pb-24 md:pb-12">
      <header id="admin-main">
        <DashboardHeader
          title={headerTitle}
          subtitle={subtitleParts.join(" · ")}
          lastChecked={lastChecked}
          roleLabel="Therapist"
          rangeLabel={rangeLabel}
          updatedAtIso={new Date().toISOString()}
        />
      </header>

      <ProfileCompletionNudge
        staffId={staffId}
        firstName={firstName}
        phone={profileCompletionFields.phone}
        shortBio={profileCompletionFields.shortBio}
        specialties={profileCompletionFields.specialties}
        languages={profileCompletionFields.languages}
        serviceAreas={profileCompletionFields.serviceAreas}
        profileCompletedAt={profileCompletionFields.profileCompletedAt}
      />

      {fullnessEnabled && personalStripeTiles && contribStripeRange ? (
        <PersonalContributionStripe
          tiles={personalStripeTiles}
          activeRange={contribStripeRange}
          variant="therapist"
          preservedSearchParams={preservedSearchParams}
        />
      ) : null}

      {fullnessEnabled && highlight ? (
        <HighlightOrTipStrip highlight={highlight} />
      ) : null}

      <DateRangeChips activeRange={activeRange} />

      {claimablePromoted ? (
        <ClaimableStrip
          claimable={claimable}
          serviceLookup={serviceLookup}
          assignmentByBookingId={claimableAssignmentByBookingId}
          promoted
        />
      ) : null}

      {/*
       * C-FIELDWORK Phase D — consumes the Phase C shared component in place
       * of this file's former local NextVisitHero / HeroEmptyState /
       * TodayVisitsList trio. `assignedToday` already excludes unassigned
       * bookings (those live in ClaimableStrip below, unchanged); the
       * component derives its own "remaining today" list by excluding
       * nextAppointment's id, which is the same set the old `remainingToday`
       * computed. Fix round (dual-claimable-UI bug): claimableCount is now
       * the real `claimable.length` so the component's own EmptyDayCard
       * branch correctly recognizes claimable work exists (it no longer
       * shows "Quiet day" copy when this file's own ClaimableStrip below
       * has real claimable bookings). showClaimableStrip={false} suppresses
       * the component's internal simple link-only strip, since this file
       * keeps its own richer per-card ClaimableStrip (claim buttons
       * included) rendered separately — both must not render at once.
       * Documented trade-off (see report): this loses the "Then" next-visit
       * preview and the hasClaimable-aware empty-state copy, which lived only
       * in the removed local components. The dynamic hero eyebrow
       * ("Tomorrow's first visit" / "First visit back") was restored in the
       * C-11 Phase D follow-up via the component's new optional `eyebrow`
       * prop (Owner-authorised); the "Then" preview stays dropped.
       */}
      <PractitionerTodaySection
        staffName={staffName}
        todayAppointments={assignedToday}
        nextAppointment={nextAppointment}
        claimableCount={claimable.length}
        showClaimableStrip={false}
        nextAppointmentAssignmentId={nextAppointmentAssignmentId}
        serviceLookup={serviceLookup}
        eyebrow={heroEyebrow}
      />

      {fullyQuiet && tomorrowVisitCount > 0 ? (
        <Link
          href="/admin/bookings?view=upcoming"
          className="inline-flex items-center justify-between gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
        >
          <span>
            Tomorrow: {tomorrowVisitCount} visit
            {tomorrowVisitCount === 1 ? "" : "s"}
          </span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}

      {claimablePromoted ? null : (
        <ClaimableStrip
          claimable={claimable}
          serviceLookup={serviceLookup}
          assignmentByBookingId={claimableAssignmentByBookingId}
        />
      )}

      {fullnessEnabled && fullnessRecentClients.length > 0 ? (
        <RecentClientsStrip clients={fullnessRecentClients} />
      ) : null}

      <MyWeekDisclosure
        staffName={staffName}
        hasActivity={tierTwoHasActivity}
        weekVisits={completedThisWeek.length}
        hoursWorked={weekHoursLabel}
        weekCount={weekCount}
        completionRate={completionRate}
        noShowCount={noShowCount}
        recentClients={recentClients}
        serviceMixRows={serviceMixRows}
        serviceMixTotal={serviceMixTotal}
      />

      {fullnessEnabled && quickHelpLinks.length > 0 ? (
        <QuickHelpPanel links={quickHelpLinks} />
      ) : null}
    </AdminPageScaffold>
  );
}


function DateRangeChips({ activeRange }: { activeRange: string }) {
  // ≥768px only. Mobile (<768px) omits the strip entirely per brief.
  //
  // Range keys must match parseReportFilters cases (reports/reporting.ts):
  //   - `today`     → today only
  //   - `tomorrow`  → tomorrow only (added 2026-05-25 audit fix; previously
  //                   silently fell through to a month-forward window)
  //   - `this_week` → calendar Mon–Sun of the current week (added in same
  //                   audit fix; previously used `week` which is rolling
  //                   +7 business days and mismatched the "This week" label)
  //   - (`custom` chip removed — Therapist surface has no inline custom-date
  //      form; chip linked to a degenerate single-day window. Worker view is
  //      intentionally minimal per brief §5.2.)
  const chips: Array<{ label: string; range: string }> = [
    { label: "Today", range: "today" },
    { label: "Tomorrow", range: "tomorrow" },
    { label: "This week", range: "this_week" },
  ];
  return (
    <nav
      aria-label="Date range"
      className="hidden md:flex md:flex-wrap md:gap-2"
    >
      {chips.map((chip) => {
        const isActive = chip.range === activeRange;
        return (
          <Link
            key={chip.range}
            href={`/admin/dashboard?range=${chip.range}`}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "inline-flex h-9 items-center rounded-full border border-[var(--admin-primary)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors duration-150 ease-out focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
                : "inline-flex h-9 items-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
            }
          >
            {chip.label}
          </Link>
        );
      })}
    </nav>
  );
}

function StatusPill({
  family,
  label,
}: {
  family: "confirmed" | "pending" | "cancelled" | "completed" | "attention" | "restricted";
  label: string;
}) {
  const styleMap: Record<typeof family, { bg: string; text: string; icon: LucideIcon }> = {
    confirmed: {
      bg: "var(--status-confirmed-bg)",
      text: "var(--status-confirmed-text)",
      icon: CheckCircle2,
    },
    pending: {
      bg: "var(--status-pending-bg)",
      text: "var(--status-pending-text)",
      icon: Clock,
    },
    cancelled: {
      bg: "var(--status-cancelled-bg)",
      text: "var(--status-cancelled-text)",
      icon: XCircle,
    },
    completed: {
      bg: "var(--status-completed-bg)",
      text: "var(--status-completed-text)",
      icon: CircleCheck,
    },
    attention: {
      bg: "var(--status-attention-bg)",
      text: "var(--status-attention-text)",
      icon: Clock,
    },
    restricted: {
      bg: "var(--status-restricted-bg)",
      text: "var(--status-restricted-text)",
      icon: Lock,
    },
  };
  const tones = styleMap[family];
  const Icon = tones.icon;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: tones.bg, color: tones.text }}
    >
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}

function ClaimableStrip({
  claimable,
  serviceLookup,
  assignmentByBookingId,
  promoted = false,
}: {
  claimable: ReportData["bookings"];
  serviceLookup: Map<string, ServiceMeta>;
  assignmentByBookingId: Map<string, string>;
  /**
   * B-5 promotion (brief §5.6 block 7): when Today + Next Visit are both empty
   * but claimable work exists, the strip moves up in the page flow AND uses
   * the B-1 `--admin-warning-bg-strong` token to invite engagement.
   */
  promoted?: boolean;
}) {
  return (
    <section
      aria-labelledby="claimable-heading"
      data-promoted={promoted ? "true" : "false"}
      className="flex flex-col gap-4 rounded-[var(--admin-radius-card)] border p-5 sm:p-6"
      style={
        promoted
          ? {
              backgroundColor: "var(--admin-warning-bg-strong)",
              borderColor: "var(--admin-warning)",
            }
          : {
              backgroundColor: "var(--status-attention-bg)",
              borderColor: "var(--status-attention-text)",
            }
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="claimable-heading"
          style={{ fontFamily: "var(--font-urbanist), var(--font-work-sans), Arial, sans-serif" }} className="flex items-center gap-2 text-[1.333rem] font-semibold tracking-[-0.01em] text-[var(--admin-heading)]"
        >
          Open to claim
          {claimable.length > 0 ? (
            <AdminStatusBadge value={claimable.length} tone="warning" compact />
          ) : null}
        </h2>
        {claimable.length > 5 ? (
          <Link
            href="/admin/bookings?view=claimable"
            className="hidden text-xs font-semibold text-[var(--admin-body)] underline-offset-4 hover:underline lg:inline-flex"
          >
            See all {claimable.length} →
          </Link>
        ) : null}
      </div>

      {claimable.length === 0 ? (
        <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
          Nothing open right now.
        </p>
      ) : (
        <ul
          className="m-0 flex list-none gap-3 overflow-x-auto p-0 lg:grid lg:grid-cols-3 lg:overflow-visible"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {claimable.slice(0, 5).map((booking) => (
            <li
              key={booking.id}
              className="min-w-[280px] shrink-0 lg:min-w-0"
              style={{ scrollSnapAlign: "start" }}
            >
              <ClaimableCard
                booking={booking}
                service={serviceLookup.get(booking.id)}
                assignmentId={assignmentByBookingId.get(booking.id) ?? null}
              />
            </li>
          ))}
          {claimable.length > 5 ? (
            <li
              aria-hidden="true"
              className="flex min-w-[40px] shrink-0 items-center justify-center text-[var(--admin-text-muted)] lg:hidden"
            >
              <ArrowRight className="size-5" />
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

function ClaimableCard({
  booking,
  service,
  assignmentId,
}: {
  booking: ReportData["bookings"][number];
  service?: ServiceMeta;
  /**
   * Unassigned `booking_assignments.id` matched to this booking. Drives the
   * inline <ClaimAssignmentButton> (M3 fix). Null when no claimable assignment
   * row is available — in practice that should not happen because the booking
   * landed in the claimable strip via an unassigned assignment, but we tolerate
   * it defensively (button just hides).
   */
  assignmentId: string | null;
}) {
  const time = booking.start_time?.slice(0, 5) ?? "—";
  const date = booking.booking_date
    ? FORMATTERS.weekday.format(new Date(`${booking.booking_date}T12:00:00Z`))
    : "";
  const clientName = booking.contact_full_name ?? "Client";
  const serviceName = service?.name?.trim() ? service.name : "Visit";
  return (
    <article className="flex h-full flex-col gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4">
      <header className="flex flex-col gap-1">
        <p className="truncate text-sm font-semibold text-[var(--admin-heading)]">
          {getFirstName(clientName)} · {serviceName}
        </p>
        <p className="text-xs text-[var(--admin-text-muted)]">
          {date} · {time}
        </p>
      </header>
      <StatusPill family="attention" label="Available" />
      {/*
       * M3 fix (B-5 step 4 — AUDIT C4): inline <ClaimAssignmentButton> beside
       * the View link. Optimistic claim + sonner toast; NO confirm modal
       * (matches the existing booking-detail behaviour). View link continues
       * to deep-link into the booking record for full context.
       */}
      <div className="mt-auto flex flex-wrap items-stretch gap-2">
        <Link
          href={`/admin/bookings/${booking.id}`}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
        >
          View
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        {assignmentId ? (
          <ClaimAssignmentButton assignmentId={assignmentId} />
        ) : null}
      </div>
    </article>
  );
}

function MyWeekDisclosure({
  staffName,
  hasActivity,
  weekVisits,
  hoursWorked,
  weekCount,
  completionRate,
  noShowCount,
  recentClients,
  serviceMixRows,
  serviceMixTotal,
}: {
  staffName: string;
  hasActivity: boolean;
  weekVisits: number;
  hoursWorked: string;
  weekCount: number;
  completionRate: number | null;
  noShowCount: number;
  recentClients: Array<{ name: string; lastDate: string; bookingId: string }>;
  serviceMixRows: Array<[string, number]>;
  serviceMixTotal: number;
}) {
  const hintParts: string[] = [];
  if (weekVisits > 0) {
    hintParts.push(`${weekVisits} done · about ${hoursWorked} worked`);
  }
  if (weekCount > 0) {
    hintParts.push(`${weekCount} ahead`);
  }
  const hint =
    hintParts.length > 0
      ? hintParts.join(" · ")
      : "Your week's history and patterns will appear here.";

  // The BusinessOverviewDisclosure uses staffName as the storage key so each
  // therapist has their own collapsed/expanded preference.
  return (
    <BusinessOverviewDisclosure
      staffId={`therapist-week-${staffName || "anon"}`}
      variantKey="therapist-week-"
      hasActivity={hasActivity}
      labelActive="My week"
      labelQuiet="My week (no activity yet)"
      hint={hint}
      emptyHint="Stats and recent clients will appear here as the week unfolds."
      showAriaLabel="Show this week's summary"
      hideAriaLabel="Hide this week's summary"
    >
      <div className="flex flex-col gap-4">
        <WeeklyStatsCard
          weekVisits={weekVisits}
          hoursWorked={hoursWorked}
          weekCount={weekCount}
          completionRate={completionRate}
          noShowCount={noShowCount}
        />
        {recentClients.length > 0 ? (
          <RecentClientsCard clients={recentClients} />
        ) : null}
        {serviceMixRows.length > 0 ? (
          <ServiceMixCard rows={serviceMixRows} total={serviceMixTotal} />
        ) : null}
      </div>
    </BusinessOverviewDisclosure>
  );
}

function WeeklyStatsCard({
  weekVisits,
  hoursWorked,
  weekCount,
  completionRate,
  noShowCount,
}: {
  weekVisits: number;
  hoursWorked: string;
  weekCount: number;
  completionRate: number | null;
  noShowCount: number;
}) {
  const isFreshWeek = weekVisits === 0 && weekCount === 0;
  return (
    <section
      aria-labelledby="weekly-stats-heading"
      className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5"
    >
      <h2
        id="weekly-stats-heading"
        style={{
          fontFamily:
            "var(--font-urbanist), var(--font-work-sans), Arial, sans-serif",
        }}
        className=" text-[1.333rem] font-semibold tracking-[-0.01em] text-[var(--admin-heading)]"
      >
        {isFreshWeek ? "Week starting" : "This week"}
      </h2>
      {isFreshWeek ? (
        <p className="mt-3 text-sm leading-6 text-[var(--admin-text-muted)]">
          0 visits · 0h
        </p>
      ) : (
        <dl className="mt-3 flex flex-col gap-1 text-sm text-[var(--admin-body)]">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[var(--admin-text-muted)]">Visits done</dt>
            <dd className="font-semibold text-[var(--admin-heading)]">
              {weekVisits}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[var(--admin-text-muted)]">Worked</dt>
            <dd className="font-semibold text-[var(--admin-heading)]">
              about {hoursWorked}
            </dd>
          </div>
          {weekCount > 0 ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[var(--admin-text-muted)]">Ahead</dt>
              <dd className="font-semibold text-[var(--admin-heading)]">
                {weekCount} visit{weekCount === 1 ? "" : "s"}
              </dd>
            </div>
          ) : null}
          {completionRate != null ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[var(--admin-text-muted)]">Completion</dt>
              <dd className="font-semibold text-[var(--admin-heading)]">
                {completionRate}%
              </dd>
            </div>
          ) : null}
          {noShowCount > 0 ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[var(--admin-text-muted)]">No-shows</dt>
              <dd className="font-semibold text-[var(--admin-heading)]">
                {noShowCount}
              </dd>
            </div>
          ) : null}
        </dl>
      )}
      {/* Brief §5.6 block 9: weekly summary links into the new B-3 Performance self-view. */}
      <Link
        href="/admin/me?range=this_week"
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--admin-body)] underline-offset-4 hover:underline focus-visible:underline"
      >
        View weekly detail
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}

function RecentClientsCard({
  clients,
}: {
  clients: Array<{ name: string; lastDate: string; bookingId: string }>;
}) {
  return (
    <section
      aria-labelledby="recent-clients-heading"
      className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5"
    >
      <h2
        id="recent-clients-heading"
        style={{
          fontFamily:
            "var(--font-urbanist), var(--font-work-sans), Arial, sans-serif",
        }}
        className=" text-[1.333rem] font-semibold tracking-[-0.01em] text-[var(--admin-heading)]"
      >
        Recent clients
      </h2>
      <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
        {clients.map((c) => {
          const initials = c.name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => Array.from(p)[0] ?? "")
            .join("")
            .toUpperCase();
          const dateLabel = FORMATTERS.weekday.format(
            new Date(`${c.lastDate}T12:00:00Z`)
          );
          return (
            <li key={c.bookingId}>
              <Link
                href={`/admin/bookings/${c.bookingId}`}
                className="flex items-center gap-3 rounded-[var(--admin-radius-control)] px-2 py-2 outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: "var(--status-confirmed-bg)",
                    color: "var(--status-confirmed-text)",
                  }}
                >
                  {initials || "—"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--admin-heading)]">
                  {c.name}
                </span>
                <span className="text-xs text-[var(--admin-text-muted)]">
                  {dateLabel}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ServiceMixCard({
  rows,
  total,
}: {
  rows: Array<[string, number]>;
  total: number;
}) {
  return (
    <section
      aria-labelledby="service-mix-heading"
      className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5"
    >
      <h2
        id="service-mix-heading"
        style={{
          fontFamily:
            "var(--font-urbanist), var(--font-work-sans), Arial, sans-serif",
        }}
        className=" text-[1.333rem] font-semibold tracking-[-0.01em] text-[var(--admin-heading)]"
      >
        Service mix
      </h2>
      <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
        What you&apos;ve been doing this week
      </p>
      <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
        {rows.map(([name, count]) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <li key={name} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-[var(--admin-body)]">
                  {name}
                </span>
                <span className="font-semibold text-[var(--admin-heading)]">
                  {count} · {pct}%
                </span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--admin-panel-muted)" }}
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: "var(--status-confirmed-text)",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
