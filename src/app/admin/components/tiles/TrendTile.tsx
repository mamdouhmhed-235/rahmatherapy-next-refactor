"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { DeltaChip } from "./DeltaChip";

export interface TrendTileProps {
  label: string;
  chart: React.ReactNode;
  delta?: number | null;
  actionLabel?: string;
  actionHref?: string;
  minHeight?: number;
  className?: string;
}

/**
 * Chart-headlined tile. Header carries label + optional delta chip + optional
 * Ghost action link. Body is whatever chart primitive the consumer passes.
 * `minHeight` defaults to align with KpiTile in 2×N grids (~280px including
 * 240 chart + 24 padding × 2).
 */
export function TrendTile({
  label,
  chart,
  delta,
  actionLabel,
  actionHref,
  minHeight = 280,
  className,
}: TrendTileProps) {
  return (
    <section
      className={cn(
        "rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-6",
        className
      )}
      style={{ minHeight }}
    >
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-[var(--admin-text)]">{label}</h3>
          <DeltaChip value={delta} />
        </div>
        {actionLabel && actionHref ? (
          <Link
            href={actionHref}
            className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
          >
            {actionLabel}
          </Link>
        ) : null}
      </header>
      <div>{chart}</div>
    </section>
  );
}
