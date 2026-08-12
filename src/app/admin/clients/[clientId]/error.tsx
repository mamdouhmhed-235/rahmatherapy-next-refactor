"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ClientDetailErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ClientDetailError({
  error,
  reset,
}: ClientDetailErrorProps) {
  useEffect(() => {
    if (typeof console !== "undefined") {
      console.error("/admin/clients/[id] load failure:", error);
    }
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl py-10">
      <div
        role="alert"
        aria-live="polite"
        className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-6"
      >
        <div className="flex items-start gap-3">
          <span
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--admin-status-attention-bg)] text-[var(--admin-status-attention-text)]"
            aria-hidden="true"
          >
            <AlertCircle className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-semibold text-[var(--admin-heading)]">
              Couldn&apos;t load this client.
            </h1>
            <p className="mt-1 text-sm leading-6 text-[var(--admin-text-muted)]">
              The client record didn&apos;t come back. This is usually temporary. If it keeps happening, contact the owner.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-primary)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/45"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
