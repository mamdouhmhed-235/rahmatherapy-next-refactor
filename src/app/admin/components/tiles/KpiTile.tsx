"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { CountUp } from "./CountUp";
import { DeltaChip } from "./DeltaChip";
import { Sparkline } from "./Sparkline";

export interface KpiTileProps {
  label: string;
  value: number | string;
  delta?: number | null;
  series?: number[];
  tone?: "auto" | "invert";
  href?: string;
  hint?: string;
  formatValue?: (n: number) => string;
  className?: string;
}

const containerBase =
  "block rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-6 transition-shadow";

/**
 * Canonical Band B tile: label · delta chip · marquee numeral · sparkline-or-hint
 * tail. Becomes a `<Link>` when `href` set with hover-lift; otherwise a
 * `<div role="group">` with the same shape.
 */
export function KpiTile({
  label,
  value,
  delta,
  series,
  tone = "auto",
  href,
  hint,
  formatValue,
  className,
}: KpiTileProps) {
  const valueNode =
    typeof value === "number" ? (
      <CountUp value={value} format={formatValue ?? ((n) => String(Math.round(n)))} />
    ) : (
      <span className="tabular-nums">{value}</span>
    );

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
          {label}
        </span>
        <DeltaChip value={delta} tone={tone} />
      </div>
      <div
        className="mt-3 font-[var(--font-admin-display)] leading-none tracking-tight text-[var(--admin-heading)]"
        style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}
      >
        {valueNode}
      </div>
      <div className="mt-3 min-h-[32px]">
        {series && series.length > 0 ? (
          <Sparkline values={series} height={32} />
        ) : hint ? (
          <p className="text-sm text-[var(--admin-text-muted)]">{hint}</p>
        ) : null}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={label}
        className={cn(
          containerBase,
          "hover:-translate-y-px hover:shadow-[var(--admin-shadow-subtle)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2",
          className
        )}
      >
        {body}
      </Link>
    );
  }
  return (
    <div role="group" aria-label={label} className={cn(containerBase, className)}>
      {body}
    </div>
  );
}
