import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  CalendarDays,
  CreditCard,
  FileText,
  ShieldCheck,
  SlidersHorizontal,
  UserRoundCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addBusinessDays, getBusinessDate } from "@/lib/time/london";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminHiddenDataState,
  AdminPageScaffold,
  AdminStatusBadge,
} from "../components/admin-ui";
import { AdminSheet } from "../components/admin-ui-interactions";
import { cn } from "@/lib/utils";
import {
  buildNotifications,
  canViewRevenueReports,
  findNextAppointment,
  formatMoney,
  formatNumber,
  getAttentionItems,
  getGenderCapacity,
  getReportData,
  getServicePerformance,
  getStaffWorkload,
  hasUniversalReportScope,
  humanizeEventType,
  parseReportFilters,
  summarizeReports,
} from "../reports/reporting";
import type { NotificationItem } from "../reports/reporting";
import {
  AttentionItemCard,
  BusinessPulseCard,
  DashboardCommandCard,
  NeedsActionBoard,
  OperationsHealthCard,
  PaymentHealthCard,
  StaffCapacityCard,
  TodayAgendaCard,
} from "./dashboard-cards";
import type { AttentionGroup, AttentionSeverity } from "./dashboard-cards";
import {
  NotificationBell,
  MobileNotificationButton,
} from "../components/notification-bell";

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

/* ═══════════════════════════════════════════════════════════
   Attention category grouping
   ═══════════════════════════════════════════════════════════ */

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
    href: (access) => access.bookings ? "/admin/bookings?view=unassigned" : null,
    actionLabel: "Assign therapists",
    summary: (n) => `${n} booking${n !== 1 ? "s" : ""} need${n === 1 ? "s" : ""} a therapist before the client can be fully covered.`,
  },
  "assignment-partial": {
    label: "Partially assigned bookings",
    category: "assignments",
    categoryLabel: "Assignments",
    order: 20,
    href: (access) => access.bookings ? "/admin/bookings?view=partial" : null,
    actionLabel: "Complete assignment",
    summary: (n) => `${n} booking${n !== 1 ? "s" : ""} still need${n === 1 ? "s" : ""} every session covered.`,
  },
  "payment-unpaid": {
    label: "Unpaid completed bookings",
    category: "payments",
    categoryLabel: "Payments",
    order: 30,
    href: (access) => access.bookings ? "/admin/bookings?status=completed&payment_status=unpaid" : null,
    actionLabel: "Review payments",
    summary: (n) => `${n} completed booking${n !== 1 ? "s" : ""} need${n === 1 ? "s" : ""} payment follow-up.`,
  },
  "customer-reschedule": {
    label: "Reschedule requests",
    category: "clients",
    categoryLabel: "Clients",
    order: 40,
    href: (access) => access.bookings ? "/admin/bookings?view=attention" : null,
    actionLabel: "Review requests",
    summary: (n) => `${n} client reschedule request${n !== 1 ? "s" : ""} need${n === 1 ? "s" : ""} a response.`,
  },
  "customer-cancellation": {
    label: "Customer cancellations",
    category: "clients",
    categoryLabel: "Clients",
    order: 50,
    href: (access) => access.bookings ? "/admin/bookings?view=cancelled" : null,
    actionLabel: "Review cancelled",
    summary: (n) => `${n} cancelled or no-show booking${n !== 1 ? "s" : ""} need${n === 1 ? "s" : ""} review.`,
  },
  "customer-enquiry": {
    label: "New enquiries",
    category: "clients",
    categoryLabel: "Clients",
    order: 60,
    href: (access) => access.enquiries ? "/admin/enquiries" : null,
    actionLabel: "Contact enquiries",
    summary: (n) => `${n} new enquiry${n !== 1 ? "ies" : ""} waiting for follow-up.`,
  },
  "booking-health": {
    label: "Health notes",
    category: "health",
    categoryLabel: "Health",
    order: 70,
    href: (access) => access.bookings ? "/admin/bookings?view=attention" : null,
    actionLabel: "Review notes",
    summary: (n) => `${n} booking${n !== 1 ? "s" : ""} include${n === 1 ? "s" : ""} health notes therapists should review.`,
  },
  "system-operations": {
    label: "Operational errors",
    category: "operations",
    categoryLabel: "Operations",
    order: 80,
    href: (access) => access.operations ? "/admin/operations" : null,
    actionLabel: "Open operations",
    summary: (n) => `${n} operational event${n !== 1 ? "s" : ""} need${n === 1 ? "s" : ""} acknowledgement or resolution.`,
  },
  "staff-availability": {
    label: "Availability gaps",
    category: "operations",
    categoryLabel: "Operations",
    order: 90,
    href: (access) => access.staff ? "/admin/staff" : null,
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
      href: (access) => access.emails ? "/admin/emails" : null,
      actionLabel: "Open email status",
      summary: (n) => `${n} failed email${n !== 1 ? "s" : ""} from this workflow need review.`,
    };
  }

  return ATTENTION_GROUP_META[key] ?? ATTENTION_GROUP_META["system-operations"];
}

function humanizeAttentionLabel(label: string): string {
  const MAP: Record<string, string> = {
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
  return MAP[label] ?? label;
}

function getAttentionImpact(
  item: AttentionItem
): string | undefined {
  if (item.label === "Unassigned booking") return "Customer may not have a confirmed therapist.";
  if (item.label === "Partially assigned booking") return "Not all sessions have therapists assigned.";
  if (item.label === "Unpaid completed booking") return "Revenue from completed service not yet collected.";
  if (item.label === "Customer cancellation") return "Booking cancelled by customer — review and follow up.";
  if (item.label === "Reschedule request") return "Client wants to change date/time.";
  if (item.label === "Booking with health notes") return "Therapist should review health conditions before the visit.";
  if (item.label === "Failed email send") return "Customer may not have received important communication.";
  if (item.label === "Operational error") return "System process failed — may affect workflow.";
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
      return {
        key,
        label: meta.label,
        category: meta.category,
        categoryLabel: meta.categoryLabel,
        priority: meta.order,
        count: groupItems.length,
        summary: meta.summary(groupItems.length),
        pageHref: meta.href(permissionAccess),
        href: meta.href(permissionAccess),
        actionLabel: meta.actionLabel,
        items: groupItems.map((item) => {
          const href = getAccessibleAttentionHref(item.href, permissionAccess);
          return (
            <AttentionItemCard
              key={item.id}
              title={humanizeAttentionLabel(item.label)}
              detail={
                item.label === "Failed email send"
                  ? humanizeEventType(item.detail)
                  : item.label === "Operational error"
                    ? item.detail
                    : item.detail
              }
              impact={getAttentionImpact(item)}
              severity={getAttentionSeverity(item)}
              date={item.date}
              ageLabel={getAttentionAgeLabel(item, today)}
              href={href}
              primaryLabel={getPrimaryActionLabel(item)}
              secondaryHref={item.href.startsWith("/admin/bookings") && permissionAccess.bookings ? item.href : null}
              secondaryLabel="View booking"
            />
          );
        }),
      };
    });
}

/* ═══════════════════════════════════════════════════════════
   Permission helpers
   ═══════════════════════════════════════════════════════════ */

function canViewDashboard(profile: StaffProfile) {
  return (
    profile.permissions.has(PERMISSIONS.VIEW_DASHBOARD) ||
    profile.permissions.has(PERMISSIONS.VIEW_REPORTS) ||
    profile.permissions.has(PERMISSIONS.VIEW_OWN_BOOKINGS)
  );
}

interface PermissionAccess {
  bookings: boolean;
  calendar: boolean;
  reports: boolean;
  enquiries: boolean;
  emails: boolean;
  operations: boolean;
  staff: boolean;
}

function getPermissionAccess(profile: StaffProfile): PermissionAccess {
  return {
    bookings: hasAnyPermission(profile, [PERMISSIONS.MANAGE_BOOKINGS_ALL, PERMISSIONS.MANAGE_BOOKINGS_OWN]),
    calendar: hasAnyPermission(profile, [
      PERMISSIONS.VIEW_ALL_BOOKINGS, PERMISSIONS.VIEW_OWN_BOOKINGS,
      PERMISSIONS.MANAGE_BOOKINGS_ALL, PERMISSIONS.MANAGE_BOOKINGS_OWN,
    ]),
    reports: hasAnyPermission(profile, [
      PERMISSIONS.VIEW_REPORTS, PERMISSIONS.VIEW_OWN_BOOKINGS, PERMISSIONS.MANAGE_BOOKINGS_OWN,
    ]),
    enquiries: hasAnyPermission(profile, [PERMISSIONS.MANAGE_CLIENTS]),
    emails: hasAnyPermission(profile, [PERMISSIONS.MANAGE_EMAILS, PERMISSIONS.MANAGE_BOOKINGS_ALL]),
    operations: hasAnyPermission(profile, [
      PERMISSIONS.MANAGE_SETTINGS, PERMISSIONS.MANAGE_EMAILS, PERMISSIONS.MANAGE_BOOKINGS_ALL,
    ]),
    staff: hasAnyPermission(profile, [PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_STAFF]),
  };
}

function getAccessibleAttentionHref(href: string, access: PermissionAccess) {
  if (href.startsWith("/admin/bookings")) return access.bookings ? href : null;
  if (href.startsWith("/admin/enquiries")) return access.enquiries ? href : null;
  if (href.startsWith("/admin/emails")) return access.emails ? href : null;
  if (href.startsWith("/admin/operations")) return access.operations ? href : null;
  if (href.startsWith("/admin/staff")) return access.staff ? href : null;
  return href;
}

function hasAnyPermission(profile: StaffProfile, permissions: string[]) {
  return permissions.some((p) => profile.permissions.has(p));
}

function formatFilterLabel(value: string) {
  return value.split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/* ═══════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════ */

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");
  if (!canViewDashboard(profile)) return <InsufficientPermissions />;

  const today = getBusinessDate();
  const params = await searchParams;
  const filters = parseReportFilters({
    range: params.range ?? "week",
    from: params.from ?? today,
    to: params.to ?? addBusinessDays(today, 7),
    staffId: params.staffId,
    service: params.service,
    source: params.source,
    status: params.status,
    paymentStatus: params.paymentStatus,
    city: params.city,
  });
  const adminClient = createSupabaseAdminClient();
  const data = await getReportData(adminClient, profile, filters);
  const summary = summarizeReports(data);
  const attentionItems = getAttentionItems(data);
  const todayAppointments = data.bookings.filter((b) => b.booking_date === today);
  const nextSevenDays = data.bookings.filter(
    (b) => b.booking_date >= today && b.booking_date <= addBusinessDays(today, 7)
  );
  const needsAssignment = data.bookings.filter((b) =>
    ["unassigned", "partially_assigned"].includes(b.assignment_status)
  );
  const unassignedOnly = data.bookings.filter((b) => b.assignment_status === "unassigned");
  const partiallyAssigned = data.bookings.filter((b) => b.assignment_status === "partially_assigned");
  const rescheduleRequests = data.bookings.filter((b) => b.reschedule_status === "requested");
  const unpaidBookings = data.bookings.filter((b) => b.payment_status === "unpaid");
  const unpaidCompleted = data.bookings.filter(
    (b) => b.status === "completed" && b.payment_status === "unpaid"
  );
  const failedEmails = data.emailEvents.filter((e) => e.delivery_status === "failed");
  const openOperationalErrors = data.operationalEvents.filter((e) => e.status === "open");
  const staffAvailabilityGaps = data.staff.filter(
    (s) => s.active && s.can_take_bookings && s.availability_mode === "custom" && !data.staffAvailabilityRuleStaffIds.has(s.id)
  );
  const staffWorkload = getStaffWorkload(data);
  const genderCapacity = getGenderCapacity(data);
  const services = getServicePerformance(data);
  const revenueAllowed = canViewRevenueReports(profile);
  const assignedOnly = !hasUniversalReportScope(profile);
  const permissionAccess = getPermissionAccess(profile);
  const newEnquiries = data.enquiries.filter((e) => e.status === "new");
  const systemAttentionCount = failedEmails.length + openOperationalErrors.length + staffAvailabilityGaps.length;
  const nextAppointment = findNextAppointment(data.bookings, today);
  const serviceOptions = uniqueStrings(data.bookingItems.map((i) => i.service_name_snapshot));
  const lastChecked = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date());

  const notifications: NotificationItem[] = buildNotifications({
    assignments: data.assignments,
    emailEvents: data.emailEvents,
    operationalEvents: data.operationalEvents,
    enquiries: data.enquiries,
    bookings: data.bookings,
  });

  const attentionGroups = buildAttentionGroups(attentionItems, permissionAccess, today);

  const noShowCancelledCount = data.bookings.filter((b) =>
    ["cancelled", "no_show"].includes(b.status)
  ).length;
  const hasActiveProblems =
    attentionItems.length > 0 ||
    unassignedOnly.length > 0 ||
    unpaidBookings.length > 0 ||
    systemAttentionCount > 0;
  const todayCard = {
    title: "Today",
    value: formatNumber(todayAppointments.length),
    subtitle: `${formatNumber(todayAppointments.length)} today \u00b7 ${formatNumber(nextSevenDays.length)} this week`,
    icon: CalendarDays,
    tone: "default" as const,
    href: permissionAccess.bookings ? "/admin/bookings" : undefined,
    actionLabel: permissionAccess.bookings ? "View bookings" : undefined,
  };
  const problemCards = [
    {
      title: "Needs attention",
      value: formatNumber(attentionItems.length),
      subtitle: `${formatNumber(needsAssignment.length)} assignment \u00b7 ${formatNumber(rescheduleRequests.length)} reschedule`,
      icon: AlertCircle,
      tone: attentionItems.length > 0 ? "warning" as const : "default" as const,
      href: permissionAccess.bookings ? "/admin/bookings?view=attention" : permissionAccess.reports ? "/admin/reports" : undefined,
      actionLabel: attentionItems.length > 0 ? "Review signals" : permissionAccess.reports ? "Review reports" : undefined,
    },
    {
      title: "Unassigned",
      value: formatNumber(unassignedOnly.length),
      subtitle: `${formatNumber(unassignedOnly.length)} unassigned \u00b7 ${formatNumber(partiallyAssigned.length)} partial`,
      icon: UserRoundCheck,
      tone: unassignedOnly.length > 0 ? "critical" as const : "default" as const,
      href: permissionAccess.bookings ? "/admin/bookings?view=unassigned" : undefined,
      actionLabel: unassignedOnly.length > 0 ? "Assign now" : undefined,
    },
    {
      title: "Unpaid",
      value: formatNumber(unpaidBookings.length),
      subtitle: revenueAllowed
        ? `${formatMoney(summary.outstandingRevenue)} outstanding`
        : `${formatNumber(unpaidBookings.length)} unpaid`,
      icon: CreditCard,
      tone: unpaidBookings.length > 0 ? "warning" as const : "default" as const,
      href: permissionAccess.bookings ? "/admin/bookings?payment_status=unpaid" : undefined,
      actionLabel: unpaidBookings.length > 0 ? "Review payment" : undefined,
    },
    {
      title: "System health",
      value: formatNumber(systemAttentionCount),
      subtitle: `${formatNumber(failedEmails.length)} email \u00b7 ${formatNumber(openOperationalErrors.length)} ops`,
      icon: ShieldCheck,
      tone: systemAttentionCount > 0 ? "warning" as const : "success" as const,
      href: permissionAccess.operations ? "/admin/operations" : permissionAccess.emails ? "/admin/emails" : undefined,
      actionLabel: systemAttentionCount > 0 ? "Review health" : undefined,
    },
  ];
  const commandCards = hasActiveProblems && todayAppointments.length === 0
    ? [...problemCards, todayCard]
    : [todayCard, ...problemCards];

  return (
    <AdminPageScaffold className="gap-5">
      {/* ── Header ── */}
      <header className="grid gap-4 rounded-2xl border border-[var(--rahma-border)] bg-white/85 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-[1.85rem] font-semibold leading-tight text-[var(--rahma-charcoal)] sm:text-[2.15rem]">
              Dashboard
            </h1>
            <Badge variant="secondary" className="border-none bg-[var(--rahma-green)]/10 text-[var(--rahma-green)]">
              {profile.role_name}
            </Badge>
            {assignedOnly ? <AdminStatusBadge value="Assigned only" tone="info" /> : null}
            {!revenueAllowed ? <AdminStatusBadge value="Revenue hidden" tone="restricted" /> : null}
            <AdminStatusBadge value={`Last checked ${lastChecked}`} tone="muted" />
          </div>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--rahma-muted)] sm:text-base">
            Operational command centre &mdash; bookings, staff, payments, and attention.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {permissionAccess.reports ? (
            <Link
              href="/admin/reports"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11 bg-white px-4")}
            >
              <FileText className="mr-1.5 size-3.5" />
              Reports
            </Link>
          ) : null}
          {permissionAccess.calendar ? (
            <Link
              href="/admin/calendar"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11 bg-white px-4")}
            >
              <CalendarDays className="mr-1.5 size-3.5" />
              Calendar
            </Link>
          ) : null}
          <div className="xl:hidden">
            <MobileNotificationButton items={notifications} variant="icon" />
          </div>
          <div className="hidden xl:block">
            <NotificationBell items={notifications} />
          </div>
        </div>
      </header>

      {/* ── Filters bar ── */}
      <FiltersBar
        filters={filters}
        staff={data.staff}
        serviceOptions={serviceOptions}
        assignedOnly={assignedOnly}
        revenueAllowed={revenueAllowed}
      />

      {/* ── Command cards ── */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {commandCards.map((card) => (
          <DashboardCommandCard
            key={card.title}
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
            icon={card.icon}
            tone={card.tone}
            href={card.href}
            actionLabel={card.actionLabel}
          />
        ))}
      </section>

      {/* ── Main grid: Needs Action + Today / Ops ── */}
      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.65fr)]">
        <NeedsActionBoard groups={attentionGroups} />

        <div className="grid gap-5 self-start">
          <TodayAgendaCard
            appointments={todayAppointments.map((b) => ({
              time: b.start_time.slice(0, 5),
              title: b.contact_full_name ?? "Unknown contact",
              detail: b.service_city ?? "No city recorded",
              status: b.assignment_status,
              href: permissionAccess.bookings ? `/admin/bookings/${b.id}` : null,
            }))}
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
          />
          <OperationsHealthCard
            failedEmails={failedEmails.length}
            openEnquiries={newEnquiries.length}
            openOperations={openOperationalErrors.length}
            availabilityGaps={staffAvailabilityGaps.length}
            permissionAccess={permissionAccess}
          />
        </div>
      </section>

      {/* ── Secondary grid: Staff · Payment · Business Pulse ── */}
      <section className="grid gap-5 lg:grid-cols-3">
        <StaffCapacityCard
          genderCapacity={genderCapacity}
          staffWorkload={staffWorkload.map((sw) => ({
            staffName: sw.staffName,
            assignments: sw.assignments,
            completed: sw.completed,
          }))}
          permissionAccess={permissionAccess}
        />
        <PaymentHealthCard
          summary={{
            bookedRevenue: summary.bookedRevenue,
            collectedRevenue: summary.collectedRevenue,
            outstandingRevenue: summary.outstandingRevenue,
          }}
          unpaidCount={unpaidBookings.length}
          unpaidCompletedCount={unpaidCompleted.length}
          revenueAllowed={revenueAllowed}
        />
        <BusinessPulseCard
          services={services}
          clients={{
            repeatClients: summary.repeatClients,
            newClients: summary.newClients,
            noShowCancelled: noShowCancelledCount,
            newEnquiries: newEnquiries.length,
          }}
          revenueAllowed={revenueAllowed}
        />
      </section>

      {/* ── Restricted states ── */}
      {(!revenueAllowed || assignedOnly) ? (
        <section className="grid gap-4 lg:grid-cols-2" aria-label="Restricted dashboard states">
          {!revenueAllowed ? (
            <AdminHiddenDataState
              title="Revenue hidden"
              message="Payment counts stay visible, but money values are hidden unless view_reports or manage_payments is granted."
              permission="view_reports or manage_payments"
            />
          ) : null}
          {assignedOnly ? (
            <AdminHiddenDataState
              title="Assigned-only scope"
              message="Dashboard metrics and attention items are scoped to bookings assigned to this staff member."
              permission="view_own_bookings"
            />
          ) : null}
        </section>
      ) : null}
    </AdminPageScaffold>
  );
}

/* ═══════════════════════════════════════════════════════════
   Date quick chips
   ═══════════════════════════════════════════════════════════ */

const DATE_CHIP_PRESETS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 6 },
  { label: "30 days", days: 29 },
] as const;

function DateQuickChips({ from, to }: { from: string; to: string }) {
  return (
    <span className="hidden min-h-10 items-center gap-0.5 rounded-xl border border-[var(--rahma-border)] bg-white px-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)] sm:inline-flex">
      {DATE_CHIP_PRESETS.map((preset) => {
        const today = getBusinessDate();
        const presetTo = addBusinessDays(today, preset.days);
        const isActive = from === today && to === presetTo;
        return (
          <Link
            key={preset.label}
            href={`/admin/dashboard?from=${today}&to=${presetTo}`}
            className={cn(
              "inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              isActive
                ? "bg-[var(--rahma-green)]/10 text-[var(--rahma-green)]"
                : "text-[var(--rahma-muted)] hover:text-[var(--rahma-charcoal)] hover:bg-[var(--rahma-ivory)]"
            )}
          >
            {preset.label}
          </Link>
        );
      })}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Filters bar
   ═══════════════════════════════════════════════════════════ */

function FiltersBar({
  filters,
  staff,
  serviceOptions,
  assignedOnly,
  revenueAllowed,
}: {
  filters: ReturnType<typeof parseReportFilters>;
  staff: { id: string; name: string }[];
  serviceOptions: string[];
  assignedOnly: boolean;
  revenueAllowed: boolean;
}) {
  const activeAdvancedFilters = [
    filters.staffId,
    filters.service,
    filters.source,
    filters.status,
    filters.paymentStatus,
    filters.city,
  ].filter(Boolean).length;

  return (
    <section className="rounded-2xl border border-[var(--rahma-border)] bg-white/85 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)] sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <DateQuickChips from={filters.from} to={filters.to} />
          <div className="grid gap-2 rounded-xl bg-[var(--admin-surface-muted)] px-3 py-3 text-sm sm:hidden">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--rahma-muted)]">Scope</span>
            <span className="font-semibold text-[var(--rahma-charcoal)]">
              {filters.from} &mdash; {filters.to}
            </span>
            <span className="text-[var(--rahma-muted)]">
              {assignedOnly ? "Assigned bookings only" : "Permitted records"}
              {!revenueAllowed ? " · revenue hidden" : ""}
            </span>
          </div>
        </div>

        <form action="/admin/dashboard" className="hidden lg:block">
          <input type="hidden" name="range" value={filters.range} />
          <div className="flex flex-wrap items-end justify-end gap-2">
            <DateInput label="From" name="from" defaultValue={filters.from} />
            <DateInput label="To" name="to" defaultValue={filters.to} />
            <button
              type="submit"
              className={cn(buttonVariants({ size: "sm" }), "min-h-9 bg-[var(--rahma-green)] px-4")}
            >
              Apply
            </button>
            <Link
              href="/admin/dashboard"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-9 bg-white")}
            >
              Reset
            </Link>
          </div>
        </form>
      </div>

      {/* Advanced filters */}
      <details className="mt-3 hidden overflow-hidden rounded-2xl border border-[var(--rahma-border)] bg-white lg:block">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 text-sm font-semibold text-[var(--rahma-charcoal)] outline-none transition-colors hover:bg-[var(--rahma-ivory)]/55 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex min-w-0 items-center gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--rahma-green)]/10 text-[var(--rahma-green)]">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block">Advanced filters</span>
              <span className="block text-xs font-medium text-[var(--rahma-muted)]">
                Staff, service, source, status, payment and city.
              </span>
            </span>
          </span>
          <AdminStatusBadge
            value={activeAdvancedFilters > 0 ? `${activeAdvancedFilters} active` : "Optional"}
            tone={activeAdvancedFilters > 0 ? "info" : "muted"}
          />
        </summary>
        <form action="/admin/dashboard" className="border-t border-[var(--rahma-border)] p-4">
          <input type="hidden" name="from" value={filters.from} />
          <input type="hidden" name="to" value={filters.to} />
          <input type="hidden" name="range" value={filters.range} />
          <div className="grid gap-4 lg:grid-cols-12">
            <FormSelect label="Staff" name="staffId" defaultValue={filters.staffId} className="lg:col-span-4 xl:col-span-3">
              <option value="">All staff</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </FormSelect>
            <FormSelect label="Service" name="service" defaultValue={filters.service} className="lg:col-span-4 xl:col-span-3">
              <option value="">All services</option>
              {serviceOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </FormSelect>
            <FormSelect label="Source" name="source" defaultValue={filters.source} className="lg:col-span-4 xl:col-span-2">
              <option value="">All sources</option>
              {sourceOptions.map((s) => (
                <option key={s} value={s}>{formatFilterLabel(s)}</option>
              ))}
            </FormSelect>
            <FormSelect label="Status" name="status" defaultValue={filters.status} className="lg:col-span-4 xl:col-span-2">
              <option value="">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{formatFilterLabel(s)}</option>
              ))}
            </FormSelect>
            <FormSelect label="Payment" name="paymentStatus" defaultValue={filters.paymentStatus} className="lg:col-span-4 xl:col-span-2">
              <option value="">All payments</option>
              {paymentOptions.map((p) => (
                <option key={p} value={p}>{formatFilterLabel(p)}</option>
              ))}
            </FormSelect>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)] lg:col-span-6 xl:col-span-4">
              City
              <input
                name="city"
                defaultValue={filters.city}
                className="min-h-11 rounded-xl border border-[var(--rahma-border)] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[var(--rahma-charcoal)] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
                placeholder="Filter by city"
              />
            </label>
            <div className="flex items-end justify-start gap-2 lg:col-span-6 xl:col-span-8 xl:justify-end">
              <button type="submit" className={cn(buttonVariants({ size: "sm" }), "min-h-11 bg-[var(--rahma-green)] px-5")}>
                Apply filters
              </button>
              <Link href="/admin/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11 bg-white px-5")}>
                Reset
              </Link>
            </div>
          </div>
        </form>
      </details>

      {/* Mobile filters sheet */}
      <div className="mt-3 lg:hidden">
        <AdminSheet
          title="Filters"
          description="Refine dashboard scope."
          side="bottom"
          trigger={
            <button
              type="button"
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[var(--rahma-border)] bg-[var(--admin-surface-muted)] px-3 text-sm font-semibold text-[var(--rahma-charcoal)] outline-none transition-colors hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
            >
              <SlidersHorizontal className="size-4 text-[var(--rahma-green)]" />
              Date, scope and filters
            </button>
          }
        >
          <form action="/admin/dashboard" className="grid gap-3">
            <input type="hidden" name="range" value={filters.range} />
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
              From
              <input
                name="from"
                type="date"
                defaultValue={filters.from}
                className="min-h-10 rounded-lg border border-[var(--rahma-border)] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[var(--rahma-charcoal)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
              To
              <input
                name="to"
                type="date"
                defaultValue={filters.to}
                className="min-h-10 rounded-lg border border-[var(--rahma-border)] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[var(--rahma-charcoal)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
              />
            </label>
            <FormSelect label="Staff" name="staffId" defaultValue={filters.staffId}>
              <option value="">All staff</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </FormSelect>
            <FormSelect label="Service" name="service" defaultValue={filters.service}>
              <option value="">All services</option>
              {serviceOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </FormSelect>
            <FormSelect label="Source" name="source" defaultValue={filters.source}>
              <option value="">All sources</option>
              {sourceOptions.map((s) => (
                <option key={s} value={s}>{formatFilterLabel(s)}</option>
              ))}
            </FormSelect>
            <FormSelect label="Status" name="status" defaultValue={filters.status}>
              <option value="">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{formatFilterLabel(s)}</option>
              ))}
            </FormSelect>
            <FormSelect label="Payment" name="paymentStatus" defaultValue={filters.paymentStatus}>
              <option value="">All payments</option>
              {paymentOptions.map((p) => (
                <option key={p} value={p}>{formatFilterLabel(p)}</option>
              ))}
            </FormSelect>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
              City
              <input
                name="city"
                defaultValue={filters.city}
                className="min-h-11 rounded-xl border border-[var(--rahma-border)] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[var(--rahma-charcoal)] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
                placeholder="Filter by city"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button type="submit" className={cn(buttonVariants({ size: "sm" }), "min-h-10 flex-1 bg-[var(--rahma-green)] px-4")}>
                Apply
              </button>
              <Link href="/admin/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-10 flex-1 bg-white")}>
                Reset
              </Link>
            </div>
          </form>
        </AdminSheet>
      </div>
    </section>
  );
}

function DateInput({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
      {label}
      <input
        name={name}
        type="date"
        defaultValue={defaultValue}
        className="min-h-9 rounded-lg border border-[var(--rahma-border)] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[var(--rahma-charcoal)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
      />
    </label>
  );
}

function FormSelect({
  label,
  name,
  defaultValue,
  children,
  className,
}: {
  label: string;
  name: string;
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]", className)}>
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="min-h-11 rounded-xl border border-[var(--rahma-border)] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[var(--rahma-charcoal)] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
      >
        {children}
      </select>
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════
   Insufficient permissions
   ═══════════════════════════════════════════════════════════ */

function InsufficientPermissions() {
  return (
    <AdminAccessDenied
      title="Dashboard access limited"
      message="You need dashboard, reporting, or own-booking permission to view this area."
      permission="view_dashboard or view_reports"
    />
  );
}
