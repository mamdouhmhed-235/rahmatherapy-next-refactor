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
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canManageSensitiveClientNotes,
  canViewClientContactDetails,
  getStaffProfile,
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/rbac";
import { formatDateTime } from "../clients/format";
import { PrivacyStatusForm } from "./PrivacyStatusForm";
import { PrivacyFilterBar, type PrivacyFilterValues } from "./PrivacyFilterBar";
import { PrivacyRequestNote } from "./PrivacyRequestNote";
import { CopyIdButton } from "./CopyIdButton";

export const metadata = {
  title: "Privacy operations - Rahma Therapy Admin",
};

interface PrivacyRequestRecord {
  id: string;
  client_id: string;
  request_type: string;
  status: string;
  request_note: string | null;
  created_at: string;
  updated_at: string;
  created_by_staff_id: string | null;
}

interface ClientSummary {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

interface SensitiveNoteRecord {
  id: string;
  client_id: string;
  note: string;
  created_at: string;
  author_staff_id: string | null;
}

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

  const adminClient = createSupabaseAdminClient();
  const requestsResult = canManagePrivacyOperations
    ? await adminClient
        .from("client_privacy_requests")
        .select(
          "id, client_id, request_type, status, request_note, created_at, updated_at, created_by_staff_id"
        )
        .order("created_at", { ascending: false })
        .returns<PrivacyRequestRecord[]>()
    : { data: [] as PrivacyRequestRecord[], error: null };
  const notesResult = canViewSensitiveNotes
    ? await adminClient
        .from("client_notes")
        .select("id, client_id, note, created_at, author_staff_id")
        .eq("is_sensitive", true)
        .order("created_at", { ascending: false })
        .limit(25)
        .returns<SensitiveNoteRecord[]>()
    : { data: [] as SensitiveNoteRecord[], error: null };

  // Layer-3 error gate (brief §6): if the queue query failed for an operator who
  // depends on it, surface the brief's specified copy in a Cancelled-family
  // role="alert" region. Rail-only callers still proceed if only the queue errored.
  const queueLoadFailed =
    canManagePrivacyOperations && "error" in requestsResult && requestsResult.error != null;

  const requests = requestsResult.data ?? [];
  const notes = notesResult.data ?? [];
  const clientIds = Array.from(
    new Set([
      ...requests.map((request) => request.client_id),
      ...notes.map((note) => note.client_id),
    ])
  );
  const { data: clients } =
    clientIds.length > 0
      ? await adminClient
          .from("clients")
          .select(canViewContactDetails ? "id, full_name, email, phone" : "id, full_name")
          .in("id", clientIds)
          .returns<ClientSummary[]>()
      : { data: [] as ClientSummary[] };
  const clientById = new Map((clients ?? []).map((client) => [client.id, client]));

  // Authorship lookup: resolve created_by_staff_id to a display name so the
  // request note can show "from customer email" vs "transcribed by Aisha".
  const staffIds = Array.from(
    new Set(
      requests
        .map((request) => request.created_by_staff_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const { data: staffProfiles } =
    staffIds.length > 0
      ? await adminClient
          .from("staff_profiles")
          .select("id, full_name")
          .in("id", staffIds)
          .returns<{ id: string; full_name: string }[]>()
      : { data: [] as { id: string; full_name: string }[] };
  const staffNameById = new Map(
    (staffProfiles ?? []).map((staff) => [staff.id, staff.full_name])
  );

  // ─── Group requests by status ──────────────────────────────────────────────
  const requestsByStatus = new Map<string, PrivacyRequestRecord[]>();
  for (const panel of STATUS_PANELS) {
    requestsByStatus.set(panel.value, []);
  }
  for (const request of requests) {
    const bucket = requestsByStatus.get(request.status);
    if (bucket) bucket.push(request);
  }

  // ─── Stat-strip computations ───────────────────────────────────────────────
  const openRequests = [
    ...(requestsByStatus.get("open") ?? []),
    ...(requestsByStatus.get("reviewing") ?? []),
  ];
  const oldestOpen = [...openRequests].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )[0];
  const oldestOpenDays = oldestOpen ? daysSince(oldestOpen.created_at) : 0;

  const monthStart = startOfThisMonth();
  const notesReviewedThisMonth = notes.filter(
    (note) => new Date(note.created_at) >= monthStart
  ).length;

  // ─── Filter strip initial values ───────────────────────────────────────────
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

  // ─── Stat-tile filter href builders (FAKE — server ignores until BUILD plan) ──
  const openHref = "/admin/privacy?status=open,reviewing";
  const oldestHref = "/admin/privacy?status=open&sort=created_at_asc";

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
            aria-label={`Open requests: ${openRequests.length}. Filter to open requests.`}
            title="Filter to open requests"
            className="group block rounded-[var(--admin-radius-card)] outline-none transition-shadow duration-200 ease-out hover:shadow-md focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <AdminStat
              label="Open requests"
              value={openRequests.length}
              note="Received + Reviewing"
              icon={Inbox}
              numeral
              tone={openRequests.length > 0 ? "warning" : "default"}
            />
          </Link>
          <div className="grid gap-2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 sm:p-5">
            <Link
              href={oldestHref}
              aria-label={
                oldestOpen
                  ? `Awaiting longest: ${oldestOpenDays} days. Open the oldest queue.`
                  : "Awaiting longest: nothing open right now."
              }
              title={
                oldestOpen
                  ? `Oldest open request: ${oldestOpen.id.slice(0, 8)} from ${clientById.get(oldestOpen.client_id)?.full_name ?? "Unknown client"}`
                  : undefined
              }
              className="group flex min-h-11 items-center justify-between gap-3 rounded-[var(--admin-radius-control)] px-2 py-1.5 -mx-2 outline-none transition-colors duration-200 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Clock
                  className={
                    oldestOpen && oldestOpenDays > 14
                      ? "size-4 shrink-0 text-[oklch(26%_0.14_25)]"
                      : oldestOpen
                        ? "size-4 shrink-0 text-[oklch(26%_0.13_55)]"
                        : "size-4 shrink-0 text-[var(--admin-primary)]"
                  }
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-[var(--admin-text-muted)]">
                    Awaiting longest
                  </span>
                  <span className="block text-sm font-semibold text-[var(--admin-heading)]">
                    {oldestOpen ? (
                      <>
                        {oldestOpenDays}d ·{" "}
                        <span className="font-medium text-[var(--admin-body)]">
                          {clientById.get(oldestOpen.client_id)?.full_name ?? "Unknown client"}
                        </span>
                      </>
                    ) : (
                      <span className="text-[oklch(22%_0.085_155)]">All caught up</span>
                    )}
                  </span>
                </span>
              </span>
              {oldestOpen ? (
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

      {/* Filter strip — preserved URL contract; backend FAKE per BUILD-privacy-filter-query.md */}
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
                className="rounded-[var(--admin-radius-card)] border border-[oklch(88%_0.045_20)] bg-[oklch(95.5%_0.028_20)] p-6"
              >
                <h2 className="font-display text-base font-semibold text-[oklch(26%_0.14_25)]">
                  Couldn&apos;t load privacy requests
                </h2>
                <p className="mt-1 text-sm leading-6 text-[oklch(26%_0.14_25)]/85">
                  Try refreshing.
                </p>
                <Link
                  href="/admin/privacy"
                  className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[oklch(88%_0.045_20)] bg-transparent px-3.5 text-sm font-semibold text-[oklch(26%_0.14_25)] outline-none transition-colors hover:bg-[oklch(95.5%_0.028_20)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  Try again
                </Link>
              </div>
            ) : queueEmpty ? (
              <div
                data-redesign-needs-photo="privacy-empty.svg"
                className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] py-2"
              >
                <EmptyState
                  icon={ShieldCheck}
                  title="No privacy requests yet"
                  message="Create one from a client detail page when a customer asks for export, correction, deletion review, or sensitive-note review."
                />
              </div>
            ) : (
              STATUS_PANELS.map((panel) => {
                const panelRequests = requestsByStatus.get(panel.value) ?? [];
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
                    className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] transition-shadow duration-200 ease-out hover:shadow-[0_2px_8px_oklch(23%_0.073_155_/_0.06)]"
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
                            <span className="font-medium text-[var(--admin-body)]">
                              {panel.emptyHeading}.
                            </span>
                            {panel.emptyBody ? ` ${panel.emptyBody}` : ""}
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
          </div>
        ) : null}

        {/* ── Right rail: sensitive-note review ── */}
        {showRail ? (
          <aside className="min-w-0">
            {/* Desktop: sticky panel — cap height + scroll within so a 25-row rail never leaks past viewport */}
            <div className="hidden xl:sticky xl:top-4 xl:block xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
              <SensitiveNotesPanel notes={notes} clientById={clientById} />
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
                    ({notes.length})
                  </span>
                </span>
                <ChevronDown className="size-4 text-[var(--admin-text-muted)]" aria-hidden="true" />
              </summary>
              <div className="mt-2">
                <SensitiveNotesPanel notes={notes} clientById={clientById} />
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
}: {
  notes: SensitiveNoteRecord[];
  clientById: Map<string, ClientSummary>;
}) {
  return (
    <AdminPanel
      title="Sensitive notes"
      description="These notes don't enter exports or operational logs. Open the client to edit."
      badge={
        <AdminStatusBadge
          value={`Last ${notes.length}`}
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
    </AdminPanel>
  );
}
