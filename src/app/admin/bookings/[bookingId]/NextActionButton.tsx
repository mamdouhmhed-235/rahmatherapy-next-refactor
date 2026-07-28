"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, UserX } from "lucide-react";
import { toast } from "sonner";
import { AdminButton } from "../../components/admin-ui";
import { ConfirmActionModal } from "../../components/admin-ui-interactions";
import { quickUpdateBooking, restoreBooking } from "../actions";
import type { BookingStatus } from "../types";

const STATUS_WORDS: Record<BookingStatus, string> = {
  pending: "pending",
  confirmed: "confirmed",
  completed: "completed",
  cancelled: "cancelled",
  no_show: "no-show",
};

/**
 * S3 — what the admin is undoing. `customerNote` wins when the customer
 * cancelled themselves; otherwise the last cancel audit row supplies who and
 * when. Both null on a legacy cancel nobody recorded.
 */
export interface RestoreContext {
  customerNote: string | null;
  cancelledByName: string | null;
  cancelledAtLabel: string | null;
}

export function NextActionButton({
  bookingId,
  fromStatus,
  targetStatus,
  label,
  context,
}: {
  bookingId: string;
  fromStatus: BookingStatus;
  targetStatus: BookingStatus;
  label: string;
  context: RestoreContext;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function runRestore() {
    setError(null);
    const formData = new FormData();
    formData.set("booking_id", bookingId);
    formData.set("target_status", targetStatus);

    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const result = await restoreBooking(formData);

        if (result.error) {
          setError(result.error);
          toast.error(result.error);
          resolve();
          return;
        }

        // No claim about the client: since Phase H a restore that lands inside a
        // cancellation's undo window sweeps the queued email and suppresses the
        // "you're back on" one, so the client may hear nothing at all.
        toast.success("Booking restored.");
        router.refresh();
        resolve();
      });
    });
  }

  const priorCancellation = context.customerNote ? (
    <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
      Customer&apos;s note: &quot;{context.customerNote}&quot;
    </p>
  ) : context.cancelledAtLabel ? (
    <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
      {context.cancelledByName
        ? `Cancelled by ${context.cancelledByName} on ${context.cancelledAtLabel}.`
        : `Cancelled on ${context.cancelledAtLabel}.`}
    </p>
  ) : null;

  return (
    <ConfirmActionModal
      title="Restore this booking?"
      confirmLabel="Restore booking"
      cancelLabel="Cancel"
      destructive={false}
      onConfirm={runRestore}
      trigger={
        <AdminButton
          variant="outline"
          icon={<RotateCcw className="size-4" aria-hidden="true" />}
          loading={isPending}
          className="min-h-11 w-full sm:min-h-10 sm:w-auto"
        >
          {label}
        </AdminButton>
      }
    >
      <div className="space-y-3">
        {priorCancellation}
        <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--admin-text-muted)]">
          <li>
            Status will change from {STATUS_WORDS[fromStatus]} to{" "}
            {STATUS_WORDS[targetStatus]}.
          </li>
          <li>Assigned staff will be notified.</li>
          <li>Audit log records the restore.</li>
        </ul>
        {error ? (
          <div
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="rounded-[var(--admin-radius-control)] bg-[oklch(95.5%_0.028_20)] px-3 py-2 text-sm text-[oklch(26%_0.14_25)]"
          >
            {error}
          </div>
        ) : null}
      </div>
    </ConfirmActionModal>
  );
}

/**
 * C-04a Phase C (B-117) — the day-of shortcut. The therapist rings in, the
 * client never showed, and the admin should not have to open the full Status &
 * payment form to record it. The server's own date guard is the authority; the
 * strip only offers the button once the booking's day has arrived.
 */
export function MarkNoShowButton({
  bookingId,
  label,
}: {
  bookingId: string;
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function runMarkNoShow() {
    setError(null);
    const formData = new FormData();
    formData.set("booking_id", bookingId);
    formData.set("action", "no_show");

    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const result = await quickUpdateBooking(formData);

        if (result.error) {
          setError(result.error);
          toast.error(result.error);
          resolve();
          return;
        }

        toast.success("Marked as no-show.");
        router.refresh();
        resolve();
      });
    });
  }

  return (
    <ConfirmActionModal
      title="Mark this booking as no-show?"
      confirmLabel="Mark no-show"
      cancelLabel="Cancel"
      destructive={false}
      onConfirm={runMarkNoShow}
      trigger={
        <AdminButton
          variant="outline"
          icon={<UserX className="size-4" aria-hidden="true" />}
          loading={isPending}
          className="min-h-11 w-full sm:min-h-10 sm:w-auto"
        >
          {label}
        </AdminButton>
      }
    >
      <div className="space-y-3">
        <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--admin-text-muted)]">
          <li>Status changes to no-show.</li>
          <li>Recorded for your records and reports.</li>
          <li>Assigned staff are notified.</li>
          <li>The client is not emailed.</li>
        </ul>
        {error ? (
          <div
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="rounded-[var(--admin-radius-control)] bg-[oklch(95.5%_0.028_20)] px-3 py-2 text-sm text-[oklch(26%_0.14_25)]"
          >
            {error}
          </div>
        ) : null}
      </div>
    </ConfirmActionModal>
  );
}
