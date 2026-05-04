import type { SupabaseClient } from "@supabase/supabase-js";
import { getBusinessDayOfWeek } from "@/lib/time/london";

type TherapistGender = "male" | "female";
type AvailabilityMode = "use_global" | "custom" | "global_with_overrides";

export interface AssignmentEligibilityBooking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
}

export interface StaffAssignmentCandidate {
  id: string;
  name: string;
  email: string;
  active: boolean;
  can_take_bookings: boolean;
  gender: TherapistGender;
  role_id: string;
  availability_mode: AvailabilityMode;
}

export interface StaffAssignmentPreview {
  staff: StaffAssignmentCandidate;
  eligible: boolean;
  reason: string;
}

interface TimeWindow {
  start: number;
  end: number;
}

const BOOKING_ELIGIBILITY_PERMISSIONS = new Set([
  "claim_bookings",
  "claim_assignments",
]);

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
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

function normalizeWindows(records: Array<{ start_time: string; end_time: string }>) {
  return records
    .map((record) => ({
      start: timeToMinutes(record.start_time),
      end: timeToMinutes(record.end_time),
    }))
    .filter((window) => window.end > window.start);
}

function permissionName(value: unknown) {
  return ((value as { name: string } | null)?.name ?? null);
}

function hasBookingEligibilityPermission(
  staff: StaffAssignmentCandidate,
  rolePermissions: Array<{ role_id: string; permissions: unknown }>,
  staffOverrides: Array<{ staff_id: string; is_granted: boolean; permissions: unknown }>
) {
  const permissions = new Set(
    rolePermissions
      .filter((row) => row.role_id === staff.role_id)
      .map((row) => permissionName(row.permissions))
      .filter((name): name is string => Boolean(name))
  );

  for (const override of staffOverrides.filter((row) => row.staff_id === staff.id)) {
    const name = permissionName(override.permissions);
    if (!name) continue;

    if (override.is_granted) {
      permissions.add(name);
    } else {
      permissions.delete(name);
    }
  }

  return [...BOOKING_ELIGIBILITY_PERMISSIONS].some((permission) =>
    permissions.has(permission)
  );
}

function isBlockingOverride(override: { override_type?: string | null } | undefined) {
  return ["blocked", "closed", "off", "unavailable"].includes(
    override?.override_type?.toLowerCase() ?? ""
  );
}

export async function getStaffAssignmentPreviews({
  booking,
  requiredGender,
  supabase,
}: {
  booking: AssignmentEligibilityBooking;
  requiredGender: TherapistGender;
  supabase: SupabaseClient;
}): Promise<StaffAssignmentPreview[]> {
  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("id, name, email, active, can_take_bookings, gender, role_id, availability_mode")
    .order("name")
    .returns<StaffAssignmentCandidate[]>();

  const candidates = staff ?? [];
  if (candidates.length === 0) return [];

  const roleIds = Array.from(new Set(candidates.map((candidate) => candidate.role_id)));
  const staffIds = candidates.map((candidate) => candidate.id);
  const dayOfWeek = getBusinessDayOfWeek(booking.booking_date);

  const [
    settingsResult,
    rolePermissionsResult,
    staffOverridesResult,
    globalBlockedResult,
    globalOverrideResult,
    globalRulesResult,
    staffBlockedResult,
    staffOverrideResult,
    staffRulesResult,
    busyAssignmentsResult,
  ] = await Promise.all([
    supabase
      .from("business_settings")
      .select("buffer_time_mins")
      .eq("id", 1)
      .single<{ buffer_time_mins: number }>(),
    supabase
      .from("role_permissions")
      .select("role_id, permissions(name)")
      .in("role_id", roleIds),
    supabase
      .from("staff_permission_overrides")
      .select("staff_id, is_granted, permissions(name)")
      .in("staff_id", staffIds),
    supabase
      .from("blocked_dates")
      .select("id")
      .eq("blocked_date", booking.booking_date),
    supabase
      .from("availability_overrides")
      .select("start_time, end_time, override_type")
      .eq("override_date", booking.booking_date)
      .maybeSingle<{ start_time: string; end_time: string; override_type: string | null }>(),
    supabase
      .from("availability_rules")
      .select("day_of_week, start_time, end_time, is_working_day")
      .eq("day_of_week", dayOfWeek)
      .eq("is_working_day", true),
    supabase
      .from("staff_blocked_dates")
      .select("staff_id")
      .eq("blocked_date", booking.booking_date)
      .in("staff_id", staffIds),
    supabase
      .from("staff_availability_overrides")
      .select("staff_id, start_time, end_time, override_type")
      .eq("override_date", booking.booking_date)
      .in("staff_id", staffIds),
    supabase
      .from("staff_availability_rules")
      .select("staff_id, day_of_week, start_time, end_time, is_working_day")
      .eq("day_of_week", dayOfWeek)
      .eq("is_working_day", true)
      .in("staff_id", staffIds),
    supabase
      .from("booking_assignments")
      .select("assigned_staff_id, bookings!inner(id, booking_date, start_time, end_time, status)")
      .not("assigned_staff_id", "is", null)
      .in("status", ["assigned"])
      .eq("bookings.booking_date", booking.booking_date)
      .in("bookings.status", ["pending", "confirmed"]),
  ]);

  const bookingStart = timeToMinutes(booking.start_time);
  const bookingEnd = timeToMinutes(booking.end_time);
  const bufferMins = settingsResult.data?.buffer_time_mins ?? 0;
  const rolePermissions = rolePermissionsResult.data ?? [];
  const staffOverrides = staffOverridesResult.data ?? [];
  const globalBlocked = (globalBlockedResult.data ?? []).length > 0;
  const globalOverride = globalOverrideResult.data ?? undefined;
  const globalWindows = normalizeWindows(globalRulesResult.data ?? []);
  const blockedStaffIds = new Set(
    (staffBlockedResult.data ?? []).map((row) => row.staff_id as string)
  );
  const staffOverridesById = new Map(
    (staffOverrideResult.data ?? []).map((row) => [row.staff_id as string, row])
  );
  const staffRulesById = new Map<string, Array<{ start_time: string; end_time: string }>>();
  for (const rule of staffRulesResult.data ?? []) {
    const staffId = rule.staff_id as string;
    staffRulesById.set(staffId, [...(staffRulesById.get(staffId) ?? []), rule]);
  }

  const busyByStaffId = new Map<string, TimeWindow[]>();
  for (const row of busyAssignmentsResult.data ?? []) {
    const staffId = row.assigned_staff_id as string | null;
    const busyBooking = row.bookings as unknown as {
      id: string;
      start_time: string;
      end_time: string;
    };
    if (!staffId || busyBooking.id === booking.id) continue;

    busyByStaffId.set(staffId, [
      ...(busyByStaffId.get(staffId) ?? []),
      {
        start: timeToMinutes(busyBooking.start_time),
        end: timeToMinutes(busyBooking.end_time),
      },
    ]);
  }

  return candidates.map((candidate) => {
    if (!candidate.active) {
      return { staff: candidate, eligible: false, reason: "Inactive staff" };
    }
    if (candidate.gender !== requiredGender) {
      return { staff: candidate, eligible: false, reason: "Wrong therapist gender" };
    }
    if (!candidate.can_take_bookings) {
      return { staff: candidate, eligible: false, reason: "Bookings disabled" };
    }
    if (!hasBookingEligibilityPermission(candidate, rolePermissions, staffOverrides)) {
      return { staff: candidate, eligible: false, reason: "Missing booking eligibility permission" };
    }
    if (globalBlocked || blockedStaffIds.has(candidate.id)) {
      return { staff: candidate, eligible: false, reason: "Blocked date" };
    }

    const staffOverride = staffOverridesById.get(candidate.id);
    if (isBlockingOverride(staffOverride)) {
      return { staff: candidate, eligible: false, reason: "Staff unavailable" };
    }

    const windows =
      staffOverride && staffOverride.start_time && staffOverride.end_time
        ? normalizeWindows([staffOverride])
        : candidate.availability_mode === "custom"
          ? normalizeWindows(staffRulesById.get(candidate.id) ?? [])
          : globalOverride && globalOverride.start_time && globalOverride.end_time
            ? normalizeWindows([globalOverride])
            : globalWindows;

    if (!containsWindow(windows, bookingStart, bookingEnd)) {
      return { staff: candidate, eligible: false, reason: "Out of availability" };
    }

    const busy = busyByStaffId.get(candidate.id) ?? [];
    if (
      busy.some((window) =>
        overlaps(bookingStart, bookingEnd, window.start, window.end, bufferMins)
      )
    ) {
      return { staff: candidate, eligible: false, reason: "Busy at this time" };
    }

    return { staff: candidate, eligible: true, reason: "Eligible" };
  });
}
