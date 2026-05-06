import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  LockKeyhole,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addBusinessDays, getBusinessDate } from "@/lib/time/london";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminAttentionRail,
  AdminHiddenDataState,
  AdminMetricGrid,
  AdminPageScaffold,
  AdminPanel,
  AdminStatusBadge,
} from "../components/admin-ui";
import { AdminSheet } from "../components/admin-ui-interactions";
import { cn } from "@/lib/utils";
import {
  canViewRevenueReports,
  formatMoney,
  formatNumber,
  getAttentionItems,
  getReportData,
  getServicePerformance,
  getStaffWorkload,
  hasUniversalReportScope,
  parseReportFilters,
  summarizeReports,
} from "../reports/reporting";

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

function canViewDashboard(profile: StaffProfile) {
  return (
    profile.permissions.has(PERMISSIONS.VIEW_DASHBOARD) ||
    profile.permissions.has(PERMISSIONS.VIEW_REPORTS) ||
    profile.permissions.has(PERMISSIONS.VIEW_OWN_BOOKINGS)
  );
}

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
  const todayAppointments = data.bookings.filter(
    (booking) => booking.booking_date === today
  );
  const nextSevenDays = data.bookings.filter(
    (booking) => booking.booking_date >= today && booking.booking_date <= addBusinessDays(today, 7)
  );
  const needsAssignment = data.bookings.filter((booking) =>
    ["unassigned", "partially_assigned"].includes(booking.assignment_status)
  );
  const rescheduleRequests = data.bookings.filter(
    (booking) => booking.reschedule_status === "requested"
  );
  const cancellationRequests = data.bookings.filter(
    (booking) => booking.customer_cancelled_at
  );
  const unpaidBookings = data.bookings.filter(
    (booking) => booking.payment_status === "unpaid"
  );
  const failedEmails = data.emailEvents.filter(
    (event) => event.delivery_status === "failed"
  );
  const openOperationalErrors = data.operationalEvents.filter(
    (event) => event.status === "open"
  );
  const staffAvailabilityGaps = data.staff.filter(
    (member) =>
      member.active &&
      member.can_take_bookings &&
      member.availability_mode === "custom" &&
      !data.staffAvailabilityRuleStaffIds.has(member.id)
  );
  const staffWorkload = getStaffWorkload(data);
  const services = getServicePerformance(data);
  const revenueAllowed = canViewRevenueReports(profile);
  const assignedOnly = !hasUniversalReportScope(profile);
  const permissionAccess = getPermissionAccess(profile);
  const newEnquiries = data.enquiries.filter((item) => item.status === "new");
  const systemAttentionCount =
    failedEmails.length + openOperationalErrors.length + staffAvailabilityGaps.length;
  const serviceOptions = uniqueStrings(data.bookingItems.map((item) => item.service_name_snapshot));

  return (
    <AdminPageScaffold className="gap-7">
      <DashboardHeader
        profile={profile}
        revenueAllowed={revenueAllowed}
        assignedOnly={assignedOnly}
        permissionAccess={permissionAccess}
      />

      <AdminMetricGrid className="xl:grid-cols-4">
        <DashboardFocusCard
          label="Today"
          value={formatNumber(todayAppointments.length)}
          note={`${formatNumber(todayAppointments.length)} today, ${formatNumber(nextSevenDays.length)} next 7 days`}
          icon={CalendarCheck}
        />
        <DashboardFocusCard
          label="Needs action"
          value={formatNumber(attentionItems.length)}
          note={`${formatNumber(needsAssignment.length)} assignment gap(s), ${formatNumber(rescheduleRequests.length)} request(s)`}
          icon={AlertCircle}
          tone={attentionItems.length > 0 ? "warning" : "default"}
        />
        <DashboardFocusCard
          label="Payment follow-up"
          value={formatNumber(unpaidBookings.length)}
          note={
            revenueAllowed
              ? `${formatMoney(summary.outstandingRevenue)} outstanding`
              : `${formatNumber(unpaidBookings.length)} unpaid, revenue hidden`
          }
          icon={CreditCard}
          tone={unpaidBookings.length > 0 ? "warning" : "default"}
        />
        <DashboardFocusCard
          label="System attention"
          value={formatNumber(systemAttentionCount)}
          note="Failed email and operational events"
          icon={ClipboardList}
          tone={systemAttentionCount > 0 ? "warning" : "default"}
        />
      </AdminMetricGrid>

      <DashboardFilters
        filters={filters}
        staff={data.staff}
        serviceOptions={serviceOptions}
        revenueAllowed={revenueAllowed}
        assignedOnly={assignedOnly}
        permissionAccess={permissionAccess}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(20rem,0.62fr)_minmax(17rem,0.42fr)]">
        <AdminPanel
          title="Attention queue"
          description="High-signal operational items from bookings, enquiries, email delivery, operations and staff availability."
          badge={
            <AdminStatusBadge
              value={`${attentionItems.length} open`}
              tone={attentionItems.length > 0 ? "warning" : "success"}
            />
          }
          className="border-[var(--rahma-green)]/55"
        >
          <div className="grid gap-3">
            {attentionItems.slice(0, 8).map((item) => (
              <AttentionQueueItem
                key={item.id}
                item={item}
                href={getAccessibleAttentionHref(item.href, permissionAccess)}
              />
            ))}
            {attentionItems.length === 0 ? (
              <p className="rounded-[var(--admin-radius-md)] border border-dashed border-[var(--rahma-border)] bg-white/60 px-4 py-8 text-center text-sm text-[var(--rahma-muted)]">
                No urgent operational items in this range.
              </p>
            ) : null}
            {attentionItems.length > 8 ? (
              <Link
                href={permissionAccess.reports ? "/admin/reports" : "/admin/dashboard"}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--rahma-border)] bg-white px-3 text-sm font-semibold text-[var(--rahma-charcoal)] outline-none transition-colors hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
              >
                Review all {formatNumber(attentionItems.length)} signals
              </Link>
            ) : null}
          </div>
        </AdminPanel>

        <AdminPanel
          title="Today's agenda"
          description="A compact route into booking details where your permissions allow it."
        >
          <div className="grid gap-3">
            {todayAppointments.slice(0, 6).map((booking) => (
              <AgendaItem
                key={booking.id}
                href={permissionAccess.bookings ? `/admin/bookings/${booking.id}` : null}
                time={booking.start_time.slice(0, 5)}
                title={booking.contact_full_name ?? "Unknown contact"}
                detail={booking.service_city ?? "No city recorded"}
                status={booking.assignment_status}
              />
            ))}
            {todayAppointments.length === 0 ? (
              <p className="rounded-[var(--admin-radius-md)] bg-[var(--admin-surface-muted)] px-4 py-6 text-sm text-[var(--rahma-muted)]">
                No appointments today.
              </p>
            ) : null}
          </div>
        </AdminPanel>

        <NotificationCentre
          rescheduleRequests={rescheduleRequests.length}
          failedEmails={failedEmails.length}
          openOperationalErrors={openOperationalErrors.length}
          staffAvailabilityGaps={staffAvailabilityGaps.length}
          permissionAccess={permissionAccess}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <AdminPanel title="Staff workload">
          <DashboardRows
            rows={staffWorkload.slice(0, 5).map((row) => ({
              label: row.staffName,
              value: `${formatNumber(row.assignments)} assigned`,
            }))}
            empty="No staff assignments in this range."
          />
        </AdminPanel>

        <AdminPanel title="Most booked services">
          <DashboardRows
            rows={services.slice(0, 5).map((row) => ({
              label: row.service,
              value: revenueAllowed
                ? `${formatNumber(row.bookings)} bookings, ${formatMoney(row.revenue)}`
                : `${formatNumber(row.bookings)} bookings`,
            }))}
            empty="No service bookings in this range."
          />
        </AdminPanel>

        <AdminPanel title="Client and enquiry pulse">
          <DashboardRows
            rows={[
              {
                label: "Repeat clients",
                value: formatNumber(summary.repeatClients),
              },
              {
                label: "New clients in range",
                value: formatNumber(summary.newClients),
              },
              {
                label: "New enquiries",
                value: `${formatNumber(newEnquiries.length)} uncontacted`,
              },
              {
                label: "No-show/cancelled",
                value: `${formatNumber(
                  data.bookings.filter((booking) => ["cancelled", "no_show"].includes(booking.status)).length
                )} total, ${formatNumber(cancellationRequests.length)} customer requests`,
              },
            ]}
          />
        </AdminPanel>
      </section>

      {!revenueAllowed || assignedOnly ? (
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
              message="Dashboard metrics and attention items are limited to bookings assigned to this staff member."
              permission="view_own_bookings"
            />
          ) : null}
        </section>
      ) : null}
    </AdminPageScaffold>
  );
}

function DashboardHeader({
  profile,
  revenueAllowed,
  assignedOnly,
  permissionAccess,
}: {
  profile: StaffProfile;
  revenueAllowed: boolean;
  assignedOnly: boolean;
  permissionAccess: PermissionAccess;
}) {
  return (
    <header className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-3xl font-semibold leading-tight text-[var(--rahma-charcoal)]">
            Dashboard
          </h1>
          <Badge
            variant="secondary"
            className="border-none bg-[var(--rahma-green)]/10 text-[var(--rahma-green)]"
          >
            {profile.role_name}
          </Badge>
          {assignedOnly ? <AdminStatusBadge value="Assigned-only ready" tone="success" /> : null}
          {!revenueAllowed ? <AdminStatusBadge value="Revenue hidden" tone="restricted" /> : null}
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--rahma-muted)]">
          A focused operational view for today, assignment gaps, payment follow-up and system attention.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        {permissionAccess.reports ? (
          <Link
            href="/admin/reports"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11 bg-white px-5")}
          >
            Reports
          </Link>
        ) : null}
        {permissionAccess.calendar ? (
          <Link
            href="/admin/calendar"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11 bg-white px-5")}
          >
            Calendar
          </Link>
        ) : null}
      </div>
    </header>
  );
}

function DashboardFilters({
  filters,
  staff,
  serviceOptions,
  revenueAllowed,
  assignedOnly,
  permissionAccess,
}: {
  filters: ReturnType<typeof parseReportFilters>;
  staff: { id: string; name: string }[];
  serviceOptions: string[];
  revenueAllowed: boolean;
  assignedOnly: boolean;
  permissionAccess: PermissionAccess;
}) {
  return (
    <section className="rounded-[var(--admin-radius-lg)] border border-[var(--rahma-border)] bg-white p-4 shadow-[var(--admin-shadow-card)]">
      <form action="/admin/dashboard" className="hidden lg:block">
        <input type="hidden" name="range" value={filters.range} />
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[11rem_11rem_minmax(12rem,1fr)]">
            <DateField label="From" name="from" defaultValue={filters.from} />
            <DateField label="To" name="to" defaultValue={filters.to} />
            <ScopeSummary assignedOnly={assignedOnly} />
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              type="submit"
              className={cn(buttonVariants({ size: "sm" }), "min-h-11 bg-[var(--rahma-green)] px-6")}
            >
              Apply
            </button>
          </div>
        </div>
      </form>

      <div className="grid gap-1 rounded-[var(--admin-radius-md)] border border-[var(--rahma-border)] bg-[var(--admin-surface-muted)] px-3 py-3 text-sm lg:hidden">
        <span className="font-bold uppercase tracking-[0.08em] text-[var(--rahma-muted)]">Current scope</span>
        <span className="font-semibold text-[var(--rahma-charcoal)]">
          {filters.from} to {filters.to}
        </span>
        <span className="text-[var(--rahma-muted)]">
          {assignedOnly ? "Assigned bookings only" : "Permitted records"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {assignedOnly ? <AdminStatusBadge value="Assigned-only ready" tone="success" /> : null}
        {!revenueAllowed ? <AdminStatusBadge value="Revenue hidden" tone="restricted" /> : null}
        {!permissionAccess.reports ? <AdminStatusBadge value="Reports restricted" tone="restricted" /> : null}
        {!permissionAccess.calendar ? <AdminStatusBadge value="Calendar restricted" tone="restricted" /> : null}
      </div>

      <details className="mt-3 hidden rounded-[var(--admin-radius-md)] border border-[var(--rahma-border)] bg-[var(--rahma-ivory)]/60 lg:block">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold text-[var(--rahma-charcoal)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30 [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="size-4 text-[var(--rahma-green)]" />
          Filters
        </summary>
        <AdvancedFilterForm
          filters={filters}
          staff={staff}
          serviceOptions={serviceOptions}
          assignedOnly={assignedOnly}
          compact={false}
        />
      </details>

      <div className="mt-3 lg:hidden">
        <AdminSheet
          title="Filters + hidden states"
          description="Refine dashboard scope while keeping every permission and restricted-data state explicit."
          side="bottom"
          trigger={
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--rahma-border)] bg-[var(--admin-surface-muted)] px-3 text-sm font-semibold text-[var(--rahma-charcoal)] outline-none transition-colors hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
            >
              <SlidersHorizontal className="size-4 text-[var(--rahma-green)]" aria-hidden="true" />
              Date, scope and filters
            </button>
          }
        >
          <AdvancedFilterForm
            filters={filters}
            staff={staff}
            serviceOptions={serviceOptions}
            assignedOnly={assignedOnly}
            compact
          />
          <div className="mt-4 grid gap-2">
            {!revenueAllowed ? (
              <AdminHiddenDataState
                title="Revenue hidden"
                message="Money values remain hidden for this permission set."
                permission="view_reports or manage_payments"
              />
            ) : null}
            {assignedOnly ? (
              <AdminHiddenDataState
                title="Assigned-only scope"
                message="Dashboard signals are scoped to assigned bookings."
                permission="view_own_bookings"
              />
            ) : null}
          </div>
        </AdminSheet>
      </div>
    </section>
  );
}

function DashboardFocusCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ElementType;
  tone?: "default" | "warning";
}) {
  return (
    <article
      className={cn(
        "rounded-[var(--admin-radius-lg)] border bg-white px-5 py-5 shadow-[var(--admin-shadow-card)]",
        tone === "warning"
          ? "border-orange-200 bg-[#fff8ef]"
          : "border-[var(--rahma-border)] first:border-[var(--rahma-green)]/70"
      )}
      aria-label={`${label}: ${value}. ${note}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            "text-sm font-bold",
            tone === "warning" ? "text-[var(--admin-danger)]" : "text-[var(--rahma-green)]"
          )}
        >
          {label}
        </p>
        <Icon className="size-4 text-[var(--rahma-muted)]" aria-hidden="true" />
      </div>
      <p className="mt-4 text-3xl font-semibold leading-none text-[var(--rahma-charcoal)]">
        {value}
      </p>
      <p className="mt-3 text-sm leading-5 text-[var(--rahma-muted)]">{note}</p>
    </article>
  );
}

function ScopeSummary({ assignedOnly }: { assignedOnly: boolean }) {
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-[var(--rahma-border)] bg-[var(--admin-surface-muted)] px-3 text-sm font-semibold text-[var(--rahma-charcoal)]">
      <span>Scope: {assignedOnly ? "assigned bookings" : "permitted records"}</span>
    </div>
  );
}

function AdvancedFilterForm({
  filters,
  staff,
  serviceOptions,
  assignedOnly,
  compact,
}: {
  filters: ReturnType<typeof parseReportFilters>;
  staff: { id: string; name: string }[];
  serviceOptions: string[];
  assignedOnly: boolean;
  compact: boolean;
}) {
  return (
    <form
      action="/admin/dashboard"
      className={cn(
        "grid gap-3",
        compact ? "" : "border-t border-[var(--rahma-border)] p-3 sm:grid-cols-2 xl:grid-cols-5"
      )}
    >
      <input type="hidden" name="range" value={filters.range} />
      {compact ? (
        <>
          <DateField label="From" name="from" defaultValue={filters.from} />
          <DateField label="To" name="to" defaultValue={filters.to} />
          <ScopeSummary assignedOnly={assignedOnly} />
        </>
      ) : (
        <>
          <input type="hidden" name="from" value={filters.from} />
          <input type="hidden" name="to" value={filters.to} />
        </>
      )}
      <SelectField label="Staff" name="staffId" defaultValue={filters.staffId}>
        <option value="">All accessible staff</option>
        {staff.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="Service" name="service" defaultValue={filters.service}>
        <option value="">All services</option>
        {serviceOptions.map((service) => (
          <option key={service} value={service}>
            {service}
          </option>
        ))}
      </SelectField>
      <SelectField label="Source" name="source" defaultValue={filters.source}>
        <option value="">All sources</option>
        {sourceOptions.map((source) => (
          <option key={source} value={source}>
            {formatFilterLabel(source)}
          </option>
        ))}
      </SelectField>
      <SelectField label="Status" name="status" defaultValue={filters.status}>
        <option value="">All statuses</option>
        {statusOptions.map((status) => (
          <option key={status} value={status}>
            {formatFilterLabel(status)}
          </option>
        ))}
      </SelectField>
      <SelectField label="Payment" name="paymentStatus" defaultValue={filters.paymentStatus}>
        <option value="">All payments</option>
        {paymentOptions.map((status) => (
          <option key={status} value={status}>
            {formatFilterLabel(status)}
          </option>
        ))}
      </SelectField>
      <label
        className={cn(
          "grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]",
          !compact && "xl:col-span-2"
        )}
      >
        City or location
        <input
          name="city"
          defaultValue={filters.city}
          className="min-h-11 rounded-lg border border-[var(--rahma-border)] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[var(--rahma-charcoal)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
          placeholder="Filter by city"
        />
      </label>
      <div className={cn("flex items-end gap-2", !compact && "sm:col-span-2 xl:col-span-3")}>
        <button
          type="submit"
          className={cn(buttonVariants({ size: "sm" }), "min-h-11 bg-[var(--rahma-green)] px-6")}
        >
          Apply filters
        </button>
        <Link
          href="/admin/dashboard"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11 bg-white")}
        >
          Reset
        </Link>
      </div>
    </form>
  );
}

function AttentionQueueItem({
  item,
  href,
}: {
  item: AttentionItem;
  href: string | null;
}) {
  const content = (
    <>
      <div className="min-w-0">
        <p className="font-semibold text-[var(--rahma-charcoal)]">{item.label}</p>
        <p className="mt-1 break-words text-sm leading-5 text-[var(--rahma-muted)]">{item.detail}</p>
      </div>
      <AdminStatusBadge value={item.date} tone={item.tone === "danger" ? "danger" : item.tone} />
    </>
  );

  const className = cn(
    "grid gap-3 rounded-[var(--admin-radius-md)] border px-4 py-4 text-left transition-colors sm:grid-cols-[1fr_auto] sm:items-center",
    item.tone === "danger"
      ? "border-orange-200 bg-[#fff7ed] hover:border-orange-300"
      : item.tone === "warning"
        ? "border-[var(--rahma-border)] bg-white hover:border-[var(--rahma-green)]/30"
        : "border-[var(--rahma-border)] bg-white hover:border-[var(--rahma-green)]/30"
  );

  if (!href) {
    return (
      <div className={className}>
        {content}
        <AdminStatusBadge value="Restricted link" tone="restricted" className="w-fit" />
      </div>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

function AgendaItem({
  href,
  time,
  title,
  detail,
  status,
}: {
  href: string | null;
  time: string;
  title: string;
  detail: string;
  status: string;
}) {
  const content = (
    <>
      <div className="min-w-0">
        <p className="font-semibold text-[var(--rahma-charcoal)]">{time}</p>
        <p className="mt-1 break-words text-sm text-[var(--rahma-muted)]">
          {title} - {detail}
        </p>
      </div>
      <AdminStatusBadge
        value={status}
        tone={status === "fully_assigned" ? "success" : "warning"}
        className="w-fit"
      />
    </>
  );

  const className =
    "grid gap-3 rounded-[var(--admin-radius-md)] border border-[var(--rahma-border)] bg-[var(--admin-surface-muted)] px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center";

  return href ? (
    <Link href={href} className={cn(className, "transition-colors hover:border-[var(--rahma-green)]/35")}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function NotificationCentre({
  rescheduleRequests,
  failedEmails,
  openOperationalErrors,
  staffAvailabilityGaps,
  permissionAccess,
}: {
  rescheduleRequests: number;
  failedEmails: number;
  openOperationalErrors: number;
  staffAvailabilityGaps: number;
  permissionAccess: PermissionAccess;
}) {
  const notificationItems = (
    <NotificationList
      rescheduleRequests={rescheduleRequests}
      failedEmails={failedEmails}
      openOperationalErrors={openOperationalErrors}
      staffAvailabilityGaps={staffAvailabilityGaps}
      permissionAccess={permissionAccess}
    />
  );

  return (
    <>
      <div className="xl:hidden">
        <AdminSheet
          title="Notification drawer"
          description="Reschedule, email, operations and availability alerts stay reachable on mobile."
          side="bottom"
          trigger={
            <button
              type="button"
              className="inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--admin-radius-lg)] border border-orange-200 bg-[#fff7ed] px-4 text-sm font-semibold text-[var(--rahma-charcoal)] outline-none transition-colors hover:border-orange-300 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
            >
              <span className="inline-flex items-center gap-2">
                <Bell className="size-4 text-[var(--admin-danger)]" aria-hidden="true" />
                Notification drawer
              </span>
              <AdminStatusBadge
                value={`${formatNumber(
                  rescheduleRequests + failedEmails + openOperationalErrors + staffAvailabilityGaps
                )} alerts`}
                tone="warning"
              />
            </button>
          }
        >
          <div className="grid gap-3">{notificationItems}</div>
        </AdminSheet>
      </div>
      <AdminAttentionRail title="Notification centre" className="hidden xl:block">
        {notificationItems}
      </AdminAttentionRail>
    </>
  );
}

function NotificationList({
  rescheduleRequests,
  failedEmails,
  openOperationalErrors,
  staffAvailabilityGaps,
  permissionAccess,
}: {
  rescheduleRequests: number;
  failedEmails: number;
  openOperationalErrors: number;
  staffAvailabilityGaps: number;
  permissionAccess: PermissionAccess;
}) {
  return (
    <>
      <AdminStatusBadge value="All" tone="success" className="w-fit" />
      <NotificationCard
        title="Reschedule"
        detail={`${formatNumber(rescheduleRequests)} request(s) need admin review.`}
        href={permissionAccess.bookings ? "/admin/bookings" : null}
        tone={rescheduleRequests > 0 ? "warning" : "default"}
      />
      <NotificationCard
        title="Failed emails"
        detail={`${formatNumber(failedEmails)} failed delivery event(s).`}
        href={permissionAccess.emails ? "/admin/emails" : null}
        tone={failedEmails > 0 ? "warning" : "default"}
      />
      <NotificationCard
        title="Operational errors"
        detail={`${formatNumber(openOperationalErrors)} open event(s).`}
        href={permissionAccess.operations ? "/admin/operations" : null}
        tone={openOperationalErrors > 0 ? "warning" : "default"}
      />
      <NotificationCard
        title="Availability gap"
        detail={`${formatNumber(staffAvailabilityGaps)} custom staff rule gap(s).`}
        href={permissionAccess.staff ? "/admin/staff" : null}
        tone={staffAvailabilityGaps > 0 ? "info" : "default"}
      />
      {permissionAccess.operations ? (
        <Link
          href="/admin/operations"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--rahma-green)] px-4 text-sm font-bold text-[#ffffff] outline-none transition-colors hover:bg-[var(--rahma-green)]/90 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
          style={{ color: "#ffffff" }}
        >
          Open operations
        </Link>
      ) : null}
    </>
  );
}

function NotificationCard({
  title,
  detail,
  href,
  tone,
}: {
  title: string;
  detail: string;
  href: string | null;
  tone: "default" | "warning" | "info";
}) {
  const content = (
    <>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--rahma-charcoal)]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--rahma-muted)]">{detail}</p>
      </div>
      {href ? <ArrowRight className="size-4 text-[var(--rahma-green)]" aria-hidden="true" /> : <LockKeyhole className="size-4 text-[var(--admin-restricted)]" aria-hidden="true" />}
    </>
  );
  const className = cn(
    "flex items-start justify-between gap-3 rounded-[var(--admin-radius-md)] border px-3 py-3",
    tone === "warning" && "border-orange-200 bg-[#fff7ed]",
    tone === "info" && "border-blue-100 bg-[var(--admin-info-bg)]",
    tone === "default" && "border-[var(--rahma-border)] bg-white"
  );

  return href ? (
    <Link href={href} className={cn(className, "transition-colors hover:border-[var(--rahma-green)]/35")}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function DashboardRows({
  rows,
  empty = "No records in range.",
}: {
  rows: { label: string; value: string }[];
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--rahma-muted)]">{empty}</p>;
  }
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div
          key={`${row.label}-${row.value}`}
          className="rounded-[var(--admin-radius-md)] bg-[var(--admin-surface-muted)] px-4 py-3 text-sm"
        >
          <span className="min-w-0 break-words font-semibold text-[var(--rahma-charcoal)]">{row.label}</span>
          <span className="mt-1 block text-[var(--rahma-muted)]">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function DateField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
      {label}
      <input
        name={name}
        type="date"
        defaultValue={defaultValue}
        className="min-h-11 rounded-lg border border-[var(--rahma-border)] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-[var(--rahma-charcoal)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="min-h-11 rounded-lg border border-[var(--rahma-border)] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[var(--rahma-charcoal)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
      >
        {children}
      </select>
    </label>
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
    bookings: hasAnyPermission(profile, [
      PERMISSIONS.MANAGE_BOOKINGS_ALL,
      PERMISSIONS.MANAGE_BOOKINGS_OWN,
    ]),
    calendar: hasAnyPermission(profile, [
      PERMISSIONS.VIEW_ALL_BOOKINGS,
      PERMISSIONS.VIEW_OWN_BOOKINGS,
      PERMISSIONS.MANAGE_BOOKINGS_ALL,
      PERMISSIONS.MANAGE_BOOKINGS_OWN,
    ]),
    reports: hasAnyPermission(profile, [
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.VIEW_OWN_BOOKINGS,
      PERMISSIONS.MANAGE_BOOKINGS_OWN,
    ]),
    enquiries: hasAnyPermission(profile, [PERMISSIONS.MANAGE_CLIENTS]),
    emails: hasAnyPermission(profile, [
      PERMISSIONS.MANAGE_EMAILS,
      PERMISSIONS.MANAGE_BOOKINGS_ALL,
    ]),
    operations: hasAnyPermission(profile, [
      PERMISSIONS.MANAGE_SETTINGS,
      PERMISSIONS.MANAGE_EMAILS,
      PERMISSIONS.MANAGE_BOOKINGS_ALL,
    ]),
    staff: hasAnyPermission(profile, [
      PERMISSIONS.MANAGE_USERS,
      PERMISSIONS.MANAGE_STAFF,
    ]),
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
  return permissions.some((permission) => profile.permissions.has(permission));
}

function formatFilterLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function InsufficientPermissions() {
  return (
    <AdminAccessDenied
      title="Dashboard access limited"
      message="You need dashboard, reporting, or own-booking permission to view this area."
      permission="view_dashboard or view_reports"
    />
  );
}
