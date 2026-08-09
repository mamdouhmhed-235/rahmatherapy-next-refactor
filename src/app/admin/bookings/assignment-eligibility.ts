import type { SupabaseClient } from "@supabase/supabase-js";
import { canClaimAssignments, type StaffProfile } from "@/lib/auth/rbac";
import { getBusinessDayOfWeek } from "@/lib/time/london";
import type { BookingAssignment } from "./types";

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

export interface ClaimAssignmentEligibility {
  eligible: boolean;
  reason: string;
}

interface TimeWindow {
  start: number;
  end: number;
}

/**
 * C-14 Phase C Step 13a — one bookable window on a specific date.
 * `availability_overrides` (global) has no `override_type` column (confirmed
 * live: id, override_date, start_time, end_time, reason) — a global date
 * can't express "blocking" through this table; `blocked_dates` does that.
 * `override_type` is real only on `staff_availability_overrides`, so it
 * lives on `StaffDateOverrideRow`, not here.
 */
interface DateOverrideRow {
  start_time: string | null;
  end_time: string | null;
}

interface StaffDateOverrideRow extends DateOverrideRow {
  staff_id: string;
  override_type: string | null;
}

const BOOKING_ELIGIBILITY_PERMISSIONS = new Set(["claim_assignments"]);

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

// Only ever called with staff rows below — global overrides have no
// `override_type` to check (see `DateOverrideRow` above), so this can't be
// meaningful for them.
function isBlockingOverride(override: StaffDateOverrideRow | undefined) {
  return ["blocked", "closed", "off", "unavailable"].includes(
    override?.override_type?.toLowerCase() ?? ""
  );
}

/**
 * C-14 Phase C Step 13a — every row on a date becomes a window, so the gaps
 * between them are breaks. Rows without both times are skipped rather than
 * parsed: `timeToMinutes` here splits the string unguarded, and the old
 * single-row code guarded the same way (`override.start_time && …`).
 */
function overrideWindows(rows: DateOverrideRow[]) {
  return normalizeWindows(
    rows.flatMap((row) =>
      row.start_time && row.end_time
        ? [{ start_time: row.start_time, end_time: row.end_time }]
        : []
    )
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
    // C-14 Phase C Step 13a — an override date can now hold SEVERAL rows (the
    // gap between two of them is a break), so this can no longer be
    // maybeSingle(): PostgREST answers a multi-row match with an error, and
    // nothing here inspects `.error`, so the override would silently vanish and
    // eligibility would be computed from the weekly rules instead.
    //
    // `override_type` is dropped from this select: `availability_overrides`
    // has no such column, so naming it here answered every call with that
    // exact same silent-failure shape (PostgREST 42703, unread `.error`,
    // override falls through to the weekly rules). Mirrors the live slot
    // engine, which selects only `override_date, start_time, end_time` from
    // this table (`src/lib/booking/availability.ts`).
    supabase
      .from("availability_overrides")
      .select("start_time, end_time")
      .eq("override_date", booking.booking_date)
      .returns<DateOverrideRow[]>(),
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
      .in("staff_id", staffIds)
      .returns<StaffDateOverrideRow[]>(),
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
  const globalOverrideWindows = overrideWindows(globalOverrideResult.data ?? []);
  const globalWindows = normalizeWindows(globalRulesResult.data ?? []);
  const blockedStaffIds = new Set(
    (staffBlockedResult.data ?? []).map((row) => row.staff_id as string)
  );
  // Every row for a staff+date, not the last one the Map constructor happened
  // to keep (C-14 Phase C Step 13a).
  const staffOverridesById = new Map<string, StaffDateOverrideRow[]>();
  for (const row of staffOverrideResult.data ?? []) {
    staffOverridesById.set(row.staff_id, [
      ...(staffOverridesById.get(row.staff_id) ?? []),
      row,
    ]);
  }
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

    // Any blocking row closes the date for this candidate — the same reading
    // the slot engine takes (`resolveStaffWindows`), and the one that cannot
    // over-offer when a date carries both a closure and some hours.
    // (`staffOverrides` above is the PERMISSION overrides — different table.)
    const staffDateOverrides = staffOverridesById.get(candidate.id) ?? [];
    if (staffDateOverrides.some((override) => isBlockingOverride(override))) {
      return { staff: candidate, eligible: false, reason: "Staff unavailable" };
    }

    const staffOverrideWindows = overrideWindows(staffDateOverrides);
    const windows =
      staffOverrideWindows.length > 0
        ? staffOverrideWindows
        : candidate.availability_mode === "custom"
          ? normalizeWindows(staffRulesById.get(candidate.id) ?? [])
          : globalOverrideWindows.length > 0
            ? globalOverrideWindows
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

export function evaluateClaimAssignmentEligibility({
  actor,
  assignment,
  candidate,
}: {
  actor: StaffProfile;
  assignment: Pick<
    BookingAssignment,
    "assigned_staff_id" | "required_therapist_gender" | "status"
  >;
  candidate: StaffAssignmentPreview | undefined;
}): ClaimAssignmentEligibility {
  if (!canClaimAssignments(actor)) {
    return { eligible: false, reason: "Insufficient permissions." };
  }
  if (assignment.status !== "unassigned" || assignment.assigned_staff_id) {
    return { eligible: false, reason: "This assignment has already been claimed." };
  }
  if (assignment.required_therapist_gender !== actor.gender) {
    return {
      eligible: false,
      reason: "You cannot claim an assignment for another therapist gender.",
    };
  }
  if (!candidate || candidate.staff.id !== actor.id) {
    return { eligible: false, reason: "You are not eligible for this assignment." };
  }
  if (!candidate.eligible) {
    return { eligible: false, reason: candidate.reason };
  }

  return { eligible: true, reason: "Eligible" };
}

export async function getClaimAssignmentEligibility({
  actor,
  assignment,
  booking,
  supabase,
}: {
  actor: StaffProfile;
  assignment: Pick<
    BookingAssignment,
    "assigned_staff_id" | "required_therapist_gender" | "status"
  >;
  booking: AssignmentEligibilityBooking;
  supabase: SupabaseClient;
}): Promise<ClaimAssignmentEligibility> {
  if (!canClaimAssignments(actor)) {
    return { eligible: false, reason: "Insufficient permissions." };
  }

  const previews = await getStaffAssignmentPreviews({
    booking,
    requiredGender: assignment.required_therapist_gender,
    supabase,
  });

  return evaluateClaimAssignmentEligibility({
    actor,
    assignment,
    candidate: previews.find((preview) => preview.staff.id === actor.id),
  });
}
