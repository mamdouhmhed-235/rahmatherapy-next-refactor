"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Siren, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminStatusBadge } from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import type { AttentionGroup } from "./dashboard-cards";

type AttentionCategory = {
  key: string;
  label: string;
  count: number;
  priority: number;
};

type AttentionEntry = {
  group: AttentionGroup;
  item: React.ReactNode;
  entryKey: string;
};

const EXPANDED_PAGE_SIZE = 6;

function buildCategories(groups: AttentionGroup[]): AttentionCategory[] {
  const categories = new Map<string, AttentionCategory>();

  for (const group of groups) {
    const current = categories.get(group.category);
    categories.set(group.category, {
      key: group.category,
      label: group.categoryLabel,
      count: (current?.count ?? 0) + group.count,
      priority: Math.min(current?.priority ?? group.priority, group.priority),
    });
  }

  const categoryRows = [...categories.values()].sort(
    (a, b) => a.priority - b.priority || b.count - a.count
  );
  const total = groups.reduce((sum, group) => sum + group.count, 0);

  return [
    { key: "all", label: "All", count: total, priority: 0 },
    ...categoryRows,
  ];
}

function flattenGroups(groups: AttentionGroup[], category: string): AttentionEntry[] {
  const visibleGroups = category === "all"
    ? groups
    : groups.filter((group) => group.category === category);

  return visibleGroups.flatMap((group) =>
    group.items.map((item, index) => ({
      group,
      item,
      entryKey: `${group.key}-${index}`,
    }))
  );
}

function entriesToGroups(entries: AttentionEntry[]) {
  const grouped = new Map<string, { group: AttentionGroup; items: AttentionEntry[] }>();

  for (const entry of entries) {
    const row = grouped.get(entry.group.key);
    if (row) {
      row.items.push(entry);
    } else {
      grouped.set(entry.group.key, { group: entry.group, items: [entry] });
    }
  }

  return [...grouped.values()];
}

export function AttentionReviewButton({
  groups,
  label = "Review signals",
}: {
  groups: AttentionGroup[];
  label?: string;
}) {
  const categories = useMemo(() => buildCategories(groups), [groups]);
  const firstActiveCategory = categories.find((category) => category.key !== "all")?.key ?? "all";
  const [activeCategory, setActiveCategory] = useState(firstActiveCategory);
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const resolvedActiveCategory = categories.some((category) => category.key === activeCategory)
    ? activeCategory
    : firstActiveCategory;
  const activeEntries = useMemo(
    () => flattenGroups(groups, resolvedActiveCategory),
    [groups, resolvedActiveCategory]
  );
  const pageCount = Math.max(1, Math.ceil(activeEntries.length / EXPANDED_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const expandedEntries = activeEntries.slice(
    (safePage - 1) * EXPANDED_PAGE_SIZE,
    safePage * EXPANDED_PAGE_SIZE
  );
  const total = categories[0]?.count ?? 0;

  function handleCategoryChange(category: string) {
    setActiveCategory(category);
    setPage(1);
  }

  useEffect(() => {
    if (expanded) {
      dialogRef.current?.focus();

      function onKeyDown(event: KeyboardEvent) {
        if (event.key === "Escape") setExpanded(false);
      }

      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    } else {
      // Return focus to the trigger button when the dialog closes
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  }, [expanded]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-white outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
      >
        {label}
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>

      {expanded ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[oklch(12%_0.014_155)]/35 p-3 sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setExpanded(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="attention-dialog-title"
            tabIndex={-1}
            className="grid max-h-[min(92vh,54rem)] min-w-0 w-[min(100%,64rem)] max-w-full grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] shadow-2xl outline-none"
          >
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 id="attention-dialog-title" className="admin-display text-2xl font-bold text-[var(--admin-heading)]">
                    Urgent attention
                  </h2>
                  <AdminStatusBadge value={`${total} open`} tone={total > 0 ? "warning" : "success"} />
                </div>
                <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                  Review signals by category without leaving the dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="inline-flex size-11 sm:size-9 items-center justify-center rounded-full text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                aria-label="Close attention details"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="min-w-0 border-b border-[var(--admin-border)] px-5 py-3">
              <CategoryTabs
                categories={categories}
                activeCategory={resolvedActiveCategory}
                onChange={handleCategoryChange}
              />
            </div>

            <div className="min-w-0 overflow-y-auto bg-[var(--admin-panel-muted)]/45 px-5 py-4">
              {expandedEntries.length > 0 ? (
                <GroupedEntries entries={expandedEntries} />
              ) : (
                <EmptyState
                  icon={Siren}
                  title="No signals in this category"
                  message="Choose another category or adjust the date range."
                  tone="muted"
                />
              )}
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] px-5 py-4">
              <p className="text-sm text-[var(--admin-text-muted)]">
                Page {safePage} of {pageCount} - {activeEntries.length} signal{activeEntries.length === 1 ? "" : "s"}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage === 1}
                  className="inline-flex min-h-11 items-center gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-3 text-xs font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35 disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-9"
                  aria-label="Previous attention page"
                >
                  <ChevronLeft className="size-3.5" aria-hidden="true" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  disabled={safePage === pageCount}
                  className="inline-flex min-h-11 items-center gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-3 text-xs font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35 disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-9"
                  aria-label="Next attention page"
                >
                  Next
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CategoryTabs({
  categories,
  activeCategory,
  onChange,
}: {
  categories: AttentionCategory[];
  activeCategory: string;
  onChange: (category: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Attention categories"
      className="flex min-w-0 max-w-full flex-wrap gap-1 rounded-lg bg-[var(--admin-surface-muted)] p-1 sm:flex-nowrap sm:overflow-x-auto"
    >
      {categories.map((category) => (
        <button
          key={category.key}
          type="button"
          role="tab"
          aria-selected={activeCategory === category.key}
          onClick={() => onChange(category.key)}
          className={cn(
            "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35",
            activeCategory === category.key
              ? "bg-[var(--admin-primary)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
              : "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]"
          )}
        >
          {category.label}
          <span className={cn(
            "rounded-full px-1.5 py-0.5 text-[11px] leading-none",
            activeCategory === category.key ? "bg-white/20 text-white" : "bg-[var(--admin-panel-muted)] text-[var(--admin-text-muted)]"
          )}>
            {category.count}
          </span>
        </button>
      ))}
    </div>
  );
}

function GroupedEntries({
  entries,
  compact = false,
}: {
  entries: AttentionEntry[];
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0",
        compact
          ? "gap-3 [&_.dashboard-attention-detail]:text-sm [&_.dashboard-attention-impact]:text-[13px] [&_.dashboard-attention-item]:gap-2.5 [&_.dashboard-attention-item]:px-3.5 [&_.dashboard-attention-item]:py-3"
          : "gap-4"
      )}
    >
      {entriesToGroups(entries).map(({ group, items }) => (
        <section key={group.key} className="grid min-w-0 gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold text-[var(--admin-heading)]">
                {group.label}
              </h3>
              <AdminStatusBadge value={`${group.count}`} tone="muted" />
            </div>
            {!compact && group.pageHref ? (
                <Link
                href={group.pageHref}
                className="inline-flex min-h-9 items-center justify-center rounded-[var(--admin-radius-control)] px-3 text-[13px] font-semibold text-[var(--admin-primary)] outline-none transition-colors hover:bg-[var(--admin-primary)]/8 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
              >
                {group.actionLabel ?? "Open"}
              </Link>
            ) : null}
          </div>
          {!compact ? (
            <p className="text-sm leading-5 text-[var(--admin-text-muted)]">
              {group.summary}
            </p>
          ) : null}
          <div className={cn("grid", compact ? "gap-2" : "gap-2.5")}>
            {items.map((entry) => (
              <div key={entry.entryKey}>{entry.item}</div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
