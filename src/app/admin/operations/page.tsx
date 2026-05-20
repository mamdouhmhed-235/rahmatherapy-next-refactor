import { redirect } from "next/navigation";
import { AlertCircle, Info, Search, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminPageAccess } from "@/lib/auth/admin-access";
import { getStaffProfile } from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminPageHeader,
  AdminPageScaffold,
  AdminStat,
} from "../components/admin-ui";
import { OperationsBoard } from "./operations-board";
import type { OperationalEventRow } from "./event-row";

export const metadata = {
  title: "Operational events - Rahma Therapy Admin",
};

type SearchParams = Record<string, string | string[] | undefined>;

interface OperationsPageProps {
  searchParams: Promise<SearchParams>;
}

const SEVERITY_LABEL: Record<"info" | "warning" | "error", string> = {
  info: "Info",
  warning: "Warning",
  error: "Error",
};

function readParam(params: SearchParams, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function OperationsPage({ searchParams }: OperationsPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");
  if (!getAdminPageAccess(profile, "operations").access) {
    return (
      <AdminPageScaffold>
        <AdminAccessDenied
          title="Operational events access limited"
          message="Production support events are restricted to the owner and practice manager. Ask the owner if you need access."
        />
      </AdminPageScaffold>
    );
  }

  const params = await searchParams;
  const severity = readParam(params, "severity");
  const eventTypeFilter = readParam(params, "event_type");
  const statusFilter = readParam(params, "status");
  const fromDate = readParam(params, "from");
  const toDate = readParam(params, "to");
  const queryText = readParam(params, "q");
  const filtersActive = Boolean(
    severity || eventTypeFilter || statusFilter || fromDate || toDate || queryText
  );

  const adminClient = createSupabaseAdminClient();
  const { data: rawEvents, error } = await adminClient
    .from("operational_events")
    .select(
      "id, event_type, severity, status, summary, safe_context, booking_id, staff_id, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(300)
    .returns<OperationalEventRow[]>();

  const events: OperationalEventRow[] = rawEvents ?? [];

  // Severity counts on the OPEN column (clear-the-queue metric).
  const openErrors = events.filter((e) => e.status === "open" && e.severity === "error").length;
  const openWarnings = events.filter((e) => e.status === "open" && e.severity === "warning").length;
  const openInfos = events.filter((e) => e.status === "open" && e.severity === "info").length;

  // Build event-type options from current page-load data (distinct values, sorted).
  const eventTypeOptions = Array.from(new Set(events.map((event) => event.event_type)))
    .filter(Boolean)
    .sort();

  // Active-filter chip list — surface what's currently constraining the view.
  const activeFilterChips: { key: string; label: string; clearTo: string }[] = [];
  function buildClearUrl(omitKey: string) {
    const next = new URLSearchParams();
    if (severity && omitKey !== "severity") next.set("severity", severity);
    if (eventTypeFilter && omitKey !== "event_type") next.set("event_type", eventTypeFilter);
    if (statusFilter && omitKey !== "status") next.set("status", statusFilter);
    if (fromDate && omitKey !== "from") next.set("from", fromDate);
    if (toDate && omitKey !== "to") next.set("to", toDate);
    if (queryText && omitKey !== "q") next.set("q", queryText);
    const query = next.toString();
    return query ? `/admin/operations?${query}` : "/admin/operations";
  }
  if (severity) activeFilterChips.push({ key: "severity", label: `Severity: ${SEVERITY_LABEL[severity as "info" | "warning" | "error"] ?? severity}`, clearTo: buildClearUrl("severity") });
  if (eventTypeFilter) activeFilterChips.push({ key: "event_type", label: `Event type: ${formatLabel(eventTypeFilter)}`, clearTo: buildClearUrl("event_type") });
  if (statusFilter) activeFilterChips.push({ key: "status", label: `Status: ${formatLabel(statusFilter)}`, clearTo: buildClearUrl("status") });
  if (fromDate) activeFilterChips.push({ key: "from", label: `From: ${fromDate}`, clearTo: buildClearUrl("from") });
  if (toDate) activeFilterChips.push({ key: "to", label: `To: ${toDate}`, clearTo: buildClearUrl("to") });
  if (queryText) activeFilterChips.push({ key: "q", label: `Search: "${queryText}"`, clearTo: buildClearUrl("q") });

  // Date-range preset chips per brief §5 + §8.
  const today = new Date();
  function isoDate(d: Date) {
    return d.toISOString().slice(0, 10);
  }
  function shiftDays(d: Date, days: number) {
    const next = new Date(d);
    next.setDate(next.getDate() + days);
    return next;
  }
  const todayIso = isoDate(today);
  const last7Iso = isoDate(shiftDays(today, -6));
  const last30Iso = isoDate(shiftDays(today, -29));
  function presetUrl(rangeFrom: string, rangeTo: string) {
    const next = new URLSearchParams();
    if (severity) next.set("severity", severity);
    if (eventTypeFilter) next.set("event_type", eventTypeFilter);
    if (statusFilter) next.set("status", statusFilter);
    if (queryText) next.set("q", queryText);
    next.set("from", rangeFrom);
    next.set("to", rangeTo);
    return `/admin/operations?${next.toString()}`;
  }
  const presets = [
    { key: "today", label: "Today", from: todayIso, to: todayIso },
    { key: "7d", label: "Last 7 days", from: last7Iso, to: todayIso },
    { key: "30d", label: "Last 30 days", from: last30Iso, to: todayIso },
  ];
  const activePreset = presets.find((p) => p.from === fromDate && p.to === toDate)?.key ?? (fromDate || toDate ? "custom" : null);

  return (
    <AdminPageScaffold>
      <AdminPageHeader
        title="Operational events"
        description="Production support events. Safe metadata only: no request bodies, no health notes, no secrets, no email bodies."
      />

      <>
        <div className="grid gap-3">
          {!error ? (
          <section
            aria-label="Open events by severity"
            className="grid gap-3 sm:grid-cols-3"
          >
            <a
              href="/admin/operations?severity=error&status=open#operations-panel-open"
              title="Filter to open errors"
              data-redesign-fake="filter-query"
              className="block outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 rounded-[var(--admin-radius-card)]"
            >
              <AdminStat
                label="Open errors"
                value={openErrors}
                icon={XCircle}
                tone={openErrors > 0 ? "danger" : "muted"}
                numeral
              />
            </a>
            <a
              href="/admin/operations?severity=warning&status=open#operations-panel-open"
              title="Filter to open warnings"
              data-redesign-fake="filter-query"
              className="block outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 rounded-[var(--admin-radius-card)]"
            >
              <AdminStat
                label="Open warnings"
                value={openWarnings}
                icon={AlertCircle}
                tone={openWarnings > 0 ? "warning" : "muted"}
                numeral
              />
            </a>
            <a
              href="/admin/operations?severity=info&status=open#operations-panel-open"
              title="Filter to open info"
              data-redesign-fake="filter-query"
              className="block outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 rounded-[var(--admin-radius-card)]"
            >
              <AdminStat
                label="Open info"
                value={openInfos}
                icon={Info}
                tone={openInfos > 0 ? "restricted" : "muted"}
                numeral
              />
            </a>
          </section>
          ) : null}

          <details className="group block" open>
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-panel)] px-3 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 sm:hidden [&::-webkit-details-marker]:hidden">
              <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">›</span>
              <span>Filters</span>
              {activeFilterChips.length > 0 ? (
                <span className="inline-flex items-center rounded-full bg-[var(--admin-primary)] px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
                  {activeFilterChips.length}
                </span>
              ) : null}
            </summary>
            <div className="mt-3 grid gap-3 sm:mt-0">
          <div
            role="group"
            aria-label="Quick date range"
            className="flex flex-wrap items-center gap-1.5 text-xs"
          >
            <span className="text-[var(--admin-text-muted)]">Quick range:</span>
            {presets.map((preset) => {
              const isActive = activePreset === preset.key;
              return (
                <a
                  key={preset.key}
                  href={presetUrl(preset.from, preset.to)}
                  aria-current={isActive ? "true" : undefined}
                  data-redesign-fake="filter-query"
                  className={cn(
                    "inline-flex min-h-11 sm:min-h-7 items-center rounded-full px-2.5 py-0.5 font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                    isActive
                      ? "bg-[var(--admin-primary)] text-white"
                      : "border border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]"
                  )}
                >
                  {preset.label}
                </a>
              );
            })}
            {activePreset === "custom" ? (
              <span
                aria-current="true"
                className="inline-flex min-h-7 items-center rounded-full bg-[var(--admin-primary)] px-2.5 py-0.5 font-medium text-white"
              >
                Custom: {fromDate || "…"} → {toDate || "…"}
              </span>
            ) : null}
          </div>

          <form
            method="get"
            action="/admin/operations"
            aria-label="Filter operational events"
            data-redesign-fake="filter-query"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_1.4fr_1fr_auto]"
          >
            <label className="grid gap-1 text-xs font-medium text-[var(--admin-heading)]">
              <span>Search</span>
              <span className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-muted)]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  name="q"
                  defaultValue={queryText}
                  placeholder="Search events"
                  className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] pl-9 pr-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
                />
              </span>
            </label>
            <label className="grid gap-1 text-xs font-medium text-[var(--admin-heading)]">
              <span>Event type</span>
              <select
                name="event_type"
                defaultValue={eventTypeFilter}
                className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
              >
                <option value="">All event types</option>
                {eventTypeOptions.map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-[var(--admin-heading)]">
              <span>Severity</span>
              <select
                name="severity"
                defaultValue={severity}
                className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
              >
                <option value="">Any severity</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </label>
            <details
              className="group sm:col-span-2 xl:col-span-4"
              open={activePreset === "custom"}
            >
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-[var(--admin-primary)] outline-none transition-colors hover:text-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden">
                <span className="inline-block transition-transform group-open:rotate-90">›</span>
                <span>Custom date range</span>
              </summary>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:max-w-[28rem]">
                <label className="grid gap-1 text-xs font-medium text-[var(--admin-heading)]">
                  <span>From</span>
                  <input
                    type="date"
                    name="from"
                    defaultValue={fromDate}
                    className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-[var(--admin-heading)]">
                  <span>To</span>
                  <input
                    type="date"
                    name="to"
                    defaultValue={toDate}
                    className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
                  />
                </label>
              </div>
            </details>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Apply filters
              </button>
              {filtersActive ? (
                <a
                  href="/admin/operations"
                  className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  Clear filters
                </a>
              ) : null}
            </div>
          </form>

          {activeFilterChips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[var(--admin-text-muted)]">Active filters:</span>
              {activeFilterChips.map((chip) => (
                <a
                  key={chip.key}
                  href={chip.clearTo}
                  title={`Clear ${chip.key} filter`}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2.5 py-1 font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  <span>{chip.label}</span>
                  <span aria-hidden="true" className="text-[var(--admin-text-muted)]">×</span>
                </a>
              ))}
            </div>
          ) : null}
            </div>
          </details>
        </div>

        {error ? (
          <div
            role="alert"
            aria-live="polite"
            className="flex flex-col gap-3 rounded-[var(--admin-radius-card)] border border-[oklch(88%_0.045_20)] bg-[oklch(95.5%_0.028_20)] px-4 py-4 text-sm text-[oklch(26%_0.14_25)] sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="flex items-start gap-2 leading-6">
              <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>Couldn&apos;t load operational events. Try refreshing.</span>
            </p>
            <a
              href="/admin/operations"
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] border border-[oklch(88%_0.045_20)] bg-[var(--admin-panel)] px-4 text-sm font-semibold text-[oklch(26%_0.14_25)] outline-none transition-colors hover:bg-[oklch(95.5%_0.028_20)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              Try again
            </a>
          </div>
        ) : (
          <OperationsBoard events={events} filtersActive={filtersActive} />
        )}
      </>
    </AdminPageScaffold>
  );
}
