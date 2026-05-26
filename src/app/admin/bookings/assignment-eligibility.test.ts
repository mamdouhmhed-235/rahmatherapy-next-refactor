import { describe, expect, it } from "vitest";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import {
  evaluateClaimAssignmentEligibility,
  type StaffAssignmentPreview,
} from "./assignment-eligibility";
import type { BookingAssignment } from "./types";

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

function assignment(
  overrides: Partial<BookingAssignment> = {}
): BookingAssignment {
  return {
    id: "assignment-a",
    participant_id: "participant-a",
    assigned_staff_id: null,
    required_therapist_gender: "female",
    status: "unassigned",
    staff_profiles: null,
    ...overrides,
  };
}

function preview(
  actor: StaffProfile,
  overrides: Partial<StaffAssignmentPreview> = {}
): StaffAssignmentPreview {
  return {
    staff: {
      id: actor.id,
      name: actor.name,
      email: actor.email,
      active: actor.active,
      can_take_bookings: actor.can_take_bookings,
      gender: actor.gender as "male" | "female",
      role_id: actor.role_id,
      availability_mode: actor.availability_mode as "use_global",
    },
    eligible: true,
    reason: "Eligible",
    ...overrides,
  };
}

describe("evaluateClaimAssignmentEligibility", () => {
  it("allows an active booking-capable matching staff member with claim permission and eligible schedule", () => {
    const actor = profile();

    expect(
      evaluateClaimAssignmentEligibility({
        actor,
        assignment: assignment(),
        candidate: preview(actor),
      })
    ).toEqual({ eligible: true, reason: "Eligible" });
  });

  it("rejects wrong gender, inactive state, disabled booking capacity, and missing permission", () => {
    const actor = profile();

    expect(
      evaluateClaimAssignmentEligibility({
        actor: profile({ gender: "male" }),
        assignment: assignment(),
        candidate: preview(actor),
      }).reason
    ).toBe("You cannot claim an assignment for another therapist gender.");
    expect(
      evaluateClaimAssignmentEligibility({
        actor: profile({ active: false }),
        assignment: assignment(),
        candidate: preview(actor),
      }).reason
    ).toBe("Insufficient permissions.");
    expect(
      evaluateClaimAssignmentEligibility({
        actor: profile({ can_take_bookings: false }),
        assignment: assignment(),
        candidate: preview(actor),
      }).reason
    ).toBe("Insufficient permissions.");
    expect(
      evaluateClaimAssignmentEligibility({
        actor: profile({ permissions: new Set() }),
        assignment: assignment(),
        candidate: preview(actor),
      }).reason
    ).toBe("Insufficient permissions.");
  });

  it("rejects schedule ineligibility from availability and conflict checks", () => {
    const actor = profile();

    expect(
      evaluateClaimAssignmentEligibility({
        actor,
        assignment: assignment(),
        candidate: preview(actor, { eligible: false, reason: "Out of availability" }),
      }).reason
    ).toBe("Out of availability");
    expect(
      evaluateClaimAssignmentEligibility({
        actor,
        assignment: assignment(),
        candidate: preview(actor, { eligible: false, reason: "Busy at this time" }),
      }).reason
    ).toBe("Busy at this time");
  });
});
