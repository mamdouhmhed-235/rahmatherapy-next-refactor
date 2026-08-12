"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { CalendarX, ChevronDown, Loader2, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminPanel } from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { ConfirmActionModal } from "../components/admin-ui-interactions";
import {
  createBlockedDate,
  deleteBlockedDate,
  type AvailabilityActionState,
} from "./actions";
import {
  AVAILABILITY_PAST_CAP,
  AVAILABILITY_PAST_VIEW_ALL_CAP,
  resolveAvailabilityBannerState,
} from "./availability-data";

interface BlockedDate {
  id: string;
  blocked_date: string;
  reason: string | null;
}

interface BlockedDatesManagerProps {
  /** C-16 Step 14 (N3) — `>= today`, defensive-capped only. Query-sorted ascending. */
  upcoming: BlockedDate[];
  /** Fix round (verify-FAIL Check 2, non-blocking) — true count of
   *  `blocked_date >= today`. Only differs from `upcoming.length` once the
   *  defensive cap is actually hit. */
  upcomingTotal: number;
  /** `< today`, capped (or view-all capped). Query-sorted newest-first. */
  past: BlockedDate[];
  /** True count of `blocked_date < today` — see availability-data.ts. */
  pastTotal: number;
  pastViewAll: boolean;
  pastAllHref: string;
  pastRecentHref: string;
  /** "Last saved by {actor} on {date}" line for the panel description. */
  lastSavedBy?: string | null;
  /** ISO date → count of non-cancelled bookings on that date. Triggers a guard
   *  confirm when the user tries to block a date that already has bookings. */
  bookingsByDate?: Record<string, number>;
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

export function BlockedDatesManager({
  upcoming,
  upcomingTotal,
  past,
  pastTotal,
  pastViewAll,
  pastAllHref,
  pastRecentHref,
  lastSavedBy,
  bookingsByDate,
}: BlockedDatesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AvailabilityActionState>({});
  const [pendingMismatch, setPendingMismatch] = useState<{
    date: string;
    bookingCount: number;
    formData: FormData;
    formEl: HTMLFormElement;
  } | null>(null);
  const dateInputId = useId();
  const reasonInputId = useId();
  const dateErrorId = `${dateInputId}-error`;
  const formErrorId = `${dateInputId}-form-error`;

  const today = new Date().toISOString().slice(0, 10);
  // `upcoming` is query-sorted ascending already (`>= today`, defensive-cap
  // only — see availability-data.ts) and is the ONLY bucket a new entry
  // (min={today} on the date input below) could ever collide with.
  const bannerState = resolveAvailabilityBannerState({
    pastTotal,
    pastShown: past.length,
    viewAll: pastViewAll,
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const dateValue = String(formData.get("blocked_date") ?? "");
    if (dateValue && dateValue < today) {
      setState({
        fieldErrors: { blocked_date: "Pick a date from today onwards." },
      });
      return;
    }
    if (dateValue && upcoming.some((row) => row.blocked_date === dateValue)) {
      setState({
        fieldErrors: {
          blocked_date:
            "That date is already closed. Edit or delete the existing entry.",
        },
      });
      return;
    }

    // Booking-mismatch guard: if the chosen date already has bookings, pause
    // and ask the operator to confirm before blocking the day.
    const bookingsOnDate = bookingsByDate?.[dateValue] ?? 0;
    if (dateValue && bookingsOnDate > 0) {
      setState({});
      setPendingMismatch({
        date: dateValue,
        bookingCount: bookingsOnDate,
        formData,
        formEl: form,
      });
      return;
    }

    submitBlockedDate(formData, form);
  }

  function submitBlockedDate(formData: FormData, formEl: HTMLFormElement) {
    startTransition(async () => {
      const result = await createBlockedDate({}, formData);

      if (result.error || result.fieldErrors) {
        // Map known Postgres unique-constraint message to brief friendly copy.
        if (result.error && /duplicate key|unique constraint/i.test(result.error)) {
          setState({
            fieldErrors: {
              blocked_date:
                "That date is already closed. Edit or delete the existing entry.",
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
      formEl.reset();
      toast.success("Closed date added.");
      router.refresh();
    });
  }

  function confirmBookingMismatch() {
    if (!pendingMismatch) return;
    const { formData, formEl } = pendingMismatch;
    setPendingMismatch(null);
    submitBlockedDate(formData, formEl);
  }

  function cancelBookingMismatch() {
    setPendingMismatch(null);
  }

  function handleDelete(blockedDateId: string) {
    return async () => {
      const result = await deleteBlockedDate(blockedDateId);

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
      title="Closed dates"
      description="Days when the whole clinic is unavailable. These take precedence over the weekly schedule."
      badge={
        <span className="inline-flex rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2.5 py-0.5 text-xs font-medium text-[var(--admin-text-muted)]">
          {/* Fix round (verify-FAIL Check 2, non-blocking) — silent at 501+
              before this: the badge just showed `upcoming.length` with no
              way to tell a cap had been hit. */}
          {upcomingTotal > upcoming.length
            ? `${upcoming.length} of ${upcomingTotal} upcoming`
            : `${upcoming.length} upcoming`}
          {pastTotal ? ` · ${pastTotal} past` : ""}
        </span>
      }
    >
      {lastSavedBy ? (
        <p className="-mt-2 mb-4 text-xs text-[var(--admin-text-muted)]">
          {lastSavedBy}
        </p>
      ) : null}

      {/* Controlled mismatch confirm: opens when the user tries to block a
          date that already has bookings. Self-contained so we don't have to
          extend the shared ConfirmActionModal API. */}
      <BaseDialog.Root
        open={pendingMismatch !== null}
        onOpenChange={(next) => {
          if (!next) setPendingMismatch(null);
        }}
      >
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-[var(--admin-scrim)]/35 backdrop-blur-sm" />
          <BaseDialog.Popup className="fixed left-1/2 top-[30vh] z-50 w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5 shadow-[var(--admin-shadow-overlay)] outline-none">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-status-cancelled-bg)]">
                <XCircle
                  className="size-5 text-[var(--admin-status-cancelled-text)]"
                  aria-hidden="true"
                />
              </span>
              <div className="min-w-0 flex-1">
                <BaseDialog.Title className="text-base font-semibold text-[var(--admin-heading)]">
                  Block this date even though bookings exist?
                </BaseDialog.Title>
                <BaseDialog.Description className="mt-1.5 text-sm leading-6 text-[var(--admin-text-muted)]">
                  {pendingMismatch
                    ? `${pendingMismatch.bookingCount} booking${pendingMismatch.bookingCount === 1 ? "" : "s"} on ${formatDateLong(pendingMismatch.date)} will stay scheduled, but customers will see the clinic as closed. Move or cancel the existing bookings first if that's not what you intend.`
                    : ""}
                </BaseDialog.Description>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap-reverse justify-end gap-2">
              <button
                type="button"
                onClick={cancelBookingMismatch}
                className="inline-flex min-h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Review bookings first
              </button>
              <button
                type="button"
                onClick={confirmBookingMismatch}
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-danger-solid)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-danger-solid-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Block anyway
              </button>
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-canvas)] p-4 sm:grid-cols-[1fr_minmax(0,2fr)_auto] sm:items-end"
        aria-busy={isPending || undefined}
      >
        <div className="grid gap-1.5">
          <label
            htmlFor={dateInputId}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            Date
            <span aria-hidden="true" className="ml-0.5 text-[var(--admin-status-cancelled-text)]">
              *
            </span>
          </label>
          <input
            id={dateInputId}
            name="blocked_date"
            type="date"
            required
            min={today}
            disabled={isPending}
            aria-invalid={state.fieldErrors?.blocked_date ? "true" : undefined}
            aria-describedby={
              state.fieldErrors?.blocked_date ? dateErrorId : undefined
            }
            className={cn(
              "flex h-10 w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50",
              state.fieldErrors?.blocked_date
                ? "border-[var(--admin-status-cancelled-text)]"
                : "border-[var(--admin-border-form)]"
            )}
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
            placeholder="e.g. Eid al-Fitr, staff training day"
            disabled={isPending}
            className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 sm:h-10 sm:w-auto sm:min-w-[9.5rem]"
        >
          {isPending ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : null}
          Add closed date
        </button>

        {state.error ? (
          <div
            id={formErrorId}
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="text-sm text-[var(--admin-status-cancelled-text)] sm:col-span-3"
          >
            {state.error}
          </div>
        ) : null}

        {state.fieldErrors?.blocked_date ? (
          <div
            id={dateErrorId}
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="text-xs text-[var(--admin-status-cancelled-text)] sm:col-span-3"
          >
            {state.fieldErrors.blocked_date}
          </div>
        ) : null}
      </form>

      {/* C-16 Step 14 (N3) — restructure: upcoming/past split, past behind a
          closed-by-default disclosure, matching StaffBlockedDatesManager's
          existing shape for the equivalent per-staff table. */}
      <div className="mt-5">
        {upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarX}
            illustrationSrc="/images/admin/empty-states/closed-dates.svg"
            title="No closed dates"
            message="Add a date when the whole clinic is unavailable."
          />
        ) : (
          <ul className="grid list-none gap-2 pl-0" aria-label="Closed dates">
            {upcoming.map((entry) => (
              <ClosureRow key={entry.id} entry={entry} onDelete={handleDelete(entry.id)} />
            ))}
          </ul>
        )}

        {past.length > 0 ? (
          <details className="group mt-4 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-canvas)] px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-[var(--admin-body)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden">
              <span>Past closures ({pastViewAll ? past.length : `${past.length} of ${pastTotal}`})</span>
              <ChevronDown
                className="size-4 text-[var(--admin-text-muted)] transition-transform duration-[var(--motion-duration-fast)] ease-gentle group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <ul className="mt-3 grid list-none gap-2 pl-0" aria-label="Past closures">
              {past.map((entry) => (
                <ClosureRow key={entry.id} entry={entry} onDelete={handleDelete(entry.id)} />
              ))}
            </ul>
            {/* C-16 Step 14 (N3) — cap+view-all banner. `cappedOut` (already
                viewing all AND the true total still exceeds the view-all cap)
                is checked before `hidden` inside `resolveAvailabilityBannerState` —
                the exact bug shape that shipped twice before this plan. */}
            {bannerState.kind === "cappedOut" ? (
              <p className="mt-3 border-t border-[var(--admin-border)] pt-3 text-xs text-[var(--admin-text-muted)]">
                Showing the first {AVAILABILITY_PAST_VIEW_ALL_CAP} of {bannerState.total} past
                closures. The rest aren&rsquo;t reachable from this list.{" "}
                <Link
                  href={pastRecentHref}
                  className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  Show recent {AVAILABILITY_PAST_CAP} only
                </Link>
              </p>
            ) : bannerState.kind === "hidden" ? (
              <p className="mt-3 border-t border-[var(--admin-border)] pt-3 text-xs">
                <Link
                  href={pastAllHref}
                  className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  View all {bannerState.total} past closures
                </Link>
              </p>
            ) : bannerState.kind === "viewingAll" ? (
              <p className="mt-3 border-t border-[var(--admin-border)] pt-3 text-xs">
                <Link
                  href={pastRecentHref}
                  className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  Show recent {AVAILABILITY_PAST_CAP} only
                </Link>
              </p>
            ) : null}
          </details>
        ) : null}
      </div>
    </AdminPanel>
  );
}

function ClosureRow({
  entry,
  onDelete,
}: {
  entry: BlockedDate;
  onDelete: () => Promise<void>;
}) {
  return (
    <li className="flex items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3 transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:border-[var(--admin-primary)]/30">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-medium text-[var(--admin-heading)]">
          {formatDateLong(entry.blocked_date)}
        </p>
        {entry.reason ? (
          <p className="mt-0.5 text-sm text-[var(--admin-text-muted)]">
            {entry.reason}
          </p>
        ) : null}
      </div>
      <ConfirmActionModal
        title="Remove this closed date?"
        description={`The clinic will show as available on ${formatDateLong(
          entry.blocked_date
        )}. Existing bookings on that day stay put.`}
        confirmLabel="Remove"
        cancelLabel="Keep it"
        destructive
        onConfirm={onDelete}
        trigger={
          <button
            type="button"
            title={`Remove this closed date: ${formatDateLong(entry.blocked_date)}`}
            aria-label={`Remove closed date ${formatDateLong(entry.blocked_date)}`}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-status-cancelled-bg)] hover:text-[var(--admin-status-cancelled-text)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        }
      />
    </li>
  );
}

