"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronsDownUp, ChevronsUpDown, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

export function AuditPageActions() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [refreshedAt, setRefreshedAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const onRefresh = () => {
    startTransition(() => {
      router.refresh();
      setRefreshedAt(Date.now());
      toast.success("Refreshed");
    });
  };

  const onExpandAll = () => {
    document
      .querySelectorAll<HTMLDetailsElement>("details[data-audit-json='true']")
      .forEach((d) => {
        d.open = true;
      });
  };

  const onCollapseAll = () => {
    document
      .querySelectorAll<HTMLDetailsElement>("details[data-audit-json='true']")
      .forEach((d) => {
        d.open = false;
      });
  };

  const minutesAgo = Math.max(0, Math.floor((now - refreshedAt) / 60_000));
  const refreshedLabel =
    minutesAgo < 1 ? "Just refreshed" : `Last refreshed ${minutesAgo} min ago`;

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={onExpandAll}
        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-2.5 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        <ChevronsUpDown className="size-3.5" aria-hidden="true" />
        Expand all
      </button>
      <button
        type="button"
        onClick={onCollapseAll}
        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-2.5 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        <ChevronsDownUp className="size-3.5" aria-hidden="true" />
        Collapse all
      </button>
      <span aria-hidden="true" className="hidden h-4 w-px bg-[var(--admin-border)] sm:inline-block" />
      <span
        className="hidden text-xs text-[var(--admin-text-muted)] [font-variant-numeric:tabular-nums] sm:inline"
        aria-live="polite"
      >
        {refreshedLabel}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isPending}
        aria-busy={isPending}
        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2.5 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-progress disabled:opacity-70"
      >
        <RefreshCcw
          className={isPending ? "size-3.5 animate-spin motion-reduce:animate-none" : "size-3.5"}
          aria-hidden="true"
        />
        Refresh
      </button>
    </div>
  );
}
