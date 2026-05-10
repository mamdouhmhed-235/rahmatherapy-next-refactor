// SERVER COMPONENT — focused dashboard for therapist staff.
//
// A therapist's day revolves around three questions: "What's next?",
// "What do I have today?", "Is there work I can claim?". The owner
// dashboard's command-centre KPI grid, business-pulse, payment-health
// etc are noise for them. This component renders only what helps them
// do their work, in a card-list layout that reads as a worker tool
// rather than admin chrome.

import Link from "next/link";
import { ArrowRight, CalendarCheck, Clock, MapPin, User } from "lucide-react";
import { AdminPageScaffold } from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { formatNumber } from "../reports/reporting";
import type { ReportData } from "../reports/reporting";

interface TherapistDashboardProps {
  staffName: string;
  today: string;
  data: ReportData;
  weekCount: number;
  todayAppointments: ReportData["bookings"];
  nextAppointment: ReportData["bookings"][number] | null;
}

const FORMATTERS = {
  weekday: new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: "Europe/London",
  }),
  longDate: new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  }),
};

function getGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Europe/London",
    }).format(new Date())
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  if (hours >= 10) return `${Math.round(hours)}h`;
  return `${hours.toFixed(1).replace(/\.0$/, "")}h`;
}

export function TherapistDashboard({
  staffName,
  today,
  data,
  weekCount,
  todayAppointments,
  nextAppointment,
}: TherapistDashboardProps) {
  const greeting = getGreeting();
  const firstName = getFirstName(staffName);
  const todayDate = new Date(`${today}T12:00:00Z`);
  const dateLabel = FORMATTERS.longDate.format(todayDate);

  // Sessions completed this week and total minutes worked.
  const completedThisWeek = data.bookings.filter(
    (booking) => booking.status === "completed"
  );
  const minutesThisWeek = completedThisWeek.reduce((acc, booking) => {
    if (!booking.start_time || !booking.end_time) return acc;
    const [sh, sm] = booking.start_time.split(":").map(Number);
    const [eh, em] = booking.end_time.split(":").map(Number);
    const minutes = eh * 60 + em - (sh * 60 + sm);
    return acc + (minutes > 0 ? minutes : 0);
  }, 0);

  return (
    <AdminPageScaffold className="gap-6">
      {/* Hero greeting */}
      <section className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-gradient-to-br from-[var(--admin-primary)]/5 via-[var(--admin-panel)] to-[var(--admin-panel)] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">
          Today · {dateLabel}
        </p>
        <h1 className="admin-display mt-1 text-2xl font-bold text-[var(--admin-heading)] sm:text-3xl">
          {greeting}, {firstName}
        </h1>
        {nextAppointment ? (
          <NextSessionCard appointment={nextAppointment} today={today} />
        ) : (
          <p className="mt-3 max-w-prose text-sm leading-6 text-[var(--admin-text-muted)]">
            No more sessions on your calendar today. Take a moment to review
            your assignments or check claimable work below.
          </p>
        )}
      </section>

      {/* Today's schedule */}
      <section>
        <SectionHeader
          title="Today's schedule"
          description={
            todayAppointments.length === 0
              ? "Nothing scheduled today."
              : `${formatNumber(todayAppointments.length)} appointment${todayAppointments.length === 1 ? "" : "s"} on your list.`
          }
          actionLabel="View all my bookings"
          actionHref="/admin/bookings"
        />
        {todayAppointments.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No appointments today"
            message="Take a moment to plan tomorrow or claim available work."
            action={{ label: "View claimable work", href: "/admin/bookings?view=claimable" }}
            compact
          />
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {todayAppointments.map((booking) => (
              <li key={booking.id}>
                <SessionCard booking={booking} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* This week summary */}
      <section>
        <SectionHeader
          title="This week"
          description="Your work in the selected range."
          actionLabel="View my report"
          actionHref="/admin/reports"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryStat
            label="Sessions completed"
            value={formatNumber(completedThisWeek.length)}
          />
          <SummaryStat
            label="Hours worked"
            value={formatHours(minutesThisWeek)}
          />
          <SummaryStat
            label="On the calendar this week"
            value={formatNumber(weekCount)}
          />
          <SummaryStat
            label="No-shows / cancellations"
            value={formatNumber(
              data.bookings.filter(
                (b) => b.status === "cancelled" || b.status === "no_show"
              ).length
            )}
          />
        </div>
      </section>
    </AdminPageScaffold>
  );
}

function NextSessionCard({
  appointment,
  today,
}: {
  appointment: ReportData["bookings"][number];
  today: string;
}) {
  const isToday = appointment.booking_date === today;
  const dateLabel = isToday
    ? "today"
    : `on ${FORMATTERS.weekday.format(new Date(`${appointment.booking_date}T12:00:00Z`))}`;
  const timeLabel = appointment.start_time?.slice(0, 5) ?? "—";
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-4 py-3 shadow-[var(--admin-shadow-subtle)]">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">
          Next session
        </p>
        <p className="mt-0.5 text-base font-semibold text-[var(--admin-heading)]">
          {timeLabel} {dateLabel}
        </p>
        <p className="mt-0.5 truncate text-sm text-[var(--admin-text-muted)]">
          {appointment.contact_full_name ?? "Client"}
          {appointment.service_city ? ` · ${appointment.service_city}` : ""}
        </p>
      </div>
      <Link
        href={`/admin/bookings/${appointment.id}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-3 text-sm font-semibold text-white outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
      >
        Open
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

function SessionCard({
  booking,
}: {
  booking: ReportData["bookings"][number];
}) {
  const time = booking.start_time?.slice(0, 5) ?? "—";
  const endTime = booking.end_time?.slice(0, 5);
  return (
    <Link
      href={`/admin/bookings/${booking.id}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-4 py-3 outline-none transition-colors hover:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
    >
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex flex-col items-center justify-center rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)] px-3 py-2 text-center min-w-[4rem]">
          <Clock
            className="size-3.5 text-[var(--admin-text-muted)]"
            aria-hidden="true"
          />
          <span className="mt-0.5 font-mono text-sm font-bold text-[var(--admin-heading)]">
            {time}
          </span>
          {endTime ? (
            <span className="text-[10px] text-[var(--admin-text-muted)]">
              -{endTime}
            </span>
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--admin-heading)]">
            <User
              className="mr-1 inline-block size-3.5 align-text-bottom text-[var(--admin-text-muted)]"
              aria-hidden="true"
            />
            {booking.contact_full_name ?? "Client"}
          </p>
          {booking.service_city ? (
            <p className="mt-0.5 truncate text-xs text-[var(--admin-text-muted)]">
              <MapPin
                className="mr-1 inline-block size-3 align-text-bottom"
                aria-hidden="true"
              />
              {booking.service_city}
            </p>
          ) : null}
        </div>
      </div>
      <ArrowRight className="size-4 shrink-0 text-[var(--admin-text-muted)]" />
    </Link>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">
        {label}
      </p>
      <p className="admin-display mt-1 text-2xl font-bold text-[var(--admin-heading)]">
        {value}
      </p>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="admin-display text-lg font-bold text-[var(--admin-heading)]">
          {title}
        </h2>
        <p className="text-sm text-[var(--admin-text-muted)]">{description}</p>
      </div>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-3 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
        >
          {actionLabel}
          <ArrowRight className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

