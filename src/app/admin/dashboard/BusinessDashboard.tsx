// SERVER COMPONENT — Owner/Admin (business) dashboard variant.
//
// C-11 Phase B step 3a extracted the inline Business + Coordinator branch
// verbatim out of the tail of `dashboard/page.tsx`, together with the
// module-level helpers only that branch used. `page.tsx` keeps every data
// fetch (including the awaited claimable-count lookup) and passes the
// results in as props; this component derives + renders only.
//
// Step 3b composes the Business path from `blocks/` and applies the V-01
// reconciliation of the three overlapping urgency representations
// (brief §4.1 + Q9.1):
//   1. "Snapshot · Today" (TodayAtAGlanceCard) collapses into the header —
//      DashboardHeader's `scopeLabel` now carries today's + next-7-days
//      counts, so the marquee card is no longer a third urgency surface.
//   2. "Needs your attention" is promoted to the primary actionable stripe,
//      full-width directly under the filters, as `PendingBookingsStripe`.
//   3. "Operations Health" is demoted into a collapsed-by-default native
//      <details> "Health check" disclosure below the fold.
//
// Phase C step 6a moved the Coordinator arm into `CoordinatorDashboard.tsx`
// and the declarations both variants share into
// `dashboard-variant-shared.tsx`. What remains here renders the
// Business/Admin variant only; every `isCoordinatorVariant` gate is gone
// because it is now statically false.

import { ChevronDown, ChevronUp } from "lucide-react";
import { AdminPageScaffold } from "../components/admin-ui";
import { OperationsHealthCard } from "./dashboard-cards";
// C-11 Phase B step 3b — the shared blocks library is the composition
// surface. `DashboardHeader`, `MobileStickyActionBar`, `PendingBookingsStripe`
// (= `UrgentAttentionPanel`), `EnquiriesTodoStripe` (= `ActiveEnquiriesCard`)
// and `QuickHelpPanel` are re-exports of the canonical implementations, so
// this is a re-point rather than a duplicate rendering.
import {
  DashboardHeader,
  DashboardScopeToggle,
  EnquiriesTodoStripe,
  MobileStickyActionBar,
  PendingBookingsStripe,
  QuickHelpPanel,
} from "./blocks";
import type { ActiveEnquiryRow, AttentionSummaryRow } from "./blocks";
import { DashboardFiltersClient } from "./dashboard-filters-client";
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

// V-01 step 1 — the one payload the collapsed "Snapshot · Today" card owned
// that no other surface carries: today's count (and the rolling next-7-day
// count that sat beside it). The filter strip's scope bar shows the
// RANGE-scoped booking total, which is a different number whenever the range
// isn't "today", so this line is additive rather than a fourth repetition.
function formatTodayScopeLabel(todayCount: number, weekCount: number) {
  return `${todayCount} booking${todayCount === 1 ? "" : "s"} today · ${weekCount} in the next 7 days`;
}

// Business-tailored "Need help?" links (brief §4.1). Mirrors the shape of
// `quickHelpLinksForTherapist` — permission-gated, so a link never points at
// a surface the viewer would be bounced from.
function quickHelpLinksForBusiness(access: PermissionAccess): QuickHelpLink[] {
  const links: QuickHelpLink[] = [];
  if (access.reports) {
    links.push({ key: "reports", label: "Review weekly numbers", href: "/admin/reports" });
  }
  if (access.staff) {
    links.push({ key: "staff", label: "Manage staff", href: "/admin/staff" });
  }
  if (access.emails) {
    links.push({ key: "emails", label: "Configure emails", href: "/admin/emails" });
  }
  if (access.bookings) {
    links.push({
      key: "pending-bookings",
      label: "Check pending bookings",
      href: "/admin/bookings?view=attention",
    });
  }
  return links;
}

export function BusinessDashboard({
  profile,
  plan,
  data,
  filters,
  today,
  summary,
  attentionItems,
  rangeLabel,
  todayAppointments,
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
  const newEnquiries = data.enquiries.filter((enquiry) => enquiry.status === "new");
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

  // Active (new + contacted) enquiries, surfaced as the `EnquiriesTodoStripe`
  // per brief §4.1.
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

  const businessQuickHelpLinks = quickHelpLinksForBusiness(permissionAccess);

  // C-07 B2 (B-139) — Team/Mine scope. Read from `preservedSearchParams`,
  // which `page.tsx` already builds from the request's query string, so no new
  // prop is threaded through the shared variant contract. This mount is the
  // ONLY one: CoordinatorDashboard and TherapistDashboard never render the
  // toggle, so Coordinators and Therapists cannot see it.
  const scope = preservedSearchParams.scope === "mine" ? "mine" : "team";

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
        scopeLabel={formatTodayScopeLabel(todayAppointments.length, nextSevenDays.length)}
      />

      <div className="-mt-2 flex justify-end">
        <DashboardScopeToggle currentScope={scope} />
      </div>

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
       * V-01 step 2 — "Needs your attention" is the primary actionable
       * stripe: Business drops the "Snapshot · Today" card (its count now
       * rides in the header, step 1) and gives the stripe the full width.
       */}
      <PendingBookingsStripe rows={attentionSummaryRows} groups={attentionGroups} filterQuery={filterQuery} />

      {/*
       * Brief §4.1 — enquiries triage sits directly under the attention
       * stripe, and only when the viewer can actually work the queue.
       */}
      {permissionAccess.enquiries ? (
        <EnquiriesTodoStripe
          enquiries={activeEnquiries}
          totalActive={activeEnquiries.length}
          canManageEnquiries={permissionAccess.enquiries}
          hasAnyHandled={hasAnyHandledEnquiries}
        />
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

      {
        /*
         * V-01 step 3 — Operations Health is demoted from the full-width
         * primary panel B-5 promoted it to, into a collapsed-by-default
         * disclosure below the fold (brief §4.1 + Q9.1, which locks
         * "collapsed"). Nothing is hidden that isn't already represented:
         * every row here — failed emails, open operations, staff gaps,
         * new enquiries — also surfaces in the attention stripe above, which
         * is exactly the overlap V-01 flagged. Native <details> so the
         * disclosure is keyboard-accessible with no client JS.
         */
        showOperationsHealth ? (
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-4 py-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel)] focus-visible:ring-[3px] focus-visible:ring-[var(--admin-focus)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-canvas)] motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
              <span>Health check</span>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-[var(--admin-text-muted)]">
                <span className="group-open:hidden">
                  <span className="sr-only">Show health check. </span>
                  Show
                </span>
                <span className="hidden group-open:inline">
                  <span className="sr-only">Hide health check. </span>
                  Hide
                </span>
                <span aria-hidden="true" className="inline-flex group-open:hidden">
                  <ChevronDown className="size-4" />
                </span>
                <span aria-hidden="true" className="hidden group-open:inline-flex">
                  <ChevronUp className="size-4" />
                </span>
              </span>
            </summary>
            <div className="mt-3">
              <OperationsHealthCard
                failedEmails={failedEmails.length}
                openEnquiries={newEnquiries.length}
                openOperations={openOperationalErrors.length}
                availabilityGaps={staffAvailabilityGaps.length}
                permissionAccess={permissionAccess}
              />
            </div>
          </details>
        ) : null
      }

      {/*
       * Brief §4.1 — the R05 "Need help?" pattern, Business-tailored.
       */}
      <QuickHelpPanel links={businessQuickHelpLinks} />

    </AdminPageScaffold>
    </PullToRefresh>
    <MobileStickyActionBar action={stripeStickyAction} />
    </>
  );
}
