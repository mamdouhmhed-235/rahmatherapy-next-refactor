"use client";

import * as React from "react";
import { Search, FilterX, ChevronLeft, ChevronRight, Loader2, FolderSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AdminEmptyState, AdminSkeleton, AdminActionGroup } from "./admin-ui";

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
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30",
            activeView === view.id
              ? "bg-[var(--rahma-green)] text-white"
              : "bg-[var(--admin-surface-muted)] text-[var(--rahma-muted)] hover:bg-[var(--rahma-green)]/10 hover:text-[var(--rahma-green)]"
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
      <Search className="absolute left-3 size-4 text-[var(--rahma-muted)]" />
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9 bg-white"
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
        "flex flex-col gap-3 rounded-[var(--admin-radius-md)] border border-[var(--rahma-border)] bg-white p-3 shadow-[var(--admin-shadow-card)] lg:flex-row lg:items-center lg:justify-between",
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
    <div className={cn("flex items-center justify-between border-t border-[var(--rahma-border)] bg-white px-4 py-3 sm:px-6 rounded-b-[var(--admin-radius-md)]", className)}>
      <div className="hidden sm:block">
        <p className="text-sm text-[var(--rahma-muted)]">
          Page <span className="font-medium text-[var(--rahma-charcoal)]">{currentPage}</span> of{" "}
          <span className="font-medium text-[var(--rahma-charcoal)]">{totalPages}</span>
        </p>
      </div>
      <div className="flex flex-1 justify-between sm:justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="mr-1 size-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
          <ChevronRight className="ml-1 size-4" />
        </Button>
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
      <Button variant="outline" onClick={onClick} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading more...
          </>
        ) : (
          "Load more"
        )}
      </Button>
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
      <AdminEmptyState
        icon={FilterX}
        title="No matching results"
        message="Try adjusting your search or filters to find what you're looking for."
        actions={
          <Button variant="outline" onClick={onReset}>
            Clear filters
          </Button>
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
      <AdminEmptyState
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
          className="rounded-[var(--admin-radius-md)] border border-[var(--rahma-border)] bg-white p-4 shadow-[var(--admin-shadow-card)]"
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
