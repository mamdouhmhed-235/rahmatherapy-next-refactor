import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { AdminAccessDenied, AdminPageHeader } from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { FileSearch, Inbox, Search as SearchIcon } from "lucide-react";
import { AuditFilterStrip, type ActorOption } from "./AuditFilterStrip";
import { AuditEventCard } from "./AuditEventCard";
import { AuditLoadMoreButton } from "./AuditLoadMoreButton";
import { AuditPageActions } from "./AuditPageActions";
import {
  ACTION_FAMILY_OPTIONS,
  TARGET_TYPE_OPTIONS,
  type ActionFamily,
  type AuditFilterState,
  type DateRangePresetKey,
  dayKey,
  dayLabel,
  describeAction,
} from "./format";
import type { AuditEventRow, AuditFilters } from "./actions";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    actor?: string;
    family?: string;
    target_type?: string;
    range?: string;
    from?: string;
    to?: string;
  }>;
}

export async function generateMetadata({ searchParams: _ }: PageProps): Promise<Metadata> {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  const hasAccess = Boolean(profile?.active && profile.permissions.has(PERMISSIONS.MANAGE_AUDIT_LOGS));
  return {
    title: hasAccess ? "Audit log · Rahma" : "Access denied · Rahma",
  };
}

const SEARCH_MIN_CHARS = 4;
const PAGE_SIZE = 100;

function resolveRange(range: string | undefined): DateRangePresetKey {
  switch (range) {
    case "today":
    case "this_week":
    case "this_month":
    case "custom":
      return range;
    default:
      return "last_30_days";
  }
}

function isActionFamily(value: string | undefined): value is ActionFamily {
  return Boolean(value && ACTION_FAMILY_OPTIONS.some((opt) => opt.key === value));
}

function isTargetType(value: string | undefined): boolean {
  return Boolean(value && TARGET_TYPE_OPTIONS.some((opt) => opt.key === value));
}

export default async function AuditPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");
  if (!profile.permissions.has(PERMISSIONS.MANAGE_AUDIT_LOGS)) {
    return (
      <AdminAccessDenied
        title="You don't have access to this section"
        message="Audit access is restricted to the practice owner. Contact the owner if you think this is a mistake."
      />
    );
  }

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const searchActive = q.length >= SEARCH_MIN_CHARS;
  const filters: AuditFilters = {
    q: searchActive ? q : undefined,
    actor: params.actor || undefined,
    family: isActionFamily(params.family) ? params.family : undefined,
    target_type: isTargetType(params.target_type) ? params.target_type : undefined,
    range: resolveRange(params.range),
    from: params.from || undefined,
    to: params.to || undefined,
  };

  const adminClient = createSupabaseAdminClient();

  // FAKE: BUILD-audit-filter-and-pagination — until the BUILD plan lands, this
  // returns the unfiltered top-100 slice. Client-side, we still filter the rows
  // we have so deep-links surface a degraded but useful preview.
  const [{ data: events, error: eventsError }, { data: staff }] = await Promise.all([
    adminClient
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE)
      .returns<AuditEventRow[]>(),
    adminClient.from("staff_profiles").select("id, name"),
  ]);

  const staffById = new Map<string, string>(
    (staff ?? []).map((member: { id: string; name: string }) => [member.id, member.name])
  );

  const allEvents = events ?? [];
  const filteredEvents = applyClientSideFilter(allEvents, filters);

  const totalKnown = allEvents.length;
  const visibleCount = filteredEvents.length;
  const hasAnyFilter =
    Boolean(filters.q || filters.actor || filters.family || filters.target_type) ||
    (filters.range && filters.range !== "last_30_days");

  // FAKE: BUILD-audit-target-existence — when the BUILD plan lands this becomes
  // a batched lookup. Until then, target existence is unknown (null) and the
  // card renders the "Open target" Ghost optimistically when a target_type is
  // openable; the brief's inline "Target row no longer exists." line falls back
  // when the backend confirms absence.
  const targetExistence: Record<string, boolean> = {};

  const actors: ActorOption[] = Array.from(staffById.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const initialValues = {
    q: q,
    actor: filters.actor ?? "",
    family: filters.family ?? "",
    target_type: filters.target_type ?? "",
    range: filters.range ?? "last_30_days",
    from: filters.from ?? "",
    to: filters.to ?? "",
  };

  const initialCursor =
    allEvents.length === PAGE_SIZE ? allEvents[allEvents.length - 1].created_at : null;

  const staffNamesRecord: Record<string, string> = Object.fromEntries(staffById.entries());

  return (
    <div className="grid gap-5">
      <AdminPageHeader
        title="Audit log"
        description="Read-only record of every administrative action. Sensitive fields are always redacted."
      />

      <AuditFilterStrip actors={actors} initialValues={initialValues} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResultCount
          visibleCount={visibleCount}
          totalKnown={totalKnown}
          searchActive={searchActive}
          searchAttemptedTooShort={q.length > 0 && q.length < SEARCH_MIN_CHARS}
          hasAnyFilter={Boolean(hasAnyFilter)}
        />
        {visibleCount > 0 ? <AuditPageActions /> : null}
      </div>

      {eventsError ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-[var(--admin-radius-card)] border border-[oklch(88%_0.045_20)] bg-[oklch(95.5%_0.028_20)] p-4 text-sm text-[oklch(26%_0.14_25)]"
        >
          <p className="font-semibold">Couldn&apos;t load audit log.</p>
          <p className="mt-1">Try refreshing.</p>
          <a
            href="/admin/audit"
            className="mt-3 inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[oklch(70%_0.10_25)] bg-transparent px-3 text-xs font-semibold text-[oklch(26%_0.14_25)] outline-none transition-colors hover:bg-[oklch(92%_0.045_20)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Try again
          </a>
        </div>
      ) : visibleCount === 0 ? (
        <TimelineEmptyState
          hasAnyFilter={Boolean(hasAnyFilter)}
          searchActive={searchActive}
        />
      ) : (
        <DayGroupedTimeline
          events={filteredEvents}
          staffById={staffById}
          targetExistence={targetExistence}
          currentFilters={initialValues}
        />
      )}

      {visibleCount > 0 ? (
        <AuditLoadMoreButton
          initialCursor={initialCursor}
          filters={filters}
          staffNames={staffNamesRecord}
          targetExistence={targetExistence}
          currentFilters={initialValues}
        />
      ) : null}
    </div>
  );
}

function ResultCount({
  visibleCount,
  totalKnown,
  searchActive,
  searchAttemptedTooShort,
  hasAnyFilter,
}: {
  visibleCount: number;
  totalKnown: number;
  searchActive: boolean;
  searchAttemptedTooShort: boolean;
  hasAnyFilter: boolean;
}) {
  if (searchAttemptedTooShort) {
    return null; // inline note rendered next to the search input
  }
  if (searchActive || hasAnyFilter) {
    return (
      <p
        className="text-sm text-[var(--admin-text-muted)] [font-variant-numeric:tabular-nums]"
        aria-live="polite"
      >
        Showing <span className="font-semibold text-[var(--admin-heading)]">{visibleCount}</span>{" "}
        of <span className="font-semibold text-[var(--admin-heading)]">{totalKnown}</span> events.
      </p>
    );
  }
  // Unfiltered: when the loaded slice is smaller than a full page (PAGE_SIZE = 100),
  // the user is already seeing every audit row in the system — surface that instead
  // of "Load more to see older entries" copy that implies more pages exist.
  if (totalKnown < PAGE_SIZE) {
    return (
      <p
        className="text-sm text-[var(--admin-text-muted)] [font-variant-numeric:tabular-nums]"
        aria-live="polite"
      >
        Showing <span className="font-semibold text-[var(--admin-heading)]">{totalKnown}</span>{" "}
        {totalKnown === 1 ? "event" : "events"}. End of audit log.
      </p>
    );
  }
  return (
    <p
      className="text-sm text-[var(--admin-text-muted)] [font-variant-numeric:tabular-nums]"
      aria-live="polite"
    >
      Showing <span className="font-semibold text-[var(--admin-heading)]">100</span> most recent
      events. Load more to see older entries.
    </p>
  );
}

function DayGroupedTimeline({
  events,
  staffById,
  targetExistence,
  currentFilters,
}: {
  events: AuditEventRow[];
  staffById: Map<string, string>;
  targetExistence: Record<string, boolean>;
  currentFilters: AuditFilterState;
}) {
  // Server-side grouping preserves the chronological order (events are already
  // sorted DESC by created_at). We bucket consecutive same-day events.
  const groups: { key: string; label: string; events: AuditEventRow[] }[] = [];
  for (const event of events) {
    const key = dayKey(event.created_at);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.key === key) {
      lastGroup.events.push(event);
    } else {
      groups.push({ key, label: dayLabel(event.created_at), events: [event] });
    }
  }

  return (
    <div className="grid gap-6">
      {groups.map((group) => (
        <section key={group.key} aria-label={`Events on ${group.label}`} className="grid gap-3">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--admin-text-muted)] [font-variant-numeric:tabular-nums]">
            <span className="text-[var(--admin-heading)]">{group.label}</span>
            <span className="ml-2 text-[var(--admin-text-muted)]">
              ({group.events.length})
            </span>
          </h3>
          <ol className="grid list-none gap-4 [&>li]:list-none [&>li::marker]:hidden">
            {group.events.map((event) => {
              const actorName = event.actor_staff_id
                ? staffById.get(event.actor_staff_id) ?? "Unknown staff"
                : "System";
              const k = event.target_id && event.target_type ? `${event.target_type}:${event.target_id}` : null;
              const targetExists = k ? targetExistence[k] ?? null : null;
              return (
                <li key={event.id}>
                  <AuditEventCard
                    event={event}
                    actorName={actorName}
                    targetExists={targetExists}
                    currentFilters={currentFilters}
                  />
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

function TimelineEmptyState({
  hasAnyFilter,
  searchActive,
}: {
  hasAnyFilter: boolean;
  searchActive: boolean;
}) {
  if (searchActive) {
    return (
      <EmptyState
        icon={SearchIcon}
        title="Nothing matches that ID"
        message="Check the ID and try again."
        action={{ label: "Clear search", href: "/admin/audit" }}
      />
    );
  }
  if (hasAnyFilter) {
    return (
      <EmptyState
        icon={FileSearch}
        title="No events match"
        message="Try adjusting or clearing your filters."
        action={{ label: "Clear filters", href: "/admin/audit" }}
      />
    );
  }
  return (
    <EmptyState
      icon={Inbox}
      illustrationSrc="/images/admin/empty-states/audit-empty.svg"
      title="No events yet"
      message="Audit rows appear here as the team works in the admin."
    />
  );
}

function applyClientSideFilter(events: AuditEventRow[], filters: AuditFilters): AuditEventRow[] {
  return events.filter((event) => {
    if (filters.actor && event.actor_staff_id !== filters.actor) return false;
    if (filters.target_type && event.target_type !== filters.target_type) return false;
    if (filters.family) {
      const family = describeAction(event.action_type).family;
      if (family !== filters.family) return false;
    }
    if (filters.q) {
      const needle = filters.q.toLowerCase();
      const haystacks = [event.id, event.target_id ?? "", event.actor_staff_id ?? ""];
      if (!haystacks.some((value) => value.toLowerCase().startsWith(needle))) return false;
    }
    if (filters.range && filters.range !== "custom") {
      const created = new Date(event.created_at).getTime();
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const cutoff = (() => {
        switch (filters.range) {
          case "today":
            return now - day;
          case "this_week":
            return now - 7 * day;
          case "this_month":
            return now - 30 * day;
          case "last_30_days":
            return now - 30 * day;
          default:
            return null;
        }
      })();
      if (cutoff !== null && created < cutoff) return false;
    }
    if (filters.range === "custom") {
      const created = new Date(event.created_at).getTime();
      if (filters.from) {
        const fromTs = new Date(filters.from).getTime();
        if (!Number.isNaN(fromTs) && created < fromTs) return false;
      }
      if (filters.to) {
        const toTs = new Date(filters.to).getTime() + 24 * 60 * 60 * 1000; // inclusive day
        if (!Number.isNaN(toTs) && created > toTs) return false;
      }
    }
    return true;
  });
}
