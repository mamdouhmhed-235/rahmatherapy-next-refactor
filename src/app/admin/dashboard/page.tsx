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
  getStaffProfile,
} from "@/lib/auth/rbac";
import { getAdminPageAccess } from "@/lib/auth/admin-access";
import {
  AdminAccessDenied,
  AdminPageScaffold,
} from "../components/admin-ui";
import {
  buildNotifications,
  findNextAppointment,
  formatNumber,
  getAttentionItems,
  getGenderCapacity,
  getServicePerformance,
  getStaffWorkload,
  humanizeEventType,
  parseReportFilters,
  summarizeReports,
} from "../reports/reporting";
import type { NotificationItem } from "../reports/reporting";
import {
  AttentionItemCard,
  BusinessPulseCard,
  OperationsHealthCard,
  PaymentHealthCard,
  StaffCapacityCard,
  TodayAtAGlanceCard,
  UrgentAttentionPanel,
} from "./dashboard-cards";
import type {
  AttentionGroup,
  AttentionSeverity,
  AttentionSummaryRow,
} from "./dashboard-cards";
import {
  MobileNotificationButton,
  NotificationBell,
} from "../components/notification-bell";
import { DashboardFiltersClient } from "./dashboard-filters-client";
import { AdminErrorBoundary } from "../components/admin-error-boundary";
import { DashboardHeader } from "./dashboard-header";
import { getDashboardData, type DashboardVariant } from "./dashboard-data";

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
    href: (access) => (access.enquiries ? "/admin/enquiries" : null),
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

function getDashboardCopy(variant: DashboardVariant) {
  if (variant === "coordinator") {
    return {
      title: "Coordinator dashboard",
      subtitle: "Booking queue, enquiries, email status and assignment gaps.",
    };
  }
  if (variant === "therapist") {
    return {
      title: "Therapist dashboard",
      subtitle: "Assigned bookings, matching claimable work and own availability.",
    };
  }
  return {
    title: "Dashboard",
    subtitle: "Business-wide command centre for operations, bookings, staff and reports.",
  };
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
  const { data, plan } = await getDashboardData(adminClient, profile, filters);
  const summary = summarizeReports(data);
  const attentionItems = getAttentionItems(data);

  const todayAppointments: typeof data.bookings = [];
  const nextSevenDays: typeof data.bookings = [];
  const needsAssignment: typeof data.bookings = [];
  const unassignedOnly: typeof data.bookings = [];
  const unpaidBookings: typeof data.bookings = [];
  const unpaidCompleted: typeof data.bookings = [];
  let noShowCancelledCount = 0;
  const sevenDayLimit = addBusinessDays(today, 7);

  for (const booking of data.bookings) {
    if (booking.booking_date === today) todayAppointments.push(booking);
    if (booking.booking_date >= today && booking.booking_date <= sevenDayLimit) {
      nextSevenDays.push(booking);
    }
    if (booking.assignment_status === "unassigned") {
      unassignedOnly.push(booking);
      needsAssignment.push(booking);
    } else if (booking.assignment_status === "partially_assigned") {
      needsAssignment.push(booking);
    }
    if (booking.payment_status === "unpaid") {
      unpaidBookings.push(booking);
      if (booking.status === "completed") unpaidCompleted.push(booking);
    }
    if (booking.status === "cancelled" || booking.status === "no_show") {
      noShowCancelledCount++;
    }
  }

  const failedEmails = data.emailEvents.filter((event) => event.delivery_status === "failed");
  const openOperationalErrors = data.operationalEvents.filter((event) => event.status === "open");
  const staffAvailabilityGaps = data.staff.filter(
    (member) =>
      member.active &&
      member.can_take_bookings &&
      member.availability_mode === "custom" &&
      !data.staffAvailabilityRuleStaffIds.has(member.id)
  );
  const staffWorkload = getStaffWorkload(data);
  const genderCapacity = getGenderCapacity(data);
  const services = getServicePerformance(data);
  const revenueAllowed = plan.includeRevenue;
  const assignedOnly = plan.variant === "therapist";
  const permissionAccess = getPermissionAccess(profile);
  const dashboardCopy = getDashboardCopy(plan.variant);
  const showStaffCapacity = plan.variant === "business" && permissionAccess.staff;
  const showPaymentHealth = plan.variant !== "therapist";
  const showOperationsHealth = plan.variant !== "therapist";
  const newEnquiries = data.enquiries.filter((enquiry) => enquiry.status === "new");
  const nextAppointment = findNextAppointment(data.bookings, today);
  const serviceOptions = uniqueStrings(data.bookingItems.map((item) => item.service_name_snapshot));
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
  if (plan.variant !== "therapist" && unpaidBookings.length > 0) {
    attentionSummaryRows.push({
      key: "payments",
      label: "Payment follow up",
      detail: "Bookings need payment review",
      count: unpaidBookings.length,
      severity: "warning",
      href: permissionAccess.bookings ? "/admin/bookings?payment_status=unpaid" : null,
    });
  }

  const readiness = {
    confirmations: failedEmails.length > 0 ? `${formatNumber(failedEmails.length)} to review` : "All clear",
    staffCoverage: needsAssignment.length > 0 ? `${formatNumber(needsAssignment.length)} need assignment` : "Well covered",
    paymentCollection:
      plan.variant === "therapist"
        ? "Assigned work only"
        : unpaidBookings.length > 0
          ? `${formatNumber(unpaidBookings.length)} to collect`
          : "No activity yet",
  };

  const notificationButton = (
    <>
      <div className="xl:hidden">
        <AdminErrorBoundary sectionName="Notifications">
          <MobileNotificationButton items={notifications} variant="icon" />
        </AdminErrorBoundary>
      </div>
      <div className="hidden xl:block">
        <AdminErrorBoundary sectionName="Notifications">
          <NotificationBell items={notifications} />
        </AdminErrorBoundary>
      </div>
    </>
  );

  return (
    <AdminPageScaffold className="gap-4">
      <DashboardHeader
        title={dashboardCopy.title}
        subtitle={dashboardCopy.subtitle}
        lastChecked={lastChecked}
        showReports={permissionAccess.reports}
        showCalendar={permissionAccess.calendar}
        showSettings={permissionAccess.operations}
        notificationButton={notificationButton}
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
          assignedOnly={assignedOnly}
          revenueAllowed={revenueAllowed}
        />
      </AdminErrorBoundary>

      <section className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.95fr)]">
        <TodayAtAGlanceCard
          appointments={todayAppointments.map((booking) => ({
            time: booking.start_time.slice(0, 5),
            endTime: booking.end_time?.slice(0, 5),
            title: booking.contact_full_name ?? "Unknown contact",
            detail: booking.service_city ?? "No city recorded",
            status: booking.assignment_status,
            href: permissionAccess.bookings ? `/admin/bookings/${booking.id}` : null,
          }))}
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
        />
        <UrgentAttentionPanel rows={attentionSummaryRows} groups={attentionGroups} />
      </section>

      <section className="grid min-w-0 items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {showStaffCapacity ? (
          <div className="order-2 xl:order-1">
            <StaffCapacityCard
              genderCapacity={genderCapacity}
              staffWorkload={staffWorkload.map((row) => ({
                staffName: row.staffName,
                assignments: row.assignments,
                completed: row.completed,
              }))}
              permissionAccess={permissionAccess}
            />
          </div>
        ) : null}
        {showPaymentHealth ? (
          <div className="order-3 xl:order-2">
            <PaymentHealthCard
              summary={{
                bookedRevenue: summary.bookedRevenue,
                collectedRevenue: summary.collectedRevenue,
                outstandingRevenue: summary.outstandingRevenue,
              }}
              unpaidCount={unpaidBookings.length}
              unpaidCompletedCount={unpaidCompleted.length}
              revenueAllowed={revenueAllowed}
              canReviewBookings={permissionAccess.bookings}
              canViewReports={permissionAccess.reports}
            />
          </div>
        ) : null}
        {showOperationsHealth ? (
          <div className="order-1 lg:col-span-2 xl:order-3 xl:col-span-1">
            <OperationsHealthCard
              failedEmails={failedEmails.length}
              openEnquiries={newEnquiries.length}
              openOperations={openOperationalErrors.length}
              availabilityGaps={staffAvailabilityGaps.length}
              permissionAccess={permissionAccess}
            />
          </div>
        ) : null}
      </section>

      <AdminErrorBoundary sectionName="Business pulse">
        <BusinessPulseCard
          services={services}
          clients={{
            repeatClients: summary.repeatClients,
            newClients: summary.newClients,
            noShowCancelled: noShowCancelledCount,
            newEnquiries: newEnquiries.length,
          }}
          bookings={data.bookings}
          dateRange={{ from: filters.from, to: filters.to }}
          revenueAllowed={revenueAllowed}
          canViewReports={permissionAccess.reports}
        />
      </AdminErrorBoundary>

    </AdminPageScaffold>
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
