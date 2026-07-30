// SERVER COMPONENT — Owner/Admin (business) + Coordinator dashboard variant.
//
// C-11 Phase B step 3a extracted the inline Business + Coordinator branch
// verbatim out of the tail of `dashboard/page.tsx`, together with the
// module-level helpers only that branch used. `page.tsx` keeps every data
// fetch (including the awaited claimable-count lookup) and passes the
// results in as props; this component derives + renders only.
//
// Step 3b (this revision) composes the Business path from `blocks/` and
// applies the V-01 reconciliation of the three overlapping urgency
// representations (brief §4.1 + Q9.1):
//   1. "Snapshot · Today" (TodayAtAGlanceCard) collapses into the header —
//      DashboardHeader's `scopeLabel` now carries today's + next-7-days
//      counts, so the marquee card is no longer a third urgency surface.
//   2. "Needs your attention" is promoted to the primary actionable stripe,
//      full-width directly under the filters, as `PendingBookingsStripe`.
//   3. "Operations Health" is demoted into a collapsed-by-default native
//      <details> "Health check" disclosure below the fold.
// The Coordinator path is deliberately UNCHANGED here — it keeps its Today
// panel, its two-column grid and its existing "Active queues" disclosure
// until Phase C splits it into its own file.

import { ChevronDown, ChevronUp } from "lucide-react";
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
  type StaffProfile,
} from "@/lib/auth/rbac";
import { getAdminPageAccess } from "@/lib/auth/admin-access";
import { AdminPageScaffold } from "../components/admin-ui";
import {
  findNextAppointment,
  formatNumber,
  getAttentionItems,
  humanizeEventType,
  summarizeReports,
  type ReportData,
  type ReportFilters,
} from "../reports/reporting";
import {
  AttentionItemCard,
  OperationsHealthCard,
  TodayAtAGlanceCard,
} from "./dashboard-cards";
// C-11 Phase B step 3b — the shared blocks library is the composition
// surface. `DashboardHeader`, `MobileStickyActionBar`, `PendingBookingsStripe`
// (= `UrgentAttentionPanel`), `EnquiriesTodoStripe` (= `ActiveEnquiriesCard`)
// and `QuickHelpPanel` are re-exports of the canonical implementations, so
// this is a re-point rather than a duplicate rendering.
import {
  DashboardHeader,
  EnquiriesTodoStripe,
  MobileStickyActionBar,
  PendingBookingsStripe,
  QuickHelpPanel,
} from "./blocks";
import type {
  ActiveEnquiryRow,
  AttentionGroup,
  AttentionSeverity,
  AttentionSummaryRow,
} from "./blocks";
import {
  BusinessOverviewDisclosure,
  DashboardFiltersClient,
} from "./dashboard-filters-client";
import { AdminErrorBoundary } from "../components/admin-error-boundary";
import type { DashboardQueryPlan, DashboardVariant } from "./dashboard-data";
import { buildDemandTrendData } from "./dashboard-helpers";
import type {
  MobileStickyAction,
  PersonalStripeTile,
  StripeRange,
  StripeVariant,
} from "./dashboard-helpers-b5";
import { PersonalContributionStripe } from "./PersonalContributionStripe";
import { PullToRefresh } from "./PullToRefresh";
import { LegacyDisclosureCleanup } from "./LegacyDisclosureCleanup";
import { PractitionerTodaySection } from "./PractitionerTodaySection";
import type { ServiceMeta } from "./shared-helpers";
import type { QuickHelpLink } from "./therapist-fullness";

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

interface BusinessDashboardProps {
  // Viewer + query plan: every branch below keys off `plan.variant` /
  // `plan.includeRevenue`, and the permission matrix is derived from the
  // profile exactly as it was inline.
  profile: StaffProfile;
  plan: DashboardQueryPlan;
  data: ReportData;
  filters: ReportFilters;
  today: string;
  summary: ReturnType<typeof summarizeReports>;
  attentionItems: ReturnType<typeof getAttentionItems>;
  dailySeries: ReturnType<typeof buildDemandTrendData>;
  rangeLabel: string;
  todayView: "list" | "timeline";
  // Booking slices computed once in page.tsx and shared with the Therapist
  // branch — passed in rather than recomputed so both stay identical.
  todayAppointments: ReportData["bookings"];
  upcomingInRange: ReportData["bookings"];
  nextSevenDays: ReportData["bookings"];
  needsAssignment: ReportData["bookings"];
  unassignedOnly: ReportData["bookings"];
  unpaidBookings: ReportData["bookings"];
  // B-5 stripe inputs
  stripeVariant: StripeVariant;
  stripeTiles: PersonalStripeTile[];
  contribStripeRange: StripeRange;
  stripeStickyAction: MobileStickyAction | null;
  preservedSearchParams: Record<string, string>;
  // C-FIELDWORK Phase D practitioner-mode inputs. All six feed the
  // PractitionerTodaySection mount; the claimable count needs an await, so
  // the whole group is derived in page.tsx.
  myTodayAppointments: ReportData["bookings"];
  myNextAppointment: ReportData["bookings"][number] | null;
  myNextAppointmentAssignmentId: string | null;
  myClaimableCount: number;
  myServiceLookup: Map<string, ServiceMeta>;
}

export function BusinessDashboard({
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
}: BusinessDashboardProps) {
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

  // Active (new + contacted) enquiries. Coordinator surfaces these inside its
  // Tier 2 "Active queues" disclosure; Business surfaces them as the
  // `EnquiriesTodoStripe` per brief §4.1. Same derivation for both, so it is
  // no longer gated on the variant.
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
        scopeLabel={
          isCoordinatorVariant
            ? null
            : formatTodayScopeLabel(todayAppointments.length, nextSevenDays.length)
        }
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
       * V-01 step 2 — "Needs your attention" is the primary actionable
       * stripe. Coordinator keeps the existing two-column Today + attention
       * grid untouched (Phase C owns that composition); Business drops the
       * "Snapshot · Today" card (its count now rides in the header, step 1)
       * and gives the stripe the full width.
       */}
      {isCoordinatorVariant ? (
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
          <PendingBookingsStripe rows={attentionSummaryRows} groups={attentionGroups} filterQuery={filterQuery} />
        </section>
      ) : (
        <PendingBookingsStripe rows={attentionSummaryRows} groups={attentionGroups} filterQuery={filterQuery} />
      )}

      {/*
       * Brief §4.1 — enquiries triage sits directly under the attention
       * stripe for Business. Coordinator keeps its copy inside the "Active
       * queues" disclosure below, so this only mounts for Business and only
       * when the viewer can actually work the queue.
       */}
      {!isCoordinatorVariant && permissionAccess.enquiries ? (
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
      ) : (
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
      )}

      {/*
       * Brief §4.1 — the R05 "Need help?" pattern, Business-tailored. Phase C
       * wires the Coordinator-tailored link set when that variant splits out.
       */}
      {!isCoordinatorVariant ? (
        <QuickHelpPanel links={businessQuickHelpLinks} />
      ) : null}

    </AdminPageScaffold>
    </PullToRefresh>
    <MobileStickyActionBar action={stripeStickyAction} />
    </>
  );
}
