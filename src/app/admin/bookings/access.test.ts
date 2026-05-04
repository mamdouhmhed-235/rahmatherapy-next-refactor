import { describe, expect, it } from "vitest";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import type { BookingRecord } from "./types";
import {
  canClaimAssignments,
  canManageAllBookings,
  hasClaimableAssignment,
  isOwnBooking,
} from "./access";

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

function booking(assignments: BookingRecord["booking_assignments"]): BookingRecord {
  return {
    id: "booking-a",
    booking_date: "2026-06-01",
    start_time: "10:00",
    end_time: "11:00",
    booking_assignments: assignments,
  } as BookingRecord;
}

describe("admin booking access helpers", () => {
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
});
