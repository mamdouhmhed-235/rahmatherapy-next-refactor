"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchAdminCommand, type AdminSearchResult } from "../search-actions";

export function AdminCommandSearch({
  triggerClassName,
  compact = false,
}: {
  triggerClassName?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      startTransition(async () => {
        setResults(await searchAdminCommand(query));
      });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [open, query]);

  return (
    <BaseDialog.Root open={open} onOpenChange={setOpen}>
      <BaseDialog.Trigger
        className={
          triggerClassName ??
          "inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--rahma-border)] bg-white px-3 text-sm font-medium text-[var(--rahma-muted)] outline-none transition-colors hover:text-[var(--rahma-charcoal)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
        }
      >
        <Search className="size-4" />
        <span>{compact ? "Search" : "Search clients or bookings"}</span>
        {!compact ? (
          <kbd className="ml-2 hidden rounded border border-[var(--rahma-border)] bg-[var(--rahma-ivory)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--rahma-muted)] xl:inline">
            Ctrl K
          </kbd>
        ) : null}
      </BaseDialog.Trigger>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-slate-950/25 backdrop-blur-sm" />
        <BaseDialog.Popup className="fixed left-1/2 top-[8vh] z-50 grid w-[min(calc(100vw-1rem),42rem)] -translate-x-1/2 gap-0 overflow-hidden rounded-xl border border-[var(--rahma-border)] bg-white shadow-elevated outline-none">
          <div className="flex items-center gap-3 border-b border-[var(--rahma-border)] px-4 py-3">
            <Search className="size-4 shrink-0 text-[var(--rahma-muted)]" />
            <BaseDialog.Title className="sr-only">Search admin records</BaseDialog.Title>
            <Input
              id="admin-command-search"
              name="admin-command-search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search bookings, clients, phones, emails, postcodes..."
              className="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
            />
            <BaseDialog.Close className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--rahma-muted)] outline-none hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30">
              <X className="size-4" />
              <span className="sr-only">Close search</span>
            </BaseDialog.Close>
          </div>

          <div className="admin-nav-scrollbar max-h-[60vh] overflow-y-auto p-2">
            {isPending ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[var(--rahma-muted)]">
                <Loader2 className="size-4 animate-spin" />
                Searching
              </div>
            ) : query.trim().length < 2 ? (
              <p className="px-4 py-10 text-center text-sm text-[var(--rahma-muted)]">
                Type at least two characters to search permitted records.
              </p>
            ) : results.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-[var(--rahma-muted)]">
                No matching permitted records found.
              </p>
            ) : (
              <ul className="m-0 grid list-none gap-1 p-0">
                {results.map((result) => (
                  <li key={`${result.type}-${result.id}`}>
                    <Link
                      href={result.href}
                      onClick={() => setOpen(false)}
                      className="grid rounded-lg px-3 py-3 text-left outline-none hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate font-medium text-[var(--rahma-charcoal)]">
                          {result.title}
                        </span>
                        <span className="shrink-0 rounded-full bg-[var(--rahma-green)]/10 px-2 py-0.5 text-xs font-semibold capitalize text-[var(--rahma-green)]">
                          {result.type}
                        </span>
                      </span>
                      <span className="mt-1 truncate text-sm text-[var(--rahma-muted)]">
                        {result.detail}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--rahma-border)] bg-[var(--rahma-ivory)] px-4 py-3 text-xs text-[var(--rahma-muted)]">
            <span>Results are scoped to your permissions.</span>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
