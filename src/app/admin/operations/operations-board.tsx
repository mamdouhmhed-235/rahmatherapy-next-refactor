"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Eye, Inbox, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminStatusBadge } from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { ConfirmActionModal } from "../components/admin-ui-interactions";
import { EventRow, type OperationalEventRow } from "./event-row";
import { updateOperationalEventStatus } from "./actions";

interface OperationsBoardProps {
  events: OperationalEventRow[];
  /** Whether the active filter strip currently has any non-default value applied. */
  filtersActive: boolean;
  /**
   * True when the server pager (C-16 Phase D Step 11) has more than one
   * page for the current filters — i.e. `events` is a WINDOW, not the whole
   * result set. Softens a column's empty-state copy: "nothing open" reads as
   * a global claim, but on a multi-page board it may just mean this status's
   * events landed on a different page (see the empty-state note below).
   */
  multiPage?: boolean;
}

type ColumnKey = "open" | "acknowledged" | "resolved";

const columnMeta: Record<
  ColumnKey,
  {
    label: string;
    description: string;
    emptyTitle: string;
    emptyMessage: string;
    badgeTone: "danger" | "warning" | "success";
  }
> = {
  open: {
    label: "Open",
    description: "Needs eyes. Acknowledge to claim it, resolve when handled.",
    emptyTitle: "Nothing open",
    emptyMessage: "The clinic is humming.",
    badgeTone: "danger",
  },
  acknowledged: {
    label: "Acknowledged",
    description: "Someone's looking into it. Resolve when handled.",
    emptyTitle: "Nothing acknowledged",
    emptyMessage: "Events you've seen but haven't yet resolved appear here.",
    badgeTone: "warning",
  },
  resolved: {
    label: "Resolved",
    description: "Closed. Stay on the audit log for the record.",
    emptyTitle: "Nothing resolved yet",
    emptyMessage: "Resolved events appear here for the record.",
    badgeTone: "success",
  },
};

const COLUMN_KEYBOARD_MAP: Record<string, ColumnKey> = {
  o: "open",
  a: "acknowledged",
  r: "resolved",
};

export function OperationsBoard({
  events,
  filtersActive,
  multiPage = false,
}: OperationsBoardProps) {
  const router = useRouter();
  const [columnOverride, setColumnOverride] = useState<Map<string, ColumnKey>>(new Map());
  const [activeTab, setActiveTab] = useState<ColumnKey>("open");
  const [bulkResolving, setBulkResolving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [, startTransition] = useTransition();

  const columnHeaderRefs = useRef<Record<ColumnKey, HTMLHeadingElement | null>>({
    open: null,
    acknowledged: null,
    resolved: null,
  });

  // Resolve every event into its current display column, taking any in-flight
  // optimistic move into account.
  const grouped = useMemo(() => {
    const buckets: Record<ColumnKey, OperationalEventRow[]> = {
      open: [],
      acknowledged: [],
      resolved: [],
    };
    for (const event of events) {
      const override = columnOverride.get(event.id);
      const target: ColumnKey = override ?? (event.status as ColumnKey);
      buckets[target].push(event);
    }
    return buckets;
  }, [events, columnOverride]);

  const openCount = grouped.open.length;
  const acknowledgedCount = grouped.acknowledged.length;
  const resolvedCount = grouped.resolved.length;
  const allEmpty = openCount === 0 && acknowledgedCount === 0 && resolvedCount === 0;

  const handleTransitioned = useCallback(
    (eventId: string, nextStatus: "acknowledged" | "resolved") => {
      setColumnOverride((prev) => {
        const next = new Map(prev);
        next.set(eventId, nextStatus);
        return next;
      });
      // Refresh router so the next render reflects server truth and reconciles
      // any rows whose override matches the new status (they fall back to the
      // server value seamlessly when the override is cleared on re-render).
      startTransition(() => router.refresh());
    },
    [router]
  );

  const handleTransitionFailed = useCallback(
    (eventId: string, previousColumn: ColumnKey) => {
      setColumnOverride((prev) => {
        const next = new Map(prev);
        next.set(eventId, previousColumn);
        return next;
      });
    },
    []
  );

  const bulkResolveOpen = useCallback(async () => {
    const openIds = grouped.open.map((event) => event.id);
    if (openIds.length === 0) return;
    setBulkResolving(true);
    setBulkProgress({ done: 0, total: openIds.length });

    let failures = 0;
    for (let index = 0; index < openIds.length; index += 1) {
      const id = openIds[index];
      // Optimistically migrate this row.
      setColumnOverride((prev) => {
        const next = new Map(prev);
        next.set(id, "resolved");
        return next;
      });
      try {
        const formData = new FormData();
        formData.set("event_id", id);
        formData.set("status", "resolved");
        await updateOperationalEventStatus(formData);
      } catch {
        failures += 1;
        setColumnOverride((prev) => {
          const next = new Map(prev);
          next.set(id, "open");
          return next;
        });
      }
      setBulkProgress({ done: index + 1, total: openIds.length });
    }

    setBulkResolving(false);
    setBulkProgress(null);

    if (failures === 0) {
      toast.success(
        openIds.length === 1
          ? "1 event resolved."
          : `${openIds.length} events resolved.`
      );
    } else if (failures === openIds.length) {
      toast.error("Couldn't resolve any events. Try again.", {
        duration: Infinity,
      });
    } else {
      toast.error(`Couldn't resolve ${failures} of ${openIds.length}. Try again.`, {
        duration: Infinity,
      });
    }

    startTransition(() => router.refresh());
  }, [grouped.open, router]);

  // Keyboard shortcuts — o / a / r jump focus to the matching column heading.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
        return;
      }
      const key = event.key.toLowerCase();
      const column = COLUMN_KEYBOARD_MAP[key];
      if (!column) return;
      event.preventDefault();
      setActiveTab(column);
      const heading = columnHeaderRefs.current[column];
      heading?.focus({ preventScroll: false });
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (allEmpty) {
    return (
      <div data-redesign-needs-photo="operations-clear.svg" className="py-4">
        <EmptyState
          icon={ShieldCheck}
          title={
            filtersActive
              ? "No events match"
              : "No operational events logged"
          }
          message={
            filtersActive
              ? "Try adjusting or clearing your filters."
              : "Quietest week in months."
          }
          action={
            filtersActive
              ? { label: "Clear filters", href: "/admin/operations" }
              : undefined
          }
          compact
        />
      </div>
    );
  }

  return (
    <>
      <span className="sr-only" aria-live="polite">
        Tip: press O, A, or R to jump to the Open, Acknowledged, or Resolved column.
      </span>

      {bulkProgress ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-3 py-2 text-xs text-[var(--admin-body)]"
        >
          Resolving {bulkProgress.done} of {bulkProgress.total}…
        </div>
      ) : null}

      {/* Mobile / tablet tab strip (lg: and below). */}
      <div className="mb-4 xl:hidden">
        <div
          role="tablist"
          aria-label="Operational events by status"
          className="inline-flex w-full items-center gap-1 overflow-x-auto rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-1"
        >
          {(["open", "acknowledged", "resolved"] as ColumnKey[]).map((key) => {
            const isActive = activeTab === key;
            const count = grouped[key].length;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`operations-panel-${key}`}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[0.375rem] px-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                  isActive
                    ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                    : "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]"
                )}
              >
                <span>{columnMeta[key].label}</span>
                <span
                  className={cn(
                    "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[0.6875rem]",
                    isActive
                      ? "bg-white/20 text-[var(--admin-on-primary)]"
                      : "bg-[var(--admin-panel-muted)] text-[var(--admin-text-muted)]"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3 xl:items-start">
        {(["open", "acknowledged", "resolved"] as ColumnKey[]).map((key) => {
          const column = columnMeta[key];
          const isActiveOnMobile = activeTab === key;
          const allRows = grouped[key];
          return (
            <section
              key={key}
              id={`operations-panel-${key}`}
              role={isActiveOnMobile ? "tabpanel" : undefined}
              aria-labelledby={`operations-heading-${key}`}
              hidden={!isActiveOnMobile && undefined}
              className={cn(
                // Per brief §5: columns are headers + stacked row panels, NOT grouping panels.
                "min-w-0",
                !isActiveOnMobile && "hidden xl:block"
              )}
            >
              <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <h2
                    id={`operations-heading-${key}`}
                    ref={(node) => {
                      columnHeaderRefs.current[key] = node;
                    }}
                    tabIndex={-1}
                    className="font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                  >
                    {column.label}
                  </h2>
                  <AdminStatusBadge
                    value={String(allRows.length)}
                    tone={
                      // Brief §5: Open=Cancelled, Acknowledged=Pending, Resolved=Confirmed.
                      key === "open" && allRows.length > 0
                        ? "danger"
                        : key === "acknowledged" && allRows.length > 0
                          ? "info"
                          : key === "resolved" && allRows.length > 0
                            ? "success"
                            : "muted"
                    }
                    compact
                  />
                </div>
                {key === "open" && allRows.length >= 2 ? (
                  <ConfirmActionModal
                    title="Resolve open events?"
                    description={`Mark ${allRows.length} open events resolved? They'll move to the Resolved column. Nothing is deleted; all events stay on the audit log.`}
                    confirmLabel="Resolve all"
                    cancelLabel="Cancel"
                    destructive
                    onConfirm={bulkResolveOpen}
                    trigger={
                      <button
                        type="button"
                        disabled={bulkResolving}
                        title="Resolve every open event in one go"
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-xs font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {bulkResolving ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <CheckCircle className="size-3.5" aria-hidden="true" />
                        )}
                        Resolve all
                      </button>
                    }
                  />
                ) : null}
              </header>

              {allRows.length === 0 ? (
                <div className="rounded-[var(--admin-radius-control)] bg-[var(--admin-panel)]/60 px-3 py-6">
                  <EmptyState
                    icon={key === "open" ? ShieldCheck : key === "acknowledged" ? Eye : Inbox}
                    title={multiPage ? `${column.label}: none on this page` : column.emptyTitle}
                    message={
                      multiPage
                        ? "There may be more on another page — check the pager below."
                        : column.emptyMessage
                    }
                    compact
                  />
                </div>
              ) : (
                <div className="grid gap-2.5">
                  {/* C-16 Phase D Step 11 — every row already fetched for THIS
                      server page is rendered; there is no second, client-side
                      "Load more" cap here anymore. Before the pager existed,
                      each column silently capped itself at 50 visible rows
                      (with a "Load more" that only ever revealed rows already
                      downloaded) as its own anti-sprawl measure. Now that the
                      server pager bounds the whole board to LOG_PAGE_SIZE
                      (100) rows per page, that per-column cap would sit
                      INSIDE an already-bounded window and add a second "more"
                      affordance with different semantics from the real one
                      below the board — clicking it never fetches anything,
                      it only un-hides rows that were already in memory, which
                      reads as "there's more data" when the server page
                      boundary is the actual limit. Removed; the pager below
                      is the single source of truth for "there is more". */}
                  {allRows.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      column={key}
                      onTransitioned={handleTransitioned}
                      onTransitionFailed={handleTransitionFailed}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
