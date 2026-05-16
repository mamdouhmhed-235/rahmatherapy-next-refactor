"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminPanel } from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { ConfirmActionModal } from "../components/admin-ui-interactions";
import {
  createAvailabilityOverride,
  deleteAvailabilityOverride,
  type AvailabilityActionState,
} from "./actions";

interface AvailabilityOverride {
  id: string;
  override_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

interface AvailabilityRule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
}

interface AvailabilityOverridesManagerProps {
  overrides: AvailabilityOverride[];
  rules: AvailabilityRule[];
  /** "Last saved by {actor} on {date}" line for the panel description. */
  lastSavedBy?: string | null;
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatDateLong(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AvailabilityOverridesManager({
  overrides,
  rules,
  lastSavedBy,
}: AvailabilityOverridesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AvailabilityActionState>({});
  const dateInputId = useId();
  const startInputId = useId();
  const endInputId = useId();
  const reasonInputId = useId();
  const dateErrorId = `${dateInputId}-error`;
  const timeErrorId = `${startInputId}-error`;
  const formErrorId = `${dateInputId}-form-error`;

  const today = new Date().toISOString().slice(0, 10);
  const sortedOverrides = [...overrides].sort((a, b) =>
    a.override_date.localeCompare(b.override_date)
  );

  function isClosedWeeklyDay(dateIso: string): boolean {
    const date = new Date(`${dateIso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return false;
    const dayOfWeek = date.getDay();
    const rule = rules.find((r) => r.day_of_week === dayOfWeek);
    if (!rule) return true;
    return !rule.is_working_day;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const dateValue = String(formData.get("override_date") ?? "");
    if (dateValue && dateValue < today) {
      setState({
        fieldErrors: { override_date: "Pick a date from today onwards." },
      });
      return;
    }
    if (
      dateValue &&
      sortedOverrides.some((row) => row.override_date === dateValue)
    ) {
      setState({
        fieldErrors: {
          override_date:
            "That date already has an adjustment. Delete the existing one first.",
        },
      });
      return;
    }
    if (dateValue && isClosedWeeklyDay(dateValue)) {
      setState({
        fieldErrors: {
          override_date:
            "That day is closed in the weekly schedule. Open it in Working hours before adding an adjustment.",
        },
      });
      return;
    }

    startTransition(async () => {
      const result = await createAvailabilityOverride({}, formData);

      if (result.error || result.fieldErrors) {
        if (result.error && /duplicate key|unique constraint/i.test(result.error)) {
          setState({
            fieldErrors: {
              override_date:
                "That date already has an adjustment. Delete the existing one first.",
            },
          });
          return;
        }
        setState({
          error:
            result.error && !result.fieldErrors
              ? "Couldn't add the entry. Try again."
              : undefined,
          fieldErrors: result.fieldErrors,
        });
        return;
      }

      setState({});
      form.reset();
      toast.success("Hour adjustment added.");
      router.refresh();
    });
  }

  function handleDelete(overrideId: string) {
    return async () => {
      const result = await deleteAvailabilityOverride(overrideId);

      if (result.error) {
        toast.error("Couldn't remove the entry. Try again.");
        return;
      }

      toast.success("Removed.");
      router.refresh();
    };
  }

  return (
    <AdminPanel
      title="Hour adjustments"
      description="Days when the clinic runs different hours from the weekly schedule."
    >
      {lastSavedBy ? (
        <p className="-mt-2 mb-4 text-xs text-[var(--admin-text-muted)]">
          {lastSavedBy}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-canvas)] p-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1.4fr_auto] lg:items-end"
        aria-busy={isPending || undefined}
      >
        <div className="grid gap-1.5">
          <label
            htmlFor={dateInputId}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            Date
            <span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">
              *
            </span>
          </label>
          <input
            id={dateInputId}
            name="override_date"
            type="date"
            required
            min={today}
            disabled={isPending}
            aria-invalid={state.fieldErrors?.override_date ? "true" : undefined}
            aria-describedby={
              state.fieldErrors?.override_date ? dateErrorId : undefined
            }
            className={cn(
              "flex h-10 w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50",
              state.fieldErrors?.override_date
                ? "border-[oklch(26%_0.14_25)]"
                : "border-[var(--admin-border-form)]"
            )}
          />
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor={startInputId}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            Opens
            <span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">
              *
            </span>
          </label>
          <input
            id={startInputId}
            name="start_time"
            type="time"
            required
            defaultValue="08:00"
            disabled={isPending}
            aria-invalid={state.fieldErrors?.start_time ? "true" : undefined}
            aria-describedby={
              state.fieldErrors?.start_time ? timeErrorId : undefined
            }
            className={cn(
              "flex h-10 w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50",
              state.fieldErrors?.start_time
                ? "border-[oklch(26%_0.14_25)]"
                : "border-[var(--admin-border-form)]"
            )}
          />
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor={endInputId}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            Closes
            <span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">
              *
            </span>
          </label>
          <input
            id={endInputId}
            name="end_time"
            type="time"
            required
            defaultValue="20:00"
            disabled={isPending}
            className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50"
          />
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor={reasonInputId}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            Reason (optional)
          </label>
          <input
            id={reasonInputId}
            name="reason"
            type="text"
            placeholder="e.g. Late start for staff meeting"
            disabled={isPending}
            className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-white outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 sm:h-10 sm:w-auto sm:min-w-[9.5rem]"
        >
          {isPending ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : null}
          Add adjustment
        </button>

        {state.error ? (
          <div
            id={formErrorId}
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="text-sm text-[oklch(26%_0.14_25)] sm:col-span-2 lg:col-span-5"
          >
            {state.error}
          </div>
        ) : null}

        {state.fieldErrors?.override_date ? (
          <div
            id={dateErrorId}
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="text-xs text-[oklch(26%_0.14_25)] sm:col-span-2 lg:col-span-5"
          >
            {state.fieldErrors.override_date}
          </div>
        ) : null}

        {state.fieldErrors?.start_time ? (
          <div
            id={timeErrorId}
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="text-xs text-[oklch(26%_0.14_25)] sm:col-span-2 lg:col-span-5"
          >
            {state.fieldErrors.start_time}
          </div>
        ) : null}
      </form>

      <div className="mt-5">
        {sortedOverrides.length === 0 ? (
          <EmptyState
            icon={Clock3}
            illustrationSrc="/images/admin/empty-states/hour-adjustments.svg"
            title="No hour adjustments"
            message="Add a date when the clinic runs different hours from the weekly schedule."
          />
        ) : (
          <ul className="grid list-none gap-2 pl-0" aria-label="Hour adjustments">
            {sortedOverrides.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3 transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:border-[var(--admin-primary)]/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium text-[var(--admin-heading)]">
                    {formatDateLong(entry.override_date)}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--admin-text-muted)]">
                    <span className="font-mono">
                      {formatTime(entry.start_time)}–{formatTime(entry.end_time)}
                    </span>
                    {entry.reason ? <span> · {entry.reason}</span> : null}
                  </p>
                </div>
                <ConfirmActionModal
                  title="Remove this hour adjustment?"
                  description={`The clinic will use its standard hours on ${formatDateLong(
                    entry.override_date
                  )} again.`}
                  confirmLabel="Remove"
                  cancelLabel="Keep it"
                  destructive
                  onConfirm={handleDelete(entry.id)}
                  trigger={
                    <button
                      type="button"
                      title={`Remove this hour adjustment: ${formatDateLong(entry.override_date)}`}
                      aria-label={`Remove hour adjustment for ${formatDateLong(entry.override_date)}`}
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[oklch(95.5%_0.028_20)] hover:text-[oklch(26%_0.14_25)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminPanel>
  );
}
