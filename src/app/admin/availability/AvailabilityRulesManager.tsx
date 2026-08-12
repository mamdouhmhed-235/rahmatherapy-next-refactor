"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { AdminPanel } from "../components/admin-ui";
import { ConfirmActionModal } from "../components/admin-ui-interactions";
import {
  rowsToSchedule,
  validateSchedule,
  type DaySchedule,
} from "@/lib/booking/working-hours-segments";
import { WorkingHoursDayEditor } from "./WorkingHoursDayEditor";
import {
  saveAvailabilityDay,
  type AvailabilityActionState,
} from "./actions";

interface AvailabilityRule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
}

interface AvailabilityRulesManagerProps {
  initialRules: AvailabilityRule[];
  /** "Last saved by {actor} on {date}" line for the panel description. */
  lastSavedBy?: string | null;
}

type DayState = {
  dayOfWeek: number;
  schedule: DaySchedule;
};

// Brief renders the week as Mon → Sun. day_of_week column convention is 0 = Sunday.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const DAY_NAMES: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

/**
 * C-14 Phase A Step 8 — a day is now ALL of its rows, not the first one. Each
 * row is a bookable segment and every gap between two of them is a break, so
 * `.find()` would have silently shown only the morning of a day with a lunch
 * break — and then written that back on the next save.
 */
function buildInitialState(initialRules: AvailabilityRule[]): Record<number, DayState> {
  const next: Record<number, DayState> = {};
  for (const day of WEEK_ORDER) {
    const rows = initialRules.filter((rule) => rule.day_of_week === day);
    const schedule = rowsToSchedule(rows);
    next[day] = {
      dayOfWeek: day,
      // No stored rows at all: keep the previous default of open everywhere but
      // Sunday, on the helper's default 09:00–18:00.
      schedule: rows.length > 0 ? schedule : { ...schedule, isWorkingDay: day !== 0 },
    };
  }
  return next;
}

export function AvailabilityRulesManager({
  initialRules,
  lastSavedBy,
}: AvailabilityRulesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [days, setDays] = useState<Record<number, DayState>>(() =>
    buildInitialState(initialRules)
  );
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const formErrorId = useId();

  const orderedDays = useMemo(
    () => WEEK_ORDER.map((day) => days[day]),
    [days]
  );

  function updateDay(day: number, schedule: DaySchedule) {
    setDays((prev) => ({
      ...prev,
      [day]: { ...prev[day], schedule },
    }));
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
        next[target] = {
          ...prev[target],
          // The WHOLE schedule, breaks included — copying opens/closes alone
          // would quietly drop Monday's breaks from every day it claims to
          // have copied. `breaks` is re-created so the six days never share a
          // mutable array.
          schedule: {
            ...monday.schedule,
            breaks: monday.schedule.breaks.map((entry) => ({ ...entry })),
          },
        };
      }
      return next;
    });
    setErrors({});
    setFormError(null);
    toast.success(
      monday.schedule.breaks.length > 0
        ? "Copied Monday hours and breaks to Tue–Sat."
        : "Copied Monday hours to Tue–Sat."
    );
  }

  const allDaysClosed = useMemo(
    () => orderedDays.every((d) => !d.schedule.isWorkingDay),
    [orderedDays]
  );

  function performSave() {
    setFormError(null);
    if (!validate()) return;

    startTransition(async () => {
      const results = await Promise.all(
        orderedDays.map(async (day) => {
          const result: AvailabilityActionState = await saveAvailabilityDay(
            day.dayOfWeek,
            day.schedule
          );
          return { day: day.dayOfWeek, result };
        })
      );

      const fieldFails: Record<number, string> = {};
      let topError: string | null = null;
      for (const { day, result } of results) {
        if (result.fieldErrors) {
          const message =
            result.fieldErrors.start_time ??
            result.fieldErrors.end_time ??
            result.fieldErrors.day_of_week ??
            "Couldn't save the hours. Try again.";
          fieldFails[day] = message;
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

  return (
    <AdminPanel
      title="Working hours"
      description="Recurring weekly schedule for the clinic. Closed dates and hour adjustments override these defaults."
    >
      {lastSavedBy ? (
        <p className="-mt-2 mb-4 text-xs text-[var(--admin-text-muted)]">
          {lastSavedBy}
        </p>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
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

      <div
        className="grid divide-y divide-[var(--admin-border)] overflow-hidden rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)]"
        role="list"
      >
        {orderedDays.map((day) => (
          <DayRow
            key={day.dayOfWeek}
            day={day}
            error={errors[day.dayOfWeek]}
            disabled={isPending}
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

      {formError ? (
        <div
          id={formErrorId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="mt-4 rounded-[var(--admin-radius-control)] border border-[oklch(26%_0.14_25)]/30 bg-[var(--admin-status-cancelled-bg)] px-3 py-2 text-sm text-[var(--admin-status-cancelled-text)]"
        >
          {formError}
        </div>
      ) : null}

      <div className="mt-5 flex justify-end">
        {allDaysClosed ? (
          <ConfirmActionModal
            title="Save with the clinic closed every day?"
            description="The clinic will appear closed every day of the week. Existing bookings stay put, but customers won't be able to book new visits until at least one day is reopened."
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
    </AdminPanel>
  );
}

function DayRow({
  day,
  error,
  disabled,
  onToggle,
  onScheduleChange,
}: {
  day: DayState;
  error?: string;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
  onScheduleChange: (schedule: DaySchedule) => void;
}) {
  const labelId = useId();
  const errorId = `${labelId}-error`;
  const dayName = DAY_NAMES[day.dayOfWeek];
  const isWorkingDay = day.schedule.isWorkingDay;

  return (
    <div
      role="listitem"
      className={cn(
        "grid min-h-[3.5rem] gap-3 px-4 py-3 transition-colors duration-[var(--motion-duration-fast)] ease-gentle sm:grid-cols-[9rem_minmax(0,28rem)_1fr] sm:items-center sm:gap-6",
        isWorkingDay
          ? "bg-[var(--admin-status-confirmed-bg)]"
          : "bg-[var(--admin-status-restricted-bg)]"
      )}
    >
      <div className="flex items-center gap-3">
        <Switch
          checked={isWorkingDay}
          disabled={disabled}
          aria-label={`${dayName}, open`}
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
            schedule={day.schedule}
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
          className="text-xs text-[var(--admin-status-cancelled-text)] sm:col-span-3"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
