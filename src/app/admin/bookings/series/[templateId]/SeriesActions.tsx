"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AdminButton } from "../../../components/admin-ui";
import { ConfirmActionModal } from "../../../components/admin-ui-interactions";
import { cancelRecurringSeries } from "../../recurring-actions";

/**
 * C-02 Phase F (plan Step 17, brief §4.3) — Edit + Cancel buttons for the
 * series view.
 *
 * Cancel lifts the C-04a Restore pattern verbatim (see
 * `[bookingId]/NextActionButton.tsx`'s `NextActionButton`): build FormData by
 * hand, call the server action directly inside a transition (no
 * `useActionState` — the action's own `_previousState` param exists only so
 * it can double as a `useActionState` reducer elsewhere, not because this
 * call site needs one), toast the result, then `router.refresh()` so the
 * server-rendered page picks up the now-cancelled state.
 *
 * FormData field names match `cancelRecurringSeries`'s own reads exactly
 * (`src/app/admin/bookings/recurring-actions.ts`): `template_id` (required)
 * and `reason` (optional, free text — the action does not validate or cap its
 * length, so neither does this form).
 */

export function SeriesActions({
  templateId,
  futureOccurrenceCount,
  alreadyCancelled,
}: {
  templateId: string;
  futureOccurrenceCount: number;
  alreadyCancelled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reasonId = useId();

  function runCancel() {
    setError(null);
    const formData = new FormData();
    formData.set("template_id", templateId);
    if (reason.trim()) formData.set("reason", reason.trim());

    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const result = await cancelRecurringSeries(null, formData);

        if (!result.ok) {
          const message = result.error ?? "Unable to cancel the series.";
          setError(message);
          toast.error(message);
          resolve();
          return;
        }

        toast.success(
          result.cancelledOccurrenceCount
            ? `Series cancelled. ${result.cancelledOccurrenceCount} upcoming visit${
                result.cancelledOccurrenceCount === 1 ? "" : "s"
              } cancelled.`
            : "Series cancelled."
        );
        setReason("");
        router.refresh();
        resolve();
      });
    });
  }

  if (alreadyCancelled) {
    return (
      <p className="text-sm text-[var(--admin-text-muted)]">
        This series is cancelled. Create a new series to resume repeat visits.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <AdminButton
          type="button"
          variant="outline"
          icon={<Pencil className="size-4" aria-hidden="true" />}
          disabled
          className="min-h-11 w-full sm:min-h-10 sm:w-auto"
        >
          Edit series
        </AdminButton>

        <ConfirmActionModal
          title="Cancel entire recurring series?"
          confirmLabel="Cancel entire series"
          cancelLabel="Keep the series"
          destructive
          onConfirm={runCancel}
          trigger={
            <AdminButton
              variant="outline"
              icon={<XCircle className="size-4" aria-hidden="true" />}
              loading={isPending}
              className="min-h-11 w-full sm:min-h-10 sm:w-auto"
            >
              Cancel entire series
            </AdminButton>
          }
        >
          <div className="space-y-3">
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--admin-text-muted)]">
              <li>
                {futureOccurrenceCount} future occurrence
                {futureOccurrenceCount === 1 ? "" : "s"} will be cancelled.
              </li>
              <li>Past occurrences are preserved (audit + tax records).</li>
              {/*
                C-02 Phase Fb — this line is true. Phase F shipped it while the
                cascade still sent nothing (plan Step 7 was a bare bulk UPDATE),
                which made it a false promise; the Owner chose to send the email
                rather than reword the copy, so cancelRecurringSeries now calls
                sendRecurringSeriesCancelledEmail. See progress §B6.4.
              */}
              <li>The client will be emailed about the series cancellation.</li>
              <li>You can re-create a new series anytime.</li>
            </ul>
            <div className="grid gap-1.5">
              <label
                htmlFor={reasonId}
                className="text-sm font-medium text-[var(--admin-heading)]"
              >
                Reason (optional, shown in audit log)
              </label>
              <textarea
                id={reasonId}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={isPending}
                rows={3}
                className="w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm leading-6 text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-60"
              />
            </div>
            {error ? (
              <div
                role="alert"
                aria-live="polite"
                aria-atomic="true"
                className="rounded-[var(--admin-radius-control)] bg-[var(--admin-status-cancelled-bg)] px-3 py-2 text-sm text-[var(--admin-status-cancelled-text)]"
              >
                {error}
              </div>
            ) : null}
          </div>
        </ConfirmActionModal>
      </div>
      <p className="text-xs text-[var(--admin-text-muted)]">
        Editing isn&rsquo;t available yet for repeat visits. Cancel this
        series and create a new one if cadence, address, or therapist need to
        change.
      </p>
    </div>
  );
}
