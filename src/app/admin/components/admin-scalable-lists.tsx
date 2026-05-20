"use client";

import * as React from "react";
import { Search, FilterX, ChevronLeft, ChevronRight, Loader2, FolderSearch, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminButton, AdminSkeleton, AdminActionGroup } from "./admin-ui";
import { EmptyState } from "./EmptyState";

export function AdminListSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4", className)}>
      {children}
    </div>
  );
}

export function SavedViewTabs({
  views,
  activeView,
  onViewChange,
  className,
}: {
  views: { id: string; label: React.ReactNode }[];
  activeView: string;
  onViewChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {views.map((view) => (
        <button
          key={view.id}
          type="button"
          onClick={() => onViewChange(view.id)}
          aria-current={activeView === view.id ? "page" : undefined}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
            activeView === view.id
              ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
              : "bg-[var(--admin-panel-muted)] text-[var(--admin-text-muted)] hover:bg-[var(--admin-hover-mist)] hover:text-[var(--admin-heading)]"
          )}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

export function DebouncedSearchInput({
  value,
  onChange,
  placeholder = "Search...",
  delay = 300,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
}) {
  const [localValue, setLocalValue] = React.useState(value);
  const [prevValueProp, setPrevValueProp] = React.useState(value);

  if (value !== prevValueProp) {
    setPrevValueProp(value);
    setLocalValue(value);
  }

  React.useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, delay);

    return () => clearTimeout(handler);
  }, [localValue, onChange, value, delay]);

  return (
    <div className={cn("relative flex items-center", className)}>
      <Search className="absolute left-3 size-4 text-[var(--admin-text-muted)]" aria-hidden="true" />
      <input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] pl-9 pr-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
      />
    </div>
  );
}

export function SearchFilterBar({
  search,
  filters,
  actions,
  className,
}: {
  search?: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3 lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        {search ? <div className="sm:max-w-xs flex-1">{search}</div> : null}
        {filters ? <AdminActionGroup>{filters}</AdminActionGroup> : null}
      </div>
      {actions ? <AdminActionGroup className="shrink-0">{actions}</AdminActionGroup> : null}
    </div>
  );
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className={cn("flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3 sm:px-6 rounded-b-[var(--admin-radius-card)]", className)}>
      <div className="hidden sm:block">
        <p className="text-sm text-[var(--admin-text-muted)]">
          Page <span className="font-medium text-[var(--admin-heading)]">{currentPage}</span> of{" "}
          <span className="font-medium text-[var(--admin-heading)]">{totalPages}</span>
        </p>
      </div>
      <div className="flex flex-1 justify-between sm:justify-end gap-2">
        <AdminButton
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="mr-1 size-4" aria-hidden="true" />
          Previous
        </AdminButton>
        <AdminButton
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
          <ChevronRight className="ml-1 size-4" aria-hidden="true" />
        </AdminButton>
      </div>
    </div>
  );
}

export function LoadMoreButton({
  onClick,
  loading = false,
  hasMore = true,
  className,
}: {
  onClick: () => void;
  loading?: boolean;
  hasMore?: boolean;
  className?: string;
}) {
  if (!hasMore) return null;

  return (
    <div className={cn("flex justify-center py-4", className)}>
      <AdminButton variant="outline" onClick={onClick} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            Loading more...
          </>
        ) : (
          "Load more"
        )}
      </AdminButton>
    </div>
  );
}

export function FilteredEmptyState({
  onReset,
  className,
}: {
  onReset: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <EmptyState
        icon={FilterX}
        title="No matching results"
        message="Try adjusting your search or filters to find what you're looking for."
        actions={
          <AdminButton variant="outline" onClick={onReset}>
            Clear filters
          </AdminButton>
        }
      />
    </div>
  );
}

export function NoResultsState({
  title = "No data found",
  message = "There are no records to display here yet.",
  actions,
  className,
}: {
  title?: string;
  message?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <EmptyState
        icon={FolderSearch}
        title={title}
        message={message}
        actions={actions}
      />
    </div>
  );
}

export function LargeListSkeleton({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 shadow-[var(--admin-shadow-subtle)]"
        >
          <div className="flex gap-4">
            <AdminSkeleton className="size-10 rounded-full shrink-0" />
            <div className="flex-1 grid gap-2">
              <AdminSkeleton className="h-4 w-1/3" />
              <AdminSkeleton className="h-3 w-1/4" />
            </div>
            <div className="shrink-0 grid gap-2 justify-items-end">
              <AdminSkeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MobileCardList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 lg:hidden", className)}>
      {children}
    </div>
  );
}

// ─── BookingCardSkeletonList ─────────────────────────────────────────────────
// Approximates the BookingListCard shape so the layout doesn't reflow when
// streamed data lands. Used inside the bookings page <Suspense> fallback.

export function BookingCardSkeletonList({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 sm:p-5"
        >
          <div className="grid gap-2">
            <AdminSkeleton className="h-5 w-2/5" />
            <AdminSkeleton className="h-3.5 w-3/5" />
            <div className="flex flex-wrap gap-2 pt-1">
              <AdminSkeleton className="h-5 w-20 rounded-full" />
              <AdminSkeleton className="h-5 w-24 rounded-full" />
              <AdminSkeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-3">
            <div className="flex items-center gap-2">
              <AdminSkeleton className="size-8 shrink-0 rounded-full" />
              <AdminSkeleton className="h-3.5 w-24" />
            </div>
            <div className="flex items-center gap-1.5">
              <AdminSkeleton className="size-9 rounded-[var(--admin-radius-control)]" />
              <AdminSkeleton className="h-9 w-20 rounded-[var(--admin-radius-control)]" />
              <AdminSkeleton className="size-9 rounded-[var(--admin-radius-control)]" />
            </div>
          </div>
        </div>
      ))}
      <span className="sr-only">Loading bookings…</span>
    </div>
  );
}

// ─── SavedViewBar ────────────────────────────────────────────────────────────
// Pill row with inline Save + inline Remove confirmation (no modal). Used by
// /admin/bookings as the secondary tab strip beneath the primary view tabs.

export function SavedViewBar({
  views,
  activeId,
  onApply,
  onSave,
  onRemove,
  className,
}: {
  views: { id: string; label: string }[];
  activeId: string | null;
  onApply: (id: string) => void;
  onSave: (name: string) => void;
  onRemove: (id: string) => void;
  className?: string;
}) {
  const [saving, setSaving] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (saving) inputRef.current?.focus();
  }, [saving]);

  const SAVED_VIEW_LIMIT = 20;
  const atLimit = views.length >= SAVED_VIEW_LIMIT;

  function handleSaveSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give this view a name.");
      return;
    }
    if (trimmed.length > 40) {
      setError("Keep view names under 40 characters.");
      return;
    }
    if (views.some((view) => view.label.toLowerCase() === trimmed.toLowerCase())) {
      setError(`You already have a view called "${trimmed}". Pick a different name.`);
      return;
    }
    if (atLimit) {
      setError(`You've reached the ${SAVED_VIEW_LIMIT} saved-view limit. Remove one first.`);
      return;
    }
    onSave(trimmed);
    setName("");
    setError(null);
    setSaving(false);
  }

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="group"
      aria-label="Saved views"
    >
      {views.length === 0 && !saving ? (
        <span className="text-xs text-[var(--admin-text-muted)]">
          No saved views yet.
        </span>
      ) : null}

      {views.map((view) => {
        const isActive = view.id === activeId;
        const isRemoving = removingId === view.id;

        if (isRemoving) {
          return (
            <span
              key={view.id}
              role="alertdialog"
              aria-label={`Remove view ${view.label}`}
              className="rahma-chip-pop inline-flex items-center gap-1.5 rounded-full border border-[oklch(88%_0.045_20)] bg-[oklch(95.5%_0.028_20)] px-3 py-1 text-xs"
            >
              <span className="text-[oklch(26%_0.14_25)]">
                Remove &ldquo;{view.label}&rdquo;?
              </span>
              <button
                type="button"
                onClick={() => {
                  onRemove(view.id);
                  setRemovingId(null);
                }}
                className="appearance-none rounded border-0 bg-transparent font-semibold text-[oklch(26%_0.14_25)] underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => setRemovingId(null)}
                className="appearance-none rounded border-0 bg-transparent text-[var(--admin-text-muted)] underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Keep
              </button>
            </span>
          );
        }

        return (
          <span key={view.id} className="inline-flex items-stretch">
            <button
              type="button"
              onClick={() => onApply(view.id)}
              aria-current={isActive ? "true" : undefined}
              title="Apply this view"
              className={cn(
                "appearance-none rounded-l-full border border-r-0 px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                isActive
                  ? "border-[var(--admin-border-form)] bg-[var(--admin-selected-sky)] text-[var(--admin-heading)]"
                  : "border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]"
              )}
            >
              {view.label}
            </button>
            <button
              type="button"
              onClick={() => setRemovingId(view.id)}
              title="Remove this view"
              aria-label={`Remove view ${view.label}`}
              className={cn(
                "inline-flex appearance-none items-center justify-center rounded-r-full border pl-1 pr-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                isActive
                  ? "border-[var(--admin-border-form)] bg-[var(--admin-selected-sky)] text-[var(--admin-text-muted)] hover:text-[var(--admin-heading)]"
                  : "border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-text-muted)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]"
              )}
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        );
      })}

      {saving ? (
        <form
          onSubmit={handleSaveSubmit}
          className="flex flex-wrap items-center gap-1.5"
        >
          <label className="sr-only" htmlFor="saved-view-name">
            Name this view
          </label>
          <input
            id="saved-view-name"
            ref={inputRef}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            placeholder="e.g. Today, unpaid"
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? "saved-view-name-error" : undefined}
            className="h-8 w-44 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-2.5 text-xs text-[var(--admin-body)] outline-none focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
          />
          <button
            type="submit"
            className="inline-flex h-8 appearance-none items-center rounded-[var(--admin-radius-control)] border-0 bg-[var(--admin-primary)] px-3 text-xs font-semibold text-[var(--admin-on-primary)] outline-none hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Save view
          </button>
          <button
            type="button"
            onClick={() => {
              setSaving(false);
              setName("");
              setError(null);
            }}
            className="inline-flex h-8 appearance-none items-center rounded-[var(--admin-radius-control)] border-0 bg-transparent px-2 text-xs font-medium text-[var(--admin-text-muted)] outline-none hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Cancel
          </button>
          {error ? (
            <span
              id="saved-view-name-error"
              role="alert"
              aria-live="polite"
              className="basis-full text-xs text-[oklch(26%_0.14_25)]"
            >
              {error}
            </span>
          ) : null}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setSaving(true)}
          disabled={atLimit}
          title={atLimit ? `Limit ${SAVED_VIEW_LIMIT} reached — remove one to add another.` : undefined}
          className="inline-flex h-8 appearance-none items-center gap-1 rounded-full border-0 bg-transparent px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-3" aria-hidden="true" />
          Save this view
        </button>
      )}
    </div>
  );
}

// ─── ActiveFilterChip ────────────────────────────────────────────────────────
// Restricted-family pill listing one active filter — text label plus a
// dismissive trailing × that calls onClear.

export function ActiveFilterChip({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear: () => void;
}) {
  return (
    <span className="rahma-chip-pop inline-flex items-center gap-1 rounded-full bg-[var(--admin-restricted-bg)] px-2.5 py-1 text-xs text-[var(--admin-restricted)]">
      <span className="font-medium">{label}:</span>
      <span>{value}</span>
      <button
        type="button"
        onClick={onClear}
        title="Clear this filter"
        aria-label={`Clear ${label} filter`}
        className="ml-0.5 inline-flex size-4 appearance-none items-center justify-center rounded-full border-0 bg-transparent text-[var(--admin-restricted)] outline-none transition-colors hover:bg-[oklch(89%_0.014_78)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </span>
  );
}
