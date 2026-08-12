"use client";

// B-3 follow-up — inline From/To date inputs that appear beneath the period
// chip row when the active range is "custom". Mirrors the dashboard's
// dashboard-filters-client.tsx pattern (line 294 handleCustomSubmit). Pure
// client component; validates from <= to; submits via router.push so the
// URL update flows through React's transition (no full page reload).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface CustomDateRangeFormProps {
  basePath: string;
  initialFrom: string;
  initialTo: string;
}

export function CustomDateRangeForm({
  basePath,
  initialFrom,
  initialTo,
}: CustomDateRangeFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!from || !to) {
      setError("Pick both a start and an end date.");
      return;
    }
    if (from > to) {
      setError("End date must be on or after start date.");
      return;
    }
    setError(null);
    const params = new URLSearchParams({ range: "custom", from, to });
    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-wrap items-end gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-canvas)] p-3"
      aria-label="Custom date range"
    >
      <label className="flex flex-col gap-1 text-xs text-[var(--admin-text-muted)]">
        From
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.currentTarget.value)}
          max={to || undefined}
          className="h-9 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2 text-sm text-[var(--admin-body)] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[var(--admin-text-muted)]">
        To
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.currentTarget.value)}
          min={from || undefined}
          className="h-9 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2 text-sm text-[var(--admin-body)] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-medium text-[var(--admin-on-primary)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {pending ? "Applying…" : "Apply"}
      </button>
      {error ? (
        <p role="alert" className="basis-full text-xs text-[var(--admin-status-cancelled-text)]">
          {error}
        </p>
      ) : null}
    </form>
  );
}
