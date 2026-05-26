"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { searchAdminCommand, type AdminSearchResult } from "../search-actions";

export function AdminCommandSearch({
  triggerClassName,
  compact = false,
}: {
  triggerClassName?: string;
  compact?: boolean;
}) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [hasError, setHasError] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isPending, startTransition] = useTransition();
  const inputRef   = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  // ⌘K / Ctrl+K global trigger
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset focused index when results change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFocusedIndex(-1);
    resultRefs.current = [];
  }, [results]);

  // Debounced search — 120ms per brief §6
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasError(false);
    const timer = window.setTimeout(() => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      startTransition(async () => {
        try {
          setResults(await searchAdminCommand(query));
        } catch {
          // Error state: toast + retain query (brief §6 AdminCommandSearch Error state)
          setResults([]);
          setHasError(true);
          toast.error("Search failed. Try again.", { id: "cmd-search-error" });
        }
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  // ↑/↓ arrow-key navigation between results (brief §6: "↑/↓/Enter navigate")
  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(focusedIndex + 1, results.length - 1);
      setFocusedIndex(next);
      resultRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = focusedIndex - 1;
      setFocusedIndex(prev);
      if (prev < 0) {
        // Return focus to search input when arrowing back past the first result
        inputRef.current?.focus();
      } else {
        resultRefs.current[prev]?.focus();
      }
    }
  }

  function handleResultKeyDown(
    e: React.KeyboardEvent<HTMLAnchorElement>,
    index: number
  ) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(index + 1, results.length - 1);
      setFocusedIndex(next);
      resultRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = index - 1;
      setFocusedIndex(prev);
      if (prev < 0) {
        inputRef.current?.focus();
      } else {
        resultRefs.current[prev]?.focus();
      }
    }
  }

  return (
    <BaseDialog.Root open={open} onOpenChange={setOpen}>
      <BaseDialog.Trigger
        className={
          triggerClassName ??
          "inline-flex h-9 items-center gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-sm font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-body)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        }
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span>{compact ? "Search…" : "Search bookings, clients, staff…"}</span>
        {compact ? (
          <kbd className="ml-1 hidden rounded border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--admin-text-muted)] xl:inline">
            ⌘K
          </kbd>
        ) : null}
      </BaseDialog.Trigger>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-[oklch(12%_0.01_165)]/30 backdrop-blur-sm" />
        <BaseDialog.Popup className="fixed left-1/2 top-[8vh] z-50 grid w-[min(calc(100vw-1rem),42rem)] -translate-x-1/2 overflow-hidden rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] shadow-[var(--admin-shadow-overlay)] outline-none">
          <div className="flex items-center gap-3 border-b border-[var(--admin-border)] px-4 py-3">
            <Search className="size-4 shrink-0 text-[var(--admin-text-muted)]" aria-hidden="true" />
            <BaseDialog.Title className="sr-only">Search admin records</BaseDialog.Title>
            <label htmlFor="admin-command-search" className="sr-only">
              Search
            </label>
            <input
              ref={inputRef}
              id="admin-command-search"
              name="admin-command-search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search bookings, clients, staff…"
              className="h-10 min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--admin-heading)] outline-none placeholder:text-[var(--admin-text-muted)]"
            />
            <BaseDialog.Close className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55">
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </BaseDialog.Close>
          </div>

          <div className="admin-nav-scrollbar max-h-[60vh] overflow-y-auto p-2" role="listbox">
            {isPending ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[var(--admin-text-muted)]">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Searching
              </div>
            ) : hasError ? (
              /* Error state — brief §6: "Error (toast + retain query)" */
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-semibold text-[var(--admin-heading)]">Search isn&rsquo;t working right now</p>
                <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                  Something went wrong. Your search is still here. Try again.
                </p>
              </div>
            ) : query.trim().length < 2 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-semibold text-[var(--admin-heading)]">Start typing</p>
                <p className="mt-1 text-sm text-[var(--admin-text-muted)]">Search bookings, clients, staff, or pages.</p>
              </div>
            ) : results.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-[var(--admin-text-muted)]">
                Nothing matches &ldquo;{query}&rdquo;. Try a name, phone number, or booking ID.
              </p>
            ) : (
              <ul className="m-0 grid list-none gap-0.5 p-0" aria-label="Search results">
                {results.map((result, index) => (
                  <li key={`${result.type}-${result.id}`} role="option" aria-selected={focusedIndex === index}>
                    <Link
                      ref={(el) => { resultRefs.current[index] = el; }}
                      href={result.href}
                      onClick={() => setOpen(false)}
                      onKeyDown={(e) => handleResultKeyDown(e, index)}
                      className="grid rounded-[var(--admin-radius-control)] px-3 py-3 text-left outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-[var(--admin-heading)]">
                          {result.title}
                        </span>
                        <span className="shrink-0 rounded-full bg-[var(--admin-primary)]/10 px-2 py-0.5 text-[11px] font-semibold capitalize text-[var(--admin-primary)]">
                          {result.type}
                        </span>
                      </span>
                      <span className="mt-0.5 truncate text-xs text-[var(--admin-text-muted)]">
                        {result.detail}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-4 py-3 text-xs text-[var(--admin-text-muted)]">
            <span>You&apos;ll only see records you have access to.</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2.5 text-xs font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              Close <kbd className="text-[10px] text-[var(--admin-text-muted)]">Esc</kbd>
            </button>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
