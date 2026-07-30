// SERVER COMPONENT — Coordinator dashboard variant.
//
// C-11 Phase C step 6a split this out of `BusinessDashboard.tsx`, which had
// served both variants behind `plan.variant === "coordinator"` gates since
// Phase B. What follows is the coordinator arm of those gates, moved
// verbatim: the two-column Today panel + attention stripe grid, the
// practitioner-mode mount, and the "Active queues" disclosure carrying the
// enquiries stripe and Operations Health. Helpers used by both variants live
// in `dashboard-variant-shared.tsx`, which also owns the shared props
// contract; `page.tsx` still performs every data fetch.
//
// Step 6b composes the coordinator surface from `blocks/` per brief §4.2:
// `PendingBookingsStripe` and `EnquiriesTodoStripe` were already re-pointed
// re-exports (of `dashboard-cards.tsx`'s `UrgentAttentionPanel` /
// `ActiveEnquiriesCard`), so this step adds the three blocks §4.2 names that
// the coordinator arm never had — `ClaimQueueStripe`, `ScheduleGapStripe` and
// a coordinator-tailored `QuickHelpPanel` — and fixes B-01 (in
// `dashboard-cards.tsx`, where the mechanism actually lives).

import { AdminPageScaffold } from "../components/admin-ui";
import { findNextAppointment, formatNumber } from "../reports/reporting";
import { OperationsHealthCard, TodayAtAGlanceCard } from "./dashboard-cards";
import {
  ClaimQueueStripe,
  DashboardHeader,
  EnquiriesTodoStripe,
  MobileStickyActionBar,
  PendingBookingsStripe,
  QuickHelpPanel,
  ScheduleGapStripe,
} from "./blocks";
import type {
  ActiveEnquiryRow,
  AttentionSummaryRow,
  ClaimQueueBooking,
  ScheduleGap,
} from "./blocks";
import {
  BusinessOverviewDisclosure,
  DashboardFiltersClient,
} from "./dashboard-filters-client";
import { AdminErrorBoundary } from "../components/admin-error-boundary";
import type { DashboardVariant } from "./dashboard-data";
import {
  buildAttentionGroups,
  getDashboardCopy,
  getPermissionAccess,
  getRoleLabel,
  paymentOptions,
  sourceOptions,
  statusOptions,
  uniqueStrings,
  type DashboardVariantProps,
  type PermissionAccess,
} from "./dashboard-variant-shared";
import { PersonalContributionStripe } from "./PersonalContributionStripe";
import { PullToRefresh } from "./PullToRefresh";
import { LegacyDisclosureCleanup } from "./LegacyDisclosureCleanup";
import { PractitionerTodaySection } from "./PractitionerTodaySection";
import type { QuickHelpLink } from "./therapist-fullness";

// Same shape as `formatRowDate` in `dashboard-cards.tsx` (module-private
// there), for the pre-formatted day labels `ClaimQueueStripe` and
// `ScheduleGapStripe` expect.
const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/London",
});

function formatDayLabel(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return DAY_LABEL_FORMATTER.format(date);
}

function formatPeriodLabel(startTime: string) {
  const hour = Number(startTime.slice(0, 2));
  if (Number.isNaN(hour)) return "All day";
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

// Coordinator-tailored "Need help?" links (brief §4.2). Mirrors
// `quickHelpLinksForBusiness` in `BusinessDashboard.tsx` — permission-gated,
// so a link never points at a surface the viewer would be bounced from.
function quickHelpLinksForCoordinator(access: PermissionAccess): QuickHelpLink[] {
  const links: QuickHelpLink[] = [];
  if (access.bookings) {
    links.push({
      key: "pending-bookings",
      label: "Triage pending bookings",
      href: "/admin/bookings?view=unassigned",
    });
  }
  if (access.enquiries) {
    links.push({
      key: "enquiries",
      label: "Follow up on enquiries",
      href: "/admin/enquiries?tab=new",
    });
  }
  return links;
}

export function CoordinatorDashboard({
  profile,
  plan,
  data,
  filters,
  today,
  summary,
  attentionItems,
  dailySeries,
  rangeLabel,
  todayView,
  todayAppointments,
  upcomingInRange,
  nextSevenDays,
  needsAssignment,
  unassignedOnly,
  unpaidBookings,
  stripeVariant,
  stripeTiles,
  contribStripeRange,
  stripeStickyAction,
  preservedSearchParams,
  myTodayAppointments,
  myNextAppointment,
  myNextAppointmentAssignmentId,
  myClaimableCount,
  myServiceLookup,
}: DashboardVariantProps) {
  const failedEmails = data.emailEvents.filter((event) => event.delivery_status === "failed");
  const openOperationalErrors = data.operationalEvents.filter((event) => event.status === "open");
  const staffAvailabilityGaps = data.staff.filter(
    (member) =>
      member.active &&
      member.can_take_bookings &&
      member.availability_mode === "custom" &&
      !data.staffAvailabilityRuleStaffIds.includes(member.id)
  );
  const revenueAllowed = plan.includeRevenue;
  const permissionAccess = getPermissionAccess(profile);
  const dashboardCopy = getDashboardCopy(plan.variant, today);
  // Profile-derived label first (Owner vs Admin requires role.name); fall back
  // to variant-derived label when profile shape doesn't expose role string.
  const variantRoleLabelFallback: Record<DashboardVariant, string | null> = {
    business: "Admin",
    coordinator: "Coordinator",
    therapist: "Therapist",
    blocked: null,
  };
  const roleLabel =
    getRoleLabel(profile as unknown as { roles?: { name?: string | null }[]; role?: string }) ??
    variantRoleLabelFallback[plan.variant];
  const showOperationsHealth = plan.variant !== "therapist";
  const nextAppointment = findNextAppointment(data.bookings, today);
  const serviceOptions = uniqueStrings(data.bookingItems.map((item) => item.service_name_snapshot));
  const lastChecked = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date());

  const attentionGroups = buildAttentionGroups(attentionItems, permissionAccess, today);
  const attentionSummaryRows: AttentionSummaryRow[] = [
    {
      key: "emails",
      label: "Client confirmation emails",
      detail: failedEmails.length > 0 ? "Delivery failed or bounced" : "No failed delivery signals",
      count: failedEmails.length,
      severity: failedEmails.length > 0 ? "critical" : "clear",
      href: permissionAccess.emails ? "/admin/emails" : null,
    },
    {
      key: "operations",
      label: "Open operations",
      detail: openOperationalErrors.length > 0 ? "Issues require follow up" : "No open operational errors",
      count: openOperationalErrors.length,
      severity: openOperationalErrors.length > 0 ? "warning" : "clear",
      href: permissionAccess.operations ? "/admin/operations" : null,
    },
    {
      key: "staff-gaps",
      label: "Staff gaps",
      detail: staffAvailabilityGaps.length > 0 ? "Shifts needing coverage" : "Well covered",
      count: staffAvailabilityGaps.length,
      severity: staffAvailabilityGaps.length > 0 ? "warning" : "clear",
      href: permissionAccess.staff ? "/admin/staff" : null,
    },
  ];
  if (needsAssignment.length > 0) {
    attentionSummaryRows.push({
      key: "assignments",
      label: "Booking assignments",
      detail: "Bookings need therapist assignment",
      count: needsAssignment.length,
      severity: unassignedOnly.length > 0 ? "critical" : "warning",
      href: permissionAccess.bookings ? "/admin/bookings?view=unassigned" : null,
    });
  }
  // Coordinator never sees revenue surface (brief Section 11). Gate the
  // money-coded attention row on the same predicate as the Payments
  // ReadinessChip — `revenueAllowed` collapses correctly to `false` for
  // coordinator via plan.includeRevenue.
  if (revenueAllowed && unpaidBookings.length > 0) {
    attentionSummaryRows.push({
      key: "payments",
      label: "Payment follow up",
      detail: "Bookings need payment review",
      count: unpaidBookings.length,
      severity: "warning",
      href: permissionAccess.bookings ? "/admin/bookings?payment_status=unpaid" : null,
    });
  }

  const scopeSummary = {
    bookings: data.bookings.length,
    attention: attentionItems.length,
    outstanding: summary.outstandingRevenue,
    clients: summary.repeatClients + summary.newClients,
    rangeLabel,
    revenueAllowed,
  };

  const filterQueryParams = new URLSearchParams();
  if (filters.range) filterQueryParams.set("range", filters.range);
  if (filters.from) filterQueryParams.set("from", filters.from);
  if (filters.to) filterQueryParams.set("to", filters.to);
  if (filters.city) filterQueryParams.set("city", filters.city);
  if (filters.service) filterQueryParams.set("service", filters.service);
  if (filters.staffId) filterQueryParams.set("staffId", filters.staffId);
  if (filters.source) filterQueryParams.set("source", filters.source);
  if (filters.status) filterQueryParams.set("status", filters.status);
  if (filters.paymentStatus) filterQueryParams.set("paymentStatus", filters.paymentStatus);
  const filterQuery = filterQueryParams.toString();

  // Coordinator never sees revenue surface per brief Section 11; suppress payment string entirely
  // (RBAC + voice — Coordinator lacks view_reports_revenue, so this row should not synthesise
  // anything related to money, even copy).
  const showPaymentsReadiness = plan.variant !== "coordinator";
  const readiness = {
    confirmations: failedEmails.length > 0 ? `${formatNumber(failedEmails.length)} to review` : "All clear",
    staffCoverage: needsAssignment.length > 0 ? `${formatNumber(needsAssignment.length)} need assignment` : "Well covered",
    paymentCollection: !showPaymentsReadiness
      ? ""
      : plan.variant === "therapist"
        ? "Assigned work only"
        : unpaidBookings.length > 0
          ? `${formatNumber(unpaidBookings.length)} to collect`
          : "No activity yet",
  };

  // Coordinator-emphasis Today panel data: per-booking required gender
  // (derived from assignments), plus today inline count breakdown.
  const requiredGenderByBooking = new Map<string, string>();
  for (const assignment of data.assignments) {
    if (
      assignment.required_therapist_gender &&
      assignment.required_therapist_gender !== "any" &&
      !requiredGenderByBooking.has(assignment.booking_id)
    ) {
      requiredGenderByBooking.set(assignment.booking_id, assignment.required_therapist_gender);
    }
  }
  const coordinatorTodayCounts = {
    unassigned: todayAppointments.filter((b) => b.assignment_status === "unassigned").length,
    confirmed: todayAppointments.filter((b) => b.status === "confirmed").length,
    pending: todayAppointments.filter((b) => b.status === "pending").length,
  };

  // Active (new + contacted) enquiries, surfaced inside the Tier 2 "Active
  // queues" disclosure below.
  const activeEnquiries: ActiveEnquiryRow[] = data.enquiries
    .filter((e) => e.status === "new" || e.status === "contacted")
    .map((e) => ({
      id: e.id,
      fullName: e.full_name,
      source: e.source,
      status: e.status,
      createdAt: e.created_at,
    }));
  const hasAnyHandledEnquiries = data.enquiries.some(
    (e) => e.status !== "new" && e.status !== "contacted"
  );

  // brief §4.2 `ClaimQueueStripe` — the row-level view of the same unassigned
  // bookings the attention stripe counts, so a coordinator can open one
  // straight from the dashboard instead of pivoting through /admin/bookings.
  // Deliberately fed from `unassignedOnly` (not a re-derivation) so the two
  // surfaces can never disagree on what "unassigned" means.
  const claimQueueBookings: ClaimQueueBooking[] = unassignedOnly.map((booking) => ({
    id: booking.id,
    contactName: booking.contact_full_name ?? null,
    bookingDate: formatDayLabel(booking.booking_date),
    time: booking.start_time.slice(0, 5),
    city: booking.service_city ?? null,
    requiredGender: requiredGenderByBooking.get(booking.id) ?? null,
  }));

  // brief §4.2 `ScheduleGapStripe` — the pattern behind the claim queue: which
  // day / part of day / city the uncovered work clusters in. One entry per
  // distinct (day, period, city) that still has work nobody is covering.
  // `nextSevenDays` is itself bounded by the active filter range (page.tsx
  // derives it from `data.bookings`, which the query limits to
  // `filters.from..filters.to`), so the stripe is labelled for the selected
  // range rather than claiming a 7-day horizon it may not have.
  const scheduleGapsByKey = new Map<string, ScheduleGap>();
  for (const booking of nextSevenDays) {
    if (
      booking.assignment_status !== "unassigned" &&
      booking.assignment_status !== "partially_assigned"
    ) {
      continue;
    }
    const periodLabel = formatPeriodLabel(booking.start_time);
    const city = booking.service_city ?? null;
    const key = `${booking.booking_date}|${periodLabel}|${city ?? ""}`;
    if (scheduleGapsByKey.has(key)) continue;
    scheduleGapsByKey.set(key, {
      dateLabel: formatDayLabel(booking.booking_date),
      periodLabel,
      city,
    });
  }
  const scheduleGaps = [...scheduleGapsByKey.values()];

  const coordinatorQuickHelpLinks = quickHelpLinksForCoordinator(permissionAccess);

  return (
    <>
    <PullToRefresh>
    <AdminPageScaffold className="min-w-0 gap-4 grid-cols-[minmax(0,1fr)] pb-24 md:pb-8">
      <DashboardHeader
        title={dashboardCopy.title}
        subtitle={dashboardCopy.subtitle}
        lastChecked={lastChecked}
        roleLabel={roleLabel}
        rangeLabel={rangeLabel}
        updatedAtIso={new Date().toISOString()}
        scopeLabel={null}
      />

      <LegacyDisclosureCleanup staffId={profile.id} />

      <PersonalContributionStripe
        tiles={stripeTiles}
        activeRange={contribStripeRange}
        variant={stripeVariant}
        preservedSearchParams={preservedSearchParams}
      />

      <AdminErrorBoundary sectionName="Dashboard filters">
        <DashboardFiltersClient
          filters={filters}
          staff={data.staff}
          serviceOptions={serviceOptions}
          sourceOptions={sourceOptions}
          statusOptions={statusOptions}
          paymentOptions={paymentOptions}
          cityOptions={data.cityOptions}
          today={today}
          canExport={permissionAccess.viewReportsRevenue}
          scopeSummary={scopeSummary}
        />
      </AdminErrorBoundary>

      {/*
       * Coordinator's primary surface is the Today panel, with the attention
       * stripe beside it in a two-column grid.
       */}
      <section className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.95fr)]">
        <TodayAtAGlanceCard
          appointments={todayAppointments.map((booking) => ({
            id: booking.id,
            time: booking.start_time.slice(0, 5),
            endTime: booking.end_time?.slice(0, 5),
            title: booking.contact_full_name ?? "Unknown contact",
            detail: booking.service_city ?? "No city recorded",
            status: booking.assignment_status,
            href: permissionAccess.bookings ? `/admin/bookings/${booking.id}` : null,
            assignmentStatus: booking.assignment_status,
            bookingStatus: booking.status,
            requiredGender: requiredGenderByBooking.get(booking.id) ?? null,
          }))}
          upcomingAppointments={upcomingInRange.map((booking) => ({
            id: booking.id,
            date: booking.booking_date,
            time: booking.start_time.slice(0, 5),
            endTime: booking.end_time?.slice(0, 5),
            title: booking.contact_full_name ?? "Unknown contact",
            detail: booking.service_city ?? "No city recorded",
            status: booking.assignment_status,
            href: permissionAccess.bookings ? `/admin/bookings/${booking.id}` : null,
          }))}
          rangeKind={filters.range}
          rangeLabel={rangeLabel}
          dailySeries={dailySeries.map((d) => d.bookings)}
          filterQuery={filterQuery}
          scopeCount={data.bookings.length}
          todayView={todayView}
          todayCount={todayAppointments.length}
          weekCount={nextSevenDays.length}
          nextAppointment={
            nextAppointment
              ? {
                  date: nextAppointment.booking_date,
                  time: nextAppointment.start_time.slice(0, 5),
                  title: nextAppointment.contact_full_name ?? "Unknown contact",
                }
              : null
          }
          permissionAccess={permissionAccess}
          readiness={readiness}
          unassignedFirst
          coordinatorCounts={coordinatorTodayCounts}
          revenueAllowed={revenueAllowed}
          showPaymentsReadiness={showPaymentsReadiness}
        />
        <PendingBookingsStripe rows={attentionSummaryRows} groups={attentionGroups} filterQuery={filterQuery} />
      </section>

      {/*
       * brief §4.2 — the two coordinator-only queues, directly under the
       * attention stripe: what needs claiming, and where the coverage holes
       * cluster. Only mounted for viewers who can actually work bookings.
       */}
      {permissionAccess.bookings ? (
        <section className="grid min-w-0 items-start gap-4 md:grid-cols-2">
          <ClaimQueueStripe bookings={claimQueueBookings} />
          <ScheduleGapStripe gaps={scheduleGaps} rangeLabel="Selected range" />
        </section>
      ) : null}

      {/*
       * C-FIELDWORK Phase D — practitioner-mode mount for Business/
       * Coordinator viewers who also hold can_take_bookings. Brief §4.3
       * locked rule: wrap the mount itself in this condition rather than
       * relying on the component's own empty-state, so nothing renders at
       * all when there's truly nothing to show (avoids visual noise for the
       * common case of a non-practitioner Owner/Coordinator).
       */}
      {profile.can_take_bookings &&
      (myTodayAppointments.length > 0 || myNextAppointment || myClaimableCount > 0) ? (
        <PractitionerTodaySection
          staffName={profile.name}
          todayAppointments={myTodayAppointments}
          nextAppointment={myNextAppointment}
          claimableCount={myClaimableCount}
          nextAppointmentAssignmentId={myNextAppointmentAssignmentId}
          serviceLookup={myServiceLookup}
        />
      ) : null}

      <BusinessOverviewDisclosure
        staffId={profile.id}
        variantKey="coordinator-"
        labelActive="Active queues"
        labelQuiet="Active queues (nothing right now)"
        hint={
          activeEnquiries.length > 0 || openOperationalErrors.length > 0 || failedEmails.length > 0
            ? [
                activeEnquiries.length > 0
                  ? `${activeEnquiries.length} enquir${activeEnquiries.length === 1 ? "y" : "ies"}`
                  : null,
                openOperationalErrors.length + failedEmails.length > 0
                  ? `${openOperationalErrors.length + failedEmails.length} ops issue${openOperationalErrors.length + failedEmails.length === 1 ? "" : "s"}`
                  : null,
              ].filter(Boolean).join(" · ")
            : "Active enquiries and operational signals."
        }
        emptyHint="New enquiries and operational signals will appear here when they land."
        showAriaLabel="Show active queues"
        hideAriaLabel="Hide active queues"
        hasActivity={
          activeEnquiries.length > 0 ||
          failedEmails.length > 0 ||
          openOperationalErrors.length > 0 ||
          staffAvailabilityGaps.length > 0
        }
      >
        <section className="grid min-w-0 items-start gap-4 md:grid-cols-2">
          <EnquiriesTodoStripe
            enquiries={activeEnquiries}
            totalActive={activeEnquiries.length}
            canManageEnquiries={permissionAccess.enquiries}
            hasAnyHandled={hasAnyHandledEnquiries}
          />
          {showOperationsHealth ? (
            <OperationsHealthCard
              failedEmails={failedEmails.length}
              openEnquiries={0}
              openOperations={openOperationalErrors.length}
              availabilityGaps={staffAvailabilityGaps.length}
              permissionAccess={permissionAccess}
            />
          ) : null}
        </section>
      </BusinessOverviewDisclosure>

      {/*
       * brief §4.2 — the R05 "Need help?" pattern, Coordinator-tailored.
       */}
      <QuickHelpPanel links={coordinatorQuickHelpLinks} />

    </AdminPageScaffold>
    </PullToRefresh>
    <MobileStickyActionBar action={stripeStickyAction} />
    </>
  );
}
