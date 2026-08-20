// ⛔ GATE 07 CASE 4 — PERMISSION RESOLUTION PRECEDENCE.
//
// A staff member's capabilities are not just their role. `resolvePermissions`
// (rbac.ts) starts from the role's grants and then applies per-person overrides
// from `staff_permission_overrides`, which can both ADD a permission the role
// does not have and REMOVE one it does.
//
// That makes overrides the one supported way a real person can end up with a
// capability their role was never given — which is exactly why the rest of gate
// 07 cannot reason from roles alone, and why FIND-07-B (searchClients ignoring
// view_client_contact_details) is reachable at all despite no role today
// exposing it.
//
// `resolvePermissions` is module-private, so these drive the real public entry
// point, `getStaffProfile`, against a hand-written fake Supabase client. That is
// deliberate: it tests the path the application actually takes, including the
// two queries and their filters, rather than a helper lifted out of context.

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStaffProfile, PERMISSIONS } from "./rbac";

// ─── a fake Supabase client, recording what it was asked ─────────────────────

type OverrideRow = { permissions: { name: string }; is_granted: boolean };

type Recorded = { table: string; filters: Array<[string, unknown]> };

function createFakeSupabase(options: {
  user?: { id: string } | null;
  profileRow?: Record<string, unknown> | null;
  rolePermissions?: string[];
  overrides?: OverrideRow[];
}) {
  const {
    user = { id: "auth-user-1" },
    profileRow = {
      id: "staff-1",
      auth_user_id: "auth-user-1",
      name: "Test Staff",
      email: "staff@example.test",
      role_id: "role-1",
      gender: "female",
      active: true,
      can_take_bookings: true,
      availability_mode: "use_global",
      roles: { name: "Therapist", display_label: null },
    },
    rolePermissions = [],
    overrides = [],
  } = options;

  const recorded: Recorded[] = [];

  function builder(table: string) {
    const entry: Recorded = { table, filters: [] };
    recorded.push(entry);

    const rows =
      table === "role_permissions"
        ? rolePermissions.map((name) => ({ permissions: { name } }))
        : table === "staff_permission_overrides"
          ? overrides
          : [profileRow];

    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        entry.filters.push([column, value]);
        return chain;
      },
      single: async () => ({ data: profileRow, error: null }),
      // role_permissions and staff_permission_overrides are awaited directly
      // off .eq(), so the builder itself has to be thenable.
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: rows as unknown[], error: null }),
    };

    return chain;
  }

  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: (table: string) => builder(table),
  };

  return { client: client as unknown as SupabaseClient, recorded };
}

function overrideRow(name: string, isGranted: boolean): OverrideRow {
  return { permissions: { name }, is_granted: isGranted };
}

// ═════════════════════════════════════════════════════════════════════════════

describe("permission resolution: role grants, then per-person overrides", () => {
  it("1 — role grant only: the resolved set is the role's grants", async () => {
    const { client } = createFakeSupabase({
      rolePermissions: [
        PERMISSIONS.VIEW_BOOKINGS_ASSIGNED,
        PERMISSIONS.VIEW_CLIENT_HEALTH_NOTES_ASSIGNED,
      ],
      overrides: [],
    });

    const profile = await getStaffProfile(client);

    expect([...(profile?.permissions ?? [])].sort()).toEqual([
      PERMISSIONS.VIEW_BOOKINGS_ASSIGNED,
      PERMISSIONS.VIEW_CLIENT_HEALTH_NOTES_ASSIGNED,
    ].sort());
  });

  it("2 — a granting override ADDS a permission the role already has (no change)", async () => {
    const { client } = createFakeSupabase({
      rolePermissions: [PERMISSIONS.VIEW_BOOKINGS_ASSIGNED],
      overrides: [overrideRow(PERMISSIONS.VIEW_BOOKINGS_ASSIGNED, true)],
    });

    const profile = await getStaffProfile(client);

    expect([...(profile?.permissions ?? [])]).toEqual([PERMISSIONS.VIEW_BOOKINGS_ASSIGNED]);
    expect(profile?.permissions.size, "a redundant grant must not duplicate").toBe(1);
  });

  it("3 — a revoking override REMOVES a permission the role grants", async () => {
    // ⛔ The one that matters for containment: an Owner can take a capability
    // away from one person without touching the role everyone else shares.
    const { client } = createFakeSupabase({
      rolePermissions: [
        PERMISSIONS.VIEW_BOOKINGS_ASSIGNED,
        PERMISSIONS.VIEW_CLIENT_HEALTH_NOTES_ASSIGNED,
      ],
      overrides: [overrideRow(PERMISSIONS.VIEW_CLIENT_HEALTH_NOTES_ASSIGNED, false)],
    });

    const profile = await getStaffProfile(client);

    expect(profile?.permissions.has(PERMISSIONS.VIEW_CLIENT_HEALTH_NOTES_ASSIGNED)).toBe(
      false
    );
    expect(profile?.permissions.has(PERMISSIONS.VIEW_BOOKINGS_ASSIGNED)).toBe(true);
    expect(profile?.permissions.size).toBe(1);
  });

  it("4 — a granting override EXTENDS a person beyond their role", async () => {
    // ⛔ This is why role-level reasoning is not sufficient anywhere in gate 07.
    // A Booking Coordinator holds neither health-note permission, but one
    // override row is enough to give a single coordinator one of them.
    const { client } = createFakeSupabase({
      rolePermissions: [PERMISSIONS.VIEW_BOOKINGS_ALL],
      overrides: [overrideRow(PERMISSIONS.VIEW_CLIENT_HEALTH_NOTES_ASSIGNED, true)],
    });

    const profile = await getStaffProfile(client);

    expect(profile?.permissions.has(PERMISSIONS.VIEW_CLIENT_HEALTH_NOTES_ASSIGNED)).toBe(
      true
    );
    expect([...(profile?.permissions ?? [])].sort()).toEqual(
      [PERMISSIONS.VIEW_BOOKINGS_ALL, PERMISSIONS.VIEW_CLIENT_HEALTH_NOTES_ASSIGNED].sort()
    );
  });

  it("revoking a permission the role never granted is a no-op, not an error", async () => {
    const { client } = createFakeSupabase({
      rolePermissions: [PERMISSIONS.VIEW_BOOKINGS_ALL],
      overrides: [overrideRow(PERMISSIONS.MANAGE_ROLE_TEMPLATES, false)],
    });

    const profile = await getStaffProfile(client);

    expect([...(profile?.permissions ?? [])]).toEqual([PERMISSIONS.VIEW_BOOKINGS_ALL]);
  });

  it("applies several overrides in both directions at once", async () => {
    const { client } = createFakeSupabase({
      rolePermissions: [
        PERMISSIONS.VIEW_BOOKINGS_ALL,
        PERMISSIONS.VIEW_CLIENTS_ALL,
        PERMISSIONS.MANAGE_CLIENTS_ALL,
      ],
      overrides: [
        overrideRow(PERMISSIONS.MANAGE_CLIENTS_ALL, false),
        overrideRow(PERMISSIONS.MANAGE_ENQUIRIES, true),
        overrideRow(PERMISSIONS.VIEW_CLIENTS_ALL, false),
      ],
    });

    const profile = await getStaffProfile(client);

    expect([...(profile?.permissions ?? [])].sort()).toEqual(
      [PERMISSIONS.VIEW_BOOKINGS_ALL, PERMISSIONS.MANAGE_ENQUIRIES].sort()
    );
  });
});

describe("the override lookup is scoped to the one staff member", () => {
  it("filters role_permissions by role_id and overrides by staff_id", async () => {
    // ⛔ If the overrides query were not filtered by staff_id it would return
    // every override in the system, and one person's extra capability would
    // become everyone's. The filter is the whole containment story, so it is
    // asserted rather than assumed.
    const { client, recorded } = createFakeSupabase({
      rolePermissions: [PERMISSIONS.VIEW_BOOKINGS_ALL],
      overrides: [],
    });

    await getStaffProfile(client);

    const rolePerms = recorded.find((r) => r.table === "role_permissions");
    const overrides = recorded.find((r) => r.table === "staff_permission_overrides");

    expect(rolePerms?.filters, "role_permissions filter").toEqual([["role_id", "role-1"]]);
    expect(overrides?.filters, "staff_permission_overrides filter").toEqual([
      ["staff_id", "staff-1"],
    ]);
  });

  it("reads the role from the profile row, not from a caller-supplied value", async () => {
    const { client, recorded } = createFakeSupabase({
      profileRow: {
        id: "staff-9",
        auth_user_id: "auth-user-1",
        name: "Other Staff",
        email: "other@example.test",
        role_id: "role-9",
        gender: "male",
        active: true,
        can_take_bookings: false,
        availability_mode: "use_global",
        roles: { name: "Booking Coordinator", display_label: null },
      },
      rolePermissions: [PERMISSIONS.VIEW_BOOKINGS_ALL],
    });

    const profile = await getStaffProfile(client);

    expect(profile?.id).toBe("staff-9");
    expect(profile?.role_name).toBe("Booking Coordinator");
    expect(recorded.find((r) => r.table === "role_permissions")?.filters).toEqual([
      ["role_id", "role-9"],
    ]);
  });
});

describe("no session and no profile resolve to no permissions at all", () => {
  it("returns null when there is no authenticated user", async () => {
    const { client, recorded } = createFakeSupabase({ user: null });

    expect(await getStaffProfile(client)).toBeNull();
    // ⛔ And it must not have gone looking for permissions for nobody.
    expect(recorded, "no queries for an unauthenticated caller").toEqual([]);
  });

  it("returns null when the authenticated user has no staff profile", async () => {
    const { client, recorded } = createFakeSupabase({ profileRow: null });

    expect(await getStaffProfile(client)).toBeNull();
    expect(
      recorded.some((r) => r.table === "staff_permission_overrides"),
      "must not resolve permissions without a profile"
    ).toBe(false);
  });
});

describe("what this resolution deliberately does NOT do", () => {
  it("does not filter out an inactive staff member's permissions", async () => {
    // ⚠️ Recorded, not a defect. getStaffProfile returns the resolved set for a
    // deactivated person too; the refusal happens one layer up, in
    // requirePermission (throws INACTIVE) and getAdminPageAccess (denies all 21
    // pages). Pinning it here means a change to that division of labour shows up
    // in a diff instead of being discovered later.
    const { client } = createFakeSupabase({
      profileRow: {
        id: "staff-1",
        auth_user_id: "auth-user-1",
        name: "Deactivated Staff",
        email: "gone@example.test",
        role_id: "role-1",
        gender: "female",
        active: false,
        can_take_bookings: false,
        availability_mode: "use_global",
        roles: { name: "Therapist", display_label: null },
      },
      rolePermissions: [PERMISSIONS.VIEW_BOOKINGS_ASSIGNED],
    });

    const profile = await getStaffProfile(client);

    expect(profile?.active).toBe(false);
    expect(profile?.permissions.has(PERMISSIONS.VIEW_BOOKINGS_ASSIGNED)).toBe(true);
  });

  it("cannot be reached by a conflicting grant and revoke for the same permission", async () => {
    // The resolution loop applies grants and revocations in ONE pass, in the
    // order the rows arrive, so a row pair granting AND revoking the same
    // permission would resolve by arrival order rather than by the "revocation
    // wins" rule the comment above it describes.
    //
    // ⛔ That is unreachable, and it was checked rather than assumed:
    // staff_permission_overrides is declared
    //   primary key (staff_id, permission_id)
    // in 20260502052452_phase2_group2_staff_profiles.sql, so at most one row can
    // exist per (person, permission). No finding is raised. This test pins the
    // constraint's ROLE — if the primary key were ever relaxed, the ordering
    // question becomes real, and this comment is where the next person finds
    // that out.
    const sql = await import("node:fs").then((fs) =>
      fs.readFileSync(
        "supabase/migrations/20260502052452_phase2_group2_staff_profiles.sql",
        "utf8"
      )
    );

    const table = sql.slice(
      sql.indexOf("create table public.staff_permission_overrides"),
      sql.indexOf("create table public.staff_permission_overrides") + 400
    );

    expect(table, "the primary key is what makes the conflict unreachable").toContain(
      "primary key (staff_id, permission_id)"
    );
  });
});
