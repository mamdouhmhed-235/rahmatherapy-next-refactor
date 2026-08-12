import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronDown,
  Clock,
  Inbox,
  ShieldCheck,
  StickyNote,
} from "lucide-react";
import {
  AdminAccessDenied,
  AdminPageHeader,
  AdminPanel,
  AdminStat,
  AdminStatusBadge,
} from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  countPrivacyRequests,
  countSensitiveNotes,
  getOldestOpenPrivacyRequest,
  getPrivacyRequestsPage,
  PRIVACY_NOTES_LIMIT,
  PRIVACY_NOTES_VIEW_ALL_CAP,
  type PrivacyClientSummary,
  type PrivacyQueueFilters,
  type PrivacyRequestRecord as PrivacyRequestRow,
  type PrivacySensitiveNote,
} from "./privacy-data";
import {
  canManageSensitiveClientNotes,
  canViewClientContactDetails,
  getStaffProfile,
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/rbac";
import { LIST_PAGE_SIZE } from "@/lib/pagination";
import { PaginationBar } from "../components/PaginationBar";
import { formatDateTime } from "../clients/format";
import { PrivacyStatusForm } from "./PrivacyStatusForm";
import { PrivacyFilterBar, type PrivacyFilterValues } from "./PrivacyFilterBar";
import { PrivacyRequestNote } from "./PrivacyRequestNote";
import { CopyIdButton } from "./CopyIdButton";

export const metadata = {
  title: "Privacy operations - Rahma Therapy Admin",
};

// Row shapes moved to privacy-data.ts with the fetch (C-09 Phase C Step 5);
// re-aliased here so the sub-components below keep their original names.
type PrivacyRequestRecord = PrivacyRequestRow;
type ClientSummary = PrivacyClientSummary;
type SensitiveNoteRecord = PrivacySensitiveNote;

const STATUS_PANELS: {
  value: string;
  label: string;
  tone: "warning" | "info" | "success" | "danger";
  emptyHeading: string;
  emptyBody: string | null;
  defaultOpen: boolean;
}[] = [
  {
    value: "open",
    label: "Received",
    tone: "warning",
    emptyHeading: "No received requests",
    emptyBody: "New customer requests appear here.",
    defaultOpen: true,
  },
  {
    value: "reviewing",
    label: "Reviewing",
    tone: "info",
    emptyHeading: "No requests being reviewed",
    emptyBody: null,
    defaultOpen: true,
  },
  {
    value: "completed",
    label: "Completed",
    tone: "success",
    emptyHeading: "No completed requests yet",
    emptyBody: null,
    defaultOpen: false,
  },
  {
    value: "declined",
    label: "Declined",
    tone: "danger",
    emptyHeading: "No declined requests",
    emptyBody: null,
    defaultOpen: false,
  },
];

const REQUEST_TYPE_OPTIONS = [
  { value: "data_export", label: "Data export" },
  { value: "correction", label: "Correction" },
  { value: "deletion_review", label: "Deletion review" },
  { value: "sensitive_note_review", label: "Sensitive note review" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Received" },
  { value: "reviewing", label: "Reviewing" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
];

const REQUEST_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  REQUEST_TYPE_OPTIONS.map((option) => [option.value, option.label])
);

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function readMultiParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
  allowed: string[]
): string[] {
  const raw = readParam(params, key);
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => allowed.includes(value));
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return Array.from(parts[0]).slice(0, 2).join("").toUpperCase();
  }
  const first = Array.from(parts[0])[0] ?? "";
  const last = Array.from(parts[parts.length - 1])[0] ?? "";
  return (first + last).toUpperCase();
}

function avatarTint(seed: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    bg: `oklch(88% 0.025 ${hue})`,
    text: `oklch(26% 0.04 ${hue})`,
  };
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const minutes = Math.floor(ms / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  return `${Math.floor(months / 12)} yr ago`;
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function startOfThisMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Resolves the filter strip's range preset (or a custom from/to pair) to
 * concrete ISO bounds, matching `PrivacyFilterBar`'s `RANGE_PRESETS` keys.
 * Computed here, outside the cache boundary, and passed into the cache key —
 * same pattern as emails-data.ts's `resolveDeliveryDateBounds` — so "today"
 * never freezes for the 60s revalidate window.
 */
export function resolvePrivacyDateBounds(
  range: string,
  from: string,
  to: string
): { fromIso?: string; toIso?: string } {
  const now = new Date();
  if (range === "custom") {
    // Raw, unvalidated URL params — validate before converting. A malformed
    // value silently falls back to "no bound" (same as no filter) rather than
    // throwing RangeError out of `.toISOString()` and 500ing the page.
    const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : NaN;
    const toMs = to ? new Date(`${to}T23:59:59`).getTime() : NaN;
    return {
      fromIso: Number.isNaN(fromMs) ? undefined : new Date(fromMs).toISOString(),
      toIso: Number.isNaN(toMs) ? undefined : new Date(toMs).toISOString(),
    };
  }
  if (range === "today") {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { fromIso: startOfDay.toISOString() };
  }
  if (range === "this_week") {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monday = new Date(startOfDay);
    monday.setDate(startOfDay.getDate() - ((startOfDay.getDay() + 6) % 7));
    return { fromIso: monday.toISOString() };
  }
  if (range === "this_month") {
    return { fromIso: startOfThisMonth().toISOString() };
  }
  return {};
}

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const expandAll = readParam(params, "expand") === "all";

  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  const canManagePrivacyOperations = hasPermission(
    profile,
    PERMISSIONS.MANAGE_PRIVACY_OPERATIONS
  );
  const canViewSensitiveNotes = canManageSensitiveClientNotes(profile);
  const canViewContactDetails = canViewClientContactDetails(profile);

  if (!canManagePrivacyOperations && !canViewSensitiveNotes) {
    return (
      <AdminAccessDenied
        title="Privacy operations restricted"
        message="Customer privacy requests and sensitive-note review are restricted to staff with explicit privacy authority. Ask the owner if you need access."
      />
    );
  }

  // ─── Filter strip initial values ───────────────────────────────────────────
  // 5-step filter audit (brief §2.4): (1) URL parsed here; (2) passed into
  // getPrivacyPageData's `filters` below; (3) applied server-side in
  // privacy-data.ts (.in/.gte/.lte/.ilike); (4) filter UI defaults from these
  // same URL-derived values (PrivacyFilterBar's initialValues); (5)
  // empty-state copy distinguishes "no results for these filters" from "no
  // requests yet" (queueEmpty / per-panel copy below).
  const initialFilterValues: PrivacyFilterValues = {
    request_type: readMultiParam(
      params,
      "request_type",
      REQUEST_TYPE_OPTIONS.map((o) => o.value)
    ),
    status: readMultiParam(
      params,
      "status",
      STATUS_OPTIONS.map((o) => o.value)
    ),
    range: readParam(params, "range"),
    from: readParam(params, "from"),
    to: readParam(params, "to"),
    q: readParam(params, "q"),
  };

  const dateBounds = resolvePrivacyDateBounds(
    initialFilterValues.range,
    initialFilterValues.from,
    initialFilterValues.to
  );
  const queueFilters: PrivacyQueueFilters = {
    // Sorted so two URLs differing only in list order share a cache entry.
    requestTypes: initialFilterValues.request_type.length
      ? [...initialFilterValues.request_type].sort()
      : undefined,
    statuses: initialFilterValues.status.length
      ? [...initialFilterValues.status].sort()
      : undefined,
    fromDate: dateBounds.fromIso,
    toDate: dateBounds.toIso,
    q: initialFilterValues.q.trim() || undefined,
  };
  const hasActiveFilters = Boolean(
    queueFilters.requestTypes ||
      queueFilters.statuses ||
      queueFilters.fromDate ||
      queueFilters.toDate ||
      queueFilters.q
  );
  // C-16 Phase D Step 10 — ONE resolution feeds both the count query below
  // and the rows query, so the pager's total can never describe a different
  // WHERE clause than the queue it's paginating (same discipline Phase C
  // used for bookings). `undefined` when no filter is active — matches
  // `getPrivacyPageData`'s own "no filters" cache entry exactly.
  const filtersForQueue: PrivacyQueueFilters | undefined = hasActiveFilters
    ? queueFilters
    : undefined;

  const notesViewAll = readParam(params, "notes") === "all";

  // C-16 Phase D Step 10 — the request queue previously carried NO bound at
  // all (no `.limit()`, no `.range()`); `getPrivacyRequestsPage` (privacy-
  // data.ts) resolves the total and clamps `?page=` against it, then fetches
  // exactly that window — replacing the old base/filteredResult double read
  // (the "unfiltered call" WAS the unbounded query). Covers this page's
  // queue rows, the sensitive-notes rail, and the clients/staff lookups both
  // need.
  const { data: pagedResult, total, page, pageCount } = await getPrivacyRequestsPage({
    canManagePrivacyOperations,
    canViewSensitiveNotes,
    canViewContactDetails,
    filters: filtersForQueue,
    notesViewAll,
    page: readParam(params, "page"),
  });

  const requests = pagedResult.requests;
  const queueLoadFailed = pagedResult.queueLoadFailed;
  const { notes, clients, staff: staffProfiles } = pagedResult;
  const notesTotal = canViewSensitiveNotes ? await countSensitiveNotes() : 0;

  // Maps rebuilt on THIS side of the cache boundary — privacy-data.ts returns
  // plain arrays because a Map would come back as {} (SHARED-NOTES §15).
  const clientById = new Map(clients.map((client) => [client.id, client]));

  // Authorship lookup: resolve created_by_staff_id to a display name so the
  // request note can show "from customer email" vs "transcribed by Aisha".
  const staffNameById = new Map(
    staffProfiles.map((staff) => [staff.id, staff.full_name])
  );

  // ─── Group requests by status (this page of the possibly-filtered queue) ──
  const requestsByStatus = new Map<string, PrivacyRequestRecord[]>();
  for (const panel of STATUS_PANELS) {
    requestsByStatus.set(panel.value, []);
  }
  for (const request of requests) {
    const bucket = requestsByStatus.get(request.status);
    if (bucket) bucket.push(request);
  }

  // ─── Stat-strip computations ───────────────────────────────────────────────
  // C-16 Phase D Step 10 — these used to reduce over an unfiltered, unbounded
  // fetch of the WHOLE table (the exact "never carried any bound" defect this
  // step removes). "Open requests" is a backlog-sized count and "oldest open"
  // a 1-row read — both independent of whatever filter/page is active, same
  // as before.
  const openRequestsCount = canManagePrivacyOperations
    ? await countPrivacyRequests({ statuses: ["open", "reviewing"] })
    : 0;
  const oldestOpenRequest = await getOldestOpenPrivacyRequest(
    canManagePrivacyOperations
  );
  const oldestOpenDays = oldestOpenRequest ? daysSince(oldestOpenRequest.createdAt) : 0;

  const monthStart = startOfThisMonth();
  const notesReviewedThisMonth = notes.filter(
    (note) => new Date(note.created_at) >= monthStart
  ).length;

  // Stat-tile shortcuts — always jump to the GLOBAL open/oldest queue,
  // independent of whatever filter is currently applied.
  const openHref = "/admin/privacy?status=open,reviewing";
  const oldestHref = "/admin/privacy?status=open&sort=created_at_asc";

  // C-16 Phase D Step 10 — page navigation keeps every other query param;
  // `page` is the only one it rewrites. PrivacyFilterBar's own URL builder
  // (`buildHref`) never sets `page`, so every filter change drops it at its
  // own source and the window resets when the result set changes (same
  // discipline as bookings' Step 7 / emails' Step 9).
  const queueRetryParams = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (key === "page") continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string" && value.length > 0) queueRetryParams.set(key, value);
  }
  const makeQueuePageHref = (nextPage: number) => {
    const p = new URLSearchParams(queueRetryParams);
    p.set("page", String(nextPage));
    return `/admin/privacy?${p.toString()}`;
  };

  // Sensitive-notes rail cap+view-all toggle (C-16 Step 10) — preserves every
  // other param, only adds/removes `notes=all`.
  const notesAllHref = (() => {
    const p = new URLSearchParams(queueRetryParams);
    p.set("notes", "all");
    return `/admin/privacy?${p.toString()}`;
  })();
  const notesRecentHref = (() => {
    const p = new URLSearchParams(queueRetryParams);
    p.delete("notes");
    const qs = p.toString();
    return qs ? `/admin/privacy?${qs}` : "/admin/privacy";
  })();

  // Right rail visibility: hide when caller has no sensitive-note permission.
  const showRail = canViewSensitiveNotes;
  const showQueue = canManagePrivacyOperations;

  // Page-level empty condition (queue side only).
  const queueEmpty = showQueue && requests.length === 0;

  const headerDescription = !showQueue
    ? "Recent sensitive client notes for review. Open the client to edit."
    : "Track export, correction, deletion review, and sensitive-note review. Every status change is audit logged.";

  return (
    <div className="pb-24 sm:pb-0">
      <AdminPageHeader
        eyebrow="Privacy"
        title="Privacy operations"
        description={headerDescription}
      />

      {/* Stat strip — varied composition: one anchor numeral tile (Open requests)
          and a context column (oldest open + sensitive notes summary). Avoids the
          three-up identical-card "hero-metric template" silhouette. */}
      {showQueue ? (
        <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <Link
            href={openHref}
            aria-label={`Open requests: ${openRequestsCount}. Filter to open requests.`}
            title="Filter to open requests"
            className="group block rounded-[var(--admin-radius-card)] outline-none transition-shadow duration-200 ease-out hover:shadow-md focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <AdminStat
              label="Open requests"
              value={openRequestsCount}
              note="Received + Reviewing"
              icon={Inbox}
              numeral
              tone={openRequestsCount > 0 ? "warning" : "default"}
            />
          </Link>
          <div className="grid gap-2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 sm:p-5">
            <Link
              href={oldestHref}
              aria-label={
                oldestOpenRequest
                  ? `Awaiting longest: ${oldestOpenDays} days. Open the oldest queue.`
                  : "Awaiting longest: nothing open right now."
              }
              title={
                oldestOpenRequest
                  ? `Oldest open request: ${oldestOpenRequest.id.slice(0, 8)} from ${oldestOpenRequest.clientName ?? "Unknown client"}`
                  : undefined
              }
              className="group flex min-h-11 items-center justify-between gap-3 rounded-[var(--admin-radius-control)] px-2 py-1.5 -mx-2 outline-none transition-colors duration-200 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Clock
                  className={
                    oldestOpenRequest && oldestOpenDays > 14
                      ? "size-4 shrink-0 text-[var(--admin-status-cancelled-text)]"
                      : oldestOpenRequest
                        ? "size-4 shrink-0 text-[var(--admin-status-attention-text)]"
                        : "size-4 shrink-0 text-[var(--admin-primary)]"
                  }
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-[var(--admin-text-muted)]">
                    Awaiting longest
                  </span>
                  <span className="block text-sm font-semibold text-[var(--admin-heading)]">
                    {oldestOpenRequest ? (
                      <>
                        {oldestOpenDays}d ·{" "}
                        <span className="font-medium text-[var(--admin-body)]">
                          {oldestOpenRequest.clientName ?? "Unknown client"}
                        </span>
                      </>
                    ) : (
                      <span className="text-[var(--admin-status-confirmed-text)]">All caught up</span>
                    )}
                  </span>
                </span>
              </span>
              {oldestOpenRequest ? (
                <span
                  aria-hidden="true"
                  className="shrink-0 text-xs font-medium text-[var(--admin-primary)] opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100"
                >
                  →
                </span>
              ) : null}
            </Link>
            {canViewSensitiveNotes ? (
              <div className="flex min-h-11 items-center gap-2.5 border-t border-[var(--admin-border)] px-0 pt-2.5">
                <StickyNote
                  className="size-4 shrink-0 text-[var(--admin-text-muted)]"
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-[var(--admin-text-muted)]">
                    Sensitive notes this month
                  </span>
                  <span className="block text-sm font-semibold text-[var(--admin-heading)]">
                    {notesReviewedThisMonth} reviewed
                    <span className="ml-1 font-normal text-[var(--admin-text-muted)]">
                      (last 25 always visible)
                    </span>
                  </span>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Filter strip — server-side query wiring per C-09 Phase D Step 12 */}
      {showQueue ? (
        <PrivacyFilterBar
          initialValues={initialFilterValues}
          requestTypeOptions={REQUEST_TYPE_OPTIONS}
          statusOptions={STATUS_OPTIONS}
        />
      ) : null}

      <div
        className={
          showQueue && showRail
            ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"
            : "grid gap-6"
        }
      >
        {/* ── Primary: status-grouped request queue ── */}
        {showQueue ? (
          <div className="grid gap-4">
            {queueLoadFailed ? (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-[var(--admin-radius-card)] border border-[var(--admin-status-cancelled-border)] bg-[var(--admin-status-cancelled-bg)] p-6"
              >
                <h2 className="font-display text-base font-semibold text-[var(--admin-status-cancelled-text)]">
                  Couldn&apos;t load privacy requests
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--admin-status-cancelled-text)]/85">
                  Try refreshing.
                </p>
                <Link
                  href="/admin/privacy"
                  className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-status-cancelled-border)] bg-transparent px-3.5 text-sm font-semibold text-[var(--admin-status-cancelled-text)] outline-none transition-colors hover:bg-[var(--admin-status-cancelled-bg)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  Try again
                </Link>
              </div>
            ) : queueEmpty ? (
              <div
                data-redesign-needs-photo="privacy-empty.svg"
                className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] py-2"
              >
                {hasActiveFilters ? (
                  <EmptyState
                    icon={ShieldCheck}
                    title="No privacy requests match your filters"
                    message="Try adjusting or clearing your filters."
                    action={{ label: "Clear filters", href: "/admin/privacy" }}
                  />
                ) : (
                  <EmptyState
                    icon={ShieldCheck}
                    title="No privacy requests yet"
                    message="Create one from a client detail page when a customer asks for export, correction, deletion review, or sensitive-note review."
                  />
                )}
              </div>
            ) : (
              STATUS_PANELS.map((panel) => {
                const panelRequests = requestsByStatus.get(panel.value) ?? [];
                // A status filter can legitimately hide a panel's real
                // requests (they weren't fetched, not "there are none") —
                // that reads differently from "genuinely zero", so the
                // per-panel empty copy distinguishes the two below.
                const hiddenByStatusFilter =
                  Boolean(queueFilters.statuses) &&
                  !queueFilters.statuses!.includes(panel.value);
                const isOpen = expandAll || panel.defaultOpen || panelRequests.length === 0;
                const countBadge = (
                  <AdminStatusBadge
                    value={`${panelRequests.length}`}
                    tone={panelRequests.length > 0 ? panel.tone : "muted"}
                  />
                );
                return (
                  <section
                    key={panel.value}
                    aria-labelledby={`privacy-panel-${panel.value}`}
                    className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] transition-shadow duration-200 ease-out hover:shadow-[0_2px_8px_var(--admin-shadow-ink-06)]"
                  >
                    <details open={isOpen} className="group">
                      <summary
                        id={`privacy-panel-${panel.value}`}
                        className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-t-[var(--admin-radius-card)] px-4 py-3 outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 sm:px-5 [&::-webkit-details-marker]:hidden"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <ChevronDown
                            className="size-4 shrink-0 text-[var(--admin-text-muted)] transition-transform duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-open:rotate-0 -rotate-90"
                            aria-hidden="true"
                          />
                          <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)]">
                            {panel.label}
                          </h2>
                          {countBadge}
                        </span>
                        {panelRequests.length === 0 ? null : (
                          <span className="text-xs font-medium text-[var(--admin-text-muted)]">
                            <span className="group-open:hidden">
                              Show {panelRequests.length}
                            </span>
                            <span className="hidden group-open:inline">
                              Hide {panelRequests.length}
                            </span>
                          </span>
                        )}
                      </summary>
                      <div className="border-t border-[var(--admin-border)]">
                        {panelRequests.length === 0 ? (
                          <p className="px-4 py-3 text-sm leading-6 text-[var(--admin-text-muted)] sm:px-5">
                            {hiddenByStatusFilter ? (
                              <>
                                <span className="font-medium text-[var(--admin-body)]">
                                  {panel.label} hidden by your status filter.
                                </span>{" "}
                                <Link
                                  href="/admin/privacy"
                                  className="underline-offset-4 hover:underline"
                                >
                                  Clear filters
                                </Link>{" "}
                                to see these.
                              </>
                            ) : hasActiveFilters ? (
                              <span className="font-medium text-[var(--admin-body)]">
                                No {panel.label.toLowerCase()} requests match your filters.
                              </span>
                            ) : (
                              <>
                                <span className="font-medium text-[var(--admin-body)]">
                                  {panel.emptyHeading}.
                                </span>
                                {panel.emptyBody ? ` ${panel.emptyBody}` : ""}
                              </>
                            )}
                          </p>
                        ) : (
                          <ul
                            className="list-none divide-y divide-[var(--admin-border)] pl-0"
                            role="list"
                          >
                            {panelRequests.map((request) => (
                              <PrivacyRequestRow
                                key={request.id}
                                request={request}
                                client={clientById.get(request.client_id)}
                                authorName={
                                  request.created_by_staff_id
                                    ? staffNameById.get(request.created_by_staff_id)
                                    : undefined
                                }
                                canManagePrivacyOperations={canManagePrivacyOperations}
                                showContactDetails={canViewContactDetails}
                              />
                            ))}
                          </ul>
                        )}
                      </div>
                    </details>
                  </section>
                );
              })
            )}

            {/* C-16 Phase D Step 10 — the request queue previously carried no
                bound at all; renders nothing at one page. */}
            {!queueLoadFailed && !queueEmpty ? (
              <PaginationBar
                page={page}
                pageCount={pageCount}
                total={total}
                pageSize={LIST_PAGE_SIZE}
                makeHref={makeQueuePageHref}
              />
            ) : null}
          </div>
        ) : null}

        {/* ── Right rail: sensitive-note review ── */}
        {showRail ? (
          <aside className="min-w-0">
            {/* Desktop: sticky panel — cap height + scroll within so a 25-row rail never leaks past viewport */}
            <div className="hidden xl:sticky xl:top-4 xl:block xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
              <SensitiveNotesPanel
                notes={notes}
                clientById={clientById}
                notesTotal={notesTotal}
                notesViewAll={notesViewAll}
                notesAllHref={notesAllHref}
                notesRecentHref={notesRecentHref}
              />
            </div>
            {/* Mobile / tablet: collapsed-by-default <details> */}
            <details className="block xl:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3 outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2.5">
                  <StickyNote
                    className="size-4 text-[var(--admin-text-muted)]"
                    aria-hidden="true"
                  />
                  <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)]">
                    Sensitive notes
                  </h2>
                  <span className="text-xs text-[var(--admin-text-muted)]">
                    ({notesTotal})
                  </span>
                </span>
                <ChevronDown className="size-4 text-[var(--admin-text-muted)]" aria-hidden="true" />
              </summary>
              <div className="mt-2">
                <SensitiveNotesPanel
                  notes={notes}
                  clientById={clientById}
                  notesTotal={notesTotal}
                  notesViewAll={notesViewAll}
                  notesAllHref={notesAllHref}
                  notesRecentHref={notesRecentHref}
                />
              </div>
            </details>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

// ─── Per-request row ─────────────────────────────────────────────────────────

function PrivacyRequestRow({
  request,
  client,
  authorName,
  canManagePrivacyOperations,
  showContactDetails,
}: {
  request: PrivacyRequestRecord;
  client?: ClientSummary;
  authorName?: string;
  canManagePrivacyOperations: boolean;
  showContactDetails: boolean;
}) {
  const requestTypeLabel =
    REQUEST_TYPE_LABEL[request.request_type] ??
    request.request_type.replace(/_/g, " ");
  const clientName = client?.full_name ?? "Unknown client";
  const tint = avatarTint(client?.id ?? request.id);

  return (
    <li className="px-4 py-4 sm:px-5 sm:py-5">
      <article>
        <header className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            title={clientName}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            style={{ backgroundColor: tint.bg, color: tint.text }}
          >
            {initials(clientName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span title={`${requestTypeLabel} request`} className="inline-flex">
                <AdminStatusBadge
                  value={requestTypeLabel}
                  tone="restricted"
                  compact
                />
              </span>
              <span
                className="text-xs text-[var(--admin-text-muted)]"
                title={`Received ${formatDateTime(request.created_at)}`}
              >
                {relativeTime(request.created_at)}
              </span>
              <CopyIdButton value={request.id} label="Request ID" />
            </div>
            <h3 className="font-display text-[1.0625rem] font-semibold leading-tight tracking-[-0.01em] text-[var(--admin-heading)]">
              {client ? (
                <Link
                  href={`/admin/clients/${client.id}`}
                  className="rounded-[var(--admin-radius-control)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                  title="Open this client's profile"
                >
                  {client.full_name}
                </Link>
              ) : (
                <span className="text-[var(--admin-text-muted)]">Unknown client</span>
              )}
            </h3>
            {showContactDetails && client && (client.email || client.phone) ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--admin-text-muted)]">
                {client.email ? (
                  <a
                    href={`mailto:${client.email}`}
                    className="rounded-[var(--admin-radius-control)] underline-offset-4 outline-none hover:underline hover:text-[var(--admin-body)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                    title={`Email ${client.full_name}`}
                  >
                    {client.email}
                  </a>
                ) : null}
                {client.email && client.phone ? (
                  <span aria-hidden="true">·</span>
                ) : null}
                {client.phone ? (
                  <a
                    href={`tel:${client.phone.replace(/\s+/g, "")}`}
                    className="rounded-[var(--admin-radius-control)] underline-offset-4 outline-none hover:underline hover:text-[var(--admin-body)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                    title={`Call ${client.full_name}`}
                  >
                    {client.phone}
                  </a>
                ) : null}
              </p>
            ) : null}
          </div>
        </header>

        {request.request_note ? (
          <div className="mt-3">
            <PrivacyRequestNote note={request.request_note} />
            <p className="mt-1.5 text-xs italic text-[var(--admin-text-muted)]">
              {authorName
                ? `Transcribed by ${authorName}.`
                : "From the customer directly."}
            </p>
          </div>
        ) : null}

        <footer className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-xs text-[var(--admin-text-muted)]">
            Created {formatDateTime(request.created_at)}
            {request.updated_at !== request.created_at
              ? ` · Updated ${formatDateTime(request.updated_at)}`
              : ""}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            {client ? (
              <Link
                href={`/admin/clients/${client.id}`}
                className="inline-flex items-center gap-1 rounded-[var(--admin-radius-control)] min-h-12 sm:min-h-9 px-3 py-2 text-xs font-semibold text-[var(--admin-primary)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Open client
                <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>
        </footer>
        {canManagePrivacyOperations ? (
          <details className="group/status mt-3">
            <summary
              className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-[var(--admin-radius-control)] min-h-12 sm:min-h-9 px-3 py-2 text-xs font-semibold text-[var(--admin-primary)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden"
              title="Open the status form for this request"
            >
              <ChevronDown
                className="size-3.5 transition-transform duration-150 ease-out group-open/status:rotate-0 -rotate-90"
                aria-hidden="true"
              />
              Update status
            </summary>
            <div className="mt-2">
              <PrivacyStatusForm
                requestId={request.id}
                requestType={request.request_type}
                status={request.status}
              />
            </div>
          </details>
        ) : null}
      </article>
    </li>
  );
}

// ─── Sensitive-note rail ─────────────────────────────────────────────────────

function SensitiveNotesPanel({
  notes,
  clientById,
  notesTotal,
  notesViewAll,
  notesAllHref,
  notesRecentHref,
}: {
  notes: SensitiveNoteRecord[];
  clientById: Map<string, ClientSummary>;
  /** Real count of sensitive notes clinic-wide (C-16 Step 10) — may exceed `notes.length`. */
  notesTotal: number;
  notesViewAll: boolean;
  notesAllHref: string;
  notesRecentHref: string;
}) {
  // C-16 Phase D Step 10 — cap+view-all verdict: `notes` is capped
  // (PRIVACY_NOTES_LIMIT, or PRIVACY_NOTES_VIEW_ALL_CAP once `notesViewAll`),
  // never a pager. `hasHiddenNotes` is what the badge/link below react to —
  // whether the CURRENT cap is hiding anything at all.
  const hasHiddenNotes = notesTotal > notes.length;
  // Fix round — once already viewing all AND the true total exceeds the
  // view-all cap itself, "View all N" is a lie: clicking it re-navigates to
  // the same `notes=all` state and still only returns PRIVACY_NOTES_VIEW_ALL_CAP
  // rows. Distinguish that boundary so the rail never promises a link that
  // can't deliver — the cap itself is unchanged, only what we say about it.
  const cappedOut = notesViewAll && notesTotal > PRIVACY_NOTES_VIEW_ALL_CAP;
  return (
    <AdminPanel
      title="Sensitive notes"
      description="These notes don't enter exports or operational logs. Open the client to edit."
      badge={
        <AdminStatusBadge
          value={hasHiddenNotes ? `${notes.length} of ${notesTotal}` : `All ${notesTotal}`}
          tone="restricted"
          compact
        />
      }
    >
      {notes.length === 0 ? (
        <p className="text-sm text-[var(--admin-text-muted)]">
          No sensitive notes in the last 25 client records.
        </p>
      ) : (
        <ul className="grid list-none gap-2.5 pl-0" role="list">
          {notes.map((note) => {
            const client = clientById.get(note.client_id);
            return (
              <li
                key={note.id}
                className="rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)]/45 p-3"
              >
                <div className="flex items-start gap-2.5">
                  <StickyNote
                    className="mt-0.5 size-4 shrink-0 text-[var(--admin-text-muted)]"
                    aria-label="Sensitive note — not in exports"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--admin-heading)]">
                      {client ? (
                        <Link
                          href={`/admin/clients/${client.id}`}
                          className="underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                        >
                          {client.full_name}
                        </Link>
                      ) : (
                        "Unknown client"
                      )}
                    </p>
                    <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-[var(--admin-text-muted)]">
                      {note.note}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-[var(--admin-text-muted)]">
                        {formatDateTime(note.created_at)}
                      </span>
                      {client ? (
                        <Link
                          href={`/admin/clients/${client.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                        >
                          Open client
                          <span aria-hidden="true">→</span>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {cappedOut ? (
        <p className="mt-3 border-t border-[var(--admin-border)] pt-3 text-xs text-[var(--admin-text-muted)]">
          Showing the first {PRIVACY_NOTES_VIEW_ALL_CAP} of {notesTotal} sensitive
          notes. The rest aren&rsquo;t reachable from this rail — open individual
          clients to review them.{" "}
          <Link
            href={notesRecentHref}
            className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Show recent {PRIVACY_NOTES_LIMIT} only
          </Link>
        </p>
      ) : hasHiddenNotes ? (
        <p className="mt-3 border-t border-[var(--admin-border)] pt-3 text-xs">
          <Link
            href={notesAllHref}
            className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            View all {notesTotal} sensitive notes
          </Link>
        </p>
      ) : notesViewAll && notesTotal > PRIVACY_NOTES_LIMIT ? (
        <p className="mt-3 border-t border-[var(--admin-border)] pt-3 text-xs">
          <Link
            href={notesRecentHref}
            className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Show recent {PRIVACY_NOTES_LIMIT} only
          </Link>
        </p>
      ) : null}
    </AdminPanel>
  );
}
