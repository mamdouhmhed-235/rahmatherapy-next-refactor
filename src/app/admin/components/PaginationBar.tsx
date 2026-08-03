// Shared pager UI (C-16 Phase B). Server-component-friendly: Prev/Next are
// plain <Link>s, no client state. Two modes:
//   - offset (default): page/pageCount/total readout + Prev/Next via makeHref.
//   - cursor: Prev/Next tokens only, no total — for log-scale tables (the
//     audit-log pattern this generalises).
// A disabled control renders as a non-link <span>, never a <Link> carrying a
// "disabled" attribute (anchors have no such attribute — it would still
// navigate). Nothing renders when there is only one page / nowhere to go.
import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OffsetPaginationBarProps {
  mode?: "offset";
  /** 1-based current page. */
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  makeHref: (page: number) => string;
}

export interface CursorPaginationBarProps {
  mode: "cursor";
  prevHref?: string | null;
  nextHref?: string | null;
}

export type PaginationBarProps = OffsetPaginationBarProps | CursorPaginationBarProps;

const controlClassName =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-panel)] px-4 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55";

function PagerControl({
  href,
  label,
  children,
}: {
  href: string | null | undefined;
  label: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <span
        aria-disabled="true"
        aria-label={label}
        className={cn(controlClassName, "cursor-not-allowed opacity-50")}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(controlClassName, "hover:bg-[var(--admin-panel-muted)]")}
    >
      {children}
    </Link>
  );
}

function formatCount(value: number): string {
  return value.toLocaleString("en-GB");
}

function OffsetBar({ page, pageCount, total, pageSize, makeHref }: OffsetPaginationBarProps) {
  if (pageCount <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const prevHref = page > 1 ? makeHref(page - 1) : null;
  const nextHref = page < pageCount ? makeHref(page + 1) : null;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col items-center gap-3 border-t border-[var(--admin-border)] pt-4 sm:flex-row sm:justify-between"
    >
      <p className="tabular-nums text-center text-sm text-[var(--admin-text-muted)] sm:text-left">
        Showing {formatCount(from)}–{formatCount(to)} of {formatCount(total)}
      </p>
      <div className="flex items-center gap-2">
        <PagerControl href={prevHref} label="Previous page">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Previous
        </PagerControl>
        <PagerControl href={nextHref} label="Next page">
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </PagerControl>
      </div>
    </nav>
  );
}

function CursorBar({ prevHref, nextHref }: CursorPaginationBarProps) {
  if (!prevHref && !nextHref) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-end gap-2 border-t border-[var(--admin-border)] pt-4"
    >
      <PagerControl href={prevHref} label="Previous page">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Previous
      </PagerControl>
      <PagerControl href={nextHref} label="Next page">
        Next
        <ChevronRight className="size-4" aria-hidden="true" />
      </PagerControl>
    </nav>
  );
}

export function PaginationBar(props: PaginationBarProps) {
  if (props.mode === "cursor") {
    return <CursorBar {...props} />;
  }
  return <OffsetBar {...props} />;
}
