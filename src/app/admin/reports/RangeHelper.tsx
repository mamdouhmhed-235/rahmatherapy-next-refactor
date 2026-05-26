"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";

interface RangeHelperProps {
  initialRange: string;
  initialFrom: string;
  initialTo: string;
}

interface RangeWindow {
  from: string;
  to: string;
}

function startOfWeekISO(today: Date): Date {
  // Monday-anchored week.
  const day = today.getUTCDay();
  const diff = (day + 6) % 7;
  const monday = new Date(today.getTime());
  monday.setUTCDate(today.getUTCDate() - diff);
  return monday;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function computeWindow(range: string, fallback: RangeWindow): RangeWindow {
  if (range === "custom") return fallback;
  const today = new Date();
  if (range === "lifetime") {
    // Lifetime has no helper window — we'll signal via empty.
    return { from: "", to: "" };
  }
  if (range === "year") {
    const year = today.getUTCFullYear();
    return {
      from: `${year}-01-01`,
      to: `${year}-12-31`,
    };
  }
  if (range === "month") {
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth() + 1;
    const monthStr = month.toString().padStart(2, "0");
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      from: `${year}-${monthStr}-01`,
      to: `${year}-${monthStr}-${lastDay.toString().padStart(2, "0")}`,
    };
  }
  if (range === "week") {
    const monday = startOfWeekISO(today);
    const sunday = new Date(monday.getTime());
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return { from: isoDate(monday), to: isoDate(sunday) };
  }
  return fallback;
}

function formatRangeLabel(range: string, window: RangeWindow): string {
  if (range === "custom" || range === "lifetime") return "";
  const fromDate = new Date(`${window.from}T00:00:00Z`);
  const toDate = new Date(`${window.to}T00:00:00Z`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return "";
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
  const prefix =
    range === "year" ? "This year" : range === "month" ? "This month" : "This week";
  return `${prefix}: ${fmt(fromDate)} to ${fmt(toDate)}`;
}

export function RangeHelper({ initialRange, initialFrom, initialTo }: RangeHelperProps) {
  const [range, setRange] = useState(initialRange);

  useEffect(() => {
    const select = document.querySelector<HTMLSelectElement>(
      'select[name="range"][data-reports-range="true"]'
    );
    if (!select) return;
    const handler = () => setRange(select.value);
    select.addEventListener("change", handler);
    return () => select.removeEventListener("change", handler);
  }, []);

  const window = useMemo(
    () => computeWindow(range, { from: initialFrom, to: initialTo }),
    [range, initialFrom, initialTo]
  );

  const label = useMemo(() => formatRangeLabel(range, window), [range, window]);

  if (range === "custom") {
    return (
      <p
        className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--admin-text-muted)]"
        role="status"
        aria-live="polite"
      >
        <CalendarRange className="size-3" aria-hidden="true" />
        Enter both dates below to apply.
      </p>
    );
  }

  if (range === "lifetime") {
    return (
      <p
        className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--admin-text-muted)]"
        role="status"
        aria-live="polite"
      >
        <CalendarRange className="size-3" aria-hidden="true" />
        Everything since the clinic started.
      </p>
    );
  }

  return (
    <p
      className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--admin-text-muted)]"
      role="status"
      aria-live="polite"
    >
      <CalendarRange className="size-3" aria-hidden="true" />
      {label}
    </p>
  );
}
