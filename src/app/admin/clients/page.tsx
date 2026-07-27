import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, SlidersHorizontal, UserPlus, Users } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminPageAccess } from "@/lib/auth/admin-access";
import { canManageClientDestructiveOps, getStaffProfile } from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminPageHeader,
  AdminStatusBadge,
  type AdminTone,
} from "../components/admin-ui";
import { AdminSheet } from "../components/admin-ui-interactions";
import { EmptyState } from "../components/EmptyState";
import { formatDate, formatMoney } from "./format";
import { getClientDataAccess } from "./access";
import type { ClientBookingRecord, ClientRecord } from "./types";
import { ClientRowMenu, type LastBookingSummary } from "./ClientRowMenu";
import {
  ClientSelectCheckbox,
  ClientSelectionProvider,
} from "./components/BulkDeleteToolbar";
import { ClientFlashToast } from "./components/DeleteClientButton";

export const metadata = {
  title: "Clients - Rahma Therapy Admin",
};

interface ClientsPageProps {
  searchParams: Promise<{
    q?: string;
    lifecycle?: string;
    payment?: string;
    location?: string;
    source?: string;
    sort?: string;
    page?: string;
    show_deleted?: string;
    deleted?: string;
  }>;
}

// `deleted_at` is selected in BOTH branches on purpose: these two strings are
// the contact-details and no-contact-details RBAC variants of the same read, and
// omitting the column from either would leave soft-deleted clients fully visible
// for that role alone. Nothing static can catch that — both are cast through
// `.returns<ClientRecord[]>()`, so a missing column reads as `undefined` and the
// "Show deleted" scoping below silently passes every row.
//
// The BOOKING_* selects deliberately do NOT carry it: no code path reads
// `booking.deleted_at`, because a soft-deleted booking only ever exists as a
// cascade of its client's deletion, and that client is already filtered out
// here and 404'd on the detail page.
const CLIENT_SELECT = `
  id,
  full_name,
  phone,
  email,
  address,
  postcode,
  client_source,
  source_detail,
  created_at,
  updated_at,
  deleted_at
`;

const CLIENT_SAFE_SELECT = `
  id,
  full_name,
  client_source,
  source_detail,
  created_at,
  updated_at,
  deleted_at
`;

const BOOKING_SELECT = `
  id,
  client_id,
  booking_date,
  start_time,
  end_time,
  status,
  payment_status,
  assignment_status,
  group_booking,
  total_price,
  amount_due,
  amount_paid,
  booking_source,
  contact_full_name,
  contact_email,
  contact_phone,
  service_city,
  service_postcode,
  service_address_line1,
  created_at,
  booking_items(service_name_snapshot, service_price_snapshot, service_duration_snapshot)
`;

const BOOKING_SAFE_SELECT = `
  id,
  client_id,
  booking_date,
  start_time,
  end_time,
  status,
  payment_status,
  assignment_status,
  group_booking,
  total_price,
  amount_due,
  amount_paid,
  booking_source,
  service_city,
  created_at,
  booking_items(service_name_snapshot, service_price_snapshot, service_duration_snapshot)
`;

const AZ_THRESHOLD = 40;
const MS_PER_DAY = 86_400_000;
const PAGE_SIZE = 50;

type LifecycleKey = "new" | "returning" | "at_risk" | "lapsed";
type SortKey = "name" | "last_visit";

const LIFECYCLE_LABEL: Record<LifecycleKey, string> = {
  new: "New",
  returning: "Returning",
  at_risk: "At-risk",
  lapsed: "Lapsed",
};

const LIFECYCLE_TONE: Record<LifecycleKey, AdminTone> = {
  new: "info",
  returning: "success",
  at_risk: "warning",
  lapsed: "restricted",
};

const LIFECYCLE_TITLE: Record<LifecycleKey, string> = {
  new: "New: joined within the last 30 days",
  returning: "Returning: 3 or more visits",
  at_risk: "At-risk: last visit over 3 months ago",
  lapsed: "Lapsed: last visit over 6 months ago",
};

function matchesSearch(
  client: ClientRecord,
  query: string,
  canSearchContactDetails: boolean
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    client.full_name,
    ...(canSearchContactDetails ? [client.phone, client.email] : []),
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

function getOutstandingAmount(bookings: ClientBookingRecord[]) {
  return bookings.reduce((total, booking) => {
    const due = Number(booking.amount_due ?? booking.total_price ?? 0);
    const paid = Number(booking.amount_paid ?? 0);
    return total + Math.max(0, due - paid);
  }, 0);
}

function hasRefund(bookings: ClientBookingRecord[]) {
  return bookings.some((booking) => booking.payment_status === "refunded");
}

function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function isCompletedVisit(booking: ClientBookingRecord, today: string): boolean {
  if (booking.status === "cancelled" || booking.status === "no_show") return false;
  return booking.booking_date < today;
}

function isUpcomingBooking(booking: ClientBookingRecord, today: string): boolean {
  if (booking.status === "cancelled") return false;
  return booking.booking_date >= today;
}

function getLastCompletedVisit(
  bookings: ClientBookingRecord[],
  today: string
): ClientBookingRecord | null {
  let latest: ClientBookingRecord | null = null;
  for (const booking of bookings) {
    if (!isCompletedVisit(booking, today)) continue;
    if (!latest || booking.booking_date > latest.booking_date) latest = booking;
  }
  return latest;
}

function getNextUpcomingBooking(
  bookings: ClientBookingRecord[],
  today: string
): ClientBookingRecord | null {
  let earliest: ClientBookingRecord | null = null;
  for (const booking of bookings) {
    if (!isUpcomingBooking(booking, today)) continue;
    if (!earliest || booking.booking_date < earliest.booking_date) earliest = booking;
  }
  return earliest;
}

function countCompletedVisits(
  bookings: ClientBookingRecord[],
  today: string
): number {
  return bookings.reduce(
    (total, booking) => (isCompletedVisit(booking, today) ? total + 1 : total),
    0
  );
}

function countUpcoming(bookings: ClientBookingRecord[], today: string): number {
  return bookings.reduce(
    (total, booking) => (isUpcomingBooking(booking, today) ? total + 1 : total),
    0
  );
}

function getDaysSince(dateIso: string | null, now: Date): number | null {
  if (!dateIso) return null;
  const then = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / MS_PER_DAY));
}

function getLifecycle(
  client: ClientRecord,
  bookings: ClientBookingRecord[],
  now: Date
): LifecycleKey {
  const today = todayIso(now);
  const lastCompleted = getLastCompletedVisit(bookings, today);
  const completedCount = countCompletedVisits(bookings, today);
  const hasUpcoming = countUpcoming(bookings, today) > 0;
  const createdDays = getDaysSince(client.created_at.slice(0, 10), now);
  const isNewByAge = createdDays !== null && createdDays <= 30;

  if (completedCount === 0) {
    // Never visited yet
    if (hasUpcoming) return isNewByAge ? "new" : "returning";
    return isNewByAge ? "new" : "lapsed";
  }

  const daysSinceLastCompleted = getDaysSince(lastCompleted!.booking_date, now);
  if (daysSinceLastCompleted !== null && !hasUpcoming) {
    if (daysSinceLastCompleted > 180) return "lapsed";
    if (daysSinceLastCompleted > 90) return "at_risk";
  }
  if (completedCount >= 3) return "returning";
  if (isNewByAge) return "new";
  return "returning";
}

function deterministicHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return Array.from(parts[0]).slice(0, 2).join("").toUpperCase();
  }
  const first = Array.from(parts[0])[0] ?? "";
  const last = Array.from(parts[parts.length - 1])[0] ?? "";
  return (first + last).toUpperCase();
}

function letterBucket(name: string): string {
  const letter = (Array.from(name.trim())[0] ?? "#").toUpperCase();
  return /[A-Z]/.test(letter) ? letter : "#";
}

function matchesFilters({
  client,
  bookings,
  lifecycle,
  payment,
  location,
  source,
  canSearchContactDetails,
  now,
}: {
  client: ClientRecord;
  bookings: ClientBookingRecord[];
  lifecycle: string;
  payment: string;
  location: string;
  source: string;
  canSearchContactDetails: boolean;
  now: Date;
}) {
  if (
    lifecycle &&
    (["new", "returning", "at_risk", "lapsed"] as const).includes(lifecycle as LifecycleKey)
  ) {
    if (getLifecycle(client, bookings, now) !== lifecycle) return false;
  }

  if (payment) {
    const outstanding = getOutstandingAmount(bookings);
    const refunded = hasRefund(bookings);
    if (payment === "in_good_standing" && (outstanding > 0 || refunded)) return false;
    if (payment === "outstanding" && outstanding <= 0) return false;
    if (payment === "refund_issued" && !refunded) return false;
  }

  if (source) {
    const matchesSource =
      client.client_source === source ||
      bookings.some((booking) => booking.booking_source === source);
    if (!matchesSource) return false;
  }

  const normalizedLocation = location.trim().toLowerCase();
  if (normalizedLocation) {
    const haystack = [
      ...(canSearchContactDetails ? [client.postcode, client.address] : []),
      ...bookings.flatMap((booking) => [
        booking.service_city,
        booking.service_postcode,
        canSearchContactDetails ? booking.service_address_line1 : null,
      ]),
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());
    if (!haystack.some((value) => value.includes(normalizedLocation))) return false;
  }

  return true;
}

function parseSort(value: string | undefined): SortKey {
  return value === "last_visit" ? "last_visit" : "name";
}

function parseLifecycle(value: string): string {
  return (["new", "returning", "at_risk", "lapsed"] as const).includes(value as LifecycleKey)
    ? value
    : "";
}

function parsePayment(value: string): string {
  return ["in_good_standing", "outstanding", "refund_issued"].includes(value) ? value : "";
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const lifecycle = parseLifecycle(params.lifecycle ?? "");
  const payment = parsePayment(params.payment ?? "");
  const location = params.location ?? "";
  const source = params.source ?? "";
  const sort = parseSort(params.sort);
  const pageParam = parsePage(params.page);
  const showDeleted = params.show_deleted === "1" ? "1" : "";
  const justDeleted = params.deleted === "1";

  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  const pageAccess = getAdminPageAccess(profile, "clients");

  const hasAllClientAccess =
    pageAccess.access &&
    (pageAccess.dataScope === "all" || pageAccess.dataScope === "sensitive_hidden");

  if (!hasAllClientAccess) {
    return (
      <AdminAccessDenied
        title="You don't have access to this section"
        message="Therapists see clients only through their assigned bookings."
        actions={
          <Link
            href="/admin/bookings?view=assigned"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Back to my bookings
          </Link>
        }
      />
    );
  }

  const adminClient = createSupabaseAdminClient();
  const clientAccess = getClientDataAccess(profile, {
    hasAssignedBooking: hasAllClientAccess,
  });
  const canManageClients = clientAccess.canManageClient;
  const clientSelect = clientAccess.canViewContactDetails ? CLIENT_SELECT : CLIENT_SAFE_SELECT;
  const bookingSelect = clientAccess.canViewContactDetails ? BOOKING_SELECT : BOOKING_SAFE_SELECT;

  const [clientsResult, bookingsResult] = await Promise.all([
    adminClient
      .from("clients")
      .select(clientSelect)
      .order("full_name")
      .returns<ClientRecord[]>(),
    adminClient
      .from("bookings")
      .select(bookingSelect)
      .order("booking_date", { ascending: false })
      .order("start_time", { ascending: false })
      .returns<ClientBookingRecord[]>(),
  ]);
  // Soft-deleted clients are hidden by default and reachable through the
  // "Show deleted" toggle (brief §5.3). Everything downstream — stats, counts,
  // pagination — works off the scoped list.
  const allClients: ClientRecord[] = clientsResult.data ?? [];
  const deletedCount = allClients.filter((client) =>
    Boolean(client.deleted_at)
  ).length;
  const clients: ClientRecord[] = showDeleted
    ? allClients
    : allClients.filter((client) => !client.deleted_at);
  const bookings: ClientBookingRecord[] = bookingsResult.data ?? [];
  const canDeleteClients = canManageClientDestructiveOps(profile);

  const now = new Date();
  const bookingsByClientId = new Map<string, ClientBookingRecord[]>();
  for (const booking of bookings) {
    bookingsByClientId.set(booking.client_id, [
      ...(bookingsByClientId.get(booking.client_id) ?? []),
      booking,
    ]);
  }

  const visibleClients = clients.filter((client) => {
    const clientBookings = bookingsByClientId.get(client.id) ?? [];
    return (
      matchesSearch(client, q, clientAccess.canViewContactDetails) &&
      matchesFilters({
        client,
        bookings: clientBookings,
        lifecycle,
        payment,
        location,
        source,
        canSearchContactDetails: clientAccess.canViewContactDetails,
        now,
      })
    );
  });

  const today = todayIso(now);

  type Row = {
    client: ClientRecord;
    bookings: ClientBookingRecord[];
    lifecycle: LifecycleKey;
    lastCompleted: ClientBookingRecord | null;
    nextUpcoming: ClientBookingRecord | null;
    completedCount: number;
    upcomingCount: number;
  };

  const rows: Row[] = visibleClients.map((client) => {
    const clientBookings = bookingsByClientId.get(client.id) ?? [];
    return {
      client,
      bookings: clientBookings,
      lifecycle: getLifecycle(client, clientBookings, now),
      lastCompleted: getLastCompletedVisit(clientBookings, today),
      nextUpcoming: getNextUpcomingBooking(clientBookings, today),
      completedCount: countCompletedVisits(clientBookings, today),
      upcomingCount: countUpcoming(clientBookings, today),
    };
  });

  if (sort === "last_visit") {
    // Sort by most recent completed visit; clients with no completed visits
    // fall back to next upcoming (earliest first), then alphabetical.
    rows.sort((a, b) => {
      const aLast = a.lastCompleted?.booking_date ?? "";
      const bLast = b.lastCompleted?.booking_date ?? "";
      if (aLast && bLast) return bLast.localeCompare(aLast);
      if (aLast) return -1;
      if (bLast) return 1;
      const aNext = a.nextUpcoming?.booking_date ?? "";
      const bNext = b.nextUpcoming?.booking_date ?? "";
      if (aNext && bNext) return aNext.localeCompare(bNext);
      if (aNext) return -1;
      if (bNext) return 1;
      return a.client.full_name.localeCompare(b.client.full_name);
    });
  } else {
    rows.sort((a, b) => a.client.full_name.localeCompare(b.client.full_name));
  }

  // C8 pagination
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const currentPage = Math.min(pageParam, totalPages);
  const pageStartIndex = (currentPage - 1) * PAGE_SIZE;
  const pageEndIndex = Math.min(pageStartIndex + PAGE_SIZE, totalRows);
  const pageRows = rows.slice(pageStartIndex, pageEndIndex);

  // Only live rows are selectable — a deleted row offers "View" and nothing
  // else (brief §5.3).
  const selectableClients = pageRows
    .filter((row) => !row.client.deleted_at)
    .map((row) => ({ id: row.client.id, full_name: row.client.full_name }));

  const totalClientCount = clients.length;
  const isFiltered = Boolean(q || lifecycle || payment || location || source);
  const isAlphaSort = sort === "name";
  const showAzStrip = isAlphaSort && !q && totalClientCount >= AZ_THRESHOLD;

  // C2 stats
  let activeCount = 0;
  let newThisMonthCount = 0;
  let returningCount = 0;
  let atRiskLapsedCount = 0;
  for (const client of clients) {
    const clientBookings = bookingsByClientId.get(client.id) ?? [];
    const lc = getLifecycle(client, clientBookings, now);
    if (lc !== "lapsed") activeCount += 1;
    if (lc === "new") newThisMonthCount += 1;
    if (lc === "returning") returningCount += 1;
    if (lc === "at_risk" || lc === "lapsed") atRiskLapsedCount += 1;
  }

  const groupedRows: { letter: string; rows: Row[] }[] = [];
  if (isAlphaSort) {
    const buckets = new Map<string, Row[]>();
    for (const row of pageRows) {
      const letter = letterBucket(row.client.full_name);
      const list = buckets.get(letter) ?? [];
      list.push(row);
      buckets.set(letter, list);
    }
    for (const letter of Array.from(buckets.keys()).sort()) {
      groupedRows.push({ letter, rows: buckets.get(letter)! });
    }
  }

  const lettersInResults = new Set(groupedRows.map((group) => group.letter));
  const lifecycleChipLabel = lifecycle ? LIFECYCLE_LABEL[lifecycle as LifecycleKey] : null;

  const filterValues = {
    q,
    lifecycle,
    payment,
    location,
    source,
    sort,
    show_deleted: showDeleted,
  };

  const activeChips: { label: string; href: string }[] = [];
  if (q) {
    activeChips.push({
      label: `Search: ${q}`,
      href: buildClearLinkHref(filterValues, "q"),
    });
  }
  if (lifecycle) {
    activeChips.push({
      label: `Lifecycle: ${lifecycleChipLabel ?? lifecycle}`,
      href: buildClearLinkHref(filterValues, "lifecycle"),
    });
  }
  if (payment) {
    activeChips.push({
      label: `Payment: ${formatPaymentLabel(payment)}`,
      href: buildClearLinkHref(filterValues, "payment"),
    });
  }
  if (location) {
    activeChips.push({
      label: `Location: ${location}`,
      href: buildClearLinkHref(filterValues, "location"),
    });
  }
  if (source) {
    activeChips.push({
      label: `Source: ${formatSourceLabel(source)}`,
      href: buildClearLinkHref(filterValues, "source"),
    });
  }

  const mobileFilterForm = (
    <form
      method="get"
      action="/admin/clients"
      className="grid gap-3"
    >
      <FilterFields
        q={q}
        lifecycle={lifecycle}
        payment={payment}
        location={location}
        source={source}
        idSuffix="mobile"
      />
      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-medium text-[var(--admin-heading)]">
          Sort clients by
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <label
            className={`inline-flex h-10 items-center justify-center rounded-[var(--admin-radius-control)] border px-3 text-sm font-medium ${
              sort === "name"
                ? "border-[var(--admin-primary)] bg-[var(--admin-selected-sky)] text-[var(--admin-heading)]"
                : "border-[var(--admin-border-form)] bg-transparent text-[var(--admin-body)]"
            }`}
          >
            <input
              type="radio"
              name="sort"
              value="name"
              defaultChecked={sort === "name"}
              className="sr-only"
            />
            Name A–Z
          </label>
          <label
            className={`inline-flex h-10 items-center justify-center rounded-[var(--admin-radius-control)] border px-3 text-sm font-medium ${
              sort === "last_visit"
                ? "border-[var(--admin-primary)] bg-[var(--admin-selected-sky)] text-[var(--admin-heading)]"
                : "border-[var(--admin-border-form)] bg-transparent text-[var(--admin-body)]"
            }`}
          >
            <input
              type="radio"
              name="sort"
              value="last_visit"
              defaultChecked={sort === "last_visit"}
              className="sr-only"
            />
            Last visit
          </label>
        </div>
      </fieldset>
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        Apply filters
      </button>
    </form>
  );

  return (
    <div className="grid gap-5 pb-24 lg:pb-16">
      {justDeleted ? (
        <ClientFlashToast message="Client deleted." param="deleted" />
      ) : null}
      <AdminPageHeader
        title="Clients"
        actions={
          canManageClients ? (
            <Link
              href="/admin/clients/new"
              className="inline-flex h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <Plus className="size-4" aria-hidden="true" />
              New client
            </Link>
          ) : null
        }
      />

      {/* C2 stats line — replaces filler description */}
      <p
        className="-mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-[var(--admin-text-muted)]"
        aria-label="Client base summary"
      >
        <StatLink
          label={`${activeCount} active`}
          href="/admin/clients"
          active={!lifecycle}
        />
        <Dot />
        <StatLink
          label={`${newThisMonthCount} new this month`}
          href={buildFilterHref(filterValues, "lifecycle", "new")}
          active={lifecycle === "new"}
        />
        <Dot />
        <StatLink
          label={`${returningCount} returning`}
          href={buildFilterHref(filterValues, "lifecycle", "returning")}
          active={lifecycle === "returning"}
        />
        <Dot />
        <StatLink
          label={`${atRiskLapsedCount} at risk or lapsed`}
          href={buildFilterHref(filterValues, "lifecycle", "at_risk")}
          active={lifecycle === "at_risk" || lifecycle === "lapsed"}
        />
      </p>

      {/* Desktop filter bar (≥lg) — GET form */}
      <form
        method="get"
        action="/admin/clients"
        className="hidden gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3 lg:grid lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end"
      >
        <FilterField label="Search" htmlFor="clients-q">
          <input
            id="clients-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search by name, email, or phone"
            autoComplete="off"
            className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
          />
        </FilterField>
        <FilterField label="Lifecycle" htmlFor="clients-lifecycle">
          <FilterSelect id="clients-lifecycle" name="lifecycle" defaultValue={lifecycle}>
            <option value="">Any lifecycle</option>
            <option value="new">New</option>
            <option value="returning">Returning</option>
            <option value="at_risk">At-risk</option>
            <option value="lapsed">Lapsed</option>
          </FilterSelect>
        </FilterField>
        <FilterField label="Payment" htmlFor="clients-payment">
          <FilterSelect id="clients-payment" name="payment" defaultValue={payment}>
            <option value="">Any payment</option>
            <option value="in_good_standing">In good standing</option>
            <option value="outstanding">Has outstanding</option>
            <option value="refund_issued">Refund issued</option>
          </FilterSelect>
        </FilterField>
        <FilterField label="Location" htmlFor="location">
          <input
            id="location"
            name="location"
            type="text"
            defaultValue={location}
            placeholder="City or area"
            autoComplete="off"
            className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
          />
        </FilterField>
        <FilterField label="Source" htmlFor="clients-source">
          <FilterSelect id="clients-source" name="source" defaultValue={source}>
            <option value="">Any source</option>
            <option value="website">Website</option>
            <option value="phone">Phone</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="referral">Referral</option>
            <option value="manual">Manual</option>
            <option value="other">Other</option>
          </FilterSelect>
        </FilterField>
        <input type="hidden" name="sort" value={sort} />
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          Apply filters
        </button>
      </form>

      {/* Mobile + tablet filter trigger (<lg) — AdminSheet bottom drawer */}
      <div className="lg:hidden">
        <AdminSheet
          title="Refine"
          description="Filter and sort the directory."
          side="bottom"
          trigger={
            <button
              type="button"
              className="inline-flex h-11 w-full items-center justify-between gap-2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <span className="inline-flex items-center gap-1.5">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Refine
                {activeChips.length > 0 ? (
                  <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--admin-primary)] px-1.5 text-[0.6875rem] font-semibold text-[var(--admin-on-primary)]">
                    {activeChips.length}
                  </span>
                ) : null}
              </span>
            </button>
          }
        >
          {mobileFilterForm}
        </AdminSheet>
      </div>

      {/* Sort toggle + count summary — frameless (A11) */}
      <div className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
        <p className="text-sm text-[var(--admin-text-muted)]">
          {totalRows === 0 ? (
            <>0 of {totalClientCount} clients</>
          ) : totalRows > PAGE_SIZE ? (
            <>
              {pageStartIndex + 1}–{pageEndIndex} of {totalRows} clients
              {totalRows !== totalClientCount ? (
                <> (filtered from {totalClientCount})</>
              ) : null}
            </>
          ) : (
            <>
              {totalRows} of {totalClientCount} client{totalClientCount === 1 ? "" : "s"}
            </>
          )}
        </p>
        <div
          role="group"
          aria-label="Sort clients by"
          className="inline-flex items-center gap-1 rounded-[var(--admin-radius-control)] bg-[var(--admin-surface-input)] p-1"
        >
          <SortLink
            label="Name A–Z"
            href={buildSortHref(filterValues, "name")}
            active={sort === "name"}
            srHint="Sort alphabetically by name"
          />
          <SortLink
            label="Last visit"
            href={buildSortHref(filterValues, "last_visit")}
            active={sort === "last_visit"}
            srHint="Sort by most recent visit first"
          />
        </div>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 ? (
        <ul className="-mt-1 flex flex-wrap gap-2" aria-label="Active filters">
          {activeChips.map((chip) => (
            <li key={chip.label}>
              <Link
                href={chip.href}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--admin-border-form)] bg-[var(--admin-panel)] px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                {chip.label}
                <span aria-hidden="true">×</span>
                <span className="sr-only">remove</span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/admin/clients"
              className="inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold text-[var(--admin-primary)] underline-offset-4 hover:underline"
            >
              Clear filters
            </Link>
          </li>
        </ul>
      ) : null}

      {/* Soft-deleted visibility (brief §5.3) — hidden by default, and the
          toggle only appears when there is something behind it. */}
      {deletedCount > 0 || showDeleted ? (
        <div className="-mt-1">
          <Link
            href={buildShowDeletedHref(filterValues, !showDeleted)}
            className="inline-flex h-8 items-center rounded-full border border-[var(--admin-border-form)] bg-[var(--admin-panel)] px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            {showDeleted ? "Hide deleted" : `Show deleted (${deletedCount})`}
          </Link>
        </div>
      ) : null}

      {/* Body */}
      {pageRows.length === 0 ? (
        isFiltered ? (
          <EmptyState
            icon={Users}
            title={q ? `No clients match "${q}"` : "No clients match"}
            message={
              q
                ? "Check the spelling, or try a phone number."
                : "Try adjusting or clearing your filters."
            }
            action={{ label: "Clear filters", href: "/admin/clients" }}
          />
        ) : (
          <EmptyState
            icon={UserPlus}
            illustrationSrc="/images/admin/empty-states/no-clients.svg"
            title="No clients yet"
            message="Add a client to start a history, or take a booking and we'll create one."
            action={
              canManageClients
                ? { label: "New client", href: "/admin/clients/new" }
                : undefined
            }
          />
        )
      ) : (
        <ClientSelectionProvider
          enabled={canDeleteClients}
          clients={selectableClients}
        >
          <div
            className={`relative ${showAzStrip ? "lg:pr-12" : ""}`}
            aria-busy={false}
          >
            {isAlphaSort ? (
              <div className="grid gap-6">
                {groupedRows.map((group) => (
                  <section key={group.letter} aria-labelledby={`section-${group.letter}`}>
                    <div className="sticky top-[var(--admin-topnav-offset,0px)] z-10 mb-2 flex items-baseline gap-3 bg-[var(--admin-surface)] pt-1 pb-1">
                      <h2
                        id={`section-${group.letter}`}
                        className="font-display text-[1.333rem] font-semibold leading-none tracking-[-0.01em] text-[var(--admin-heading)]"
                      >
                        {group.letter}
                      </h2>
                      <span
                        aria-hidden="true"
                        className="h-px flex-1 bg-[var(--admin-border)]"
                      />
                    </div>
                    <ul className="grid list-none gap-1.5 p-0">
                      {group.rows.map((row) => (
                        <ClientRow
                          key={row.client.id}
                          row={row}
                          showContact={clientAccess.canViewContactDetails}
                          canDelete={canDeleteClients}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <ul className="grid list-none gap-1.5 p-0">
                {pageRows.map((row) => (
                  <ClientRow
                    key={row.client.id}
                    row={row}
                    showContact={clientAccess.canViewContactDetails}
                    canDelete={canDeleteClients}
                  />
                ))}
              </ul>
            )}

            {showAzStrip ? <AzStrip letters={lettersInResults} /> : null}
          </div>
        </ClientSelectionProvider>
      )}

      {/* C8 pagination */}
      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-3"
        >
          <p className="text-xs text-[var(--admin-text-muted)]">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            {currentPage > 1 ? (
              <Link
                href={buildPageHref(filterValues, currentPage - 1)}
                className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3 text-xs font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Previous
              </Link>
            ) : (
              <span
                aria-hidden="true"
                className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] px-3 text-xs font-semibold text-[var(--admin-text-muted)]/60"
              >
                Previous
              </span>
            )}
            {currentPage < totalPages ? (
              <Link
                href={buildPageHref(filterValues, currentPage + 1)}
                className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3 text-xs font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Next
              </Link>
            ) : (
              <span
                aria-hidden="true"
                className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] px-3 text-xs font-semibold text-[var(--admin-text-muted)]/60"
              >
                Next
              </span>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function buildClearLinkHref(
  values: {
    q: string;
    lifecycle: string;
    payment: string;
    location: string;
    source: string;
    sort: SortKey;
    show_deleted: string;
  },
  drop: keyof typeof values
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (key === drop) continue;
    if (key === "sort" && value === "name") continue;
    if (typeof value === "string" && value.length > 0) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/admin/clients?${qs}` : "/admin/clients";
}

function buildSortHref(
  values: {
    q: string;
    lifecycle: string;
    payment: string;
    location: string;
    source: string;
    show_deleted: string;
  },
  next: SortKey
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string" && value.length > 0) params.set(key, value);
  }
  if (next !== "name") params.set("sort", next);
  const qs = params.toString();
  return qs ? `/admin/clients?${qs}` : "/admin/clients";
}

function buildFilterHref(
  values: {
    q: string;
    lifecycle: string;
    payment: string;
    location: string;
    source: string;
    sort: SortKey;
    show_deleted: string;
  },
  key: "lifecycle",
  value: string
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) {
    if (k === key) continue;
    if (k === "sort" && v === "name") continue;
    if (typeof v === "string" && v.length > 0) params.set(k, v);
  }
  if (value) params.set(key, value);
  const qs = params.toString();
  return qs ? `/admin/clients?${qs}` : "/admin/clients";
}

function buildPageHref(
  values: {
    q: string;
    lifecycle: string;
    payment: string;
    location: string;
    source: string;
    sort: SortKey;
    show_deleted: string;
  },
  next: number
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) {
    if (k === "sort" && v === "name") continue;
    if (typeof v === "string" && v.length > 0) params.set(k, v);
  }
  if (next > 1) params.set("page", String(next));
  const qs = params.toString();
  return qs ? `/admin/clients?${qs}` : "/admin/clients";
}

function buildShowDeletedHref(
  values: {
    q: string;
    lifecycle: string;
    payment: string;
    location: string;
    source: string;
    sort: SortKey;
    show_deleted: string;
  },
  next: boolean
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (key === "show_deleted") continue;
    if (key === "sort" && value === "name") continue;
    if (typeof value === "string" && value.length > 0) params.set(key, value);
  }
  if (next) params.set("show_deleted", "1");
  const qs = params.toString();
  return qs ? `/admin/clients?${qs}` : "/admin/clients";
}

function formatPaymentLabel(value: string): string {
  if (value === "in_good_standing") return "In good standing";
  if (value === "outstanding") return "Has outstanding";
  if (value === "refund_issued") return "Refund issued";
  return value;
}

function formatSourceLabel(value: string): string {
  const map: Record<string, string> = {
    website: "Website",
    phone: "Phone",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    referral: "Referral",
    manual: "Manual",
    other: "Other",
  };
  return map[value] ?? value;
}

function Dot() {
  return (
    <span aria-hidden="true" className="text-[var(--admin-text-muted)]/50">
      ·
    </span>
  );
}

function StatLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-[var(--admin-radius-control)] px-1.5 py-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 ${
        active
          ? "bg-[var(--admin-selected-sky)] font-semibold text-[var(--admin-heading)]"
          : "hover:text-[var(--admin-body)] hover:underline underline-offset-4"
      }`}
    >
      {label}
    </Link>
  );
}

function SortLink({
  label,
  href,
  active,
  srHint,
}: {
  label: string;
  href: string;
  active: boolean;
  srHint: string;
}) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      role="button"
      className={`inline-flex h-8 items-center rounded-[var(--admin-radius-control)] px-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 ${
        active
          ? "bg-[var(--admin-panel)] text-[var(--admin-heading)] shadow-[0_1px_0_oklch(89%_0.014_78)]"
          : "text-[var(--admin-text-muted)] hover:bg-[var(--admin-panel)]/60 hover:text-[var(--admin-body)]"
      }`}
    >
      {label}
      <span className="sr-only">. {srHint}.</span>
    </Link>
  );
}

function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-[var(--admin-heading)]"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function FilterSelect({
  id,
  name,
  defaultValue,
  children,
}: {
  id: string;
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
    >
      {children}
    </select>
  );
}

function FilterFields({
  q,
  lifecycle,
  payment,
  location,
  source,
  idSuffix,
}: {
  q: string;
  lifecycle: string;
  payment: string;
  location: string;
  source: string;
  idSuffix: string;
}) {
  return (
    <>
      <FilterField label="Search" htmlFor={`clients-q-${idSuffix}`}>
        <input
          id={`clients-q-${idSuffix}`}
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by name, email, or phone"
          autoComplete="off"
          className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
        />
      </FilterField>
      <FilterField label="Lifecycle" htmlFor={`clients-lifecycle-${idSuffix}`}>
        <FilterSelect id={`clients-lifecycle-${idSuffix}`} name="lifecycle" defaultValue={lifecycle}>
          <option value="">Any lifecycle</option>
          <option value="new">New</option>
          <option value="returning">Returning</option>
          <option value="at_risk">At-risk</option>
          <option value="lapsed">Lapsed</option>
        </FilterSelect>
      </FilterField>
      <FilterField label="Payment" htmlFor={`clients-payment-${idSuffix}`}>
        <FilterSelect id={`clients-payment-${idSuffix}`} name="payment" defaultValue={payment}>
          <option value="">Any payment</option>
          <option value="in_good_standing">In good standing</option>
          <option value="outstanding">Has outstanding</option>
          <option value="refund_issued">Refund issued</option>
        </FilterSelect>
      </FilterField>
      <FilterField label="Location" htmlFor={`location-${idSuffix}`}>
        <input
          id={`location-${idSuffix}`}
          name="location"
          type="text"
          defaultValue={location}
          placeholder="City or area"
          autoComplete="off"
          className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
        />
      </FilterField>
      <FilterField label="Source" htmlFor={`clients-source-${idSuffix}`}>
        <FilterSelect id={`clients-source-${idSuffix}`} name="source" defaultValue={source}>
          <option value="">Any source</option>
          <option value="website">Website</option>
          <option value="phone">Phone</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="referral">Referral</option>
          <option value="manual">Manual</option>
          <option value="other">Other</option>
        </FilterSelect>
      </FilterField>
    </>
  );
}

function ClientRow({
  row,
  showContact,
  canDelete,
}: {
  row: {
    client: ClientRecord;
    bookings: ClientBookingRecord[];
    lifecycle: LifecycleKey;
    lastCompleted: ClientBookingRecord | null;
    nextUpcoming: ClientBookingRecord | null;
    completedCount: number;
    upcomingCount: number;
  };
  showContact: boolean;
  canDelete: boolean;
}) {
  const { client, lifecycle, lastCompleted, nextUpcoming, completedCount, upcomingCount } = row;
  const hue = deterministicHue(client.id);
  const tone = LIFECYCLE_TONE[lifecycle];
  const lifecycleLabel = LIFECYCLE_LABEL[lifecycle];
  const initials = getInitials(client.full_name);
  const isLapsed = lifecycle === "lapsed";
  const isDeleted = Boolean(client.deleted_at);

  // D4 lapsed clients render at reduced saturation; a soft-deleted row is
  // dimmer still and struck through (brief §5.3).
  const rowOpacity = isDeleted ? "opacity-60" : isLapsed ? "opacity-75" : "";

  // Primary timeline line — prefers last visit (completed), falls back to next upcoming.
  let timelineLabel: string;
  let timelinePrefix: string;
  if (lastCompleted) {
    timelinePrefix = "Last visit";
    timelineLabel = formatDate(lastCompleted.booking_date);
  } else if (nextUpcoming) {
    timelinePrefix = "Next visit";
    timelineLabel = formatDate(nextUpcoming.booking_date);
  } else {
    timelinePrefix = "";
    timelineLabel = "No visits yet";
  }

  // Secondary count line — completed total, plus upcoming chip if relevant.
  const countLabel =
    completedCount === 0
      ? upcomingCount > 0
        ? `${upcomingCount} upcoming`
        : "No visits yet"
      : `${completedCount} visit${completedCount === 1 ? "" : "s"}${
          upcomingCount > 0 ? ` · ${upcomingCount} upcoming` : ""
        }`;

  // C6 popover summary — split into last visit + next booking when both exist
  const lastBookingSummary: LastBookingSummary = {
    lastVisit: lastCompleted
      ? {
          serviceLabel: lastCompleted.booking_items?.[0]?.service_name_snapshot ?? null,
          bookingDate: formatDate(lastCompleted.booking_date),
          paidLabel: `${formatMoney(lastCompleted.amount_paid ?? 0)} paid`,
        }
      : null,
    nextBooking: nextUpcoming
      ? {
          serviceLabel: nextUpcoming.booking_items?.[0]?.service_name_snapshot ?? null,
          bookingDate: formatDate(nextUpcoming.booking_date),
          timeLabel: nextUpcoming.start_time ? nextUpcoming.start_time.slice(0, 5) : null,
        }
      : null,
  };

  return (
    <li
      className={`group relative flex min-h-[56px] items-center gap-3 rounded-[var(--admin-radius-control)] border-b border-b-transparent px-3 py-2 transition-colors duration-150 ease-out hover:bg-[var(--admin-hover-mist)] hover:border-b-[oklch(60% 0.08 247)] focus-within:bg-[var(--admin-hover-mist)] md:gap-4 md:px-4 ${rowOpacity}`}
    >
      {isDeleted ? null : (
        <ClientSelectCheckbox clientId={client.id} clientName={client.full_name} />
      )}
      <span
        aria-hidden="true"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-semibold text-[var(--admin-heading)] ring-1 ring-transparent transition-shadow duration-200 ease-out group-hover:ring-[var(--admin-primary)]/30"
        style={{ backgroundColor: `oklch(82% 0.05 ${hue})` }}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1 max-w-[18rem] md:max-w-[22rem]">
        {isDeleted ? (
          // The detail route 404s on a soft-deleted client, so the row title —
          // whose ::after overlay makes the whole row clickable — is plain text
          // here instead of a dead link. Audit history stays available from the
          // row menu (brief §5.3).
          <p className="block truncate text-sm font-semibold text-[var(--admin-heading)] line-through">
            {client.full_name}
            <span className="sr-only"> (deleted)</span>
          </p>
        ) : (
          <Link
            href={`/admin/clients/${client.id}`}
            className="relative block truncate text-sm font-semibold text-[var(--admin-heading)] outline-none after:absolute after:inset-0 after:rounded-[var(--admin-radius-control)] after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-[var(--admin-focus)]/55"
          >
            {client.full_name}
          </Link>
        )}
        {showContact && client.phone ? (
          <p className="truncate text-xs text-[var(--admin-text-muted)]">
            {client.phone}
          </p>
        ) : showContact && client.email ? (
          <p className="truncate text-xs text-[var(--admin-text-muted)]">
            {client.email}
          </p>
        ) : null}
      </div>
      <div className="hidden flex-1 flex-col items-end gap-0.5 md:flex">
        <p className="font-mono text-xs text-[var(--admin-text-muted)]">
          {timelinePrefix ? (
            <>
              <span className="text-[var(--admin-text-muted)]/80">{timelinePrefix} </span>
              <span className="font-semibold text-[var(--admin-body)]">{timelineLabel}</span>
            </>
          ) : (
            timelineLabel
          )}
        </p>
        <p className="text-xs text-[var(--admin-text-muted)]">{countLabel}</p>
      </div>
      <span title={LIFECYCLE_TITLE[lifecycle]} className="relative z-10">
        <AdminStatusBadge value={lifecycleLabel} tone={tone} compact />
      </span>
      {isDeleted ? null : (
        <Link
          href={`/admin/bookings/new?clientId=${client.id}`}
          aria-label={`New booking for ${client.full_name}`}
          className="relative z-10 hidden h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-2.5 text-xs font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-selected-sky)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 md:inline-flex"
        >
          <Plus className="size-4" aria-hidden="true" />
          New booking
        </Link>
      )}
      <ClientRowMenu
        clientId={client.id}
        clientName={client.full_name}
        lastBooking={lastBookingSummary}
        canDelete={canDelete && !isDeleted}
        deleted={isDeleted}
      />
    </li>
  );
}

function AzStrip({ letters }: { letters: Set<string> }) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  return (
    <nav
      aria-label="Jump to letter"
      className="absolute right-0 top-0 hidden h-full flex-col items-center justify-start gap-0.5 pt-1 lg:flex"
    >
      {alphabet.map((letter) => {
        const enabled = letters.has(letter);
        return enabled ? (
          <a
            key={letter}
            href={`#section-${letter}`}
            title={`Jump to ${letter}`}
            className="flex size-5 items-center justify-center rounded-full text-[0.6875rem] font-semibold text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-selected-sky)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            {letter}
          </a>
        ) : (
          <span
            key={letter}
            aria-hidden="true"
            className="flex size-5 items-center justify-center text-[0.6875rem] font-medium text-[var(--admin-text-muted)]/40"
          >
            {letter}
          </span>
        );
      })}
    </nav>
  );
}
