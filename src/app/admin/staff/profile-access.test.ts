import { describe, expect, it } from "vitest";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { sanitizeStaffProfileUpdate } from "./profile-access";

function profile(
  permissions: string[] = [],
  overrides: Partial<StaffProfile> = {}
): StaffProfile {
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
    permissions: new Set(permissions),
    ...overrides,
  };
}

describe("staff profile update access", () => {
  it("allows active staff to update only their own safe profile fields", () => {
    const result = sanitizeStaffProfileUpdate({
      actor: profile([], { id: "staff-a" }),
      staffId: "staff-a",
      updates: {
        phone: "  07700 900123  ",
        show_phone_on_profile: true,
        short_bio: "  Mobile hijama and massage therapist.  ",
        specialties: "Hijama, Sports massage",
        languages: "English, Arabic",
        service_areas: "Luton, Dunstable",
      },
    });

    expect(result).toEqual({
      updates: {
        phone: "07700 900123",
        show_phone_on_profile: true,
        short_bio: "Mobile hijama and massage therapist.",
        specialties: ["Hijama", "Sports massage"],
        languages: ["English", "Arabic"],
        service_areas: ["Luton", "Dunstable"],
      },
    });
  });

  it("rejects own-profile attempts to change operational fields without staff management permission", () => {
    const result = sanitizeStaffProfileUpdate({
      actor: profile([], { id: "staff-a" }),
      staffId: "staff-a",
      updates: {
        can_take_bookings: false,
        role_id: "role-owner",
      },
    });

    expect(result).toEqual({ error: "Insufficient permissions." });
  });

  it("allows staff managers to edit operational fields but keeps roles separately permissioned", () => {
    const manager = profile([PERMISSIONS.MANAGE_STAFF_PROFILES], {
      id: "manager",
    });

    expect(
      sanitizeStaffProfileUpdate({
        actor: manager,
        staffId: "staff-a",
        updates: { active: false, can_take_bookings: true, gender: "male" },
      })
    ).toEqual({
      updates: { active: false, can_take_bookings: true, gender: "male" },
    });

    expect(
      sanitizeStaffProfileUpdate({
        actor: manager,
        staffId: "staff-a",
        updates: { role_id: "role-admin" },
      })
    ).toEqual({ error: "Insufficient permissions." });
  });

  it("allows role changes only with assign-staff-role permission", () => {
    const roleManager = profile(
      [PERMISSIONS.MANAGE_STAFF_PROFILES, PERMISSIONS.ASSIGN_STAFF_ROLES],
      { id: "manager" }
    );

    expect(
      sanitizeStaffProfileUpdate({
        actor: roleManager,
        staffId: "staff-a",
        updates: { role_id: "role-admin" },
      })
    ).toEqual({ updates: { role_id: "role-admin" } });
  });

  it("denies inactive actors and unrelated safe-profile edits without management permission", () => {
    expect(
      sanitizeStaffProfileUpdate({
        actor: profile([], { active: false }),
        staffId: "staff-a",
        updates: { short_bio: "Updated bio" },
      })
    ).toEqual({ error: "Insufficient permissions." });

    expect(
      sanitizeStaffProfileUpdate({
        actor: profile([], { id: "staff-b" }),
        staffId: "staff-a",
        updates: { short_bio: "Updated bio" },
      })
    ).toEqual({ error: "Insufficient permissions." });
  });
});
