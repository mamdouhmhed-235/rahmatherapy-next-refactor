"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarX, ChevronDown, Loader2, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminPanel } from "../../../components/admin-ui";
import { ConfirmActionModal } from "../../../components/admin-ui-interactions";
import {
  addStaffBlockedDate,
  deleteStaffBlockedDate,
  type StaffAvailabilityActionState,
} from "./actions";
import {
  CANCELLED_BORDER,
  CANCELLED_TEXT,
  formatDateFull,
  formatDateLong,
} from "./lib";

interface StaffBlockedDate {
  id: string;
  blocked_date: string;
  reason: string | null;
}

interface StaffBlockedDatesManagerProps {
  staffId: string;
  blockedDates: StaffBlockedDate[];
  /** ISO date → count of non-cancelled bookings on that date (booking guard). */
  bookingsByDate?: Record<string, number>;
  /** "Last saved by {actor} on {date}" line for the panel sub-line. */
  lastSavedBy?: string | null;
}

export function StaffBlockedDatesManager({
  staffId,
  blockedDates,
  bookingsByDate,
  lastSavedBy,
}: StaffBlockedDatesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<StaffAvailabilityActionState>({});
  const [pendingBookings, setPendingBookings] = useState<{
    date: string;
    count: number;
    formData: FormData;
    formEl: HTMLFormElement;
  } | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const dateInputId = useId();
  const reasonInputId = useId();
  const allDayInputId = useId();
  const dateErrorId = `${dateInputId}-error`;
  const formErrorId = `${dateInputId}-form-error`;

  const today = new Date().toISOString().slice(0, 10);

  const { upcoming, past } = useMemo(() => {
    const sorted = [...blockedDates].sort((a, b) =>
      a.blocked_date.localeCompare(b.blocked_date)
    );
    return {
      upcoming: sorted.filter((row) => row.blocked_date >= today),
      past: sorted.filter((row) => row.blocked_date < today).reverse(),
    };
  }, [blockedDates, today]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    formRef.current = form;
    const formData = new FormData(form);
    const dateValue = String(formData.get("date") ?? "");

    if (dateValue && dateValue < today) {
      setState({ fieldErrors: { date: "Pick a date from today onwards." } });
      return;
    }
    if (
      dateValue &&
      blockedDates.some((row) => row.blocked_date === dateValue)
    ) {
      setState({
        fieldErrors: {
          date: "That date is already closed. Edit or delete the existing entry.",
        },
      });
      return;
    }

    // Booking guard — warn if there are existing bookings on the chosen date.
    const bookingCount = bookingsByDate?.[dateValue] ?? 0;
    if (dateValue && bookingCount > 0) {
      setState({});
      setPendingBookings({ date: dateValue, count: bookingCount, formData, formEl: form });
      return;
    }

    submit(formData, form);
  }

  function submit(formData: FormData, formEl: HTMLFormElement) {
    startTransition(async () => {
      const result = await addStaffBlockedDate({}, formData);
      if (result.error || result.fieldErrors) {
        setState({ error: result.error, fieldErrors: result.fieldErrors });
        toast.error(result.error ?? "Couldn't save. Try again.", {
          duration: Infinity,
          action: {
            label: "Retry",
            onClick: () => {
              if (formRef.current) submit(new FormData(formRef.current), formRef.current);
              else submit(formData, formEl);
            },
          },
        });
        return;
      }
      setState({});
      const dateValue = String(formData.get("date") ?? "");
      formEl.reset();
      toast.success(`Closure added for ${formatDateLong(dateValue)}.`);
      router.refresh();
    });
  }

  function confirmBookingGuard() {
    if (!pendingBookings) return;
    const { formData, formEl } = pendingBookings;
    setPendingBookings(null);
    submit(formData, formEl);
  }

  function handleDelete(blockedDateId: string) {
    return async () => {
      const result = await deleteStaffBlockedDate(staffId, blockedDateId);
      if (result.error) {
        toast.error(result.error, {
          duration: Infinity,
          action: { label: "Retry", onClick: () => handleDelete(blockedDateId)() },
        });
        return;
      }
      toast.success("Closure removed.");
      router.refresh();
    };
  }

  return (
    <AdminPanel
      title="Blocked dates"
      description="Days this staff member isn't available. Closures override the weekly pattern."
      badge={
        <span className="inline-flex rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2.5 py-0.5 text-xs font-medium text-[var(--admin-text-muted)]">
          {upcoming.length} upcoming{past.length ? ` · ${past.length} past` : ""}
        </span>
      }
    >
      {lastSavedBy ? (
        <p className="-mt-2 mb-4 text-xs text-[var(--admin-text-muted)]">{lastSavedBy}</p>
      ) : null}

      <BookingGuardModal
        open={pendingBookings !== null}
        bookingCount={pendingBookings?.count ?? 0}
        dateLabel={pendingBookings ? formatDateLong(pendingBookings.date) : ""}
        onConfirm={confirmBookingGuard}
        onCancel={() => setPendingBookings(null)}
      />

      <form
        onSubmit={handleSubmit}
        data-redesign-fake="staff-blocked-dates-actions"
        className="grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-canvas)] p-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,2fr)_auto] sm:items-end"
        aria-busy={isPending || undefined}
      >
        <input type="hidden" name="staff_id" value={staffId} />

        <div className="grid gap-1.5">
          <label
            htmlFor={dateInputId}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            Date
            <span aria-hidden="true" className={cn("ml-0.5", CANCELLED_TEXT)}>*</span>
          </label>
          <input
            id={dateInputId}
            name="date"
            type="date"
            required
            min={today}
            disabled={isPending}
            aria-invalid={state.fieldErrors?.date ? "true" : undefined}
            aria-describedby={state.fieldErrors?.date ? dateErrorId : undefined}
            className={cn(
              "flex h-10 w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50",
              state.fieldErrors?.date
                ? CANCELLED_BORDER
                : "border-[var(--admin-border-form)]"
            )}
          />
        </div>

        <label
          htmlFor={allDayInputId}
          className="flex items-center gap-2 self-end pb-2.5 text-sm text-[var(--admin-body)]"
          title="Block the entire day. Partial-day closures use overrides."
        >
          <input
            id={allDayInputId}
            type="checkbox"
            name="all_day"
            defaultChecked
            disabled={isPending}
            className="size-4 rounded border-[var(--admin-border-form)] text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          />
          <span>All day</span>
        </label>

        <div className="grid gap-1.5">
          <label
            htmlFor={reasonInputId}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            Reason
            <span className="ml-1 text-xs font-normal text-[var(--admin-text-muted)]">
              (optional)
            </span>
          </label>
          <input
            id={reasonInputId}
            name="reason"
            type="text"
            placeholder="e.g. Eid, family wedding, sick leave"
            disabled={isPending}
            className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 sm:h-10 sm:w-auto sm:min-w-[9rem]"
        >
          {isPending ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : null}
          Add closure
        </button>

        {state.error ? (
          <div
            id={formErrorId}
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className={cn("text-sm sm:col-span-4", CANCELLED_TEXT)}
          >
            {state.error}
          </div>
        ) : null}

        {state.fieldErrors?.date ? (
          <div
            id={dateErrorId}
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className={cn("text-xs sm:col-span-4", CANCELLED_TEXT)}
          >
            {state.fieldErrors.date}
          </div>
        ) : null}
      </form>

      <div className="mt-5">
        {upcoming.length === 0 ? (
          <EmptyClosuresState />
        ) : (
          <ul className="grid list-none gap-2 pl-0" aria-label="Upcoming closures">
            {upcoming.map((entry) => (
              <ClosureRow key={entry.id} entry={entry} onDelete={handleDelete(entry.id)} />
            ))}
          </ul>
        )}

        {past.length > 0 ? (
          <details className="group mt-4 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-canvas)] px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-[var(--admin-body)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden">
              <span>Past closures ({past.length})</span>
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
  entry: StaffBlockedDate;
  onDelete: () => Promise<void>;
}) {
  return (
    <li className="flex items-start gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3 transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:border-[var(--admin-primary)]/30">
      <XCircle
        className={cn("mt-0.5 size-4 shrink-0", CANCELLED_TEXT)}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-medium text-[var(--admin-heading)]"
          title={formatDateFull(entry.blocked_date)}
        >
          {formatDateLong(entry.blocked_date)}{" "}
          <span className="text-[var(--admin-text-muted)]">· All day</span>
        </p>
        {entry.reason ? (
          <p className="mt-0.5 text-sm text-[var(--admin-text-muted)]">
            {entry.reason}
          </p>
        ) : null}
      </div>
      <ConfirmActionModal
        title="Remove this closure?"
        description={`The ${formatDateLong(entry.blocked_date)} block will be deleted. The booking engine will treat the day as available again from the next sync.`}
        confirmLabel="Remove"
        cancelLabel="Keep it"
        destructive
        onConfirm={onDelete}
        trigger={
          <button
            type="button"
            title={`Remove this closure: ${formatDateLong(entry.blocked_date)}`}
            aria-label={`Remove closure for ${formatDateLong(entry.blocked_date)}`}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[oklch(95.5%_0.028_20)] hover:text-[oklch(26%_0.14_25)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        }
      />
    </li>
  );
}

function EmptyClosuresState() {
  return (
    <div className="grid justify-items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-4 py-8 text-center">
      <span
        aria-hidden="true"
        className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--admin-panel)] text-[var(--admin-text-muted)]"
      >
        <CalendarX className="size-6" />
      </span>
      <p className="max-w-[45ch] text-sm text-[var(--admin-text-muted)]">
        No closures set. The booking engine will offer every working-pattern slot
        for this staff member.
      </p>
    </div>
  );
}

function BookingGuardModal({
  open,
  bookingCount,
  dateLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  bookingCount: number;
  dateLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(12%_0.01_165)]/35 backdrop-blur-sm px-4">
      <div
        role="alertdialog"
        aria-labelledby="booking-guard-title"
        aria-describedby="booking-guard-body"
        className="w-full max-w-[26rem] rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5 shadow-[var(--admin-shadow-overlay)]"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[oklch(95.5%_0.028_20)]">
            <XCircle
              className={cn("size-5", CANCELLED_TEXT)}
              aria-hidden="true"
            />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="booking-guard-title"
              className="text-base font-semibold text-[var(--admin-heading)]"
            >
              Block this date even though bookings exist?
            </h2>
            <p
              id="booking-guard-body"
              className="mt-1.5 text-sm leading-6 text-[var(--admin-text-muted)]"
            >
              {bookingCount} booking{bookingCount === 1 ? "" : "s"} on {dateLabel}{" "}
              will stay scheduled, but customers will see this staff member as
              unavailable. Move or cancel those bookings first if that&apos;s not
              what you intend.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap-reverse justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Review bookings first
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius-control)] bg-[oklch(40%_0.14_25)] px-4 text-sm font-semibold text-white outline-none transition-colors hover:bg-[oklch(33%_0.14_25)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Block anyway
          </button>
        </div>
      </div>
    </div>
  );
}
