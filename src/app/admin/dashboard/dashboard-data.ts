import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import {
  canManageAllClients,
  canManageEnquiries,
  canManageOperations,
  canManageStaffProfiles,
  canViewAllClients,
  canViewAllBookings,
  canViewAssignedBookings,
  canViewAssignedClients,
  canViewEmailLogs,
  canViewRevenueReports,
  canViewStaff,
  type StaffProfile,
} from "@/lib/auth/rbac";
import { getAdminPageAccess } from "@/lib/auth/admin-access";
import {
  getCityOptionsFromBookings,
  type EmailEvent,
  type OperationalEvent,
  type ReportAssignment,
  type ReportBooking,
  type ReportBookingItem,
  type ReportClient,
  type ReportData,
  type ReportFilters,
  type ReportStaff,
} from "../reports/reporting";

export type DashboardVariant = "business" | "coordinator" | "therapist" | "blocked";
export type DashboardBookingScope = "all" | "assigned_and_claimable" | "none";

export interface DashboardQueryPlan {
  variant: DashboardVariant;
  bookingScope: DashboardBookingScope;
  includeRevenue: boolean;
  includeClients: boolean | "linked";
  includeStaff: boolean | "own";
  includeEnquiries: boolean;
  includeEmailEvents: boolean;
  includeOperationalEvents: boolean;
}

const BOOKING_SELECT_BASE = `
  id,
  client_id,
  booking_date,
  start_time,
  end_time,
  status,
  payment_status,
  assignment_status,
  reschedule_status,
  customer_cancelled_at,
  booking_source,
  contact_full_name,
  contact_email,
  contact_phone,
  service_city,
  service_postcode,
  service_address_line1,
  health_notes,
  created_at
`;

const BOOKING_REVENUE_SELECT = `
  total_price,
  amount_due,
  amount_paid
`;

const ASSIGNMENT_SELECT = `
  id,
  booking_id,
  participant_id,
  assigned_staff_id,
  required_therapist_gender,
  status,
  staff_profiles(name)
`;

const BOOKING_ITEM_SELECT_BASE = `
  id,
  booking_id,
  booking_participant_id,
  service_name_snapshot,
  service_duration_snapshot
`;

const BOOKING_ITEM_REVENUE_SELECT = "service_price_snapshot";

export function getDashboardQueryPlan(profile: StaffProfile | null): DashboardQueryPlan {
  const blocked: DashboardQueryPlan = {
    variant: "blocked",
    bookingScope: "none",
    includeRevenue: false,
    includeClients: false,
    includeStaff: false,
    includeEnquiries: false,
    includeEmailEvents: false,
    includeOperationalEvents: false,
  };

  if (!profile?.active) return blocked;

  const access = getAdminPageAccess(profile, "dashboard");
  if (!access.access) return blocked;

  if (access.dataScope === "all") {
    return {
      variant: "business",
      bookingScope: "all",
      includeRevenue: canViewRevenueReports(profile),
      includeClients: canViewAllClients(profile) || canManageAllClients(profile),
      includeStaff: canViewStaff(profile) || canManageStaffProfiles(profile),
      includeEnquiries: canManageEnquiries(profile),
      includeEmailEvents: canViewEmailLogs(profile),
      includeOperationalEvents: canManageOperations(profile),
    };
  }

  if (access.dataScope === "operational") {
    return {
      variant: "coordinator",
      bookingScope: canViewAllBookings(profile) ? "all" : "none",
      includeRevenue: false,
      includeClients: canViewAllClients(profile) || canManageAllClients(profile),
      includeStaff: false,
      includeEnquiries: canManageEnquiries(profile),
      includeEmailEvents: canViewEmailLogs(profile),
      includeOperationalEvents: false,
    };
  }

  return {
    variant: "therapist",
    bookingScope: canViewAssignedBookings(profile) ? "assigned_and_claimable" : "none",
    includeRevenue: false,
    includeClients: canViewAssignedClients(profile) ? "linked" : false,
    includeStaff: "own",
    includeEnquiries: false,
    includeEmailEvents: false,
    includeOperationalEvents: false,
  };
}

// B-2 cache layer per SHARED-IMPLEMENTATION-NOTES §11 (≤6 queries / cold cache)
// and §12 (Sentry slow-query spans). The existing aggregation logic moves to
// `getDashboardDataInner` untouched; the public export wraps it in unstable_cache
// + Sentry.startSpan. Tag list includes 'report-data' so dismissInsight (and any
// other report-side mutation) invalidates dashboards too. The cache key includes
// profile.id so RBAC-scoped datasets don't bleed across viewers.
export async function getDashboardData(
  adminClient: SupabaseClient,
  profile: StaffProfile,
  filters: ReportFilters
): Promise<{ data: ReportData; plan: DashboardQueryPlan }> {
  const fetchCached = unstable_cache(
    () =>
      Sentry.startSpan(
        {
          name: "getDashboardData",
          op: "db.query",
          attributes: { profile_id: profile.id, range: filters.range },
        },
        async () => getDashboardDataInner(adminClient, profile, filters)
      ),
    ["dashboard-data", profile.id, JSON.stringify(filters)],
    { revalidate: 60, tags: ["dashboard-data", "report-data"] }
  );
  return fetchCached();
}

async function getDashboardDataInner(
  adminClient: SupabaseClient,
  profile: StaffProfile,
  filters: ReportFilters
): Promise<{ data: ReportData; plan: DashboardQueryPlan }> {
  const plan = getDashboardQueryPlan(profile);
  if (plan.bookingScope === "none") {
    return { data: emptyReportData(filters), plan };
  }

  const assignmentsForScope =
    plan.bookingScope === "assigned_and_claimable"
      ? await getTherapistScopeAssignments(adminClient, profile)
      : [];
  const assignedBookingIds = new Set(
    assignmentsForScope
      .filter((assignment) => assignment.assigned_staff_id === profile.id)
      .map((assignment) => assignment.booking_id)
  );
  const scopeBookingIds =
    plan.bookingScope === "assigned_and_claimable"
      ? uniqueIds(assignmentsForScope.map((assignment) => assignment.booking_id))
      : null;
  const bookings = await getBookings(adminClient, filters, plan, scopeBookingIds);
  const bookingIds = uniqueIds(bookings.map((booking) => booking.id));
  const allAssignments =
    plan.bookingScope === "assigned_and_claimable"
      ? assignmentsForScope.filter((assignment) => bookingIds.includes(assignment.booking_id))
      : await getAssignmentsForBookings(adminClient, bookingIds);
  const bookingItems = await getBookingItems(adminClient, bookingIds, plan.includeRevenue);

  const cityOptions = getCityOptionsFromBookings(bookings);
  const filteredBookings = bookings.filter((booking) => filterBooking(booking, filters));
  const initialBookingIds = new Set(filteredBookings.map((booking) => booking.id));
  const initialAssignments = allAssignments.filter((assignment) =>
    initialBookingIds.has(assignment.booking_id)
  );
  const initialItems = bookingItems.filter((item) =>
    item.booking_id ? initialBookingIds.has(item.booking_id) : false
  );
  const staffFilteredBookingIds =
    filters.staffId && plan.variant !== "therapist"
      ? new Set(
          initialAssignments
            .filter((assignment) => assignment.assigned_staff_id === filters.staffId)
            .map((assignment) => assignment.booking_id)
        )
      : initialBookingIds;
  const serviceFilteredBookingIds = filters.service
    ? new Set(
        initialItems
          .filter((item) => item.service_name_snapshot === filters.service)
          .map((item) => item.booking_id)
          .filter((bookingId): bookingId is string => Boolean(bookingId))
      )
    : initialBookingIds;
  const finalBookingIds = new Set(
    [...initialBookingIds].filter(
      (bookingId) =>
        staffFilteredBookingIds.has(bookingId) &&
        serviceFilteredBookingIds.has(bookingId)
    )
  );
  const finalBookings = filteredBookings
    .filter((booking) => finalBookingIds.has(booking.id))
    .map((booking) =>
      plan.variant === "therapist" && !assignedBookingIds.has(booking.id)
        ? hideClaimableBookingSensitiveFields(booking)
        : booking
    );
  const filteredAssignments = initialAssignments.filter((assignment) =>
    finalBookingIds.has(assignment.booking_id)
  );
  const filteredItems = initialItems.filter((item) =>
    item.booking_id ? finalBookingIds.has(item.booking_id) : false
  );
  const linkedClientIds = uniqueIds(
    finalBookings.map((booking) => booking.client_id).filter((id): id is string => Boolean(id))
  );

  const [clients, staff, staffAvailabilityRuleStaffIds, enquiries, emailEvents, operationalEvents] =
    await Promise.all([
      getClients(adminClient, plan, linkedClientIds),
      getStaff(adminClient, plan, profile),
      getStaffAvailabilityRuleIds(adminClient, plan, profile),
      getEnquiries(adminClient, plan),
      getEmailEvents(adminClient, plan),
      getOperationalEvents(adminClient, plan),
    ]);

  return {
    plan,
    data: {
      filters,
      bookings: finalBookings,
      cityOptions,
      assignments: filteredAssignments,
      bookingItems: filteredItems,
      clients,
      staff,
      enquiries,
      emailEvents,
      operationalEvents,
      staffAvailabilityRuleStaffIds,
    },
  };
}

function bookingSelect(includeRevenue: boolean) {
  return includeRevenue
    ? `${BOOKING_SELECT_BASE},${BOOKING_REVENUE_SELECT}`
    : BOOKING_SELECT_BASE;
}

function bookingItemSelect(includeRevenue: boolean) {
  return includeRevenue
    ? `${BOOKING_ITEM_SELECT_BASE},${BOOKING_ITEM_REVENUE_SELECT}`
    : BOOKING_ITEM_SELECT_BASE;
}

async function getTherapistScopeAssignments(
  adminClient: SupabaseClient,
  profile: StaffProfile
) {
  const [assignedResult, claimableResult] = await Promise.all([
    adminClient
      .from("booking_assignments")
      .select(ASSIGNMENT_SELECT)
      .eq("assigned_staff_id", profile.id)
      .returns<ReportAssignment[]>(),
    adminClient
      .from("booking_assignments")
      .select(ASSIGNMENT_SELECT)
      .is("assigned_staff_id", null)
      .neq("status", "completed")
      .eq("required_therapist_gender", profile.gender)
      .returns<ReportAssignment[]>(),
  ]);

  // Filter claimable assignments to exclude those whose underlying booking
  // is cancelled or no_show. Therapists should not see a "claim this" chip
  // for a booking that's no longer live. We intentionally do NOT filter the
  // assigned-to-self side: a therapist's own cancelled/no_show bookings are
  // still relevant for completionRate / noShowCount analytics on
  // TherapistDashboard (preserves the same Client-Mix-style guarantee that
  // led us to skip the data-layer query filter in getBookings).
  const claimable = claimableResult.data ?? [];
  let activeClaimable: ReportAssignment[] = claimable;
  if (claimable.length > 0) {
    const bookingIds = Array.from(new Set(claimable.map((a) => a.booking_id)));
    const { data: activeBookings } = await adminClient
      .from("bookings")
      .select("id")
      .in("id", bookingIds)
      .neq("status", "cancelled")
      .neq("status", "no_show")
      .returns<{ id: string }[]>();
    const activeBookingIds = new Set((activeBookings ?? []).map((b) => b.id));
    activeClaimable = claimable.filter((a) => activeBookingIds.has(a.booking_id));
  }

  return [...(assignedResult.data ?? []), ...activeClaimable];
}

async function getBookings(
  adminClient: SupabaseClient,
  filters: ReportFilters,
  plan: DashboardQueryPlan,
  scopeBookingIds: string[] | null
) {
  if (scopeBookingIds && scopeBookingIds.length === 0) return [];

  let query = adminClient
    .from("bookings")
    .select(bookingSelect(plan.includeRevenue))
    .gte("booking_date", filters.from)
    .lte("booking_date", filters.to)
    .order("booking_date")
    .order("start_time");

  if (scopeBookingIds) {
    query = query.in("id", scopeBookingIds);
  }

  const { data } = await query.returns<Partial<ReportBooking>[]>();
  return (data ?? []).map((booking) => normalizeBooking(booking, plan.includeRevenue));
}

async function getAssignmentsForBookings(adminClient: SupabaseClient, bookingIds: string[]) {
  if (bookingIds.length === 0) return [];
  const { data } = await adminClient
    .from("booking_assignments")
    .select(ASSIGNMENT_SELECT)
    .in("booking_id", bookingIds)
    .returns<ReportAssignment[]>();
  return data ?? [];
}

async function getBookingItems(
  adminClient: SupabaseClient,
  bookingIds: string[],
  includeRevenue: boolean
) {
  if (bookingIds.length === 0) return [];
  const { data } = await adminClient
    .from("booking_items")
    .select(bookingItemSelect(includeRevenue))
    .in("booking_id", bookingIds)
    .returns<Partial<ReportBookingItem>[]>();
  return (data ?? []).map((item) => ({
    id: item.id ?? "",
    booking_id: item.booking_id ?? null,
    booking_participant_id: item.booking_participant_id ?? null,
    service_name_snapshot: item.service_name_snapshot ?? "",
    service_price_snapshot: includeRevenue ? item.service_price_snapshot ?? 0 : 0,
    service_duration_snapshot: item.service_duration_snapshot ?? 0,
  }));
}

async function getClients(
  adminClient: SupabaseClient,
  plan: DashboardQueryPlan,
  linkedClientIds: string[]
) {
  if (!plan.includeClients) return [];
  if (plan.includeClients === "linked" && linkedClientIds.length === 0) return [];

  let query = adminClient
    .from("clients")
    .select("id, full_name, client_source, created_at");

  if (plan.includeClients === "linked") {
    query = query.in("id", linkedClientIds);
  }

  const { data } = await query.returns<ReportClient[]>();
  return data ?? [];
}

async function getStaff(
  adminClient: SupabaseClient,
  plan: DashboardQueryPlan,
  profile: StaffProfile
) {
  if (!plan.includeStaff) return [];
  let query = adminClient
    .from("staff_profiles")
    .select("id, name, gender, active, can_take_bookings, availability_mode, role_id, roles(name, display_label)")
    .order("name");

  if (plan.includeStaff === "own") {
    query = query.eq("id", profile.id);
  }

  const { data } = await query.returns<ReportStaff[]>();
  return data ?? [];
}

async function getStaffAvailabilityRuleIds(
  adminClient: SupabaseClient,
  plan: DashboardQueryPlan,
  profile: StaffProfile
): Promise<string[]> {
  if (!plan.includeStaff) return [];
  let query = adminClient.from("staff_availability_rules").select("staff_id");

  if (plan.includeStaff === "own") {
    query = query.eq("staff_id", profile.id);
  }

  const { data } = await query.returns<{ staff_id: string }[]>();
  return [...new Set((data ?? []).map((rule) => rule.staff_id))];
}

async function getEnquiries(adminClient: SupabaseClient, plan: DashboardQueryPlan) {
  if (!plan.includeEnquiries) return [];
  const { data } = await adminClient
    .from("enquiries")
    .select("id, full_name, source, status, created_at")
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function getEmailEvents(
  adminClient: SupabaseClient,
  plan: DashboardQueryPlan
) {
  if (!plan.includeEmailEvents) return [];
  const { data } = await adminClient
    .from("email_delivery_events")
    .select("id, booking_id, staff_id, event_type, recipient_email, recipient_role, delivery_status, error_message, created_at")
    .order("created_at", { ascending: false })
    .returns<EmailEvent[]>();
  return data ?? [];
}

async function getOperationalEvents(
  adminClient: SupabaseClient,
  plan: DashboardQueryPlan
) {
  if (!plan.includeOperationalEvents) return [];
  const { data } = await adminClient
    .from("operational_events")
    .select("id, event_type, severity, status, summary, booking_id, staff_id, created_at")
    .order("created_at", { ascending: false })
    .returns<OperationalEvent[]>();
  return data ?? [];
}

function normalizeBooking(
  booking: Partial<ReportBooking>,
  includeRevenue: boolean
): ReportBooking {
  return {
    id: booking.id ?? "",
    client_id: booking.client_id ?? null,
    booking_date: booking.booking_date ?? "",
    start_time: booking.start_time ?? "",
    end_time: booking.end_time ?? "",
    status: booking.status ?? "",
    payment_status: booking.payment_status ?? "",
    assignment_status: booking.assignment_status ?? "",
    reschedule_status: booking.reschedule_status ?? "",
    customer_cancelled_at: booking.customer_cancelled_at ?? null,
    total_price: includeRevenue ? booking.total_price ?? null : null,
    amount_due: includeRevenue ? booking.amount_due ?? null : null,
    amount_paid: includeRevenue ? booking.amount_paid ?? null : null,
    booking_source: booking.booking_source ?? "",
    contact_full_name: booking.contact_full_name ?? null,
    contact_email: booking.contact_email ?? null,
    contact_phone: booking.contact_phone ?? null,
    service_city: booking.service_city ?? null,
    service_postcode: booking.service_postcode ?? null,
    service_address_line1: booking.service_address_line1 ?? null,
    health_notes: booking.health_notes ?? null,
    created_at: booking.created_at ?? "",
  };
}

function hideClaimableBookingSensitiveFields(booking: ReportBooking): ReportBooking {
  return {
    ...booking,
    client_id: null,
    contact_full_name: "Claimable booking",
    contact_email: null,
    contact_phone: null,
    service_address_line1: null,
    service_postcode: null,
    health_notes: null,
  };
}

function emptyReportData(filters: ReportFilters): ReportData {
  return {
    filters,
    bookings: [],
    cityOptions: [],
    assignments: [],
    bookingItems: [],
    clients: [],
    staff: [],
    enquiries: [],
    emailEvents: [],
    operationalEvents: [],
    staffAvailabilityRuleStaffIds: [],
  };
}

function uniqueIds(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function filterBooking(booking: ReportBooking, filters: ReportFilters) {
  if (filters.source && booking.booking_source !== filters.source) return false;
  if (filters.status && booking.status !== filters.status) return false;
  if (filters.paymentStatus && booking.payment_status !== filters.paymentStatus) {
    return false;
  }
  if (filters.city && !(booking.service_city ?? "").toLowerCase().includes(filters.city.toLowerCase())) {
    return false;
  }
  return true;
}
