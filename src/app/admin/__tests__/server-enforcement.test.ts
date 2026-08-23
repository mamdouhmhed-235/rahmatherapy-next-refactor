// ⛔ GATE 07 BLOCK B (cases 6-17) — SERVER ENFORCEMENT PER MUTATING ACTION.
//
// Every admin mutation runs through createSupabaseAdminClient(), the
// service-role key, which bypasses RLS by design. There is no database backstop
// underneath: a hand-written permission check is the entire protection. So it is
// not enough to know an action REFUSES — it matters that it refuses *before* the
// RLS-bypassing client exists.
//
// That is what this file measures. Every denial asserts two things:
//
//   1. the action returns its refusal, and
//   2. ⛔ createSupabaseAdminClient was NEVER CALLED.
//
// And every case also drives the correctly-permissioned role, asserting the
// refusal does NOT appear. Without that half, an action hard-wired to refuse
// everybody would pass all of the above. The same probe, both directions.
//
// Each action is driven with four actor states: no session · deactivated ·
// a real role that lacks the capability · the real role that holds it.
//
// ⚠️ NOTHING in the permission layer is mocked. The actor is supplied by feeding
// a fake Supabase client to the real getStaffProfile, so each action is gated
// exactly as it is in production, resolving the live role grants in
// src/lib/auth/role-grants.json the production way. See the note above the
// server-client mock for why stubbing the getStaffProfile export is NOT
// equivalent and quietly broke four of these cases.

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import roleGrantsFixture from "@/lib/auth/role-grants.json";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

// ⛔ NOTHING in @/lib/auth/rbac is mocked - not getStaffProfile, not
// requirePermission, not one canX() helper. The actor is supplied by feeding a
// fake Supabase client to the REAL getStaffProfile, so every gate below is the
// production gate, resolving permissions the production way.
//
// This was not the first attempt. Stubbing the getStaffProfile export looked
// equivalent and is not: requirePermission calls getStaffProfile through rbac's
// own internal binding, which a module mock never replaces. Four actions
// (updateStaffPermissionOverride, toggleRolePermission, updateRoleMetadata,
// updateBusinessSettings) therefore refused EVERY actor, including the one
// holding the permission - a mocking artefact that would have read as four
// green denial tests with a silently broken non-vacuity check.
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => currentServerClient()),
}));

vi.mock("@/lib/email/notifications", () => ({
  sendBookingCreatedEmails: vi.fn(),
  sendAssignedStaffBookingChangeEmails: vi.fn(),
  sendBookingCancellationEmails: vi.fn(),
  sendStaffAssignmentEmail: vi.fn(),
  sendBookingRescheduleEmails: vi.fn(),
  // ⛔ MUST resolve a promise, not undefined. createEnquiry calls this as
  // `sendEnquiryLoggedEmail(...).catch(...)`, so a bare vi.fn() returning
  // undefined throws a TypeError on `.catch` — which invoke() would swallow
  // into `{ threw }` and refusedWith() would read as "not refused", i.e. the
  // non-vacuity check would pass for the wrong reason.
  sendEnquiryLoggedEmail: vi.fn(async () => undefined),
}));

vi.mock("@/lib/booking/manage-token", () => ({ ensureBookingManageUrl: vi.fn() }));

import { updateBookingManagement } from "../bookings/actions";
import {
  claimBookingAssignment,
  rescheduleBooking,
  updateBookingAssignment,
  updateOwnAssignmentStatus,
} from "../bookings/actions";
import {
  addClientNote,
  adminDeleteClient,
  bulkDeleteClients,
  updateClient,
} from "../clients/actions";
import { createEnquiry, updateEnquiryStatus } from "../enquiries/actions";
import { updateStaffPermissionOverride, updateStaffProfile } from "../staff/actions";
import { toggleRolePermission, updateRoleMetadata } from "../roles/actions";
import { updateBusinessSettings } from "../settings/actions";
import { createService } from "../services/actions";
import { GET as reportsExport } from "../reports/export/route";

// ─── actors, built from the live role grants ─────────────────────────────────

type RoleName = "Owner" | "Admin" | "Booking Coordinator" | "Therapist";

const ROLE_GRANTS = (
  roleGrantsFixture as { roles: Record<string, { grants: string[] }> }
).roles;

type Actor = {
  role: RoleName | null;
  active: boolean;
  canTakeBookings: boolean;
};

function actor(role: RoleName, overrides: Partial<Omit<Actor, "role">> = {}): Actor {
  return { role, active: true, canTakeBookings: true, ...overrides };
}

const NO_SESSION: Actor = { role: null, active: false, canTakeBookings: false };

let CURRENT: Actor = NO_SESSION;

/**
 * A fake Supabase client shaped for the real getStaffProfile: an auth user, a
 * staff_profiles row, the role's grants from role_permissions, and no personal
 * overrides. Feeding the real resolver is what keeps every gate honest.
 */
function currentServerClient() {
  const signedIn = CURRENT.role !== null;

  const profileRow = signedIn
    ? {
        id: "staff-actor",
        auth_user_id: "auth-actor",
        name: CURRENT.role,
        email: "actor@example.test",
        role_id: "role-actor",
        gender: "female",
        active: CURRENT.active,
        can_take_bookings: CURRENT.canTakeBookings,
        availability_mode: "use_global",
        roles: { name: CURRENT.role, display_label: null },
      }
    : null;

  const grants = CURRENT.role ? ROLE_GRANTS[CURRENT.role].grants : [];

  function builder(table: string) {
    const rows =
      table === "role_permissions"
        ? grants.map((name) => ({ permissions: { name } }))
        : [];
    const chain = {
      select: () => chain,
      eq: () => chain,
      single: async () => ({ data: profileRow, error: null }),
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: rows as unknown[], error: null }),
    };
    return chain;
  }

  return {
    auth: {
      getUser: async () => ({
        data: { user: signedIn ? { id: "auth-actor" } : null },
        error: null,
      }),
    },
    from: (table: string) => builder(table),
  };
}

const REFUSAL = "Insufficient permissions.";

type Outcome = { value?: unknown; threw?: unknown };

async function invoke(run: () => Promise<unknown>): Promise<Outcome> {
  try {
    return { value: await run() };
  } catch (threw) {
    return { threw };
  }
}

function refusedWith(outcome: Outcome): boolean {
  const value = outcome.value as { error?: string } | undefined;
  return value?.error === REFUSAL;
}

// A permissive stand-in for the service-role client. Any action that gets past
// its gate reaches this rather than a real connection, so a passing run touches
// no database. Every method chains; awaiting a chain yields an empty result, so
// an ownership lookup answers "no rows" rather than accidentally granting
// access.
function fakeAdminClient(): unknown {
  const EMPTY = { data: [], error: null, count: 0 };
  const chain: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (value: typeof EMPTY) => unknown) => resolve(EMPTY);
        }
        return () => chain;
      },
    }
  );
  return chain;
}

// ─── the 12 actions ──────────────────────────────────────────────────────────

type ActionCase = {
  readonly caseId: number;
  readonly name: string;
  readonly capability: string;
  readonly allowed: RoleName;
  readonly denied: readonly RoleName[];
  readonly run: () => Promise<unknown>;
  /** Actions whose refusal is an HTTP response rather than an error object. */
  readonly refusedAsResponse?: boolean;
};

function form(entries: Record<string, string> = {}): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

const ACTION_CASES: readonly ActionCase[] = [
  {
    caseId: 6,
    name: "updateBookingManagement",
    capability: "manage_bookings_all",
    allowed: "Booking Coordinator",
    // ⚠️ A Therapist passes requireBookingManager (they hold
    // manage_bookings_assigned) and is stopped by the SECOND check,
    // canManageAllBookings. Still before any admin client.
    denied: ["Therapist"],
    run: () => updateBookingManagement({}, form({ booking_id: "b-1" })),
  },
  {
    caseId: 7,
    name: "updateBookingAssignment",
    capability: "manage_bookings_all AND assign_bookings",
    allowed: "Booking Coordinator",
    denied: ["Therapist"],
    run: () => updateBookingAssignment(form({ assignment_id: "a-1", action: "unassign" })),
  },
  {
    // D-051 - moving a booking to a new date and time. Added with the
    // feature rather than after it: this table is HAND-MAINTAINED and its
    // counter reads the array rather than the app, so a missing action makes
    // the suite pass while proving nothing - exactly how createService went
    // unguarded until gate 07 case 18.
    //
    // Its unique value over rescheduleBooking.test.ts is AUTHZ-3: this asserts
    // the admin client is never even CONSTRUCTED for a denied actor, so a
    // refusal cannot have read or written anything on the way to saying no.
    caseId: 7,
    name: "rescheduleBooking",
    capability: "manage_bookings_all",
    allowed: "Booking Coordinator",
    denied: ["Therapist"],
    run: () =>
      rescheduleBooking(
        form({ booking_id: "b-1", booking_date: "2030-01-01", start_time: "10:00" })
      ),
  },
  {
    caseId: 8,
    name: "claimBookingAssignment",
    capability: "claim_assignments + active + can_take_bookings",
    allowed: "Therapist",
    // ⛔ The mirror image of case 7: the Coordinator hands work out and may not
    // take it.
    denied: ["Booking Coordinator"],
    run: () => claimBookingAssignment(form({ assignment_id: "a-1" })),
  },
  {
    caseId: 9,
    name: "updateOwnAssignmentStatus",
    capability: "manage_bookings_all OR manage_bookings_assigned",
    allowed: "Therapist",
    // ⚠️ Every active role holds one of the two, so no role is denied here on
    // permission alone. Ownership is the real boundary and is asserted
    // separately below.
    denied: [],
    run: () => updateOwnAssignmentStatus(form({ assignment_id: "a-1", status: "completed" })),
  },
  {
    caseId: 10,
    name: "updateClient",
    capability: "manage_clients_all",
    allowed: "Booking Coordinator",
    denied: ["Therapist"],
    run: () => updateClient({}, form({ client_id: "c-1" })),
  },
  {
    caseId: 11,
    name: "adminDeleteClient",
    capability: "manage_clients_all AND manage_client_destructive_ops",
    allowed: "Admin",
    // ⛔ The Coordinator holds manage_clients_all and is still refused. Deleting
    // a client is Owner/Admin only.
    denied: ["Booking Coordinator", "Therapist"],
    run: () => adminDeleteClient(form({ client_id: "c-1" })),
  },
  {
    caseId: 11,
    name: "bulkDeleteClients",
    capability: "manage_clients_all AND manage_client_destructive_ops",
    allowed: "Admin",
    denied: ["Booking Coordinator", "Therapist"],
    run: () => bulkDeleteClients(form({ client_ids: "c-1" })),
  },
  {
    caseId: 12,
    name: "addClientNote",
    capability: "active, then per-client assignment access",
    allowed: "Owner",
    denied: [],
    // ⛔ requireClientNoteActor checks only `active` — the real check is
    // assignment-based and needs a database read, so the admin client is built
    // first. That exception is asserted in its own block below rather than
    // merely described here.
    run: () => addClientNote({}, form({ client_id: "c-1", note: "hello" })),
  },
  {
    caseId: 13,
    name: "updateStaffProfile",
    capability: "field-class allowlist; operational fields need manage_staff_profiles",
    allowed: "Admin",
    denied: ["Booking Coordinator", "Therapist"],
    run: () => updateStaffProfile("other-staff", { active: false }),
  },
  {
    caseId: 14,
    name: "updateStaffPermissionOverride",
    capability: "manage_permission_overrides (Owner only)",
    allowed: "Owner",
    denied: ["Admin", "Booking Coordinator", "Therapist"],
    run: () => updateStaffPermissionOverride("other-staff", "perm-1", "grant"),
  },
  {
    caseId: 15,
    name: "toggleRolePermission",
    capability: "manage_role_templates (Owner only)",
    allowed: "Owner",
    denied: ["Admin", "Booking Coordinator", "Therapist"],
    run: () => toggleRolePermission("role-1", "perm-1", "view_dashboard", false),
  },
  {
    caseId: 15,
    name: "updateRoleMetadata",
    capability: "manage_role_templates (Owner only)",
    allowed: "Owner",
    denied: ["Admin", "Booking Coordinator", "Therapist"],
    run: () => updateRoleMetadata({}, form({ role_id: "role-1" })),
  },
  {
    caseId: 16,
    name: "updateBusinessSettings",
    capability: "manage_settings",
    allowed: "Admin",
    denied: ["Booking Coordinator", "Therapist"],
    run: () => updateBusinessSettings({}, form({ company_name: "ZZTEST" })),
  },
  {
    // ⛔ GATE 07 CASE 18 — and the reason that case exists.
    //
    // ⚠️ `createService` was the ONE action of case 18's six with no
    // server-enforcement coverage anywhere. Measured, not assumed: it appeared
    // zero times in this file, and the only test that drives it
    // (`services/__tests__/actions.test.ts`) MOCKS `requirePermission`
    // outright — so nothing in the repo proved that a real Coordinator or
    // Therapist profile is actually refused, nor that the refusal happens
    // before the RLS-bypassing admin client exists.
    //
    // ⛔ The counter below is what should have caught this and did not: it is a
    // hand-maintained number, so it only notices an action somebody remembered
    // to add. That is worth knowing about the guard.
    caseId: 18,
    name: "createService",
    capability: "manage_services",
    allowed: "Admin",
    denied: ["Booking Coordinator", "Therapist"],
    run: () => createService({}, form({ name: "ZZTEST Service" })),
  },
  {
    caseId: 17,
    name: "GET /admin/reports/export",
    capability: "canOpenReports AND (export_reports_own OR export_reports_revenue)",
    allowed: "Therapist",
    // ⛔ The Booking Coordinator CAN open reports (view_reports_operational) and
    // still cannot export: they hold neither export permission.
    denied: ["Booking Coordinator"],
    refusedAsResponse: true,
    run: () =>
      reportsExport(
        new Request("http://localhost/admin/reports/export?report=client_summary") as never
      ),
  },
  // ── ⛔ E08-101 (gate 08) — the two enquiry actions ────────────────────────
  //
  // ⚠️ These were NOT in this table, and they are mutating admin actions that
  // reach the service-role client. The meta-test below says in as many words
  // that such an action is "an unasserted gate"; these two were exactly that.
  // Found while writing gate 08's enquiries group, closed here.
  //
  // ⛔ The caseId 101 is E08-101, a GATE 08 case. Every other row here is a
  // gate 07 plan case (6-17), and those never reach 101, so the two schemes
  // cannot collide.
  {
    caseId: 101,
    name: "createEnquiry",
    capability: "manage_enquiries",
    // Owner, Admin and Booking Coordinator hold it; the Therapist does not.
    // Measured against role_permissions in production, not assumed.
    allowed: "Booking Coordinator",
    denied: ["Therapist"],
    // ⛔ A VALID payload on purpose. With an invalid one the action returns
    // "Check the enquiry details." instead of the refusal string, so the
    // denial assertions would pass without the permission gate ever being the
    // thing that stopped it.
    run: () =>
      createEnquiry({}, form({ full_name: "ZZTEST-Authz", source: "phone" })),
  },
  {
    caseId: 101,
    name: "updateEnquiryStatus",
    capability: "manage_enquiries",
    allowed: "Booking Coordinator",
    denied: ["Therapist"],
    run: () => updateEnquiryStatus(form({ enquiry_id: "e-1", status: "contacted" })),
  },
];

// ═════════════════════════════════════════════════════════════════════════════

describe("AUTHZ-3 — a denial constructs zero service-role clients", () => {
  const adminClientFactory = vi.mocked(createSupabaseAdminClient);

  beforeEach(() => {
    vi.clearAllMocks();
    CURRENT = NO_SESSION;
    adminClientFactory.mockImplementation(() => fakeAdminClient() as never);
  });

  it("covers gate 07 cases 6-18 plus E08-101, across 17 entry points", () => {
    // ⛔ Guards the guard. A mutating action added to the app and not added here
    // is an unasserted gate, which is the gap this block exists to close.
    // ⚠️ 14 -> 16 on 2026-08-21: createEnquiry and updateEnquiryStatus were
    // missing, and this counter is what should have caught them.
    // ⚠️ 16 -> 17 on 2026-08-22: `createService` (gate 07 case 18) was missing,
    // and the only other test touching it mocks the permission check away.
    // ⚠️ 17 -> 18 on 2026-08-23: `rescheduleBooking` (D-051), added WITH the
    // feature. An independent review pointed out it was missing and that this
    // counter would not have noticed, because it counts the array.
    expect(ACTION_CASES.length, "entry points").toBe(18);
    expect(new Set(ACTION_CASES.map((c) => c.caseId)).size, "cases covered").toBe(14);
    expect(new Set(ACTION_CASES.map((c) => c.name)).size, "names unique").toBe(18);
  });

  describe.each(ACTION_CASES)("case $caseId — $name", (testCase) => {
    async function assertRefusedWithoutAdminClient(who: Actor, label: string) {
      CURRENT = who;

      const outcome = await invoke(testCase.run);

      if (testCase.refusedAsResponse) {
        const response = outcome.value as Response;
        expect([401, 403], `${label} status`).toContain(response.status);
      } else {
        expect(refusedWith(outcome), `${label} must be refused`).toBe(true);
      }

      // ⛔ The half that proves the check ran BEFORE the RLS-bypassing client
      // could exist.
      expect(
        adminClientFactory,
        `${label}: no service-role client may be constructed on a denial`
      ).not.toHaveBeenCalled();
    }

    it("refuses with no session at all, and builds no admin client", async () => {
      await assertRefusedWithoutAdminClient(NO_SESSION, "no session");
    });

    it("refuses a deactivated staff member, and builds no admin client", async () => {
      // Deliberately given the FULL Owner permission set — only `active` is
      // false, so this isolates deactivation from every permission question.
      await assertRefusedWithoutAdminClient(
        actor("Owner", { active: false }),
        "deactivated Owner"
      );
    });

    it.each(testCase.denied.length ? testCase.denied : ["__none__"])(
      "refuses %s, and builds no admin client",
      async (role) => {
        if (role === "__none__") {
          // Recorded rather than skipped silently: every active role holds this
          // capability, so there is no under-permissioned role to drive. The
          // boundary for this action is ownership, not permission.
          expect(testCase.denied).toEqual([]);
          return;
        }
        await assertRefusedWithoutAdminClient(actor(role as RoleName), `${role}`);
      }
    );

    it("does NOT refuse the correctly-permissioned role", async () => {
      // ⛔ Non-vacuity. Without this, an action hard-wired to refuse everyone
      // would satisfy every assertion above.
      CURRENT = actor(testCase.allowed);

      const outcome = await invoke(testCase.run);

      if (testCase.refusedAsResponse) {
        // A refusal is a returned Response. Throwing means the gate was passed
        // and the stubbed client failed downstream, which is a pass here.
        if (outcome.value !== undefined) {
          const response = outcome.value as Response;
          expect(response.status, `${testCase.allowed} must not be forbidden`).not.toBe(403);
          expect(response.status, `${testCase.allowed} must not be unauthorized`).not.toBe(401);
        }
      } else {
        expect(
          refusedWith(outcome),
          `${testCase.allowed} holds ${testCase.capability} and must get past the gate`
        ).toBe(false);
      }
    });
  });
});

describe("case 9 — a therapist may act only on their OWN assignment", () => {
  const adminClientFactory = vi.mocked(createSupabaseAdminClient);

  beforeEach(() => {
    vi.clearAllMocks();
    CURRENT = NO_SESSION;
  });

  it("re-filters the UPDATE by the actor's own staff id, in the source", () => {
    // ⚠️ Structural, and stated as such. The permission gate lets every active
    // role through (see case 9 above), so the only thing separating Therapist B
    // from Therapist A's assignment is the ownership filter on the write. It is
    // asserted here because the mocked client cannot observe a real query, and
    // because a UI-level scoping would look identical from the outside.
    const source = readFileSync("src/app/admin/bookings/actions.ts", "utf8");

    const body = source.slice(source.indexOf("export async function updateOwnAssignmentStatus"));
    const action = body.slice(0, body.indexOf("\nexport async function", 1));

    expect(action, "the write must re-filter by the actor's own id").toContain(
      'eq("assigned_staff_id"'
    );
  });

  it("refuses a deactivated therapist before any admin client", async () => {
    CURRENT = actor("Therapist", { active: false });
    const outcome = await invoke(() =>
      updateOwnAssignmentStatus(form({ assignment_id: "a-1", status: "completed" }))
    );
    expect(refusedWith(outcome)).toBe(true);
    expect(adminClientFactory).not.toHaveBeenCalled();
  });
});

describe("case 12 — addClientNote is the one documented exception to AUTHZ-3", () => {
  const adminClientFactory = vi.mocked(createSupabaseAdminClient);

  beforeEach(() => {
    vi.clearAllMocks();
    CURRENT = NO_SESSION;
    adminClientFactory.mockImplementation(() => fakeAdminClient() as never);
  });

  it("builds the admin client BEFORE the per-client check, because that check needs a read", async () => {
    // ⚠️ Stated plainly rather than papered over. requireClientNoteActor gates
    // on `active` alone; whether this actor may write a note for THIS client
    // depends on whether they have an assigned booking for them, which cannot be
    // known without querying. So the service-role client exists before the final
    // refusal.
    //
    // That is not a bypass, and the next assertion is what shows it: the action
    // still refuses, and it refuses before writing anything. But it does break
    // the "zero service-role clients on a denial" rule that the other eleven
    // actions keep, so it is recorded as an exception with its reason instead of
    // being quietly excluded from the table.
    CURRENT = actor("Therapist");

    const outcome = await invoke(() =>
      addClientNote({}, form({ client_id: "c-1", note: "ZZTEST note" }))
    );

    expect(refusedWith(outcome), "a therapist with no assigned booking is refused").toBe(
      true
    );
    expect(
      adminClientFactory,
      "and the admin client WAS constructed first - the documented exception"
    ).toHaveBeenCalled();
  });

  it("still refuses before the admin client for the states its first gate covers", async () => {
    for (const [label, who] of [
      ["no session", NO_SESSION],
      ["deactivated", actor("Owner", { active: false })],
    ] as const) {
      vi.clearAllMocks();
      adminClientFactory.mockImplementation(() => fakeAdminClient() as never);
      CURRENT = who;

      const outcome = await invoke(() =>
        addClientNote({}, form({ client_id: "c-1", note: "ZZTEST note" }))
      );

      expect(refusedWith(outcome), label + " refused").toBe(true);
      expect(adminClientFactory, label + " builds no admin client").not.toHaveBeenCalled();
    }
  });
});
