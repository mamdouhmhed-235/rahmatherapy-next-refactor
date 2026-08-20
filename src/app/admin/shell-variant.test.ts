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

// ⛔ GATE 07 CASE 5 — SHELL VARIANT FOR THE FIVE REAL ROLES.
//
// The cases above prove the classifier's logic against hand-made permission
// sets. They do NOT prove that the roles the business actually uses land on the
// right shell — every one of them could be correct while Owner still resolved to
// "therapist". These drive the classifier from the measured live grants in
// src/lib/auth/role-grants.json, the same fixture the bundle matrix and
// scripts/verify-rbac-grants.mjs use.
//
// Why the shell matters for authorization: a null variant is not a cosmetic
// fallback. admin/layout.tsx redirects to /admin/login?reason=inactive rather
// than defaulting to the owner shell, so that somebody with no usable capability
// is never shown a full nav they cannot act on.

import { readFileSync } from "node:fs";
import roleGrantsFixture from "@/lib/auth/role-grants.json";

const ROLE_GRANTS = (
  roleGrantsFixture as { roles: Record<string, { grants: string[] }> }
).roles;

function profileForRole(
  role: string,
  overrides: Partial<StaffProfile> = {}
): StaffProfile {
  const entry = ROLE_GRANTS[role];
  if (!entry) throw new Error(`role "${role}" missing from role-grants.json`);
  return makeProfile(entry.grants, { role_name: role, ...overrides });
}

describe("shell variant for the five live roles", () => {
  const EXPECTED: ReadonlyArray<readonly [string, string | null, string]> = [
    ["Owner", "owner_admin", "holds view_reports_revenue"],
    ["Admin", "owner_admin", "holds view_reports_revenue"],
    [
      "Booking Coordinator",
      "coordinator",
      "holds manage_bookings_all but no revenue access",
    ],
    [
      "Therapist",
      "therapist",
      "assignment-scoped only: no revenue, no all-bookings, no enquiries",
    ],
    ["Inactive", null, "holds nothing at all"],
  ];

  it.each(EXPECTED)("%s resolves to %s — %s", (role, expected) => {
    expect(resolveAdminShellVariant(profileForRole(role))).toBe(expected);
  });

  it("covers all five roles in the fixture", () => {
    // ⛔ Guards the guard: a sixth role added to the database and the fixture
    // would otherwise get no shell test at all.
    expect(EXPECTED.length, "roles covered").toBe(5);
    expect(Object.keys(ROLE_GRANTS).sort()).toEqual(
      EXPECTED.map(([role]) => role).sort()
    );
  });

  it("deactivating any role removes its shell entirely", () => {
    for (const [role] of EXPECTED) {
      expect(
        resolveAdminShellVariant(profileForRole(role, { active: false })),
        `${role} while deactivated`
      ).toBeNull();
    }
  });

  it("the Therapist shell is not an accident of missing revenue alone", () => {
    // Non-vacuity: grant the therapist revenue access and they move to the
    // owner/admin shell, so "therapist" above is a real classification rather
    // than the classifier falling through to its last branch.
    const therapist = profileForRole("Therapist");
    const promoted = makeProfile([
      ...therapist.permissions,
      PERMISSIONS.VIEW_REPORTS_REVENUE,
    ]);
    expect(resolveAdminShellVariant(promoted)).toBe("owner_admin");
  });
});

describe("a null shell variant is a refusal, not a fallback", () => {
  it("admin/layout.tsx redirects instead of defaulting to the owner shell", () => {
    // ⚠️ Structural, and stated as such: this reads the layout's source because
    // the layout is a server component that cannot be rendered in this
    // environment. It is a guard against the null branch quietly becoming a
    // default, which would show a full nav to someone with no capabilities.
    const layout = readFileSync("src/app/admin/layout.tsx", "utf8");

    expect(layout).toContain("const resolvedVariant = resolveAdminShellVariant(profile);");
    expect(layout).toContain('redirect("/admin/login?reason=inactive");');

    const afterResolve = layout.slice(
      layout.indexOf("const resolvedVariant = resolveAdminShellVariant(profile);")
    );
    const redirectAt = afterResolve.indexOf('redirect("/admin/login?reason=inactive");');
    const guardAt = afterResolve.indexOf("if (!resolvedVariant)");

    expect(guardAt, "the null-variant guard exists").toBeGreaterThan(-1);
    expect(redirectAt, "and the redirect is inside it").toBeGreaterThan(guardAt);

    // ⛔ No silent fallback to a shell the user has not earned.
    expect(afterResolve).not.toContain('?? "owner_admin"');
    expect(afterResolve).not.toContain("|| \"owner_admin\"");
  });
});
