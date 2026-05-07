"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminStatusBadge } from "../components/admin-ui";
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

const COMPACT_LIMIT = 2;
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

export function AttentionBoardClient({
  title,
  groups,
}: {
  title: string;
  groups: AttentionGroup[];
}) {
  const categories = useMemo(() => buildCategories(groups), [groups]);
  const firstActiveCategory = categories.find((category) => category.key !== "all")?.key ?? "all";
  const [activeCategory, setActiveCategory] = useState(firstActiveCategory);
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const resolvedActiveCategory = categories.some((category) => category.key === activeCategory)
    ? activeCategory
    : firstActiveCategory;

  const activeEntries = useMemo(
    () => flattenGroups(groups, resolvedActiveCategory),
    [groups, resolvedActiveCategory]
  );
  const compactEntries = activeEntries.slice(0, COMPACT_LIMIT);
  const pageCount = Math.max(1, Math.ceil(activeEntries.length / EXPANDED_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const expandedEntries = activeEntries.slice(
    (safePage - 1) * EXPANDED_PAGE_SIZE,
    safePage * EXPANDED_PAGE_SIZE
  );
  const selectedCategory = categories.find((category) => category.key === resolvedActiveCategory) ?? categories[0];
  const total = categories[0]?.count ?? 0;

  function handleCategoryChange(category: string) {
    setActiveCategory(category);
    setPage(1);
  }

  useEffect(() => {
    if (!expanded) return;
    dialogRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  return (
    <>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
                {title}
              </h2>
              <AdminStatusBadge value={`${total} open`} tone="warning" />
              {selectedCategory ? (
                <AdminStatusBadge value={selectedCategory.label} tone="muted" />
              ) : null}
            </div>
            <p className="mt-1.5 text-sm leading-5 text-[var(--rahma-muted)]">
              Showing the highest-priority signals first. Expand for the full queue.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded={expanded}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--rahma-border)] bg-white px-3.5 text-[13px] font-semibold text-[var(--rahma-charcoal)] outline-none transition-colors hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
          >
            <Expand className="size-3.5 text-[var(--rahma-green)]" aria-hidden="true" />
            Expand
          </button>
        </div>

        <CategoryTabs
          categories={categories}
          activeCategory={resolvedActiveCategory}
          onChange={handleCategoryChange}
        />

        <div
          className="rounded-lg border border-[var(--rahma-border)] bg-[var(--admin-surface-muted)]/55 p-3"
          onDoubleClick={() => setExpanded(true)}
        >
          {compactEntries.length > 0 ? (
            <GroupedEntries entries={compactEntries} compact />
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--rahma-border)] bg-white px-4 py-8 text-center">
              <p className="text-base font-semibold text-[var(--rahma-charcoal)]">
                No signals in this category
              </p>
              <p className="mt-1 text-sm text-[var(--rahma-muted)]">
                Choose another category or adjust the date range.
              </p>
            </div>
          )}
        </div>

        <p className="text-sm text-[var(--rahma-muted)]">
          Showing {Math.min(COMPACT_LIMIT, activeEntries.length)} of {activeEntries.length} in {selectedCategory?.label ?? "this view"}.
        </p>
        {activeEntries.length > COMPACT_LIMIT ? (
          <p className="text-sm text-[var(--rahma-muted)]">
            Use Expand to review the full queue and pagination.
          </p>
        ) : null}
      </div>

      {expanded ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-3 sm:p-6"
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
            className="grid max-h-[min(92vh,54rem)] min-w-0 w-[min(100%,64rem)] max-w-full grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl border border-[var(--rahma-border)] bg-white shadow-2xl outline-none"
          >
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-[var(--rahma-border)] px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 id="attention-dialog-title" className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
                    Needs attention
                  </h2>
                  <AdminStatusBadge value={`${total} open`} tone="warning" />
                </div>
                <p className="mt-1 text-sm text-[var(--rahma-muted)]">
                  Review signals by category without leaving the dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--rahma-muted)] outline-none transition-colors hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
                aria-label="Close needs attention details"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="min-w-0 border-b border-[var(--rahma-border)] px-5 py-3">
              <CategoryTabs
                categories={categories}
                activeCategory={resolvedActiveCategory}
                onChange={handleCategoryChange}
              />
            </div>

            <div className="min-w-0 overflow-y-auto bg-[var(--admin-surface-muted)]/45 px-5 py-4">
              {expandedEntries.length > 0 ? (
                <GroupedEntries entries={expandedEntries} />
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--rahma-border)] bg-white px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-[var(--rahma-charcoal)]">
                    No signals in this category
                  </p>
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--rahma-border)] px-5 py-4">
              <p className="text-sm text-[var(--rahma-muted)]">
                Page {safePage} of {pageCount} - {activeEntries.length} signal{activeEntries.length === 1 ? "" : "s"}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage === 1}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--rahma-border)] bg-white px-3 text-xs font-semibold text-[var(--rahma-charcoal)] outline-none transition-colors hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30 disabled:cursor-not-allowed disabled:opacity-45"
                  aria-label="Previous attention page"
                >
                  <ChevronLeft className="size-3.5" aria-hidden="true" />
                  Previous
                </button>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    aria-current={safePage === pageNumber ? "page" : undefined}
                    className={cn(
                      "inline-flex size-9 items-center justify-center rounded-lg border text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30",
                      safePage === pageNumber
                        ? "border-[var(--rahma-green)] bg-[var(--rahma-green)] text-white"
                        : "border-[var(--rahma-border)] bg-white text-[var(--rahma-charcoal)] hover:bg-[var(--rahma-ivory)]"
                    )}
                    style={safePage === pageNumber ? { color: "#ffffff" } : undefined}
                    aria-label={`Attention page ${pageNumber}`}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  disabled={safePage === pageCount}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--rahma-border)] bg-white px-3 text-xs font-semibold text-[var(--rahma-charcoal)] outline-none transition-colors hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30 disabled:cursor-not-allowed disabled:opacity-45"
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
            "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30",
            activeCategory === category.key
              ? "bg-white text-[var(--rahma-charcoal)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              : "text-[var(--rahma-muted)] hover:bg-white/70 hover:text-[var(--rahma-charcoal)]"
          )}
        >
          {category.label}
          <span className="rounded-full bg-[var(--rahma-ivory)] px-1.5 py-0.5 text-[11px] leading-none text-[var(--rahma-muted)]">
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
              <h3 className="truncate text-[15px] font-semibold text-[var(--rahma-charcoal)]">
                {group.label}
              </h3>
              <AdminStatusBadge value={`${group.count}`} tone="muted" />
            </div>
            {!compact && group.pageHref ? (
              <Link
                href={group.pageHref}
                className="inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-[13px] font-semibold text-[var(--rahma-green)] outline-none transition-colors hover:bg-[var(--rahma-green)]/8 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
              >
                {group.actionLabel ?? "Open"}
              </Link>
            ) : null}
          </div>
          {!compact ? (
            <p className="text-sm leading-5 text-[var(--rahma-muted)]">
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
