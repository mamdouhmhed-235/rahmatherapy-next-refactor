"use client";

import { cn } from "@/lib/utils";
import { DeltaChip } from "./DeltaChip";
import { Sparkline } from "./Sparkline";

export interface MetricRowProps {
  label: string;
  value: string | number;
  delta?: number | null;
  series?: number[];
  tone?: "auto" | "invert";
  className?: string;
}

/**
 * Compact single-row stat for the Personal Contribution stripe (B-5) and
 * any other narrow-row layouts. No panel chrome — consumers wrap in their
 * own container.
 */
export function MetricRow({
  label,
  value,
  delta,
  series,
  tone = "auto",
  className,
}: MetricRowProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="flex-1 truncate text-sm text-[var(--admin-text-muted)]">
        {label}
      </span>
      <span className="tabular-nums text-base font-medium text-[var(--admin-text)]">
        {value}
      </span>
      <DeltaChip value={delta} tone={tone} />
      {series && series.length > 0 ? (
        <Sparkline values={series} height={18} className="w-12" />
      ) : null}
    </div>
  );
}
