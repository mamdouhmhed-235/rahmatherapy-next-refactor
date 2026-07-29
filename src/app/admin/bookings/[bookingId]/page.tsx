import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  CalendarX,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Info,
  Mail,
  PoundSterling,
  ShieldX,
  Sparkles,
  Users,
  UserPlus,
  UserSearch,
} from "lucide-react";
import {
  AdminAccessDenied,
  AdminPageHeader,
  AdminPageScaffold,
  AdminPanel,
  AdminStatusBadge,
  type AdminTone,
} from "../../components/admin-ui";
import { RescheduleResponseButtons } from "./RescheduleResponseButtons";
import { EmptyState } from "../../components/EmptyState";
import { safeFormatDateTime } from "@/lib/time/format";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canAssignBookings,
  canCreateSessionNotes,
  getStaffProfile,
} from "@/lib/auth/rbac";
import { AssignmentManager } from "../AssignmentManager";
import { BookingActionButton } from "../BookingActionButton";
import { SessionNotePromptSheet } from "../SessionNotePromptSheet";
import {
  canClaimAssignments,
  canOpenBookingRecord,
  canManageAllBookings,
  canManageBookings,
  isOwnBooking,
} from "../access";
import {
  getStaffAssignmentPreviews,
  type StaffAssignmentPreview,
} from "../assignment-eligibility";
import {
  getCancellationMoment,
  getTodayIsoDate,
  isBookingDateFutureLondon,
  isBookingMomentPastLondon,
  isRestoreWindowExpired,
} from "../_helpers";
import {
  MarkNoShowButton,
  NextActionButton,
  type RestoreContext,
} from "./NextActionButton";
import {
  BookingManagementForm,
  BookingNotesScopedForm,
} from "../BookingManagementForm";
import { ClaimAssignmentButton } from "../ClaimAssignmentButton";
import { formatDate, formatLabel, formatMoney, formatTime } from "../format";
import { formatRelative } from "../../audit/format";
import type {
  AuditLogEvent,
  BookingAssignment,
  BookingParticipant,
  BookingRecord,
  BookingStatus,
} from "../types";
import { BookingCreatedToast } from "./BookingCreatedToast";
import { BookingDetailSidebar } from "./BookingDetailSidebar";

export const metadata = {
  title: "Booking detail - Rahma Therapy Admin",
};

const STATUS_TONES: Record<BookingStatus, AdminTone> = {
  pending: "info",
  confirmed: "success",
  completed: "default",
  cancelled: "danger",
  no_show: "warning",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

// `cancelled_at` is named here because `BookingRecord` (../types.ts) declares
// it. That pairing is load-bearing, not tidiness: the row arrives through an
// unchecked `.single<BookingRecordWithClientId>()` cast against an untyped
// admin client, so a column present on the type but absent from this string
// reads `undefined` at runtime with tsc, lint and vitest all green —
// `isRestoreWindowExpired` then fails closed and the Restore button disappears
// from this page while the list row (../page.tsx) still offers it. Never split
// the two.
const BOOKING_DETAIL_SELECT = `
  id,
  client_id,
  booking_date,
  start_time,
  end_time,
  total_duration_mins,
  total_price,
  contact_full_name,
  contact_email,
  contact_phone,
  booking_source,
  amount_due,
  amount_paid,
  paid_at,
  payment_note,
  status,
  payment_status,
  payment_method,
  assignment_status,
  group_booking,
  service_address_line1,
  service_address_line2,
  service_city,
  service_postcode,
  access_notes,
  consent_acknowledged,
  customer_notes,
  health_notes,
  customer_manage_notes,
  cancelled_at,
  customer_cancelled_at,
  customer_cancellation_note,
  last_customer_manage_action_at,
  reschedule_requested_at,
  reschedule_preferred_date,
  reschedule_preferred_time,
  reschedule_note,
  reschedule_status,
  admin_notes,
  treatment_notes,
  created_at,
  clients(full_name, phone, email),
  booking_participants(id, participant_gender, required_therapist_gender, is_main_contact, display_name, participant_notes, health_notes, consent_acknowledged),
  booking_items(id, booking_participant_id, service_name_snapshot, service_price_snapshot, service_duration_snapshot),
  booking_assignments(id, participant_id, assigned_staff_id, required_therapist_gender, status, staff_profiles(name)),
  email_delivery_events(id, event_type, recipient_email, recipient_role, delivery_status, provider_message_id, error_message, created_at)
`;

const CLAIMABLE_BOOKING_DETAIL_SELECT = `
  id,
  client_id,
  booking_date,
  start_time,
  end_time,
  total_duration_mins,
  status,
  assignment_status,
  group_booking,
  booking_source,
  reschedule_status,
  cancelled_at,
  customer_cancelled_at,
  created_at,
  booking_participants(id, participant_gender, required_therapist_gender, is_main_contact, consent_acknowledged),
  booking_items(id, booking_participant_id, service_name_snapshot, service_duration_snapshot),
  booking_assignments(id, participant_id, assigned_staff_id, required_therapist_gender, status, staff_profiles(name))
`;

type BookingRecordWithClientId = BookingRecord & { client_id: string | null };

interface BookingDetailPageProps {
  params: Promise<{ bookingId: string }>;
}

async function getScopedBookingRelation(
  bookingId: string,
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>,
  adminClient: ReturnType<typeof createSupabaseAdminClient>
) {
  if (canManageAllBookings(profile)) {
    return { canOpen: true, claimableOnly: false };
  }

  const { count: assignedCount } = await adminClient
    .from("booking_assignments")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .eq("assigned_staff_id", profile.id);

  if ((assignedCount ?? 0) > 0) {
    return { canOpen: true, claimableOnly: false };
  }

  const { count: claimableCount } = canClaimAssignments(profile)
    ? await adminClient
        .from("booking_assignments")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", bookingId)
        .eq("status", "unassigned")
        .is("assigned_staff_id", null)
        .eq("required_therapist_gender", profile.gender)
    : { count: 0 };

  return {
    canOpen: (claimableCount ?? 0) > 0,
    claimableOnly: (claimableCount ?? 0) > 0,
  };
}

function normalizeClaimableBooking(
  booking: Partial<BookingRecordWithClientId>
): BookingRecordWithClientId {
  return {
    id: booking.id ?? "",
    client_id: booking.client_id ?? null,
    booking_date: booking.booking_date ?? "",
    start_time: booking.start_time ?? "",
    end_time: booking.end_time ?? "",
    total_duration_mins: booking.total_duration_mins ?? null,
    total_price: null,
    contact_full_name: "Claimable booking",
    contact_email: "",
    contact_phone: "",
    booking_source: booking.booking_source ?? "",
    amount_due: null,
    amount_paid: null,
    paid_at: null,
    payment_note: null,
    status: booking.status ?? "pending",
    payment_status: "unpaid",
    payment_method: null,
    assignment_status: booking.assignment_status ?? "unassigned",
    group_booking: booking.group_booking ?? false,
    service_address_line1: null,
    service_address_line2: null,
    service_city: null,
    service_postcode: null,
    access_notes: null,
    consent_acknowledged: false,
    customer_notes: null,
    health_notes: null,
    customer_manage_notes: null,
    cancelled_at: booking.cancelled_at ?? null,
    customer_cancelled_at: booking.customer_cancelled_at ?? null,
    customer_cancellation_note: null,
    last_customer_manage_action_at: null,
    reschedule_requested_at: null,
    reschedule_preferred_date: null,
    reschedule_preferred_time: null,
    reschedule_note: null,
    reschedule_status: booking.reschedule_status ?? "none",
    admin_notes: null,
    treatment_notes: null,
    created_at: booking.created_at ?? "",
    clients: null,
    booking_participants: (booking.booking_participants ?? []).map(
      (participant) => ({
        id: participant.id,
        participant_gender: participant.participant_gender,
        required_therapist_gender: participant.required_therapist_gender,
        is_main_contact: participant.is_main_contact,
        display_name: null,
        participant_notes: null,
        health_notes: null,
        consent_acknowledged: participant.consent_acknowledged,
      })
    ),
    booking_items: (booking.booking_items ?? []).map((item) => ({
      id: item.id,
      booking_participant_id: item.booking_participant_id,
      service_name_snapshot: item.service_name_snapshot,
      service_price_snapshot: 0,
      service_duration_snapshot: item.service_duration_snapshot,
    })),
    booking_assignments: booking.booking_assignments ?? [],
  };
}

/**
 * S3 — the Restore confirm modal shows what is being undone. A customer's own
 * cancellation note wins; otherwise the most recent cancel audit row supplies
 * who and when.
 *
 * Both admin cancel paths are queried: the Status form writes
 * `booking_management_updated`, the quick action writes `booking_quick_cancel`
 * (`actions.ts`), and in production every admin cancellation so far has gone
 * through the latter.
 */
async function getRestoreContext(
  booking: BookingRecord,
  adminClient: ReturnType<typeof createSupabaseAdminClient>
): Promise<RestoreContext> {
  if (booking.customer_cancellation_note) {
    return {
      customerNote: booking.customer_cancellation_note,
      cancelledByName: null,
      cancelledAtLabel: null,
    };
  }

  const { data } = await adminClient
    .from("audit_logs")
    .select("created_at, staff_profiles(name)")
    .eq("target_id", booking.id)
    .in("action_type", ["booking_management_updated", "booking_quick_cancel"])
    .eq("after_state->>status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string; staff_profiles: { name: string } | null }>();

  return {
    customerNote: null,
    cancelledByName: data?.staff_profiles?.name ?? null,
    cancelledAtLabel: data
      ? safeFormatDateTime(data.created_at, { dateStyle: "medium" })
      : null,
  };
}

export default async function BookingDetailPage({
  params,
}: BookingDetailPageProps) {
  const { bookingId } = await params;
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!canManageBookings(profile)) {
    return <BookingAccessDenied />;
  }

  const adminClient = createSupabaseAdminClient();
  const scopedRelation = await getScopedBookingRelation(
    bookingId,
    profile,
    adminClient
  );
  if (!scopedRelation.canOpen) {
    return <BookingAccessDenied />;
  }

  const bookingResult = scopedRelation.claimableOnly
    ? (
        await adminClient
          .from("bookings")
          .select(CLAIMABLE_BOOKING_DETAIL_SELECT)
          .eq("id", bookingId)
          .single<Partial<BookingRecordWithClientId>>()
      ).data
    : (
        await adminClient
          .from("bookings")
          .select(BOOKING_DETAIL_SELECT)
          .eq("id", bookingId)
          .single<BookingRecordWithClientId>()
      ).data;

  if (!bookingResult) {
    return <BookingNotFound />;
  }

  const booking = scopedRelation.claimableOnly
    ? normalizeClaimableBooking(bookingResult)
    : (bookingResult as BookingRecordWithClientId);

  if (!canOpenBookingRecord(booking, profile)) {
    return <BookingAccessDenied />;
  }

  // C-05 Phase C — mirrors `ensureBookingActive`'s server-side gate (Phase A/B)
  // so the UI can't offer an action the server would refuse. Date-level only,
  // same as the helper: `isBookingMomentPastLondon` (S6, above) is a stricter,
  // moment-level check used only for the Restore affordance.
  const today = getTodayIsoDate();
  const isBookingActive =
    booking.status !== "cancelled" &&
    booking.status !== "no_show" &&
    booking.booking_date >= today;
  const inactivityReason: "cancelled" | "no_show" | "past_dated" | null =
    isBookingActive
      ? null
      : booking.status === "cancelled"
        ? "cancelled"
        : booking.status === "no_show"
          ? "no_show"
          : "past_dated";

  const ownBooking = isOwnBooking(booking, profile);
  const claimableOnly = !canManageAllBookings(profile) && !ownBooking;
  const fullScope = canManageAllBookings(profile);
  // Role-only signal (no booking-state factor) — kept separate from
  // `canReassignBookings` below so the inline-notice visibility check can ask
  // "would this actor be able to reassign if the booking were active?".
  const canReassignBookingsRole = fullScope && canAssignBookings(profile);
  const canReassignBookings = canReassignBookingsRole && isBookingActive;

  // C-05 Phase C, Step 11 (fix round) — gates the inline lockdown notice
  // (below). For `cancelled`/`no_show`, `fullScope` actors stay suppressed:
  // `deriveNextAction` (~line 1369) already gives them an equivalent,
  // reason-complete explanation there (incl. the S7 restore-window-expired
  // copy for cancelled, and the moment-aware copy for no_show) — showing the
  // notice too would just repeat it. `past_dated` is different: the
  // `deriveNextAction` "confirmed"/"pending" branches have no date-awareness
  // on `anyUnassigned` (they just say "pick from the Assignment panel"),
  // which is actively misleading once `AssignmentManager` is hidden for an
  // inert booking — so `past_dated` must show for ANY actor (fullScope or
  // not) who has, or would have, a practitioner-role relationship to the
  // booking. `hasClaimableSlotIfActive` is a light proxy for "canClaim would
  // be true if the booking were active": it checks gender + unassigned status
  // only, not the fuller busy/blocked-window eligibility `claimPreview`
  // carries, so it can occasionally show the notice to a therapist who is
  // claim-blocked for an unrelated reason too — acceptable, since the cost of
  // that miss is a slightly-too-eager notice, not a hidden one.
  const hasClaimableSlotIfActive =
    canClaimAssignments(profile) &&
    booking.booking_assignments.some(
      (assignment) =>
        assignment.status === "unassigned" &&
        !assignment.assigned_staff_id &&
        assignment.required_therapist_gender === profile.gender
    );
  const showInertAssignmentsNotice =
    !isBookingActive &&
    (inactivityReason === "past_dated"
      ? ownBooking || hasClaimableSlotIfActive || canReassignBookingsRole
      : !fullScope && (ownBooking || hasClaimableSlotIfActive));

  const assignmentPreviews = canReassignBookings
    ? Object.fromEntries(
        await Promise.all(
          booking.booking_assignments.map(async (assignment) => [
            assignment.id,
            await getStaffAssignmentPreviews({
              booking,
              requiredGender: assignment.required_therapist_gender,
              supabase: adminClient,
            }),
          ])
        )
      )
    : {};

  // `isBookingActive` gate here (fix round, side note): `AssignmentRow`'s
  // `canClaim` already requires `isBookingActive`, so these previews are
  // unused on an inert booking — skip the round-trip. Before Phase C added
  // `isBookingActive` to `canReassignBookings`, `!canReassignBookings` was
  // already false for fullScope actors here regardless of booking state, so
  // this branch never fired for them; the split reopened it.
  const claimEligibility =
    !canReassignBookings && isBookingActive && canClaimAssignments(profile)
      ? Object.fromEntries(
          await Promise.all(
            booking.booking_assignments.map(async (assignment) => {
              const previews = await getStaffAssignmentPreviews({
                booking,
                requiredGender: assignment.required_therapist_gender,
                supabase: adminClient,
              });
              return [
                assignment.id,
                previews.find((preview) => preview.staff.id === profile.id) ??
                  null,
              ];
            })
          )
        )
      : {};

  const auditLogs = fullScope
    ? (
        await Promise.all([
          adminClient
            .from("audit_logs")
            .select(
              "id, action_type, target_type, target_id, created_at, staff_profiles(name)"
            )
            .eq("target_id", booking.id)
            .order("created_at", { ascending: false })
            .limit(10)
            .returns<NonNullable<BookingRecord["audit_logs"]>>(),
          booking.booking_assignments.length > 0
            ? adminClient
                .from("audit_logs")
                .select(
                  "id, action_type, target_type, target_id, created_at, staff_profiles(name)"
                )
                .in(
                  "target_id",
                  booking.booking_assignments.map((assignment) => assignment.id)
                )
                .order("created_at", { ascending: false })
                .limit(10)
                .returns<NonNullable<BookingRecord["audit_logs"]>>()
            : Promise.resolve({ data: [] }),
        ])
      )
        .flatMap((result) => result.data ?? [])
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 20)
    : [];

  const bookingWithTimeline = { ...booking, audit_logs: auditLogs };
  const reference = shortRef(booking.id);
  const clientName =
    bookingWithTimeline.clients?.full_name ||
    bookingWithTimeline.contact_full_name ||
    null;
  const serviceSummary = summariseServices(bookingWithTimeline);
  const headerDescription = composeHeaderDescription({
    clientName,
    serviceSummary,
    bookingDate: bookingWithTimeline.booking_date,
    startTime: bookingWithTimeline.start_time,
    claimableOnly,
  });
  const autoCompletedAt = findRecentAutoPromotion(auditLogs);
  const nextAction = fullScope
    ? deriveNextAction(bookingWithTimeline)
    : null;
  // Only paid for when the Restore button is actually going to render.
  const restoreContext =
    nextAction?.action?.kind === "restore_booking"
      ? await getRestoreContext(bookingWithTimeline, adminClient)
      : null;

  return (
    <AdminPageScaffold className="pb-24 md:pb-0">
      <BookingCreatedToast />

      <nav aria-label="Breadcrumb" className="mb-2">
        {/* Mobile: tappable back-link pill (44px target). Desktop: ordinary breadcrumb. */}
        <Link
          href="/admin/bookings"
          className="inline-flex h-11 items-center gap-1.5 rounded-[var(--admin-radius-control)] -ml-2 px-2 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 sm:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to bookings
        </Link>
        <ol className="hidden flex-wrap items-center gap-1.5 text-sm text-[var(--admin-text-muted)] sm:flex">
          <li>
            <Link
              href="/admin/bookings"
              className="rounded-sm font-medium outline-none transition-colors hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              Bookings
            </Link>
          </li>
          <li aria-hidden="true" className="text-[var(--admin-border)]">
            <ChevronRight className="size-3.5" />
          </li>
          <li
            aria-current="page"
            title={booking.id}
            className="font-[var(--font-admin-mono),IBM_Plex_Mono,Menlo,monospace] text-[var(--admin-heading)]"
            style={{
              fontFamily:
                "var(--font-admin-mono), IBM Plex Mono, Menlo, monospace",
            }}
          >
            {reference}
          </li>
        </ol>
      </nav>

      <AdminPageHeader
        title={reference}
        description={headerDescription}
        badge={
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge
              tone={STATUS_TONES[booking.status]}
              value={STATUS_LABELS[booking.status]}
            />
            {booking.group_booking ? (
              <AdminStatusBadge tone="restricted" value="Group booking" />
            ) : null}
            {booking.reschedule_status === "requested" ? (
              <AdminStatusBadge tone="warning" value="Reschedule requested" />
            ) : null}
          </div>
        }
      />

      {autoCompletedAt ? (
        <AutoCompletedNotice promotedAt={autoCompletedAt} />
      ) : null}

      {fullScope && !booking.contact_email ? (
        <NoEmailNotice clientId={bookingWithTimeline.client_id ?? null} />
      ) : null}

      {nextAction ? (
        <NextActionStrip
          action={nextAction}
          bookingId={booking.id}
          fromStatus={booking.status}
          restoreContext={restoreContext}
        />
      ) : null}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem] lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-6">
          {fullScope && booking.reschedule_status === "requested" ? (
            <RescheduleRequestPanel booking={booking} />
          ) : null}

          {fullScope ? <BookingManagementForm booking={bookingWithTimeline} /> : null}

          <ParticipantsPanel
            booking={bookingWithTimeline}
            claimableOnly={claimableOnly}
          />

          <AssignmentPanel
            booking={bookingWithTimeline}
            profile={profile}
            canReassignBookings={canReassignBookings}
            assignmentPreviews={assignmentPreviews}
            claimEligibility={claimEligibility}
            isBookingActive={isBookingActive}
            inactivityReason={inactivityReason}
            showInertNotice={showInertAssignmentsNotice}
          />

          {!fullScope && !claimableOnly ? (
            <BookingNotesScopedForm
              booking={bookingWithTimeline}
              fields={["treatment_notes", "customer_manage_notes"]}
            />
          ) : null}

          {fullScope ? (
            <>
              <EmailActivityPanel booking={bookingWithTimeline} />
              <ActivityPanel booking={bookingWithTimeline} />
            </>
          ) : null}
        </div>

        <BookingDetailSidebar
          booking={bookingWithTimeline}
          clientId={bookingWithTimeline.client_id ?? null}
          showFinancials={fullScope}
          showClientLink={fullScope && Boolean(bookingWithTimeline.client_id)}
        />
      </div>
    </AdminPageScaffold>
  );
}

// ─── Reschedule request response (H4) ────────────────────────────────────────
// Surfaces the customer's reschedule request data + accept / decline buttons.
// Rendered only when reschedule_status === "requested" (the only state that
// produces a stuck-attention signal). Two separate forms each post to the
// shared `respondToReschedule` action with a different decision value.

function RescheduleRequestPanel({ booking }: { booking: BookingRecord }) {
  const requestedTime = booking.reschedule_preferred_time
    ? String(booking.reschedule_preferred_time).slice(0, 5)
    : null;
  const requestedAt = booking.reschedule_requested_at
    ? safeFormatDateTime(booking.reschedule_requested_at)
    : null;

  return (
    <AdminPanel
      title="Customer reschedule request"
      badge={<AdminStatusBadge tone="warning" value="Awaiting response" />}
    >
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
            Requested date &amp; time
          </dt>
          <dd className="mt-1 font-medium text-[var(--admin-heading)]">
            {booking.reschedule_preferred_date ?? "—"}
            {requestedTime ? ` at ${requestedTime}` : ""}
          </dd>
        </div>
        {booking.reschedule_note ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
              Customer note
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-[var(--admin-body)]">
              {booking.reschedule_note}
            </dd>
          </div>
        ) : null}
        {requestedAt ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
              Requested
            </dt>
            <dd className="mt-1 text-[var(--admin-text-muted)]">{requestedAt}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-4">
        <RescheduleResponseButtons bookingId={booking.id} />
      </div>
      <p className="mt-3 text-xs text-[var(--admin-text-muted)]">
        Accepting or declining records the response in the audit trail. Move
        the booking to a new date / time separately if you&rsquo;ve agreed one
        with the customer.
      </p>
    </AdminPanel>
  );
}

// ─── Participants ─────────────────────────────────────────────────────────────

function ParticipantsPanel({
  booking,
  claimableOnly,
}: {
  booking: BookingRecord;
  claimableOnly: boolean;
}) {
  if (booking.booking_participants.length === 0) {
    return (
      <AdminPanel title="Participants">
        <EmptyState
          icon={Users}
          title="No participants on file"
          message="This booking has no participants recorded yet. Add at least one before assigning a therapist."
          compact
        />
      </AdminPanel>
    );
  }

  const participantCount = booking.booking_participants.length;

  return (
    <AdminPanel
      title="Participants"
      badge={
        booking.group_booking ? (
          <AdminStatusBadge
            tone="restricted"
            value={`Group · ${participantCount}`}
          />
        ) : undefined
      }
    >
      <ul className="grid gap-3">
        {booking.booking_participants.map((participant, index) => (
          <ParticipantRow
            key={participant.id}
            participant={participant}
            index={index}
            booking={booking}
            claimableOnly={claimableOnly}
          />
        ))}
      </ul>
    </AdminPanel>
  );
}

function ParticipantRow({
  participant,
  index,
  booking,
  claimableOnly,
}: {
  participant: BookingParticipant;
  index: number;
  booking: BookingRecord;
  claimableOnly: boolean;
}) {
  const items = booking.booking_items.filter(
    (item) => item.booking_participant_id === participant.id
  );
  const sameGenderRequired =
    participant.required_therapist_gender === participant.participant_gender;

  return (
    <li className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--admin-heading)] break-words">
            {participant.display_name || `Person ${index + 1}`}
            {participant.is_main_contact ? (
              <span className="ml-2 align-middle text-xs font-medium text-[var(--admin-text-muted)]">
                main contact
              </span>
            ) : null}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <AdminStatusBadge
              tone="info"
              value={formatLabel(participant.participant_gender)}
              compact
            />
            {sameGenderRequired ? (
              <AdminStatusBadge
                tone="restricted"
                value="Same-gender required"
                compact
              />
            ) : (
              <AdminStatusBadge
                tone="muted"
                value={`Therapist: ${formatLabel(
                  participant.required_therapist_gender
                )}`}
                compact
              />
            )}
          </div>
        </div>
      </div>

      {items.length > 0 ? (
        <ul className="mt-3 grid gap-1 text-sm text-[var(--admin-text-muted)]">
          {items.map((item) => (
            <li key={item.id} className="flex items-baseline gap-2">
              <span className="text-[var(--admin-body)]">
                {item.service_name_snapshot}
              </span>
              {!claimableOnly && item.service_price_snapshot ? (
                <span>· {formatMoney(item.service_price_snapshot)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!claimableOnly &&
      (participant.participant_notes || participant.health_notes) ? (
        <div className="mt-3 grid gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)] px-3 py-2 text-sm leading-6 text-[var(--admin-text-muted)]">
          {participant.participant_notes ? (
            <p>{participant.participant_notes}</p>
          ) : null}
          {participant.health_notes ? (
            <p className="text-[var(--admin-body)]">
              <span className="font-semibold">Health: </span>
              {participant.health_notes}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

// ─── Assignment ───────────────────────────────────────────────────────────────

function AssignmentPanel({
  booking,
  profile,
  canReassignBookings,
  assignmentPreviews,
  claimEligibility,
  isBookingActive,
  inactivityReason,
  showInertNotice,
}: {
  booking: BookingRecordWithClientId;
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>;
  canReassignBookings: boolean;
  assignmentPreviews: Record<string, StaffAssignmentPreview[]>;
  claimEligibility: Record<string, StaffAssignmentPreview | null>;
  isBookingActive: boolean;
  inactivityReason: "cancelled" | "no_show" | "past_dated" | null;
  showInertNotice: boolean;
}) {
  if (booking.booking_assignments.length === 0) {
    return (
      <AdminPanel title="Assignment">
        <EmptyState
          icon={UserPlus}
          title="Not assigned yet"
          message="Pick a therapist or wait for one to claim it."
          compact
        />
      </AdminPanel>
    );
  }

  return (
    <AdminPanel title="Assignment">
      {showInertNotice ? (
        <InertBookingNotice
          reason={inactivityReason}
          restoreWindowExpired={
            inactivityReason === "cancelled" ? isRestoreWindowExpired(booking) : false
          }
        />
      ) : null}
      <ul className="grid gap-3">
        {booking.booking_assignments.map((assignment) => (
          <AssignmentRow
            key={assignment.id}
            assignment={assignment}
            booking={booking}
            profile={profile}
            canReassignBookings={canReassignBookings}
            previews={assignmentPreviews[assignment.id] ?? []}
            claimPreview={claimEligibility[assignment.id] ?? null}
            isBookingActive={isBookingActive}
          />
        ))}
      </ul>
    </AdminPanel>
  );
}

// C-05 Phase C, Step 11 — explains why the row-level affordances below are
// gone. Copy per brief §4.2; the cancelled variant reads the S7 "permanent"
// wording once the 28-day restore window (`isRestoreWindowExpired`, C-04a)
// has passed, so it never tells the actor to restore a booking the server
// would refuse to restore.
function InertBookingNotice({
  reason,
  restoreWindowExpired,
}: {
  reason: "cancelled" | "no_show" | "past_dated" | null;
  restoreWindowExpired: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rahma-pop-in mb-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-4 py-3 text-sm"
    >
      <div className="flex gap-2.5">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-medium text-[var(--admin-body)]">
            {reason === "cancelled" && "This booking is cancelled."}
            {reason === "no_show" && "This booking is marked no-show."}
            {reason === "past_dated" && "This booking is in the past."}
          </p>
          <p className="mt-1 leading-6 text-[var(--admin-text-muted)]">
            {reason === "cancelled" &&
              (restoreWindowExpired
                ? "The 28-day restore window has passed — this cancellation is permanent."
                : "Restore it before claiming, reassigning, or marking work complete.")}
            {reason === "no_show" && "Restore it if the client did attend."}
            {reason === "past_dated" &&
              "Editing past bookings should go through support."}
          </p>
        </div>
      </div>
    </div>
  );
}

function AssignmentRow({
  assignment,
  booking,
  profile,
  canReassignBookings,
  previews,
  claimPreview,
  isBookingActive,
}: {
  assignment: BookingAssignment;
  booking: BookingRecordWithClientId;
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>;
  canReassignBookings: boolean;
  previews: StaffAssignmentPreview[];
  claimPreview: StaffAssignmentPreview | null;
  isBookingActive: boolean;
}) {
  const isUnassigned =
    assignment.status === "unassigned" && !assignment.assigned_staff_id;
  const participant = booking.booking_participants.find(
    (item) => item.id === assignment.participant_id
  );
  const participantLabel = participant?.display_name
    ? participant.display_name
    : participant
      ? `Person ${
          booking.booking_participants.indexOf(participant) + 1
        }`
      : "Therapist";

  const canClaim =
    isBookingActive &&
    isUnassigned &&
    canClaimAssignments(profile) &&
    assignment.required_therapist_gender === profile.gender &&
    claimPreview?.eligible === true;

  const isAssignedToActor = assignment.assigned_staff_id === profile.id;
  const isOwn = isAssignedToActor && assignment.status === "assigned";

  // Keep the prompt mounted across the status flip from "assigned" →
  // "completed" so the dialog state set by onSuccess survives the refresh.
  const canPromptForSessionNote =
    isBookingActive &&
    isAssignedToActor &&
    canCreateSessionNotes(profile) &&
    Boolean(booking.client_id);
  const clientDisplayName =
    booking.clients?.full_name ?? booking.contact_full_name ?? "Client";

  return (
    <li className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {isUnassigned ? (
            <span
              aria-hidden="true"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[oklch(95%_0.05_65)] text-[oklch(26%_0.13_55)]"
            >
              <AlertCircle className="size-4" />
            </span>
          ) : (
            <TherapistAvatar
              name={assignment.staff_profiles?.name ?? "Unassigned"}
              seed={assignment.assigned_staff_id ?? undefined}
            />
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--admin-text-muted)]">
              For {participantLabel}
            </p>
            <p className="mt-0.5 font-semibold text-[var(--admin-heading)] break-words">
              {isUnassigned
                ? "Unassigned"
                : assignment.staff_profiles?.name ?? "Therapist"}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {isUnassigned ? (
                <AdminStatusBadge tone="warning" value="Unassigned" compact />
              ) : (
                <AdminStatusBadge
                  tone={
                    assignment.status === "completed"
                      ? "default"
                      : assignment.status === "no_show"
                        ? "warning"
                        : assignment.status === "cancelled"
                          ? "danger"
                          : "success"
                  }
                  value={formatLabel(assignment.status)}
                  compact
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {canClaim ? <ClaimAssignmentButton assignmentId={assignment.id} /> : null}

        {canPromptForSessionNote && booking.client_id ? (
          <SessionNotePromptSheet
            assignmentId={assignment.id}
            clientId={booking.client_id}
            clientName={clientDisplayName}
            showButton={isOwn}
          />
        ) : isOwn && isBookingActive ? (
          <BookingActionButton
            assignmentId={assignment.id}
            action="assignment_completed"
            variant="ghost"
          >
            Mark complete
          </BookingActionButton>
        ) : null}
        {isOwn && isBookingActive ? (
          <BookingActionButton
            assignmentId={assignment.id}
            action="assignment_no_show"
            variant="ghost"
          >
            Mark as no-show
          </BookingActionButton>
        ) : null}

        {canReassignBookings ? (
          <AssignmentManager
            assignmentId={assignment.id}
            assignedStaffId={assignment.assigned_staff_id}
            assignedStaffName={assignment.staff_profiles?.name ?? null}
            candidates={previews}
          />
        ) : null}
      </div>
    </li>
  );
}

function TherapistAvatar({ name, seed }: { name: string; seed?: string }) {
  const tint = avatarTint(seed ?? name);
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
      style={{ backgroundColor: tint.bg, color: tint.text }}
    >
      {initials(name)}
    </span>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return Array.from(parts[0]).slice(0, 2).join("").toUpperCase();
  }
  const first = Array.from(parts[0])[0] ?? "";
  const last = Array.from(parts[parts.length - 1])[0] ?? "";
  return (first + last).toUpperCase();
}

/**
 * Deterministic avatar tint — DESIGN.md §00-shared-components Open Q4 commit:
 * hue = hash(seed) % 360, chroma 0.025, lightness 88% for background;
 * matching darker hue at 26% / chroma 0.04 for readable initials.
 */
function avatarTint(seed: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    bg: `oklch(88% 0.025 ${hue})`,
    text: `oklch(26% 0.04 ${hue})`,
  };
}

// ─── Email activity & Activity timeline ───────────────────────────────────────

function EmailActivityPanel({ booking }: { booking: BookingRecord }) {
  const events = booking.email_delivery_events ?? [];

  return (
    <AdminPanel title="Email activity">
      {events.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No emails yet"
          message="Confirmation and reminder emails appear here once they go out."
          compact
        />
      ) : (
        <ul className="grid gap-2">
          {events
            .slice()
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map((event) => {
              const tone: AdminTone =
                event.delivery_status === "accepted"
                  ? "success"
                  : event.delivery_status === "failed"
                    ? "danger"
                    : "muted";
              return (
                <li
                  key={event.id}
                  className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--admin-heading)]">
                        {formatLabel(event.event_type)}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--admin-text-muted)] break-all">
                        {event.recipient_role
                          ? `${formatLabel(event.recipient_role)} · `
                          : ""}
                        {event.recipient_email ?? "no email"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <AdminStatusBadge
                        tone={tone}
                        value={formatLabel(event.delivery_status)}
                        compact
                      />
                      <time
                        className="text-[0.6875rem] text-[var(--admin-text-muted)]"
                        title={safeFormatDateTime(event.created_at)}
                        style={{
                          fontFamily:
                            "var(--font-admin-mono), IBM Plex Mono, Menlo, monospace",
                        }}
                      >
                        {safeFormatDateTime(event.created_at, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </time>
                    </div>
                  </div>
                  {event.error_message ? (
                    <p className="mt-2 break-words rounded-[var(--admin-radius-control)] bg-[oklch(95.5%_0.028_20)] px-3 py-2 text-xs text-[oklch(26%_0.14_25)]">
                      {event.error_message}
                    </p>
                  ) : null}
                </li>
              );
            })}
        </ul>
      )}
    </AdminPanel>
  );
}

const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  manual_admin_booking_created: "Booking created",
  customer_booking_created: "Booking created by client",
  booking_management_updated: "Status & payment updated",
  booking_quick_confirm: "Confirmed",
  booking_quick_mark_paid: "Marked paid",
  booking_quick_cancel: "Cancelled",
  booking_quick_complete: "Marked complete",
  booking_quick_no_show: "Marked no-show",
  booking_restored: "Restored",
  booking_auto_promoted_completed: "Auto-completed",
  booking_assignment_claimed: "Claimed by therapist",
  booking_assignment_unassigned: "Therapist removed",
  booking_assignment_reassigned: "Reassigned",
  booking_assignment_completed: "Visit completed",
  booking_assignment_no_show: "Marked as no-show",
  customer_cancelled: "Cancelled by client",
  customer_reschedule_requested: "Client asked to reschedule",
  customer_manage_notes_updated: "Notes updated by client",
};

function humanizeActivityAction(action: string): string {
  return (
    ACTIVITY_ACTION_LABELS[action] ??
    formatLabel(action).replace(/^./, (c) => c.toUpperCase())
  );
}

function ActivityPanel({ booking }: { booking: BookingRecord }) {
  const events = booking.audit_logs ?? [];

  if (events.length === 0) {
    return (
      <AdminPanel title="Activity">
        <EmptyState
          icon={Sparkles}
          title="No activity yet"
          message="Updates to this booking will appear here as you and the team work on it."
          compact
        />
      </AdminPanel>
    );
  }

  const MOBILE_VISIBLE_LIMIT = 5;
  const overflowCount = Math.max(0, events.length - MOBILE_VISIBLE_LIMIT);

  return (
    <AdminPanel title="Activity">
      <ol className="relative grid list-none gap-4 border-l border-[var(--admin-border)] pl-5">
        {events.map((event, index) => (
          <li
            key={event.id}
            className={`relative ${
              index >= MOBILE_VISIBLE_LIMIT ? "hidden md:block" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className="absolute -left-[1.625rem] top-[0.5rem] inline-flex size-2 rounded-full bg-[var(--admin-primary)] ring-2 ring-[var(--admin-panel)]"
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-sm font-medium text-[var(--admin-heading)]">
                {humanizeActivityAction(event.action_type)}
              </p>
              <time
                className="text-[0.6875rem] text-[var(--admin-text-muted)]"
                title={safeFormatDateTime(event.created_at)}
                style={{
                  fontFamily:
                    "var(--font-admin-mono), IBM Plex Mono, Menlo, monospace",
                }}
              >
                {safeFormatDateTime(event.created_at, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </time>
            </div>
            <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">
              {event.staff_profiles?.name ?? "System"}
            </p>
          </li>
        ))}
      </ol>
      {overflowCount > 0 ? (
        <p className="mt-3 text-xs text-[var(--admin-text-muted)] md:hidden">
          {overflowCount} older entr{overflowCount === 1 ? "y" : "ies"} hidden on this screen size.
        </p>
      ) : null}
    </AdminPanel>
  );
}

// ─── Fallbacks ────────────────────────────────────────────────────────────────

function BookingAccessDenied() {
  return (
    <AdminPageScaffold>
      <AdminAccessDenied
        title="You don't have access to this booking"
        message="Ask the coordinator or owner if you think this is a mistake."
        actions={
          <Link
            href="/admin/bookings"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Back to bookings
          </Link>
        }
      />
    </AdminPageScaffold>
  );
}

function BookingNotFound() {
  return (
    <AdminPageScaffold>
      <AdminPanel>
        <EmptyState
          icon={CalendarX}
          title="Booking not found"
          message="This booking may have been deleted, or you don't have access."
          action={{ label: "Back to bookings", href: "/admin/bookings" }}
          titleAs="h1"
        />
      </AdminPanel>
    </AdminPageScaffold>
  );
}

function shortRef(id: string) {
  if (!id) return "—";
  return `#${id.slice(0, 8).toUpperCase()}`;
}

// ─── Operational pulse: derived next action ───────────────────────────────────

type NextActionTone = "info" | "warning" | "success" | "default" | "danger";

type NextActionTrigger =
  | { kind: "restore_booking"; label: string; targetStatus: BookingStatus }
  | { kind: "mark_no_show"; label: string };

interface NextAction {
  tone: NextActionTone;
  icon: React.ElementType;
  headline: string;
  hint?: string;
  /**
   * Optional Cormorant Garamond numeric anchor (e.g. "£45 outstanding").
   * Rendered larger, serif, to give the page its operational pulse.
   */
  numeral?: { value: string; suffix?: string };
  /** C-04a — inline corrective action rendered inside the strip. */
  action?: NextActionTrigger;
}

function deriveNextAction(booking: BookingRecord): NextAction | null {
  if (booking.status === "cancelled") {
    // Both guards are enforced server-side by `restoreBooking`; hiding the
    // button here is affordance hygiene, and the hint has to stop promising a
    // restore that the server would refuse (B-121 was exactly that lie).
    const momentPassed = isBookingMomentPastLondon(booking);
    const windowExpired = isRestoreWindowExpired(booking);
    const cancelledAt = getCancellationMoment(booking);
    const cancelledOnLabel = cancelledAt
      ? safeFormatDateTime(cancelledAt, { dateStyle: "medium" })
      : null;

    return {
      tone: "danger",
      icon: ShieldX,
      headline: "This booking is cancelled.",
      hint: momentPassed
        ? "The appointment time has already passed — restore is no longer available. The audit log preserves the record."
        : windowExpired
          ? cancelledOnLabel
            ? `Cancelled on ${cancelledOnLabel} — the 28-day restore window has passed. The audit log preserves the record.`
            : "The 28-day restore window has passed. The audit log preserves the record."
          : // No client-email promise: a restore inside the cancellation's undo
            // window sweeps the queued email and suppresses the "you're back on"
            // one, so the client may hear nothing at all.
            "Restore it if it was cancelled by mistake.",
      action:
        momentPassed || windowExpired
          ? undefined
          : {
              kind: "restore_booking",
              label: "Restore booking",
              targetStatus: "confirmed",
            },
    };
  }

  if (booking.status === "no_show") {
    // S7 is moot here: no-show is only markable once the appointment has been
    // and gone, so S6 has already closed the restore path in practice.
    const restorable = !isBookingMomentPastLondon(booking);

    return {
      tone: "warning",
      icon: AlertCircle,
      headline: "Marked as no-show.",
      hint: restorable
        ? "Recorded. Restore it if the client did attend."
        : "Recorded for your records. Reach out to the client if you need to follow up.",
      action: restorable
        ? {
            kind: "restore_booking",
            label: "Restore booking",
            targetStatus: "confirmed",
          }
        : undefined,
    };
  }

  const fullyAssigned =
    booking.booking_assignments.length > 0 &&
    booking.booking_assignments.every(
      (assignment) =>
        Boolean(assignment.assigned_staff_id) &&
        assignment.status !== "unassigned"
    );
  const anyUnassigned = booking.booking_assignments.some(
    (assignment) =>
      !assignment.assigned_staff_id || assignment.status === "unassigned"
  );

  if (booking.status === "pending") {
    if (anyUnassigned) {
      return {
        tone: "warning",
        icon: UserSearch,
        headline: "Assign a therapist, then confirm with the client.",
        hint: "Pending bookings need both a therapist and a confirmation before the visit.",
      };
    }
    return {
      tone: "info",
      icon: CalendarCheck2,
      headline: "Ready to confirm with the client.",
      hint: "Therapist is assigned. Send the confirmation when you're ready.",
    };
  }

  if (booking.status === "completed") {
    const outstanding = computeOutstanding(booking);
    if (outstanding > 0) {
      return {
        tone: "warning",
        icon: PoundSterling,
        headline: "Visit complete. Record the payment.",
        hint: "Mark paid and add a payment note so the books match the visit.",
        numeral: { value: formatMoney(outstanding), suffix: "outstanding" },
      };
    }
    return {
      tone: "success",
      icon: ClipboardCheck,
      headline: "Visit complete and paid. Wrap up the notes.",
      hint: "Capture treatment notes while the visit is fresh.",
    };
  }

  // confirmed
  if (anyUnassigned) {
    return {
      tone: "warning",
      icon: UserSearch,
      headline: "Confirmed. A therapist still needs assigning.",
      hint: "Pick from eligible therapists in the Assignment panel below.",
    };
  }

  const outstanding = computeOutstanding(booking);

  // C-04a Phase C (B-117) — once the booking's day has arrived, the operative
  // next step is recording what happened, so the strip carries the no-show
  // shortcut. Date-only, matching `quickUpdateBooking`'s server guard exactly:
  // the button never offers a call the action would refuse.
  if (!isBookingDateFutureLondon(booking)) {
    const startedAlready = isBookingMomentPastLondon(booking);
    return {
      tone: "info",
      icon: Clock,
      headline: "Ready to mark complete.",
      hint: `${startedAlready ? "The booking was at" : "The booking starts at"} ${formatTime(booking.start_time)}. Mark it complete in Status & payment, or record a no-show.`,
      numeral:
        outstanding > 0
          ? { value: formatMoney(outstanding), suffix: "outstanding" }
          : undefined,
      action: { kind: "mark_no_show", label: "Mark no-show" },
    };
  }

  if (fullyAssigned && outstanding > 0) {
    return {
      tone: "info",
      icon: CalendarCheck2,
      headline: "All set. Visit is on the books.",
      hint: "Take payment on the day, then mark paid.",
      numeral: {
        value: formatMoney(booking.total_price ?? 0),
        suffix: "due on the day",
      },
    };
  }

  if (fullyAssigned && outstanding <= 0) {
    return {
      tone: "success",
      icon: CheckCircle2,
      headline: "Everything's in order. See you on the day.",
      hint: "Therapist assigned and payment recorded.",
    };
  }

  return null;
}

function computeOutstanding(booking: BookingRecord): number {
  const total = Number(booking.total_price ?? booking.amount_due ?? 0);
  const paid = Number(booking.amount_paid ?? 0);
  if (!Number.isFinite(total) || !Number.isFinite(paid)) return 0;
  return Math.max(0, total - paid);
}

function summariseServices(booking: BookingRecord): string | null {
  const names = booking.booking_items
    .map((item) => item.service_name_snapshot)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return null;
  const unique = Array.from(new Set(names));
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} & ${unique[1]}`;
  return `${unique[0]} & ${unique.length - 1} more`;
}

function composeHeaderDescription({
  clientName,
  serviceSummary,
  bookingDate,
  startTime,
  claimableOnly,
}: {
  clientName: string | null;
  serviceSummary: string | null;
  bookingDate: string;
  startTime: string;
  claimableOnly: boolean;
}): string {
  const when = `${formatDate(bookingDate)} at ${formatTime(startTime)}`;
  if (claimableOnly) return when;
  const lead =
    clientName && serviceSummary
      ? `${clientName} · ${serviceSummary}`
      : clientName ?? serviceSummary ?? null;
  return lead ? `${lead} · ${when}` : when;
}

// ─── NextActionStrip ──────────────────────────────────────────────────────────

const NEXT_ACTION_BG: Record<NextActionTone, string> = {
  info: "bg-[oklch(96.0%_0.038_75)] border-[oklch(88%_0.055_75)]",
  warning: "bg-[oklch(95.0%_0.050_65)] border-[oklch(88%_0.06_65)]",
  success: "bg-[oklch(93.5%_0.038_155)] border-[oklch(88%_0.055_155)]",
  default: "bg-[var(--admin-panel)] border-[var(--admin-border)]",
  danger: "bg-[oklch(95.5%_0.028_20)] border-[oklch(88%_0.045_20)]",
};

const NEXT_ACTION_TEXT: Record<NextActionTone, string> = {
  info: "text-[oklch(28%_0.120_55)]",
  warning: "text-[oklch(26%_0.130_55)]",
  success: "text-[oklch(22%_0.085_155)]",
  default: "text-[var(--admin-heading)]",
  danger: "text-[oklch(26%_0.14_25)]",
};

function NextActionStrip({
  action,
  bookingId,
  fromStatus,
  restoreContext,
}: {
  action: NextAction;
  bookingId: string;
  fromStatus: BookingStatus;
  restoreContext: RestoreContext | null;
}) {
  const Icon = action.icon;
  return (
    <section
      aria-label="Next action"
      className={`mt-1 mb-2 grid gap-4 rounded-[var(--admin-radius-card)] border px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-5 ${NEXT_ACTION_BG[action.tone]}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/55 ${NEXT_ACTION_TEXT[action.tone]}`}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p
            className={`text-xs font-semibold ${NEXT_ACTION_TEXT[action.tone]} opacity-80`}
          >
            <ArrowRight className="-mt-0.5 mr-1 inline size-3" aria-hidden="true" />
            Next
          </p>
          <p
            className="mt-1 font-display text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em] text-[var(--admin-heading)] sm:text-[1.15rem]"
          >
            {action.headline}
          </p>
          {action.hint ? (
            <p className="mt-1 max-w-[60ch] text-sm leading-6 text-[var(--admin-text-muted)]">
              {action.hint}
            </p>
          ) : null}
        </div>
      </div>
      {action.numeral ? (
        <div className="min-w-0 sm:shrink-0 sm:text-right">
          <span
            className={`block min-w-0 break-words leading-none tracking-[-0.02em] [font-variant-numeric:tabular-nums] ${NEXT_ACTION_TEXT[action.tone]}`}
            style={{
              fontFamily:
                "var(--font-admin-serif), Cormorant Garamond, Georgia, serif",
              fontSize: "2.369rem",
              fontWeight: 700,
            }}
          >
            {action.numeral.value}
          </span>
          {action.numeral.suffix ? (
            <span className="mt-1 block text-xs font-medium text-[var(--admin-text-muted)]">
              {action.numeral.suffix}
            </span>
          ) : null}
        </div>
      ) : null}
      {action.action ? (
        <div className="min-w-0 sm:shrink-0">
          {action.action.kind === "mark_no_show" ? (
            <MarkNoShowButton bookingId={bookingId} label={action.action.label} />
          ) : (
            <NextActionButton
              bookingId={bookingId}
              fromStatus={fromStatus}
              targetStatus={action.action.targetStatus}
              label={action.action.label}
              context={
                restoreContext ?? {
                  customerNote: null,
                  cancelledByName: null,
                  cancelledAtLabel: null,
                }
              }
            />
          )}
        </div>
      ) : null}
    </section>
  );
}

// ─── Auto-completed acknowledgement (C-04a Change 6) ─────────────────────────
// The booking promoting itself is otherwise silent: the practitioner sees only
// their own assignment toast, and the next page load quietly reads "Completed".
// This says so for a day, off the audit row alone — no DB state, so it ages out
// on its own (brief §4.4).

const AUTO_PROMOTE_NOTICE_MS = 24 * 60 * 60 * 1000;

function findRecentAutoPromotion(events: AuditLogEvent[]): string | null {
  const event = events.find(
    (row) =>
      row.action_type === "booking_auto_promoted_completed" &&
      Date.now() - new Date(row.created_at).getTime() < AUTO_PROMOTE_NOTICE_MS
  );
  return event?.created_at ?? null;
}

function AutoCompletedNotice({ promotedAt }: { promotedAt: string }) {
  return (
    <p className="mt-1 mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--admin-radius-control)] border border-[oklch(88%_0.055_155)] bg-[oklch(93.5%_0.038_155)] px-3 py-2 text-xs font-medium text-[oklch(22%_0.085_155)]">
      <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
      Auto-completed when all assignments were marked complete
      <span className="opacity-70">· {formatRelative(promotedAt)}</span>
    </p>
  );
}

// ─── No-email indicator (C-06) ───────────────────────────────────────────────
// Since C-06 an admin can book a phone-only client, so no confirmation or
// reminder will ever fire for this booking. Muted info tone, not a warning:
// it is a deliberate state, not something that went wrong. The fix is one hop
// away on the client record, so the chip is the link to it.

function NoEmailNotice({ clientId }: { clientId: string | null }) {
  const label = "No email — reminders off";
  const chipClass =
    "inline-flex min-h-11 items-center gap-1.5 self-start rounded-full bg-[var(--admin-panel-muted)] px-3 text-xs font-medium text-[var(--admin-text-muted)] sm:min-h-8";

  if (!clientId) {
    return (
      <p className={chipClass}>
        <Info className="size-3.5 shrink-0" aria-hidden="true" />
        {label}
      </p>
    );
  }

  return (
    <Link
      href={`/admin/clients/${clientId}/edit`}
      className={`${chipClass} outline-none transition-colors hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55`}
    >
      <Info className="size-3.5 shrink-0" aria-hidden="true" />
      {label} — add one on the client record
    </Link>
  );
}

