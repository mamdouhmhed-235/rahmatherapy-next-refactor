"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminSheet } from "../components/admin-ui-interactions";
import {
  ActiveFilterChip,
  SavedViewBar,
} from "../components/admin-scalable-lists";

export type BookingViewKey =
  | "attention"
  | "assigned"
  | "claimable"
  | "today"
  | "upcoming"
  | "unassigned"
  | "partially_assigned"
  | "completed"
  | "cancelled"
  | "all"
  | "series";

const ALL_VIEW_LABELS: Record<BookingViewKey, string> = {
  attention: "Needs Attention",
  today: "Today",
  upcoming: "Upcoming",
  claimable: "Claimable",
  assigned: "Assigned to me",
  unassigned: "Unassigned",
  partially_assigned: "Partially assigned",
  completed: "Completed",
  cancelled: "Cancelled / No-show",
  all: "All",
  series: "Series",
};

// Exported for the C-16 Step 6 pinning spec only: `visibleBookingViews`
// (bookings-list-data.ts) has to name the same chips to count them, and a
// server component cannot read a value out of this `"use client"` module.
export const FULL_PRIMARY: BookingViewKey[] = ["attention", "today", "upcoming", "claimable"];
// C-02 Phase H (plan Step 23) — "series" joins the canViewAll-only overflow,
// same gate as the other operator-wide filters (Payment/Gender/Service/etc.
// below); the deep link Phase F emits (`?view=series&templateId=<id>`) only
// ever targets an admin/coordinator audience.
export const FULL_OVERFLOW: BookingViewKey[] = [
  "assigned",
  "unassigned",
  "partially_assigned",
  "completed",
  "cancelled",
  "all",
  "series",
];
export const THERAPIST_PRIMARY: BookingViewKey[] = ["today", "upcoming", "claimable"];
export const THERAPIST_OVERFLOW: BookingViewKey[] = ["assigned", "completed"];

const FILTER_LABELS: Record<string, string> = {
  search: "Search",
  status: "Status",
  assignment_status: "Assignment",
  payment_status: "Payment",
  required_gender: "Gender",
  service: "Service",
  location: "Location",
  assigned_staff: "Assigned to",
  from: "From",
  to: "To",
};

// Pre-namespacing key (C-06 and earlier) — global to the browser, so on a
// shared front-desk machine one staff member's saved searches (which can
// carry a client name via `search=`) would persist into the next person's
// session. v2 below is namespaced per staff id; this constant only exists
// so `loadSavedViews` can purge it on sight (see the comment there).
const LEGACY_GLOBAL_STORAGE_KEY = "rahma.admin.bookings.saved-views.v1";

type SavedView = { id: string; label: string; query: string };

type Props = {
  currentView: BookingViewKey;
  query: Record<string, string | string[] | undefined>;
  services: Array<{ slug: string; name: string }>;
  staff: Array<{ id: string; name: string }>;
  canViewAll: boolean;
  staffId: string;
  /**
   * C-16 Step 6 — one count per chip, each computed with that chip's own view
   * predicate (see `getVisibleViewCounts` in page.tsx). Absent when the count
   * fetch failed; a chip with no entry simply renders its label.
   */
  viewCounts?: Partial<Record<BookingViewKey, number>>;
};

export function storageKeyFor(staffId: string): string {
  return `rahma.admin.bookings.saved-views.v2.${staffId}`;
}

/**
 * C-16 Step 7 — `page` belongs to one result set. Every navigation that
 * changes WHICH rows are listed drops it, so the reader lands on page 1 of the
 * new set instead of page 3 of a list that may now be one page long.
 */
function withoutPage(queryString: string): string {
  const params = new URLSearchParams(queryString);
  params.delete("page");
  return params.toString();
}

function readQueryString(query: Props["query"], view: BookingViewKey): string {
  const params = new URLSearchParams();
  params.set("view", view);
  for (const [key, raw] of Object.entries(query)) {
    // `page`: see `withoutPage` — switching view changes the result set.
    if (key === "view" || key === "page") continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    }
  }
  return params.toString();
}

function readQueryValue(
  query: Props["query"],
  key: string
): string | undefined {
  const raw = query[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

export function loadSavedViews(staffId: string): SavedView[] {
  if (typeof window === "undefined") return [];
  // Legacy purge, no migration: the old global key may hold a previous staff
  // member's saved searches (a saved view's `search=` param can carry a
  // client's name). Migrating it to whichever staff id loads next would hand
  // that data to the wrong person — the exact leak namespacing this key is
  // meant to close. Delete it on sight instead of carrying it forward.
  try {
    window.localStorage.removeItem(LEGACY_GLOBAL_STORAGE_KEY);
  } catch {
    // localStorage may be unavailable in private mode — fail silent.
  }
  try {
    const raw = window.localStorage.getItem(storageKeyFor(staffId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is SavedView =>
        Boolean(entry) &&
        typeof (entry as SavedView).id === "string" &&
        typeof (entry as SavedView).label === "string" &&
        typeof (entry as SavedView).query === "string"
    );
  } catch {
    return [];
  }
}

export function persistSavedViews(staffId: string, views: SavedView[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKeyFor(staffId), JSON.stringify(views));
  } catch {
    // localStorage may be unavailable in private mode — fail silent.
  }
}

export function BookingsChrome({
  currentView,
  query,
  services,
  staff,
  canViewAll,
  staffId,
  viewCounts,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [savedViews, setSavedViews] = React.useState<SavedView[]>([]);
  const [overflowOpen, setOverflowOpen] = React.useState(false);
  const overflowRef = React.useRef<HTMLDivElement | null>(null);
  const overflowTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const overflowClosedByEscape = React.useRef(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedViews(loadSavedViews(staffId));
  }, [staffId]);

  React.useEffect(() => {
    if (!overflowOpen) return;
    function handleClick(event: MouseEvent) {
      if (
        overflowRef.current &&
        !overflowRef.current.contains(event.target as Node)
      ) {
        setOverflowOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        overflowClosedByEscape.current = true;
        setOverflowOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [overflowOpen]);

  // Focus the first menuitem on open, return focus to the trigger on
  // Escape close. Click-outside leaves focus where the user clicked.
  React.useEffect(() => {
    if (overflowOpen) {
      const first = overflowRef.current?.querySelector<HTMLElement>(
        '[role="menuitem"]'
      );
      first?.focus();
      return;
    }
    if (overflowClosedByEscape.current) {
      overflowClosedByEscape.current = false;
      overflowTriggerRef.current?.focus();
    }
  }, [overflowOpen]);

  const primaryKeys = canViewAll ? FULL_PRIMARY : THERAPIST_PRIMARY;
  const overflowKeys = canViewAll ? FULL_OVERFLOW : THERAPIST_OVERFLOW;

  const isOverflowActive = overflowKeys.includes(currentView);

  function navigateToQuery(queryString: string) {
    router.push(`/admin/bookings?${queryString}`);
  }

  function clearFilter(name: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(name);
    params.delete("page");
    router.push(`/admin/bookings?${params.toString()}`);
  }

  function clearAllFilters() {
    const params = new URLSearchParams();
    params.set("view", currentView);
    router.push(`/admin/bookings?${params.toString()}`);
  }

  function handleSaveView(name: string) {
    // A saved view stores FILTERS, never a window into them (C-16 Step 7,
    // plan §4 risk row): saving from page 3 and re-applying it a week later
    // would otherwise open page 3 of a different result set — or an empty
    // page, if the set has since shrunk.
    const queryString = withoutPage(searchParams.toString());
    const next = [
      ...savedViews,
      { id: `view-${Date.now()}`, label: name, query: queryString },
    ];
    setSavedViews(next);
    persistSavedViews(staffId, next);
    toast.success(`View "${name}" saved.`);
  }

  function handleRemoveView(id: string) {
    const target = savedViews.find((view) => view.id === id);
    const next = savedViews.filter((view) => view.id !== id);
    setSavedViews(next);
    persistSavedViews(staffId, next);
    if (target) toast.success(`View "${target.label}" removed.`);
  }

  function handleApplySavedView(id: string) {
    const target = savedViews.find((view) => view.id === id);
    if (!target) return;
    // Stripped on apply as well as on save: views persisted before this
    // change are already in localStorage and may carry a `page`.
    navigateToQuery(withoutPage(target.query));
  }

  // Compared page-free, so a saved view still reads as active on page 2.
  const currentQuery = withoutPage(searchParams.toString());
  const activeSavedViewId =
    savedViews.find((view) => withoutPage(view.query) === currentQuery)?.id ??
    null;

  const activeFilters: Array<{
    name: string;
    label: string;
    display: string;
  }> = [];
  for (const name of [
    "search",
    "status",
    "assignment_status",
    "payment_status",
    "required_gender",
    "service",
    "location",
    "assigned_staff",
    "from",
    "to",
  ]) {
    const value = readQueryValue(query, name);
    if (!value) continue;
    let display = value;
    if (name === "assigned_staff") {
      display = staff.find((member) => member.id === value)?.name ?? value;
    }
    if (name === "required_gender") {
      display = value === "male" ? "Male therapist" : "Female therapist";
    }
    if (name === "status" || name === "assignment_status" || name === "payment_status") {
      display = value.replace(/_/g, " ");
    }
    activeFilters.push({
      name,
      label: FILTER_LABELS[name] ?? name,
      display,
    });
  }

  const activeFilterCount = activeFilters.length;

  return (
    <div className="grid gap-3">
      <nav
        aria-label="Booking views"
        className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
      >
        {primaryKeys.map((key) => {
          const isActive = currentView === key;
          return (
            <Link
              key={key}
              href={`/admin/bookings?${readQueryString(query, key)}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                isActive
                  ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary-hover)]"
                  : "text-[var(--admin-body)] hover:bg-[var(--admin-hover-mist)] hover:text-[var(--admin-heading)]"
              )}
            >
              {ALL_VIEW_LABELS[key]}
              <ViewCount
                count={viewCounts?.[key]}
                className={cn(
                  "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.6875rem] font-semibold",
                  isActive
                    ? "bg-[var(--admin-on-primary)] text-[var(--admin-primary)]"
                    : "bg-[var(--admin-selected-sky)] text-[var(--admin-heading)]"
                )}
              />
            </Link>
          );
        })}

        <div ref={overflowRef} className="relative shrink-0">
          <button
            ref={overflowTriggerRef}
            type="button"
            onClick={() => setOverflowOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
            aria-current={isOverflowActive ? "page" : undefined}
            title="Other views"
            className={cn(
              "inline-flex h-9 appearance-none items-center gap-1 rounded-full border-0 bg-transparent px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
              isOverflowActive
                ? "bg-[var(--admin-selected-sky)] text-[var(--admin-heading)]"
                : "text-[var(--admin-body)] hover:bg-[var(--admin-hover-mist)] hover:text-[var(--admin-heading)]"
            )}
          >
            More
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                overflowOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>
          {overflowOpen ? (
            <div
              role="menu"
              className="rahma-pop-in absolute right-0 z-30 mt-1.5 grid min-w-52 gap-0.5 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-1.5 shadow-[var(--admin-shadow-overlay)]"
            >
              {overflowKeys.map((key) => {
                const isActive = currentView === key;
                return (
                  <Link
                    key={key}
                    role="menuitem"
                    href={`/admin/bookings?${readQueryString(query, key)}`}
                    onClick={() => setOverflowOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-9 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                      isActive
                        ? "bg-[var(--admin-selected-sky)] text-[var(--admin-heading)]"
                        : "text-[var(--admin-body)] hover:text-[var(--admin-heading)]"
                    )}
                  >
                    {ALL_VIEW_LABELS[key]}
                    <ViewCount
                      count={viewCounts?.[key]}
                      className="ml-auto pl-3 text-xs text-[var(--admin-text-muted)]"
                    />
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </nav>

      {canViewAll ? (
        <>
          {/* Desktop saved-view bar — full pill strip with save/remove */}
          <div className="hidden md:block">
            <SavedViewBar
              views={savedViews.map((view) => ({ id: view.id, label: view.label }))}
              activeId={activeSavedViewId}
              onApply={handleApplySavedView}
              onSave={handleSaveView}
              onRemove={handleRemoveView}
            />
          </div>
          {/* Mobile saved-view strip — read-only horizontal scroll, only when views exist */}
          {savedViews.length > 0 ? (
            <div
              className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 md:hidden"
              aria-label="Saved views"
            >
              {savedViews.map((view) => {
                const isActive = view.id === activeSavedViewId;
                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => handleApplySavedView(view.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                      isActive
                        ? "border-[var(--admin-border-form)] bg-[var(--admin-selected-sky)] text-[var(--admin-heading)]"
                        : "border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]"
                    )}
                  >
                    {view.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}

      <div className="hidden md:block">
        <FilterForm
          currentView={currentView}
          query={query}
          services={services}
          staff={staff}
          canViewAll={canViewAll}
        />
      </div>

      <div className="flex items-center gap-2 md:hidden">
        <AdminSheet
          title="Refine"
          description="Filter the booking list."
          side="bottom"
          trigger={
            <button
              type="button"
              className="inline-flex h-9 appearance-none items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              aria-label={
                activeFilterCount > 0
                  ? `Refine, ${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`
                  : "Refine"
              }
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Refine
              {activeFilterCount > 0 ? (
                <span
                  aria-hidden="true"
                  title={`${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`}
                  className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--admin-status-pending-bg)] px-1.5 text-[0.6875rem] font-semibold text-[var(--admin-status-pending-text)]"
                >
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          }
        >
          <FilterForm
            currentView={currentView}
            query={query}
            services={services}
            staff={staff}
            canViewAll={canViewAll}
            mobile
          />
        </AdminSheet>
      </div>

      {activeFilters.length > 0 ? (
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 sm:flex-wrap sm:overflow-visible">
          {activeFilters.map((filter) => (
            <ActiveFilterChip
              key={filter.name}
              label={filter.label}
              value={filter.display}
              onClear={() => clearFilter(filter.name)}
            />
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="ml-1 shrink-0 appearance-none rounded-full border-0 bg-transparent px-2 py-1 text-xs font-medium text-[var(--admin-body)] outline-none hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * C-16 Step 6 — a chip's booking count. Read aloud, a bare number is ambiguous
 * ("Claimable 4"), so the badge is hidden from assistive tech and a spelled-out
 * equivalent rides alongside it. Renders nothing when the count is unknown.
 */
function ViewCount({
  count,
  className,
}: {
  count: number | undefined;
  className?: string;
}) {
  if (count === undefined) return null;
  return (
    <>
      <span aria-hidden="true" className={cn("tabular-nums", className)}>
        {count}
      </span>
      <span className="sr-only">
        , {count} booking{count === 1 ? "" : "s"}
      </span>
    </>
  );
}

function FilterForm({
  currentView,
  query,
  services,
  staff,
  canViewAll,
  mobile = false,
}: Omit<Props, "staffId"> & { mobile?: boolean }) {
  const getVal = (key: string) => {
    const raw = query[key];
    return Array.isArray(raw) ? raw[0] : raw ?? "";
  };

  return (
    <form
      action="/admin/bookings"
      method="GET"
      className={cn(
        "grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3",
        mobile ? "" : "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      )}
    >
      <input type="hidden" name="view" value={currentView} />

      <FieldText
        label="Search"
        name="search"
        defaultValue={getVal("search")}
        placeholder="Client name, phone, or booking ID"
      />
      <FieldText
        label="From"
        name="from"
        type="date"
        defaultValue={getVal("from")}
      />
      <FieldText
        label="To"
        name="to"
        type="date"
        defaultValue={getVal("to")}
      />
      <FieldSelect label="Status" name="status" defaultValue={getVal("status")}>
        <option value="">Any status</option>
        <option value="pending">Pending</option>
        <option value="confirmed">Confirmed</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
        <option value="no_show">No show</option>
      </FieldSelect>
      <FieldSelect
        label="Assignment"
        name="assignment_status"
        defaultValue={getVal("assignment_status")}
      >
        <option value="">Any assignment</option>
        <option value="unassigned">Unassigned</option>
        <option value="partially_assigned">Partially assigned</option>
        <option value="fully_assigned">Fully assigned</option>
      </FieldSelect>
      {canViewAll ? (
        <FieldSelect
          label="Payment"
          name="payment_status"
          defaultValue={getVal("payment_status")}
        >
          <option value="">Any payment</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
        </FieldSelect>
      ) : null}
      {canViewAll ? (
        <FieldSelect
          label="Gender required"
          name="required_gender"
          defaultValue={getVal("required_gender")}
        >
          <option value="">Any gender</option>
          <option value="male">Male therapist</option>
          <option value="female">Female therapist</option>
        </FieldSelect>
      ) : null}
      {canViewAll ? (
        <FieldText
          label="Location"
          name="location"
          defaultValue={getVal("location")}
          placeholder="City or area"
        />
      ) : null}
      {canViewAll ? (
        <FieldSelect label="Service" name="service" defaultValue={getVal("service")}>
          <option value="">Any service</option>
          {services.map((service) => (
            <option key={service.slug} value={service.name}>
              {service.name}
            </option>
          ))}
        </FieldSelect>
      ) : null}
      {canViewAll ? (
        <FieldSelect
          label="Assigned to"
          name="assigned_staff"
          defaultValue={getVal("assigned_staff")}
        >
          <option value="">Anyone</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </FieldSelect>
      ) : null}

      <div
        className={cn(
          "flex flex-wrap gap-2 pt-1",
          mobile ? "" : "md:col-span-2 lg:col-span-3 xl:col-span-4"
        )}
      >
        <button
          type="submit"
          className={cn(
            "appearance-none",
            mobile
              ? "inline-flex h-10 flex-1 items-center justify-center rounded-[var(--admin-radius-control)] border-0 bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              : "inline-flex h-9 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          )}
        >
          Apply filters
        </button>
        <Link
          href={`/admin/bookings?view=${currentView}`}
          className={cn(
            mobile
              ? "inline-flex h-10 items-center justify-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-text-muted)] outline-none hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              : "inline-flex h-9 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-text-muted)] outline-none hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          )}
        >
          {mobile ? "Clear" : "Clear filters"}
        </Link>
      </div>
    </form>
  );
}

function FieldText({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const id = `bookings-filter-${name}`;
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={id}
        className="text-xs font-medium text-[var(--admin-heading)]"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="h-10 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
      />
    </div>
  );
}

function FieldSelect({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  const id = `bookings-filter-${name}`;
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={id}
        className="text-xs font-medium text-[var(--admin-heading)]"
      >
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        className="h-10 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
      >
        {children}
      </select>
    </div>
  );
}
