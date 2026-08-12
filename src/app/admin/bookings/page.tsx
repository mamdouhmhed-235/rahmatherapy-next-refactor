import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  Inbox,
  Plus,
  SearchX,
  UserPlus,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/rbac";
import { LIST_PAGE_SIZE, paginateInMemory } from "@/lib/pagination";
import {
  AdminAccessDenied,
  AdminPageHeader,
} from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { PaginationBar } from "../components/PaginationBar";
import { BookingCardSkeletonList } from "../components/admin-scalable-lists";
import { BookingsChrome, type BookingViewKey } from "./BookingsChrome";
import { BookingCard } from "./BookingCard";
import {
  canManageAllBookings,
  canManageBookings,
  hasClaimableAssignment,
  isOwnBooking,
} from "./access";
import { getTodayIsoDate } from "./_helpers";
import { formatDate } from "./format";
import {
  bookingListFiltersFromQuery,
  getBookingViewCounts,
  getBookingsChromeData,
  getBookingsListPage,
  visibleBookingViews,
  type BookingsListPage,
} from "./bookings-list-data";
import type { BookingRecord } from "./types";

// Re-exported for any existing caller that imported this from here (Step 8,
// C-05 Phase C) — the implementation now lives in ./_helpers, shared with
// [bookingId]/page.tsx.
export { getTodayIsoDate };

export const metadata = {
  title: "Bookings - Rahma Therapy Admin",
};

// BOOKING_SELECT, CLAIMABLE_BOOKING_SELECT, normalizeClaimableBooking and
// getScopedBookingIds moved to ./bookings-list-data.ts with the fetch
// (C-09 Phase C Step 5). getScopedBookingIds is re-exported from here so
// dashboard/page.tsx's existing import path keeps working unchanged.
export { getScopedBookingIds } from "./bookings-list-data";

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function filterBookings(
  bookings: BookingRecord[],
  query: Record<string, string | string[] | undefined>,
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>,
  currentView: BookingViewKey // C-07 Phase B3 (D5) — the already-resolved,
  // role-aware default (page.tsx:225-226); no longer recomputed here so
  // chrome (`view={currentView}`) and results can't silently diverge.
) {
  const view = currentView;
  const search = getQueryValue(query.search)?.trim().toLowerCase() ?? "";
  const status = getQueryValue(query.status) ?? "";
  const assignmentStatus = getQueryValue(query.assignment_status) ?? "";
  const paymentStatus = getQueryValue(query.payment_status) ?? "";
  const gender = getQueryValue(query.required_gender) ?? "";
  const service = getQueryValue(query.service) ?? "";
  const location = getQueryValue(query.location)?.trim().toLowerCase() ?? "";
  const assignedStaff = getQueryValue(query.assigned_staff) ?? "";
  const from = getQueryValue(query.from) ?? "";
  const to = getQueryValue(query.to) ?? "";
  // C-02 Phase H (plan Step 23) — narrows the Series view to one template
  // when present. This is the exact seam Phase F's series-view "View all N
  // visits" link depends on (`/admin/bookings?view=series&templateId=<id>`);
  // matching `view === "series"` alone would satisfy the link's URL but not
  // its promise of showing only that series.
  const templateId = getQueryValue(query.templateId) ?? "";
  const today = getTodayIsoDate();

  // C-05 Phase D (Edit Point 8, brief §1.5/§2.7) — most views unconditionally
  // excluded cancelled/no_show before the status filter below ever ran, so
  // picking Status = Cancelled/No show on any view but the dedicated
  // "Cancelled / No-show" tab or "All" returned 0 rows. An explicit pick of
  // one of those two statuses suspends that view-level exclusion; "Any
  // status" (no filter) still hides them everywhere else (S1(b), locked).
  const userWantsInertStatus = status === "cancelled" || status === "no_show";

  return bookings.filter((booking) => {
    // C-02 Phase H — "series" is archive-like: Phase F's "View all N visits"
    // link promises the FULL series (its own page caps at 10 upcoming + 5
    // past), so cancelled/no_show occurrences must stay visible here too.
    const viewIsArchive =
      view === "cancelled" || view === "all" || view === "series";
    if (
      !viewIsArchive &&
      !userWantsInertStatus &&
      ["cancelled", "no_show"].includes(booking.status)
    ) {
      return false;
    }

    const matchesView =
      view === "all" ||
      (view === "attention" &&
        (booking.status === "pending" ||
          booking.assignment_status !== "fully_assigned" ||
          booking.reschedule_status === "requested" ||
          Boolean(booking.customer_cancelled_at))) ||
      (view === "assigned" && isOwnBooking(booking, profile)) ||
      // CLAIMABLE stays unconditionally strict — cancelled/no_show are never
      // claimable regardless of the status filter (C-05 lockdown invariant).
      (view === "claimable" &&
        !["cancelled", "no_show"].includes(booking.status) &&
        booking.booking_date >= today &&
        hasClaimableAssignment(booking, profile, today)) ||
      // TODAY / UPCOMING / UNASSIGNED / PARTIALLY_ASSIGNED: the inert-status
      // exclusion is handled by the early return above, so these branches
      // only need to check view membership now.
      (view === "today" && booking.booking_date === today) ||
      (view === "upcoming" &&
        booking.booking_date >= today &&
        booking.status !== "completed") ||
      (view === "unassigned" && booking.assignment_status === "unassigned") ||
      (view === "partially_assigned" &&
        booking.assignment_status === "partially_assigned") ||
      (view === "completed" && booking.status === "completed") ||
      (view === "cancelled" &&
        ["cancelled", "no_show"].includes(booking.status)) ||
      (view === "series" &&
        (templateId
          ? booking.recurring_template_id === templateId
          : booking.recurring_template_id !== null));

    if (!matchesView) return false;
    if (status && booking.status !== status) return false;
    if (assignmentStatus && booking.assignment_status !== assignmentStatus) return false;
    if (paymentStatus && booking.payment_status !== paymentStatus) return false;
    if (from && booking.booking_date < from) return false;
    if (to && booking.booking_date > to) return false;
    if (
      gender &&
      !booking.booking_assignments.some(
        (assignment) => assignment.required_therapist_gender === gender
      )
    ) {
      return false;
    }
    if (
      service &&
      !booking.booking_items.some((item) => item.service_name_snapshot === service)
    ) {
      return false;
    }
    if (
      assignedStaff &&
      !booking.booking_assignments.some(
        (assignment) => assignment.assigned_staff_id === assignedStaff
      )
    ) {
      return false;
    }
    if (
      location &&
      ![
        booking.service_city,
        booking.service_postcode,
        booking.service_address_line1,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(location)
    ) {
      return false;
    }
    if (
      search &&
      ![
        booking.id,
        booking.contact_full_name,
        booking.contact_email,
        booking.contact_phone,
        booking.service_postcode,
        booking.clients?.full_name,
        booking.clients?.email,
        booking.clients?.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search)
    ) {
      return false;
    }

    return true;
  });
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!canManageBookings(profile)) {
    return (
      <AdminAccessDenied
        title="You don't have access to this section"
        message="Contact the owner if you think this is a mistake."
        permission="manage_bookings_all or manage_bookings_assigned"
      />
    );
  }

  const canViewAll = canManageAllBookings(profile);
  const defaultView: BookingViewKey = canViewAll ? "attention" : "today";
  const currentView = (getQueryValue(query.view) ?? defaultView) as BookingViewKey;

  // Lightweight chrome data — filter dropdown options only — plus the chip
  // counts (C-16 Step 6), which the chrome renders alongside the labels.
  const [{ services, staff }, viewCounts] = await Promise.all([
    getBookingsChromeData(canViewAll),
    getVisibleViewCounts({ query, profile, canViewAll, currentView }),
  ]);

  return (
    <div>
      <AdminPageHeader
        title={canViewAll ? "Bookings" : "My bookings"}
        description={
          canViewAll
            ? "Triage today's queue, confirm pending bookings, and keep the schedule clear."
            : "Sessions assigned to you, plus open bookings you can claim."
        }
        actions={
          canViewAll ? (
            <Link
              href="/admin/bookings/new"
              className="inline-flex h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <Plus className="size-4" aria-hidden="true" />
              New booking
            </Link>
          ) : null
        }
      />

      <BookingsChrome
        currentView={currentView}
        query={query}
        services={services}
        staff={staff}
        canViewAll={canViewAll}
        staffId={profile.id}
        viewCounts={viewCounts}
      />

      {/* Suspense boundary: chrome stays rendered while the list data streams in. */}
      <div className="mt-5">
        <Suspense fallback={<BookingCardSkeletonList rows={5} />}>
          <BookingListSection
            query={query}
            profile={profile}
            canViewAll={canViewAll}
            currentView={currentView}
          />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * C-16 Phase C Step 6 — one count per RENDERED chip, each computed with the
 * predicate that chip's own view would use.
 *
 * Clinic-wide: `getBookingViewCounts` re-uses the request's own
 * `BookingPredicateContext` with only `view` swapped and runs it through
 * `buildBookingPredicatePlan` — the same builder the list query uses — so a
 * chip cannot advertise a number its view would not show.
 *
 * Therapist-scoped: that branch has no SQL predicate to reuse. Its list IS
 * `filterBookings` over the merged id-bounded reads (see `BookingListSection`),
 * so its chip counts are that same oracle, once per chip, over rows already
 * fetched — `getBookingsListPage` here and there share one `unstable_cache`
 * entry, so this is not a second read.
 *
 * Counts are decoration: a failure here must not take the page down, so it
 * degrades to unlabelled chips and leaves the list its own error panel.
 */
async function getVisibleViewCounts({
  query,
  profile,
  canViewAll,
  currentView,
}: {
  query: Record<string, string | string[] | undefined>;
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>;
  canViewAll: boolean;
  currentView: BookingViewKey;
}): Promise<Partial<Record<BookingViewKey, number>> | undefined> {
  const views = visibleBookingViews(canViewAll);
  const filters = bookingListFiltersFromQuery(query, currentView);

  try {
    if (canViewAll) {
      return await getBookingViewCounts({ profile, filters, views });
    }
    const { rows } = await getBookingsListPage({ profile, canViewAll, filters });
    const counts: Partial<Record<BookingViewKey, number>> = {};
    for (const view of views) {
      counts[view] = filterBookings(rows, query, profile, view).length;
    }
    return counts;
  } catch (countError) {
    console.error("[bookings] failed to load view counts", countError);
    return undefined;
  }
}

async function BookingListSection({
  query,
  profile,
  canViewAll,
  currentView,
}: {
  query: Record<string, string | string[] | undefined>;
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>;
  canViewAll: boolean;
  currentView: BookingViewKey;
}) {
  // C-05 Phase D (Edit Point 9) — computed once and threaded down to each
  // row card so `isInertRow` doesn't reconstruct an Intl.DateTimeFormat per row.
  const today = getTodayIsoDate();

  // Reconstruct the "try again" URL from the current query params.
  const retryParams = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string" && value.length > 0) retryParams.set(key, value);
  }
  const retryHref = `/admin/bookings?${retryParams.toString()}`;

  // C-16 Step 7 — page navigation keeps every other param; `page` is the only
  // one it rewrites. Every OTHER navigation (view chip, filter form, clearing
  // a filter or a search) drops `page` at its own source, so the window always
  // resets when the result set changes.
  const makePageHref = (nextPage: number) => {
    const params = new URLSearchParams(retryParams);
    params.set("page", String(nextPage));
    return `/admin/bookings?${params.toString()}`;
  };

  let listPage: BookingsListPage;
  try {
    listPage = await getBookingsListPage({
      profile,
      canViewAll,
      filters: bookingListFiltersFromQuery(query, currentView),
      page: getQueryValue(query.page),
    });
  } catch (loadError) {
    // Surface to Sentry / dev console; swallowing the error leaves the
    // crash invisible in production telemetry.
    console.error("[bookings] failed to load list", loadError);
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-status-cancelled-border)] bg-[var(--admin-status-cancelled-bg)] px-6 py-10 text-center"
      >
        <AlertCircle className="size-8 text-[var(--admin-status-cancelled-text)]" aria-hidden="true" />
        <p className="text-sm font-medium text-[var(--admin-status-cancelled-text)]">
          Couldn&apos;t load bookings.
        </p>
        <Link
          href={retryHref}
          className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          Try again
        </Link>
      </div>
    );
  }

  // C-16 Phase C Step 5 — the clinic-wide branch now selects in SQL through
  // `buildBookingPredicatePlan`, so its rows arrive already filtered and
  // already windowed to one page; re-running `filterBookings` over them would
  // narrow a page the count query said was full and make the readout lie.
  // The therapist-scoped branch is NOT paged (two id-bounded reads merged in
  // memory), so it keeps the oracle — which is also what the parity spec
  // measures the SQL plan against.
  const filteredBookings = canViewAll
    ? listPage.rows
    : filterBookings(listPage.rows, query, profile, currentView);

  const searchValue = getQueryValue(query.search);
  const nonSearchFilterNames = [
    "status",
    "assignment_status",
    "payment_status",
    "required_gender",
    "service",
    "location",
    "assigned_staff",
    "from",
    "to",
  ];
  const hasNonSearchFilter = nonSearchFilterNames.some((name) =>
    Boolean(getQueryValue(query[name]))
  );
  // "Search to empty" wins only when search is the ONLY narrowing param.
  // If the user has both a search term and other filters, the broader
  // "Filtered to empty" message is more accurate.
  const emptyMode: "search" | "filtered" | "view" =
    searchValue && !hasNonSearchFilter
      ? "search"
      : searchValue || hasNonSearchFilter
      ? "filtered"
      : "view";

  if (filteredBookings.length === 0) {
    return (
      <BookingsEmptyState
        view={currentView}
        canViewAll={canViewAll}
        emptyMode={emptyMode}
        query={query}
      />
    );
  }

  // ITEM K.1 — the therapist-scoped pager.
  //
  // This branch used to report `pageCount: 1` unconditionally, so
  // `PaginationBar` rendered nothing and a practitioner's list simply ran on
  // until the data layer's cap cut it off, with no page 2 and no notice that
  // anything had been cut. The window has to be taken HERE rather than in the
  // data layer because `filterBookings` above is this branch's view predicate:
  // a window taken before it would be a window of the wrong set, and page one
  // would arrive already short. The clinic-wide branch is windowed in SQL and
  // must never be sliced twice.
  const scopedWindow = paginateInMemory(
    filteredBookings,
    getQueryValue(query.page),
    LIST_PAGE_SIZE
  );
  const visibleBookings = canViewAll ? filteredBookings : scopedWindow.rows;

  const showGrouping =
    new Set(visibleBookings.map((b) => b.booking_date)).size > 1;

  const groupedBookings = showGrouping
    ? Object.entries(
        visibleBookings.reduce<Record<string, BookingRecord[]>>((acc, booking) => {
          (acc[booking.booking_date] ??= []).push(booking);
          return acc;
        }, {})
      ).sort(([a], [b]) => b.localeCompare(a))
    : [["", visibleBookings] as const];

  // Pre-compute a flat row index so the entrance stagger plays in visual order
  // across grouped sections, not per-group. Cap at 12 rows so long lists don't
  // delay the bottom-most cards.
  const flatIndexById = new Map<string, number>();
  let cursor = 0;
  for (const [, list] of groupedBookings) {
    for (const booking of list) {
      flatIndexById.set(booking.id, cursor++);
    }
  }
  const ROW_STAGGER_MAX = 12;
  const ROW_STAGGER_MS = 35;

  return (
    <div className="grid gap-5">
      {groupedBookings.map(([date, list]) => (
        <section key={date || "all"} className="grid gap-3">
          {date ? (
            <h2 className="rahma-fade-up sticky top-0 z-10 -mx-1 px-1 py-1 bg-[var(--admin-canvas,var(--admin-panel-muted))] font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)]">
              {formatDate(date)}
            </h2>
          ) : null}
          <div className="grid gap-3">
            {list.map((booking) => {
              const flatIndex = flatIndexById.get(booking.id) ?? 0;
              const delay =
                flatIndex < ROW_STAGGER_MAX ? flatIndex * ROW_STAGGER_MS : 0;
              return (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  profile={profile}
                  canViewAll={canViewAll}
                  today={today}
                  animationDelay={delay}
                />
              );
            })}
          </div>
        </section>
      ))}

      {/* C-16 Step 7 — closes the interim gap left by Step 5: the clinic-wide
          list has been windowed to LIST_PAGE_SIZE since ca0cc21 with no way to
          reach page 2. Renders nothing at one page. ITEM K.1 — the therapist
          branch now supplies a real count here too, computed above from the
          post-oracle set, so it pages instead of running on to a silent cap. */}
      <PaginationBar
        page={canViewAll ? listPage.page : scopedWindow.page}
        pageCount={canViewAll ? listPage.pageCount : scopedWindow.pageCount}
        total={canViewAll ? listPage.total : scopedWindow.total}
        pageSize={LIST_PAGE_SIZE}
        makeHref={makePageHref}
      />
    </div>
  );
}

function BookingsEmptyState(props: {
  view: BookingViewKey;
  canViewAll: boolean;
  emptyMode: "search" | "filtered" | "view";
  query: Record<string, string | string[] | undefined>;
}) {
  return (
    <div className="rahma-fade-up">
      <BookingsEmptyStateInner {...props} />
    </div>
  );
}

export function buildClearSearchHref(
  view: BookingViewKey,
  query: Record<string, string | string[] | undefined>
) {
  // Preserve every active filter except `search` itself, so "Clear search"
  // doesn't wipe a Location or Status the operator also dialled in. `page` is
  // dropped with the search term (C-16 Step 7): the result set widens, so page
  // 3 of the narrowed list is meaningless.
  const params = new URLSearchParams();
  params.set("view", view);
  for (const [key, raw] of Object.entries(query)) {
    if (key === "view" || key === "search" || key === "page") continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    }
  }
  return `/admin/bookings?${params.toString()}`;
}

function BookingsEmptyStateInner({
  view,
  canViewAll,
  emptyMode,
  query,
}: {
  view: BookingViewKey;
  canViewAll: boolean;
  emptyMode: "search" | "filtered" | "view";
  query: Record<string, string | string[] | undefined>;
}) {
  if (emptyMode === "search") {
    return (
      <EmptyState
        icon={SearchX}
        title="No bookings match that search"
        message="Check the name, phone, or ID and try again."
        action={{ label: "Clear search", href: buildClearSearchHref(view, query) }}
      />
    );
  }

  if (emptyMode === "filtered") {
    return (
      <EmptyState
        icon={SearchX}
        title="No bookings match"
        message="Try adjusting or clearing your filters."
        action={{ label: "Clear filters", href: `/admin/bookings?view=${view}` }}
      />
    );
  }

  switch (view) {
    case "attention":
      return (
        <EmptyState
          icon={CalendarCheck}
          illustrationSrc="/images/admin/empty-states/all-caught-up.svg"
          title="All caught up"
          message="No bookings need your attention right now."
        />
      );
    case "today":
      return (
        <EmptyState
          icon={CalendarCheck}
          illustrationSrc="/images/admin/empty-states/all-caught-up.svg"
          title="All caught up"
          message="Nothing scheduled for today. Quiet days are healthy days."
        />
      );
    case "upcoming":
      return (
        <EmptyState
          icon={CalendarPlus}
          illustrationSrc="/images/admin/empty-states/no-bookings.svg"
          title="Nothing upcoming"
          message="No bookings scheduled beyond today."
          action={
            canViewAll
              ? { label: "New booking", href: "/admin/bookings/new" }
              : undefined
          }
        />
      );
    case "claimable":
      return (
        <EmptyState
          icon={UserPlus}
          title="Nothing to claim"
          message={
            canViewAll
              ? "No unassigned bookings right now."
              : "No unassigned bookings match your profile right now."
          }
        />
      );
    case "completed":
      return (
        <EmptyState
          icon={CalendarCheck}
          title="Nothing completed yet"
          message="Completed bookings will appear here once sessions are marked done."
        />
      );
    case "cancelled":
      return (
        <EmptyState
          icon={CalendarX}
          title="Nothing cancelled"
          message="Cancelled bookings and no-shows will appear here."
        />
      );
    default:
      return (
        <EmptyState
          icon={Inbox}
          title="No bookings here"
          message="Switch tabs or adjust filters to find what you're looking for."
        />
      );
  }
}

