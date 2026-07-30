// SERVER-SAFE SHARED MODULE — everything the Business/Admin and Coordinator
// dashboard variants both need: the attention-grouping helpers, the
// permission matrix, the filter option lists, the header copy helpers, and
// the props contract both variants accept.
//
// C-11 Phase C step 6a split `BusinessDashboard.tsx` — which had served both
// variants behind `plan.variant === "coordinator"` gates since Phase B — into
// two sibling components. Every declaration below was module-level in that
// file and is called from BOTH variants, so it lives here rather than being
// duplicated or imported across the two component modules. Moved verbatim; no
// behaviour change.

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
import {
  getAttentionItems,
  humanizeEventType,
  summarizeReports,
  type ReportData,
  type ReportFilters,
} from "../reports/reporting";
import { AttentionItemCard } from "./dashboard-cards";
import type { AttentionGroup, AttentionSeverity } from "./blocks";
import type { DashboardQueryPlan, DashboardVariant } from "./dashboard-data";
import { buildDemandTrendData } from "./dashboard-helpers";
import type {
  MobileStickyAction,
  PersonalStripeTile,
  StripeRange,
  StripeVariant,
} from "./dashboard-helpers-b5";
import type { ServiceMeta } from "./shared-helpers";

type AttentionItem = ReturnType<typeof getAttentionItems>[number];

export const sourceOptions = ["website", "phone", "whatsapp", "instagram", "referral", "admin", "manual", "other"];
export const statusOptions = ["pending", "confirmed", "completed", "cancelled", "no_show"];
export const paymentOptions = ["paid", "unpaid"];

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

export function buildAttentionGroups(items: AttentionItem[], permissionAccess: PermissionAccess, today: string): AttentionGroup[] {
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

export interface PermissionAccess {
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

export function getPermissionAccess(profile: StaffProfile): PermissionAccess {
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

export function uniqueStrings(values: string[]) {
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

export function getDashboardCopy(variant: DashboardVariant, today: string) {
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

export function getRoleLabel(profile: { roles?: { name?: string | null }[] | null; role?: string | null }) {
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

// The props contract both dashboard variants accept. `page.tsx` owns every
// data fetch (including the awaited claimable-count lookup) and hands the
// results to whichever variant `plan.variant` selects; the variants derive
// and render only.
export interface DashboardVariantProps {
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
