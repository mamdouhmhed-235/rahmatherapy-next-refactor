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
  saveAvailabilityRule,
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
  ruleId: string;
  dayOfWeek: number;
  isWorkingDay: boolean;
  startTime: string;
  endTime: string;
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

function formatTime(value: string) {
  return value.slice(0, 5);
}

function buildInitialState(initialRules: AvailabilityRule[]): Record<number, DayState> {
  const next: Record<number, DayState> = {};
  for (const day of WEEK_ORDER) {
    const rule = initialRules.find((r) => r.day_of_week === day);
    next[day] = {
      ruleId: rule?.id ?? "",
      dayOfWeek: day,
      isWorkingDay: rule?.is_working_day ?? (day !== 0),
      startTime: rule ? formatTime(rule.start_time) : "09:00",
      endTime: rule ? formatTime(rule.end_time) : "18:00",
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

  function updateDay(day: number, patch: Partial<DayState>) {
    setDays((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...patch },
    }));
    if (errors[day]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[day];
        return next;
      });
    }
  }

  function validate(): boolean {
    const next: Record<number, string> = {};
    for (const day of orderedDays) {
      if (!day.isWorkingDay) continue;
      if (!day.startTime || !day.endTime) {
        next[day.dayOfWeek] = "Set opening and closing times, or toggle the day off.";
        continue;
      }
      if (day.endTime <= day.startTime) {
        next[day.dayOfWeek] = "End time has to be after start time.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function copyMondayToWeekdays() {
    const monday = days[1];
    if (!monday) return;
    setDays((prev) => {
      const next = { ...prev };
      for (const target of [2, 3, 4, 5, 6]) {
        next[target] = {
          ...prev[target],
          isWorkingDay: monday.isWorkingDay,
          startTime: monday.startTime,
          endTime: monday.endTime,
        };
      }
      return next;
    });
    setErrors({});
    setFormError(null);
    toast.success("Copied Monday hours to Tue–Sat.");
  }

  const allDaysClosed = useMemo(
    () => orderedDays.every((d) => !d.isWorkingDay),
    [orderedDays]
  );

  function performSave() {
    setFormError(null);
    if (!validate()) return;

    startTransition(async () => {
      const results = await Promise.all(
        orderedDays.map(async (day) => {
          const fd = new FormData();
          fd.set("rule_id", day.ruleId);
          fd.set("day_of_week", String(day.dayOfWeek));
          fd.set("start_time", day.startTime);
          fd.set("end_time", day.endTime);
          if (day.isWorkingDay) fd.set("is_working_day", "on");
          const result: AvailabilityActionState = await saveAvailabilityRule({}, fd);
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
    "inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-5 text-sm font-semibold text-white outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 sm:w-auto sm:min-w-[12.5rem]";

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
          title="Copy Monday's switch state and times to Tuesday through Saturday"
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
              updateDay(day.dayOfWeek, { isWorkingDay: checked })
            }
            onStartChange={(value) =>
              updateDay(day.dayOfWeek, { startTime: value })
            }
            onEndChange={(value) =>
              updateDay(day.dayOfWeek, { endTime: value })
            }
          />
        ))}
      </div>

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
  onStartChange,
  onEndChange,
}: {
  day: DayState;
  error?: string;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  const startId = useId();
  const endId = useId();
  const labelId = useId();
  const errorId = `${labelId}-error`;
  const dayName = DAY_NAMES[day.dayOfWeek];

  return (
    <div
      role="listitem"
      className={cn(
        "grid min-h-[3.5rem] gap-3 px-4 py-3 transition-colors duration-[var(--motion-duration-fast)] ease-gentle sm:grid-cols-[9rem_minmax(0,28rem)_1fr] sm:items-center sm:gap-6",
        day.isWorkingDay
          ? "bg-[oklch(93.5%_0.038_155)]"
          : "bg-[oklch(94.0%_0.008_280)]"
      )}
    >
      <div className="flex items-center gap-3">
        <Switch
          checked={day.isWorkingDay}
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
        className={cn(
          "grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-3 transition-[opacity,grid-template-rows,height] duration-[var(--motion-duration-fast)] ease-gentle",
          day.isWorkingDay
            ? "opacity-100"
            : "pointer-events-none invisible hidden h-0 select-none opacity-0"
        )}
        aria-hidden={!day.isWorkingDay}
      >
        <div className="grid gap-1">
          <label
            htmlFor={startId}
            className="text-xs font-medium text-[var(--admin-text-muted)]"
          >
            Opens
          </label>
          <input
            id={startId}
            name={`start_time_${day.dayOfWeek}`}
            type="time"
            value={day.startTime}
            onChange={(event) => onStartChange(event.target.value)}
            disabled={disabled || !day.isWorkingDay}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "h-10 w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50",
              error
                ? "border-[oklch(26%_0.14_25)]"
                : "border-[var(--admin-border-form)]"
            )}
          />
        </div>
        <span aria-hidden="true" className="hidden text-sm text-[var(--admin-text-muted)] sm:block">
          –
        </span>
        <div className="grid gap-1">
          <label
            htmlFor={endId}
            className="text-xs font-medium text-[var(--admin-text-muted)]"
          >
            Closes
          </label>
          <input
            id={endId}
            name={`end_time_${day.dayOfWeek}`}
            type="time"
            value={day.endTime}
            onChange={(event) => onEndChange(event.target.value)}
            disabled={disabled || !day.isWorkingDay}
            className={cn(
              "h-10 w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50",
              error
                ? "border-[oklch(26%_0.14_25)]"
                : "border-[var(--admin-border-form)]"
            )}
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
