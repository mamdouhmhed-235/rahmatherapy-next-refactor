import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle,
  Inbox,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getEnquiriesListPage,
  getEnquiryOverviewCounts,
  type EnquiriesFilters,
  type EnquirySortKey,
} from "./enquiries-data";
import { canManageEnquiries, getStaffProfile } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";
import { LIST_PAGE_SIZE } from "@/lib/pagination";
import {
  AdminAccessDenied,
  AdminPageHeader,
} from "../components/admin-ui";
import { AdminSheet } from "../components/admin-ui-interactions";
import { EmptyState } from "../components/EmptyState";
import { PaginationBar } from "../components/PaginationBar";
import { EnquiryIntakePanel } from "./EnquiryForm";
import {
  EnquiryList,
  EnquirySortSelect,
  type EnquiryRowData,
} from "./EnquiryList";
import { EnquiryFilterPersistence } from "./EnquiryFilterPersistence";

export const metadata = {
  title: "Enquiries - Rahma Therapy Admin",
};

// Row shapes moved to enquiries-data.ts with the fetch (C-09 Phase C Step 5).

type TabKey = "all" | "new" | "contacted" | "converted" | "closed";
const TAB_ORDER: readonly TabKey[] = ["all", "new", "contacted", "converted", "closed"];
const TAB_LABELS: Record<TabKey, string> = {
  all: "All",
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  closed: "Closed",
};

type SortKey = EnquirySortKey;
const SORT_ORDER: readonly SortKey[] = ["newest", "oldest", "name", "activity"];

function toSortKey(value: string): SortKey {
  return (SORT_ORDER as readonly string[]).includes(value) ? (value as SortKey) : "newest";
}

type SourceKey = "website" | "phone" | "whatsapp" | "instagram" | "referral" | "other";
const SOURCE_LABELS: Record<SourceKey, string> = {
  website: "Website",
  phone: "Phone",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  referral: "Referral",
  other: "Other",
};

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return (value ?? "").trim();
}

function toTabKey(value: string): TabKey {
  return (TAB_ORDER as readonly string[]).includes(value) ? (value as TabKey) : "all";
}

function buildHref(params: URLSearchParams, mutate: (next: URLSearchParams) => void): string {
  const next = new URLSearchParams(params);
  mutate(next);
  next.delete("");
  // Drop empty values so URLs stay tidy.
  for (const key of Array.from(next.keys())) {
    if (!next.get(key)) next.delete(key);
  }
  const qs = next.toString();
  return qs ? `/admin/enquiries?${qs}` : "/admin/enquiries";
}

/**
 * The page's canonical query string (C-16 Phase C Step 8). Every navigation on
 * this page — tab links, filter chips, the sort select, the persisted filter
 * state — is built from this, and it deliberately never reads `params.page`.
 * That is the whole page-reset mechanism: there is no path by which a stale
 * page number can survive a change to the result set, because nothing but the
 * pager ever writes one.
 */
export function buildEnquiryUrlParams(
  params: Record<string, string | string[] | undefined>
): URLSearchParams {
  const next = new URLSearchParams();
  const tab = toTabKey(readParam(params.tab));
  if (tab !== "all") next.set("tab", tab);
  for (const key of ["source", "assigned_staff", "from", "to", "q"] as const) {
    const value = readParam(params[key]);
    if (value) next.set(key, value);
  }
  const sort = toSortKey(readParam(params.sort));
  if (sort !== "newest") next.set("sort", sort);
  return next;
}

/** The pager's href — the only place `page` is written. */
export function buildEnquiryPageHref(
  urlParams: URLSearchParams,
  page: number
): string {
  const next = new URLSearchParams(urlParams);
  if (page > 1) next.set("page", String(page));
  else next.delete("page");
  const qs = next.toString();
  return qs ? `/admin/enquiries?${qs}` : "/admin/enquiries";
}

function presetRange(preset: "today" | "week" | "month"): { from: string; to: string } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "today") {
    const iso = startOfDay.toISOString().slice(0, 10);
    return { from: iso, to: iso };
  }
  if (preset === "week") {
    const day = startOfDay.getDay();
    const offsetToMonday = (day + 6) % 7;
    const monday = new Date(startOfDay);
    monday.setDate(startOfDay.getDate() - offsetToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      from: monday.toISOString().slice(0, 10),
      to: sunday.toISOString().slice(0, 10),
    };
  }
  const first = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
  const last = new Date(startOfDay.getFullYear(), startOfDay.getMonth() + 1, 0);
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
}

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EnquiriesPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!canManageEnquiries(profile)) {
    return (
      <AdminAccessDenied
        title="You don't have access to the enquiries pipeline"
        message="Contact the owner if you need access."
      />
    );
  }

  const tab = toTabKey(readParam(params.tab));
  const sourceFilter = readParam(params.source);
  const assignedFilter = readParam(params.assigned_staff);
  const fromFilter = readParam(params.from);
  const toFilter = readParam(params.to);
  const qFilter = readParam(params.q);
  const sort = toSortKey(readParam(params.sort));

  // 5-step filter audit (brief §2.4): (1) URL parsed above; (2) passed to the
  // fetcher below; (3) applied server-side in enquiries-data.ts's Supabase
  // query; (4) filter UI defaults from these same URL-derived values (see
  // filterFormFields below); (5) empty-state copy distinguishes "no results
  // for this filter" from "no data yet" (EnquiryEmptyState).
  const hasActiveFilters = Boolean(
    sourceFilter || assignedFilter || fromFilter || toFilter || qFilter
  );

  // One filter object, shared by the row query and the head-count that sizes
  // the pager (C-16 Phase C Step 8) — see `applyEnquiryFilters`.
  const filters: EnquiriesFilters = {
    status: tab === "all" ? undefined : tab,
    source: sourceFilter || undefined,
    assignedStaff: assignedFilter || undefined,
    fromDate: fromFilter || undefined,
    toDate: toFilter || undefined,
    q: qFilter || undefined,
  };

  const todayPresetRange = presetRange("today");
  const weekPresetRange = presetRange("week");
  const monthPresetRange = presetRange("month");

  // The badge/stat head-counts use the SAME day ranges as the links they sit
  // on, so a stat can never disagree with the view it navigates to.
  const [listPage, overview] = await Promise.all([
    getEnquiriesListPage({ filters, sort, page: readParam(params.page) }),
    getEnquiryOverviewCounts({
      today: todayPresetRange,
      week: weekPresetRange,
      month: monthPresetRange,
    }),
  ]);
  const { rows: displayed, staff } = listPage;

  // Map rebuilt on THIS side of the cache boundary — enquiries-data.ts returns
  // a plain array because a Map would come back as {} (SHARED-NOTES §15).
  const staffNames = new Map(staff.map((member) => [member.id, member.name]));

  // Tab badge + S1 at-a-glance strip: head-counts over the whole pipeline,
  // not `.filter(...).length` over an unbounded fetch of it.
  const newCount = overview.newTotal;
  const conversionRatePct =
    overview.monthTotal > 0
      ? Math.round((overview.monthConverted / overview.monthTotal) * 100)
      : null;

  // `page` is deliberately absent from `urlParams`: every link, chip, form and
  // the sort select are built from it, so the window resets wherever the
  // result set changes. The pager is the only thing that writes `page`.
  const urlParams = buildEnquiryUrlParams(params);
  const clearAllHref = buildHref(urlParams, (next) => {
    next.delete("source");
    next.delete("assigned_staff");
    next.delete("from");
    next.delete("to");
    next.delete("q");
  });

  const filterFormFields = (
    <>
      <FilterField label="Source" htmlFor="enq-filter-source">
        <select
          id="enq-filter-source"
          name="source"
          defaultValue={sourceFilter}
          className={filterSelectClass}
        >
          <option value="">Any source</option>
          {(Object.keys(SOURCE_LABELS) as SourceKey[]).map((key) => (
            <option key={key} value={key}>
              {SOURCE_LABELS[key]}
            </option>
          ))}
        </select>
      </FilterField>
      <FilterField label="Assigned to" htmlFor="enq-filter-assigned">
        <select
          id="enq-filter-assigned"
          name="assigned_staff"
          defaultValue={assignedFilter}
          className={filterSelectClass}
        >
          <option value="">Anyone</option>
          <option value="unassigned">Unassigned</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </FilterField>
      <FilterField label="From" htmlFor="enq-filter-from">
        <input
          id="enq-filter-from"
          name="from"
          type="date"
          defaultValue={fromFilter}
          className={filterInputClass}
        />
      </FilterField>
      <FilterField label="To" htmlFor="enq-filter-to">
        <input
          id="enq-filter-to"
          name="to"
          type="date"
          defaultValue={toFilter}
          className={filterInputClass}
        />
      </FilterField>
      <FilterField label="Search" htmlFor="enq-filter-q" full>
        <input
          id="enq-filter-q"
          name="q"
          type="search"
          defaultValue={qFilter}
          placeholder="Search by name, phone, or email"
          className={filterInputClass}
        />
      </FilterField>
    </>
  );

  return (
    <div className="grid gap-6 pb-8 lg:pb-16">
      <AdminPageHeader
        title="Enquiries"
        description="Phone, WhatsApp, Instagram, referral, and website leads — captured here before they become bookings."
      />

      <div className="grid gap-5 lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start">
        <aside className="grid gap-3 lg:sticky lg:top-4">
          <EnquiryIntakePanel staff={staff} />
        </aside>

        <main className="min-w-0 grid gap-4 lg:max-w-[64rem]">
          {/* Tab strip — list-none on <ul>, momentum scroll on mobile with soft right-edge fade */}
          <nav
            aria-label="Enquiry status"
            className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_0,black_calc(100%-24px),transparent_100%)] sm:[mask-image:none]"
          >
            <ul className="flex min-w-max list-none items-center gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-1">
              {TAB_ORDER.map((key) => {
                const active = tab === key;
                const href = buildHref(urlParams, (next) => {
                  if (key === "all") next.delete("tab");
                  else next.set("tab", key);
                });
                return (
                  <li key={key} className="min-w-0">
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[0.4rem] px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                        active
                          ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)] shadow-[0_1px_2px_var(--admin-shadow-ink-18)]"
                          : "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]"
                      )}
                    >
                      <span>{TAB_LABELS[key]}</span>
                      {key === "new" && newCount > 0 ? (
                        <span
                          aria-label={`${newCount} new enquiries to follow up`}
                          className={cn(
                            "inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 font-display text-base font-semibold leading-none tracking-[-0.01em]",
                            "[font-family:'Cormorant_Garamond',Georgia,serif]",
                            active
                              ? "bg-white/15 py-0.5 text-[var(--admin-on-primary)]"
                              : "bg-[var(--admin-status-attention-bg)] py-0.5 text-[var(--admin-status-attention-text)]"
                          )}
                        >
                          {newCount}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Filter bar (desktop) */}
          <form
            method="get"
            action="/admin/enquiries"
            className="hidden md:block"
          >
            {tab !== "all" ? <input type="hidden" name="tab" value={tab} /> : null}
            {sort !== "newest" ? <input type="hidden" name="sort" value={sort} /> : null}
            <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,9rem)_minmax(0,9rem)_minmax(0,2fr)] md:items-end">
                {filterFormFields}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <DatePresets urlParams={urlParams} from={fromFilter} to={toFilter} />
                <div className="flex flex-wrap items-center gap-2">
                  {hasActiveFilters ? (
                    <Link
                      href={clearAllHref}
                      className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                    >
                      Clear filters
                    </Link>
                  ) : null}
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                  >
                    Apply filters
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Mobile filter — AdminSheet (focus-trapped, portal-rendered) */}
          <div className="md:hidden">
            <AdminSheet
              title="Filters"
              description="Refine the current view."
              side="bottom"
              trigger={
                <button
                  type="button"
                  className="inline-flex w-full min-h-11 items-center justify-between gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-sm font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="size-4" aria-hidden="true" />
                    <span>Filters</span>
                    {hasActiveFilters ? (
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--admin-status-confirmed-bg)] text-[0.6875rem] font-semibold text-[var(--admin-status-confirmed-text)]">
                        {[sourceFilter, assignedFilter, fromFilter, toFilter, qFilter].filter(Boolean).length}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs font-normal text-[var(--admin-text-muted)]">Open</span>
                </button>
              }
              footer={
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {hasActiveFilters ? (
                    <a
                      href={clearAllHref}
                      className="inline-flex h-11 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                    >
                      Clear filters
                    </a>
                  ) : null}
                  <button
                    type="submit"
                    form="enq-mobile-filter-form"
                    className="inline-flex h-11 items-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                  >
                    Apply filters
                  </button>
                </div>
              }
            >
              <form
                id="enq-mobile-filter-form"
                method="get"
                action="/admin/enquiries"
                className="grid gap-3"
              >
                {tab !== "all" ? <input type="hidden" name="tab" value={tab} /> : null}
                {sort !== "newest" ? <input type="hidden" name="sort" value={sort} /> : null}
                {filterFormFields}
                <DatePresets urlParams={urlParams} from={fromFilter} to={toFilter} mobile />
              </form>
            </AdminSheet>
          </div>

          {/* Active filter chips */}
          {hasActiveFilters ? (
            <FilterChips
              urlParams={urlParams}
              sourceFilter={sourceFilter}
              assignedFilter={assignedFilter}
              fromFilter={fromFilter}
              toFilter={toFilter}
              qFilter={qFilter}
              staffNames={staffNames}
            />
          ) : null}

          {/* S1 — at-a-glance strip */}
          <AtAGlanceStrip
            urlParams={urlParams}
            todayNew={overview.todayNew}
            thisWeekTotal={overview.weekTotal}
            conversionRatePct={conversionRatePct}
            monthEnquiries={overview.monthTotal}
            monthConverted={overview.monthConverted}
            todayRange={todayPresetRange}
            weekRange={weekPresetRange}
            monthRange={monthPresetRange}
          />

          {/* F8 — filter persistence (client) */}
          <EnquiryFilterPersistence currentParams={urlParams.toString()} />

          {/* Count + sort */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-xs text-[var(--admin-text-muted)]">
              Showing <span className="font-semibold text-[var(--admin-heading)]">{listPage.total}</span>{" "}
              {listPage.total === 1 ? "enquiry" : "enquiries"}
              {tab !== "all" ? <> in <span className="font-medium">{TAB_LABELS[tab]}</span></> : null}
            </p>
            {displayed.length > 0 ? (
              <EnquirySortSelect currentSort={sort} urlParamsString={urlParams.toString()} />
            ) : null}
          </div>

          {/* List */}
          {displayed.length === 0 ? (
            <EnquiryEmptyState
              tab={tab}
              hasActiveFilters={hasActiveFilters}
              clearHref={clearAllHref}
            />
          ) : (
            <EnquiryList
              rows={displayed.map<EnquiryRowData>((row) => ({
                ...row,
                assignedName: row.assigned_staff_id
                  ? staffNames.get(row.assigned_staff_id) ?? null
                  : null,
              }))}
            />
          )}

          <PaginationBar
            page={listPage.page}
            pageCount={listPage.pageCount}
            total={listPage.total}
            pageSize={LIST_PAGE_SIZE}
            makeHref={(nextPage) => buildEnquiryPageHref(urlParams, nextPage)}
          />
        </main>
      </div>
    </div>
  );
}

const filterInputClass =
  "block h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30";
const filterSelectClass = cn(filterInputClass, "appearance-none pr-8");

function FilterField({
  label,
  htmlFor,
  full,
  children,
}: {
  label: string;
  htmlFor: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5 min-w-0", full ? "md:col-span-full xl:col-auto" : "")}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-[var(--admin-text-muted)]">
        {label}
      </label>
      {children}
    </div>
  );
}

function DatePresets({
  urlParams,
  from,
  to,
  mobile = false,
}: {
  urlParams: URLSearchParams;
  from: string;
  to: string;
  mobile?: boolean;
}) {
  const presets = (["today", "week", "month"] as const).map((key) => {
    const range = presetRange(key);
    const active = from === range.from && to === range.to;
    const label = key === "today" ? "Today" : key === "week" ? "This week" : "This month";
    return { key, range, active, label };
  });
  return (
    <div className={cn("flex flex-wrap items-center gap-2", mobile ? "" : "min-w-0")}>
      <span className="text-xs font-medium text-[var(--admin-text-muted)]">Quick range</span>
      {presets.map((preset) => (
        <Link
          key={preset.key}
          href={buildHref(urlParams, (next) => {
            next.set("from", preset.range.from);
            next.set("to", preset.range.to);
          })}
          aria-pressed={preset.active}
          className={cn(
            "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
            preset.active
              ? "bg-[var(--admin-selected-sky)] text-[var(--admin-heading)]"
              : "bg-[var(--admin-panel-muted)] text-[var(--admin-body)] hover:bg-[var(--admin-hover-mist)]"
          )}
        >
          {preset.label}
        </Link>
      ))}
    </div>
  );
}

function FilterChips({
  urlParams,
  sourceFilter,
  assignedFilter,
  fromFilter,
  toFilter,
  qFilter,
  staffNames,
}: {
  urlParams: URLSearchParams;
  sourceFilter: string;
  assignedFilter: string;
  fromFilter: string;
  toFilter: string;
  qFilter: string;
  staffNames: Map<string, string>;
}) {
  const chips: { key: string; label: string; href: string }[] = [];
  if (sourceFilter) {
    chips.push({
      key: "source",
      label: `Source: ${SOURCE_LABELS[sourceFilter as SourceKey] ?? sourceFilter}`,
      href: buildHref(urlParams, (next) => next.delete("source")),
    });
  }
  if (assignedFilter) {
    const label =
      assignedFilter === "unassigned"
        ? "Assigned: Unassigned"
        : `Assigned: ${staffNames.get(assignedFilter) ?? "Unknown"}`;
    chips.push({
      key: "assigned",
      label,
      href: buildHref(urlParams, (next) => next.delete("assigned_staff")),
    });
  }
  if (fromFilter || toFilter) {
    const label = `Date: ${fromFilter || "…"} → ${toFilter || "…"}`;
    chips.push({
      key: "date",
      label,
      href: buildHref(urlParams, (next) => {
        next.delete("from");
        next.delete("to");
      }),
    });
  }
  if (qFilter) {
    chips.push({
      key: "q",
      label: `Search: ${qFilter}`,
      href: buildHref(urlParams, (next) => next.delete("q")),
    });
  }
  return (
    <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--admin-status-restricted-bg)] py-1 pl-3 pr-1 text-xs font-medium text-[var(--admin-status-restricted-text)]"
        >
          <span>{chip.label}</span>
          <Link
            href={chip.href}
            aria-label={`Clear filter: ${chip.label}`}
            className="inline-flex size-5 items-center justify-center rounded-full text-[var(--admin-status-restricted-text)] outline-none transition-colors hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <X className="size-3" aria-hidden="true" />
          </Link>
        </span>
      ))}
    </div>
  );
}

function EnquiryEmptyState({
  tab,
  hasActiveFilters,
  clearHref,
}: {
  tab: TabKey;
  hasActiveFilters: boolean;
  clearHref: string;
}) {
  if (hasActiveFilters) {
    return (
      <EmptyState
        icon={Inbox}
        title="No enquiries match"
        message="Try adjusting or clearing your filters."
        action={{ label: "Clear filters", href: clearHref }}
      />
    );
  }
  const map: Record<
    TabKey,
    { title: string; message: string; action?: { label: string; href: string } }
  > = {
    all: {
      title: "No enquiries yet",
      message:
        "New leads from phone, WhatsApp, Instagram, or the website show up here.",
      action: { label: "Record enquiry", href: "#enquiry-intake-panel" },
    },
    new: {
      title: "No new enquiries",
      message: "Everything that's come in has been picked up.",
    },
    contacted: {
      title: "No contacted enquiries waiting",
      message: "Once you reach out to a new lead, it'll appear here.",
      action: { label: "Show new", href: "/admin/enquiries?tab=new" },
    },
    converted: {
      title: "No converted enquiries yet",
      message:
        "When a lead becomes a booking, it'll show up here with a link to the booking.",
    },
    closed: {
      title: "No closed enquiries",
      message: "Closed leads show up here for the record.",
    },
  };
  const copy = map[tab];
  // Only the truly-empty 'all' tab gets the dignified illustration; per-tab
  // sub-empties (new/contacted/converted/closed) keep the Inbox icon since
  // they are state-specific empty cases, not first-impression surfaces.
  const illustrationSrc =
    tab === "all" ? "/images/admin/empty-states/no-enquiries.svg" : undefined;
  return (
    <EmptyState
      icon={Inbox}
      illustrationSrc={illustrationSrc}
      title={copy.title}
      message={copy.message}
      action={copy.action}
    />
  );
}

function AtAGlanceStrip({
  urlParams,
  todayNew,
  thisWeekTotal,
  conversionRatePct,
  monthEnquiries,
  monthConverted,
  todayRange,
  weekRange,
  monthRange,
}: {
  urlParams: URLSearchParams;
  todayNew: number;
  thisWeekTotal: number;
  conversionRatePct: number | null;
  monthEnquiries: number;
  monthConverted: number;
  todayRange: { from: string; to: string };
  weekRange: { from: string; to: string };
  monthRange: { from: string; to: string };
}) {
  const items = [
    {
      key: "today",
      icon: Sparkles,
      label: "Today",
      value: `${todayNew} new`,
      href: buildHref(urlParams, (next) => {
        next.set("tab", "new");
        next.set("from", todayRange.from);
        next.set("to", todayRange.to);
      }),
      title: "Show new enquiries received today",
    },
    {
      key: "week",
      icon: CheckCircle,
      label: "This week",
      value: thisWeekTotal === 1 ? "1 enquiry" : `${thisWeekTotal} enquiries`,
      href: buildHref(urlParams, (next) => {
        next.delete("tab");
        next.set("from", weekRange.from);
        next.set("to", weekRange.to);
      }),
      title: "Show every enquiry received this week",
    },
    {
      key: "rate",
      icon: TrendingUp,
      label: "Conversion this month",
      value:
        conversionRatePct === null
          ? "—"
          : `${conversionRatePct}% (${monthConverted}/${monthEnquiries})`,
      href: buildHref(urlParams, (next) => {
        next.set("tab", "converted");
        next.set("from", monthRange.from);
        next.set("to", monthRange.to);
      }),
      title: "Show converted enquiries from this month",
    },
  ];
  return (
    <div className="grid gap-2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3 sm:grid-cols-3 sm:gap-0 sm:p-0 sm:divide-x sm:divide-[var(--admin-border)]">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            title={item.title}
            className="group flex items-center gap-3 rounded-[var(--admin-radius-control)] px-3 py-2 outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 sm:rounded-none sm:px-4 sm:py-3"
          >
            <span
              aria-hidden="true"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-status-confirmed-bg)] text-[var(--admin-status-confirmed-text)]"
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">
                {item.label}
              </span>
              <span className="block truncate text-sm font-semibold text-[var(--admin-heading)] group-hover:text-[var(--admin-primary)]">
                {item.value}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

