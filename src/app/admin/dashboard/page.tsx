import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addBusinessDays, getBusinessDate } from "@/lib/time/london";
import {
  canManageOperations,
  canOpenReports,
  canViewStaff,
  canManageBookings,
  canManageEnquiries,
  canViewEmailLogs,
  canViewAllBookings,
  canViewAssignedBookings,
  canViewRevenueReports,
  getStaffProfile,
} from "@/lib/auth/rbac";
import { getAdminPageAccess } from "@/lib/auth/admin-access";
import {
  AdminAccessDenied,
  AdminPageScaffold,
} from "../components/admin-ui";
import {
  findNextAppointment,
  formatNumber,
  getAttentionItems,
  getStaffScorecard,
  humanizeEventType,
  parseReportFilters,
  summarizeReports,
} from "../reports/reporting";
import {
  ActiveEnquiriesCard,
  AttentionItemCard,
  OperationsHealthCard,
  TodayAtAGlanceCard,
  UrgentAttentionPanel,
} from "./dashboard-cards";
import type {
  ActiveEnquiryRow,
  AttentionGroup,
  AttentionSeverity,
  AttentionSummaryRow,
} from "./dashboard-cards";
import {
  BusinessOverviewDisclosure,
  DashboardFiltersClient,
} from "./dashboard-filters-client";
import { AdminErrorBoundary } from "../components/admin-error-boundary";
import { DashboardHeader } from "./dashboard-header";
import { getDashboardData, type DashboardVariant } from "./dashboard-data";
import { buildDemandTrendData } from "./dashboard-helpers";
import {
  getPriorStripeDateRange,
  getStripeDateRange,
  mobileStickyActionForVariant,
  tilesForVariant,
  type StripeRange,
} from "./dashboard-helpers-b5";
import {
  PersonalContributionStripe,
  parseStripeRange,
} from "./PersonalContributionStripe";
import { MobileStickyActionBar } from "./MobileStickyActionBar";
import { PullToRefresh } from "./PullToRefresh";
import { LegacyDisclosureCleanup } from "./LegacyDisclosureCleanup";
import { TherapistDashboard } from "./TherapistDashboard";
import { resolveAdminShellVariant } from "../shell-variant";
import { PractitionerTodaySection } from "./PractitionerTodaySection";
import { buildServiceLookup, type ServiceMeta } from "./shared-helpers";
import { getScopedBookingIds } from "../bookings/page";

export const metadata = {
  title: "Dashboard - Rahma Therapy Admin",
};

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type StaffProfile = NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>;
type AttentionItem = ReturnType<typeof getAttentionItems>[number];

const sourceOptions = ["website", "phone", "whatsapp", "instagram", "referral", "admin", "manual", "other"];
const statusOptions = ["pending", "confirmed", "completed", "cancelled", "no_show"];
const paymentOptions = ["paid", "unpaid"];

type AttentionGroupMeta = {
  label: string;
  category: string;
  categoryLabel: string;
  order: number;
  href: (access: PermissionAccess) => string | null;
  actionLabel: string;
  summary: (count: number) => string;
};

const ATTENTION_GROUP_META: Record<string, AttentionGroupMeta> = {
  "assignment-unassigned": {
    label: "Unassigned bookings",
    category: "assignments",
    categoryLabel: "Assignments",
    order: 10,
    href: (access) => (access.bookings ? "/admin/bookings?view=unassigned" : null),
    actionLabel: "Assign therapists",
    summary: (n) => `${n} booking${n !== 1 ? "s" : ""} need${n === 1 ? "s" : ""} a therapist before the client can be fully covered.`,
  },
  "assignment-partial": {
    label: "Partially assigned bookings",
    category: "assignments",
    categoryLabel: "Assignments",
    order: 20,
    href: (access) => (access.bookings ? "/admin/bookings?view=partial" : null),
    actionLabel: "Complete assignment",
    summary: (n) => `${n} booking${n !== 1 ? "s" : ""} still need${n === 1 ? "s" : ""} every session covered.`,
  },
  "payment-unpaid": {
    label: "Unpaid completed bookings",
    category: "payments",
    categoryLabel: "Payments",
    order: 30,
    href: (access) => (access.bookings ? "/admin/bookings?status=completed&payment_status=unpaid" : null),
    actionLabel: "Review payments",
    summary: (n) => `${n} completed booking${n !== 1 ? "s" : ""} need${n === 1 ? "s" : ""} payment follow-up.`,
  },
  "customer-reschedule": {
    label: "Reschedule requests",
    category: "clients",
    categoryLabel: "Clients",
    order: 40,
    href: (access) => (access.bookings ? "/admin/bookings?view=attention" : null),
    actionLabel: "Review requests",
    summary: (n) => `${n} client reschedule request${n !== 1 ? "s" : ""} need${n === 1 ? "s" : ""} a response.`,
  },
  "customer-cancellation": {
    label: "Customer cancellations",
    category: "clients",
    categoryLabel: "Clients",
    order: 50,
    href: (access) => (access.bookings ? "/admin/bookings?view=cancelled" : null),
    actionLabel: "Review cancelled",
    summary: (n) => `${n} cancelled or no-show booking${n !== 1 ? "s" : ""} need${n === 1 ? "s" : ""} review.`,
  },
  "customer-enquiry": {
    label: "New enquiries",
    category: "clients",
    categoryLabel: "Clients",
    order: 60,
    href: (access) => (access.enquiries ? "/admin/enquiries?tab=new" : null),
    actionLabel: "Contact enquiries",
    summary: (n) => `${n} new enquir${n === 1 ? "y" : "ies"} waiting for follow-up.`,
  },
  "booking-health": {
    label: "Health notes",
    category: "health",
    categoryLabel: "Health",
    order: 70,
    href: (access) => (access.bookings ? "/admin/bookings?view=attention" : null),
    actionLabel: "Review notes",
    summary: (n) => `${n} booking${n !== 1 ? "s" : ""} include${n === 1 ? "s" : ""} health notes therapists should review.`,
  },
  "system-operations": {
    label: "Operational errors",
    category: "operations",
    categoryLabel: "Operations",
    order: 80,
    href: (access) => (access.operations ? "/admin/operations" : null),
    actionLabel: "Open operations",
    summary: (n) => `${n} operational event${n !== 1 ? "s" : ""} need${n === 1 ? "s" : ""} acknowledgement or resolution.`,
  },
  "staff-availability": {
    label: "Availability gaps",
    category: "operations",
    categoryLabel: "Operations",
    order: 90,
    href: (access) => (access.staff ? "/admin/staff" : null),
    actionLabel: "Fix availability",
    summary: (n) => `${n} therapist availability gap${n !== 1 ? "s" : ""} may limit booking coverage.`,
  },
};

function getAttentionGroupKey(item: AttentionItem): string {
  if (item.label === "Failed email send") return `email-${item.detail}`;
  if (item.label === "Unassigned booking") return "assignment-unassigned";
  if (item.label === "Partially assigned booking") return "assignment-partial";
  if (item.label === "Unpaid completed booking") return "payment-unpaid";
  if (item.label === "Reschedule request") return "customer-reschedule";
  if (item.label === "Customer cancellation") return "customer-cancellation";
  if (item.label === "Uncontacted enquiry") return "customer-enquiry";
  if (item.label === "Booking with health notes") return "booking-health";
  if (item.label === "Operational error") return "system-operations";
  if (item.label === "Staff availability gap") return "staff-availability";
  return "system-operations";
}

function getAttentionGroupMeta(key: string, items: AttentionItem[]): AttentionGroupMeta {
  if (key.startsWith("email-")) {
    const eventType = items[0]?.detail ?? "email";
    return {
      label: `Email delivery: ${humanizeEventType(eventType)}`,
      category: "emails",
      categoryLabel: "Emails",
      order: 75,
      href: (access) => (access.emails ? "/admin/emails" : null),
      actionLabel: "Open email status",
      summary: (n) => `${n} failed email${n !== 1 ? "s" : ""} from this workflow need review.`,
    };
  }
  return ATTENTION_GROUP_META[key] ?? ATTENTION_GROUP_META["system-operations"];
}

function humanizeAttentionLabel(label: string): string {
  const map: Record<string, string> = {
    "Unassigned booking": "Unassigned booking needs therapist",
    "Partially assigned booking": "Booking needs full team",
    "Customer cancellation": "Customer cancelled booking",
    "Reschedule request": "Client requested reschedule",
    "Unpaid completed booking": "Completed booking not yet paid",
    "Booking with health notes": "Health conditions recorded",
    "Uncontacted enquiry": "New enquiry not yet contacted",
    "Failed email send": "Email delivery failed",
    "Operational error": "Operational system alert",
    "Staff availability gap": "Therapist has scheduling gap",
  };
  return map[label] ?? label;
}

function getAttentionImpact(item: AttentionItem): string | undefined {
  if (item.label === "Unassigned booking") return "Customer may not have a confirmed therapist.";
  if (item.label === "Partially assigned booking") return "Not all sessions have therapists assigned.";
  if (item.label === "Unpaid completed booking") return "Revenue from completed service not yet collected.";
  if (item.label === "Customer cancellation") return "Booking cancelled by customer; review and follow up.";
  if (item.label === "Reschedule request") return "Client wants to change date or time.";
  if (item.label === "Booking with health notes") return "Therapist should review health conditions before the visit.";
  if (item.label === "Failed email send") return "Client may not have received important communication.";
  if (item.label === "Operational error") return "System process failed and may affect workflow.";
  if (item.label === "Staff availability gap") return "No standard weekly availability rules configured.";
  if (item.label === "Uncontacted enquiry") return "Potential client waiting for a response.";
  return undefined;
}

function getAttentionSeverity(item: AttentionItem): AttentionSeverity {
  if (item.tone === "danger") return "critical";
  if (item.tone === "warning") return "warning";
  return "info";
}

function parseDateKey(value: string | undefined) {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

function getDayDifference(date: string | undefined, today: string) {
  const dateMs = parseDateKey(date);
  const todayMs = parseDateKey(today);
  if (dateMs === null || todayMs === null) return null;
  return Math.round((todayMs - dateMs) / 86_400_000);
}

function pluralDays(days: number) {
  return `${days} day${days === 1 ? "" : "s"}`;
}

function getAttentionAgeLabel(item: AttentionItem, today: string) {
  const diff = getDayDifference(item.date, today);
  if (diff === null) return undefined;
  if (item.label === "Failed email send") {
    return diff === 0 ? "Email failed today" : `Email failed ${pluralDays(Math.abs(diff))} ago`;
  }
  if (item.label === "Operational error" || item.label === "Uncontacted enquiry") {
    return diff === 0 ? "Opened today" : `${pluralDays(Math.abs(diff))} old`;
  }
  if (item.label === "Staff availability gap") return "Check today";
  if (diff === 0) return "Due today";
  if (diff > 0) return `Overdue by ${pluralDays(diff)}`;
  return `Due in ${pluralDays(Math.abs(diff))}`;
}

function getPrimaryActionLabel(item: AttentionItem) {
  if (item.label === "Unassigned booking") return "Assign therapist";
  if (item.label === "Partially assigned booking") return "Complete assignment";
  if (item.label === "Unpaid completed booking") return "Review payment";
  if (item.label === "Reschedule request") return "Review request";
  if (item.label === "Customer cancellation") return "Review cancellation";
  if (item.label === "Booking with health notes") return "Review notes";
  if (item.label === "Uncontacted enquiry") return "Contact";
  if (item.label === "Failed email send") return "Open email event";
  if (item.label === "Operational error") return "Open event";
  if (item.label === "Staff availability gap") return "Fix availability";
  return "View";
}

function buildAttentionGroups(items: AttentionItem[], permissionAccess: PermissionAccess, today: string): AttentionGroup[] {
  const grouped = new Map<string, AttentionItem[]>();
  for (const item of items) {
    const key = getAttentionGroupKey(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return [...grouped.entries()]
    .sort(([keyA, itemsA], [keyB, itemsB]) => {
      const metaA = getAttentionGroupMeta(keyA, itemsA);
      const metaB = getAttentionGroupMeta(keyB, itemsB);
      return metaA.order - metaB.order || itemsB.length - itemsA.length;
    })
    .map(([key, groupItems]) => {
      const meta = getAttentionGroupMeta(key, groupItems);
      const href = meta.href(permissionAccess);
      return {
        key,
        label: meta.label,
        category: meta.category,
        categoryLabel: meta.categoryLabel,
        priority: meta.order,
        count: groupItems.length,
        summary: meta.summary(groupItems.length),
        pageHref: href,
        href,
        actionLabel: meta.actionLabel,
        items: groupItems.map((item) => {
          const itemHref = getAccessibleAttentionHref(item.href, permissionAccess);
          return (
            <AttentionItemCard
              key={item.id}
              title={humanizeAttentionLabel(item.label)}
              detail={
                item.label === "Failed email send"
                  ? humanizeEventType(item.detail)
                  : item.detail
              }
              impact={getAttentionImpact(item)}
              severity={getAttentionSeverity(item)}
              date={item.date}
              ageLabel={getAttentionAgeLabel(item, today)}
              href={itemHref}
              primaryLabel={getPrimaryActionLabel(item)}
              secondaryHref={item.href.startsWith("/admin/bookings") && permissionAccess.bookings ? item.href : null}
              secondaryLabel="View booking"
            />
          );
        }),
      };
    });
}

interface PermissionAccess {
  bookings: boolean;
  calendar: boolean;
  reports: boolean;
  enquiries: boolean;
  emails: boolean;
  operations: boolean;
  staff: boolean;
  availability: boolean;
  viewReportsRevenue: boolean;
}

function getPermissionAccess(profile: StaffProfile): PermissionAccess {
  return {
    bookings: canManageBookings(profile) || canViewAllBookings(profile) || canViewAssignedBookings(profile),
    calendar: canViewAllBookings(profile) || canViewAssignedBookings(profile) || canManageBookings(profile),
    reports: canOpenReports(profile),
    enquiries: canManageEnquiries(profile),
    emails: canViewEmailLogs(profile),
    operations: canManageOperations(profile),
    staff: canViewStaff(profile),
    availability: getAdminPageAccess(profile, "availability").access,
    viewReportsRevenue: canViewRevenueReports(profile),
  };
}

function getAccessibleAttentionHref(href: string, access: PermissionAccess) {
  if (href.startsWith("/admin/bookings")) return access.bookings ? href : null;
  if (href.startsWith("/admin/enquiries")) return access.enquiries ? href : null;
  if (href.startsWith("/admin/emails")) return access.emails ? href : null;
  if (href.startsWith("/admin/operations")) return access.operations ? href : null;
  if (href.startsWith("/admin/staff")) {
    return access.staff || (access.availability && href.endsWith("/availability"))
      ? href
      : null;
  }
  return href;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
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

function formatBusinessDateSubtitle(today: string) {
  const date = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return today;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);
}

function getDashboardCopy(variant: DashboardVariant, today: string) {
  const formattedDate = formatBusinessDateSubtitle(today);
  if (variant === "coordinator") {
    return {
      title: "Today at Rahma Therapy",
      subtitle: `${formattedDate} · Luton`,
    };
  }
  if (variant === "therapist") {
    return {
      title: "Today at Rahma Therapy",
      subtitle: `${formattedDate} · Your work`,
    };
  }
  return {
    title: "Today at Rahma Therapy",
    subtitle: `${formattedDate} · Luton`,
  };
}

function getRoleLabel(profile: { roles?: { name?: string | null }[] | null; role?: string | null }) {
  type RoleLike = { name?: string | null };
  const rolesArr = (profile as { roles?: RoleLike[] | null }).roles;
  const roleName =
    (Array.isArray(rolesArr) && rolesArr[0]?.name) || profile.role || null;
  if (!roleName) return null;
  const lower = roleName.toLowerCase();
  if (lower.includes("owner") || lower === "main_admin" || lower === "main admin") return "Owner";
  if (lower.includes("admin") || lower.includes("manager")) return "Admin";
  if (lower.includes("coordinator")) return "Coordinator";
  if (lower.includes("therapist")) return "Therapist";
  return roleName.charAt(0).toUpperCase() + roleName.slice(1);
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
  const isCoordinatorVariant = plan.variant === "coordinator";
  const requiredGenderByBooking = new Map<string, string>();
  if (isCoordinatorVariant) {
    for (const assignment of data.assignments) {
      if (
        assignment.required_therapist_gender &&
        assignment.required_therapist_gender !== "any" &&
        !requiredGenderByBooking.has(assignment.booking_id)
      ) {
        requiredGenderByBooking.set(assignment.booking_id, assignment.required_therapist_gender);
      }
    }
  }
  const coordinatorTodayCounts = isCoordinatorVariant
    ? {
        unassigned: todayAppointments.filter((b) => b.assignment_status === "unassigned").length,
        confirmed: todayAppointments.filter((b) => b.status === "confirmed").length,
        pending: todayAppointments.filter((b) => b.status === "pending").length,
      }
    : undefined;

  // Coordinator-variant Tier 2 data: active (new + contacted) enquiries.
  const activeEnquiries: ActiveEnquiryRow[] = isCoordinatorVariant
    ? data.enquiries
        .filter((e) => e.status === "new" || e.status === "contacted")
        .map((e) => ({
          id: e.id,
          fullName: e.full_name,
          source: e.source,
          status: e.status,
          createdAt: e.created_at,
        }))
    : [];
  const coordinatorHasAnyHandledEnquiries = isCoordinatorVariant
    ? data.enquiries.some((e) => e.status !== "new" && e.status !== "contacted")
    : false;

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
          unassignedFirst={isCoordinatorVariant}
          coordinatorCounts={coordinatorTodayCounts}
          revenueAllowed={revenueAllowed}
          showPaymentsReadiness={showPaymentsReadiness}
        />
        <UrgentAttentionPanel rows={attentionSummaryRows} groups={attentionGroups} filterQuery={filterQuery} />
      </section>

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

      {isCoordinatorVariant ? (
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
            <ActiveEnquiriesCard
              enquiries={activeEnquiries}
              totalActive={activeEnquiries.length}
              canManageEnquiries={permissionAccess.enquiries}
              hasAnyHandled={coordinatorHasAnyHandledEnquiries}
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
      ) : (
        /*
         * B-5 Tier 1.5: OperationsHealth promoted from buried-inside-Tier-2
         * disclosure to a full-width primary panel (brief §5.5). The
         * disclosure wrapper + StaffCapacity / PaymentHealth / DemandTrend
         * / BusinessPulseCard sub-tiles are removed — their data lives in
         * the Reports B-4 surface now.
         */
        showOperationsHealth ? (
          <OperationsHealthCard
            failedEmails={failedEmails.length}
            openEnquiries={newEnquiries.length}
            openOperations={openOperationalErrors.length}
            availabilityGaps={staffAvailabilityGaps.length}
            permissionAccess={permissionAccess}
          />
        ) : null
      )}

    </AdminPageScaffold>
    </PullToRefresh>
    <MobileStickyActionBar action={stripeStickyAction} />
    </>
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

