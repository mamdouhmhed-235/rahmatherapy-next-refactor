// SERVER COMPONENT — Therapist worker-tool dashboard variant.
//
// A therapist's day revolves around three questions: "What's next?",
// "What do I have today?", "Is there work I can claim?". This variant
// stays mobile-first (375px primary canvas) and renders only what a
// worker on the road needs. The Owner/Admin variant's KPI grid and
// command-centre tiles are explicitly out of scope here.

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  CircleCheck,
  Clock,
  Lock,
  MapPin,
  Phone,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminPageScaffold, AdminStatusBadge } from "../components/admin-ui";
import { BusinessOverviewDisclosure } from "./dashboard-filters-client";
import { DashboardHeader } from "./dashboard-header";
import { EmptyState } from "../components/EmptyState";
import { ProfileCompletionNudge } from "./ProfileCompletionNudge";
import type { ReportData } from "../reports/reporting";

interface TherapistDashboardProps {
  staffId: string;
  staffName: string;
  today: string;
  data: ReportData;
  weekCount: number;
  todayAppointments: ReportData["bookings"];
  nextAppointment: ReportData["bookings"][number] | null;
  activeRange?: string;
  // Profile-completion fields for the first-run onboarding nudge.
  // Pass-through from getStaffProfile(); the nudge hides itself once
  // profile_completed_at is set or all five visible fields are filled.
  profileCompletionFields: {
    phone: string | null;
    shortBio: string | null;
    specialties: string[] | null;
    languages: string[] | null;
    serviceAreas: string[] | null;
    profileCompletedAt: string | null;
  };
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

function formatHeroTime(start: string | null, durationMinutes: number | null) {
  const time = start?.slice(0, 5) ?? "—";
  const duration =
    durationMinutes && durationMinutes > 0 ? `${durationMinutes} min` : null;
  return duration ? `${time} · ${duration}` : time;
}

function buildAddressLines(
  booking: ReportData["bookings"][number]
): string[] {
  const lines = [
    booking.service_address_line1,
    booking.service_postcode,
    booking.service_city,
  ];
  return lines.filter((line): line is string => Boolean(line && line.trim()));
}

function buildMapsHref(booking: ReportData["bookings"][number]): string | null {
  const parts = buildAddressLines(booking);
  if (parts.length === 0) return null;
  const query = encodeURIComponent(parts.join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

type ServiceMeta = { name: string; duration: number };

function buildServiceLookup(
  items: ReportData["bookingItems"]
): Map<string, ServiceMeta> {
  const map = new Map<string, ServiceMeta>();
  for (const item of items) {
    if (!item.booking_id) continue;
    if (map.has(item.booking_id)) continue;
    map.set(item.booking_id, {
      name: item.service_name_snapshot ?? "",
      duration: item.service_duration_snapshot ?? 0,
    });
  }
  return map;
}

export function TherapistDashboard({
  staffId,
  staffName,
  today,
  data,
  weekCount,
  todayAppointments,
  nextAppointment,
  activeRange = "today",
  profileCompletionFields,
}: TherapistDashboardProps) {
  const greeting = getGreeting();
  const firstName = getFirstName(staffName);
  const hasName = firstName.trim().length > 0;
  const todayDate = new Date(`${today}T12:00:00Z`);
  const dateLabel = FORMATTERS.longDate.format(todayDate);
  const lastChecked = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date());
  const rangeLabelMap: Record<string, string> = {
    today: "Today",
    tomorrow: "Tomorrow",
    week: "This week",
    custom: "Custom range",
  };
  const rangeLabel = rangeLabelMap[activeRange] ?? "Today";

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

  const serviceLookup = buildServiceLookup(data.bookingItems);

  const claimable = data.bookings.filter(
    (booking) =>
      booking.assignment_status === "unassigned" &&
      booking.booking_date >= today &&
      booking.status !== "cancelled"
  );

  // Compute tomorrow's date (UTC-safe) for the "fully quiet" forward-anchor.
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrowKey = tomorrowDate.toISOString().slice(0, 10);
  const tomorrowVisitCount = data.bookings.filter(
    (booking) =>
      booking.booking_date === tomorrowKey && booking.status !== "cancelled"
  ).length;
  const fullyQuiet =
    !nextAppointment && todayAppointments.length === 0 && claimable.length === 0;

  // Today's-visits list excludes the Next Visit row to avoid duplication AND
  // excludes any unassigned booking (those belong to the Claimable strip, not
  // the therapist's personal Today's list — they're "open to anyone" not "yours").
  const remainingToday = (
    nextAppointment
      ? todayAppointments.filter((booking) => booking.id !== nextAppointment.id)
      : todayAppointments
  ).filter((booking) => booking.assignment_status !== "unassigned");

  const heroIsToday = nextAppointment?.booking_date === today;
  const todayWeekday = todayDate.getUTCDay();
  const isMondayMorning = todayWeekday === 1;
  const lastCompletedVisit = completedThisWeek[completedThisWeek.length - 1];
  const lastVisitWasFriday =
    lastCompletedVisit?.booking_date &&
    new Date(`${lastCompletedVisit.booking_date}T12:00:00Z`).getUTCDay() === 5;
  const heroEyebrow = nextAppointment
    ? heroIsToday
      ? isMondayMorning && lastVisitWasFriday
        ? "First visit back"
        : "Next visit"
      : "Tomorrow's first visit"
    : "Next visit";

  // ── Day-at-a-glance computations ───────────────────────────────────────────
  // Working window = earliest start to latest end across today's assigned visits
  const assignedToday = todayAppointments.filter(
    (b) => b.assignment_status !== "unassigned"
  );
  const sortedToday = [...assignedToday].sort((a, b) =>
    (a.start_time ?? "").localeCompare(b.start_time ?? "")
  );
  const workingStart = sortedToday[0]?.start_time?.slice(0, 5) ?? null;
  const workingEnd =
    sortedToday[sortedToday.length - 1]?.end_time?.slice(0, 5) ?? null;
  const workingHoursLabel =
    workingStart && workingEnd ? `${workingStart}–${workingEnd}` : null;

  const todayCounts = {
    total: assignedToday.length,
    confirmed: assignedToday.filter((b) => b.status === "confirmed").length,
    pending: assignedToday.filter((b) => b.status === "pending").length,
    completed: assignedToday.filter((b) => b.status === "completed").length,
  };

  // Average travel gap = mean of (next_start - prev_end) across consecutive visits
  function minutesOf(hhmm: string | null | undefined): number | null {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  }
  let totalGap = 0;
  let gapCount = 0;
  for (let i = 1; i < sortedToday.length; i++) {
    const prevEnd = minutesOf(sortedToday[i - 1].end_time);
    const nextStart = minutesOf(sortedToday[i].start_time);
    if (prevEnd != null && nextStart != null && nextStart > prevEnd) {
      totalGap += nextStart - prevEnd;
      gapCount += 1;
    }
  }
  const avgGapMinutes = gapCount > 0 ? Math.round(totalGap / gapCount) : null;

  // The visit AFTER nextAppointment, for hero "Then" preview
  const nextAfterNext = nextAppointment
    ? sortedToday.find((b) => {
        const aStart = minutesOf(nextAppointment.start_time);
        const bStart = minutesOf(b.start_time);
        return (
          b.id !== nextAppointment.id &&
          aStart != null &&
          bStart != null &&
          bStart > aStart
        );
      })
    : null;
  const nextAfterNextService = nextAfterNext
    ? serviceLookup.get(nextAfterNext.id)
    : null;

  // ── Tier 2 "My week" data ──────────────────────────────────────────────────
  const weekHoursLabel = formatHours(minutesThisWeek);
  const totalAttempted = data.bookings.filter(
    (b) =>
      b.assignment_status !== "unassigned" &&
      ["completed", "no_show", "cancelled"].includes(b.status)
  ).length;
  const completedCount = completedThisWeek.length;
  const completionRate =
    totalAttempted > 0 ? Math.round((completedCount / totalAttempted) * 100) : null;
  const noShowCount = data.bookings.filter(
    (b) => b.assignment_status !== "unassigned" && b.status === "no_show"
  ).length;

  // Recent clients = up to 5 most recent completed visits, deduplicated by name
  const recentClientsSorted = [...completedThisWeek].sort((a, b) => {
    if (a.booking_date !== b.booking_date) {
      return b.booking_date.localeCompare(a.booking_date);
    }
    return (b.start_time ?? "").localeCompare(a.start_time ?? "");
  });
  const seenClients = new Set<string>();
  const recentClients: Array<{
    name: string;
    lastDate: string;
    bookingId: string;
  }> = [];
  for (const b of recentClientsSorted) {
    const key = b.contact_full_name?.trim() ?? "";
    if (!key || seenClients.has(key)) continue;
    seenClients.add(key);
    recentClients.push({
      name: key,
      lastDate: b.booking_date,
      bookingId: b.id,
    });
    if (recentClients.length >= 5) break;
  }

  // Service mix from booking items (completed this week)
  const completedIds = new Set(completedThisWeek.map((b) => b.id));
  const serviceMix = new Map<string, number>();
  for (const item of data.bookingItems) {
    if (!item.booking_id || !completedIds.has(item.booking_id)) continue;
    const name = item.service_name_snapshot?.trim();
    if (!name) continue;
    serviceMix.set(name, (serviceMix.get(name) ?? 0) + 1);
  }
  const serviceMixRows = Array.from(serviceMix.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const serviceMixTotal = serviceMixRows.reduce((acc, [, n]) => acc + n, 0);

  // Tier 2 has activity if any of these are non-empty
  const tierTwoHasActivity =
    completedCount > 0 || weekCount > 0 || recentClients.length > 0;

  // Subtitle context for the shared header — date plus working window + today count
  const subtitleParts: string[] = [dateLabel];
  if (workingHoursLabel) subtitleParts.push(workingHoursLabel);
  if (todayCounts.total > 0) {
    subtitleParts.push(
      `${todayCounts.total} visit${todayCounts.total === 1 ? "" : "s"} today`
    );
  }
  const headerTitle = hasName
    ? `${greeting}, ${firstName}.`
    : `${greeting}.`;

  return (
    <AdminPageScaffold className="therapist-dashboard-fade mx-auto w-full max-w-[640px] gap-6 pb-24 md:pb-12">
      <header id="admin-main">
        <DashboardHeader
          title={headerTitle}
          subtitle={subtitleParts.join(" · ")}
          lastChecked={lastChecked}
          roleLabel="Therapist"
          rangeLabel={rangeLabel}
          updatedAtIso={new Date().toISOString()}
        />
      </header>

      <ProfileCompletionNudge
        staffId={staffId}
        firstName={firstName}
        phone={profileCompletionFields.phone}
        shortBio={profileCompletionFields.shortBio}
        specialties={profileCompletionFields.specialties}
        languages={profileCompletionFields.languages}
        serviceAreas={profileCompletionFields.serviceAreas}
        profileCompletedAt={profileCompletionFields.profileCompletedAt}
      />

      <DateRangeChips activeRange={activeRange} />

      {nextAppointment ? (
        <NextVisitHero
          appointment={nextAppointment}
          eyebrow={heroEyebrow}
          service={serviceLookup.get(nextAppointment.id)}
          thenVisit={
            nextAfterNext
              ? {
                  time: nextAfterNext.start_time?.slice(0, 5) ?? "",
                  clientName: getFirstName(
                    nextAfterNext.contact_full_name ?? "Client"
                  ),
                  serviceName:
                    nextAfterNextService?.name?.trim() || "Visit",
                }
              : null
          }
        />
      ) : (
        <HeroEmptyState hasClaimable={claimable.length > 0} />
      )}

      {fullyQuiet && tomorrowVisitCount > 0 ? (
        <Link
          href="/admin/bookings?view=upcoming"
          className="inline-flex items-center justify-between gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
        >
          <span>
            Tomorrow: {tomorrowVisitCount} visit
            {tomorrowVisitCount === 1 ? "" : "s"}
          </span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}

      {/*
       * Today's visits list: hidden entirely when the Next Visit is the only
       * one of the day (brief §5 point 3); also hidden when fully quiet (the
       * "That's all for today." line would duplicate the hero empty state).
       */}
      {nextAppointment && remainingToday.length === 0 ? null : fullyQuiet ? null : (
        <TodayVisitsList
          visits={remainingToday}
          allDoneAfterNext={Boolean(nextAppointment) && remainingToday.length === 0}
          serviceLookup={serviceLookup}
        />
      )}

      <ClaimableStrip claimable={claimable} serviceLookup={serviceLookup} />

      <MyWeekDisclosure
        staffName={staffName}
        hasActivity={tierTwoHasActivity}
        weekVisits={completedThisWeek.length}
        hoursWorked={weekHoursLabel}
        weekCount={weekCount}
        completionRate={completionRate}
        noShowCount={noShowCount}
        recentClients={recentClients}
        serviceMixRows={serviceMixRows}
        serviceMixTotal={serviceMixTotal}
      />
    </AdminPageScaffold>
  );
}


function DateRangeChips({ activeRange }: { activeRange: string }) {
  // ≥768px only. Mobile (<768px) omits the strip entirely per brief.
  const chips: Array<{ label: string; range: string }> = [
    { label: "Today", range: "today" },
    { label: "Tomorrow", range: "tomorrow" },
    { label: "This week", range: "week" },
    { label: "Custom", range: "custom" },
  ];
  return (
    <nav
      aria-label="Date range"
      className="hidden md:flex md:flex-wrap md:gap-2"
    >
      {chips.map((chip) => {
        const isActive = chip.range === activeRange;
        return (
          <Link
            key={chip.range}
            href={`/admin/dashboard?range=${chip.range}`}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "inline-flex h-9 items-center rounded-full border border-[var(--admin-primary)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-white outline-none transition-colors duration-150 ease-out focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
                : "inline-flex h-9 items-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
            }
          >
            {chip.label}
          </Link>
        );
      })}
    </nav>
  );
}

function NextVisitHero({
  appointment,
  eyebrow,
  service,
  thenVisit,
}: {
  appointment: ReportData["bookings"][number];
  eyebrow: string;
  service?: ServiceMeta;
  thenVisit?: {
    time: string;
    clientName: string;
    serviceName: string;
  } | null;
}) {
  const heroTime = formatHeroTime(
    appointment.start_time ?? null,
    service?.duration ?? null
  );
  const addressLines = buildAddressLines(appointment);
  const mapsHref = buildMapsHref(appointment);
  const phone = appointment.contact_phone ?? null;
  const serviceName = service?.name?.trim() ? service.name : "Visit";
  const clientFirstName = getFirstName(
    appointment.contact_full_name ?? "Client"
  );

  return (
    <section
      aria-labelledby="next-visit-heading"
      className="flex flex-col gap-6 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-6 sm:p-8 md:gap-7 md:p-10"
    >
      <p className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]"
         style={{ backgroundColor: "var(--status-confirmed-bg)", color: "var(--status-confirmed-text)" }}
      >
        <ArrowRight className="size-3.5" aria-hidden="true" />
        {eyebrow}
      </p>

      <div className="flex flex-col gap-3 md:gap-4">
        <h2
          id="next-visit-heading"
          style={{ fontFamily: "var(--font-urbanist), var(--font-work-sans), Arial, sans-serif" }} className="line-clamp-2 text-[1.333rem] font-semibold leading-[1.2] tracking-[-0.015em] text-[var(--admin-heading)] md:text-[1.778rem]"
        >
          {clientFirstName} · {serviceName}
        </h2>
        <p
          className="font-serif text-[2.369rem] font-bold leading-[0.95] tracking-[-0.03em] text-[var(--admin-heading)] md:text-[3.157rem]"
          style={{ fontFamily: "var(--admin-font-serif, 'Cormorant Garamond', Georgia, serif)" }}
          title={
            appointment.end_time
              ? `${appointment.start_time?.slice(0, 5)} – ${appointment.end_time.slice(0, 5)} BST`
              : undefined
          }
        >
          {heroTime}
        </p>
      </div>

      {addressLines.length > 0 ? (
        <address className="not-italic">
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm leading-6 text-[var(--admin-body)]">
            {addressLines.map((line, idx) => (
              <li key={`${line}-${idx}`} className="flex items-start gap-2">
                {idx === 0 ? (
                  <MapPin
                    className="mt-1 size-4 shrink-0 text-[var(--admin-text-muted)]"
                    aria-hidden="true"
                  />
                ) : (
                  <span aria-hidden="true" className="inline-block w-4 shrink-0" />
                )}
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </address>
      ) : null}

      <div className="flex flex-row flex-wrap gap-3">
        {mapsHref ? (
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open this address in Google Maps"
            title="Open this address in Google Maps"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
          >
            <MapPin className="size-4" aria-hidden="true" />
            Open in Maps
          </a>
        ) : null}
        {phone ? (
          <a
            href={`tel:${phone}`}
            aria-label={`Call ${clientFirstName}`}
            title={`Call ${clientFirstName} (${phone})`}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
          >
            <Phone className="size-4" aria-hidden="true" />
            Call client
          </a>
        ) : null}
      </div>

      {thenVisit ? (
        <p className="flex items-center gap-2 border-t border-[var(--admin-border)] pt-4 text-sm text-[var(--admin-text-muted)]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em]">
            Then
          </span>
          <span className="text-[var(--admin-body)]">
            {thenVisit.time} · {thenVisit.clientName} · {thenVisit.serviceName}
          </span>
        </p>
      ) : null}

      <Link
        href={`/admin/bookings/${appointment.id}`}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-white outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-primary-hover)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
      >
        Open booking
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

function HeroEmptyState({ hasClaimable }: { hasClaimable: boolean }) {
  return (
    <section
      aria-labelledby="hero-empty-heading"
      className="flex min-h-[280px] flex-col items-center justify-center rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] p-6 sm:p-8"
      style={
        hasClaimable
          ? { backgroundColor: "var(--admin-panel)" }
          : { backgroundColor: "var(--status-confirmed-bg)" }
      }
    >
      <h2 id="hero-empty-heading" className="sr-only">
        No upcoming visit
      </h2>
      <EmptyState
        icon={CalendarDays}
        title="Nothing scheduled"
        message={
          hasClaimable
            ? "Your day is clear. Anything to claim?"
            : "Quiet day. Take care of yourself."
        }
        action={
          hasClaimable
            ? {
                label: "Browse claimable work",
                href: "/admin/bookings?view=claimable",
              }
            : undefined
        }
        compact
      />
    </section>
  );
}

function TodayVisitsList({
  visits,
  allDoneAfterNext,
  serviceLookup,
}: {
  visits: ReportData["bookings"];
  allDoneAfterNext?: boolean;
  serviceLookup: Map<string, ServiceMeta>;
}) {
  return (
    <section
      aria-labelledby="today-visits-heading"
      className="flex flex-col gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="today-visits-heading"
          style={{ fontFamily: "var(--font-urbanist), var(--font-work-sans), Arial, sans-serif" }} className=" text-[1.333rem] font-semibold tracking-[-0.01em] text-[var(--admin-heading)]"
        >
          {allDoneAfterNext ? "No more visits today" : "Today's visits"}
        </h2>
        {!allDoneAfterNext && visits.length > 0 ? (
          <AdminStatusBadge value={visits.length} tone="success" compact />
        ) : null}
      </div>
      {visits.length === 0 ? (
        <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
          That's all for today.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {visits.map((booking) => (
            <li key={booking.id}>
              <TodayVisitRow
                booking={booking}
                service={serviceLookup.get(booking.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TodayVisitRow({
  booking,
  service,
}: {
  booking: ReportData["bookings"][number];
  service?: ServiceMeta;
}) {
  const time = booking.start_time?.slice(0, 5) ?? "—";
  const clientName = booking.contact_full_name ?? "Client";
  const initials = clientName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase();
  const serviceName = service?.name?.trim() ? service.name : "Visit";
  const statusFamily =
    booking.status === "confirmed"
      ? "confirmed"
      : booking.status === "completed"
        ? "completed"
        : booking.status === "cancelled"
          ? "cancelled"
          : "pending";

  return (
    <Link
      href={`/admin/bookings/${booking.id}`}
      className="flex items-center gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3 outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
    >
      <span
        aria-hidden="true"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        style={{
          backgroundColor: "var(--status-confirmed-bg)",
          color: "var(--status-confirmed-text)",
        }}
      >
        {initials || "—"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--admin-heading)]">
          {getFirstName(clientName)} · {serviceName}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--admin-text-muted)]">
          {time}
        </p>
      </div>
      <StatusPill family={statusFamily} label={statusLabel(booking.status)} />
      <ArrowRight
        className="size-4 shrink-0 text-[var(--admin-text-muted)]"
        aria-hidden="true"
      />
    </Link>
  );
}

function statusLabel(status: string | null | undefined) {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "completed":
      return "Done";
    case "cancelled":
      return "Cancelled";
    case "pending":
      return "Pending";
    case "no_show":
      return "No show";
    default:
      return status ? status.replace(/_/g, " ") : "Pending";
  }
}

function StatusPill({
  family,
  label,
}: {
  family: "confirmed" | "pending" | "cancelled" | "completed" | "attention" | "restricted";
  label: string;
}) {
  const styleMap: Record<typeof family, { bg: string; text: string; icon: LucideIcon }> = {
    confirmed: {
      bg: "var(--status-confirmed-bg)",
      text: "var(--status-confirmed-text)",
      icon: CheckCircle2,
    },
    pending: {
      bg: "var(--status-pending-bg)",
      text: "var(--status-pending-text)",
      icon: Clock,
    },
    cancelled: {
      bg: "var(--status-cancelled-bg)",
      text: "var(--status-cancelled-text)",
      icon: XCircle,
    },
    completed: {
      bg: "var(--status-completed-bg)",
      text: "var(--status-completed-text)",
      icon: CircleCheck,
    },
    attention: {
      bg: "var(--status-attention-bg)",
      text: "var(--status-attention-text)",
      icon: Clock,
    },
    restricted: {
      bg: "var(--status-restricted-bg)",
      text: "var(--status-restricted-text)",
      icon: Lock,
    },
  };
  const tones = styleMap[family];
  const Icon = tones.icon;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: tones.bg, color: tones.text }}
    >
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}

function ClaimableStrip({
  claimable,
  serviceLookup,
}: {
  claimable: ReportData["bookings"];
  serviceLookup: Map<string, ServiceMeta>;
}) {
  return (
    <section
      aria-labelledby="claimable-heading"
      className="flex flex-col gap-4 rounded-[var(--admin-radius-card)] border p-5 sm:p-6"
      style={{
        backgroundColor: "var(--status-attention-bg)",
        borderColor: "var(--status-attention-text)",
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="claimable-heading"
          style={{ fontFamily: "var(--font-urbanist), var(--font-work-sans), Arial, sans-serif" }} className="flex items-center gap-2 text-[1.333rem] font-semibold tracking-[-0.01em] text-[var(--admin-heading)]"
        >
          Open to claim
          {claimable.length > 0 ? (
            <AdminStatusBadge value={claimable.length} tone="warning" compact />
          ) : null}
        </h2>
        {claimable.length > 5 ? (
          <Link
            href="/admin/bookings?view=claimable"
            className="hidden text-xs font-semibold text-[var(--admin-body)] underline-offset-4 hover:underline lg:inline-flex"
          >
            See all {claimable.length} →
          </Link>
        ) : null}
      </div>

      {claimable.length === 0 ? (
        <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
          Nothing open right now.
        </p>
      ) : (
        <ul
          className="m-0 flex list-none gap-3 overflow-x-auto p-0 lg:grid lg:grid-cols-3 lg:overflow-visible"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {claimable.slice(0, 5).map((booking) => (
            <li
              key={booking.id}
              className="min-w-[280px] shrink-0 lg:min-w-0"
              style={{ scrollSnapAlign: "start" }}
            >
              <ClaimableCard
                booking={booking}
                service={serviceLookup.get(booking.id)}
              />
            </li>
          ))}
          {claimable.length > 5 ? (
            <li
              aria-hidden="true"
              className="flex min-w-[40px] shrink-0 items-center justify-center text-[var(--admin-text-muted)] lg:hidden"
            >
              <ArrowRight className="size-5" />
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

function ClaimableCard({
  booking,
  service,
}: {
  booking: ReportData["bookings"][number];
  service?: ServiceMeta;
}) {
  const time = booking.start_time?.slice(0, 5) ?? "—";
  const date = booking.booking_date
    ? FORMATTERS.weekday.format(new Date(`${booking.booking_date}T12:00:00Z`))
    : "";
  const clientName = booking.contact_full_name ?? "Client";
  const serviceName = service?.name?.trim() ? service.name : "Visit";
  return (
    <article className="flex h-full flex-col gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4">
      <header className="flex flex-col gap-1">
        <p className="truncate text-sm font-semibold text-[var(--admin-heading)]">
          {getFirstName(clientName)} · {serviceName}
        </p>
        <p className="text-xs text-[var(--admin-text-muted)]">
          {date} · {time}
        </p>
      </header>
      <StatusPill family="attention" label="Available" />
      <Link
        href={`/admin/bookings/${booking.id}`}
        className="mt-auto inline-flex h-11 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
      >
        View
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  );
}

function MyWeekDisclosure({
  staffName,
  hasActivity,
  weekVisits,
  hoursWorked,
  weekCount,
  completionRate,
  noShowCount,
  recentClients,
  serviceMixRows,
  serviceMixTotal,
}: {
  staffName: string;
  hasActivity: boolean;
  weekVisits: number;
  hoursWorked: string;
  weekCount: number;
  completionRate: number | null;
  noShowCount: number;
  recentClients: Array<{ name: string; lastDate: string; bookingId: string }>;
  serviceMixRows: Array<[string, number]>;
  serviceMixTotal: number;
}) {
  const hintParts: string[] = [];
  if (weekVisits > 0) {
    hintParts.push(`${weekVisits} done · about ${hoursWorked} worked`);
  }
  if (weekCount > 0) {
    hintParts.push(`${weekCount} ahead`);
  }
  const hint =
    hintParts.length > 0
      ? hintParts.join(" · ")
      : "Your week's history and patterns will appear here.";

  // The BusinessOverviewDisclosure uses staffName as the storage key so each
  // therapist has their own collapsed/expanded preference.
  return (
    <BusinessOverviewDisclosure
      staffId={`therapist-week-${staffName || "anon"}`}
      variantKey="therapist-week-"
      hasActivity={hasActivity}
      labelActive="My week"
      labelQuiet="My week (no activity yet)"
      hint={hint}
      emptyHint="Stats and recent clients will appear here as the week unfolds."
      showAriaLabel="Show this week's summary"
      hideAriaLabel="Hide this week's summary"
    >
      <div className="flex flex-col gap-4">
        <WeeklyStatsCard
          weekVisits={weekVisits}
          hoursWorked={hoursWorked}
          weekCount={weekCount}
          completionRate={completionRate}
          noShowCount={noShowCount}
        />
        {recentClients.length > 0 ? (
          <RecentClientsCard clients={recentClients} />
        ) : null}
        {serviceMixRows.length > 0 ? (
          <ServiceMixCard rows={serviceMixRows} total={serviceMixTotal} />
        ) : null}
      </div>
    </BusinessOverviewDisclosure>
  );
}

function WeeklyStatsCard({
  weekVisits,
  hoursWorked,
  weekCount,
  completionRate,
  noShowCount,
}: {
  weekVisits: number;
  hoursWorked: string;
  weekCount: number;
  completionRate: number | null;
  noShowCount: number;
}) {
  const isFreshWeek = weekVisits === 0 && weekCount === 0;
  return (
    <section
      aria-labelledby="weekly-stats-heading"
      className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5"
    >
      <h2
        id="weekly-stats-heading"
        style={{
          fontFamily:
            "var(--font-urbanist), var(--font-work-sans), Arial, sans-serif",
        }}
        className=" text-[1.333rem] font-semibold tracking-[-0.01em] text-[var(--admin-heading)]"
      >
        {isFreshWeek ? "Week starting" : "This week"}
      </h2>
      {isFreshWeek ? (
        <p className="mt-3 text-sm leading-6 text-[var(--admin-text-muted)]">
          0 visits · 0h
        </p>
      ) : (
        <dl className="mt-3 flex flex-col gap-1 text-sm text-[var(--admin-body)]">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[var(--admin-text-muted)]">Visits done</dt>
            <dd className="font-semibold text-[var(--admin-heading)]">
              {weekVisits}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[var(--admin-text-muted)]">Worked</dt>
            <dd className="font-semibold text-[var(--admin-heading)]">
              about {hoursWorked}
            </dd>
          </div>
          {weekCount > 0 ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[var(--admin-text-muted)]">Ahead</dt>
              <dd className="font-semibold text-[var(--admin-heading)]">
                {weekCount} visit{weekCount === 1 ? "" : "s"}
              </dd>
            </div>
          ) : null}
          {completionRate != null ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[var(--admin-text-muted)]">Completion</dt>
              <dd className="font-semibold text-[var(--admin-heading)]">
                {completionRate}%
              </dd>
            </div>
          ) : null}
          {noShowCount > 0 ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[var(--admin-text-muted)]">No-shows</dt>
              <dd className="font-semibold text-[var(--admin-heading)]">
                {noShowCount}
              </dd>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}

function RecentClientsCard({
  clients,
}: {
  clients: Array<{ name: string; lastDate: string; bookingId: string }>;
}) {
  return (
    <section
      aria-labelledby="recent-clients-heading"
      className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5"
    >
      <h2
        id="recent-clients-heading"
        style={{
          fontFamily:
            "var(--font-urbanist), var(--font-work-sans), Arial, sans-serif",
        }}
        className=" text-[1.333rem] font-semibold tracking-[-0.01em] text-[var(--admin-heading)]"
      >
        Recent clients
      </h2>
      <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
        {clients.map((c) => {
          const initials = c.name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => Array.from(p)[0] ?? "")
            .join("")
            .toUpperCase();
          const dateLabel = FORMATTERS.weekday.format(
            new Date(`${c.lastDate}T12:00:00Z`)
          );
          return (
            <li key={c.bookingId}>
              <Link
                href={`/admin/bookings/${c.bookingId}`}
                className="flex items-center gap-3 rounded-[var(--admin-radius-control)] px-2 py-2 outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: "var(--status-confirmed-bg)",
                    color: "var(--status-confirmed-text)",
                  }}
                >
                  {initials || "—"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--admin-heading)]">
                  {c.name}
                </span>
                <span className="text-xs text-[var(--admin-text-muted)]">
                  {dateLabel}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ServiceMixCard({
  rows,
  total,
}: {
  rows: Array<[string, number]>;
  total: number;
}) {
  return (
    <section
      aria-labelledby="service-mix-heading"
      className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5"
    >
      <h2
        id="service-mix-heading"
        style={{
          fontFamily:
            "var(--font-urbanist), var(--font-work-sans), Arial, sans-serif",
        }}
        className=" text-[1.333rem] font-semibold tracking-[-0.01em] text-[var(--admin-heading)]"
      >
        Service mix
      </h2>
      <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
        What you've been doing this week
      </p>
      <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
        {rows.map(([name, count]) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <li key={name} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-[var(--admin-body)]">
                  {name}
                </span>
                <span className="font-semibold text-[var(--admin-heading)]">
                  {count} · {pct}%
                </span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--admin-panel-muted)" }}
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: "var(--status-confirmed-text)",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Re-export helpers so the component module's contract matches RECON expectations.
export { getGreeting, getFirstName, formatHours, FORMATTERS };
