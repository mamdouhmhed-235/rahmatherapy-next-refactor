"use client";

import { cn } from "@/lib/utils";
import { severityForDelta } from "../charts/theme";

export interface DeltaChipProps {
  value?: number | null;
  tone?: "auto" | "invert";
  periodLabel?: string;
  className?: string;
}

const TONE_CLASS = {
  positive:
    "bg-[var(--admin-success-bg)] text-[var(--admin-success)]",
  negative:
    "bg-[var(--admin-danger-bg)] text-[var(--admin-danger)]",
  neutral:
    "bg-[var(--admin-panel-muted)] text-[var(--admin-text-muted)]",
} as const;

/**
 * Period-over-period delta chip. Renders nothing when value is nullish or
 * NaN — saves the consumer a guard.
 */
export function DeltaChip({ value, tone = "auto", periodLabel, className }: DeltaChipProps) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const severity = severityForDelta(value, tone);
  const isZero = value === 0;
  const sign = isZero ? "" : value > 0 ? "+" : "";
  const formatted = `${sign}${value.toFixed(1)}%`;
  const arrow = isZero ? "→" : value > 0 ? "↑" : "↓";
  const srWord = isZero ? "unchanged" : value > 0 ? "up" : "down";
  const title = periodLabel ? `${formatted} vs prior ${periodLabel}` : undefined;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        TONE_CLASS[severity],
        className
      )}
      title={title}
    >
      <span aria-hidden="true">{arrow}</span>
      <span>{formatted}</span>
      <span className="sr-only">{srWord}</span>
    </span>
  );
}
