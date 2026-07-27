"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AdminButton } from "../../components/admin-ui";
import { ConfirmActionModal } from "../../components/admin-ui-interactions";
import { restoreBooking } from "../actions";
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

        toast.success("Booking restored. The client has been notified.");
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
          <li>The client will be emailed to say the booking is back on.</li>
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
