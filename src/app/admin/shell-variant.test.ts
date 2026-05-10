import { describe, expect, it } from "vitest";
import { resolveAdminShellVariant } from "./shell-variant";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";

function makeProfile(
  perms: string[],
  overrides: Partial<StaffProfile> = {}
): StaffProfile {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    auth_user_id: "00000000-0000-0000-0000-000000000002",
    name: "Test User",
    email: "test@example.test",
    role_id: "00000000-0000-0000-0000-000000000003",
    role_name: "Test",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set(perms),
    ...overrides,
  };
}

describe("resolveAdminShellVariant", () => {
  it("returns null for null profile", () => {
    expect(resolveAdminShellVariant(null)).toBeNull();
  });

  it("returns null for inactive staff", () => {
    expect(
      resolveAdminShellVariant(
        makeProfile([PERMISSIONS.VIEW_REPORTS_REVENUE], { active: false })
      )
    ).toBeNull();
  });

  it("classifies owner-admin via revenue access", () => {
    expect(
      resolveAdminShellVariant(
        makeProfile([
          PERMISSIONS.VIEW_REPORTS_REVENUE,
          PERMISSIONS.MANAGE_BOOKINGS_ALL,
        ])
      )
    ).toBe("owner_admin");
  });

  it("classifies coordinator via manage_bookings_all without revenue", () => {
    expect(
      resolveAdminShellVariant(
        makeProfile([PERMISSIONS.MANAGE_BOOKINGS_ALL])
      )
    ).toBe("coordinator");
  });

  it("classifies coordinator via manage_enquiries without revenue", () => {
    expect(
      resolveAdminShellVariant(makeProfile([PERMISSIONS.MANAGE_ENQUIRIES]))
    ).toBe("coordinator");
  });

  it("classifies therapist via view_bookings_assigned only", () => {
    expect(
      resolveAdminShellVariant(
        makeProfile([
          PERMISSIONS.VIEW_BOOKINGS_ASSIGNED,
          PERMISSIONS.CLAIM_ASSIGNMENTS,
        ])
      )
    ).toBe("therapist");
  });

  it("returns null for an active staff with no relevant permissions", () => {
    expect(resolveAdminShellVariant(makeProfile([]))).toBeNull();
  });
});
