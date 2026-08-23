import type { SupabaseClient } from "@supabase/supabase-js";
import {

  getBusinessDayOfWeek,
  isDateInBusinessWindow,
  isOutsideMinimumNotice,
} from "@/lib/time/london";

export type TherapistGender = "male" | "female";
export type AvailabilityMode = "use_global" | "custom" | "global_with_overrides";

export interface CalculateAvailableSlotsInput {
  date: string;
  serviceIds: string[];
  participantGenders: TherapistGender[];
  city: string;
}

export interface AvailableSlot {
  time: string;
  availableStaffByGender: Record<TherapistGender, number>;
}

export interface AvailableSlotsResult {
  date: string;
  slots: AvailableSlot[];
  durationMins: number;
  requiredStaffByGender: Record<TherapistGender, number>;
  reason?: string;
}

export interface CalculateAvailableDaysInput {
  dates: string[];
  serviceIds: string[];
  participantGenders: TherapistGender[];
  city: string;
}

export interface AvailableDaySummary {
  date: string;
  hasSlots: boolean;
  slotCount: number;
}

export interface AvailableDaysResult {
  days: AvailableDaySummary[];
  durationMins: number;
  requiredStaffByGender: Record<TherapistGender, number>;
  reason?: string;
}

interface BusinessSettingsRecord {
  booking_window_days: number;
  buffer_time_mins: number;
  minimum_notice_hours: number;
  booking_status_enabled: boolean;
}

interface ServiceRecord {
  slug: string;
  duration_mins: number;
  gender_restrictions: "any" | "male_only" | "female_only";
}

interface StaffRecord {
  id: string;
  role_id: string;
  gender: TherapistGender;
  availability_mode: AvailabilityMode;
}

interface PermissionRelation {
  name: string;
}

interface RolePermissionRecord {
  role_id: string;
  permissions: PermissionRelation | null;
}

interface StaffPermissionOverrideRecord {
  staff_id: string;
  is_granted: boolean;
  permissions: PermissionRelation | null;
}

interface AvailabilityRuleRecord {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
}

interface StaffAvailabilityRuleRecord extends AvailabilityRuleRecord {
  staff_id: string;
}

interface DateOverrideRecord {
  start_time: string;
  end_time: string;
  override_type?: string | null;
}

interface GlobalOverrideRow extends DateOverrideRecord {
  override_date: string;
}

interface StaffDateOverrideRecord extends DateOverrideRecord {
  staff_id: string;
}

interface StaffDateOverrideRow extends StaffDateOverrideRecord {
  override_date: string;
}

interface BlockedDateRow {
  blocked_date: string;
}

interface StaffBlockedDateRow {
  staff_id: string;
  blocked_date: string;
}

interface BookingRecord {
  id: string;
  start_time: string;
  end_time: string;
}

interface BookingRow extends BookingRecord {
  booking_date: string;
}

interface BookingAssignmentRecord {
  booking_id: string;
  assigned_staff_id: string | null;
  required_therapist_gender: TherapistGender;
}

interface TimeWindow {
  start: number;
  end: number;
}

interface AvailabilityContext {
  settings: BusinessSettingsRecord;
  durationMins: number;
  eligibleStaff: StaffRecord[];
  eligibleStaffIds: string[];
  globalRules: AvailabilityRuleRecord[];
  staffRulesByStaffId: Map<string, StaffAvailabilityRuleRecord[]>;
}

/**
 * ⛔ D-045 — WHY THE FAILURE IS TYPED AND NOT JUST WORDED.
 *
 * These reasons fall into two groups that call for OPPOSITE handling, and the
 * prose cannot tell them apart: "Selected service is unavailable." and
 * "Availability data unavailable." both end in the same word while meaning
 * completely different things.
 *
 *   "indeterminate"  a read failed. We do NOT know. Try again later.
 *   "not-bookable"   we found out, and the answer is never — the service is
 *                    deactivated, or no eligible staff exist at all.
 *
 * ⚠️ String-matching a human-facing message to decide behaviour is exactly the
 * brittleness that produces the next defect, so callers get a field instead.
 */
type ContextFailureKind = "indeterminate" | "not-bookable";

interface ContextFailure {
  reason: string;
  durationMins: number;
  kind: ContextFailureKind;
}

interface DayRecords {
  globalBlocked: boolean;
  // C-14 Phase C Step 13 — a date is now ALL of its override rows, not the
  // first one. Each row is a bookable window and every gap between two of them
  // is a break on that date. Plural on purpose: a singular name over an array
  // is exactly how the first-row-wins assumption survived this long.
  globalOverrides: DateOverrideRecord[];
  staffBlockedIds: Set<string>;
  staffOverridesByStaffId: Map<string, StaffDateOverrideRecord[]>;
  bookings: BookingRecord[];
  assignments: BookingAssignmentRecord[];
}

const SLOT_STEP_MINS = 30;
const BOOKING_ELIGIBILITY_PERMISSIONS = new Set(["claim_assignments"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function emptyResult(
  input: CalculateAvailableSlotsInput,
  durationMins: number,
  requiredStaffByGender: Record<TherapistGender, number>,
  reason: string
): AvailableSlotsResult {
  return {
    date: input.date,
    slots: [],
    durationMins,
    requiredStaffByGender,
    reason,
  };
}

function timeToMinutes(value: string) {
  if (!TIME_PATTERN.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeWindows(records: Array<{ start_time: string; end_time: string }>) {
  return records.flatMap((record): TimeWindow[] => {
    const start = timeToMinutes(record.start_time);
    const end = timeToMinutes(record.end_time);

    return start !== null && end !== null && end > start
      ? [{ start, end }]
      : [];
  });
}

function containsWindow(windows: TimeWindow[], start: number, end: number) {
  return windows.some((window) => start >= window.start && end <= window.end);
}

function overlaps(
  start: number,
  end: number,
  busyStart: number,
  busyEnd: number,
  bufferMins: number
) {
  return start < busyEnd + bufferMins && end > busyStart - bufferMins;
}

function countRequiredStaff(genders: TherapistGender[]) {
  return genders.reduce<Record<TherapistGender, number>>(
    (counts, gender) => ({
      ...counts,
      [gender]: counts[gender] + 1,
    }),
    { male: 0, female: 0 }
  );
}

function servicesAllowParticipants(
  services: ServiceRecord[],
  participantGenders: TherapistGender[]
) {
  const hasMale = participantGenders.includes("male");
  const hasFemale = participantGenders.includes("female");

  return services.every((service) => {
    if (service.gender_restrictions === "male_only") return !hasFemale;
    if (service.gender_restrictions === "female_only") return !hasMale;
    return true;
  });
}

function isBlockingOverride(override: DateOverrideRecord | undefined) {
  return ["blocked", "closed", "off", "unavailable"].includes(
    override?.override_type?.toLowerCase() ?? ""
  );
}

function getRuleWindowsForDay(
  rules: AvailabilityRuleRecord[],
  dayOfWeek: number
) {
  return normalizeWindows(
    rules.filter((rule) => rule.day_of_week === dayOfWeek && rule.is_working_day)
  );
}

function resolveStaffWindows({
  staff,
  dayOfWeek,
  globalBlocked,
  globalRules,
  globalOverrides,
  staffRulesByStaffId,
  staffBlockedIds,
  staffOverridesByStaffId,
}: {
  staff: StaffRecord;
  dayOfWeek: number;
  globalBlocked: boolean;
  globalRules: AvailabilityRuleRecord[];
  globalOverrides: DateOverrideRecord[];
  staffRulesByStaffId: Map<string, StaffAvailabilityRuleRecord[]>;
  staffBlockedIds: Set<string>;
  staffOverridesByStaffId: Map<string, StaffDateOverrideRecord[]>;
}) {
  if (globalBlocked || staffBlockedIds.has(staff.id)) return [];

  // C-14 Phase C Step 13. ANY blocking row closes the date: a closure and a
  // set of hours on the same date contradict each other, and the safe reading
  // of a contradiction is the one that cannot over-offer a slot. (Before the
  // widening whichever row happened to arrive first decided it.)
  const staffOverrides = staffOverridesByStaffId.get(staff.id) ?? [];
  if (staffOverrides.some((override) => isBlockingOverride(override))) return [];
  if (staffOverrides.length > 0) return normalizeWindows(staffOverrides);

  if (staff.availability_mode === "custom") {
    return getRuleWindowsForDay(staffRulesByStaffId.get(staff.id) ?? [], dayOfWeek);
  }

  if (globalOverrides.some((override) => isBlockingOverride(override))) return [];
  if (globalOverrides.length > 0) return normalizeWindows(globalOverrides);

  return getRuleWindowsForDay(globalRules, dayOfWeek);
}

function bookingBusyIntervals(
  bookings: BookingRecord[],
  assignments: BookingAssignmentRecord[],
  staffId: string
) {
  const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));

  return assignments
    .filter((assignment) => assignment.assigned_staff_id === staffId)
    .flatMap((assignment): TimeWindow[] => {
      const booking = bookingsById.get(assignment.booking_id);
      if (!booking) return [];

      const start = timeToMinutes(booking.start_time);
      const end = timeToMinutes(booking.end_time);
      return start !== null && end !== null && end > start
        ? [{ start, end }]
        : [];
    });
}

function unassignedReservationCounts(
  bookings: BookingRecord[],
  assignments: BookingAssignmentRecord[],
  start: number,
  end: number,
  bufferMins: number
) {
  const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));

  return assignments.reduce<Record<TherapistGender, number>>(
    (counts, assignment) => {
      if (assignment.assigned_staff_id) return counts;

      const booking = bookingsById.get(assignment.booking_id);
      const busyStart = booking ? timeToMinutes(booking.start_time) : null;
      const busyEnd = booking ? timeToMinutes(booking.end_time) : null;

      if (
        busyStart === null ||
        busyEnd === null ||
        !overlaps(start, end, busyStart, busyEnd, bufferMins)
      ) {
        return counts;
      }

      return {
        ...counts,
        [assignment.required_therapist_gender]:
          counts[assignment.required_therapist_gender] + 1,
      };
    },
    { male: 0, female: 0 }
  );
}

function getPermissionName(value: unknown) {
  return ((value as PermissionRelation | null)?.name ?? null);
}

function filterStaffWithBookingPermissions(
  staff: StaffRecord[],
  rolePermissions: RolePermissionRecord[],
  staffOverrides: StaffPermissionOverrideRecord[]
) {
  const permissionsByRoleId = new Map<string, Set<string>>();
  for (const row of rolePermissions) {
    const permissionName = getPermissionName(row.permissions);
    if (!permissionName) continue;

    permissionsByRoleId.set(row.role_id, permissionsByRoleId.get(row.role_id) ?? new Set());
    permissionsByRoleId.get(row.role_id)?.add(permissionName);
  }

  const overridesByStaffId = new Map<string, StaffPermissionOverrideRecord[]>();
  for (const override of staffOverrides) {
    overridesByStaffId.set(override.staff_id, [
      ...(overridesByStaffId.get(override.staff_id) ?? []),
      override,
    ]);
  }

  return staff.filter((member) => {
    const permissions = new Set(permissionsByRoleId.get(member.role_id) ?? []);

    for (const override of overridesByStaffId.get(member.id) ?? []) {
      const permissionName = getPermissionName(override.permissions);
      if (!permissionName) continue;

      if (override.is_granted) {
        permissions.add(permissionName);
      } else {
        permissions.delete(permissionName);
      }
    }

    return [...BOOKING_ELIGIBILITY_PERMISSIONS].some((permission) =>
      permissions.has(permission)
    );
  });
}

async function loadSettings(supabase: SupabaseClient) {
  const settingsResult = await supabase
    .from("business_settings")
    .select(
      "booking_window_days, buffer_time_mins, minimum_notice_hours, booking_status_enabled"
    )
    .eq("id", 1)
    .single<BusinessSettingsRecord>();

  return settingsResult.error || !settingsResult.data
    ? null
    : settingsResult.data;
}

/**
 * Loads everything that does not depend on the requested date: city and
 * service checks, eligible staff (with booking permissions), and the global
 * and per-staff weekly availability rules. Reason strings mirror the
 * original single-date implementation exactly.
 */
async function loadContextRest(
  supabase: SupabaseClient,
  settings: BusinessSettingsRecord,
  input: { serviceIds: string[]; participantGenders: TherapistGender[]; city: string },
  // ⛔ D-042/D-033 — DEFAULTS TO THE PUBLIC BEHAVIOUR. Only the nightly horizon
  // cron passes `includeHiddenServices`, so that hiding a service stops NEW
  // standing bookings without freezing ones a client already has. Every public
  // caller omits it and keeps the `is_visible_on_frontend` filter below.
  contextOptions: { includeHiddenServices?: boolean } = {}
): Promise<AvailabilityContext | ContextFailure> {
  // Item 8 Phase 2 — no city gate. An address outside the free-travel areas
  // still gets slots; the travel charge is an admin decision after the request
  // arrives, not a reason to show an empty calendar. `input.city` is retained
  // on the input type because callers still pass it and later phases will want
  // it for a non-blocking free-travel hint.
  const serviceQuery = supabase
    .from("services")
    .select("slug, duration_mins, gender_restrictions")
    .in("slug", input.serviceIds)
    .eq("is_active", true);
  // ⛔ `is_active` is NEVER relaxed — an inactive service is unbookable by
  // every path. Only WEBSITE VISIBILITY is, and only for the horizon cron.
  if (!contextOptions.includeHiddenServices) {
    serviceQuery.eq("is_visible_on_frontend", true);
  }
  const serviceResult = await serviceQuery.returns<ServiceRecord[]>();

  const services = serviceResult.data ?? [];
  if (serviceResult.error || services.length !== input.serviceIds.length) {
    return {
      reason: "Selected service is unavailable.",
      durationMins: 0,
      // The service row is missing, inactive, or (for public callers) hidden.
      kind: "not-bookable",
    };
  }

  if (!servicesAllowParticipants(services, input.participantGenders)) {
    return {
      reason: "Selected service is not suitable for every participant.",
      kind: "not-bookable" as const,
      durationMins: 0,
    };
  }

  const durationMins = services.reduce(
    (total, service) => total + service.duration_mins,
    0
  );
  const requiredGenders = Array.from(new Set(input.participantGenders));

  const staffResult = await supabase
    .from("staff_profiles")
    .select("id, role_id, gender, availability_mode")
    .eq("active", true)
    .eq("can_take_bookings", true)
    .in("gender", requiredGenders)
    .returns<StaffRecord[]>();

  const staff = staffResult.data ?? [];
  if (staffResult.error || staff.length === 0) {
    return {
      reason: "No eligible staff are available.",
      durationMins,
      kind: "not-bookable",
    };
  }

  const roleIds = Array.from(new Set(staff.map((member) => member.role_id)));
  const staffIds = staff.map((member) => member.id);
  const [rolePermissionsResult, staffOverridesResult] = await Promise.all([
    supabase
      .from("role_permissions")
      .select("role_id, permissions(name)")
      .in("role_id", roleIds)
      .returns<RolePermissionRecord[]>(),
    supabase
      .from("staff_permission_overrides")
      .select("staff_id, is_granted, permissions(name)")
      .in("staff_id", staffIds)
      .returns<StaffPermissionOverrideRecord[]>(),
  ]);

  if (rolePermissionsResult.error || staffOverridesResult.error) {
    return {
      reason: "Staff permission data unavailable.",
      durationMins,
      kind: "indeterminate",
    };
  }

  const eligibleStaff = filterStaffWithBookingPermissions(
    staff,
    rolePermissionsResult.data ?? [],
    staffOverridesResult.data ?? []
  );
  if (eligibleStaff.length === 0) {
    return {
      reason: "No eligible staff are available.",
      durationMins,
      kind: "not-bookable",
    };
  }

  const eligibleStaffIds = eligibleStaff.map((member) => member.id);

  const [globalRulesResult, staffRulesResult] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("day_of_week, start_time, end_time, is_working_day")
      .returns<AvailabilityRuleRecord[]>(),
    supabase
      .from("staff_availability_rules")
      .select("staff_id, day_of_week, start_time, end_time, is_working_day")
      .in("staff_id", eligibleStaffIds)
      .returns<StaffAvailabilityRuleRecord[]>(),
  ]);

  if (globalRulesResult.error || staffRulesResult.error) {
    return {
      reason: "Availability data unavailable.",
      durationMins,
      kind: "indeterminate",
    };
  }

  const staffRulesByStaffId = new Map<string, StaffAvailabilityRuleRecord[]>();
  for (const rule of staffRulesResult.data ?? []) {
    staffRulesByStaffId.set(rule.staff_id, [
      ...(staffRulesByStaffId.get(rule.staff_id) ?? []),
      rule,
    ]);
  }

  return {
    settings,
    durationMins,
    eligibleStaff,
    eligibleStaffIds,
    globalRules: globalRulesResult.data ?? [],
    staffRulesByStaffId,
  };
}

interface DayRecordsFailure {
  reason: string;
  /** ⛔ D-045 — every day-record failure is a failed READ, so it is always
   *  indeterminate. Carried explicitly so callers never have to infer it. */
  kind: "indeterminate";
}

/**
 * Loads every date-scoped record for the given dates in one round trip per
 * table, bucketed by date.
 *
 * C-14 Phase C Step 13 — override rows are bucketed in FULL, per date and per
 * staff+date. The single-date predecessor used maybeSingle() (which errors on
 * a duplicate row) and this batched rewrite then kept the first row per date;
 * both encoded one-window-per-date, which the segments model breaks by design.
 * Everything downstream already handled arrays: `normalizeWindows` maps each
 * record to a window and `containsWindow` requires a slot to fit inside ONE of
 * them, so the extra rows become breaks without any further engine change.
 */
async function loadDayRecords(
  supabase: SupabaseClient,
  dates: string[],
  eligibleStaffIds: string[],
  /**
   * D-051 - one booking to leave OUT of the capacity picture.
   *
   * Only the RESCHEDULE path passes this. A booking being moved already
   * occupies a slot, and when the new slot overlaps the old one (nudging 10:00
   * to 10:30, or moving to a different time on the same day) that reservation
   * would block the move as though somebody else held it - the booking
   * refusing to move because of itself.
   *
   * Undefined for every other caller, which is every existing one, so the
   * public availability engine's behaviour is untouched.
   */
  excludeBookingId?: string | null
): Promise<Map<string, DayRecords> | DayRecordsFailure> {
  const [
    blockedDatesResult,
    globalOverrideResult,
    staffBlockedResult,
    staffOverrideResult,
    bookingsResult,
  ] = await Promise.all([
    supabase
      .from("blocked_dates")
      .select("blocked_date")
      .in("blocked_date", dates)
      .returns<BlockedDateRow[]>(),
    supabase
      .from("availability_overrides")
      .select("override_date, start_time, end_time")
      .in("override_date", dates)
      .returns<GlobalOverrideRow[]>(),
    supabase
      .from("staff_blocked_dates")
      .select("staff_id, blocked_date")
      .in("blocked_date", dates)
      .in("staff_id", eligibleStaffIds)
      .returns<StaffBlockedDateRow[]>(),
    supabase
      .from("staff_availability_overrides")
      .select("staff_id, start_time, end_time, override_type, override_date")
      .in("override_date", dates)
      .in("staff_id", eligibleStaffIds)
      .returns<StaffDateOverrideRow[]>(),
    supabase
      .from("bookings")
      .select("id, start_time, end_time, booking_date")
      .in("booking_date", dates)
      .in("status", ["pending", "confirmed"])
      .returns<BookingRow[]>(),
  ]);

  if (
    blockedDatesResult.error ||
    globalOverrideResult.error ||
    staffBlockedResult.error ||
    staffOverrideResult.error ||
    bookingsResult.error
  ) {
    return { reason: "Availability data unavailable.", kind: "indeterminate" as const };
  }

  // D-051 - drop the booking being moved before anything downstream sees it.
  // Filtering HERE covers both halves in one place: the capacity count, and the
  // per-staff busy intervals, because `bookingIds` (and therefore the
  // assignment fetch below) is derived from this list.
  const bookings = (bookingsResult.data ?? []).filter(
    (booking) => !excludeBookingId || booking.id !== excludeBookingId
  );
  const bookingIds = bookings.map((booking) => booking.id);
  const assignmentsResult =
    bookingIds.length > 0
      ? await supabase
          .from("booking_assignments")
          .select("booking_id, assigned_staff_id, required_therapist_gender")
          .in("booking_id", bookingIds)
          .in("status", ["unassigned", "assigned"])
          .returns<BookingAssignmentRecord[]>()
      : { data: [] as BookingAssignmentRecord[], error: null };

  if (assignmentsResult.error) {
    return {
      reason: "Booking assignment data unavailable.",
      kind: "indeterminate" as const,
    };
  }

  const bookingDateById = new Map(
    bookings.map((booking) => [booking.id, booking.booking_date])
  );

  const byDate = new Map<string, DayRecords>();
  for (const date of dates) {
    byDate.set(date, {
      globalBlocked: false,
      globalOverrides: [],
      staffBlockedIds: new Set<string>(),
      staffOverridesByStaffId: new Map<string, StaffDateOverrideRecord[]>(),
      bookings: [],
      assignments: [],
    });
  }

  for (const row of blockedDatesResult.data ?? []) {
    const day = byDate.get(row.blocked_date);
    if (day) day.globalBlocked = true;
  }

  for (const row of globalOverrideResult.data ?? []) {
    byDate.get(row.override_date)?.globalOverrides.push({
      start_time: row.start_time,
      end_time: row.end_time,
    });
  }

  for (const row of staffBlockedResult.data ?? []) {
    byDate.get(row.blocked_date)?.staffBlockedIds.add(row.staff_id);
  }

  for (const row of staffOverrideResult.data ?? []) {
    const day = byDate.get(row.override_date);
    if (!day) continue;
    day.staffOverridesByStaffId.set(row.staff_id, [
      ...(day.staffOverridesByStaffId.get(row.staff_id) ?? []),
      {
        staff_id: row.staff_id,
        start_time: row.start_time,
        end_time: row.end_time,
        override_type: row.override_type,
      },
    ]);
  }

  for (const booking of bookings) {
    byDate.get(booking.booking_date)?.bookings.push({
      id: booking.id,
      start_time: booking.start_time,
      end_time: booking.end_time,
    });
  }

  for (const assignment of assignmentsResult.data ?? []) {
    const bookingDate = bookingDateById.get(assignment.booking_id);
    if (bookingDate) {
      byDate.get(bookingDate)?.assignments.push(assignment);
    }
  }

  return byDate;
}

/**
 * Pure slot computation for one date given the loaded context and that
 * date's records. Mirrors the original implementation line for line.
 */
function computeDaySlots(
  context: AvailabilityContext,
  day: DayRecords,
  date: string,
  now: Date,
  requiredStaffByGender: Record<TherapistGender, number>
): AvailableSlot[] {
  const { settings, durationMins, eligibleStaff } = context;
  const dayOfWeek = getBusinessDayOfWeek(date);

  const staffWindowsById = new Map(
    eligibleStaff.map((member) => [
      member.id,
      resolveStaffWindows({
        staff: member,
        dayOfWeek,
        globalBlocked: day.globalBlocked,
        globalRules: context.globalRules,
        globalOverrides: day.globalOverrides,
        staffRulesByStaffId: context.staffRulesByStaffId,
        staffBlockedIds: day.staffBlockedIds,
        staffOverridesByStaffId: day.staffOverridesByStaffId,
      }),
    ])
  );
  const busyByStaffId = new Map(
    eligibleStaff.map((member) => [
      member.id,
      bookingBusyIntervals(day.bookings, day.assignments, member.id),
    ])
  );

  const slots: AvailableSlot[] = [];

  for (let start = 0; start <= 24 * 60 - durationMins; start += SLOT_STEP_MINS) {
    const end = start + durationMins;
    const startTime = minutesToTime(start);

    if (
      !isOutsideMinimumNotice({
        date,
        time: startTime,
        now,
        minimumNoticeHours: settings.minimum_notice_hours,
      })
    ) {
      continue;
    }

    const availableStaffByGender = eligibleStaff.reduce<Record<TherapistGender, number>>(
      (counts, member) => {
        const windows = staffWindowsById.get(member.id) ?? [];
        const busyIntervals = busyByStaffId.get(member.id) ?? [];
        const isInsideAvailability = containsWindow(windows, start, end);
        const hasBusyOverlap = busyIntervals.some((busy) =>
          overlaps(start, end, busy.start, busy.end, settings.buffer_time_mins)
        );

        if (!isInsideAvailability || hasBusyOverlap) {
          return counts;
        }

        return {
          ...counts,
          [member.gender]: counts[member.gender] + 1,
        };
      },
      { male: 0, female: 0 }
    );

    const unassignedCounts = unassignedReservationCounts(
      day.bookings,
      day.assignments,
      start,
      end,
      settings.buffer_time_mins
    );

    const netAvailability = {
      male: Math.max(0, availableStaffByGender.male - unassignedCounts.male),
      female: Math.max(
        0,
        availableStaffByGender.female - unassignedCounts.female
      ),
    };

    if (
      netAvailability.male >= requiredStaffByGender.male &&
      netAvailability.female >= requiredStaffByGender.female
    ) {
      slots.push({
        time: startTime,
        availableStaffByGender: netAvailability,
      });
    }
  }

  return slots;
}

export async function calculateAvailableSlots(
  input: CalculateAvailableSlotsInput,
  supabase: SupabaseClient,
  options: { now?: Date } = {}
): Promise<AvailableSlotsResult> {
  const requiredStaffByGender = countRequiredStaff(input.participantGenders);

  if (!DATE_PATTERN.test(input.date)) {
    return emptyResult(input, 0, requiredStaffByGender, "Invalid date.");
  }

  const now = options.now ?? new Date();
  const settings = await loadSettings(supabase);

  if (!settings) {
    return emptyResult(input, 0, requiredStaffByGender, "Booking settings unavailable.");
  }

  if (!settings.booking_status_enabled) {
    return emptyResult(input, 0, requiredStaffByGender, "Online booking is currently paused.");
  }

  if (
    !isDateInBusinessWindow({
      date: input.date,
      now,
      bookingWindowDays: settings.booking_window_days,
    })
  ) {
    return emptyResult(input, 0, requiredStaffByGender, "Date is outside the booking window.");
  }

  const contextResult = await loadContextRest(supabase, settings, input);
  if ("reason" in contextResult) {
    return emptyResult(
      input,
      contextResult.durationMins,
      requiredStaffByGender,
      contextResult.reason
    );
  }

  const dayRecords = await loadDayRecords(supabase, [input.date], contextResult.eligibleStaffIds);
  if ("reason" in dayRecords) {
    return emptyResult(
      input,
      contextResult.durationMins,
      requiredStaffByGender,
      dayRecords.reason
    );
  }

  const day = dayRecords.get(input.date);
  const slots = day
    ? computeDaySlots(contextResult, day, input.date, now, requiredStaffByGender)
    : [];

  return {
    date: input.date,
    slots,
    durationMins: contextResult.durationMins,
    requiredStaffByGender,
  };
}

/**
 * Month-view variant: computes per-day availability summaries for a set of
 * dates in a single pass. Context and rules load once; date-scoped records
 * load in one round trip per table. Days outside the booking window come
 * back as unavailable without touching the database.
 */
export async function calculateAvailableDays(
  input: CalculateAvailableDaysInput,
  supabase: SupabaseClient,
  options: {
    now?: Date;
    /** Admin-only: report true therapist availability beyond the customer booking window. */
    ignoreBookingWindow?: boolean;
    /** Admin-only: staff keep booking while public online booking is paused. */
    ignorePublicPause?: boolean;
  } = {}
): Promise<AvailableDaysResult> {
  const requiredStaffByGender = countRequiredStaff(input.participantGenders);
  const unavailable = (reason?: string): AvailableDaysResult => ({
    days: input.dates.map((date) => ({ date, hasSlots: false, slotCount: 0 })),
    durationMins: 0,
    requiredStaffByGender,
    reason,
  });

  const now = options.now ?? new Date();
  const settings = await loadSettings(supabase);

  if (!settings) {
    return unavailable("Booking settings unavailable.");
  }

  if (!settings.booking_status_enabled && !options.ignorePublicPause) {
    return unavailable("Online booking is currently paused.");
  }

  const contextResult = await loadContextRest(supabase, settings, input);
  if ("reason" in contextResult) {
    return { ...unavailable(contextResult.reason), durationMins: contextResult.durationMins };
  }

  const datesInWindow = input.dates.filter(
    (date) =>
      DATE_PATTERN.test(date) &&
      (options.ignoreBookingWindow ||
        isDateInBusinessWindow({
          date,
          now,
          bookingWindowDays: settings.booking_window_days,
        }))
  );

  if (datesInWindow.length === 0) {
    return {
      days: input.dates.map((date) => ({ date, hasSlots: false, slotCount: 0 })),
      durationMins: contextResult.durationMins,
      requiredStaffByGender,
    };
  }

  const dayRecords = await loadDayRecords(
    supabase,
    datesInWindow,
    contextResult.eligibleStaffIds
  );
  if ("reason" in dayRecords) {
    return { ...unavailable(dayRecords.reason), durationMins: contextResult.durationMins };
  }

  const days = input.dates.map((date) => {
    const day = dayRecords.get(date);
    if (!day) {
      return { date, hasSlots: false, slotCount: 0 };
    }

    const slots = computeDaySlots(contextResult, day, date, now, requiredStaffByGender);
    return { date, hasSlots: slots.length > 0, slotCount: slots.length };
  });

  return {
    days,
    durationMins: contextResult.durationMins,
    requiredStaffByGender,
  };
}

// ─── D-042 — STANDING BOOKINGS ARE NO LONGER PLACED BLIND ────────────────────

export interface SeriesSlotCheckInput {
  /** Every occurrence date to test, YYYY-MM-DD. */
  dates: string[];
  /** The series' anchor start time, "HH:MM". */
  startTime: string;
  /** Service slugs — the same shape `calculateAvailableSlots` takes. */
  serviceIds: string[];
  participantGenders: TherapistGender[];
  city: string;
  /**
   * The bound therapist, when the series is locked to one person.
   *
   * ⛔ This is the half that can genuinely DOUBLE-BOOK. The create RPC always
   * writes `assigned_staff_id = NULL` (verified in the live function body), so
   * creating a series cannot collide anyone. The nightly horizon cron DOES
   * pre-assign the bound therapist, with no busy check at all — so it is the
   * cron, not the form, that could put one person in two places.
   */
  boundStaffId?: string | null;
  /**
   * D-051 - exclude ONE booking from the capacity picture, for the reschedule
   * path only. See `loadDayRecords`. Absent for every other caller.
   */
  excludeBookingId?: string | null;
  /**
   * D-051 - check the slot for THIS many minutes instead of the sum of the
   * services' CURRENT durations.
   *
   * ⛔ A booking stores the length it was scheduled for
   * (`bookings.total_duration_mins`), snapshotted at creation. This engine
   * re-derives length from the services table as it stands TODAY, and the two
   * diverge whenever a service's duration is edited after a booking is taken
   * - measured live: 5 of 14 bookings, 60 stored against 90 current.
   *
   * ⚠️ Today that direction is merely over-strict. Reverse it - a service
   * SHORTENED after booking - and the reschedule path would verify a short
   * window free and then write a longer one, which is exactly the
   * over-booking the feature exists to prevent. The window checked must be
   * the window written.
   *
   * Absent for every other caller, so the public engine is untouched.
   */
  durationMinsOverride?: number | null;
}

export interface SeriesSlotVerdict {
  date: string;
  /**
   * Is there capacity for the required gender at this date and time?
   *
   * ⛔ This deliberately does NOT account for the bound therapist — see
   * `boundStaffFree`. The two questions have different answers and, more
   * importantly, different consequences, so they are reported separately
   * rather than collapsed into one boolean the callers would have to guess at.
   */
  available: boolean;
  /**
   * Is the therapist the series is locked to free at this date and time?
   *
   * `undefined` when no `boundStaffId` was supplied.
   *
   * ⛔ WHY THIS IS SPLIT OUT. The two callers must do different things:
   *   * `createRecurringSeries` refuses — the operator explicitly locked this
   *     series to this person, so "they are busy" is a real answer to give.
   *   * the horizon cron creates the visit UNASSIGNED instead. That is the
   *     documented degradation (brief §5.5): a bound therapist who is
   *     unavailable must never stop a client's standing booking existing.
   * Collapsing both into `available: false` would have made the cron skip the
   * date entirely, silently dropping visits the clinic could actually cover.
   */
  boundStaffFree?: boolean;
  /** Plain-English, operator-facing. Absent when nothing is wrong. */
  reason?: string;
}

export interface SeriesSlotCheckResult {
  verdicts: SeriesSlotVerdict[];
  durationMins: number;
  /** Set when the check could not run at all; every verdict is then false. */
  reason?: string;
  /**
   * ⛔ D-045 — WHICH KIND of "could not run", because the two need opposite
   * handling and the wording cannot distinguish them:
   *
   *   "indeterminate"  a read failed. We do not know. ⛔ Fail closed and retry.
   *   "not-bookable"   we found out and the answer is never — the service was
   *                    deactivated, or no eligible staff exist at all.
   *
   * ⚠️ Owner ruling D-045 (2026-08-22) governs the second one for the nightly
   * job: **keep extending**. A client's standing booking must not quietly stop
   * because of an admin change, which is the same principle as D-033.
   */
  reasonKind?: "indeterminate" | "not-bookable";
}

/**
 * Can the clinic actually cover this standing booking, date by date?
 *
 * ── ⛔ WHY THIS EXISTS (Owner ruling D-042, 2026-08-22: "fix it properly") ───
 *
 * A one-off booking runs through `create_booking_request`, which checks opening
 * hours, date overrides, therapist working patterns, existing bookings and the
 * travel buffer. ⛔ A RECURRING booking checked NONE of that. Measured against
 * the live function bodies, not inferred from migration files:
 *
 *     create_recurring_booking_series: 'availability_rules' → 0 occurrences,
 *     'booking_status_enabled' → 0, 'p_override_availability' → 0
 *
 * Its only test was "does this same client already hold a booking at this date
 * and time", and the nightly cron repeats exactly that narrow check. So a
 * standing booking could be placed — and re-placed every night for years — on
 * days the clinic is shut, outside working hours, and with nobody free.
 *
 * ── ⛔ WHY IT IS HERE AND NOT IN SQL ────────────────────────────────────────
 *
 * The obvious fix is to copy `create_booking_request`'s availability block into
 * the recurring RPC. ⛔ That would create a THIRD capacity engine — and this
 * repo has already been bitten by exactly that: fix-list B5 / G-05-06, where
 * the named-therapist and unassigned paths disagreed about whether a
 * `completed` booking blocks a slot, and the customer calendar offered slots
 * the write path then refused.
 *
 * Both writers are TypeScript — `createRecurringSeries` calls the RPC, and the
 * cron materialises rows itself — so one shared check covers both, and it is
 * THE SAME ENGINE the public calendar uses: `loadContextRest`,
 * `loadDayRecords`, `resolveStaffWindows`, `bookingBusyIntervals`,
 * `containsWindow`, `overlaps` and `unassignedReservationCounts` are all reused
 * verbatim below. ⛔ No new rules are written here; if the calendar's answer
 * changes, this changes with it.
 *
 * ── ⛔ THE FOUR DELIBERATE DIFFERENCES FROM THE PUBLIC PATH ────────────────
 *
 * 1. **The public booking pause is ignored.** `booking_status_enabled` is the
 *    WEBSITE's own pause switch, and staff booking a regular over the phone are
 *    not the public. ⚠️ CORRECTED after an independent review (D-035): an
 *    earlier version of this note claimed that flag is what currently keeps
 *    live bookings closed. It is not — production has
 *    `booking_status_enabled = true` (measured), and the maintenance banner
 *    lives in the DEPLOYED CODE, not the database. The reason to ignore it here
 *    is the one above, not that one.
 * 2. **The booking window is ignored.** A series materialises 12 weeks out by
 *    design; the public window is far shorter. Honouring it would refuse every
 *    series for the boring reason.
 * 3. **Minimum notice is ignored.** It exists so a customer cannot book in
 *    twenty minutes' time. Every date here is at least today, and staff setting
 *    up a standing booking are making an arrangement, not a same-day request.
 * 4. **An exact TIME is tested, not the slot list.** `computeDaySlots` walks in
 *    `SLOT_STEP_MINS` steps; a series anchored off that grid would never match
 *    a listed slot. The windows and busy intervals are evaluated at the anchor
 *    directly, so the answer does not depend on the step size.
 *
 * ⚠️ What is NOT ignored, and must not be: opening hours, blocked days, date
 * overrides, each therapist's own working pattern, existing bookings, the
 * travel buffer, and unassigned reservations already holding capacity.
 */
export async function checkSeriesSlots(
  input: SeriesSlotCheckInput,
  supabase: SupabaseClient,
  options: {
    /**
     * ⛔ D-033 — the cron sets this. Hiding a service from the website must
     * stop NEW standing bookings (which `createRecurringSeries` already
     * enforces via `assertServicesBookable`) but must NOT stop an EXISTING
     * series rolling forward: "hiding a service must not silently cancel
     * appointments a client already has in their diary."
     *
     * ⛔ Without this flag the cron would inherit `loadContextRest`'s
     * `is_visible_on_frontend = true` filter, every date would come back
     * "service unavailable", and hiding a service would quietly freeze every
     * standing booking that uses it — the exact outcome D-033 forbids.
     *
     * Defaults to FALSE, so the public engine's behaviour is untouched.
     */
    includeHiddenServices?: boolean;
  } = {}
): Promise<SeriesSlotCheckResult> {
  const allUnavailable = (
    reason: string,
    durationMins = 0,
    reasonKind: "indeterminate" | "not-bookable" = "indeterminate"
  ): SeriesSlotCheckResult => ({
    verdicts: input.dates.map((date) => ({ date, available: false, reason })),
    durationMins,
    reason,
    reasonKind,
  });

  if (!TIME_PATTERN.test(input.startTime)) {
    return allUnavailable("Invalid start time.");
  }

  const settings = await loadSettings(supabase);
  if (!settings) {
    // ⛔ Fails CLOSED. Not being able to check is not the same as being free.
    return allUnavailable("Booking settings unavailable.");
  }

  const context = await loadContextRest(supabase, settings, input, {
    includeHiddenServices: options.includeHiddenServices,
  });
  if ("reason" in context) {
    return allUnavailable(context.reason, context.durationMins, context.kind);
  }

  const validDates = input.dates.filter((date) => DATE_PATTERN.test(date));
  if (validDates.length === 0) {
    return {
      verdicts: input.dates.map((date) => ({
        date,
        available: false,
        reason: "Invalid date.",
      })),
      durationMins: context.durationMins,
    };
  }

  const dayRecords = await loadDayRecords(
    supabase,
    validDates,
    context.eligibleStaffIds,
    input.excludeBookingId
  );
  if ("reason" in dayRecords) {
    return allUnavailable(dayRecords.reason, context.durationMins, dayRecords.kind);
  }

  // D-051 - the caller may pin the length; see `durationMinsOverride`.
  const effectiveDurationMins =
    typeof input.durationMinsOverride === "number" && input.durationMinsOverride > 0
      ? input.durationMinsOverride
      : context.durationMins;

  const requiredStaffByGender = countRequiredStaff(input.participantGenders);
  const start = timeToMinutes(input.startTime);
  // ⛔ TIME_PATTERN was checked at the top, so this cannot be null. Handled
  // rather than cast: a later change to either the pattern or this parser
  // would otherwise turn every comparison below into silent NaN arithmetic,
  // and NaN comparisons are false — which reads as "nobody is free" and
  // would refuse every series for a reason nobody could see.
  if (start === null) {
    return allUnavailable("Invalid start time.", context.durationMins);
  }
  const end = start + effectiveDurationMins;

  const verdicts = input.dates.map<SeriesSlotVerdict>((date) => {
    if (!DATE_PATTERN.test(date)) {
      return { date, available: false, reason: "Invalid date." };
    }
    const day = dayRecords.get(date);
    if (!day) {
      return { date, available: false, reason: "No availability information for that day." };
    }

    const dayOfWeek = getBusinessDayOfWeek(date);
    let freeMale = 0;
    let freeFemale = 0;
    let boundIsFree = false;

    for (const member of context.eligibleStaff) {
      const windows = resolveStaffWindows({
        staff: member,
        dayOfWeek,
        globalBlocked: day.globalBlocked,
        globalRules: context.globalRules,
        globalOverrides: day.globalOverrides,
        staffRulesByStaffId: context.staffRulesByStaffId,
        staffBlockedIds: day.staffBlockedIds,
        staffOverridesByStaffId: day.staffOverridesByStaffId,
      });
      const busy = bookingBusyIntervals(day.bookings, day.assignments, member.id);
      const free =
        containsWindow(windows, start, end) &&
        !busy.some((interval) =>
          overlaps(start, end, interval.start, interval.end, settings.buffer_time_mins)
        );

      if (!free) continue;
      if (member.gender === "male") freeMale += 1;
      else freeFemale += 1;
      if (input.boundStaffId && member.id === input.boundStaffId) boundIsFree = true;
    }

    // ⛔ Reservations that name nobody still consume capacity. Every website
    // booking is created unassigned, so leaving this out would count the same
    // therapist as free for several bookings at once — the F1 defect.
    const reserved = unassignedReservationCounts(
      day.bookings,
      day.assignments,
      start,
      end,
      settings.buffer_time_mins
    );
    const netMale = Math.max(0, freeMale - reserved.male);
    const netFemale = Math.max(0, freeFemale - reserved.female);

    const hasCapacity =
      netMale >= requiredStaffByGender.male && netFemale >= requiredStaffByGender.female;
    const boundStaffFree = input.boundStaffId ? boundIsFree : undefined;

    if (!hasCapacity) {
      return {
        date,
        available: false,
        boundStaffFree,
        reason: "No therapist of the right gender is free at that time.",
      };
    }

    if (input.boundStaffId && !boundIsFree) {
      return {
        date,
        // ⛔ TRUE on purpose. The clinic CAN cover this visit — just not with the
        // person the series is locked to. The cron uses that to create it
        // unassigned rather than drop it; the create action treats it as a
        // refusal. See the field docs on SeriesSlotVerdict.
        available: true,
        boundStaffFree: false,
        reason: "The therapist this series is locked to is not free at that time.",
      };
    }

    return { date, available: true, boundStaffFree };
  });

  return { verdicts, durationMins: context.durationMins };
}
