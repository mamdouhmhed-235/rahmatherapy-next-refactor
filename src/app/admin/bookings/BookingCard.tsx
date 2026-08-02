import Link from "next/link";
import { CalendarClock, Repeat, Users, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffProfile } from "@/lib/auth/rbac";
import { AdminStatusBadge, type AdminTone } from "../components/admin-ui";
import { BookingRowActions } from "./BookingRowActions";
import { hasClaimableAssignment, isOwnBooking } from "./access";
import {
  composeBookingIdentity,
  composeGenderRequirementChip,
  inertRowClassNames,
} from "./_helpers";
import { formatDate, formatLabel, formatMoney, formatTime } from "./format";
import type { BookingAssignment, BookingParticipant, BookingRecord } from "./types";

/**
 * C-13 Phase B (brief §2.2, plan Step 5-7) — extracted verbatim from the
 * inline `<article>` that used to live in `page.tsx` (was the named
 * `BookingListCard`, not inline JSX as the brief assumed). The single-booking
 * render below is a byte-for-byte copy of that JSX — only the destructured
 * function-argument list changed shape (props object, same field names) — so
 * every booking with one participant renders exactly as it did before this
 * file existed. `isGroup` (participants.length > 1) now branches to the new
 * `GroupBookingCard` nested layout instead.
 */
export type BookingCardProps = {
  booking: BookingRecord;
  profile: StaffProfile;
  canViewAll: boolean;
  today: string;
  animationDelay?: number;
};

export function BookingCard({
  booking,
  profile,
  canViewAll,
  today,
  animationDelay = 0,
}: BookingCardProps) {
  const ownBooking = isOwnBooking(booking, profile);
  const claimableBooking = hasClaimableAssignment(booking, profile);
  const showSensitiveDetails = canViewAll || ownBooking;
  const role = canViewAll ? "full" : "therapist";
  // C-05 Phase D (Edit Point 9) — cancelled / no_show / past-dated rows get a
  // strikethrough on the date+service line plus a muted overall opacity, so
  // they read as inert at a glance once Edit Point 8 makes them reachable via
  // the status filter.
  const { rowClass, titleClass } = inertRowClassNames(booking, today);

  const clientName =
    booking.contact_full_name || booking.clients?.full_name || "Unknown client";
  // C-02 Phase H (plan Step 23) — row-level recurring indicator, left of the
  // contact name (brief §4.5).
  const isRecurring = booking.recurring_template_id !== null;
  const serviceNames = Array.from(
    new Set(booking.booking_items.map((item) => item.service_name_snapshot))
  );

  const genderChip = composeGenderRequirementChip(
    booking.booking_participants,
    booking.assignment_status
  );
  // Only branch to the nested group layout when there are genuinely multiple
  // participants. `group_booking` can be true with a single participant
  // during draft states (pre-C-13 behaviour, preserved), so participant
  // count — not the flag — decides which card variant renders.
  const isGroup = booking.booking_participants.length > 1;

  const addressParts = [
    booking.service_address_line1,
    booking.service_city,
    booking.service_postcode,
  ].filter(Boolean);
  const mapUrl =
    addressParts.length > 0
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          addressParts.join(" ")
        )}`
      : null;

  const claimableAssignment = claimableBooking
    ? booking.booking_assignments.find(
        (assignment) =>
          assignment.status === "unassigned" &&
          !assignment.assigned_staff_id &&
          assignment.required_therapist_gender === profile.gender
      ) ?? null
    : null;

  if (isGroup) {
    // C-13 Phase C (brief §2.3) — the group headline swaps the plain
    // main-contact name for composite identity ("Aisha Khan + 2 others").
    // Single bookings are untouched (brief §1.3 "single bookings keep
    // clientName as today"), so this is computed only on the group branch.
    const identity = composeBookingIdentity(booking);
    return (
      <GroupBookingCard
        booking={booking}
        clientName={identity.primary}
        serviceNames={serviceNames}
        genderChip={genderChip}
        role={role}
        showSensitiveDetails={showSensitiveDetails}
        mapUrl={mapUrl}
        claimableAssignment={claimableAssignment}
        rowClass={rowClass}
        titleClass={titleClass}
        animationDelay={animationDelay}
      />
    );
  }

  const assignedTherapists = booking.booking_assignments
    .map((assignment) => assignment.staff_profiles?.name ?? null)
    .filter((name): name is string => Boolean(name));
  const distinctTherapists = Array.from(new Set(assignedTherapists));

  return (
    <article
      style={{ animationDelay: `${animationDelay}ms` }}
      className={cn(
        "rahma-row-enter grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 transition-shadow duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:shadow-[var(--admin-shadow-subtle)] sm:p-5",
        rowClass
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/bookings/${booking.id}`}
            className="block min-w-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <div className="flex items-center gap-1.5">
              {isRecurring ? (
                <span title="Part of a recurring series">
                  <Repeat
                    className="size-4 shrink-0 text-[var(--admin-text-muted)]"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Part of a recurring series</span>
                </span>
              ) : null}
              <p className="min-w-0 font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)] break-words sm:text-lg">
                {clientName}
              </p>
            </div>
            <p className={cn("mt-1 text-sm text-[var(--admin-text-muted)] break-words", titleClass)}>
              {formatDate(booking.booking_date)} · {formatTime(booking.start_time)}–{formatTime(booking.end_time)}
              {serviceNames.length > 0 ? ` · ${serviceNames.join(", ")}` : ""}
            </p>
          </Link>
          {/* Status hierarchy: one prominent badge anchors the row; everything
              else demotes to compact text or icon-only so the eye lands on
              status first. Brief mandates visible text on the same-gender +
              group chips, so those stay text-labelled but compact. */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <AdminStatusBadge
              value={formatLabel(booking.status)}
              tone={statusTone(booking.status)}
            />
            {booking.assignment_status === "unassigned" ? (
              <AdminStatusBadge value="Unassigned" tone="warning" compact />
            ) : booking.assignment_status === "partially_assigned" ? (
              <AdminStatusBadge value="Partially assigned" tone="warning" compact />
            ) : null}
            {genderChip.visible ? (
              <span
                title={genderChip.label}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-restricted-bg)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--admin-restricted)]"
              >
                {genderChip.label}
              </span>
            ) : null}
            {/* C-13 Phase B — the old "Group · N" pill lived here, gated on
                `isGroup`. It is structurally dead in this branch (isGroup is
                always false for a single-participant booking, so it never
                rendered anything here before this extraction either) and is
                superseded, for real group bookings, by GroupBookingCard's
                Users-icon headline + fraction badge below — the plan's own
                risk mitigation calls for removing it in this same commit
                rather than letting both chips render together. */}
            {booking.reschedule_status === "requested" ? (
              <span
                title="Reschedule requested by the client"
                className="inline-flex size-6 items-center justify-center rounded-full bg-[oklch(95%_0.05_65)] text-[oklch(26%_0.13_55)]"
              >
                <CalendarClock className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Reschedule requested</span>
              </span>
            ) : null}
            {booking.customer_cancelled_at ? (
              <span
                title="The client cancelled this booking"
                className="inline-flex size-6 items-center justify-center rounded-full bg-[oklch(95.5%_0.028_20)] text-[oklch(26%_0.14_25)]"
              >
                <UserX className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Client cancelled</span>
              </span>
            ) : null}
            {/* "Claimable" chip removed: redundant with the Claim button,
                which always renders on the same row for the same condition. */}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--admin-border)] pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {distinctTherapists.length > 0 ? (
            <div className="flex min-w-0 items-center gap-2">
              <AvatarStack names={distinctTherapists} />
              <span className="min-w-0 break-words text-sm text-[var(--admin-body)]">
                {distinctTherapists.join(", ")}
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
              <span
                aria-hidden="true"
                className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--admin-panel-muted)] text-xs text-[var(--admin-text-muted)]"
              >
                ?
              </span>
              No therapist yet
            </span>
          )}
          {showSensitiveDetails && booking.payment_status ? (
            <AdminStatusBadge
              value={`${formatLabel(booking.payment_status)}${
                showSensitiveDetails && booking.amount_due
                  ? ` · ${formatMoney(booking.amount_due)}`
                  : ""
              }`}
              tone={
                booking.payment_status === "paid"
                  ? "success"
                  : booking.payment_status === "unpaid"
                  ? "warning"
                  : "muted"
              }
              compact
            />
          ) : null}
        </div>

        <BookingRowActions
          bookingId={booking.id}
          clientName={clientName}
          role={role}
          status={booking.status}
          paymentStatus={booking.payment_status}
          assignmentStatus={booking.assignment_status}
          mapUrl={showSensitiveDetails ? mapUrl : null}
          claimableAssignmentId={claimableAssignment?.id ?? null}
          bookingDate={booking.booking_date}
          startTime={booking.start_time}
          cancelledAt={booking.cancelled_at}
          customerCancelledAt={booking.customer_cancelled_at}
        />
      </div>
    </article>
  );
}

/**
 * C-13 Phase B (brief §2.2, option c) — the nested group layout. Spatially
 * larger than the single card (`p-5 sm:p-6` vs `p-4 sm:p-5`), group-tinted
 * background, and a Users-icon headline. Per-participant sub-rows live in
 * their own inner panel.
 *
 * `clientName` here is the composite identity string ("Aisha Khan + 2
 * others") from `composeBookingIdentity` (C-13 Phase C, brief §2.3) — the
 * caller (`BookingCard`, group branch only) computes it and passes it in
 * under the same prop name Phase B already used for the plain main-contact
 * name, so this component's own JSX needed no structural change to pick it
 * up.
 *
 * Per-participant assignment progress (brief §2.4 / plan Phase D —
 * `assignedCount`/`totalAssignments`/`progressLabel`/`progressTone` below)
 * shipped fully in Phase B; Phase D added no further UI on top of it.
 *
 * `--admin-group-tint` (brief Q9.3) does not exist in tokens.css yet — C-11
 * shipped without introducing it, and adding a new design token is outside
 * this phase's files-touched list. Q9.3's own documented interim is
 * `bg-[var(--admin-panel-muted)]`, used here.
 */
function GroupBookingCard({
  booking,
  clientName,
  serviceNames,
  genderChip,
  role,
  showSensitiveDetails,
  mapUrl,
  claimableAssignment,
  rowClass,
  titleClass,
  animationDelay,
}: {
  booking: BookingRecord;
  clientName: string;
  serviceNames: string[];
  genderChip: ReturnType<typeof composeGenderRequirementChip>;
  role: "full" | "therapist";
  showSensitiveDetails: boolean;
  mapUrl: string | null;
  claimableAssignment: BookingAssignment | null;
  rowClass: string | undefined;
  titleClass: string | undefined;
  animationDelay: number;
}) {
  // brief §2.4 / plan Phase D — folded into Phase B per the plan's own
  // structure ("already integrated into Phase B Step 6 ... no standalone
  // phase"). One `booking_assignments` row exists per participant (audit
  // W05), so the denominator is the assignments count, not a separate
  // participant tally.
  const assignedCount = booking.booking_assignments.filter(
    (assignment) => assignment.assigned_staff_id && assignment.status !== "unassigned"
  ).length;
  const totalAssignments = booking.booking_assignments.length;
  const progressLabel = `${assignedCount} of ${totalAssignments} therapists assigned`;
  // Q9.1 locked: fully-assigned groups show "N of N" with success tone
  // (informational) rather than hiding, unlike the single-booking badge.
  const progressTone: AdminTone =
    assignedCount === 0
      ? "warning"
      : assignedCount < totalAssignments
        ? "warning"
        : "success";

  // Main contact leads the sub-row list; the rest keep the order the SELECT
  // returned them in. This projection of `booking_participants` carries no
  // `created_at`, so `is_main_contact` is the only available, deterministic
  // ordering key (plan §4 risk table: "Participant order ... Order by
  // is_main_contact DESC ... for determinism").
  const orderedParticipants = [...booking.booking_participants].sort(
    (a, b) => Number(b.is_main_contact) - Number(a.is_main_contact)
  );
  // C-02 Phase H (plan Step 23) — same row-level recurring indicator as the
  // single-booking headline above; `booking` already carries the column.
  const isRecurring = booking.recurring_template_id !== null;

  return (
    <article
      style={{ animationDelay: `${animationDelay}ms` }}
      className={cn(
        "rahma-row-enter grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-5 transition-shadow duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:shadow-[var(--admin-shadow-subtle)] sm:p-6",
        rowClass
      )}
      data-group-booking="true"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/bookings/${booking.id}`}
            className="block min-w-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <div className="flex items-center gap-2">
              <Users
                className="size-4 shrink-0 text-[var(--admin-text-muted)]"
                aria-hidden="true"
              />
              {isRecurring ? (
                <span title="Part of a recurring series">
                  <Repeat
                    className="size-4 shrink-0 text-[var(--admin-text-muted)]"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Part of a recurring series</span>
                </span>
              ) : null}
              <p className="min-w-0 font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)] break-words sm:text-lg">
                {clientName}
              </p>
            </div>
            <p className={cn("mt-1 text-sm text-[var(--admin-text-muted)] break-words", titleClass)}>
              {formatDate(booking.booking_date)} · {formatTime(booking.start_time)}–{formatTime(booking.end_time)}
              {serviceNames.length > 0 ? ` · ${serviceNames.join(", ")}` : ""}
            </p>
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <AdminStatusBadge
              value={formatLabel(booking.status)}
              tone={statusTone(booking.status)}
            />
            <AdminStatusBadge value={progressLabel} tone={progressTone} compact />
            {genderChip.visible ? (
              <span
                title={genderChip.label}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-restricted-bg)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--admin-restricted)]"
              >
                {genderChip.label}
              </span>
            ) : null}
            {booking.reschedule_status === "requested" ? (
              <span
                title="Reschedule requested by the client"
                className="inline-flex size-6 items-center justify-center rounded-full bg-[oklch(95%_0.05_65)] text-[oklch(26%_0.13_55)]"
              >
                <CalendarClock className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Reschedule requested</span>
              </span>
            ) : null}
            {booking.customer_cancelled_at ? (
              <span
                title="The client cancelled this booking"
                className="inline-flex size-6 items-center justify-center rounded-full bg-[oklch(95.5%_0.028_20)] text-[oklch(26%_0.14_25)]"
              >
                <UserX className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Client cancelled</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <ul className="grid gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3">
        {orderedParticipants.map((participant, index) => (
          <ParticipantSubRow
            key={participant.id}
            participant={participant}
            assignment={
              booking.booking_assignments.find(
                (assignment) => assignment.participant_id === participant.id
              ) ?? null
            }
            index={index}
          />
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t border-[var(--admin-border)] pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {showSensitiveDetails && booking.payment_status ? (
            <AdminStatusBadge
              value={`${formatLabel(booking.payment_status)}${
                showSensitiveDetails && booking.amount_due
                  ? ` · ${formatMoney(booking.amount_due)}`
                  : ""
              }`}
              tone={
                booking.payment_status === "paid"
                  ? "success"
                  : booking.payment_status === "unpaid"
                  ? "warning"
                  : "muted"
              }
              compact
            />
          ) : null}
        </div>

        <BookingRowActions
          bookingId={booking.id}
          clientName={clientName}
          role={role}
          status={booking.status}
          paymentStatus={booking.payment_status}
          assignmentStatus={booking.assignment_status}
          mapUrl={showSensitiveDetails ? mapUrl : null}
          claimableAssignmentId={claimableAssignment?.id ?? null}
          bookingDate={booking.booking_date}
          startTime={booking.start_time}
          cancelledAt={booking.cancelled_at}
          customerCancelledAt={booking.customer_cancelled_at}
        />
      </div>
    </article>
  );
}

/**
 * One row per participant inside the group card's inner panel (brief §2.2
 * "Per-participant sub-row content"). Gender is a compact Unicode glyph
 * (Q9.2 locked) with an `aria-label` carrying the text equivalent; the main
 * gender CHIP above (from `composeGenderRequirementChip`) stays text-labelled
 * for accessibility, per the same locked decision.
 */
function ParticipantSubRow({
  participant,
  assignment,
  index,
}: {
  participant: BookingParticipant;
  assignment: BookingAssignment | null;
  index: number;
}) {
  const name = participant.display_name || `Person ${index + 1}`;
  const genderIcon = participant.participant_gender === "female" ? "♀" : "♂";
  const genderLabel =
    participant.participant_gender === "female" ? "female participant" : "male participant";
  const assignedTherapistName = assignment?.assigned_staff_id
    ? assignment.staff_profiles?.name ?? "Assigned"
    : null;
  const stateLabel = assignedTherapistName
    ? `Assigned to ${assignedTherapistName}`
    : `Open — needs ${participant.required_therapist_gender} therapist`;

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-0.5 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 break-words text-[var(--admin-body)]">{name}</span>
        {participant.is_main_contact ? (
          <span className="shrink-0 text-xs font-medium text-[var(--admin-text-muted)]">
            (main)
          </span>
        ) : null}
        <span aria-label={genderLabel} className="shrink-0 text-[var(--admin-text-muted)]">
          {genderIcon}
        </span>
      </div>
      <span
        className={cn(
          "shrink-0 text-xs",
          assignedTherapistName
            ? "text-[var(--admin-body)]"
            : "text-[var(--admin-status-attention-text)]"
        )}
      >
        {stateLabel}
      </span>
    </li>
  );
}

function statusTone(value: string) {
  switch (value) {
    case "pending":
      return "info" as const;
    case "confirmed":
      return "success" as const;
    case "completed":
      return "success" as const;
    case "cancelled":
    case "no_show":
      return "danger" as const;
    default:
      return "muted" as const;
  }
}

function AvatarStack({ names }: { names: string[] }) {
  const visible = names.slice(0, 3);
  const extra = names.length - visible.length;
  return (
    <div className="flex -space-x-2">
      {visible.map((name) => (
        <span
          key={name}
          title={name}
          aria-hidden="true"
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full border-2 border-[var(--admin-panel)]",
            "bg-[var(--admin-hover-mist)] text-[0.75rem] font-semibold text-[var(--admin-heading)]"
          )}
        >
          {initials(name)}
        </span>
      ))}
      {extra > 0 ? (
        <span
          aria-hidden="true"
          className="inline-flex size-8 items-center justify-center rounded-full border-2 border-[var(--admin-panel)] bg-[var(--admin-panel-muted)] text-[0.6875rem] font-semibold text-[var(--admin-text-muted)]"
        >
          +{extra}
        </span>
      ) : null}
      <span className="sr-only">{names.join(", ")}</span>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
