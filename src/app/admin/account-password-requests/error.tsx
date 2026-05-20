"use client";

import { useEffect } from "react";
import { RefreshCw, XCircle } from "lucide-react";

// D6 — row-load error surface for `/admin/account-password-requests`.
// Brief §6 calls for an inline Cancelled-family `role="alert"` region that says
// "Couldn't load requests. Try refreshing." with a Ghost retry button. The FAKE
// seed never throws today, so this boundary won't render during Phase 6; it ships
// the surface so the moment a real Supabase query fails post-BUILD plan landing,
// the reviewer sees an actionable error instead of a Next.js fallback page.

export default function AccountPasswordRequestsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[account-password-requests] route error", error);
    }
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[68rem] space-y-5 sm:space-y-6">
      <h1 className="font-display text-[clamp(1.778rem,2.5vw,2.369rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--admin-heading)]">
        Password-reset requests
      </h1>

      <div
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className="flex flex-col gap-3 rounded-[var(--admin-radius-card)] bg-[oklch(95.5%_0.028_20)] px-4 py-4 text-sm leading-6 text-[oklch(26%_0.14_25)] sm:flex-row sm:items-start sm:gap-4"
      >
        <XCircle className="size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Couldn&apos;t load requests.</p>
          <p className="mt-0.5 text-[oklch(26%_0.14_25)]/85">
            Try refreshing the page. If this keeps happening, contact the owner.
          </p>
        </div>
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 self-start rounded-[var(--admin-radius-control)] border border-[oklch(26%_0.14_25)]/40 bg-transparent px-3 text-sm font-semibold text-[oklch(26%_0.14_25)] outline-none transition-colors hover:bg-[oklch(95.5%_0.028_20)]/60 focus-visible:ring-[3px] focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-panel)]"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Try again
        </button>
      </div>
    </div>
  );
}
