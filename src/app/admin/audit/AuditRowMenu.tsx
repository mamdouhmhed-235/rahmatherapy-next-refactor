"use client";

import { useState } from "react";
import { Check, Copy, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

interface AuditRowMenuProps {
  eventId: string;
  targetId: string | null;
}

export function AuditRowMenu({ eventId, targetId }: AuditRowMenuProps) {
  const [fallback, setFallback] = useState<{ kind: "event" | "target"; value: string } | null>(null);

  const copy = async (kind: "event" | "target", value: string, successLabel: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        toast.success(successLabel);
        return;
      } catch {
        // fall through
      }
    }
    setFallback({ kind, value });
  };

  if (fallback) {
    return (
      <div className="inline-flex items-center gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-2 py-1 text-[0.6875rem] text-[var(--admin-body)]">
        <span className="font-medium">{fallback.kind === "event" ? "Event:" : "Target:"}</span>
        <code className="font-mono">{fallback.value}</code>
        <button
          type="button"
          onClick={() => setFallback(null)}
          className="ml-1 text-[var(--admin-text-muted)] hover:text-[var(--admin-heading)]"
          aria-label="Close ID fallback"
        >
          <Check className="size-3" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <details className="relative inline-block text-left">
      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center justify-center rounded-[var(--admin-radius-control)] px-2.5 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 md:min-h-0 md:py-1 [&::-webkit-details-marker]:hidden">
        <MoreHorizontal className="size-3.5" aria-hidden="true" />
        <span className="sr-only">More actions</span>
      </summary>
      <div className="absolute right-0 z-30 mt-1.5 grid min-w-44 gap-0.5 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-1.5 shadow-[var(--admin-shadow-overlay)] print:hidden">
        <button
          type="button"
          onClick={() => copy("event", eventId, "Copied event ID")}
          className="flex min-h-9 w-full items-center gap-2 rounded-[var(--admin-radius-control)] px-3 text-left text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          <Copy className="size-3.5" aria-hidden="true" />
          Copy event ID
        </button>
        {targetId ? (
          <button
            type="button"
            onClick={() => copy("target", targetId, "Copied target ID")}
            className="flex min-h-9 w-full items-center gap-2 rounded-[var(--admin-radius-control)] px-3 text-left text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <Copy className="size-3.5" aria-hidden="true" />
            Copy target ID
          </button>
        ) : null}
      </div>
    </details>
  );
}
