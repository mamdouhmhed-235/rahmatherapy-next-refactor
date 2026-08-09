"use client";

// C-14 Phase B, Step 10 — the per-staff mirror of the global working-hours
// editor. The same `WorkingHoursDayEditor`, the same segments model
// (`rowsToSchedule` / `scheduleToRows`), and the same day-at-a-time save.
//
// The old shape here was a list of one-row-per-day rules with an "Add rule"
// form. That cannot express a break at all: a break is the GAP between two
// bookable rows for the same day, so a day has to be edited as a whole.

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { AdminPanel } from "../../../components/admin-ui";
import { ConfirmActionModal } from "../../../components/admin-ui-interactions";
import { WorkingHoursDayEditor } from "@/app/admin/availability/WorkingHoursDayEditor";
import {
  rowsToSchedule,
  validateSchedule,
  type DaySchedule,
} from "@/lib/booking/working-hours-segments";
import { saveStaffAvailabilityDay } from "../../actions";
import { DAYS_LONG } from "./lib";

interface StaffAvailabilityRule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
}

interface GlobalRuleSeed {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
}

interface StaffAvailabilityRulesFormProps {
  staffId: string;
  initialRules: StaffAvailabilityRule[];
  canEdit: boolean;
  globalModeLocked: boolean;
  globalRulesSeed?: GlobalRuleSeed[];
}

// Rendered Mon → Sun; the day_of_week column convention is 0 = Sunday.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * A day is ALL of its rows, not the first one — each row is a bookable segment
 * and every gap between two of them is a break. Unlike the clinic-wide editor
 * there is no open-by-default: for a staff member on custom hours the slot
 * engine reads "no rows for this day" as closed, so the editor has to show it
 * closed too.
 */
function buildInitialState(
  rules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_working_day: boolean;
  }>
): Record<number, DaySchedule> {
  const next: Record<number, DaySchedule> = {};
  for (const day of WEEK_ORDER) {
    next[day] = rowsToSchedule(rules.filter((rule) => rule.day_of_week === day));
  }
  return next;
}

export function StaffAvailabilityRulesForm({
  staffId,
  initialRules,
  canEdit,
  globalModeLocked,
  globalRulesSeed,
}: StaffAvailabilityRulesFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [days, setDays] = useState<Record<number, DaySchedule>>(() =>
    buildInitialState(initialRules)
  );
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const formErrorId = useId();

  const editable = canEdit && !globalModeLocked;
  const orderedDays = useMemo(
    () => WEEK_ORDER.map((day) => ({ dayOfWeek: day, schedule: days[day] })),
    [days]
  );
  const openDayCount = orderedDays.filter(
    (day) => day.schedule.isWorkingDay
  ).length;
  const allDaysClosed = openDayCount === 0;
  const hasSeed = !!globalRulesSeed && globalRulesSeed.length > 0;

  function updateDay(day: number, schedule: DaySchedule) {
    setDays((prev) => ({ ...prev, [day]: schedule }));
    if (errors[day]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[day];
        return next;
      });
    }
  }

  /**
   * Gate only. Each day's specific problem is already spelled out inline by its
   * own `WorkingHoursDayEditor`, so repeating it here would say the same thing
   * twice; `errors` stays reserved for what the server sends back.
   */
  function validate(): boolean {
    const blocked = orderedDays.some(
      (day) => validateSchedule(day.schedule).errors.length > 0
    );
    if (blocked) {
      setFormError("Fix the highlighted days before saving.");
      return false;
    }
    return true;
  }

  function copyMondayToWeekdays() {
    const monday = days[1];
    if (!monday) return;
    setDays((prev) => {
      const next = { ...prev };
      for (const target of [2, 3, 4, 5, 6]) {
        // The WHOLE schedule, breaks included, and `breaks` re-created so the
        // five days never share a mutable array.
        next[target] = {
          ...monday,
          breaks: monday.breaks.map((entry) => ({ ...entry })),
        };
      }
      return next;
    });
    setErrors({});
    setFormError(null);
    toast.success(
      monday.breaks.length > 0
        ? "Copied Monday hours and breaks to Tue–Sat."
        : "Copied Monday hours to Tue–Sat."
    );
  }

  /** Loads the clinic-wide pattern into the editor; nothing is saved until "Save hours". */
  function startFromGlobal() {
    if (!globalRulesSeed || globalRulesSeed.length === 0) return;
    setDays(buildInitialState(globalRulesSeed));
    setErrors({});
    setFormError(null);
    toast.success("Loaded the clinic-wide hours — review, then save.");
  }

  function performSave() {
    setFormError(null);
    if (!validate()) return;

    startTransition(async () => {
      const results = await Promise.all(
        orderedDays.map(async (day) => ({
          day: day.dayOfWeek,
          result: await saveStaffAvailabilityDay(
            staffId,
            day.dayOfWeek,
            day.schedule
          ),
        }))
      );

      const fieldFails: Record<number, string> = {};
      let topError: string | null = null;
      for (const { day, result } of results) {
        if (result.fieldErrors) {
          fieldFails[day] =
            result.fieldErrors.start_time ??
            result.fieldErrors.day_of_week ??
            "Couldn't save the hours. Try again.";
        } else if (result.error) {
          topError = result.error;
        }
      }

      if (Object.keys(fieldFails).length > 0 || topError) {
        setErrors(fieldFails);
        setFormError(topError ?? "Couldn't save the hours. Try again.");
        toast.error("Couldn't save the hours. Try again.");
        return;
      }

      toast.success("Working hours saved.");
      router.refresh();
    });
  }

  const saveButtonClass =
    "inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-5 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 sm:w-auto sm:min-w-[12.5rem]";

  function buildSaveButton(onClick?: () => void) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        aria-busy={isPending || undefined}
        className={saveButtonClass}
      >
        {isPending ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
        ) : null}
        Save hours
      </button>
    );
  }

  // Locked to the clinic-wide pattern and no custom rows stored: there is
  // nothing of this staff member's own to show, so say so rather than render
  // seven closed days that read as "never works".
  const showEditor = !globalModeLocked || initialRules.length > 0;

  return (
    <AdminPanel
      title="Weekly working hours"
      description="The recurring pattern the booking engine uses every week."
      badge={
        <span className="inline-flex rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2.5 py-0.5 text-xs font-medium text-[var(--admin-text-muted)]">
          {openDayCount} open {openDayCount === 1 ? "day" : "days"}
        </span>
      }
    >
      {globalModeLocked ? (
        <div
          role="note"
          className="mb-4 flex flex-col gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-3 text-sm text-[var(--admin-body)] sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-start gap-2">
            <Info
              className="mt-0.5 size-4 shrink-0 text-[var(--admin-text-muted)]"
              aria-hidden="true"
            />
            <span>
              Clinic-wide hours apply to this staff member. Switch to custom
              hours above to edit their own schedule and breaks.
            </span>
          </span>
        </div>
      ) : null}

      {editable ? (
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          {hasSeed ? (
            <button
              type="button"
              onClick={startFromGlobal}
              disabled={isPending}
              title="Load the clinic-wide working hours into the editor — review and save to apply."
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50 sm:w-auto"
            >
              <Copy className="size-3.5 shrink-0" aria-hidden="true" />
              Start from clinic-wide hours
            </button>
          ) : null}
          <button
            type="button"
            onClick={copyMondayToWeekdays}
            disabled={isPending}
            title="Copy Monday's switch state, times and breaks to Tuesday through Saturday"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50 sm:w-auto"
          >
            <Copy className="size-3.5 shrink-0" aria-hidden="true" />
            Copy Monday to Tue–Sat
          </button>
        </div>
      ) : null}

      {showEditor ? (
        <div
          className="grid divide-y divide-[var(--admin-border)] overflow-hidden rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)]"
          role="list"
        >
          {orderedDays.map((day) => (
            <DayRow
              key={day.dayOfWeek}
              dayOfWeek={day.dayOfWeek}
              schedule={day.schedule}
              error={errors[day.dayOfWeek]}
              disabled={!editable || isPending}
              onToggle={(checked) =>
                updateDay(day.dayOfWeek, {
                  ...day.schedule,
                  isWorkingDay: checked,
                })
              }
              onScheduleChange={(schedule) => updateDay(day.dayOfWeek, schedule)}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-5 text-sm text-[var(--admin-text-muted)]">
          Clinic-wide hours apply. No custom weekly rules are set.
        </p>
      )}

      {formError ? (
        <div
          id={formErrorId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="mt-4 rounded-[var(--admin-radius-control)] border border-[oklch(26%_0.14_25)]/30 bg-[oklch(95.5%_0.028_20)] px-3 py-2 text-sm text-[oklch(26%_0.14_25)]"
        >
          {formError}
        </div>
      ) : null}

      {editable ? (
        <div className="mt-5 flex justify-end">
          {allDaysClosed ? (
            <ConfirmActionModal
              title="Save with every day closed?"
              description="This staff member will have no working days, so the booking engine won't offer them for any new appointment. Existing bookings stay put."
              confirmLabel="Save"
              cancelLabel="Keep editing"
              destructive
              onConfirm={performSave}
              trigger={buildSaveButton()}
            />
          ) : (
            buildSaveButton(performSave)
          )}
        </div>
      ) : null}

      {globalModeLocked ? (
        <div className="mt-4">
          <Link
            href="/admin/availability"
            className="inline-flex h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-primary)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Open clinic-wide hours →
          </Link>
        </div>
      ) : null}
    </AdminPanel>
  );
}

function DayRow({
  dayOfWeek,
  schedule,
  error,
  disabled,
  onToggle,
  onScheduleChange,
}: {
  dayOfWeek: number;
  schedule: DaySchedule;
  error?: string;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
  onScheduleChange: (schedule: DaySchedule) => void;
}) {
  const labelId = useId();
  const errorId = `${labelId}-error`;
  const dayName = DAYS_LONG[dayOfWeek];
  const isWorkingDay = schedule.isWorkingDay;

  return (
    <div
      role="listitem"
      className={cn(
        "grid min-h-[3.5rem] gap-3 px-4 py-3 transition-colors duration-[var(--motion-duration-fast)] ease-gentle sm:grid-cols-[9rem_minmax(0,28rem)_1fr] sm:items-center sm:gap-6",
        isWorkingDay
          ? "bg-[var(--admin-panel)]"
          : "bg-[var(--admin-panel-muted)]"
      )}
    >
      <div className="flex items-center gap-3">
        <Switch
          checked={isWorkingDay}
          disabled={disabled}
          aria-label={`${dayName}, working day`}
          onCheckedChange={onToggle}
        />
        <span
          id={labelId}
          className="text-sm font-medium text-[var(--admin-heading)]"
        >
          {dayName}
        </span>
      </div>

      <div
        // Outer wrapper drives the 160ms collapse via grid-template-rows
        // (animatable in modern browsers; display:none would cancel transitions).
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-[var(--motion-duration-fast)] ease-gentle motion-reduce:transition-none",
          isWorkingDay
            ? "[grid-template-rows:1fr] opacity-100"
            : "pointer-events-none [grid-template-rows:0fr] select-none opacity-0"
        )}
        aria-hidden={!isWorkingDay}
      >
        <div className="min-h-0 overflow-hidden">
          {/* The editor disables every control while the day is closed, which
              also takes them out of the tab order — no tabIndex needed here. */}
          <WorkingHoursDayEditor
            schedule={schedule}
            onChange={onScheduleChange}
            disabled={disabled}
          />
        </div>
      </div>

      {error ? (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-[oklch(26%_0.14_25)] sm:col-span-3"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
