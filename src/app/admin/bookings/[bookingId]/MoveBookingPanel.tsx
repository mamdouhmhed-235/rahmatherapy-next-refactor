"use client";

// ─── D-051 — move a booking to a new date and time ──────────────────────────
//
// ⛔ Owner ruling 2026-08-23. Until this panel existed, nothing in the product
// could change a booking's date: "Accept request" recorded an answer and moved
// nothing, and the panel beside this one told the operator to *"move the
// booking to a new date / time separately"* — with nowhere to do it.
//
// ⚠️ Client component + `useTransition` + a DIRECT call to the server action,
// mirroring `RescheduleResponseButtons`. A raw `<form action={serverAction}>`
// in a Server Component hits a Turbopack regression here where the
// `$ACTION_ID_*` hidden input renders with no value, so the form POSTs and no
// action ever dispatches.

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminButton, AdminInput, AdminPanel } from "../../components/admin-ui";
import { rescheduleBooking } from "../actions";

export function MoveBookingPanel({
  bookingId,
  currentDate,
  currentTime,
  /** The customer's requested date, when one is outstanding. */
  requestedDate,
  requestedTime,
}: {
  bookingId: string;
  currentDate: string;
  currentTime: string;
  requestedDate?: string | null;
  requestedTime?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const overrideId = useId();

  // ⛔ Pre-filled with what the CUSTOMER asked for when there is a request
  // outstanding, so answering one is two clicks rather than re-typing a date
  // from the panel above. Falls back to where the booking already is.
  const [date, setDate] = useState(requestedDate || currentDate);
  const [time, setTime] = useState((requestedTime || currentTime || "").slice(0, 5));
  const [override, setOverride] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const move = () => {
    setFieldErrors({});
    const formData = new FormData();
    formData.set("booking_id", bookingId);
    formData.set("booking_date", date);
    formData.set("start_time", time);
    if (override) formData.set("override_availability", "on");

    startTransition(async () => {
      try {
        const result = await rescheduleBooking(formData);

        // ⛔ G-08-02's lesson, applied from the start: check the RESULT before
        // claiming success. An action that refuses and a UI that says "moved"
        // is how a booking silently stays where it was while the operator tells
        // the customer otherwise.
        if (result?.fieldErrors) {
          setFieldErrors(result.fieldErrors as unknown as Record<string, string>);
          // ⚠️ Surfaced as a toast as well as inline: the field error sits below
          // a control the operator may have already scrolled past.
          toast.error(String(Object.values(result.fieldErrors)[0] ?? "Check the date and time."), {
            duration: Number.POSITIVE_INFINITY,
          });
          return;
        }
        if (result?.error) {
          toast.error(result.error, { duration: Number.POSITIVE_INFINITY });
          router.refresh();
          return;
        }

        // ⛔ Only claim the email when one actually went. A phone-only booking
        // has nobody to write to, and telling the operator otherwise means a
        // customer turns up at the old time.
        toast.success(
          result?.emailed
            ? "Appointment moved. The client has been emailed the new time."
            : "Appointment moved. ⚠️ The client was NOT emailed — let them know yourself."
        );
        router.refresh();
      } catch {
        // Reachable only for a transport-level failure, which no result object
        // can describe.
        toast.error("Couldn't move the booking. Try again.", {
          duration: Number.POSITIVE_INFINITY,
        });
      }
    });
  };

  const unchanged = date === currentDate && time === (currentTime || "").slice(0, 5);

  return (
    <AdminPanel title="Move appointment">
      <p className="text-sm text-[var(--admin-text-muted)]">
        Changes when this visit happens. Everything else — the service, the
        people, the price and the therapist — stays as it is.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <AdminInput
          label="New date"
          type="date"
          name="booking_date"
          value={date}
          error={fieldErrors.booking_date}
          onChange={(event) => setDate(event.target.value)}
        />
        <AdminInput
          label="New start time"
          type="time"
          name="start_time"
          value={time}
          error={fieldErrors.start_time}
          onChange={(event) => setTime(event.target.value)}
        />
      </div>

      {requestedDate ? (
        <p className="mt-3 text-xs text-[var(--admin-text-muted)]">
          Pre-filled with the time the client asked for. Moving the booking also
          closes their request.
        </p>
      ) : null}

      <label
        htmlFor={overrideId}
        className="mt-4 flex items-start gap-2 text-sm text-[var(--admin-body)]"
      >
        <input
          id={overrideId}
          type="checkbox"
          checked={override}
          onChange={(event) => setOverride(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          Move it even if nobody looks free then
          <span className="block text-xs text-[var(--admin-text-muted)]">
            Use when you have arranged cover yourself. Without this, a time the
            clinic cannot staff is refused.
          </span>
        </span>
      </label>

      <div className="mt-4">
        <AdminButton
          type="button"
          variant="primary"
          size="sm"
          loading={isPending}
          disabled={isPending || unchanged || !date || !time}
          onClick={move}
        >
          Move appointment
        </AdminButton>
      </div>

      <p className="mt-3 text-xs text-[var(--admin-text-muted)]">
        The client is emailed the new date and time, if we hold an address for
        them. The move is recorded in the audit trail.
      </p>
    </AdminPanel>
  );
}
