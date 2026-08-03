"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  ChevronDown,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminPanel, AdminStatusBadge } from "../../../components/admin-ui";
import { ConfirmActionModal } from "../../../components/admin-ui-interactions";
import {
  addStaffAvailabilityOverride,
  deleteStaffAvailabilityOverride,
  type StaffAvailabilityActionState,
} from "./actions";
import {
  CANCELLED_BORDER,
  CANCELLED_TEXT,
  PENDING_BG_SOFT,
  PENDING_BORDER,
  PENDING_TEXT,
  STAFF_AVAILABILITY_PAST_CAP,
  STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP,
  formatDateFull,
  formatDateLong,
  formatTime,
  resolveStaffAvailabilityBannerState,
} from "./lib";

interface StaffAvailabilityOverride {
  id: string;
  override_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

interface WeeklyRule {
  day_of_week: number;
  is_working_day: boolean;
}

interface StaffAvailabilityOverridesManagerProps {
  staffId: string;
  /** C-16 Step 14 (N4) — `>= today`, defensive-capped only. Query-sorted ascending. */
  upcoming: StaffAvailabilityOverride[];
  /** Fix round (verify-FAIL Check 2, non-blocking) — true count of
   *  `override_date >= today` for this staff. Only differs from
   *  `upcoming.length` once the defensive cap is actually hit. */
  upcomingTotal: number;
  /** `< today`, capped (or view-all capped). Query-sorted newest-first. */
  past: StaffAvailabilityOverride[];
  /** True count of `override_date < today` for this staff — see lib.ts. */
  pastTotal: number;
  pastViewAll: boolean;
  pastAllHref: string;
  pastRecentHref: string;
  weeklyRules: WeeklyRule[];
  /** "Last saved by {actor} on {date}" line. */
  lastSavedBy?: string | null;
}

export function StaffAvailabilityOverridesManager({
  staffId,
  upcoming,
  upcomingTotal,
  past,
  pastTotal,
  pastViewAll,
  pastAllHref,
  pastRecentHref,
  weeklyRules,
  lastSavedBy,
}: StaffAvailabilityOverridesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<StaffAvailabilityActionState>({});
  const [softWarning, setSoftWarning] = useState<{
    formData: FormData;
    formEl: HTMLFormElement;
  } | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const dateInputId = useId();
  const startInputId = useId();
  const endInputId = useId();
  const reasonInputId = useId();
  const dateErrorId = `${dateInputId}-error`;
  const timeErrorId = `${startInputId}-error`;
  const formErrorId = `${dateInputId}-form-error`;

  const today = new Date().toISOString().slice(0, 10);
  // `upcoming` is query-sorted ascending already (`>= today`, defensive-cap
  // only — see lib.ts) and is the ONLY bucket a new entry (min={today} on
  // the date input below) could ever collide with.
  const bannerState = resolveStaffAvailabilityBannerState({
    pastTotal,
    pastShown: past.length,
    viewAll: pastViewAll,
  });

  function isNonWorkingDay(dateIso: string): boolean {
    const date = new Date(`${dateIso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return false;
    const rule = weeklyRules.find((r) => r.day_of_week === date.getDay());
    if (!rule) return true;
    return !rule.is_working_day;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    formRef.current = form;
    const formData = new FormData(form);

    const dateValue = String(formData.get("date") ?? "");
    const startValue = String(formData.get("start_time") ?? "");
    const endValue = String(formData.get("end_time") ?? "");

    if (dateValue && dateValue < today) {
      setState({ fieldErrors: { date: "Pick a date from today onwards." } });
      return;
    }
    if (dateValue && upcoming.some((row) => row.override_date === dateValue)) {
      setState({
        fieldErrors: {
          date: "That date already has an adjustment. Delete the existing one first.",
        },
      });
      return;
    }
    if (startValue && endValue && endValue <= startValue) {
      setState({
        fieldErrors: { start_time: "End time has to be after start time." },
      });
      return;
    }
    if (dateValue && isNonWorkingDay(dateValue) && !softWarning) {
      setState({});
      setSoftWarning({ formData, formEl: form });
      return;
    }

    submit(formData, form);
  }

  function submit(formData: FormData, formEl: HTMLFormElement) {
    startTransition(async () => {
      const result = await addStaffAvailabilityOverride({}, formData);
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
      toast.success(`Override added for ${formatDateLong(dateValue)}.`);
      router.refresh();
    });
  }

  function confirmSoftWarning() {
    if (!softWarning) return;
    const { formData, formEl } = softWarning;
    setSoftWarning(null);
    submit(formData, formEl);
  }

  function cancelSoftWarning() {
    setSoftWarning(null);
  }

  function handleDelete(overrideId: string) {
    return async () => {
      const result = await deleteStaffAvailabilityOverride(staffId, overrideId);
      if (result.error) {
        toast.error(result.error, {
          duration: Infinity,
          action: { label: "Retry", onClick: () => handleDelete(overrideId)() },
        });
        return;
      }
      toast.success("Override removed.");
      router.refresh();
    };
  }

  return (
    <AdminPanel
      title="One-off overrides"
      description="Hours that replace the weekly pattern for a single date. Use this for extended Saturdays or a half-day clinic."
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
        <p className="-mt-2 mb-4 text-xs text-[var(--admin-text-muted)]">{lastSavedBy}</p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        data-redesign-fake="staff-availability-override-actions"
        className="grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-canvas)] p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,2fr)_auto] lg:items-end"
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
              state.fieldErrors?.date ? CANCELLED_BORDER : "border-[var(--admin-border-form)]"
            )}
          />
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor={startInputId}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            Start time
            <span aria-hidden="true" className={cn("ml-0.5", CANCELLED_TEXT)}>*</span>
          </label>
          <input
            id={startInputId}
            name="start_time"
            type="time"
            required
            defaultValue="09:00"
            disabled={isPending}
            aria-invalid={state.fieldErrors?.start_time ? "true" : undefined}
            aria-describedby={state.fieldErrors?.start_time ? timeErrorId : undefined}
            className={cn(
              "flex h-10 w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50",
              state.fieldErrors?.start_time ? CANCELLED_BORDER : "border-[var(--admin-border-form)]"
            )}
          />
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor={endInputId}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            End time
            <span aria-hidden="true" className={cn("ml-0.5", CANCELLED_TEXT)}>*</span>
          </label>
          <input
            id={endInputId}
            name="end_time"
            type="time"
            required
            defaultValue="17:00"
            disabled={isPending}
            className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50"
          />
        </div>

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
            placeholder="e.g. Extended Saturday, half-day clinic"
            disabled={isPending}
            className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 sm:h-10 sm:w-auto sm:min-w-[10rem]"
        >
          {isPending ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : null}
          Add override
        </button>

        {softWarning ? (
          <div
            role="alert"
            aria-live="polite"
            className={cn(
              "flex flex-col gap-2 rounded-[var(--admin-radius-card)] border p-3 text-sm sm:col-span-2 lg:col-span-5",
              PENDING_BORDER,
              PENDING_BG_SOFT,
              PENDING_TEXT
            )}
          >
            <span className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                That day is already a non-working day in the weekly pattern. Save
                anyway, or cancel and update the weekly rule first.
              </span>
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={confirmSoftWarning}
                className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-3 text-xs font-semibold text-[var(--admin-on-primary)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Add override anyway
              </button>
              <button
                type="button"
                onClick={cancelSoftWarning}
                className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3 text-xs font-semibold text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {state.error ? (
          <div
            id={formErrorId}
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className={cn("text-sm sm:col-span-2 lg:col-span-5", CANCELLED_TEXT)}
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
            className={cn("text-xs sm:col-span-2 lg:col-span-5", CANCELLED_TEXT)}
          >
            {state.fieldErrors.date}
          </div>
        ) : null}

        {state.fieldErrors?.start_time ? (
          <div
            id={timeErrorId}
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className={cn("text-xs sm:col-span-2 lg:col-span-5", CANCELLED_TEXT)}
          >
            {state.fieldErrors.start_time}
          </div>
        ) : null}
      </form>

      <div className="mt-5">
        {upcoming.length === 0 ? (
          <EmptyOverridesState />
        ) : (
          <ul className="grid list-none gap-2 pl-0" aria-label="Upcoming overrides">
            {upcoming.map((entry) => (
              <OverrideRow key={entry.id} entry={entry} onDelete={handleDelete(entry.id)} />
            ))}
          </ul>
        )}

        {past.length > 0 ? (
          <details className="group mt-4 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-canvas)] px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-[var(--admin-body)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden">
              <span>Past overrides ({pastViewAll ? past.length : `${past.length} of ${pastTotal}`})</span>
              <ChevronDown
                className="size-4 text-[var(--admin-text-muted)] transition-transform duration-[var(--motion-duration-fast)] ease-gentle group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <ul className="mt-3 grid list-none gap-2 pl-0" aria-label="Past overrides">
              {past.map((entry) => (
                <OverrideRow key={entry.id} entry={entry} onDelete={handleDelete(entry.id)} />
              ))}
            </ul>
            {/* C-16 Step 14 (N4) — cap+view-all banner, same shape and branch
                order as StaffBlockedDatesManager's (cappedOut before hidden). */}
            {bannerState.kind === "cappedOut" ? (
              <p className="mt-3 border-t border-[var(--admin-border)] pt-3 text-xs text-[var(--admin-text-muted)]">
                Showing the first {STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP} of {bannerState.total} past
                overrides. The rest aren&rsquo;t reachable from this list.{" "}
                <Link
                  href={pastRecentHref}
                  className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  Show recent {STAFF_AVAILABILITY_PAST_CAP} only
                </Link>
              </p>
            ) : bannerState.kind === "hidden" ? (
              <p className="mt-3 border-t border-[var(--admin-border)] pt-3 text-xs">
                <Link
                  href={pastAllHref}
                  className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  View all {bannerState.total} past overrides
                </Link>
              </p>
            ) : bannerState.kind === "viewingAll" ? (
              <p className="mt-3 border-t border-[var(--admin-border)] pt-3 text-xs">
                <Link
                  href={pastRecentHref}
                  className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  Show recent {STAFF_AVAILABILITY_PAST_CAP} only
                </Link>
              </p>
            ) : null}
          </details>
        ) : null}
      </div>
    </AdminPanel>
  );
}

function OverrideRow({
  entry,
  onDelete,
}: {
  entry: StaffAvailabilityOverride;
  onDelete: () => Promise<void>;
}) {
  return (
    <li className="flex items-start gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3 transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:border-[var(--admin-primary)]/30">
      <CalendarClock
        className={cn("mt-0.5 size-4 shrink-0", PENDING_TEXT)}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--admin-heading)]">
          <span title={formatDateFull(entry.override_date)}>
            {formatDateLong(entry.override_date)}
          </span>
          <span className="font-mono text-[var(--admin-text-muted)]">
            · {formatTime(entry.start_time)}–{formatTime(entry.end_time)}
          </span>
          <span title="These hours replace the weekly pattern for this date.">
            <AdminStatusBadge value="Override" tone="info" compact />
          </span>
        </p>
        {entry.reason ? (
          <p className="mt-0.5 text-sm text-[var(--admin-text-muted)]">
            {entry.reason}
          </p>
        ) : null}
      </div>
      <ConfirmActionModal
        title="Remove this override?"
        description={`The ${formatDateLong(entry.override_date)} hours will revert to the weekly pattern.`}
        confirmLabel="Remove"
        cancelLabel="Keep it"
        destructive
        onConfirm={onDelete}
        trigger={
          <button
            type="button"
            title={`Remove this override: ${formatDateLong(entry.override_date)}`}
            aria-label={`Remove override for ${formatDateLong(entry.override_date)}`}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[oklch(95.5%_0.028_20)] hover:text-[oklch(26%_0.14_25)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        }
      />
    </li>
  );
}

function EmptyOverridesState() {
  return (
    <div className="grid justify-items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-4 py-8 text-center">
      <span
        aria-hidden="true"
        className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--admin-panel)] text-[var(--admin-text-muted)]"
      >
        <CalendarClock className="size-6" />
      </span>
      <p className="max-w-[45ch] text-sm text-[var(--admin-text-muted)]">
        No overrides scheduled. The weekly pattern applies on every working day.
      </p>
    </div>
  );
}
