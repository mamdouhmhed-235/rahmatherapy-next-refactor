import type { SupabaseClient } from "@supabase/supabase-js";
import { addBusinessDays, getBusinessDate } from "@/lib/time/london";
import {
  canViewRevenueReports,
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

export interface ReportData {
  filters: ReportFilters;
  bookings: ReportBooking[];
  cityOptions: string[];
  assignments: ReportAssignment[];
  bookingItems: ReportBookingItem[];
  clients: ReportClient[];
  staff: ReportStaff[];
  enquiries: { id: string; full_name: string; source: string; status: string; created_at: string }[];
  emailEvents: EmailEvent[];
  operationalEvents: OperationalEvent[];
  staffAvailabilityRuleStaffIds: Set<string>;
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
      .select("staff_id")
      .returns<{ staff_id: string }[]>(),
    adminClient
      .from("enquiries")
      .select("id, full_name, source, status, created_at")
      .order("created_at", { ascending: false }),
    adminClient
      .from("email_delivery_events")
      .select("id, booking_id, staff_id, event_type, recipient_email, recipient_role, delivery_status, error_message, created_at")
      .order("created_at", { ascending: false })
      .returns<EmailEvent[]>(),
    adminClient
      .from("operational_events")
      .select("id, event_type, severity, status, summary, booking_id, staff_id, created_at")
      .order("created_at", { ascending: false })
      .returns<OperationalEvent[]>(),
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
    staffAvailabilityRuleStaffIds: new Set(
      (staffAvailabilityRulesResult.data ?? []).map((rule) => rule.staff_id)
    ),
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
      completedRevenue += amount(booking.amount_paid || booking.total_price);
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
      !data.staffAvailabilityRuleStaffIds.has(member.id)
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
  if (range === "week") return { from: today, to: addBusinessDays(today, 7) };
  if (range === "custom") return { from: today, to: today };
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
