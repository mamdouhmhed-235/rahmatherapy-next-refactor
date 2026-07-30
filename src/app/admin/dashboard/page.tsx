import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addBusinessDays, getBusinessDate } from "@/lib/time/london";
import {
  canViewAssignedBookings,
  getStaffProfile,
} from "@/lib/auth/rbac";
import { getAdminPageAccess } from "@/lib/auth/admin-access";
import { AdminAccessDenied } from "../components/admin-ui";
import {
  findNextAppointment,
  getAttentionItems,
  getStaffScorecard,
  parseReportFilters,
  summarizeReports,
} from "../reports/reporting";
import { getDashboardData } from "./dashboard-data";
import { buildDemandTrendData } from "./dashboard-helpers";
import {
  getPriorStripeDateRange,
  getStripeDateRange,
  mobileStickyActionForVariant,
  tilesForVariant,
  type StripeRange,
} from "./dashboard-helpers-b5";
import { parseStripeRange } from "./PersonalContributionStripe";
import { MobileStickyActionBar } from "./MobileStickyActionBar";
import { PullToRefresh } from "./PullToRefresh";
import { LegacyDisclosureCleanup } from "./LegacyDisclosureCleanup";
import { TherapistDashboard } from "./TherapistDashboard";
import { BusinessDashboard } from "./BusinessDashboard";
import { resolveAdminShellVariant } from "../shell-variant";
import { buildServiceLookup, type ServiceMeta } from "./shared-helpers";
import { getScopedBookingIds } from "../bookings/page";

export const metadata = {
  title: "Dashboard - Rahma Therapy Admin",
};

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function formatRangeLabel(range: string, from: string, to: string) {
  const formatShort = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }).format(d);
  };
  const formatWeekday = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" }).format(d);
  };
  const formatMonth = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Europe/London" }).format(d);
  };
  if (range === "today") return `Today (${formatWeekday(from)})`;
  if (range === "this_week") return `This week (${formatShort(from)} – ${formatShort(to)})`;
  if (range === "this_month") return `This month (${formatMonth(from)})`;
  if (range === "last_30") return `Last 30 days (${formatShort(from)} – ${formatShort(to)})`;
  return `${formatShort(from)} – ${formatShort(to)}`;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");
  const dashboardAccess = getAdminPageAccess(profile, "dashboard");
  if (!dashboardAccess.access) return <InsufficientPermissions />;

  const today = getBusinessDate();
  const params = await searchParams;
  const filters = parseReportFilters({
    range: params.range ?? "today",
    from: params.from ?? today,
    to: params.to ?? today,
    staffId: params.staffId,
    service: params.service,
    source: params.source,
    status: params.status,
    paymentStatus: params.paymentStatus,
    city: params.city,
  });
  const adminClient = createSupabaseAdminClient();

  // Personal Stripe (B-5 §5.1) period is independent of the filter strip; we
  // fetch its own getDashboardData scope plus an immediately-preceding window
  // for prior-period deltas. Per SHARED-NOTES §11 budget: 3 helper invocations
  // total (existing + stripe + stripe-prior) — well under the 6-query cap.
  // `unstable_cache` deduplicates if any of these happen to share a key.
  const rawStripeRange = Array.isArray(params.contribStripeRange)
    ? params.contribStripeRange[0]
    : params.contribStripeRange;
  const contribStripeRange: StripeRange = parseStripeRange(rawStripeRange);
  const stripeWindow = getStripeDateRange(contribStripeRange, today);
  const stripePriorWindow = getPriorStripeDateRange(contribStripeRange, today);
  const stripeFilters = parseReportFilters({
    range: "custom",
    from: stripeWindow.from,
    to: stripeWindow.to,
  });
  const stripePriorFilters = parseReportFilters({
    range: "custom",
    from: stripePriorWindow.from,
    to: stripePriorWindow.to,
  });

  const [
    { data, plan },
    { data: stripeData },
    { data: stripePriorData },
  ] = await Promise.all([
    getDashboardData(adminClient, profile, filters),
    getDashboardData(adminClient, profile, stripeFilters),
    getDashboardData(adminClient, profile, stripePriorFilters),
  ]);

  const summary = summarizeReports(data);
  const attentionItems = getAttentionItems(data);
  const dailySeries = buildDemandTrendData(data.bookings, filters.from, filters.to);
  const rangeLabel = formatRangeLabel(filters.range, filters.from, filters.to);
  const todayView: "list" | "timeline" = params.todayView === "timeline" ? "timeline" : "list";

  const todayAppointments: typeof data.bookings = [];
  const upcomingInRange: typeof data.bookings = [];
  const nextSevenDays: typeof data.bookings = [];
  const needsAssignment: typeof data.bookings = [];
  const unassignedOnly: typeof data.bookings = [];
  const unpaidBookings: typeof data.bookings = [];
  const sevenDayLimit = addBusinessDays(today, 7);

  for (const booking of data.bookings) {
    if (
      booking.booking_date === today &&
      !["cancelled", "no_show"].includes(booking.status)
    )
      todayAppointments.push(booking);
    if (
      booking.booking_date >= today &&
      booking.booking_date <= filters.to &&
      !["cancelled", "no_show"].includes(booking.status)
    ) {
      upcomingInRange.push(booking);
    }
    if (
      booking.booking_date >= today &&
      booking.booking_date <= sevenDayLimit &&
      !["cancelled", "no_show"].includes(booking.status)
    ) {
      nextSevenDays.push(booking);
    }
    if (
      booking.assignment_status === "unassigned" &&
      !["cancelled", "no_show"].includes(booking.status)
    ) {
      unassignedOnly.push(booking);
      needsAssignment.push(booking);
    } else if (
      booking.assignment_status === "partially_assigned" &&
      !["cancelled", "no_show"].includes(booking.status)
    ) {
      needsAssignment.push(booking);
    }
    if (
      booking.payment_status === "unpaid" &&
      !["cancelled", "no_show"].includes(booking.status)
    ) {
      unpaidBookings.push(booking);
    }
  }

  // ── Personal Stripe + Mobile sticky bar setup (B-5 steps 2, 5, 8) ──────────
  // Computed before the variant branching so both Therapist branch (props
  // forwarded to TherapistDashboard) and Business/Coordinator branch (rendered
  // inline) consume the same canonical inputs.
  const stripeVariant =
    plan.variant === "therapist"
      ? "therapist"
      : plan.variant === "coordinator"
        ? "coordinator"
        : "business";
  const stripeScorecard = getStaffScorecard(
    stripeData,
    profile.id,
    stripePriorData
  );
  const stripeNextAppointment =
    stripeVariant === "therapist"
      ? findNextAppointment(data.bookings, today)
      : null;
  // New enquiries CREATED in the stripe period — for Coordinator tile 1.
  // `stripeData.enquiries` returns all visible enquiries unfiltered by date,
  // so we filter on `created_at` here. ISO-prefix string compare is safe
  // because `created_at` is timestamptz formatted ISO 8601 and the stripe
  // window from/to are yyyy-mm-dd.
  const newEnquiriesInPeriod =
    stripeVariant === "coordinator"
      ? stripeData.enquiries.filter((e) => {
          const d = e.created_at?.slice(0, 10) ?? "";
          return d >= stripeWindow.from && d <= stripeWindow.to;
        }).length
      : 0;
  const stripeTiles = tilesForVariant(stripeVariant, stripeScorecard, {
    staffId: profile.id,
    nextAppointment: stripeNextAppointment,
    newEnquiriesInPeriod,
  });

  // Therapist claimable count for the sticky bar fallback ladder (AUDIT Q5).
  const claimableForTherapistCount =
    stripeVariant === "therapist"
      ? data.bookings.filter(
          (b) =>
            b.assignment_status === "unassigned" &&
            b.booking_date >= today &&
            !["cancelled", "no_show"].includes(b.status)
        ).length
      : 0;
  const stripeStickyAction = mobileStickyActionForVariant({
    variant: stripeVariant,
    staffId: profile.id,
    unassignedCount: needsAssignment.length,
    claimableCount: claimableForTherapistCount,
    nextAppointment: stripeNextAppointment,
  });

  // Preserved search params for the period-picker links (everything except
  // contribStripeRange, which the picker controls). Array-valued params
  // collapse to the first entry — keeps URL shapes stable.
  const preservedSearchParams: Record<string, string> = {};
  for (const [key, val] of Object.entries(params)) {
    if (key === "contribStripeRange") continue;
    const single = Array.isArray(val) ? val[0] : val;
    if (typeof single === "string" && single.length > 0) {
      preservedSearchParams[key] = single;
    }
  }

  // Therapist branch: focused worker UI. The owner/admin/coordinator
  // command-centre below is admin chrome that's noise for therapists.
  if (resolveAdminShellVariant(profile) === "therapist") {
    return (
      <>
        <PullToRefresh>
          <LegacyDisclosureCleanup staffId={profile.id} />
          <TherapistDashboard
            staffId={profile.id}
            staffName={profile.name}
            today={today}
            data={data}
            weekCount={
              data.bookings.filter((booking) => {
                const sevenDayLimit = addBusinessDays(today, 7);
                return (
                  booking.booking_date >= today &&
                  booking.booking_date <= sevenDayLimit &&
                  !["cancelled", "no_show"].includes(booking.status)
                );
              }).length
            }
            todayAppointments={data.bookings.filter(
              (booking) =>
                booking.booking_date === today &&
                !["cancelled", "no_show"].includes(booking.status)
            )}
            nextAppointment={stripeNextAppointment}
            activeRange={filters.range}
            profileCompletionFields={{
              phone: profile.phone ?? null,
              shortBio: profile.short_bio ?? null,
              specialties: profile.specialties ?? null,
              languages: profile.languages ?? null,
              serviceAreas: profile.service_areas ?? null,
              profileCompletedAt: profile.profile_completed_at ?? null,
            }}
            personalStripeTiles={stripeTiles}
            contribStripeRange={contribStripeRange}
            preservedSearchParams={preservedSearchParams}
            stripeScorecard={stripeScorecard}
            stripePriorScorecard={getStaffScorecard(stripePriorData, profile.id)}
            quickHelpPermissions={{
              canEditProfile: true,
              canEditAvailability: getAdminPageAccess(profile, "availability")
                .access,
              canBrowseClaimable: canViewAssignedBookings(profile),
              canViewOwnBookings: canViewAssignedBookings(profile),
            }}
          />
        </PullToRefresh>
        <MobileStickyActionBar action={stripeStickyAction} />
      </>
    );
  }

  // C-FIELDWORK Phase D — practitioner-mode "today" data for Business/
  // Coordinator viewers who also hold can_take_bookings (e.g. an Owner or
  // Coordinator who personally takes appointments). This is deliberately NOT
  // the practice-wide `nextAppointment`/`findNextAppointment` used by the KPI
  // tile above — it's this viewer's OWN active assignments, derived from
  // data already fetched (data.assignments/data.bookings/data.bookingItems).
  // The only new query is the gender-scoped claimable count below, and it
  // only fires when the capability gate is true — non-practitioners pay no
  // cost (brief §9.4 + plan's risk-table gating).
  const myAssignedBookingIds = profile.can_take_bookings
    ? new Set(
        data.assignments
          .filter(
            (a) =>
              a.assigned_staff_id === profile.id &&
              a.status !== "unassigned" &&
              a.status !== "cancelled"
          )
          .map((a) => a.booking_id)
      )
    : new Set<string>();
  const myTodayAppointments = profile.can_take_bookings
    ? data.bookings.filter(
        (b) =>
          myAssignedBookingIds.has(b.id) &&
          b.booking_date === today &&
          !["cancelled", "no_show"].includes(b.status)
      )
    : [];
  const myUpcoming = profile.can_take_bookings
    ? [...data.bookings]
        .filter(
          (b) =>
            myAssignedBookingIds.has(b.id) &&
            b.booking_date >= today &&
            !["cancelled", "no_show"].includes(b.status)
        )
        .sort(
          (a, b) =>
            a.booking_date.localeCompare(b.booking_date) ||
            a.start_time.localeCompare(b.start_time)
        )
    : [];
  const myNextAppointment = myUpcoming[0] ?? null;
  const myNextAppointmentAssignmentId = myNextAppointment
    ? (data.assignments.find(
        (a) =>
          a.booking_id === myNextAppointment.id &&
          a.assigned_staff_id === profile.id
      )?.id ?? null)
    : null;
  const myServiceLookup = profile.can_take_bookings
    ? buildServiceLookup(data.bookingItems)
    : new Map<string, ServiceMeta>();
  // Gender-matched, same scoping the Therapist variant already gets from
  // dashboard-data.ts (brief §9.4 locked decision) — one extra DB round trip,
  // gated behind the capability check.
  const myClaimableCount = profile.can_take_bookings
    ? (await getScopedBookingIds(profile)).claimableIds.length
    : 0;

  return (
    <BusinessDashboard
      profile={profile}
      plan={plan}
      data={data}
      filters={filters}
      today={today}
      summary={summary}
      attentionItems={attentionItems}
      dailySeries={dailySeries}
      rangeLabel={rangeLabel}
      todayView={todayView}
      todayAppointments={todayAppointments}
      upcomingInRange={upcomingInRange}
      nextSevenDays={nextSevenDays}
      needsAssignment={needsAssignment}
      unassignedOnly={unassignedOnly}
      unpaidBookings={unpaidBookings}
      stripeVariant={stripeVariant}
      stripeTiles={stripeTiles}
      contribStripeRange={contribStripeRange}
      stripeStickyAction={stripeStickyAction}
      preservedSearchParams={preservedSearchParams}
      myTodayAppointments={myTodayAppointments}
      myNextAppointment={myNextAppointment}
      myNextAppointmentAssignmentId={myNextAppointmentAssignmentId}
      myClaimableCount={myClaimableCount}
      myServiceLookup={myServiceLookup}
    />
  );
}

function InsufficientPermissions() {
  return (
    <AdminAccessDenied
      title="Dashboard access limited"
      message="You need dashboard, reporting, or own-booking permission to view this area."
      permission="view_dashboard or view_reports_own"
    />
  );
}

