import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addBusinessDays, formatBusinessDate, getBusinessDate } from "@/lib/time/london";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminFilterBar,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
} from "../components/admin-ui";
import { cn } from "@/lib/utils";
import { getReportData, parseReportFilters, type ReportBooking } from "../reports/reporting";
import { PrintButton } from "./PrintButton";

export const metadata = {
  title: "Calendar - Rahma Therapy Admin",
};

interface CalendarPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function canViewCalendar(profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>) {
  return (
    profile.permissions.has(PERMISSIONS.VIEW_ALL_BOOKINGS) ||
    profile.permissions.has(PERMISSIONS.VIEW_OWN_BOOKINGS) ||
    profile.permissions.has(PERMISSIONS.MANAGE_BOOKINGS_ALL) ||
    profile.permissions.has(PERMISSIONS.MANAGE_BOOKINGS_OWN)
  );
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");
  if (!canViewCalendar(profile)) return <InsufficientPermissions />;

  const params = await searchParams;
  const selectedDate = String(params.date ?? getBusinessDate());
  const view = String(params.view ?? "week");
  const filters = parseReportFilters({
    ...params,
    from: view === "day" ? selectedDate : selectedDate,
    to: view === "day" ? selectedDate : addBusinessDays(selectedDate, 6),
  });
  const adminClient = createSupabaseAdminClient();
  const data = await getReportData(adminClient, profile, filters);
  const grouped = groupByDate(data.bookings);
  const unassigned = data.bookings.filter((booking) =>
    ["unassigned", "partially_assigned"].includes(booking.assignment_status)
  );

  return (
    <div>
      <AdminPageHeader
        title="Calendar"
        description="Daily and weekly operations agenda using Europe/London booking dates."
        actions={
          <PrintButton />
        }
      />

      <form action="/admin/calendar" className="print:hidden">
        <AdminFilterBar className="flex-wrap">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
            View
            <select name="view" defaultValue={view} className="h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm">
              <option value="day">Daily schedule</option>
              <option value="week">Weekly schedule</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
            Date
            <input name="date" type="date" defaultValue={selectedDate} className="h-10 rounded-md border border-[var(--rahma-border)] px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
            Staff
            <select name="staffId" defaultValue={filters.staffId} className="h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm">
              <option value="">All visible staff</option>
              {data.staff.map((staff) => (
                <option key={staff.id} value={staff.id}>{staff.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
            Payment
            <select name="paymentStatus" defaultValue={filters.paymentStatus} className="h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm">
              <option value="">Any payment</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </label>
          <button className={cn(buttonVariants({ size: "sm" }), "min-h-10")}>Apply</button>
        </AdminFilterBar>
      </form>

      <section className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="grid gap-4">
          {[...grouped.entries()].map(([date, bookings]) => (
            <AdminPanel key={date} title={formatBusinessDate(date)} badge={<AdminStatusBadge value={`${bookings.length} booking(s)`} tone="muted" />}>
              <div className="grid gap-3">
                {bookings.map((booking) => (
                  <CalendarBooking key={booking.id} booking={booking} />
                ))}
              </div>
            </AdminPanel>
          ))}
          {grouped.size === 0 ? (
            <AdminPanel>
              <div className="grid justify-items-center gap-2 py-12 text-center">
                <CalendarDays className="size-10 text-[var(--rahma-muted)]/35" />
                <p className="text-sm text-[var(--rahma-muted)]">No visible bookings in this calendar range.</p>
              </div>
            </AdminPanel>
          ) : null}
        </div>

        <AdminPanel title="Unassigned appointments" description="Visible in both calendar and attention queue.">
          <div className="grid gap-2">
            {unassigned.map((booking) => (
              <Link key={booking.id} href={`/admin/bookings/${booking.id}`} className="rounded-lg bg-[var(--rahma-ivory)]/70 p-3 text-sm">
                <p className="font-medium text-[var(--rahma-charcoal)]">{booking.contact_full_name ?? booking.id}</p>
                <p className="mt-1 text-[var(--rahma-muted)]">{formatBusinessDate(booking.booking_date)} · {booking.start_time.slice(0, 5)}</p>
              </Link>
            ))}
            {unassigned.length === 0 ? <p className="text-sm text-[var(--rahma-muted)]">No unassigned visible bookings.</p> : null}
          </div>
        </AdminPanel>
      </section>
    </div>
  );
}

function CalendarBooking({ booking }: { booking: ReportBooking }) {
  return (
    <Link
      href={`/admin/bookings/${booking.id}`}
      className="grid gap-3 rounded-lg border border-[var(--rahma-border)] bg-white p-4 sm:grid-cols-[5rem_minmax(0,1fr)_auto]"
    >
      <div className="text-sm font-semibold text-[var(--rahma-charcoal)]">
        {booking.start_time.slice(0, 5)}
        <span className="block text-xs font-normal text-[var(--rahma-muted)]">
          {booking.end_time.slice(0, 5)}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--rahma-charcoal)]">
          {booking.contact_full_name ?? "Unknown contact"}
        </p>
        <p className="mt-1 text-sm text-[var(--rahma-muted)]">
          {booking.service_city ?? "No city"} {booking.service_postcode ?? ""}
        </p>
        <p className="mt-1 text-xs text-[var(--rahma-muted)]">
          {booking.service_address_line1 ?? "No address"}
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-2 sm:justify-end">
        <AdminStatusBadge value={booking.status} tone={booking.status === "cancelled" ? "danger" : "muted"} />
        <AdminStatusBadge value={booking.assignment_status} tone={booking.assignment_status === "fully_assigned" ? "success" : "warning"} />
        <AdminStatusBadge value={booking.payment_status} tone={booking.payment_status === "paid" ? "success" : "warning"} />
      </div>
    </Link>
  );
}

function groupByDate(bookings: ReportBooking[]) {
  const groups = new Map<string, ReportBooking[]>();
  for (const booking of bookings) {
    groups.set(booking.booking_date, [...(groups.get(booking.booking_date) ?? []), booking]);
  }
  return groups;
}

function InsufficientPermissions() {
  return (
    <AdminAccessDenied
      title="Calendar access limited"
      message="You need booking visibility permission to view the operations calendar."
      permission="view_all_bookings or view_own_bookings"
    />
  );
}
