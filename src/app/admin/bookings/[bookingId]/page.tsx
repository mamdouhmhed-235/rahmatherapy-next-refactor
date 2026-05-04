import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  Mail,
  MapPin,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { AdminAccessDenied } from "../../components/admin-ui";
import { AssignmentManager } from "../AssignmentManager";
import { BookingActionButton } from "../BookingActionButton";
import {
  canClaimAssignments,
  canManageAllBookings,
  canManageBookings,
  hasClaimableAssignment,
  isOwnBooking,
} from "../access";
import {
  getStaffAssignmentPreviews,
  type StaffAssignmentPreview,
} from "../assignment-eligibility";
import { BookingManagementForm } from "../BookingManagementForm";
import { ClaimAssignmentButton } from "../ClaimAssignmentButton";
import { formatDate, formatLabel, formatMoney, formatTime } from "../format";
import type { BookingRecord } from "../types";

export const metadata = {
  title: "Booking Detail - Rahma Therapy Admin",
};

const BOOKING_DETAIL_SELECT = `
  id,
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

interface BookingDetailPageProps {
  params: Promise<{ bookingId: string }>;
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
    return <InsufficientPermissions />;
  }

  const adminClient = createSupabaseAdminClient();
  const { data: booking } = await adminClient
    .from("bookings")
    .select(BOOKING_DETAIL_SELECT)
    .eq("id", bookingId)
    .single<BookingRecord>();

  if (!booking) notFound();

  if (
    !canManageAllBookings(profile) &&
    !isOwnBooking(booking, profile) &&
    !hasClaimableAssignment(booking, profile)
  ) {
    return <InsufficientPermissions />;
  }

  const canReassignBookings =
    canManageAllBookings(profile) &&
    profile.permissions.has(PERMISSIONS.REASSIGN_BOOKINGS);
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
  const auditLogs = canManageAllBookings(profile)
    ? (
        await Promise.all([
          adminClient
            .from("audit_logs")
            .select("id, action_type, target_type, target_id, created_at, staff_profiles(name)")
            .eq("target_id", booking.id)
            .order("created_at", { ascending: false })
            .limit(10)
            .returns<NonNullable<BookingRecord["audit_logs"]>>(),
          booking.booking_assignments.length > 0
            ? adminClient
                .from("audit_logs")
                .select("id, action_type, target_type, target_id, created_at, staff_profiles(name)")
                .in("target_id", booking.booking_assignments.map((assignment) => assignment.id))
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
  const bookingWithTimeline = {
    ...booking,
    audit_logs: auditLogs,
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/bookings"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--rahma-muted)] transition-colors hover:text-[var(--rahma-green)]"
        >
          <ArrowLeft className="size-4" />
          Back to bookings
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
              {bookingWithTimeline.contact_full_name || bookingWithTimeline.clients?.full_name || "Unknown client"}
            </h1>
            <p className="mt-1 text-sm text-[var(--rahma-muted)]">
              {formatDate(bookingWithTimeline.booking_date)} at{" "}
              {formatTime(bookingWithTimeline.start_time)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={bookingWithTimeline.status} />
            <StatusBadge value={bookingWithTimeline.assignment_status} muted />
            {bookingWithTimeline.group_booking ? <StatusBadge value="group booking" muted /> : null}
            {bookingWithTimeline.reschedule_status === "requested" ? (
              <StatusBadge value="reschedule requested" muted />
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid gap-6">
          {canManageAllBookings(profile) ? (
            <BookingManagementForm booking={bookingWithTimeline} />
          ) : null}
          <ParticipantBreakdown
            booking={bookingWithTimeline}
            profile={profile}
            canReassignBookings={canReassignBookings}
            assignmentPreviews={assignmentPreviews}
          />
          <ServiceSnapshots booking={bookingWithTimeline} />
          <SafetyAndConsent booking={bookingWithTimeline} />
          <Notes booking={bookingWithTimeline} showRestrictedNotes={canManageAllBookings(profile)} />
          <CustomerRequests booking={bookingWithTimeline} />
          {canManageAllBookings(profile) ? <ActivityTimeline booking={bookingWithTimeline} /> : null}
          {canManageAllBookings(profile) ? (
            <EmailDeliveryStatus booking={bookingWithTimeline} />
          ) : null}
        </div>

        <aside className="grid content-start gap-4">
          <SummaryCard
            booking={bookingWithTimeline}
            showFinancials={canManageAllBookings(profile)}
          />
          <ClientCard booking={bookingWithTimeline} />
          <AddressCard booking={bookingWithTimeline} />
        </aside>
      </div>
    </div>
  );
}

function SummaryCard({
  booking,
  showFinancials,
}: {
  booking: BookingRecord;
  showFinancials: boolean;
}) {
  return (
    <Card title="Booking Summary" icon={<CalendarCheck className="size-5" />}>
      <dl className="grid gap-3 text-sm">
        <Row label="Date">{formatDate(booking.booking_date)}</Row>
        <Row label="Time">
          {formatTime(booking.start_time)}-{formatTime(booking.end_time)}
        </Row>
        <Row label="Duration">{booking.total_duration_mins ?? 0} mins</Row>
        <Row label="Total">{formatMoney(booking.total_price)}</Row>
        <Row label="Source">{formatLabel(booking.booking_source)}</Row>
        {showFinancials ? (
          <>
            <Row label="Payment">
              {formatLabel(booking.payment_status)}
              {booking.payment_method ? ` / ${booking.payment_method}` : ""}
            </Row>
            <Row label="Amount due">
              {formatMoney(booking.amount_due ?? booking.total_price)}
            </Row>
            <Row label="Amount paid">{formatMoney(booking.amount_paid)}</Row>
          </>
        ) : null}
        <Row label="Reschedule">{formatLabel(booking.reschedule_status)}</Row>
        {showFinancials ? (
          <Row label="Paid at">
            {booking.paid_at
              ? new Date(booking.paid_at).toLocaleString("en-GB")
              : "Not paid"}
          </Row>
        ) : null}
      </dl>
      {showFinancials && booking.payment_note ? (
        <p className="mt-3 rounded-lg bg-[var(--rahma-cream)] px-3 py-2 text-sm text-[var(--rahma-muted)]">
          {booking.payment_note}
        </p>
      ) : null}
    </Card>
  );
}

function CustomerRequests({ booking }: { booking: BookingRecord }) {
  return (
    <SectionCard title="Customer Requests" icon={<ClipboardList className="size-5" />}>
      <div className="grid gap-4 md:grid-cols-2">
        <NoteBlock
          title="Cancellation"
          value={
            booking.customer_cancelled_at
              ? `Cancelled at ${new Date(
                  booking.customer_cancelled_at
                ).toLocaleString("en-GB")}${
                  booking.customer_cancellation_note
                    ? `\n\n${booking.customer_cancellation_note}`
                    : ""
                }`
              : "No customer cancellation request."
          }
        />
        <NoteBlock
          title="Reschedule request"
          value={
            booking.reschedule_requested_at
              ? `Status: ${formatLabel(booking.reschedule_status)}\nPreferred: ${
                  booking.reschedule_preferred_date ?? "No date"
                } at ${
                  booking.reschedule_preferred_time
                    ? formatTime(booking.reschedule_preferred_time)
                    : "No time"
                }\n\n${booking.reschedule_note ?? "No note."}`
              : "No reschedule request."
          }
        />
      </div>
    </SectionCard>
  );
}

function EmailDeliveryStatus({ booking }: { booking: BookingRecord }) {
  const events = booking.email_delivery_events ?? [];

  return (
    <SectionCard title="Email Delivery" icon={<Mail className="size-5" />}>
      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--rahma-border)] px-4 py-8 text-center text-sm text-[var(--rahma-muted)]">
          No email delivery events recorded.
        </p>
      ) : (
        <div className="grid gap-3">
          {events
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map((event) => (
              <article
                key={event.id}
                className="rounded-xl border border-[var(--rahma-border)] bg-white/70 p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--rahma-charcoal)]">
                      {formatLabel(event.event_type)}
                    </p>
                    <p className="mt-1 text-[var(--rahma-muted)]">
                      {event.recipient_role ?? "recipient"} -{" "}
                      {event.recipient_email ?? "no email"}
                    </p>
                  </div>
                  <StatusBadge value={event.delivery_status} muted />
                </div>
                {event.error_message ? (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-red-700">
                    {event.error_message}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-[var(--rahma-muted)]">
                  {new Date(event.created_at).toLocaleString("en-GB")}
                </p>
              </article>
            ))}
        </div>
      )}
    </SectionCard>
  );
}

function ActivityTimeline({ booking }: { booking: BookingRecord }) {
  const events = booking.audit_logs ?? [];

  return (
    <SectionCard title="Activity Timeline" icon={<ClipboardList className="size-5" />}>
      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--rahma-border)] px-4 py-8 text-center text-sm text-[var(--rahma-muted)]">
          No audit activity recorded for this booking yet.
        </p>
      ) : (
        <ol className="grid gap-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-xl border border-[var(--rahma-border)] bg-white/70 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium text-[var(--rahma-charcoal)]">
                  {formatLabel(event.action_type)}
                </p>
                <time className="text-xs text-[var(--rahma-muted)]">
                  {new Date(event.created_at).toLocaleString("en-GB")}
                </time>
              </div>
              <p className="mt-1 text-sm text-[var(--rahma-muted)]">
                {event.staff_profiles?.name ?? "System"} on{" "}
                {event.target_type ?? "record"}
              </p>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

function ClientCard({ booking }: { booking: BookingRecord }) {
  return (
    <Card title="Booking Contact" icon={<Users className="size-5" />}>
      <div className="grid gap-4 text-sm text-[var(--rahma-muted)]">
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
            Submitted for this booking
          </p>
          <p className="font-medium text-[var(--rahma-charcoal)]">
            {booking.contact_full_name}
          </p>
          <p>{booking.contact_email}</p>
          <p>{booking.contact_phone}</p>
        </div>
        <div className="border-t border-[var(--rahma-border)] pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
            Linked CRM profile
          </p>
        <p className="font-medium text-[var(--rahma-charcoal)]">
          {booking.clients?.full_name ?? "Unknown client"}
        </p>
        <p>{booking.clients?.email ?? "No email"}</p>
        <p>{booking.clients?.phone ?? "No phone"}</p>
        </div>
      </div>
    </Card>
  );
}

function AddressCard({ booking }: { booking: BookingRecord }) {
  return (
    <Card title="Home Visit" icon={<MapPin className="size-5" />}>
      <div className="grid gap-1 text-sm text-[var(--rahma-muted)]">
        <p>{booking.service_address_line1 ?? "No address line"}</p>
        {booking.service_address_line2 ? <p>{booking.service_address_line2}</p> : null}
        <p>{booking.service_city ?? "No city"}</p>
        <p>{booking.service_postcode ?? "No postcode"}</p>
        {booking.access_notes ? (
          <p className="pt-2 text-[var(--rahma-charcoal)]">
            Area/access: {booking.access_notes}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function ParticipantBreakdown({
  booking,
  profile,
  canReassignBookings,
  assignmentPreviews,
}: {
  booking: BookingRecord;
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>;
  canReassignBookings: boolean;
  assignmentPreviews: Record<string, StaffAssignmentPreview[]>;
}) {
  return (
    <SectionCard
      title="Participants & Assignments"
      icon={<UserCheck className="size-5" />}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {booking.booking_participants.map((participant, index) => {
          const assignment = booking.booking_assignments.find(
            (item) => item.participant_id === participant.id
          );
          const items = booking.booking_items.filter(
            (item) => item.booking_participant_id === participant.id
          );
          const canClaim =
            Boolean(assignment) &&
            canClaimAssignments(profile) &&
            assignment?.status === "unassigned" &&
            !assignment.assigned_staff_id &&
            assignment.required_therapist_gender === profile.gender;

          return (
            <article
              key={participant.id}
              className="rounded-xl border border-[var(--rahma-border)] bg-white/70 p-4"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-[var(--rahma-charcoal)]">
                  {participant.display_name || `Person ${index + 1}`}
                </h3>
                {participant.is_main_contact ? (
                  <StatusBadge value="main contact" muted />
                ) : null}
              </div>
              <dl className="grid gap-2 text-sm">
                <Row label="Participant">
                  {formatLabel(participant.participant_gender)}
                </Row>
                <Row label="Required therapist">
                  {formatLabel(participant.required_therapist_gender)}
                </Row>
                <Row label="Assignment">
                  {formatLabel(assignment?.status ?? "unassigned")}
                </Row>
                <Row label="Assigned staff">
                  {assignment?.staff_profiles?.name ?? "Unassigned"}
                </Row>
                <Row label="Consent">
                  {participant.consent_acknowledged ? "Acknowledged" : "Not recorded"}
                </Row>
              </dl>
              {participant.participant_notes || participant.health_notes ? (
                <div className="mt-3 rounded-lg bg-[var(--rahma-cream)] px-3 py-2 text-sm text-[var(--rahma-muted)]">
                  {participant.participant_notes ? (
                    <p>{participant.participant_notes}</p>
                  ) : null}
                  {participant.health_notes ? (
                    <p>{participant.health_notes}</p>
                  ) : null}
                </div>
              ) : null}
              {canClaim && assignment ? (
                <div className="mt-4">
                  <ClaimAssignmentButton assignmentId={assignment.id} />
                </div>
              ) : null}
              {assignment?.assigned_staff_id === profile.id &&
              assignment.status === "assigned" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <BookingActionButton
                    assignmentId={assignment.id}
                    action="assignment_completed"
                  >
                    Complete
                  </BookingActionButton>
                  <BookingActionButton
                    assignmentId={assignment.id}
                    action="assignment_no_show"
                    variant="outline"
                  >
                    No-show
                  </BookingActionButton>
                </div>
              ) : null}
              {canReassignBookings && assignment ? (
                <AssignmentManager
                  assignmentId={assignment.id}
                  assignedStaffId={assignment.assigned_staff_id}
                  candidates={assignmentPreviews[assignment.id] ?? []}
                />
              ) : null}
              <div className="mt-3 border-t border-[var(--rahma-border)] pt-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
                  Service snapshots
                </p>
                <ul className="grid gap-1 text-sm text-[var(--rahma-muted)]">
                  {items.map((item) => (
                    <li key={item.id}>
                      {item.service_name_snapshot} -{" "}
                      {formatMoney(item.service_price_snapshot)}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </SectionCard>
  );
}

function ServiceSnapshots({ booking }: { booking: BookingRecord }) {
  const totalsByService = new Map<string, { count: number; price: number }>();
  for (const item of booking.booking_items) {
    const current = totalsByService.get(item.service_name_snapshot) ?? {
      count: 0,
      price: 0,
    };
    totalsByService.set(item.service_name_snapshot, {
      count: current.count + 1,
      price: current.price + Number(item.service_price_snapshot),
    });
  }

  return (
    <SectionCard title="Service Snapshots" icon={<CreditCard className="size-5" />}>
      <div className="grid gap-3">
        {[...totalsByService.entries()].map(([name, summary]) => (
          <div
            key={name}
            className="flex items-center justify-between gap-4 rounded-xl border border-[var(--rahma-border)] bg-white/70 px-4 py-3"
          >
            <div>
              <p className="font-medium text-[var(--rahma-charcoal)]">{name}</p>
              <p className="text-sm text-[var(--rahma-muted)]">
                {summary.count} snapshot{summary.count === 1 ? "" : "s"}
              </p>
            </div>
            <p className="font-semibold text-[var(--rahma-charcoal)]">
              {formatMoney(summary.price)}
            </p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function SafetyAndConsent({ booking }: { booking: BookingRecord }) {
  return (
    <SectionCard
      title="Safety & Consent"
      icon={<ShieldCheck className="size-5" />}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <NoteBlock
          title="Consent"
          value={booking.consent_acknowledged ? "Consent acknowledged" : "Consent not recorded"}
        />
        <NoteBlock title="Health notes" value={booking.health_notes} />
      </div>
    </SectionCard>
  );
}

function Notes({
  booking,
  showRestrictedNotes,
}: {
  booking: BookingRecord;
  showRestrictedNotes: boolean;
}) {
  return (
    <SectionCard title="Notes" icon={<ClipboardList className="size-5" />}>
      <div className="grid gap-4 md:grid-cols-3">
        <NoteBlock title="Customer notes" value={booking.customer_notes} />
        <NoteBlock
          title="Customer manage notes"
          value={booking.customer_manage_notes}
        />
        {showRestrictedNotes ? (
          <>
            <NoteBlock title="Treatment notes" value={booking.treatment_notes} />
            <NoteBlock title="Admin notes" value={booking.admin_notes} />
          </>
        ) : null}
      </div>
    </SectionCard>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border bg-white p-5"
      style={{
        borderColor: "var(--rahma-border)",
        boxShadow: "var(--shadow-soft-token)",
      }}
    >
      <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-[var(--rahma-charcoal)]">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return <Card title={title} icon={icon}>{children}</Card>;
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[var(--rahma-muted)]">{label}</dt>
      <dd className="text-right font-medium capitalize text-[var(--rahma-charcoal)]">
        {children}
      </dd>
    </div>
  );
}

function NoteBlock({ title, value }: { title: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-[var(--rahma-border)] bg-white/70 p-4">
      <h3 className="mb-2 text-sm font-semibold text-[var(--rahma-charcoal)]">
        {title}
      </h3>
      <p className="whitespace-pre-wrap text-sm text-[var(--rahma-muted)]">
        {value || "No notes."}
      </p>
    </div>
  );
}

function StatusBadge({ value, muted }: { value: string; muted?: boolean }) {
  return (
    <Badge
      variant="secondary"
      className={
        muted
          ? "border-none bg-gray-100 text-gray-600 capitalize"
          : "border-none bg-[var(--rahma-green)]/10 text-[var(--rahma-green)] capitalize"
      }
    >
      {formatLabel(value)}
    </Badge>
  );
}

function InsufficientPermissions() {
  return (
    <AdminAccessDenied
      title="Booking access limited"
      message="You need booking management permission or an assigned booking relationship to access this booking."
      permission="manage_bookings_all, manage_bookings_own, or assigned booking"
    />
  );
}
