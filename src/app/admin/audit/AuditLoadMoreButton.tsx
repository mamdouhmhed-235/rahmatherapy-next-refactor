"use client";

import { useState } from "react";
import {
  auditLoadMore,
  type AuditCursor,
  type AuditEventRow,
  type AuditFilters,
} from "./actions";
import { AuditEventCard } from "./AuditEventCard";
import type { AuditFilterState } from "./format";

interface AuditLoadMoreButtonProps {
  initialCursor: AuditCursor | null;
  filters: AuditFilters;
  staffNames: Record<string, string>;
  // Existence map is non-blocking — when the BUILD plan lands this is populated
  // upstream; here we accept it as a Record so newly-loaded rows can resolve targetExists.
  targetExistence: Record<string, boolean>;
  currentFilters: AuditFilterState;
}

export function AuditLoadMoreButton({
  initialCursor,
  filters,
  staffNames,
  targetExistence,
  currentFilters,
}: AuditLoadMoreButtonProps) {
  const [cursor, setCursor] = useState<AuditCursor | null>(initialCursor);
  const [rows, setRows] = useState<AuditEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(initialCursor === null);

  const onClick = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const page = await auditLoadMore({ filters, cursor });
      setRows((prev) => [...prev, ...page.rows]);
      setCursor(page.nextCursor);
      if (page.nextCursor === null) setExhausted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {rows.map((event) => {
        const actor = event.actor_staff_id ? staffNames[event.actor_staff_id] ?? "Unknown staff" : "System";
        const targetExists =
          event.target_id && event.target_type
            ? targetExistence[`${event.target_type}:${event.target_id}`] ?? null
            : null;
        return (
          <AuditEventCard
            key={event.id}
            event={event}
            actorName={actor}
            targetExists={targetExists}
            currentFilters={currentFilters}
          />
        );
      })}
      <div className="mt-4 flex justify-center print:hidden">
        {exhausted ? (
          <p className="text-sm text-[var(--admin-text-muted)]">End of audit log.</p>
        ) : (
          <button
            type="button"
            onClick={onClick}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex h-10 w-full max-w-[240px] items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-progress disabled:opacity-70"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </>
  );
}
