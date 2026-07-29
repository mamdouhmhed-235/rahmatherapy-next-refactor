import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import type { BookingRecord } from "./types";
import {
  canClaimAssignments,
  canOpenBookingRecord,
  canManageAllBookings,
  hasClaimableAssignment,
  isOwnBooking,
} from "./access";

// Pinned to match the `booking()` fixture's hardcoded `booking_date` below, so
// C-05's past-date guard in `hasClaimableAssignment` reads that fixture as
// "today" rather than drifting into the past as real wall-clock time advances.
const NOW = new Date("2026-06-01T10:00:00.000Z");

function profile(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    id: "staff-a",
    auth_user_id: "auth-a",
    name: "Staff A",
    email: "staff-a@example.test",
    role_id: "role-a",
    role_name: "Therapist",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set([PERMISSIONS.CLAIM_ASSIGNMENTS]),
    ...overrides,
  };
}

function booking(
  assignments: BookingRecord["booking_assignments"],
  overrides: Partial<BookingRecord> = {}
): BookingRecord {
  return {
    id: "booking-a",
    booking_date: "2026-06-01",
    start_time: "10:00",
    end_time: "11:00",
    booking_assignments: assignments,
    ...overrides,
  } as BookingRecord;
}

describe("admin booking access helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows only active booking-capable staff with claim permissions to claim", () => {
    expect(canClaimAssignments(profile())).toBe(true);
    expect(canClaimAssignments(profile({ active: false }))).toBe(false);
    expect(canClaimAssignments(profile({ can_take_bookings: false }))).toBe(false);
    expect(canClaimAssignments(profile({ permissions: new Set() }))).toBe(false);
  });

  it("shows unassigned matching-gender work as claimable", () => {
    const record = booking([
      {
        id: "assignment-a",
        participant_id: "participant-a",
        assigned_staff_id: null,
        required_therapist_gender: "female",
        status: "unassigned",
        staff_profiles: null,
      },
    ]);

    expect(hasClaimableAssignment(record, profile())).toBe(true);
    expect(hasClaimableAssignment(record, profile({ gender: "male" }))).toBe(false);
  });

  it("hides already-claimed or closed assignments from claimable queues", () => {
    expect(
      hasClaimableAssignment(
        booking([
          {
            id: "assignment-a",
            participant_id: "participant-a",
            assigned_staff_id: "staff-a",
            required_therapist_gender: "female",
            status: "assigned",
            staff_profiles: { name: "Staff A" },
          },
        ]),
        profile()
      )
    ).toBe(false);

    expect(
      hasClaimableAssignment(
        booking([
          {
            id: "assignment-a",
            participant_id: "participant-a",
            assigned_staff_id: null,
            required_therapist_gender: "female",
            status: "completed",
            staff_profiles: null,
          },
        ]),
        profile()
      )
    ).toBe(false);
  });

  it("keeps owner/super-admin all-booking access separate from therapist claim access", () => {
    expect(
      canManageAllBookings(
        profile({ permissions: new Set([PERMISSIONS.MANAGE_BOOKINGS_ALL]) })
      )
    ).toBe(true);

    expect(isOwnBooking(booking([]), profile())).toBe(false);
    expect(
      isOwnBooking(
        booking([
          {
            id: "assignment-a",
            participant_id: "participant-a",
            assigned_staff_id: "staff-a",
            required_therapist_gender: "female",
            status: "assigned",
            staff_profiles: { name: "Staff A" },
          },
        ]),
        profile()
      )
    ).toBe(true);
  });

  it("opens booking detail only for all-booking, own, or claimable records", () => {
    const unrelated = booking([]);
    const own = booking([
      {
        id: "assignment-a",
        participant_id: "participant-a",
        assigned_staff_id: "staff-a",
        required_therapist_gender: "female",
        status: "assigned",
        staff_profiles: { name: "Staff A" },
      },
    ]);
    const claimable = booking([
      {
        id: "assignment-b",
        participant_id: "participant-b",
        assigned_staff_id: null,
        required_therapist_gender: "female",
        status: "unassigned",
        staff_profiles: null,
      },
    ]);

    expect(canOpenBookingRecord(unrelated, profile())).toBe(false);
    expect(canOpenBookingRecord(own, profile())).toBe(true);
    expect(canOpenBookingRecord(claimable, profile())).toBe(true);
    expect(
      canOpenBookingRecord(
        unrelated,
        profile({ permissions: new Set([PERMISSIONS.VIEW_BOOKINGS_ALL]) })
      )
    ).toBe(true);
  });

  it("locks claiming down for cancelled, no_show, and past-dated bookings (C-05)", () => {
    const unassignedSlot: BookingRecord["booking_assignments"] = [
      {
        id: "assignment-a",
        participant_id: "participant-a",
        assigned_staff_id: null,
        required_therapist_gender: "female",
        status: "unassigned",
        staff_profiles: null,
      },
    ];

    // Active booking + unassigned slot + matching gender -> true
    expect(
      hasClaimableAssignment(booking(unassignedSlot, { status: "confirmed" }), profile())
    ).toBe(true);

    // Cancelled booking + matching slot -> false
    expect(
      hasClaimableAssignment(booking(unassignedSlot, { status: "cancelled" }), profile())
    ).toBe(false);

    // No_show booking + matching slot -> false
    expect(
      hasClaimableAssignment(booking(unassignedSlot, { status: "no_show" }), profile())
    ).toBe(false);

    // Past-dated booking + matching slot -> false
    expect(
      hasClaimableAssignment(
        booking(unassignedSlot, { status: "confirmed", booking_date: "2026-05-31" }),
        profile()
      )
    ).toBe(false);

    // Active booking + unassigned slot + non-matching gender -> false (existing case,
    // already covered above by "shows unassigned matching-gender work as claimable").
  });
});
