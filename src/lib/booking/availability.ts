import type { SupabaseClient } from "@supabase/supabase-js";

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

interface BusinessSettingsRecord {
  booking_window_days: number;
  buffer_time_mins: number;
  minimum_notice_hours: number;
  allowed_cities: unknown;
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

interface StaffDateOverrideRecord extends DateOverrideRecord {
  staff_id: string;
}

interface StaffBlockedDateRecord {
  staff_id: string;
}

interface BookingRecord {
  id: string;
  start_time: string;
  end_time: string;
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

const SLOT_STEP_MINS = 30;
const BOOKING_ELIGIBILITY_PERMISSIONS = new Set([
  "claim_bookings",
  "claim_assignments",
]);
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

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDayOfWeek(date: string) {
  return new Date(`${date}T00:00:00`).getDay();
}

function toDateTime(date: string, time: string) {
  return new Date(`${date}T${time.slice(0, 5)}:00`);
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

function getAllowedCities(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((city): city is string => typeof city === "string")
        .map((city) => city.trim().toLowerCase())
    : [];
}

function isCityAllowed(city: string, allowedCities: string[]) {
  const normalizedCity = city.trim().toLowerCase();
  return allowedCities.some(
    (allowedCity) =>
      normalizedCity === allowedCity || normalizedCity.includes(allowedCity)
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
  globalOverride,
  staffRulesByStaffId,
  staffBlockedIds,
  staffOverrideByStaffId,
}: {
  staff: StaffRecord;
  dayOfWeek: number;
  globalBlocked: boolean;
  globalRules: AvailabilityRuleRecord[];
  globalOverride?: DateOverrideRecord;
  staffRulesByStaffId: Map<string, StaffAvailabilityRuleRecord[]>;
  staffBlockedIds: Set<string>;
  staffOverrideByStaffId: Map<string, StaffDateOverrideRecord>;
}) {
  if (globalBlocked || staffBlockedIds.has(staff.id)) return [];

  const staffOverride = staffOverrideByStaffId.get(staff.id);
  if (isBlockingOverride(staffOverride)) return [];
  if (staffOverride) return normalizeWindows([staffOverride]);

  if (staff.availability_mode === "custom") {
    return getRuleWindowsForDay(staffRulesByStaffId.get(staff.id) ?? [], dayOfWeek);
  }

  if (isBlockingOverride(globalOverride)) return [];
  if (globalOverride) return normalizeWindows([globalOverride]);

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
  const today = toDateString(now);

  const settingsResult = await supabase
    .from("business_settings")
    .select(
      "booking_window_days, buffer_time_mins, minimum_notice_hours, allowed_cities, booking_status_enabled"
    )
    .eq("id", 1)
    .single<BusinessSettingsRecord>();

  if (settingsResult.error || !settingsResult.data) {
    return emptyResult(input, 0, requiredStaffByGender, "Booking settings unavailable.");
  }

  const settings = settingsResult.data;
  if (!settings.booking_status_enabled) {
    return emptyResult(input, 0, requiredStaffByGender, "Online booking is currently paused.");
  }

  const lastBookableDate = toDateString(addDays(now, settings.booking_window_days));
  if (input.date < today || input.date > lastBookableDate) {
    return emptyResult(input, 0, requiredStaffByGender, "Date is outside the booking window.");
  }

  if (!isCityAllowed(input.city, getAllowedCities(settings.allowed_cities))) {
    return emptyResult(input, 0, requiredStaffByGender, "Location is outside the service area.");
  }

  const serviceResult = await supabase
    .from("services")
    .select("slug, duration_mins, gender_restrictions")
    .in("slug", input.serviceIds)
    .eq("is_active", true)
    .eq("is_visible_on_frontend", true)
    .returns<ServiceRecord[]>();

  const services = serviceResult.data ?? [];
  if (serviceResult.error || services.length !== input.serviceIds.length) {
    return emptyResult(input, 0, requiredStaffByGender, "Selected service is unavailable.");
  }

  if (!servicesAllowParticipants(services, input.participantGenders)) {
    return emptyResult(input, 0, requiredStaffByGender, "Selected service is not suitable for every participant.");
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
    return emptyResult(input, durationMins, requiredStaffByGender, "No eligible staff are available.");
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
    return emptyResult(input, durationMins, requiredStaffByGender, "Staff permission data unavailable.");
  }

  const eligibleStaff = filterStaffWithBookingPermissions(
    staff,
    rolePermissionsResult.data ?? [],
    staffOverridesResult.data ?? []
  );
  if (eligibleStaff.length === 0) {
    return emptyResult(input, durationMins, requiredStaffByGender, "No eligible staff are available.");
  }

  const eligibleStaffIds = eligibleStaff.map((member) => member.id);
  const dayOfWeek = getDayOfWeek(input.date);

  const [
    globalRulesResult,
    blockedDatesResult,
    globalOverrideResult,
    staffRulesResult,
    staffBlockedResult,
    staffOverrideResult,
    bookingsResult,
  ] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("day_of_week, start_time, end_time, is_working_day")
      .returns<AvailabilityRuleRecord[]>(),
    supabase
      .from("blocked_dates")
      .select("blocked_date")
      .eq("blocked_date", input.date),
    supabase
      .from("availability_overrides")
      .select("start_time, end_time")
      .eq("override_date", input.date)
      .maybeSingle<DateOverrideRecord>(),
    supabase
      .from("staff_availability_rules")
      .select("staff_id, day_of_week, start_time, end_time, is_working_day")
      .in("staff_id", eligibleStaffIds)
      .returns<StaffAvailabilityRuleRecord[]>(),
    supabase
      .from("staff_blocked_dates")
      .select("staff_id")
      .eq("blocked_date", input.date)
      .in("staff_id", eligibleStaffIds)
      .returns<StaffBlockedDateRecord[]>(),
    supabase
      .from("staff_availability_overrides")
      .select("staff_id, start_time, end_time, override_type")
      .eq("override_date", input.date)
      .in("staff_id", eligibleStaffIds)
      .returns<StaffDateOverrideRecord[]>(),
    supabase
      .from("bookings")
      .select("id, start_time, end_time")
      .eq("booking_date", input.date)
      .in("status", ["pending", "confirmed"])
      .returns<BookingRecord[]>(),
  ]);

  if (
    globalRulesResult.error ||
    blockedDatesResult.error ||
    globalOverrideResult.error ||
    staffRulesResult.error ||
    staffBlockedResult.error ||
    staffOverrideResult.error ||
    bookingsResult.error
  ) {
    return emptyResult(input, durationMins, requiredStaffByGender, "Availability data unavailable.");
  }

  const bookings = bookingsResult.data ?? [];
  const bookingIds = bookings.map((booking) => booking.id);
  const assignmentsResult =
    bookingIds.length > 0
      ? await supabase
          .from("booking_assignments")
          .select("booking_id, assigned_staff_id, required_therapist_gender")
          .in("booking_id", bookingIds)
          .in("status", ["unassigned", "assigned"])
          .returns<BookingAssignmentRecord[]>()
      : { data: [], error: null };

  if (assignmentsResult.error) {
    return emptyResult(input, durationMins, requiredStaffByGender, "Booking assignment data unavailable.");
  }

  const staffRulesByStaffId = new Map<string, StaffAvailabilityRuleRecord[]>();
  for (const rule of staffRulesResult.data ?? []) {
    staffRulesByStaffId.set(rule.staff_id, [
      ...(staffRulesByStaffId.get(rule.staff_id) ?? []),
      rule,
    ]);
  }

  const staffOverrideByStaffId = new Map(
    (staffOverrideResult.data ?? []).map((override) => [override.staff_id, override])
  );
  const staffBlockedIds = new Set(
    (staffBlockedResult.data ?? []).map((blocked) => blocked.staff_id)
  );
  const staffWindowsById = new Map(
    eligibleStaff.map((member) => [
      member.id,
      resolveStaffWindows({
        staff: member,
        dayOfWeek,
        globalBlocked: (blockedDatesResult.data ?? []).length > 0,
        globalRules: globalRulesResult.data ?? [],
        globalOverride: globalOverrideResult.data ?? undefined,
        staffRulesByStaffId,
        staffBlockedIds,
        staffOverrideByStaffId,
      }),
    ])
  );
  const busyByStaffId = new Map(
    eligibleStaff.map((member) => [
      member.id,
      bookingBusyIntervals(
        bookings,
        assignmentsResult.data ?? [],
        member.id
      ),
    ])
  );

  const minimumNoticeAt = new Date(
    now.getTime() + settings.minimum_notice_hours * 60 * 60 * 1000
  );
  const slots: AvailableSlot[] = [];

  for (let start = 0; start <= 24 * 60 - durationMins; start += SLOT_STEP_MINS) {
    const end = start + durationMins;
    const startTime = minutesToTime(start);

    if (toDateTime(input.date, startTime) < minimumNoticeAt) {
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
      bookings,
      assignmentsResult.data ?? [],
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

  return {
    date: input.date,
    slots,
    durationMins,
    requiredStaffByGender,
  };
}
