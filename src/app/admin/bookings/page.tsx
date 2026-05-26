import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  Inbox,
  Plus,
  SearchX,
  UserPlus,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminPageHeader,
  AdminStatusBadge,
} from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { BookingCardSkeletonList } from "../components/admin-scalable-lists";
import { BookingsChrome, type BookingViewKey } from "./BookingsChrome";
import { BookingRowActions } from "./BookingRowActions";
import {
  canClaimAssignments,
  canManageAllBookings,
  canManageBookings,
  hasClaimableAssignment,
  isOwnBooking,
} from "./access";
import { formatDate, formatLabel, formatMoney, formatTime } from "./format";
import type { BookingRecord } from "./types";

export const metadata = {
  title: "Bookings - Rahma Therapy Admin",
};

const BOOKING_SELECT = `
  id,
  booking_date,
  start_time,
  end_time,
  total_duration_mins,
  total_price,
  contact_full_name,
  contact_email,
  contact_phone,
  booking_source,
  amount_due,
  amount_paid,
  paid_at,
  payment_note,
  status,
  payment_status,
  payment_method,
  assignment_status,
  group_booking,
  service_address_line1,
  service_address_line2,
  service_city,
  service_postcode,
  access_notes,
  consent_acknowledged,
  customer_notes,
  health_notes,
  customer_manage_notes,
  customer_cancelled_at,
  customer_cancellation_note,
  last_customer_manage_action_at,
  reschedule_requested_at,
  reschedule_preferred_date,
  reschedule_preferred_time,
  reschedule_note,
  reschedule_status,
  admin_notes,
  treatment_notes,
  created_at,
  clients(full_name, phone, email),
  booking_participants(id, participant_gender, required_therapist_gender, is_main_contact, display_name, participant_notes, health_notes, consent_acknowledged),
  booking_items(id, booking_participant_id, service_name_snapshot, service_price_snapshot, service_duration_snapshot),
  booking_assignments(id, participant_id, assigned_staff_id, required_therapist_gender, status, staff_profiles(name))
`;

const CLAIMABLE_BOOKING_SELECT = `
  id,
  booking_date,
  start_time,
  end_time,
  total_duration_mins,
  status,
  assignment_status,
  group_booking,
  booking_source,
  reschedule_status,
  customer_cancelled_at,
  created_at,
  booking_participants(id, participant_gender, required_therapist_gender, is_main_contact, consent_acknowledged),
  booking_items(id, booking_participant_id, service_name_snapshot, service_duration_snapshot),
  booking_assignments(id, participant_id, assigned_staff_id, required_therapist_gender, status, staff_profiles(name))
`;

async function getScopedBookingIds(profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>) {
  const adminClient = createSupabaseAdminClient();
  const { data: assignedRows } = await adminClient
    .from("booking_assignments")
    .select("booking_id")
    .eq("assigned_staff_id", profile.id);

  const claimableRows = canClaimAssignments(profile)
    ? (
        await adminClient
          .from("booking_assignments")
          .select("booking_id")
          .eq("status", "unassigned")
          .is("assigned_staff_id", null)
          .eq("required_therapist_gender", profile.gender)
      ).data ?? []
    : [];

  return {
    assignedIds: Array.from(
      new Set((assignedRows ?? []).map((assignment) => assignment.booking_id as string))
    ),
    claimableIds: Array.from(
      new Set((claimableRows ?? []).map((assignment) => assignment.booking_id as string))
    ),
  };
}

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getTodayIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function filterBookings(
  bookings: BookingRecord[],
  query: Record<string, string | string[] | undefined>,
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>
) {
  const view = (getQueryValue(query.view) || "attention") as BookingViewKey;
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
  const today = getTodayIsoDate();

  return bookings.filter((booking) => {
    const matchesView =
      view === "all" ||
      (view === "attention" &&
        (booking.status === "pending" ||
          booking.assignment_status !== "fully_assigned" ||
          booking.reschedule_status === "requested" ||
          Boolean(booking.customer_cancelled_at))) ||
      (view === "assigned" && isOwnBooking(booking, profile)) ||
      (view === "claimable" &&
        !["cancelled", "no_show"].includes(booking.status) &&
        hasClaimableAssignment(booking, profile)) ||
      (view === "today" &&
        booking.booking_date === today &&
        !["cancelled", "no_show"].includes(booking.status)) ||
      (view === "upcoming" &&
        booking.booking_date >= today &&
        !["completed", "cancelled", "no_show"].includes(booking.status)) ||
      (view === "unassigned" &&
        !["cancelled", "no_show"].includes(booking.status) &&
        booking.assignment_status === "unassigned") ||
      (view === "partially_assigned" &&
        !["cancelled", "no_show"].includes(booking.status) &&
        booking.assignment_status === "partially_assigned") ||
      (view === "completed" && booking.status === "completed") ||
      (view === "cancelled" &&
        ["cancelled", "no_show"].includes(booking.status));

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

function normalizeClaimableBooking(booking: Partial<BookingRecord>): BookingRecord {
  return {
    id: booking.id ?? "",
    booking_date: booking.booking_date ?? "",
    start_time: booking.start_time ?? "",
    end_time: booking.end_time ?? "",
    total_duration_mins: booking.total_duration_mins ?? null,
    total_price: null,
    contact_full_name: "Claimable booking",
    contact_email: "",
    contact_phone: "",
    booking_source: booking.booking_source ?? "",
    amount_due: null,
    amount_paid: null,
    paid_at: null,
    payment_note: null,
    status: booking.status ?? "pending",
    payment_status: "unpaid",
    payment_method: null,
    assignment_status: booking.assignment_status ?? "unassigned",
    group_booking: booking.group_booking ?? false,
    service_address_line1: null,
    service_address_line2: null,
    service_city: null,
    service_postcode: null,
    access_notes: null,
    consent_acknowledged: false,
    customer_notes: null,
    health_notes: null,
    customer_manage_notes: null,
    customer_cancelled_at: booking.customer_cancelled_at ?? null,
    customer_cancellation_note: null,
    last_customer_manage_action_at: null,
    reschedule_requested_at: null,
    reschedule_preferred_date: null,
    reschedule_preferred_time: null,
    reschedule_note: null,
    reschedule_status: booking.reschedule_status ?? "none",
    admin_notes: null,
    treatment_notes: null,
    created_at: booking.created_at ?? "",
    clients: null,
    booking_participants: (booking.booking_participants ?? []).map((participant) => ({
      id: participant.id,
      participant_gender: participant.participant_gender,
      required_therapist_gender: participant.required_therapist_gender,
      is_main_contact: participant.is_main_contact,
      display_name: null,
      participant_notes: null,
      health_notes: null,
      consent_acknowledged: participant.consent_acknowledged,
    })),
    booking_items: (booking.booking_items ?? []).map((item) => ({
      id: item.id,
      booking_participant_id: item.booking_participant_id,
      service_name_snapshot: item.service_name_snapshot,
      service_price_snapshot: 0,
      service_duration_snapshot: item.service_duration_snapshot,
    })),
    booking_assignments: booking.booking_assignments ?? [],
  };
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

  const adminClient = createSupabaseAdminClient();
  const canViewAll = canManageAllBookings(profile);
  const defaultView: BookingViewKey = canViewAll ? "attention" : "today";
  const currentView = (getQueryValue(query.view) ?? defaultView) as BookingViewKey;

  // Lightweight chrome data — filter dropdown options only.
  const [{ data: services }, { data: staff }] = canViewAll
    ? await Promise.all([
        adminClient
          .from("services")
          .select("slug, name")
          .eq("is_active", true)
          .order("name"),
        adminClient
          .from("staff_profiles")
          .select("id, name")
          .eq("active", true)
          .order("name"),
      ])
    : [{ data: [] }, { data: [] }];

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
        services={services ?? []}
        staff={staff ?? []}
        canViewAll={canViewAll}
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
  // Reconstruct the "try again" URL from the current query params.
  const retryParams = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string" && value.length > 0) retryParams.set(key, value);
  }
  const retryHref = `/admin/bookings?${retryParams.toString()}`;

  let bookings: BookingRecord[];
  try {
    const adminClient = createSupabaseAdminClient();
    const scopedIds = canViewAll ? null : await getScopedBookingIds(profile);
    const claimableOnlyIds =
      scopedIds?.claimableIds.filter((id) => !scopedIds.assignedIds.includes(id)) ?? [];

    bookings = canViewAll
      ? (
          await adminClient
            .from("bookings")
            .select(BOOKING_SELECT)
            .order("booking_date", { ascending: false })
            .order("start_time", { ascending: false })
            .returns<BookingRecord[]>()
        ).data ?? []
      : [
          ...(
            scopedIds?.assignedIds.length
              ? (
                  await adminClient
                    .from("bookings")
                    .select(BOOKING_SELECT)
                    .in("id", scopedIds.assignedIds)
                    .order("booking_date", { ascending: false })
                    .order("start_time", { ascending: false })
                    .returns<BookingRecord[]>()
                ).data ?? []
              : []
          ),
          ...(
            claimableOnlyIds.length
              ? (
                  await adminClient
                    .from("bookings")
                    .select(CLAIMABLE_BOOKING_SELECT)
                    .in("id", claimableOnlyIds)
                    .order("booking_date", { ascending: false })
                    .order("start_time", { ascending: false })
                    .returns<Partial<BookingRecord>[]>()
                ).data?.map(normalizeClaimableBooking) ?? []
              : []
          ),
        ].sort((a, b) => (
          b.booking_date.localeCompare(a.booking_date) ||
          b.start_time.localeCompare(a.start_time)
        ));
  } catch (loadError) {
    // Surface to Sentry / dev console; swallowing the error leaves the
    // crash invisible in production telemetry.
    console.error("[bookings] failed to load list", loadError);
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-[var(--admin-radius-card)] border border-[oklch(88%_0.045_20)] bg-[oklch(95.5%_0.028_20)] px-6 py-10 text-center"
      >
        <AlertCircle className="size-8 text-[oklch(26%_0.14_25)]" aria-hidden="true" />
        <p className="text-sm font-medium text-[oklch(26%_0.14_25)]">
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

  const filteredBookings = filterBookings(bookings, query, profile);

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

  const showGrouping =
    new Set(filteredBookings.map((b) => b.booking_date)).size > 1;

  const groupedBookings = showGrouping
    ? Object.entries(
        filteredBookings.reduce<Record<string, BookingRecord[]>>((acc, booking) => {
          (acc[booking.booking_date] ??= []).push(booking);
          return acc;
        }, {})
      ).sort(([a], [b]) => b.localeCompare(a))
    : [["", filteredBookings] as const];

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
                <BookingListCard
                  key={booking.id}
                  booking={booking}
                  profile={profile}
                  canViewAll={canViewAll}
                  animationDelay={delay}
                />
              );
            })}
          </div>
        </section>
      ))}
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

function buildClearSearchHref(
  view: BookingViewKey,
  query: Record<string, string | string[] | undefined>
) {
  // Preserve every active filter except `search` itself, so "Clear search"
  // doesn't wipe a Location or Status the operator also dialled in.
  const params = new URLSearchParams();
  params.set("view", view);
  for (const [key, raw] of Object.entries(query)) {
    if (key === "view" || key === "search") continue;
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

function statusTone(value: string) {
  switch (value) {
    case "pending":
      return "info" as const;
    case "confirmed":
      return "success" as const;
    case "completed":
      return "success" as const;
    case "cancelled":
    case "no_show":
      return "danger" as const;
    default:
      return "muted" as const;
  }
}

function BookingListCard({
  booking,
  profile,
  canViewAll,
  animationDelay = 0,
}: {
  booking: BookingRecord;
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>;
  canViewAll: boolean;
  animationDelay?: number;
}) {
  const ownBooking = isOwnBooking(booking, profile);
  const claimableBooking = hasClaimableAssignment(booking, profile);
  const showSensitiveDetails = canViewAll || ownBooking;
  const role = canViewAll ? "full" : "therapist";

  const clientName =
    booking.contact_full_name || booking.clients?.full_name || "Unknown client";
  const serviceNames = Array.from(
    new Set(booking.booking_items.map((item) => item.service_name_snapshot))
  );

  const assignedTherapists = booking.booking_assignments
    .map((assignment) => assignment.staff_profiles?.name ?? null)
    .filter((name): name is string => Boolean(name));
  const distinctTherapists = Array.from(new Set(assignedTherapists));

  const requiresGenderMatch = booking.booking_participants.some(
    (participant) => Boolean(participant.required_therapist_gender)
  );
  const participantCount = booking.booking_participants.length;
  // Only surface the Group chip when there are genuinely multiple participants.
  // `group_booking` can be true with a single participant during draft states,
  // and "Group · 0" / "Group · 1" reads as a data bug.
  const isGroup = participantCount > 1;

  const addressParts = [
    booking.service_address_line1,
    booking.service_city,
    booking.service_postcode,
  ].filter(Boolean);
  const mapUrl =
    addressParts.length > 0
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          addressParts.join(" ")
        )}`
      : null;

  const claimableAssignment = claimableBooking
    ? booking.booking_assignments.find(
        (assignment) =>
          assignment.status === "unassigned" &&
          !assignment.assigned_staff_id &&
          assignment.required_therapist_gender === profile.gender
      ) ?? null
    : null;

  return (
    <article
      style={{ animationDelay: `${animationDelay}ms` }}
      className="rahma-row-enter grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 transition-shadow duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:shadow-[var(--admin-shadow-subtle)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/bookings/${booking.id}`}
            className="block min-w-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <p className="font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)] break-words sm:text-lg">
              {clientName}
            </p>
            <p className="mt-1 text-sm text-[var(--admin-text-muted)] break-words">
              {formatDate(booking.booking_date)} · {formatTime(booking.start_time)}–{formatTime(booking.end_time)}
              {serviceNames.length > 0 ? ` · ${serviceNames.join(", ")}` : ""}
            </p>
          </Link>
          {/* Status hierarchy: one prominent badge anchors the row; everything
              else demotes to compact text or icon-only so the eye lands on
              status first. Brief mandates visible text on the same-gender +
              group chips, so those stay text-labelled but compact. */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <AdminStatusBadge
              value={formatLabel(booking.status)}
              tone={statusTone(booking.status)}
            />
            {booking.assignment_status === "unassigned" ? (
              <AdminStatusBadge value="Unassigned" tone="warning" compact />
            ) : booking.assignment_status === "partially_assigned" ? (
              <AdminStatusBadge value="Partially assigned" tone="warning" compact />
            ) : null}
            {requiresGenderMatch ? (
              <span
                title="Client asked for a same-gender therapist"
                className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-restricted-bg)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--admin-restricted)]"
              >
                Same-gender required
              </span>
            ) : null}
            {isGroup ? (
              <span
                title={`Group booking with ${participantCount} participants`}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-restricted-bg)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--admin-restricted)]"
              >
                Group · {participantCount}
              </span>
            ) : null}
            {booking.reschedule_status === "requested" ? (
              <span
                title="Reschedule requested by the client"
                className="inline-flex size-6 items-center justify-center rounded-full bg-[oklch(95%_0.05_65)] text-[oklch(26%_0.13_55)]"
              >
                <CalendarClock className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Reschedule requested</span>
              </span>
            ) : null}
            {booking.customer_cancelled_at ? (
              <span
                title="The client cancelled this booking"
                className="inline-flex size-6 items-center justify-center rounded-full bg-[oklch(95.5%_0.028_20)] text-[oklch(26%_0.14_25)]"
              >
                <UserX className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Client cancelled</span>
              </span>
            ) : null}
            {/* "Claimable" chip removed: redundant with the Claim button,
                which always renders on the same row for the same condition. */}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--admin-border)] pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {distinctTherapists.length > 0 ? (
            <div className="flex min-w-0 items-center gap-2">
              <AvatarStack names={distinctTherapists} />
              <span className="min-w-0 break-words text-sm text-[var(--admin-body)]">
                {distinctTherapists.join(", ")}
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
              <span
                aria-hidden="true"
                className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--admin-panel-muted)] text-xs text-[var(--admin-text-muted)]"
              >
                ?
              </span>
              No therapist yet
            </span>
          )}
          {showSensitiveDetails && booking.payment_status ? (
            <AdminStatusBadge
              value={`${formatLabel(booking.payment_status)}${
                showSensitiveDetails && booking.amount_due
                  ? ` · ${formatMoney(booking.amount_due)}`
                  : ""
              }`}
              tone={
                booking.payment_status === "paid"
                  ? "success"
                  : booking.payment_status === "unpaid"
                  ? "warning"
                  : "muted"
              }
              compact
            />
          ) : null}
        </div>

        <BookingRowActions
          bookingId={booking.id}
          clientName={clientName}
          role={role}
          status={booking.status}
          paymentStatus={booking.payment_status}
          assignmentStatus={booking.assignment_status}
          mapUrl={showSensitiveDetails ? mapUrl : null}
          claimableAssignmentId={claimableAssignment?.id ?? null}
        />
      </div>
    </article>
  );
}

function AvatarStack({ names }: { names: string[] }) {
  const visible = names.slice(0, 3);
  const extra = names.length - visible.length;
  return (
    <div className="flex -space-x-2">
      {visible.map((name) => (
        <span
          key={name}
          title={name}
          aria-hidden="true"
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full border-2 border-[var(--admin-panel)]",
            "bg-[var(--admin-hover-mist)] text-[0.75rem] font-semibold text-[var(--admin-heading)]"
          )}
        >
          {initials(name)}
        </span>
      ))}
      {extra > 0 ? (
        <span
          aria-hidden="true"
          className="inline-flex size-8 items-center justify-center rounded-full border-2 border-[var(--admin-panel)] bg-[var(--admin-panel-muted)] text-[0.6875rem] font-semibold text-[var(--admin-text-muted)]"
        >
          +{extra}
        </span>
      ) : null}
      <span className="sr-only">{names.join(", ")}</span>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
