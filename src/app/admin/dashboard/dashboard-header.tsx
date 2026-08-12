"use client";

import { useEffect, useState } from "react";
import { safeFormatDateTime } from "@/lib/time/format";

interface DashboardHeaderProps {
  title: string;
  subtitle: string;
  lastChecked: string;
  showReports?: boolean;
  showCalendar?: boolean;
  showSettings?: boolean;
  notificationButton?: React.ReactNode;
  roleLabel?: string | null;
  scopeLabel?: string | null;
  rangeLabel?: string;
  updatedAtIso?: string;
}

export function DashboardHeader({
  title,
  subtitle,
  roleLabel,
  scopeLabel,
  updatedAtIso,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="admin-display text-2xl font-bold leading-tight tracking-tight text-[var(--admin-heading)] sm:text-[1.875rem]">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-5 text-[var(--admin-text-muted)]">
          {subtitle}
        </p>
        {scopeLabel ? (
          <p className="mt-1 text-xs font-medium text-[var(--admin-text-muted)]">
            {scopeLabel}
          </p>
        ) : null}
        {updatedAtIso ? (
          <UpdatedAgo
            absoluteIso={updatedAtIso}
            className="mt-1.5 block text-[11px] uppercase tracking-[0.1em] text-[var(--admin-text-muted)]"
          />
        ) : null}
      </div>

      {roleLabel ? (
        <span
          className="inline-flex h-7 shrink-0 items-center gap-1.5 self-start rounded-full bg-[var(--admin-restricted-bg)] px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-restricted)]"
          aria-label={`Signed in as ${roleLabel}`}
          title="Your role on Rahma Admin"
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--admin-restricted)]" />
          {roleLabel}
        </span>
      ) : null}
    </div>
  );
}

function UpdatedAgo({ absoluteIso, className }: { absoluteIso: string; className?: string }) {
  const [now, setNow] = useState(() => Date.parse(absoluteIso));
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const t = Date.parse(absoluteIso);
  const diffMs = now - t;
  const label = formatRelative(diffMs);

  return (
    <span
      className={className}
      title={safeFormatDateTime(absoluteIso, { timeZone: "Europe/London" })}
    >
      Updated {label}
    </span>
  );
}

function formatRelative(diffMs: number) {
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 30) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return "1 hr ago";
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
