import type { SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { addBusinessDays, getBusinessDate } from "@/lib/time/london";
import {
  canManageStaffProfiles,
  canViewRevenueReports,
  canViewStaff,
  hasUniversalReportScope,
  type StaffProfile,
} from "@/lib/auth/rbac";

export { canViewRevenueReports, hasUniversalReportScope };

export interface ReportFilters {
  range: string;
  from: string;
  to: string;
  staffId: string;
  service: string;
  source: string;
  status: string;
  paymentStatus: string;
  city: string;
}

export interface ReportBooking {
  id: string;
  client_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  assignment_status: string;
  reschedule_status: string;
  customer_cancelled_at: string | null;
  total_price: number | string | null;
  amount_due: number | string | null;
  amount_paid: number | string | null;
  booking_source: string;
  contact_full_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  service_city: string | null;
  service_postcode: string | null;
  service_address_line1: string | null;
  health_notes: string | null;
  created_at: string;
}

export interface ReportAssignment {
  id: string;
  booking_id: string;
  participant_id: string | null;
  assigned_staff_id: string | null;
  required_therapist_gender: string;
  status: string;
  staff_profiles: { name: string } | null;
}

export interface ReportBookingItem {
  id: string;
  booking_id: string | null;
  booking_participant_id: string | null;
  service_name_snapshot: string;
  service_price_snapshot: number | string;
  service_duration_snapshot: number;
}

export interface ReportClient {
  id: string;
  full_name: string;
  client_source: string;
  created_at: string;
}

export interface ReportStaff {
  id: string;
  name: string;
  gender: string;
  active: boolean;
  can_take_bookings: boolean;
  availability_mode: string;
  role_id: string;
  roles: { name: string; display_label: string | null } | null;
}

export interface EmailEvent {
  id: string;
  booking_id: string | null;
  staff_id: string | null;
  event_type: string;
  recipient_email: string | null;
  recipient_role: string | null;
  delivery_status: string;
  error_message: string | null;
  created_at: string;
}

export interface OperationalEvent {
  id: string;
  event_type: string;
  severity: "info" | "warning" | "error";
  status: "open" | "acknowledged" | "resolved";
  summary: string;
  booking_id: string | null;
  staff_id: string | null;
  created_at: string;
}

// B-2: rule row shape (day_of_week 0–6 per Postgres; is_working_day distinguishes
// "I'm available on day N from start_time to end_time" from "blocked on day N").
export interface StaffAvailabilityRule {
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
}

export interface ReportEnquiry {
  id: string;
  full_name: string;
  source: string;
  status: string;
  created_at: string;
  // B-2 additions — present from migration 20260522120000 onward. Optional on the
  // type so dashboard-data.ts (RECON §5 untouchable) can keep returning the
  // pre-B-2 shape without retrofitting. getReportData (the reports surface)
  // always fetches these; helpers below tolerate absence via `?? null`.
  first_contacted_at?: string | null;
  assigned_staff_id?: string | null;
  converted_booking_id?: string | null;
}

export interface ReportData {
  filters: ReportFilters;
  bookings: ReportBooking[];
  cityOptions: string[];
  assignments: ReportAssignment[];
  bookingItems: ReportBookingItem[];
  clients: ReportClient[];
  staff: ReportStaff[];
  enquiries: ReportEnquiry[];
  emailEvents: EmailEvent[];
  operationalEvents: OperationalEvent[];
  // Was Set<string>; flipped to string[] because B-2's unstable_cache wrap
  // (dashboard-data.ts) JSON-serializes this payload — JSON.stringify(Set)
  // returns '{}' and `.has` then throws on cache-hit reads. Consumers use
  // `.includes(id)`. Stays a unique-id list; construction uses [...new Set(...)].
  staffAvailabilityRuleStaffIds: string[];
  // B-2: full rule rows for getUtilisationRate. Optional so dashboard-data.ts
  // (RECON §5 untouchable) can omit; helpers default to [] when absent.
  staffAvailabilityRules?: StaffAvailabilityRule[];
}

export interface MetricDefinition {
  key: string;
  label: string;
  definition: string;
}

const BOOKING_SELECT = `
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
  health_notes,
  created_at
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

const BOOKING_ITEM_SELECT = `
  id,
  booking_id,
  booking_participant_id,
  service_name_snapshot,
  service_price_snapshot,
  service_duration_snapshot
`;

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    key: "booked_revenue",
    label: "Booked revenue",
    definition: "Total booking value created in the selected period.",
  },
  {
    key: "expected_revenue",
    label: "Expected revenue",
    definition: "Confirmed or upcoming unpaid booking value.",
  },
  {
    key: "collected_revenue",
    label: "Collected revenue",
    definition: "Actual amount paid in the selected period.",
  },
  {
    key: "outstanding_revenue",
    label: "Outstanding revenue",
    definition: "Amount due minus amount paid.",
  },
  {
    key: "completed_revenue",
    label: "Completed revenue",
    definition: "Paid or completed booking revenue.",
  },
  {
    key: "repeat_clients",
    label: "Repeat clients",
    definition: "Clients with more than one booking in scope.",
  },
  {
    key: "participant_count",
    label: "Participant count",
    definition: "Booking participants, separate from deduplicated client profiles.",
  },
  {
    key: "staff_revenue",
    label: "Staff revenue attribution",
    definition: "Service-item value attributed to the assigned staff member for that participant; group bookings are not counted once per therapist.",
  },
];

export function parseReportFilters(searchParams: Record<string, string | string[] | undefined>): ReportFilters {
  const today = getBusinessDate();
  const currentYear = today.slice(0, 4);
  const currentMonth = today.slice(0, 7);
  const range = getValue(searchParams.range) || "month";
  const customFrom = getValue(searchParams.from);
  const customTo = getValue(searchParams.to);
  const defaults = getRangeDefaults(range, currentYear, currentMonth, today);

  return {
    range,
    from: customFrom || defaults.from,
    to: customTo || defaults.to,
    staffId: getValue(searchParams.staffId),
    service: getValue(searchParams.service),
    source: getValue(searchParams.source),
    status: getValue(searchParams.status),
    paymentStatus: getValue(searchParams.paymentStatus),
    city: getValue(searchParams.city),
  };
}

export async function getReportData(
  adminClient: SupabaseClient,
  profile: StaffProfile,
  filters: ReportFilters
): Promise<ReportData> {
  // ITEM N — enquiries, email delivery events and operational events are
  // clinic operations data. Nothing a non-universal profile can legitimately
  // see is computed from them, and two of the three carry other people's
  // contact details (`enquiries.full_name`, `email_delivery_events
  // .recipient_email`). They are therefore not fetched at all for such a
  // profile rather than fetched and filtered afterwards: data that never
  // leaves the database cannot leak from a render site somebody forgets to
  // narrow, which is exactly how ITEM L happened.
  //
  // The gate is `hasUniversalReportScope`, the SAME predicate this function
  // already uses to scope bookings a few lines below, so the function has one
  // notion of scope rather than two that can drift. Owner, Admin and Booking
  // Coordinator all satisfy it, so their reports are byte-identical to before;
  // only Therapist and Inactive narrow.
  //
  // ⚠️ `clients` and `staff` are deliberately still fetched clinic-wide. Both
  // are reference data that correct numbers depend on — a client row resolves a
  // booking's name, a staff row a denominator — so narrowing them here would
  // change rendered figures rather than merely hide them. They are narrowed at
  // the render sites instead: `filterReportDataToStaff` for clients, and
  // `resolvableStaffFor` for staff names.
  const universalScope = hasUniversalReportScope(profile);
  const emptyResult = <T,>() => Promise.resolve({ data: [] as T[] });

  const [
    bookingsResult,
    assignmentsResult,
    itemsResult,
    clientsResult,
    staffResult,
    staffAvailabilityRulesResult,
    enquiriesResult,
    emailEventsResult,
    operationalEventsResult,
  ] = await Promise.all([
    adminClient
      .from("bookings")
      .select(BOOKING_SELECT)
      .gte("booking_date", filters.from)
      .lte("booking_date", filters.to)
      .order("booking_date")
      .order("start_time")
      .returns<ReportBooking[]>(),
    adminClient
      .from("booking_assignments")
      .select(ASSIGNMENT_SELECT)
      .returns<ReportAssignment[]>(),
    adminClient
      .from("booking_items")
      .select(BOOKING_ITEM_SELECT)
      .returns<ReportBookingItem[]>(),
    adminClient
      .from("clients")
      .select("id, full_name, client_source, created_at")
      .returns<ReportClient[]>(),
    adminClient
      .from("staff_profiles")
      .select("id, name, gender, active, can_take_bookings, availability_mode, role_id, roles(name, display_label)")
      .order("name")
      .returns<ReportStaff[]>(),
    adminClient
      .from("staff_availability_rules")
      .select("staff_id, day_of_week, start_time, end_time, is_working_day")
      .returns<StaffAvailabilityRule[]>(),
    universalScope
      ? adminClient
          .from("enquiries")
          .select("id, full_name, source, status, created_at, first_contacted_at, assigned_staff_id, converted_booking_id")
          .order("created_at", { ascending: false })
          .returns<ReportEnquiry[]>()
      : emptyResult<ReportEnquiry>(),
    universalScope
      ? adminClient
          .from("email_delivery_events")
          .select("id, booking_id, staff_id, event_type, recipient_email, recipient_role, delivery_status, error_message, created_at")
          .order("created_at", { ascending: false })
          .returns<EmailEvent[]>()
      : emptyResult<EmailEvent>(),
    universalScope
      ? adminClient
          .from("operational_events")
          .select("id, event_type, severity, status, summary, booking_id, staff_id, created_at")
          .order("created_at", { ascending: false })
          .returns<OperationalEvent[]>()
      : emptyResult<OperationalEvent>(),
  ]);

  const allAssignments = assignmentsResult.data ?? [];
  const scopedBookingIds = getScopedBookingIds(
    profile,
    bookingsResult.data ?? [],
    allAssignments
  );
  const scopedBookings = (bookingsResult.data ?? []).filter((booking) =>
    scopedBookingIds.has(booking.id)
  );
  const cityOptions = getCityOptionsFromBookings(scopedBookings);
  const filteredBookings = scopedBookings.filter((booking) =>
    filterBooking(booking, filters)
  );
  const initialBookingIds = new Set(filteredBookings.map((booking) => booking.id));
  const initialAssignments = allAssignments.filter((assignment) =>
    initialBookingIds.has(assignment.booking_id)
  );
  const initialItems = (itemsResult.data ?? []).filter((item) =>
    item.booking_id ? initialBookingIds.has(item.booking_id) : false
  );
  const staffFilteredBookingIds = filters.staffId
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
  const finalBookings = filteredBookings.filter((booking) =>
    finalBookingIds.has(booking.id)
  );
  const filteredAssignments = initialAssignments.filter((assignment) =>
    finalBookingIds.has(assignment.booking_id)
  );
  const filteredItems = initialItems.filter((item) =>
    item.booking_id ? finalBookingIds.has(item.booking_id) : false
  );

  return {
    filters,
    bookings: finalBookings,
    cityOptions,
    assignments: filteredAssignments,
    bookingItems: filteredItems,
    clients: clientsResult.data ?? [],
    staff: staffResult.data ?? [],
    enquiries: enquiriesResult.data ?? [],
    emailEvents: emailEventsResult.data ?? [],
    operationalEvents: operationalEventsResult.data ?? [],
    staffAvailabilityRuleStaffIds: [
      ...new Set((staffAvailabilityRulesResult.data ?? []).map((rule) => rule.staff_id)),
    ],
    staffAvailabilityRules: staffAvailabilityRulesResult.data ?? [],
  };
}

export function summarizeReports(data: ReportData) {
  let bookedRevenue = 0;
  let collectedRevenue = 0;
  let outstandingRevenue = 0;
  let completedRevenue = 0;
  let expectedRevenue = 0;
  let cancelledRevenue = 0;
  let noShowRevenue = 0;
  const clientBookingCounts = new Map<string, number>();

  for (const booking of data.bookings) {
    const totalPrice = amount(booking.total_price);
    const amountPaid = amount(booking.amount_paid);
    const amountDue = amount(booking.amount_due ?? booking.total_price);

    // TODO(post-Phase-7 policy decision): bookedRevenue currently sums
    // totalPrice for every booking in range, including cancelled and
    // no_show. Two valid interpretations:
    //   (a) "Revenue committed at time of booking" — keep cancelled in;
    //       this answers "what did our pipeline look like for the period?"
    //   (b) "Revenue from currently-valid bookings" — exclude cancelled/
    //       no_show; this answers "what do we still expect to earn?"
    // Current implementation is (a). Defer the choice; raise as a
    // separate discussion after ship.
    bookedRevenue += totalPrice;
    collectedRevenue += amountPaid;
    // Outstanding is "money still owed by live bookings". Cancelled and
    // no_show bookings are not collectable (clinic doesn't enforce
    // cancellation fees per BUSINESS-COMPLETENESS) so they don't add to
    // the outstanding figure. Sibling of dashboard/page.tsx unpaidBookings
    // guard from the same Band A sweep.
    if (!["cancelled", "no_show"].includes(booking.status)) {
      outstandingRevenue += Math.max(amountDue - amountPaid, 0);
    }

    if (booking.status === "completed") {
      completedRevenue += amount(booking.amount_paid ?? booking.total_price);
    }
    if (
      ["confirmed", "pending"].includes(booking.status) &&
      booking.payment_status === "unpaid"
    ) {
      expectedRevenue += amountDue;
    }
    if (booking.status === "cancelled") {
      cancelledRevenue += totalPrice;
    }
    if (booking.status === "no_show") {
      noShowRevenue += totalPrice;
    }
    if (booking.client_id) {
      clientBookingCounts.set(
        booking.client_id,
        (clientBookingCounts.get(booking.client_id) ?? 0) + 1
      );
    }
  }

  const repeatClients = [...clientBookingCounts.values()].filter(
    (count) => count > 1
  ).length;

  return {
    bookingCount: data.bookings.length,
    bookedRevenue,
    expectedRevenue,
    collectedRevenue,
    outstandingRevenue,
    completedRevenue,
    cancelledRevenue,
    noShowRevenue,
    repeatClients,
    newClients: data.clients.filter(
      (client) => client.created_at.slice(0, 10) >= data.filters.from &&
        client.created_at.slice(0, 10) <= data.filters.to
    ).length,
    participantCount: data.assignments.length,
  };
}

export function getCityOptionsFromBookings(
  bookings: Pick<ReportBooking, "service_city">[]
) {
  const cityLabelsByKey = new Map<string, string>();

  for (const booking of bookings) {
    const city = booking.service_city?.trim();
    if (!city) continue;
    const key = city.toLocaleLowerCase("en-GB");
    if (!cityLabelsByKey.has(key)) {
      cityLabelsByKey.set(key, city);
    }
  }

  return [...cityLabelsByKey.values()].sort((a, b) => a.localeCompare(b));
}

export function getRevenueSeries(bookings: ReportBooking[]) {
  const rows = new Map<string, { period: string; booked: number; collected: number; outstanding: number }>();
  for (const booking of bookings) {
    const period = booking.booking_date.slice(0, 7);
    const existing = rows.get(period) ?? {
      period,
      booked: 0,
      collected: 0,
      outstanding: 0,
    };
    existing.booked += amount(booking.total_price);
    existing.collected += amount(booking.amount_paid);
    existing.outstanding += Math.max(
      amount(booking.amount_due ?? booking.total_price) - amount(booking.amount_paid),
      0
    );
    rows.set(period, existing);
  }
  return [...rows.values()].sort((a, b) => a.period.localeCompare(b.period));
}

export function getCountBy<T>(
  rows: T[],
  getKey: (row: T) => string | null | undefined
) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row) || "Not set";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

export function getServicePerformance(data: ReportData) {
  const rows = new Map<string, { service: string; bookings: number; revenue: number }>();
  for (const item of data.bookingItems) {
    const existing = rows.get(item.service_name_snapshot) ?? {
      service: item.service_name_snapshot,
      bookings: 0,
      revenue: 0,
    };
    existing.bookings += 1;
    existing.revenue += amount(item.service_price_snapshot);
    rows.set(item.service_name_snapshot, existing);
  }
  return [...rows.values()].sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue);
}

export function getStaffWorkload(data: ReportData) {
  const rows = new Map<string, { staffId: string; staffName: string; assignments: number; completed: number }>();
  for (const assignment of data.assignments) {
    if (!assignment.assigned_staff_id) continue;
    const existing = rows.get(assignment.assigned_staff_id) ?? {
      staffId: assignment.assigned_staff_id,
      staffName: assignment.staff_profiles?.name ?? "Unknown staff",
      assignments: 0,
      completed: 0,
    };
    existing.assignments += 1;
    if (assignment.status === "completed") existing.completed += 1;
    rows.set(assignment.assigned_staff_id, existing);
  }
  return [...rows.values()].sort((a, b) => b.assignments - a.assignments);
}

export function getStaffRevenueAttribution(data: ReportData) {
  const assignmentByParticipant = new Map(
    data.assignments
      .filter((assignment) => assignment.assigned_staff_id && assignment.participant_id)
      .map((assignment) => [assignment.participant_id as string, assignment])
  );
  const rows = new Map<string, { staffId: string; staffName: string; revenue: number }>();

  for (const item of data.bookingItems) {
    if (!item.booking_participant_id) continue;
    const assignment = assignmentByParticipant.get(item.booking_participant_id);
    if (!assignment?.assigned_staff_id) continue;
    const existing = rows.get(assignment.assigned_staff_id) ?? {
      staffId: assignment.assigned_staff_id,
      staffName: assignment.staff_profiles?.name ?? "Unknown staff",
      revenue: 0,
    };
    existing.revenue += amount(item.service_price_snapshot);
    rows.set(assignment.assigned_staff_id, existing);
  }

  return [...rows.values()].sort((a, b) => b.revenue - a.revenue);
}

export function getAttentionItems(data: ReportData) {
  const assignmentsByBooking = groupBy(data.assignments, (assignment) => assignment.booking_id);
  const attention = data.bookings.flatMap((booking) => {
    const bookingAssignments = assignmentsByBooking.get(booking.id) ?? [];
    const items: {
      id: string;
      href: string;
      label: string;
      detail: string;
      tone: "warning" | "danger" | "default";
      date: string;
    }[] = [];

    if (
      booking.assignment_status === "unassigned" &&
      !["cancelled", "no_show"].includes(booking.status)
    ) {
      items.push({
        id: `${booking.id}-unassigned`,
        href: `/admin/bookings/${booking.id}`,
        label: "Unassigned booking",
        detail: booking.contact_full_name ?? booking.id,
        tone: "danger",
        date: booking.booking_date,
      });
    }
    if (
      booking.assignment_status === "partially_assigned" &&
      !["cancelled", "no_show"].includes(booking.status)
    ) {
      items.push({
        id: `${booking.id}-partial`,
        href: `/admin/bookings/${booking.id}`,
        label: "Partially assigned booking",
        detail: `${bookingAssignments.filter((item) => item.assigned_staff_id).length}/${bookingAssignments.length} assigned`,
        tone: "warning",
        date: booking.booking_date,
      });
    }
    if (
      booking.customer_cancelled_at &&
      new Date(booking.customer_cancelled_at).getTime() >
        Date.now() - 14 * 24 * 60 * 60 * 1000
    ) {
      items.push({
        id: `${booking.id}-customer-cancelled`,
        href: `/admin/bookings/${booking.id}`,
        label: "Customer cancellation",
        detail: booking.contact_full_name ?? booking.id,
        tone: "danger",
        date: booking.booking_date,
      });
    }
    if (
      booking.reschedule_status === "requested" &&
      !["cancelled", "no_show"].includes(booking.status)
    ) {
      items.push({
        id: `${booking.id}-reschedule`,
        href: `/admin/bookings/${booking.id}`,
        label: "Reschedule request",
        detail: booking.contact_full_name ?? booking.id,
        tone: "warning",
        date: booking.booking_date,
      });
    }
    if (booking.status === "completed" && booking.payment_status === "unpaid") {
      items.push({
        id: `${booking.id}-unpaid-completed`,
        href: `/admin/bookings/${booking.id}`,
        label: "Unpaid completed booking",
        detail: booking.contact_full_name ?? booking.id,
        tone: "danger",
        date: booking.booking_date,
      });
    }
    if (
      booking.health_notes &&
      !["cancelled", "no_show"].includes(booking.status)
    ) {
      items.push({
        id: `${booking.id}-health`,
        href: `/admin/bookings/${booking.id}`,
        label: "Booking with health notes",
        detail: booking.contact_full_name ?? booking.id,
        tone: "warning",
        date: booking.booking_date,
      });
    }
    return items;
  });

  for (const enquiry of data.enquiries.filter((item) => item.status === "new")) {
    attention.push({
      id: `${enquiry.id}-enquiry`,
      href: "/admin/enquiries?tab=new",
      label: "Uncontacted enquiry",
      detail: `${enquiry.full_name} · ${enquiry.source}`,
      tone: "warning",
      date: enquiry.created_at.slice(0, 10),
    });
  }

  for (const email of data.emailEvents.filter((item) => item.delivery_status === "failed")) {
    attention.push({
      id: `${email.id}-email`,
      href: "/admin/emails",
      label: "Failed email send",
      detail: email.event_type,
      tone: "danger",
      date: email.created_at.slice(0, 10),
    });
  }

  for (const event of data.operationalEvents.filter((item) => item.status === "open")) {
    attention.push({
      id: `${event.id}-ops`,
      href: "/admin/operations",
      label: "Operational error",
      detail: event.summary,
      tone: event.severity === "error" ? "danger" : "warning",
      date: event.created_at.slice(0, 10),
    });
  }

  for (const staff of data.staff.filter(
    (member) =>
      member.active &&
      member.can_take_bookings &&
      member.availability_mode === "custom" &&
      !data.staffAvailabilityRuleStaffIds.includes(member.id)
  )) {
    attention.push({
      id: `${staff.id}-availability-gap`,
      href: `/admin/staff/${staff.id}/availability`,
      label: "Staff availability gap",
      detail: `${staff.name} has custom availability with no weekly rules.`,
      tone: "warning",
      date: getBusinessDate(),
    });
  }

  return attention.sort((a, b) => a.date.localeCompare(b.date));
}

export function amount(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

export function humanizeEventType(raw: string) {
  const EVENT_LABEL_MAP: Record<string, string> = {
    booking_confirmation: "Booking confirmation failed",
    booking_reminder: "Booking reminder failed",
    admin_booking_notification: "Admin booking alert failed",
    staff_assignment: "Staff assignment email failed",
    staff_unassignment: "Staff unassignment email failed",
    booking_cancellation: "Booking cancellation email failed",
    booking_reschedule: "Reschedule notification failed",
    enquiry_confirmation: "Enquiry confirmation failed",
    payment_confirmation: "Payment receipt failed",
    custom_notification: "Custom notification failed",
    internal_alert: "Internal alert failed",
  };

  return EVENT_LABEL_MAP[raw] ?? raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export interface GenderCapacity {
  gender: string;
  label: string;
  activeTherapists: number;
  totalAssignments: number;
  unassignedAssignments: number;
}

export function getGenderCapacity(data: ReportData): GenderCapacity[] {
  const staffGenderMap = new Map(data.staff.filter((s) => s.active).map((s) => [s.id, s.gender]));
  const unassignedByGender = new Map<string, number>();
  for (const assignment of data.assignments) {
    if (!assignment.assigned_staff_id || assignment.status === "completed") {
      const gender = assignment.required_therapist_gender || "any";
      unassignedByGender.set(gender, (unassignedByGender.get(gender) ?? 0) + 1);
    }
  }

  const staffByGender = new Map<string, Set<string>>();
  for (const [staffId, gender] of staffGenderMap) {
    if (!staffByGender.has(gender)) staffByGender.set(gender, new Set());
    staffByGender.get(gender)!.add(staffId);
  }

  const staffToBookings = new Map<string, number>();
  for (const assignment of data.assignments) {
    if (!assignment.assigned_staff_id) continue;
    staffToBookings.set(assignment.assigned_staff_id, (staffToBookings.get(assignment.assigned_staff_id) ?? 0) + 1);
  }

  const genders = [...new Set([...staffGenderMap.values(), ...unassignedByGender.keys()])];
  return genders.map((gender) => {
    const staffIds = staffByGender.get(gender) ?? new Set();
    const activeCount = staffIds.size;
    const totalAssigned = [...staffIds].reduce((sum, id) => sum + (staffToBookings.get(id) ?? 0), 0);
    const unassigned = unassignedByGender.get(gender) ?? 0;
    const label = gender === "male" ? "Male therapist" : gender === "female" ? "Female therapist" : "Any gender";
    return { gender, label, activeTherapists: activeCount, totalAssignments: totalAssigned, unassignedAssignments: unassigned };
  });
}

export function findNextAppointment(bookings: ReportBooking[], today: string): ReportBooking | null {
  const upcoming = bookings
    .filter((b) => b.booking_date > today && b.status !== "cancelled" && b.status !== "no_show")
    .sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.start_time.localeCompare(b.start_time));
  return upcoming[0] ?? null;
}

export interface NotificationItem {
  id: string;
  type: "email" | "operation" | "assignment" | "payment" | "enquiry" | "availability";
  title: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  timestamp: string;
  href: string | null;
  actionLabel?: string;
  secondaryHref?: string | null;
  secondaryLabel?: string;
  // ── R4 redesign 2026-05-21 ──────────────────────────────────────────────
  // Optional persistence-layer fields populated by nav-notifications.ts when
  // backed by the public.notification_state table. Absent on legacy/reports-
  // built notifications (buildNotifications below). UI consumers must defend
  // against absence — items without notificationId cannot be snoozed/archived.
  notificationId?: string;        // stable derived hash, e.g. 'booking:<uuid>:unassigned'
  reason?: string;                // discriminator for duplicate-collapse grouping
  state?: {
    readAt: string | null;
    snoozedUntil: string | null;
    archivedAt: string | null;
  };
}

export function buildNotifications(
  data: {
    assignments: ReportAssignment[];
    emailEvents: EmailEvent[];
    operationalEvents: OperationalEvent[];
    enquiries: { id: string; full_name: string; status: string; created_at: string }[];
    bookings: ReportBooking[];
  }
): NotificationItem[] {
  const items: NotificationItem[] = [];

  for (const email of data.emailEvents.filter((e) => e.delivery_status === "failed")) {
    items.push({
      id: `email-${email.id}`,
      type: "email",
      title: humanizeEventType(email.event_type),
      detail: email.error_message ?? "The email could not be delivered.",
      severity: "critical",
      timestamp: email.created_at.slice(0, 16).replace("T", " "),
      href: "/admin/emails",
      actionLabel: "Open email event",
      secondaryHref: email.booking_id ? `/admin/bookings/${email.booking_id}` : null,
      secondaryLabel: "View booking",
    });
  }

  for (const event of data.operationalEvents.filter((e) => e.status === "open")) {
    items.push({
      id: `ops-${event.id}`,
      type: "operation",
      title: humanizeEventType(event.event_type),
      detail: event.summary,
      severity: event.severity === "error" ? "critical" : "warning",
      timestamp: event.created_at.slice(0, 16).replace("T", " "),
      href: "/admin/operations",
      actionLabel: "Open operations",
    });
  }

  for (const enquiry of data.enquiries.filter((e) => e.status === "new")) {
    items.push({
      id: `enquiry-${enquiry.id}`,
      type: "enquiry",
      title: "New uncontacted enquiry",
      detail: enquiry.full_name,
      severity: "warning",
      timestamp: enquiry.created_at.slice(0, 16).replace("T", " "),
      href: "/admin/enquiries",
      actionLabel: "Contact",
    });
  }

  for (const booking of data.bookings.filter(
    (b) => b.status === "completed" && b.payment_status === "unpaid"
  )) {
    items.push({
      id: `unpaid-${booking.id}`,
      type: "payment",
      title: "Unpaid completed booking",
      detail: booking.contact_full_name ?? "Unknown contact",
      severity: "critical",
      timestamp: booking.booking_date,
      href: `/admin/bookings/${booking.id}`,
      actionLabel: "Review payment",
    });
  }

  const unassignedByGender = new Map<string, number>();
  for (const a of data.assignments.filter((a) => !a.assigned_staff_id && a.status !== "completed")) {
    const g = a.required_therapist_gender || "any";
    unassignedByGender.set(g, (unassignedByGender.get(g) ?? 0) + 1);
  }
  if (unassignedByGender.size > 0) {
    const detail = [...unassignedByGender.entries()]
      .map(([g, count]) => `${count} ${g}`)
      .join(", ");
    items.push({
      id: "capacity-gap",
      type: "assignment",
      title: "Unassigned booking assignments",
      detail: `${detail} slot(s) need therapist assignment.`,
      severity: "warning",
      timestamp: getBusinessDate(),
      href: "/admin/bookings?view=unassigned",
      actionLabel: "Assign therapists",
    });
  }

  return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function getScopedBookingIds(
  profile: StaffProfile,
  bookings: ReportBooking[],
  assignments: ReportAssignment[]
) {
  if (hasUniversalReportScope(profile)) {
    return new Set(bookings.map((booking) => booking.id));
  }

  return new Set(
    assignments
      .filter((assignment) => assignment.assigned_staff_id === profile.id)
      .map((assignment) => assignment.booking_id)
  );
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

function getRangeDefaults(range: string, currentYear: string, currentMonth: string, today: string) {
  if (range === "lifetime") return { from: "2000-01-01", to: "2100-12-31" };
  if (range === "year") return { from: `${currentYear}-01-01`, to: `${currentYear}-12-31` };
  if (range === "today") return { from: today, to: today };
  // `tomorrow` — single day forward. Used by the Therapist worker-dashboard
  // chip group ("Today / Tomorrow / This week"). Added 2026-05-25 after the
  // audit found the chip was silently falling through to a month-forward
  // catch-all.
  if (range === "tomorrow") {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    const tomorrow = d.toISOString().slice(0, 10);
    return { from: tomorrow, to: tomorrow };
  }
  if (range === "week") return { from: today, to: addBusinessDays(today, 7) };
  // `this_week` — current calendar week, Monday-anchored, full Mon-Sun. Worker
  // app & Therapist self-view semantic ("the week I'm in" — includes past and
  // future days of the same week). Distinct from `week` which is rolling +7
  // business-days forward.
  if (range === "this_week") {
    const d = new Date(`${today}T00:00:00Z`);
    const dow = d.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
    const daysFromMonday = dow === 0 ? 6 : dow - 1;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - daysFromMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      from: monday.toISOString().slice(0, 10),
      to: sunday.toISOString().slice(0, 10),
    };
  }
  // `this_month` — current calendar month, 1st to last day. Distinct from
  // `month` which is month-start to today+30 rolling.
  if (range === "this_month") {
    const [y, m] = currentMonth.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      from: `${currentMonth}-01`,
      to: `${currentMonth}-${pad(lastDay)}`,
    };
  }
  if (range === "custom") return { from: today, to: today };
  // B-3 additive (brief §5.1 chip set). Calendar-quarter window matching the
  // existing "year" semantics — Q1 Jan-Mar / Q2 Apr-Jun / Q3 Jul-Sep / Q4 Oct-Dec.
  if (range === "quarter") {
    const month = Number(currentMonth.slice(5, 7));
    const qStart = Math.floor((month - 1) / 3) * 3 + 1;
    const qEnd = qStart + 2;
    const pad = (n: number) => String(n).padStart(2, "0");
    const lastDay = new Date(Date.UTC(Number(currentYear), qEnd, 0)).getUTCDate();
    return { from: `${currentYear}-${pad(qStart)}-01`, to: `${currentYear}-${pad(qEnd)}-${pad(lastDay)}` };
  }
  return { from: `${currentMonth}-01`, to: addBusinessDays(today, 30) };
}

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

// =============================================================================
// B-2 additions (2026-05-22) — metric backend
//
// All helpers below are pure functions over an already-fetched ReportData
// (and optionally a prior-period ReportData + an AuditEventRow[]). The single
// exception is `getAuditLogForStaff`, which is an async DB read used by B-3
// Performance surface activity timeline (also feeds getStaffScorecard's admin
// sub-object). Existing exports above are untouched (RECON §5 untouchables
// preserved); the ReportData type was extended additively to expose the new
// columns the helpers below consume. See
// redesign/plans/B-phase/B2-metric-backend-plan.md.
// =============================================================================

export interface UtilisationRate {
  rate: number;
  bookedHours: number;
  availableHours: number;
}

export interface NoShowRate {
  rate: number;
  total: number;
  noShows: number;
  cancelled: number;
  lostRevenue: number;
}

export interface RetentionRate {
  rate: number;
  retainedClients: number;
  totalClients: number;
}

export interface SourceAttributionRow {
  source: string;
  bookings: number;
  revenue: number;
  percentageOfRevenue: number;
}

export interface NetCollectionRate {
  rate: number;
  collected: number;
  billed: number;
}

// AUDIT G-final-2 + production grep: action_types used by the scorecard admin
// sub-object. Centralised constants so future audits surface mismatches loudly.
export const AUDIT_ACTION_TYPES = {
  ENQUIRY_STATUS_UPDATED: "enquiry_status_updated",
  BOOKING_ASSIGNMENT_REASSIGNED: "booking_assignment_reassigned",
  BOOKING_ASSIGNMENT_CLAIMED: "booking_assignment_claimed",
  OPERATIONAL_EVENT_STATUS_UPDATED: "operational_event_status_updated",
} as const;

export interface AuditEventRow {
  id: string;
  actor_staff_id: string | null;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
}

export interface StaffScorecardClinical {
  assignmentsTotal: number;
  assignmentsCompleted: number;
  hoursWorked: number;
  clientsTouched: number;
  revenueAttributed: number;
  utilisation: UtilisationRate;
  retention: RetentionRate;
  noShowRate: NoShowRate;
  sameGenderFulfilled: number;
}

export interface StaffScorecardAdmin {
  enquiriesContactedCount: number;
  enquiryConversionRate: number;
  avgMinutesToFirstContact: number;
  bookingsAssignedCount: number;
  opsEventsResolvedCount: number;
}

export interface StaffScorecardDeltas {
  clinical: {
    assignmentsCompleted: number;
    hoursWorked: number;
    clientsTouched: number;
    revenueAttributed: number;
    utilisationRate: number;
    retentionRate: number;
    noShowRate: number;
  };
  admin: {
    enquiriesContactedCount: number;
    enquiryConversionRate: number;
    avgMinutesToFirstContact: number;
    bookingsAssignedCount: number;
    opsEventsResolvedCount: number;
  };
}

export interface StaffScorecard {
  clinical: StaffScorecardClinical;
  admin: StaffScorecardAdmin;
  deltas?: StaffScorecardDeltas;
}

// ── 1. buildPriorPeriodFilters ───────────────────────────────────────────────
// Returns the prior-period filter set: same span, immediately preceding window.
// For lifetime range: returns null (no meaningful prior). For from > to or
// missing dates: returns null. Sets `range: 'custom'` since from/to are now
// explicit dates.
export function buildPriorPeriodFilters(filters: ReportFilters): ReportFilters | null {
  if (filters.range === "lifetime") return null;
  if (!filters.from || !filters.to) return null;
  if (filters.from > filters.to) return null;
  const spanDays = daysBetweenInclusive(filters.from, filters.to);
  const priorTo = shiftYmd(filters.from, -1);
  const priorFrom = shiftYmd(priorTo, -(spanDays - 1));
  return { ...filters, from: priorFrom, to: priorTo, range: "custom" };
}

// ── 2. filterReportDataToStaff ───────────────────────────────────────────────
// Returns a new ReportData clone narrowed to rows that involve `staffId`.
// Bookings = those with at least one assignment to the staff. Assignments =
// only this staff's. Items = only those tied to retained bookings. Clients =
// clients of retained bookings. Preserves immutability of the input.
export function filterReportDataToStaff(data: ReportData, staffId: string): ReportData {
  const staffAssignments = data.assignments.filter(
    (assignment) => assignment.assigned_staff_id === staffId
  );
  const staffBookingIds = new Set(staffAssignments.map((a) => a.booking_id));
  const narrowedBookings = data.bookings.filter((booking) => staffBookingIds.has(booking.id));
  const narrowedItems = data.bookingItems.filter((item) =>
    item.booking_id ? staffBookingIds.has(item.booking_id) : false
  );
  const clientIds = new Set(
    narrowedBookings.map((b) => b.client_id).filter((id): id is string => id !== null)
  );
  const narrowedClients = data.clients.filter((client) => clientIds.has(client.id));
  return {
    ...data,
    bookings: narrowedBookings,
    assignments: staffAssignments,
    bookingItems: narrowedItems,
    clients: narrowedClients,
  };
}

// ── 3. getUtilisationRate ────────────────────────────────────────────────────
// Booked hours: sum of (end_time − start_time) for assignments status='completed'
// or 'confirmed', joined to bookings for the time range. Available hours: from
// staff_availability_rules (sum of (end − start) per is_working_day=true rule;
// multiplied by the number of weeks in the period for a coarse weekly→period
// scale). Returns 0 for both numerator and denominator when nothing matches —
// rate is 0 in that case (NaN guard).
export function getUtilisationRate(
  data: ReportData,
  scope?: { staffId?: string }
): UtilisationRate {
  const bookingById = new Map(data.bookings.map((b) => [b.id, b]));
  const relevantStatuses = new Set(["completed", "confirmed"]);
  const matchedAssignments = data.assignments.filter((assignment) => {
    if (!relevantStatuses.has(assignment.status)) return false;
    if (scope?.staffId && assignment.assigned_staff_id !== scope.staffId) return false;
    return bookingById.has(assignment.booking_id);
  });
  let bookedMinutes = 0;
  for (const assignment of matchedAssignments) {
    const booking = bookingById.get(assignment.booking_id);
    if (!booking) continue;
    bookedMinutes += diffTimeStringsInMinutes(booking.start_time, booking.end_time);
  }
  const bookedHours = bookedMinutes / 60;

  const allRules = data.staffAvailabilityRules ?? [];
  const relevantRules = scope?.staffId
    ? allRules.filter((rule) => rule.staff_id === scope.staffId)
    : allRules;
  let weeklyMinutes = 0;
  for (const rule of relevantRules) {
    if (!rule.is_working_day) continue;
    weeklyMinutes += diffTimeStringsInMinutes(rule.start_time, rule.end_time);
  }
  const periodDays = data.filters.from && data.filters.to
    ? daysBetweenInclusive(data.filters.from, data.filters.to)
    : 0;
  const periodWeeks = periodDays > 0 ? periodDays / 7 : 0;
  const availableHours = (weeklyMinutes / 60) * periodWeeks;
  const rate = availableHours > 0 ? bookedHours / availableHours : 0;
  return { rate, bookedHours, availableHours };
}

// ── 4. getNoShowRate ─────────────────────────────────────────────────────────
// (noShows + cancelled) / total. Total = bookings in scope. lostRevenue =
// sum of total_price across no_show + cancelled (recoverable revenue).
export function getNoShowRate(
  data: ReportData,
  scope?: { staffId?: string }
): NoShowRate {
  const bookings = scope?.staffId
    ? filterBookingsToStaff(data, scope.staffId)
    : data.bookings;
  let noShows = 0;
  let cancelled = 0;
  let lostRevenue = 0;
  for (const booking of bookings) {
    if (booking.status === "no_show") {
      noShows += 1;
      lostRevenue += amount(booking.total_price);
    } else if (booking.status === "cancelled") {
      cancelled += 1;
      lostRevenue += amount(booking.total_price);
    }
  }
  const total = bookings.length;
  const rate = total > 0 ? (noShows + cancelled) / total : 0;
  return { rate, total, noShows, cancelled, lostRevenue };
}

// ── 5. getRetentionRate ──────────────────────────────────────────────────────
// retainedClients / totalClients. retainedClients = unique client_ids with
// `completed` booking count >= threshold. Default threshold 3 (massage/physical-
// therapy industry benchmark; mental-health uses 8). Override via 3rd arg.
export function getRetentionRate(
  data: ReportData,
  scope?: { staffId?: string },
  threshold = 3
): RetentionRate {
  const bookings = scope?.staffId
    ? filterBookingsToStaff(data, scope.staffId)
    : data.bookings;
  const completedCounts = new Map<string, number>();
  for (const booking of bookings) {
    if (booking.status !== "completed") continue;
    if (!booking.client_id) continue;
    completedCounts.set(booking.client_id, (completedCounts.get(booking.client_id) ?? 0) + 1);
  }
  const totalClients = completedCounts.size;
  let retainedClients = 0;
  for (const count of completedCounts.values()) {
    if (count >= threshold) retainedClients += 1;
  }
  const rate = totalClients > 0 ? retainedClients / totalClients : 0;
  return { rate, retainedClients, totalClients };
}

// ── 6. getSourceAttribution ──────────────────────────────────────────────────
// Group bookings by booking_source. Sum bookings + revenue (total_price).
// percentageOfRevenue is share-of-total. Sorts by revenue desc.
// null/empty source groups under "Not set".
export function getSourceAttribution(data: ReportData): SourceAttributionRow[] {
  const rows = new Map<string, { bookings: number; revenue: number }>();
  let totalRevenue = 0;
  for (const booking of data.bookings) {
    const key = booking.booking_source?.trim() || "Not set";
    const existing = rows.get(key) ?? { bookings: 0, revenue: 0 };
    const bookingRevenue = amount(booking.total_price);
    existing.bookings += 1;
    existing.revenue += bookingRevenue;
    totalRevenue += bookingRevenue;
    rows.set(key, existing);
  }
  return [...rows.entries()]
    .map(([source, { bookings, revenue }]) => ({
      source,
      bookings,
      revenue,
      percentageOfRevenue: totalRevenue > 0 ? revenue / totalRevenue : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue || a.source.localeCompare(b.source));
}

// ── 7. getNetCollectionRate ──────────────────────────────────────────────────
// collected / billed. "Billed" = sum of total_price excluding cancelled +
// no_show (these were never collectable). Returns 0 when billed=0. Over-collected
// returns true ratio (e.g. > 1 from refunded-then-overpaid edge cases).
export function getNetCollectionRate(data: ReportData): NetCollectionRate {
  let collected = 0;
  let billed = 0;
  for (const booking of data.bookings) {
    if (["cancelled", "no_show"].includes(booking.status)) continue;
    billed += amount(booking.total_price);
    collected += amount(booking.amount_paid);
  }
  const rate = billed > 0 ? collected / billed : 0;
  return { rate, collected, billed };
}

// ── 8. getAvgBookingValue ────────────────────────────────────────────────────
// AUDIT-2026-05-22 Q2 lock: completedRevenue / completedBookingCount.
// "Revenue per completed visit" — matches industry standard + summarizeReports'
// existing completedRevenue accumulator. Returns 0 when denominator=0.
export function getAvgBookingValue(data: ReportData): number {
  let completedRevenue = 0;
  let completedBookingCount = 0;
  for (const booking of data.bookings) {
    if (booking.status !== "completed") continue;
    completedRevenue += amount(booking.amount_paid || booking.total_price);
    completedBookingCount += 1;
  }
  return completedBookingCount > 0 ? completedRevenue / completedBookingCount : 0;
}

// ── 9. getStaffScorecard ─────────────────────────────────────────────────────
// Per-staff snapshot of clinical (Therapist-relevant) + admin (Coordinator-
// relevant) metrics with optional deltas vs prior period.
//
// Args:
//   data         current-period ReportData (already RBAC-narrowed upstream)
//   staffId      the staff member to score
//   priorData    OPTIONAL — prior-period ReportData (from buildPriorPeriodFilters
//                + a second getReportData call). When supplied, populates
//                `deltas` (current − prior).
//   auditLogs    OPTIONAL — audit_log rows spanning BOTH current AND prior
//                periods. Required for non-zero admin.* counts AND for
//                deltas.admin.*. Internal date-filter splits into current/prior
//                using data.filters / priorData.filters.
//
// Returns zero-filled scorecard when staffId has no activity (never throws,
// never NaN). When priorData supplied, deltas contain admin.* fields only when
// auditLogs also supplied; otherwise admin deltas are all 0.
export function getStaffScorecard(
  data: ReportData,
  staffId: string,
  priorData?: ReportData,
  auditLogs?: AuditEventRow[]
): StaffScorecard {
  const clinical = computeClinicalScorecard(data, staffId);
  const admin = computeAdminScorecard(data, staffId, auditLogs, data.filters);

  if (!priorData) {
    return { clinical, admin };
  }

  const priorClinical = computeClinicalScorecard(priorData, staffId);
  const priorAdmin = computeAdminScorecard(priorData, staffId, auditLogs, priorData.filters);
  const deltas: StaffScorecardDeltas = {
    clinical: {
      assignmentsCompleted: clinical.assignmentsCompleted - priorClinical.assignmentsCompleted,
      hoursWorked: clinical.hoursWorked - priorClinical.hoursWorked,
      clientsTouched: clinical.clientsTouched - priorClinical.clientsTouched,
      revenueAttributed: clinical.revenueAttributed - priorClinical.revenueAttributed,
      utilisationRate: clinical.utilisation.rate - priorClinical.utilisation.rate,
      retentionRate: clinical.retention.rate - priorClinical.retention.rate,
      noShowRate: clinical.noShowRate.rate - priorClinical.noShowRate.rate,
    },
    admin: {
      enquiriesContactedCount: admin.enquiriesContactedCount - priorAdmin.enquiriesContactedCount,
      enquiryConversionRate: admin.enquiryConversionRate - priorAdmin.enquiryConversionRate,
      avgMinutesToFirstContact: admin.avgMinutesToFirstContact - priorAdmin.avgMinutesToFirstContact,
      bookingsAssignedCount: admin.bookingsAssignedCount - priorAdmin.bookingsAssignedCount,
      opsEventsResolvedCount: admin.opsEventsResolvedCount - priorAdmin.opsEventsResolvedCount,
    },
  };
  return { clinical, admin, deltas };
}

function computeClinicalScorecard(
  data: ReportData,
  staffId: string
): StaffScorecardClinical {
  const staffAssignments = data.assignments.filter((a) => a.assigned_staff_id === staffId);
  const assignmentsTotal = staffAssignments.length;
  const assignmentsCompleted = staffAssignments.filter((a) => a.status === "completed").length;
  const sameGenderFulfilled = staffAssignments.filter((a) => {
    const required = a.required_therapist_gender;
    return required && required !== "any" && a.status === "completed";
  }).length;

  const bookingById = new Map(data.bookings.map((b) => [b.id, b]));
  const staffBookings = staffAssignments
    .map((a) => bookingById.get(a.booking_id))
    .filter((b): b is ReportBooking => Boolean(b));

  let hoursWorkedMinutes = 0;
  const clientIds = new Set<string>();
  for (const booking of staffBookings) {
    if (booking.status === "completed") {
      hoursWorkedMinutes += diffTimeStringsInMinutes(booking.start_time, booking.end_time);
    }
    if (booking.client_id) clientIds.add(booking.client_id);
  }
  const hoursWorked = hoursWorkedMinutes / 60;
  const clientsTouched = clientIds.size;

  // Revenue attributed: matches the existing getStaffRevenueAttribution shape —
  // service-item value where the participant's assignment goes to this staff.
  const assignmentByParticipant = new Map(
    data.assignments
      .filter((a) => a.assigned_staff_id === staffId && a.participant_id)
      .map((a) => [a.participant_id as string, a])
  );
  let revenueAttributed = 0;
  for (const item of data.bookingItems) {
    if (!item.booking_participant_id) continue;
    if (assignmentByParticipant.has(item.booking_participant_id)) {
      revenueAttributed += amount(item.service_price_snapshot);
    }
  }

  const utilisation = getUtilisationRate(data, { staffId });
  const retention = getRetentionRate(data, { staffId });
  const noShowRate = getNoShowRate(data, { staffId });

  return {
    assignmentsTotal,
    assignmentsCompleted,
    hoursWorked,
    clientsTouched,
    revenueAttributed,
    utilisation,
    retention,
    noShowRate,
    sameGenderFulfilled,
  };
}

function computeAdminScorecard(
  data: ReportData,
  staffId: string,
  auditLogs: AuditEventRow[] | undefined,
  periodFilters: ReportFilters
): StaffScorecardAdmin {
  if (!auditLogs || auditLogs.length === 0) {
    return {
      enquiriesContactedCount: 0,
      enquiryConversionRate: 0,
      avgMinutesToFirstContact: 0,
      bookingsAssignedCount: 0,
      opsEventsResolvedCount: 0,
    };
  }

  const periodLogs = filterAuditLogsToPeriod(auditLogs, periodFilters);

  // enquiriesContactedCount: first-transition-to-contacted events by this staff
  const contactedEnquiryIds = new Set<string>();
  for (const log of periodLogs) {
    if (log.actor_staff_id !== staffId) continue;
    if (log.action_type !== AUDIT_ACTION_TYPES.ENQUIRY_STATUS_UPDATED) continue;
    const afterStatus = (log.after_state as { status?: string } | null)?.status;
    const beforeStatus = (log.before_state as { status?: string } | null)?.status;
    if (afterStatus === "contacted" && beforeStatus !== "contacted") {
      if (log.target_id) contactedEnquiryIds.add(log.target_id);
    }
  }
  const enquiriesContactedCount = contactedEnquiryIds.size;

  // bookingsAssignedCount: any assignment action by this staff (reassign covers
  // admin/coord dispatching; claim covers self-assignment by the actor)
  let bookingsAssignedCount = 0;
  for (const log of periodLogs) {
    if (log.actor_staff_id !== staffId) continue;
    if (
      log.action_type === AUDIT_ACTION_TYPES.BOOKING_ASSIGNMENT_REASSIGNED ||
      log.action_type === AUDIT_ACTION_TYPES.BOOKING_ASSIGNMENT_CLAIMED
    ) {
      bookingsAssignedCount += 1;
    }
  }

  // opsEventsResolvedCount: status_updated → resolved by this staff
  let opsEventsResolvedCount = 0;
  for (const log of periodLogs) {
    if (log.actor_staff_id !== staffId) continue;
    if (log.action_type !== AUDIT_ACTION_TYPES.OPERATIONAL_EVENT_STATUS_UPDATED) continue;
    const afterStatus = (log.after_state as { status?: string } | null)?.status;
    if (afterStatus === "resolved") opsEventsResolvedCount += 1;
  }

  // enquiryConversionRate: of enquiries this staff contacted, how many ended up
  // converted (status='booked' + converted_booking_id NOT NULL).
  let convertedFromContactedByMe = 0;
  for (const enquiry of data.enquiries) {
    if (!contactedEnquiryIds.has(enquiry.id)) continue;
    if (enquiry.status === "booked" && enquiry.converted_booking_id != null) {
      convertedFromContactedByMe += 1;
    }
  }
  const enquiryConversionRate =
    enquiriesContactedCount > 0 ? convertedFromContactedByMe / enquiriesContactedCount : 0;

  // avgMinutesToFirstContact: mean(first_contacted_at − created_at) across the
  // enquiries this staff first-contacted in this period.
  let totalMinutes = 0;
  let withTimestamp = 0;
  for (const enquiry of data.enquiries) {
    if (!contactedEnquiryIds.has(enquiry.id)) continue;
    if (!enquiry.first_contacted_at || !enquiry.created_at) continue;
    const created = Date.parse(enquiry.created_at);
    const contacted = Date.parse(enquiry.first_contacted_at);
    if (Number.isNaN(created) || Number.isNaN(contacted)) continue;
    if (contacted < created) continue;
    totalMinutes += (contacted - created) / 60000;
    withTimestamp += 1;
  }
  const avgMinutesToFirstContact = withTimestamp > 0 ? totalMinutes / withTimestamp : 0;

  return {
    enquiriesContactedCount,
    enquiryConversionRate,
    avgMinutesToFirstContact,
    bookingsAssignedCount,
    opsEventsResolvedCount,
  };
}

// ── 10. getAuditLogForStaff ──────────────────────────────────────────────────
// Async DB read. Returns the most recent N audit_logs rows where this staff
// was the actor, ordered DESC by created_at. Consumes
// audit_logs_actor_recent_idx (B-2 indexes migration). Used by B-3 Performance
// surface activity timeline.
export async function getAuditLogForStaff(
  adminClient: SupabaseClient,
  staffId: string,
  limit = 20
): Promise<AuditEventRow[]> {
  return Sentry.startSpan(
    {
      name: "getAuditLogForStaff",
      op: "db.query",
      attributes: { staff_id: staffId, limit },
    },
    async () => {
      const { data, error } = await adminClient
        .from("audit_logs")
        .select(
          "id, actor_staff_id, action_type, target_type, target_id, before_state, after_state, created_at"
        )
        .eq("actor_staff_id", staffId)
        .order("created_at", { ascending: false })
        .limit(limit)
        .returns<AuditEventRow[]>();
      if (error) return [];
      return data ?? [];
    }
  );
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function shiftYmd(yyyyMmDd: string, days: number): string {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetweenInclusive(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T00:00:00Z`);
  const b = new Date(`${toYmd}T00:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

function diffTimeStringsInMinutes(start: string, end: string): number {
  // start / end are HH:MM[:SS] strings (Postgres `time` shape). No timezone.
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = (sh || 0) * 60 + (sm || 0);
  const endMin = (eh || 0) * 60 + (em || 0);
  return Math.max(endMin - startMin, 0);
}

function filterBookingsToStaff(data: ReportData, staffId: string): ReportBooking[] {
  const staffBookingIds = new Set(
    data.assignments
      .filter((a) => a.assigned_staff_id === staffId)
      .map((a) => a.booking_id)
  );
  return data.bookings.filter((b) => staffBookingIds.has(b.id));
}

function filterAuditLogsToPeriod(
  logs: AuditEventRow[],
  filters: ReportFilters
): AuditEventRow[] {
  if (!filters.from || !filters.to) return logs;
  // filters.from / filters.to are YYYY-MM-DD; expand to inclusive UTC bounds.
  const fromMs = Date.parse(`${filters.from}T00:00:00.000Z`);
  const toMs = Date.parse(`${filters.to}T23:59:59.999Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return logs;
  return logs.filter((log) => {
    const t = Date.parse(log.created_at);
    if (Number.isNaN(t)) return false;
    return t >= fromMs && t <= toMs;
  });
}

/**
 * The subset of `ReportData.staff` a viewer is entitled to resolve to a NAME.
 *
 * ITEM N — `getReportData` narrows bookings only, so `data.staff` is the whole
 * clinic roster for every profile, including a Therapist holding none of
 * VIEW_STAFF or MANAGE_STAFF_PROFILES. Any surface that turns a staff id into a
 * name must therefore narrow it here first; handed the raw roster and an
 * unvalidated `?staffId=` it would resolve a colleague's name for anyone who
 * guessed or copied their id.
 *
 * A viewer always keeps themselves, so their own scope pill and filter chips
 * still read as a name rather than a UUID. Anything else falls back to the id
 * the caller already had.
 *
 * ⛔ This narrows a RENDER, not the fetch. The five clinic-wide collections are
 * still fetched for everyone; that is the rest of ITEM N.
 */
export function resolvableStaffFor<T extends { id: string }>(
  profile: StaffProfile,
  staff: T[]
): T[] {
  if (canViewStaff(profile) || canManageStaffProfiles(profile)) return staff;
  return staff.filter((member) => member.id === profile.id);
}
