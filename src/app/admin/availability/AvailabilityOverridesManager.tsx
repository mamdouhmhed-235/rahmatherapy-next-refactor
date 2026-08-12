"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Clock3, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminPanel } from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { ConfirmActionModal } from "../components/admin-ui-interactions";
import {
  rowsToSchedule,
  validateSchedule,
  type DaySchedule,
} from "@/lib/booking/working-hours-segments";
import { WorkingHoursDayEditor } from "./WorkingHoursDayEditor";
import {
  saveAvailabilityOverride,
  deleteAvailabilityOverride,
  type AvailabilityActionState,
} from "./actions";
import {
  AVAILABILITY_PAST_CAP,
  AVAILABILITY_PAST_VIEW_ALL_CAP,
  resolveAvailabilityBannerState,
} from "./availability-data";

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
  /** C-16 Step 14 (N3) — `>= today`, defensive-capped only. Query-sorted ascending. */
  upcoming: AvailabilityOverride[];
  /** Fix round (verify-FAIL Check 2, non-blocking) — true count of
   *  `override_date >= today`. Only differs from `upcoming.length` once the
   *  defensive cap is actually hit. Counts distinct DATES, not rows. */
  upcomingTotal: number;
  /** True when the fetch was truncated, so `upcomingTotal` is a LOWER BOUND. */
  upcomingTotalIsLowerBound?: boolean;
  /** `< today`, capped (or view-all capped). Query-sorted newest-first. */
  past: AvailabilityOverride[];
  /** Number of distinct past DATES (not rows) — see availability-data.ts. */
  pastTotal: number;
  /** True when the row-fetch ceiling truncated the fetch, so `pastTotal` is a
   *  LOWER BOUND. Renders as "N+" and must never be shown as an exact figure. */
  pastTotalIsLowerBound?: boolean;
  pastViewAll: boolean;
  pastAllHref: string;
  pastRecentHref: string;
  rules: AvailabilityRule[];
  /** "Last saved by {actor} on {date}" line for the panel description. */
  lastSavedBy?: string | null;
}

/**
 * C-14 Phase C Step 14 — one adjusted DATE, as the several segment rows that
 * store it. The gap between two segments is a break; a date with no break is
 * still exactly one row, as it has always been.
 */
interface OverrideDay {
  date: string;
  segments: Array<{ start_time: string; end_time: string }>;
  reason: string | null;
}

function groupByDate(rows: AvailabilityOverride[]): OverrideDay[] {
  const byDate = new Map<string, OverrideDay>();

  for (const row of rows) {
    const day = byDate.get(row.override_date);
    if (day) {
      day.segments.push({ start_time: row.start_time, end_time: row.end_time });
      // Every segment of a date is saved with the same reason; tolerate older
      // rows where only one of them carries it.
      day.reason = day.reason ?? row.reason;
    } else {
      byDate.set(row.override_date, {
        date: row.override_date,
        segments: [{ start_time: row.start_time, end_time: row.end_time }],
        reason: row.reason,
      });
    }
  }

  // Date order comes from the query; segment order does not.
  for (const day of byDate.values()) {
    day.segments.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  return [...byDate.values()];
}

const DEFAULT_OVERRIDE_SCHEDULE: DaySchedule = {
  isWorkingDay: true,
  opens: "08:00",
  closes: "20:00",
  breaks: [],
};

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
  upcoming,
  upcomingTotal,
  upcomingTotalIsLowerBound = false,
  past,
  pastTotal,
  pastTotalIsLowerBound = false,
  pastViewAll,
  pastAllHref,
  pastRecentHref,
  rules,
  lastSavedBy,
}: AvailabilityOverridesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AvailabilityActionState>({});
  const [schedule, setSchedule] = useState<DaySchedule>(DEFAULT_OVERRIDE_SCHEDULE);
  const dateInputId = useId();
  const hoursLabelId = useId();
  const reasonInputId = useId();
  const dateErrorId = `${dateInputId}-error`;
  const timeErrorId = `${dateInputId}-time-error`;
  const formErrorId = `${dateInputId}-form-error`;

  const upcomingDays = useMemo(() => groupByDate(upcoming), [upcoming]);
  const pastDays = useMemo(() => groupByDate(past), [past]);

  const today = new Date().toISOString().slice(0, 10);
  // `upcoming` is query-sorted ascending already (`>= today`, defensive-cap
  // only — see availability-data.ts) and is the ONLY bucket a new entry
  // (min={today} on the date input below) could ever collide with.
  // Item 6 — pastTotal counts DATES, so pastShown must too. Feeding it
  // past.length (rows) would compare rows against dates and mis-fire the
  // "view all" banner the moment any date has more than one segment.
  const bannerState = resolveAvailabilityBannerState({
    pastTotal,
    pastShown: pastDays.length,
    viewAll: pastViewAll,
  });

  /** Renders a total that may be a lower bound as "N+", never a bare "N". */
  const showTotal = (total: number, isLowerBound: boolean) =>
    `${total}${isLowerBound ? "+" : ""}`;

  /**
   * C-14 Phase C — a weekday is now ALL of its rows, so "closed" means none of
   * them is a working row. `.find()` would have read a day's first segment and
   * called the rest of the day whatever that one said.
   */
  function isClosedWeeklyDay(dateIso: string): boolean {
    const date = new Date(`${dateIso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return false;
    const dayOfWeek = date.getDay();
    const dayRules = rules.filter((r) => r.day_of_week === dayOfWeek);
    if (dayRules.length === 0) return true;
    return !dayRules.some((r) => r.is_working_day);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const dateValue = String(formData.get("override_date") ?? "");
    const reasonValue = String(formData.get("reason") ?? "");

    if (dateValue && dateValue < today) {
      setState({
        fieldErrors: { override_date: "Pick a date from today onwards." },
      });
      return;
    }
    if (dateValue && upcomingDays.some((day) => day.date === dateValue)) {
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
    // The editor already spells out each problem inline, so this is a gate
    // rather than a second copy of the message.
    if (validateSchedule(schedule).errors.length > 0) {
      setState({ error: "Fix the highlighted hours before adding the entry." });
      return;
    }

    startTransition(async () => {
      const result = await saveAvailabilityOverride(
        dateValue,
        schedule,
        reasonValue
      );

      if (result.error || result.fieldErrors) {
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
      setSchedule(DEFAULT_OVERRIDE_SCHEDULE);
      toast.success("Hour adjustment added.");
      router.refresh();
    });
  }

  function handleDelete(overrideDate: string) {
    return async () => {
      const result = await deleteAvailabilityOverride(overrideDate);

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
      badge={
        <span className="inline-flex rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2.5 py-0.5 text-xs font-medium text-[var(--admin-text-muted)]">
          {/* Fix round (verify-FAIL Check 2, non-blocking) — silent at 501+
              before this: the badge just showed `upcoming.length` with no
              way to tell a cap had been hit. */}
          {upcomingTotal > upcomingDays.length
            ? `${upcomingDays.length} of ${showTotal(upcomingTotal, upcomingTotalIsLowerBound)} upcoming`
            : `${upcomingDays.length} upcoming`}
          {pastTotal ? ` · ${showTotal(pastTotal, pastTotalIsLowerBound)} past` : ""}
        </span>
      }
    >
      {lastSavedBy ? (
        <p className="-mt-2 mb-4 text-xs text-[var(--admin-text-muted)]">
          {lastSavedBy}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-canvas)] p-4"
        aria-busy={isPending || undefined}
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
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
        </div>

        {/* C-14 Phase C Step 14 — the same Opens / Break(s) / Closes editor the
            weekly schedule uses, so a single date can carry breaks too. */}
        <div
          role="group"
          aria-labelledby={hoursLabelId}
          className="grid gap-2 border-t border-[var(--admin-border)] pt-4"
        >
          <span
            id={hoursLabelId}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            Hours on this date
          </span>
          <WorkingHoursDayEditor
            schedule={schedule}
            onChange={setSchedule}
            disabled={isPending}
          />
        </div>

        <div className="flex flex-wrap justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 sm:h-10 sm:w-auto sm:min-w-[9.5rem]"
          >
            {isPending ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            ) : null}
            Add adjustment
          </button>
        </div>

        {state.error ? (
          <div
            id={formErrorId}
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="text-sm text-[var(--admin-status-cancelled-text)]"
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
            className="text-xs text-[var(--admin-status-cancelled-text)]"
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
            className="text-xs text-[var(--admin-status-cancelled-text)]"
          >
            {state.fieldErrors.start_time}
          </div>
        ) : null}
      </form>

      {/* C-16 Step 14 (N3) — restructure: upcoming/past split, past behind a
          closed-by-default disclosure, matching
          StaffAvailabilityOverridesManager's existing shape for the
          equivalent per-staff table. */}
      <div className="mt-5">
        {upcomingDays.length === 0 ? (
          <EmptyState
            icon={Clock3}
            illustrationSrc="/images/admin/empty-states/hour-adjustments.svg"
            title="No hour adjustments"
            message="Add a date when the clinic runs different hours from the weekly schedule."
          />
        ) : (
          <ul className="grid list-none gap-2 pl-0" aria-label="Hour adjustments">
            {upcomingDays.map((day) => (
              <OverrideRow key={day.date} day={day} onDelete={handleDelete(day.date)} />
            ))}
          </ul>
        )}

        {pastDays.length > 0 ? (
          <details className="group mt-4 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-canvas)] px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-[var(--admin-body)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden">
              <span>Past adjustments ({pastViewAll ? pastDays.length : `${pastDays.length} of ${showTotal(pastTotal, pastTotalIsLowerBound)}`})</span>
              <ChevronDown
                className="size-4 text-[var(--admin-text-muted)] transition-transform duration-[var(--motion-duration-fast)] ease-gentle group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <ul className="mt-3 grid list-none gap-2 pl-0" aria-label="Past adjustments">
              {pastDays.map((day) => (
                <OverrideRow key={day.date} day={day} onDelete={handleDelete(day.date)} />
              ))}
            </ul>
            {/* C-16 Step 14 (N3) — cap+view-all banner, same shape and branch
                order as BlockedDatesManager's (cappedOut before hidden). */}
            {bannerState.kind === "cappedOut" ? (
              <p className="mt-3 border-t border-[var(--admin-border)] pt-3 text-xs text-[var(--admin-text-muted)]">
                Showing the first {AVAILABILITY_PAST_VIEW_ALL_CAP} of {showTotal(bannerState.total, pastTotalIsLowerBound)} past
                adjustments. The rest aren&rsquo;t reachable from this list.{" "}
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
                  View all {showTotal(bannerState.total, pastTotalIsLowerBound)} past adjustments
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

function OverrideRow({
  day,
  onDelete,
}: {
  day: OverrideDay;
  onDelete: () => Promise<void>;
}) {
  // Every bookable stretch on the date; the gaps between them are the breaks.
  const hours = day.segments
    .map((segment) => `${formatTime(segment.start_time)}–${formatTime(segment.end_time)}`)
    .join(" · ");
  const schedule = rowsToSchedule(
    day.segments.map((segment) => ({ ...segment, is_working_day: true }))
  );

  return (
    <li className="flex items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3 transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:border-[var(--admin-primary)]/30">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-medium text-[var(--admin-heading)]">
          {formatDateLong(day.date)}
        </p>
        <p className="mt-0.5 text-sm text-[var(--admin-text-muted)]">
          <span className="font-mono">{hours}</span>
          {day.reason ? <span> · {day.reason}</span> : null}
        </p>
        {schedule.breaks.length > 0 ? (
          <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">
            {schedule.breaks.length === 1 ? "Break" : "Breaks"}:{" "}
            <span className="font-mono">
              {schedule.breaks
                .map((entry) => `${entry.start}–${entry.end}`)
                .join(" · ")}
            </span>
          </p>
        ) : null}
      </div>
      <ConfirmActionModal
        title="Remove this hour adjustment?"
        description={`The clinic will use its standard hours on ${formatDateLong(
          day.date
        )} again.`}
        confirmLabel="Remove"
        cancelLabel="Keep it"
        destructive
        onConfirm={onDelete}
        trigger={
          <button
            type="button"
            title={`Remove this hour adjustment: ${formatDateLong(day.date)}`}
            aria-label={`Remove hour adjustment for ${formatDateLong(day.date)}`}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-status-cancelled-bg)] hover:text-[var(--admin-status-cancelled-text)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        }
      />
    </li>
  );
}
