import { describe, expect, test } from "vitest";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import {
  canViewStaffProfile,
  getStaffTeamAccess,
  getStaffTeamSelect,
} from "./team-access";

function profile(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    id: "actor",
    auth_user_id: "auth-actor",
    name: "Actor",
    email: "actor@example.test",
    role_id: "role",
    role_name: "Role",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set<string>(),
    ...overrides,
  };
}

function staffRow(overrides: {
  id?: string;
  active?: boolean;
  can_take_bookings?: boolean;
  gender?: string;
} = {}) {
  return {
    id: "target",
    active: true,
    can_take_bookings: true,
    gender: "female",
    ...overrides,
  };
}

describe("team access", () => {
  test("owner and admin-style staff see the full management directory", () => {
    const actor = profile({
      permissions: new Set([
        PERMISSIONS.VIEW_STAFF,
        PERMISSIONS.MANAGE_STAFF_PROFILES,
        PERMISSIONS.ASSIGN_STAFF_ROLES,
        PERMISSIONS.MANAGE_PERMISSION_OVERRIDES,
      ]),
    });

    const access = getStaffTeamAccess(actor);

    expect(access.scope).toBe("admin");
    expect(access.canViewAdminFields).toBe(true);
    expect(access.canViewContactFields).toBe(true);
    expect(access.canViewRoleControls).toBe(true);
    expect(access.canViewPermissionControls).toBe(true);
    expect(canViewStaffProfile(actor, staffRow({ active: false }))).toBe(true);
    expect(getStaffTeamSelect(access)).toContain("email");
    expect(getStaffTeamSelect(access)).toContain("role_id");
  });

  test("booking coordinators see only active bookable staff without private admin fields", () => {
    const actor = profile({
      permissions: new Set([
        PERMISSIONS.ASSIGN_BOOKINGS,
        PERMISSIONS.VIEW_BOOKINGS_ALL,
      ]),
    });

    const access = getStaffTeamAccess(actor);

    expect(access.scope).toBe("assignment");
    expect(access.canViewAdminFields).toBe(false);
    expect(access.canViewContactFields).toBe(false);
    expect(access.canViewWorkloadSummary).toBe(true);
    expect(canViewStaffProfile(actor, staffRow())).toBe(true);
    expect(canViewStaffProfile(actor, staffRow({ active: false }))).toBe(false);
    expect(canViewStaffProfile(actor, staffRow({ can_take_bookings: false }))).toBe(false);
    expect(getStaffTeamSelect(access)).not.toContain("email");
    expect(getStaffTeamSelect(access)).not.toContain("phone");
  });

  test("therapists see same-gender active bookable team members and their own profile", () => {
    const actor = profile({
      id: "therapist",
      gender: "female",
      permissions: new Set([
        PERMISSIONS.CLAIM_ASSIGNMENTS,
        PERMISSIONS.VIEW_BOOKINGS_ASSIGNED,
      ]),
    });

    const access = getStaffTeamAccess(actor);

    expect(access.scope).toBe("same_gender_team");
    expect(access.canViewAdminFields).toBe(false);
    expect(access.canViewContactFields).toBe(false);
    expect(canViewStaffProfile(actor, staffRow({ id: "therapist", active: false }))).toBe(true);
    expect(canViewStaffProfile(actor, staffRow({ gender: "female" }))).toBe(true);
    expect(canViewStaffProfile(actor, staffRow({ gender: "male" }))).toBe(false);
    expect(canViewStaffProfile(actor, staffRow({ can_take_bookings: false }))).toBe(false);
  });

  test("inactive or missing staff have no team visibility", () => {
    expect(getStaffTeamAccess(null).scope).toBe("none");
    expect(getStaffTeamAccess(profile({ active: false })).scope).toBe("none");
    expect(canViewStaffProfile(null, staffRow())).toBe(false);
  });
});
