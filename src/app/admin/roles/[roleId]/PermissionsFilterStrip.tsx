"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { AdminSheet } from "../../components/admin-ui-interactions";

interface PermissionsFilterStripProps {
  categories: string[];
  selectedCategories: string[];
  selectedRiskLevels: string[];
  grantedOnly: boolean;
  query: string;
  totalCount: number;
  filteredCount: number;
}

const RISK_OPTIONS = [
  { value: "low", label: "Low risk" },
  { value: "medium", label: "Medium risk" },
  { value: "high", label: "High risk" },
  { value: "critical", label: "Critical risk" },
];

export function PermissionsFilterStrip(props: PermissionsFilterStripProps) {
  const {
    categories,
    selectedCategories,
    selectedRiskLevels,
    grantedOnly,
    query,
    totalCount,
    filteredCount,
  } = props;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [localQuery, setLocalQuery] = useState(query);

  function buildHref(updates: {
    categories?: string[];
    riskLevels?: string[];
    grantedOnly?: boolean;
    query?: string;
  }): string {
    const params = new URLSearchParams();
    const cats = updates.categories ?? selectedCategories;
    const risks = updates.riskLevels ?? selectedRiskLevels;
    const g =
      typeof updates.grantedOnly === "boolean"
        ? updates.grantedOnly
        : grantedOnly;
    const q = typeof updates.query === "string" ? updates.query : localQuery;

    for (const c of cats) params.append("category", c);
    for (const r of risks) params.append("risk_level", r);
    if (g) params.set("granted_only", "1");
    if (q.trim()) params.set("q", q.trim());

    const search = params.toString();
    return search ? `${pathname}?${search}` : pathname;
  }

  function navigate(href: string) {
    startTransition(() => router.push(href, { scroll: false }));
  }

  function toggleCategory(category: string) {
    const next = selectedCategories.includes(category)
      ? selectedCategories.filter((c) => c !== category)
      : [...selectedCategories, category];
    navigate(buildHref({ categories: next }));
  }

  function toggleRisk(value: string) {
    const next = selectedRiskLevels.includes(value)
      ? selectedRiskLevels.filter((c) => c !== value)
      : [...selectedRiskLevels, value];
    navigate(buildHref({ riskLevels: next }));
  }

  function toggleGrantedOnly() {
    navigate(buildHref({ grantedOnly: !grantedOnly }));
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(buildHref({ query: localQuery }));
  }

  function clearAll() {
    setLocalQuery("");
    navigate(pathname);
  }

  const activeCount =
    selectedCategories.length +
    selectedRiskLevels.length +
    (grantedOnly ? 1 : 0) +
    (query.trim().length > 0 ? 1 : 0);

  const filterContent = (
    <FilterContent
      categories={categories}
      selectedCategories={selectedCategories}
      selectedRiskLevels={selectedRiskLevels}
      grantedOnly={grantedOnly}
      query={query}
      localQuery={localQuery}
      onLocalQueryChange={setLocalQuery}
      onSearchSubmit={handleSearchSubmit}
      onToggleCategory={toggleCategory}
      onToggleRisk={toggleRisk}
      onToggleGrantedOnly={toggleGrantedOnly}
      onClearAll={clearAll}
      totalCount={totalCount}
      filteredCount={filteredCount}
      activeCount={activeCount}
    />
  );

  return (
    <>
      {/* Mobile: trigger only — opens an AdminSheet from the bottom. */}
      <div className="flex items-center justify-between gap-2 sm:hidden">
        <p className="text-xs leading-5 text-[var(--admin-text-muted)]">
          Showing{" "}
          <span className="font-semibold text-[var(--admin-heading)]">
            {filteredCount}
          </span>{" "}
          of {totalCount}
        </p>
        <AdminSheet
          title="Filter permissions"
          description="Refine by risk, category, or grant state."
          side="bottom"
          trigger={
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-panel)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filters
              {activeCount > 0 ? (
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--admin-primary)] text-[0.6875rem] font-semibold text-white">
                  {activeCount}
                </span>
              ) : null}
            </button>
          }
        >
          {filterContent}
        </AdminSheet>
      </div>

      {/* Desktop+: inline panel */}
      <section
        aria-label="Permission filters"
        data-pending={isPending || undefined}
        className="hidden grid-cols-1 gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3 sm:grid sm:p-4"
      >
        {filterContent}
      </section>
    </>
  );
}

/* ───────────────────────────────────────────────── FilterContent ─── */

interface FilterContentProps {
  categories: string[];
  selectedCategories: string[];
  selectedRiskLevels: string[];
  grantedOnly: boolean;
  query: string;
  localQuery: string;
  onLocalQueryChange: (v: string) => void;
  onSearchSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onToggleCategory: (v: string) => void;
  onToggleRisk: (v: string) => void;
  onToggleGrantedOnly: () => void;
  onClearAll: () => void;
  totalCount: number;
  filteredCount: number;
  activeCount: number;
}

function FilterContent(p: FilterContentProps) {
  const hasActive = p.activeCount > 0;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-5 text-[var(--admin-text-muted)]">
          Showing{" "}
          <span className="font-semibold text-[var(--admin-heading)]">
            {p.filteredCount}
          </span>{" "}
          of {p.totalCount} permissions
        </p>
        {hasActive ? (
          <button
            type="button"
            onClick={p.onClearAll}
            className="inline-flex h-8 items-center gap-1 rounded-[var(--admin-radius-control)] px-2 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <X className="size-3.5" aria-hidden="true" />
            Clear filters
          </button>
        ) : null}
      </div>

      <form
        onSubmit={p.onSearchSubmit}
        className="relative flex items-center gap-2"
        role="search"
      >
        <label htmlFor="role-detail-permission-search" className="sr-only">
          Search permission names or descriptions
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-muted)]"
          aria-hidden="true"
        />
        <input
          id="role-detail-permission-search"
          name="q"
          type="search"
          value={p.localQuery}
          onChange={(e) => p.onLocalQueryChange(e.target.value)}
          placeholder="Search permission names or descriptions"
          className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] pl-9 pr-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
        />
      </form>

      <div className="grid gap-3.5">
        <div className="grid gap-1.5">
          <div className="flex items-baseline gap-2">
            <p
              id="filter-risk-label"
              className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]"
            >
              Risk
            </p>
            {p.selectedRiskLevels.length > 0 ? (
              <span className="text-[0.6875rem] text-[var(--admin-text-muted)]">
                {p.selectedRiskLevels.length} selected
              </span>
            ) : null}
          </div>
          <div
            role="group"
            aria-labelledby="filter-risk-label"
            className="flex flex-wrap gap-1.5"
          >
            {RISK_OPTIONS.map((option) => {
              const active = p.selectedRiskLevels.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => p.onToggleRisk(option.value)}
                  aria-pressed={active}
                  className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 ${
                    active
                      ? "border-[var(--admin-primary)] bg-[var(--admin-selected-sky)] text-[var(--admin-heading)]"
                      : "border-[var(--admin-border-form)] bg-transparent text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {p.categories.length > 0 ? (
          <div className="grid gap-1.5">
            <div className="flex items-baseline gap-2">
              <p
                id="filter-category-label"
                className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]"
              >
                Category
              </p>
              {p.selectedCategories.length > 0 ? (
                <span className="text-[0.6875rem] text-[var(--admin-text-muted)]">
                  {p.selectedCategories.length} selected
                </span>
              ) : null}
            </div>
            <div
              role="group"
              aria-labelledby="filter-category-label"
              className="flex flex-wrap gap-1.5"
            >
              {p.categories.map((category) => {
                const active = p.selectedCategories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => p.onToggleCategory(category)}
                    aria-pressed={active}
                    className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 ${
                      active
                        ? "border-[var(--admin-primary)] bg-[var(--admin-selected-sky)] text-[var(--admin-heading)]"
                        : "border-[var(--admin-border-form)] bg-transparent text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]"
                    }`}
                  >
                    {humanize(category)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <label
          htmlFor="granted-only-toggle"
          className="flex h-9 w-fit cursor-pointer items-center gap-2 rounded-full border border-[var(--admin-border-form)] bg-[var(--admin-panel-muted)]/40 px-3 text-xs font-medium text-[var(--admin-body)] transition-colors hover:bg-[var(--admin-panel-muted)]"
        >
          <input
            id="granted-only-toggle"
            type="checkbox"
            checked={p.grantedOnly}
            onChange={p.onToggleGrantedOnly}
            className="size-3.5 rounded border-[var(--admin-border-form)] text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          />
          Granted only
        </label>
      </div>
    </div>
  );
}

function humanize(value: string): string {
  return value
    .split(/[_\s]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}
