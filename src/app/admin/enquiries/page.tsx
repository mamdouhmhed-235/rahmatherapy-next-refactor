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
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canManageEnquiries, getStaffProfile } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";
import {
  AdminAccessDenied,
  AdminPageHeader,
} from "../components/admin-ui";
import { AdminSheet } from "../components/admin-ui-interactions";
import { EmptyState } from "../components/EmptyState";
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

interface EnquiryRecord {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  service_interest: string | null;
  notes: string | null;
  client_id: string | null;
  converted_booking_id: string | null;
  assigned_staff_id: string | null;
  created_at: string;
  updated_at: string | null;
}

interface StaffOption {
  id: string;
  name: string;
}

type TabKey = "all" | "new" | "contacted" | "converted" | "closed";
const TAB_ORDER: readonly TabKey[] = ["all", "new", "contacted", "converted", "closed"];
const TAB_LABELS: Record<TabKey, string> = {
  all: "All",
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  closed: "Closed",
};

type SortKey = "newest" | "oldest" | "name" | "activity";
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

  const adminClient = createSupabaseAdminClient();
  // FAKE: BUILD-enquiries-filter-query â€” until the server-side filter query lands,
  // we read the full list and degrade gracefully. Filtering below is in-memory and
  // therefore does not scale; the BUILD plan will move tab/source/assigned/date/q
  // filtering into the Supabase query.
  const [{ data: enquiriesRaw }, { data: staffRaw }] = await Promise.all([
    adminClient
      .from("enquiries")
      .select(
        "id, full_name, phone, email, source, status, service_interest, notes, client_id, converted_booking_id, assigned_staff_id, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .returns<EnquiryRecord[]>(),
    adminClient
      .from("staff_profiles")
      .select("id, name")
      .eq("active", true)
      .order("name")
      .returns<StaffOption[]>(),
  ]);

  const enquiries = enquiriesRaw ?? [];
  const staff = staffRaw ?? [];
  const staffNames = new Map(staff.map((member) => [member.id, member.name]));

  // Tab counts (full list).
  const newCount = enquiries.filter((row) => row.status === "new").length;

  // FAKE: BUILD-enquiries-filter-query â€” in-memory tab + filter application.
  const tabFiltered = enquiries.filter((row) => {
    switch (tab) {
      case "new":
        return row.status === "new";
      case "contacted":
        return row.status === "contacted";
      case "converted":
        return Boolean(row.converted_booking_id);
      case "closed":
        return row.status === "closed";
      default:
        return true;
    }
  });

  const fromTime = fromFilter ? new Date(`${fromFilter}T00:00:00Z`).getTime() : null;
  const toTime = toFilter ? new Date(`${toFilter}T23:59:59Z`).getTime() : null;
  const qNeedle = qFilter.toLowerCase();

  const displayedUnsorted = tabFiltered.filter((row) => {
    if (sourceFilter && row.source !== sourceFilter) return false;
    if (assignedFilter) {
      if (assignedFilter === "unassigned") {
        if (row.assigned_staff_id) return false;
      } else if (row.assigned_staff_id !== assignedFilter) {
        return false;
      }
    }
    if (fromTime !== null) {
      if (new Date(row.created_at).getTime() < fromTime) return false;
    }
    if (toTime !== null) {
      if (new Date(row.created_at).getTime() > toTime) return false;
    }
    if (qNeedle) {
      const haystack = [
        row.full_name,
        row.phone ?? "",
        row.email ?? "",
        row.service_interest ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(qNeedle)) return false;
    }
    return true;
  });

  // Apply sort.
  const displayed = [...displayedUnsorted].sort((a, b) => {
    switch (sort) {
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "name":
        return a.full_name.localeCompare(b.full_name, "en", { sensitivity: "base" });
      case "activity": {
        const aTs = new Date(a.updated_at ?? a.created_at).getTime();
        const bTs = new Date(b.updated_at ?? b.created_at).getTime();
        return bTs - aTs;
      }
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  // S1: at-a-glance stats (server-computed).
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeekDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  startOfWeekDate.setDate(
    startOfWeekDate.getDate() - ((startOfWeekDate.getDay() + 6) % 7)
  );
  const startOfWeek = startOfWeekDate.getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const todayNew = enquiries.filter(
    (r) => r.status === "new" && new Date(r.created_at).getTime() >= todayStart
  ).length;
  const thisWeekTotal = enquiries.filter(
    (r) => new Date(r.created_at).getTime() >= startOfWeek
  ).length;
  const monthEnquiries = enquiries.filter(
    (r) => new Date(r.created_at).getTime() >= startOfMonth
  );
  const monthConverted = monthEnquiries.filter((r) => r.converted_booking_id).length;
  const conversionRatePct =
    monthEnquiries.length > 0
      ? Math.round((monthConverted / monthEnquiries.length) * 100)
      : null;

  const urlParams = new URLSearchParams();
  if (tab !== "all") urlParams.set("tab", tab);
  if (sourceFilter) urlParams.set("source", sourceFilter);
  if (assignedFilter) urlParams.set("assigned_staff", assignedFilter);
  if (fromFilter) urlParams.set("from", fromFilter);
  if (toFilter) urlParams.set("to", toFilter);
  if (qFilter) urlParams.set("q", qFilter);
  if (sort !== "newest") urlParams.set("sort", sort);

  const hasActiveFilters = Boolean(
    sourceFilter || assignedFilter || fromFilter || toFilter || qFilter
  );

  const todayPresetRange = presetRange("today");
  const weekPresetRange = presetRange("week");
  const monthPresetRange = presetRange("month");
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
        description="Phone, WhatsApp, Instagram, referral, and website leads â€” captured here before they become bookings."
      />

      <div className="grid gap-5 lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start">
        <aside className="grid gap-3 lg:sticky lg:top-4">
          <EnquiryIntakePanel staff={staff} />
        </aside>

        <main className="min-w-0 grid gap-4 lg:max-w-[64rem]">
          {/* Tab strip â€” list-none on <ul>, momentum scroll on mobile with soft right-edge fade */}
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
                          ? "bg-[var(--admin-primary)] text-white shadow-[0_1px_2px_oklch(23%_0.073_155_/_0.18)]"
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
                              ? "bg-white/15 py-0.5 text-white"
                              : "bg-[oklch(95%_0.05_65)] py-0.5 text-[oklch(26%_0.13_55)]"
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
            data-redesign-backend="FAKE"
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

          {/* Mobile filter â€” AdminSheet (focus-trapped, portal-rendered) */}
          <div className="md:hidden" data-redesign-backend="FAKE">
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
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-[oklch(93.5%_0.038_155)] text-[0.6875rem] font-semibold text-[oklch(22%_0.085_155)]">
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
                    className="inline-flex h-11 items-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-white outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
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

          {/* S1 â€” at-a-glance strip */}
          <AtAGlanceStrip
            urlParams={urlParams}
            todayNew={todayNew}
            thisWeekTotal={thisWeekTotal}
            conversionRatePct={conversionRatePct}
            monthEnquiries={monthEnquiries.length}
            monthConverted={monthConverted}
            todayRange={todayPresetRange}
            weekRange={weekPresetRange}
            monthRange={monthPresetRange}
          />

          {/* F8 â€” filter persistence (client) */}
          <EnquiryFilterPersistence currentParams={urlParams.toString()} />

          {/* Count + sort */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-xs text-[var(--admin-text-muted)]">
              Showing <span className="font-semibold text-[var(--admin-heading)]">{displayed.length}</span>{" "}
              {displayed.length === 1 ? "enquiry" : "enquiries"}
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
    const label = `Date: ${fromFilter || "â€¦"} â†’ ${toFilter || "â€¦"}`;
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
          className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(94%_0.008_280)] py-1 pl-3 pr-1 text-xs font-medium text-[oklch(30%_0.02_280)]"
        >
          <span>{chip.label}</span>
          <Link
            href={chip.href}
            aria-label={`Clear filter: ${chip.label}`}
            className="inline-flex size-5 items-center justify-center rounded-full text-[oklch(30%_0.02_280)] outline-none transition-colors hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
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
          ? "â€”"
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
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[oklch(93.5%_0.038_155)] text-[oklch(22%_0.085_155)]"
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

