import Link from "next/link";
import {
  CalendarCheck,
  CreditCard,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCustomerManageBooking } from "@/lib/booking/customer-manage";
import { ManageBookingForms } from "./ManageBookingForms";

export const metadata = {
  title: "Manage Booking - Rahma Therapy",
};

interface ManageBookingPageProps {
  searchParams: Promise<{ token?: string }>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeZone: "Europe/London",
  }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function ManageBookingPage({
  searchParams,
}: ManageBookingPageProps) {
  const { token = "" } = await searchParams;
  const booking = token ? await getCustomerManageBooking(token) : null;

  if (!booking) {
    return <InvalidManageLink />;
  }

  const contactLine = [
    booking.settings.contactEmail,
    booking.settings.contactPhone,
  ]
    .filter(Boolean)
    .join(" or ");
  const rescheduleDisabled = !["pending", "confirmed"].includes(booking.status);

  return (
    <main className="min-h-screen bg-[var(--rahma-ivory)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="rounded-2xl border bg-white p-6"
          style={{
            borderColor: "var(--rahma-border)",
            boxShadow: "var(--shadow-soft-token)",
          }}>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--rahma-green)]">
            Rahma Therapy
          </p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
                Manage your booking
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--rahma-muted)]">
                View your appointment summary, add a note, or request a change.
                Reschedule requests are reviewed by the team before any time is
                moved.
              </p>
            </div>
            <Badge
              variant="secondary"
              className="border-none bg-[var(--rahma-green)]/10 text-[var(--rahma-green)] capitalize"
            >
              {formatLabel(booking.status)}
            </Badge>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <div className="grid gap-4">
            <SummaryCard booking={booking} />
            <ParticipantCard booking={booking} />
            <ManageBookingForms
              token={token}
              cancellationAllowed={booking.cancellation.allowed}
              cancellationReason={booking.cancellation.reason}
              rescheduleDisabled={rescheduleDisabled}
            />
          </div>

          <aside className="grid content-start gap-4">
            <SideCard title="Contact">
              <p className="font-medium text-[var(--rahma-charcoal)]">
                {booking.contactFullName}
              </p>
              <p>{booking.contactEmail}</p>
              <p>{booking.contactPhone}</p>
              {contactLine ? (
                <p className="border-t border-[var(--rahma-border)] pt-3">
                  Questions? Contact {contactLine}.
                </p>
              ) : null}
            </SideCard>

            <SideCard title="Payment">
              <p>Payment is taken in person by cash or card.</p>
              <dl className="mt-3 grid gap-2">
                <Row label="Amount due">{formatMoney(booking.amountDue)}</Row>
                <Row label="Amount paid">{formatMoney(booking.amountPaid)}</Row>
                <Row label="Status">{formatLabel(booking.paymentStatus)}</Row>
              </dl>
            </SideCard>

            <SideCard title="Requests">
              <dl className="grid gap-2">
                <Row label="Cancellation cutoff">
                  {new Date(booking.cancellation.cutoffAt).toLocaleString("en-GB")}
                </Row>
                <Row label="Reschedule">
                  {formatLabel(booking.rescheduleStatus)}
                </Row>
              </dl>
              {booking.rescheduleRequestedAt ? (
                <p className="mt-3 rounded-lg bg-[var(--rahma-cream)] px-3 py-2">
                  Requested {booking.reschedulePreferredDate} at{" "}
                  {booking.reschedulePreferredTime
                    ? formatTime(booking.reschedulePreferredTime)
                    : "time not set"}
                </p>
              ) : null}
            </SideCard>
          </aside>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  booking,
}: {
  booking: NonNullable<Awaited<ReturnType<typeof getCustomerManageBooking>>>;
}) {
  return (
    <section className="rounded-2xl border bg-white p-6"
      style={{
        borderColor: "var(--rahma-border)",
        boxShadow: "var(--shadow-soft-token)",
      }}>
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
        <CalendarCheck className="size-5" />
        Appointment summary
      </h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Row label="Date">{formatDate(booking.bookingDate)}</Row>
        <Row label="Time">
          {formatTime(booking.startTime)}-{formatTime(booking.endTime)}
        </Row>
        <Row label="Duration">{booking.durationMins ?? 0} mins</Row>
        <Row label="Total">{formatMoney(booking.totalPrice)}</Row>
        <Row label="Reference">{booking.id}</Row>
        <Row label="Source">{formatLabel(booking.bookingSource)}</Row>
      </dl>
      <div className="mt-5 grid gap-3 rounded-xl bg-[var(--rahma-cream)] p-4 text-sm text-[var(--rahma-muted)]">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          <span>{booking.addressLines.join(", ")}</span>
        </p>
        <p className="flex items-start gap-2">
          <CreditCard className="mt-0.5 size-4 shrink-0" />
          <span>Payment is due in person at the appointment.</span>
        </p>
      </div>
    </section>
  );
}

function ParticipantCard({
  booking,
}: {
  booking: NonNullable<Awaited<ReturnType<typeof getCustomerManageBooking>>>;
}) {
  return (
    <section className="rounded-2xl border bg-white p-6"
      style={{
        borderColor: "var(--rahma-border)",
        boxShadow: "var(--shadow-soft-token)",
      }}>
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
        <Users className="size-5" />
        Participants
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {booking.participants.map((participant) => (
          <article
            key={participant.id}
            className="rounded-xl border border-[var(--rahma-border)] bg-white/70 p-4 text-sm"
          >
            <h3 className="font-semibold text-[var(--rahma-charcoal)]">
              {participant.label}
            </h3>
            <p className="mt-2 text-[var(--rahma-muted)]">
              {formatLabel(participant.participantGender)} client,{" "}
              {formatLabel(participant.requiredTherapistGender)} therapist
              required
            </p>
            <p className="mt-2 text-[var(--rahma-muted)]">
              {participant.services.join(", ") || "No service snapshot"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SideCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 text-sm leading-6 text-[var(--rahma-muted)]"
      style={{
        borderColor: "var(--rahma-border)",
        boxShadow: "var(--shadow-soft-token)",
      }}>
      <h2 className="mb-3 font-display text-base font-semibold text-[var(--rahma-charcoal)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[var(--rahma-muted)]">{label}</dt>
      <dd className="break-words text-right font-medium text-[var(--rahma-charcoal)]">
        {children}
      </dd>
    </div>
  );
}

function InvalidManageLink() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--rahma-ivory)] px-4 py-10">
      <section
        className="max-w-lg rounded-2xl border bg-white p-6 text-center"
        style={{
          borderColor: "var(--rahma-border)",
          boxShadow: "var(--shadow-soft-token)",
        }}
      >
        <ShieldCheck className="mx-auto mb-4 size-10 text-[var(--rahma-muted)]" />
        <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
          Manage link unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--rahma-muted)]">
          This link is invalid or has expired. It cannot show booking details.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-lg bg-[var(--rahma-green)] px-5 py-3 text-sm font-semibold text-white"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}
