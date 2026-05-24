// B-3 — server component. Greeting / period chips / View-in-Reports rail.
// Mode-aware (self vs manager) per brief §5.1 + G5 (inactive historical pill).
// Period chip URL-driven via Link hrefs computed by the caller; aria-current
// on the active chip per SHARED-NOTES §3.

import Link from "next/link";
import { Activity } from "lucide-react";
import type { StaffProfile } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";
import { getGreeting, getFirstName } from "@/app/admin/dashboard/TherapistDashboard";

export interface RangeChip {
  key: string;
  label: string;
  href: string;
  active: boolean;
}

interface PerformanceHeaderProps {
  profile: StaffProfile;
  viewer: StaffProfile;
  mode: "self" | "manager";
  rangeChips: RangeChip[];
  rangeWindowLabel: string;
  // G5 — when set, the manager-view header shows a discreet "Inactive since"
  // pill. The page resolves this from the target's staff_profiles.active +
  // any deactivation audit metadata available.
  inactiveSinceLabel?: string;
  // Caller passes a URL when the viewer should see the "View in Reports →"
  // ghost link (Reports does its own RBAC gate; this gate keeps the link
  // out of view for roles who'd hit AdminAccessDenied on click).
  viewInReportsHref?: string;
}

const FULL_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/London",
});

export function PerformanceHeader({
  profile,
  viewer,
  mode,
  rangeChips,
  rangeWindowLabel,
  inactiveSinceLabel,
  viewInReportsHref,
}: PerformanceHeaderProps) {
  const todayLabel = FULL_DATE_FORMAT.format(new Date());
  const roleLabel = profile.role_name;
  const heading =
    mode === "self"
      ? `${getGreeting()}, ${getFirstName(profile.name)}.`
      : `Performance — ${profile.name}`;
  const headingClass =
    mode === "self"
      ? "font-display text-3xl font-semibold tracking-tight text-[var(--admin-heading)] sm:text-4xl"
      : "font-display text-2xl font-semibold tracking-tight text-[var(--admin-heading)] sm:text-3xl";

  // Suppress the unused-viewer lint when no manager-only sub-line uses it —
  // viewer is part of the public API (lets callers pass the resolved profile
  // without conditional plumbing) and downstream phases may consume it.
  void viewer;

  return (
    <header className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className={headingClass}>{heading}</h1>
          <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
            {todayLabel} <span aria-hidden="true">·</span> {mode === "manager" ? `Reviewing ${roleLabel}` : roleLabel}
            {inactiveSinceLabel ? (
              <>
                {" "}
                <span aria-hidden="true">·</span>{" "}
                <span className="inline-flex items-center rounded-full bg-[oklch(94%_0.008_280)] px-2 py-0.5 text-xs font-medium text-[oklch(30%_0.02_280)]">
                  Inactive since {inactiveSinceLabel}
                </span>
              </>
            ) : null}
          </p>
        </div>
        {viewInReportsHref ? (
          <Link
            href={viewInReportsHref}
            className="hidden items-center gap-1 self-start rounded-[var(--admin-radius-control)] px-3 py-1.5 text-sm font-medium text-[var(--admin-link)] hover:bg-[var(--admin-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 sm:inline-flex"
          >
            <Activity aria-hidden="true" className="size-4" />
            View in Reports
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>

      <nav
        aria-label="Period"
        className="mt-5 flex flex-wrap items-center gap-2"
      >
        <span className="sr-only" id="period-chip-label">Period</span>
        {rangeChips.map((chip) => (
          <Link
            key={chip.key}
            href={chip.href}
            aria-current={chip.active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2",
              chip.active
                ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                : "border border-[var(--admin-border)] bg-transparent text-[var(--admin-body)] hover:bg-[var(--admin-canvas)]"
            )}
          >
            {chip.label}
          </Link>
        ))}
        <span className="ml-2 text-xs text-[var(--admin-text-muted)] tabular-nums">
          {rangeWindowLabel}
        </span>
      </nav>
    </header>
  );
}

// Skeleton fallback — not used inside Suspense (header has no I/O) but
// exported for symmetric naming with the other section primitives.
export function PerformanceHeaderSkeleton() {
  return (
    <header className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-6">
      <div className="h-9 w-2/3 animate-[shimmer_1.6s_ease-in-out_infinite] rounded bg-[var(--admin-skeleton-bg)]" />
      <div className="mt-2 h-4 w-1/3 animate-[shimmer_1.6s_ease-in-out_infinite] rounded bg-[var(--admin-skeleton-bg)]" />
      <div className="mt-5 flex gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-8 w-20 animate-[shimmer_1.6s_ease-in-out_infinite] rounded-full bg-[var(--admin-skeleton-bg)]"
          />
        ))}
      </div>
    </header>
  );
}
