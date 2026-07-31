"use client"; // Mark-complete's temporal guard + RelativeTimeDisplay need
// client-side effects (hydration-safe — see NextVisitHero below).

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminStatusBadge } from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { BookingActionButton } from "../bookings/BookingActionButton";
import {
  buildAddressLines,
  buildMapsHref,
  formatHeroTime,
  getFirstName,
  type ServiceMeta,
} from "./shared-helpers";
import type { ReportData } from "../reports/reporting";
import { RelativeTimeDisplay } from "./RelativeTimeDisplay";

// C-FIELDWORK Phase C — capability-keyed "today" drop-in for any dashboard
// variant where profile.can_take_bookings === true. The hero/list/empty-state
// JSX below is LIFTED from TherapistDashboard.tsx's NextVisitHero (558-684),
// HeroEmptyState (686-721) and TodayVisitsList (723+) — same styling, same
// tokens, same icons — adapted to this component's simpler prop-driven
// interface (no page-level "this week"/"then visit" context; the hero eyebrow
// arrived later as the optional `eyebrow` prop below) and extended with the
// Mark-complete control (new — see NextVisitHero).

interface PractitionerTodaySectionProps {
  // Capability-keyed: parent must check profile.can_take_bookings before
  // rendering. Accepted for interface parity with the plan's locked contract
  // and for callers that want it (e.g. an aria-label); not otherwise read
  // inside this component — the greeting itself is rendered by the page's
  // own header, not this section.
  staffName: string;
  todayAppointments: ReportData["bookings"];
  nextAppointment: ReportData["bookings"][number] | null;
  // Optional claimable section — 0 (default) hides it.
  claimableCount?: number;
  // Resolved `booking_assignments.id` for nextAppointment, matched to this
  // viewer's own assignment (mirrors the claimableAssignmentByBookingId
  // pattern in TherapistDashboard.tsx). Omitted/null hides the Mark-complete
  // control entirely — Phase D wires the real value.
  nextAppointmentAssignmentId?: string | null;
  // booking id -> service name/duration, built via buildServiceLookup(data.bookingItems).
  // Defaults to an empty Map; missing entries fall back to "Visit" (existing pattern).
  serviceLookup?: Map<string, ServiceMeta>;
  // Whether this component's own internal (simple, link-only) ClaimableStrip
  // should render when claimableCount > 0. Defaults to true. Callers that
  // already show their own richer claimable UI elsewhere on the page (e.g.
  // TherapistDashboard.tsx's per-card ClaimableStrip/ClaimableCard) pass
  // false here to avoid rendering two claimable strips at once, while still
  // passing the real claimableCount so the EmptyDayCard branch below
  // correctly recognizes that claimable work exists.
  showClaimableStrip?: boolean;
  // Label on the hero's eyebrow badge. Omitted → "Next visit", which is what
  // every caller rendered before this prop existed. Callers with day-context
  // to add pass their own framing (TherapistDashboard derives "First visit
  // back" / "Tomorrow's first visit"); callers without it should omit this.
  eyebrow?: string;
}

export function PractitionerTodaySection({
  todayAppointments,
  nextAppointment,
  claimableCount = 0,
  nextAppointmentAssignmentId = null,
  serviceLookup = new Map(),
  showClaimableStrip = true,
  eyebrow = "Next visit",
}: PractitionerTodaySectionProps) {
  const hasAnyAppt = todayAppointments.length > 0 || Boolean(nextAppointment);

  if (!hasAnyAppt && claimableCount === 0) {
    return <EmptyDayCard />;
  }

  // Today's list excludes the Next Visit row to avoid duplicating it (mirrors
  // TherapistDashboard.tsx's `remainingToday` — brief §2.3: "'Today's visits'
  // list — remaining today appointments below the hero").
  const remainingToday = nextAppointment
    ? todayAppointments.filter((booking) => booking.id !== nextAppointment.id)
    : todayAppointments;

  return (
    <>
      {nextAppointment ? (
        <NextVisitHero
          appointment={nextAppointment}
          service={serviceLookup.get(nextAppointment.id)}
          assignmentId={nextAppointmentAssignmentId}
          eyebrow={eyebrow}
        />
      ) : null}
      {remainingToday.length > 0 ? (
        <TodayVisitsList
          appointments={remainingToday}
          serviceLookup={serviceLookup}
        />
      ) : null}
      {showClaimableStrip && claimableCount > 0 ? (
        <ClaimableStrip count={claimableCount} />
      ) : null}
    </>
  );
}

function NextVisitHero({
  appointment,
  service,
  assignmentId,
  eyebrow,
}: {
  appointment: ReportData["bookings"][number];
  service?: ServiceMeta;
  assignmentId?: string | null;
  eyebrow: string;
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
  const startTimeLabel = appointment.start_time?.slice(0, 5) ?? null;
  // Hydration-safe target for both the relative-time text and the
  // Mark-complete temporal guard — brief §5.8's mitigation (client-only)
  // applies to both since a server/client DOM mismatch on the *button
  // element itself* would be a real hydration error, not just a text diff.
  const startISO =
    appointment.start_time && appointment.booking_date
      ? `${appointment.booking_date}T${appointment.start_time}`
      : null;

  return (
    <section
      aria-labelledby="practitioner-next-visit-heading"
      className="flex flex-col gap-6 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-6 sm:p-8 md:gap-7 md:p-10"
    >
      <p
        className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]"
        style={{
          backgroundColor: "var(--status-confirmed-bg)",
          color: "var(--status-confirmed-text)",
        }}
      >
        <ArrowRight className="size-3.5" aria-hidden="true" />
        {eyebrow}
        {startISO ? (
          <>
            {" "}
            · <RelativeTimeDisplay targetISO={startISO} />
          </>
        ) : null}
      </p>

      <div className="flex flex-col gap-3 md:gap-4">
        <h2
          id="practitioner-next-visit-heading"
          style={{
            fontFamily:
              "var(--font-urbanist), var(--font-work-sans), Arial, sans-serif",
          }}
          className="line-clamp-2 text-[1.333rem] font-semibold leading-[1.2] tracking-[-0.015em] text-[var(--admin-heading)] md:text-[1.778rem]"
        >
          {clientFirstName} · {serviceName}
        </h2>
        <p
          className="font-serif text-[2.369rem] font-bold leading-[0.95] tracking-[-0.03em] text-[var(--admin-heading)] md:text-[3.157rem]"
          style={{
            fontFamily:
              "var(--admin-font-serif, 'Cormorant Garamond', Georgia, serif)",
          }}
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
                  <span
                    aria-hidden="true"
                    className="inline-block w-4 shrink-0"
                  />
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
        {assignmentId ? (
          <MarkCompleteControl
            assignmentId={assignmentId}
            startISO={startISO}
            startTimeLabel={startTimeLabel}
          />
        ) : null}
      </div>

      <Link
        href={`/admin/bookings/${appointment.id}`}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-primary-hover)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
      >
        Open booking
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

// C-FIELDWORK Phase C, Step 9 — new functionality (the shipped
// TherapistDashboard.tsx NextVisitHero has no Mark-complete button today).
// Locked wrapper pattern: a plain disabled <button> before start_time, the
// real BookingActionButton (assignment_completed) at/after. The on/off
// decision is computed client-side only (useState defaulting to disabled +
// useEffect flip) — exactly like RelativeTimeDisplay's mitigation — because
// unlike a text diff, rendering a disabled <button> on the server vs. the
// real <BookingActionButton> on the client would be a genuine hydration
// mismatch (different DOM subtrees), not just a tolerated text diff.
function MarkCompleteControl({
  assignmentId,
  startISO,
  startTimeLabel,
}: {
  assignmentId: string;
  startISO: string | null;
  startTimeLabel: string | null;
}) {
  const [canMarkComplete, setCanMarkComplete] = useState(false);

  useEffect(() => {
    if (!startISO) return;
    const target = new Date(startISO).getTime();
    const check = () => setCanMarkComplete(Date.now() >= target);
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [startISO]);

  if (canMarkComplete) {
    return (
      <div className="flex-1">
        <BookingActionButton
          assignmentId={assignmentId}
          action="assignment_completed"
          variant="primary"
          size="touch"
        >
          Mark complete
        </BookingActionButton>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled
      title={
        startTimeLabel
          ? `Available at ${startTimeLabel}`
          : "Available at the visit's start time"
      }
      className="inline-flex h-11 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 text-sm font-semibold text-[var(--admin-text-muted)] opacity-60"
    >
      Mark complete
    </button>
  );
}

function TodayVisitsList({
  appointments,
  serviceLookup,
}: {
  appointments: ReportData["bookings"];
  serviceLookup: Map<string, ServiceMeta>;
}) {
  const capped = appointments.slice(0, 5);
  const hasMore = appointments.length > 5;

  return (
    <section
      aria-labelledby="practitioner-today-visits-heading"
      className="flex flex-col gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="practitioner-today-visits-heading"
          style={{
            fontFamily:
              "var(--font-urbanist), var(--font-work-sans), Arial, sans-serif",
          }}
          className="text-[1.333rem] font-semibold tracking-[-0.01em] text-[var(--admin-heading)]"
        >
          Today&apos;s visits
        </h2>
        <AdminStatusBadge value={appointments.length} tone="success" compact />
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {capped.map((booking) => (
          <li key={booking.id}>
            <TodayVisitRow
              booking={booking}
              service={serviceLookup.get(booking.id)}
            />
          </li>
        ))}
      </ul>
      {hasMore ? (
        <Link
          href="/admin/bookings?view=today"
          className="inline-flex items-center gap-1 self-start text-xs font-semibold text-[var(--admin-body)] underline-offset-4 hover:underline"
        >
          View all today&apos;s visits
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      ) : null}
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

// Local, unexported — same visual treatment as TherapistDashboard.tsx's own
// StatusPill (not exported from there, so re-declared here rather than
// touching that file). Only the 4 tones TodayVisitRow actually uses.
function StatusPill({
  family,
  label,
}: {
  family: "confirmed" | "pending" | "cancelled" | "completed";
  label: string;
}) {
  const styleMap: Record<
    typeof family,
    { bg: string; text: string; icon: LucideIcon }
  > = {
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
      icon: CheckCircle2,
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

function ClaimableStrip({ count }: { count: number }) {
  return (
    <Link
      href="/admin/bookings?view=claimable"
      className="inline-flex items-center justify-between gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
    >
      <span>
        Open to claim — {count} available
      </span>
      <span className="inline-flex items-center gap-1">
        Browse claimable work
        <ArrowRight className="size-4" aria-hidden="true" />
      </span>
    </Link>
  );
}

function EmptyDayCard() {
  return (
    <section
      aria-labelledby="practitioner-today-empty-heading"
      className="flex min-h-[280px] flex-col items-center justify-center rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] p-6 sm:p-8"
      style={{ backgroundColor: "var(--status-confirmed-bg)" }}
    >
      <h2 id="practitioner-today-empty-heading" className="sr-only">
        No upcoming visit
      </h2>
      <EmptyState
        icon={CalendarDays}
        illustrationSrc="/images/admin/empty-states/all-caught-up.svg"
        title="Nothing scheduled"
        message="Quiet day. Take care of yourself."
        compact
      />
    </section>
  );
}
