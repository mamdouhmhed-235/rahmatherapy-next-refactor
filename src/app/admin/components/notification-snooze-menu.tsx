"use client";

/**
 * R4 redesign 2026-05-21 — 5-preset snooze picker. Renders inside the ⋯
 * overflow menu on a notification card. Computes timestamps in the user's
 * local timezone (server-side validation is timezone-agnostic — just
 * "future, ≤365 days out"). Custom presets use a native datetime-local input
 * which gives free date+time UX without pulling in a date-picker dep.
 */

import { useState } from "react";
import { Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SnoozePreset {
  label: string;
  hint: string;
  /** Compute the target ISO string at click time. */
  compute(): string;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return d;
}

function tomorrowAt(hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function nextWeekdayAt(targetDay: number, hour: number): Date {
  // targetDay: 0=Sunday..6=Saturday. Returns next occurrence (never today).
  const d = new Date();
  const todayDay = d.getDay();
  const offset = ((targetDay - todayDay + 7) % 7) || 7;
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const formatHint = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: "short" }) +
  " " +
  d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const SNOOZE_PRESETS: SnoozePreset[] = [
  {
    label: "1 hour",
    hint: "",
    compute: () => new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  },
  {
    label: "End of today",
    hint: "",
    compute: () => endOfToday().toISOString(),
  },
  {
    label: "Tomorrow 8am",
    hint: "",
    compute: () => tomorrowAt(8).toISOString(),
  },
  {
    label: "Next Monday 8am",
    hint: "",
    compute: () => nextWeekdayAt(1, 8).toISOString(),
  },
];

/**
 * Returns `value` formatted as the local-time string the native
 * datetime-local input expects (`YYYY-MM-DDTHH:mm`).
 */
function toLocalInputValue(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    value.getFullYear() +
    "-" +
    pad(value.getMonth() + 1) +
    "-" +
    pad(value.getDate()) +
    "T" +
    pad(value.getHours()) +
    ":" +
    pad(value.getMinutes())
  );
}

export function NotificationSnoozeMenu({
  onPick,
  className,
}: {
  /** Fires with a future ISO timestamp string. */
  onPick(untilIso: string): void;
  className?: string;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState(() =>
    toLocalInputValue(tomorrowAt(9))
  );
  // Native datetime-local has no `min` attribute here — react-hooks/purity
  // disallows the Date.now() call needed to compute a dynamic floor at render
  // time. submitCustom() below enforces "in the future" on click, so the
  // input can show past times but they'll be rejected on submit.

  const submitCustom = () => {
    if (!customValue) return;
    const date = new Date(customValue);
    if (Number.isNaN(date.getTime())) return;
    if (date.getTime() <= Date.now()) return;
    onPick(date.toISOString());
  };

  return (
    <div
      className={cn(
        "flex w-56 flex-col gap-0.5 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-1.5 shadow-[var(--admin-shadow-overlay)]",
        className
      )}
      role="menu"
      aria-label="Snooze until"
    >
      <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">
        Snooze until
      </p>
      {SNOOZE_PRESETS.map((preset) => {
        const hint = formatHint(new Date(preset.compute()));
        return (
          <button
            key={preset.label}
            type="button"
            role="menuitem"
            onClick={() => onPick(preset.compute())}
            className="flex items-center justify-between gap-2 rounded-[var(--admin-radius-control)] px-2.5 py-2 text-left text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
          >
            <span className="flex items-center gap-2">
              <Clock className="size-3.5 text-[var(--admin-text-muted)]" aria-hidden="true" />
              {preset.label}
            </span>
            <span className="text-[11px] font-normal text-[var(--admin-text-muted)]">
              {hint}
            </span>
          </button>
        );
      })}
      <div className="my-1 h-px bg-[var(--admin-border)]/60" aria-hidden="true" />
      {!customOpen ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => setCustomOpen(true)}
          className="flex items-center justify-between gap-2 rounded-[var(--admin-radius-control)] px-2.5 py-2 text-left text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
        >
          <span>Custom…</span>
          <ChevronRight className="size-3.5 text-[var(--admin-text-muted)]" aria-hidden="true" />
        </button>
      ) : (
        <div className="flex flex-col gap-1.5 px-2 py-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">
            Pick a time
          </label>
          <input
            type="datetime-local"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            className="rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-surface-input)] px-2 py-1.5 text-xs text-[var(--admin-body)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
          />
          <button
            type="button"
            onClick={submitCustom}
            className="rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-2 py-1.5 text-xs font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
          >
            Snooze
          </button>
        </div>
      )}
    </div>
  );
}
