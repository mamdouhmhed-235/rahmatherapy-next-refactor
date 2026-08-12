"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminButton } from "../../../components/admin-ui";
import { setSeriesTravelFee } from "../../recurring-actions";

/**
 * Item 8 Phase 4 — the standing travel charge for a series.
 *
 * A NEW control rather than an extension of the disabled "Edit series" button:
 * that button's own copy scopes it to cadence, address and therapist, and price
 * is a different concern with a different safety story.
 *
 * Follows SeriesActions's idiom exactly — build FormData by hand, call the
 * server action inside a transition (no `useActionState`), toast the result,
 * then `router.refresh()` so the server-rendered page picks up the new totals.
 */
export function SeriesTravelChargeForm({
  templateId,
  currentFee,
  disabled = false,
}: {
  templateId: string;
  currentFee: number;
  /** Cancelled series cannot be repriced; the action refuses too. */
  disabled?: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState(String(currentFee));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setFieldError(null);
    const formData = new FormData();
    formData.set("template_id", templateId);
    formData.set("travel_fee", value);

    startTransition(async () => {
      const result = await setSeriesTravelFee(null, formData);

      if (result.fieldErrors?.travel_fee) {
        setFieldError(result.fieldErrors.travel_fee);
        return;
      }
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't update the travel charge.");
        return;
      }

      // Both counts are reported, because "skipped" is not a failure — a
      // fully-paid visit is deliberately left alone, and an admin who is not
      // told that will assume the change did not work.
      const updated = result.updated ?? 0;
      const skipped = result.skipped ?? 0;
      toast.success(
        skipped > 0
          ? `Travel charge saved. ${updated} upcoming ${updated === 1 ? "visit" : "visits"} updated, ${skipped} already paid and left unchanged.`
          : `Travel charge saved. ${updated} upcoming ${updated === 1 ? "visit" : "visits"} updated.`
      );
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-[var(--admin-heading)]"
      >
        Travel charge per visit
      </label>
      <div className="flex flex-wrap items-start gap-2">
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-[var(--admin-text-muted)]"
          >
            £
          </span>
          <input
            id={inputId}
            name="travel_fee"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={disabled || isPending}
            aria-invalid={fieldError ? "true" : undefined}
            className="h-10 w-36 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] py-2 pl-7 pr-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <AdminButton
          type="button"
          onClick={save}
          disabled={disabled || isPending}
        >
          {isPending ? "Saving…" : "Save travel charge"}
        </AdminButton>
      </div>
      {fieldError ? (
        <p role="alert" className="text-xs text-[oklch(26%_0.14_25)]">
          {fieldError}
        </p>
      ) : (
        <p className="text-xs text-[var(--admin-text-muted)]">
          Applied to every upcoming visit in this series, and to occurrences the
          nightly job creates later. Visits already paid in full are left alone,
          and past visits are never changed.
        </p>
      )}
    </div>
  );
}
