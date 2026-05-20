"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

const STORAGE_KEY = "rahma:enquiries:lastFilters";
const TRACKED_PARAMS = [
  "tab",
  "source",
  "assigned_staff",
  "from",
  "to",
  "q",
  "sort",
] as const;

function extractTrackedString(input: string): string {
  const params = new URLSearchParams(input);
  const next = new URLSearchParams();
  for (const key of TRACKED_PARAMS) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  return next.toString();
}

/**
 * Persists the current set of enquiry filter URL params to localStorage so a
 * coordinator returning to /admin/enquiries from another route can resume.
 *
 * Behaviour:
 *  - On mount, if the current URL has at least one tracked param, store the
 *    URL's tracked params under STORAGE_KEY.
 *  - On mount, if the current URL has *no* tracked params but storage holds a
 *    non-empty set, render a Ghost "Resume last filters" link. We deliberately
 *    do not auto-navigate — a coordinator who clicked "Enquiries" to start a
 *    clean view should not be teleported.
 */
export function EnquiryFilterPersistence({ currentParams }: { currentParams: string }) {
  const [resumeHref, setResumeHref] = useState<string | null>(null);
  const tracked = extractTrackedString(currentParams);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (tracked.length > 0) {
        window.localStorage.setItem(STORAGE_KEY, tracked);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setResumeHref(null);
        return;
      }
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const cleaned = stored ? extractTrackedString(stored) : "";
      if (cleaned.length > 0) {
        setResumeHref(`/admin/enquiries?${cleaned}`);
      } else {
        setResumeHref(null);
      }
    } catch {
      // localStorage may be unavailable (Safari private mode, etc.) — fail silent.
      setResumeHref(null);
    }
  }, [tracked]);

  if (!resumeHref) return null;

  return (
    <div className="flex items-center justify-end gap-2 px-1">
      <Link
        href={resumeHref}
        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        <RotateCcw className="size-3.5 shrink-0" aria-hidden="true" />
        Resume last filters
      </Link>
    </div>
  );
}
