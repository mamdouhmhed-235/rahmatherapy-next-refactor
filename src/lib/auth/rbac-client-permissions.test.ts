import { describe, expect, it } from "vitest";
import {
  canManageClientDestructiveOps,
  canManageClientIdentityFields,
  PERMISSIONS,
  type StaffProfile,
} from "./rbac";

function profile(
  permissions: string[],
  overrides: Partial<StaffProfile> = {}
): StaffProfile {
  return {
    id: "staff-a",
    auth_user_id: "auth-a",
    name: "Staff A",
    email: "staff-a@example.test",
    role_id: "role-a",
    role_name: "Admin / Practice Manager",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set(permissions),
    ...overrides,
  };
}

describe("client identity and destructive-op permissions", () => {
  it("denies both helpers without a staff profile", () => {
    expect(canManageClientIdentityFields(null)).toBe(false);
    expect(canManageClientDestructiveOps(null)).toBe(false);
  });

  it("denies both helpers for an inactive profile that holds the permission", () => {
    const inactive = profile(
      [
        PERMISSIONS.MANAGE_CLIENT_IDENTITY_FIELDS,
        PERMISSIONS.MANAGE_CLIENT_DESTRUCTIVE_OPS,
      ],
      { active: false }
    );

    expect(canManageClientIdentityFields(inactive)).toBe(false);
    expect(canManageClientDestructiveOps(inactive)).toBe(false);
  });

  it("denies both helpers when the permission is missing", () => {
    const coordinator = profile([
      PERMISSIONS.MANAGE_CLIENTS_ALL,
      PERMISSIONS.MANAGE_BOOKINGS_ALL,
    ]);

    expect(canManageClientIdentityFields(coordinator)).toBe(false);
    expect(canManageClientDestructiveOps(coordinator)).toBe(false);
  });

  it("grants each helper only on its own permission", () => {
    const identityOnly = profile([PERMISSIONS.MANAGE_CLIENT_IDENTITY_FIELDS]);
    const destructiveOnly = profile([
      PERMISSIONS.MANAGE_CLIENT_DESTRUCTIVE_OPS,
    ]);

    expect(canManageClientIdentityFields(identityOnly)).toBe(true);
    expect(canManageClientDestructiveOps(identityOnly)).toBe(false);
    expect(canManageClientDestructiveOps(destructiveOnly)).toBe(true);
    expect(canManageClientIdentityFields(destructiveOnly)).toBe(false);
  });

  it("keeps the permission names aligned with the seeded DB values", () => {
    expect(PERMISSIONS.MANAGE_CLIENT_IDENTITY_FIELDS).toBe(
      "manage_client_identity_fields"
    );
    expect(PERMISSIONS.MANAGE_CLIENT_DESTRUCTIVE_OPS).toBe(
      "manage_client_destructive_ops"
    );
  });
});
