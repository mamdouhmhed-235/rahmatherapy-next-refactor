// C-07 B2 fix round — the Team/Mine narrowing logic
// (`getActorAssignedBookingIds`, `getClients`' narrowToActor branch,
// `getEnquiries`' actorStaffId filter, `getEmailEvents`/`getOperationalEvents`'
// actorBookingIds filter) shipped with zero test coverage. A narrowing that
// silently stops narrowing looks identical to a working dashboard — nothing
// here is visible to tsc/lint/build, only to a spec that actually exercises
// two staff members' bookings side by side.
//
// `unstable_cache` is inert outside a Next.js request scope (see
// fake-unstable-cache.ts), so this uses the same in-memory stand-in the
// C-09 Step 7 specs use, to make the cache-key-differs assertion meaningful.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";

const cacheHarness = await vi.hoisted(async () => {
  const { createFakeUnstableCache } = await import(
    "@/lib/cache/__tests__/fake-unstable-cache"
  );
  return createFakeUnstableCache();
});

vi.mock("next/cache", () => ({
  unstable_cache: cacheHarness.unstable_cache,
}));

const { getDashboardData } = await import("../dashboard-data");

// ── Minimal in-memory Supabase stand-in that actually applies filters ───────
// (unlike lib/cache/__tests__/fake-supabase-admin.ts, which returns a canned
// per-table result regardless of `.eq`/`.in` args) — needed here because the
// whole point is proving the narrowing WHERE clauses are actually applied.
type Row = Record<string, unknown>;

function makeQueryBuilder(rows: Row[]) {
  let filtered = rows;
  const chain: Record<string, unknown> = {
    select: () => chain,
    order: () => chain,
    eq: (col: string, val: unknown) => {
      filtered = filtered.filter((r) => r[col] === val);
      return chain;
    },
    neq: (col: string, val: unknown) => {
      filtered = filtered.filter((r) => r[col] !== val);
      return chain;
    },
    in: (col: string, vals: unknown[]) => {
      const set = new Set(vals);
      filtered = filtered.filter((r) => set.has(r[col]));
      return chain;
    },
    is: (col: string, val: unknown) => {
      filtered = filtered.filter((r) => r[col] === val);
      return chain;
    },
    gte: (col: string, val: unknown) => {
      filtered = filtered.filter((r) => (r[col] as string) >= (val as string));
      return chain;
    },
    lte: (col: string, val: unknown) => {
      filtered = filtered.filter((r) => (r[col] as string) <= (val as string));
      return chain;
    },
    returns: () => Promise.resolve({ data: filtered, error: null }),
    then: (
      onFulfilled?: (v: { data: Row[]; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve({ data: filtered, error: null }).then(onFulfilled, onRejected),
  };
  return chain;
}

function createNarrowingClient(tables: Record<string, Row[]>) {
  const fromCalls: string[] = [];
  return {
    fromCalls,
    from(table: string) {
      fromCalls.push(table);
      return makeQueryBuilder(tables[table] ?? []);
    },
  };
}

function ownerProfile(): StaffProfile {
  return {
    id: "staff-a",
    auth_user_id: "auth-a",
    name: "Staff A",
    email: "staff-a@example.test",
    role_id: "role-owner",
    role_name: "Owner",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set([
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_BOOKINGS_ALL,
      PERMISSIONS.VIEW_REPORTS_BUSINESS,
      PERMISSIONS.VIEW_REPORTS_REVENUE,
      PERMISSIONS.VIEW_CLIENTS_ALL,
      PERMISSIONS.VIEW_STAFF,
      PERMISSIONS.MANAGE_ENQUIRIES,
      PERMISSIONS.VIEW_EMAIL_LOGS,
      PERMISSIONS.MANAGE_SETTINGS,
    ]),
  } as StaffProfile;
}

const FILTERS = {
  range: "custom",
  from: "2026-01-01",
  to: "2026-01-31",
  staffId: "",
  service: "",
  source: "",
  status: "",
  paymentStatus: "",
  city: "",
};

// Two bookings, each owned (via booking_assignments.assigned_staff_id) by a
// different staff member — b1 by the viewer ("staff-a"), b2 by a colleague.
const BOOKINGS: Row[] = [
  {
    id: "b1",
    client_id: "c1",
    booking_date: "2026-01-10",
    start_time: "09:00",
    end_time: "10:00",
    status: "confirmed",
    payment_status: "paid",
    assignment_status: "assigned",
    reschedule_status: "none",
    customer_cancelled_at: null,
    booking_source: "phone",
    contact_full_name: "Client One",
    contact_email: "one@example.test",
    contact_phone: "111",
    service_city: "Luton",
    service_postcode: "LU1 1AA",
    service_address_line1: "1 Road",
    health_notes: null,
    created_at: "2026-01-01T00:00:00Z",
    total_price: 100,
    amount_due: 0,
    amount_paid: 100,
  },
  {
    id: "b2",
    client_id: "c2",
    booking_date: "2026-01-11",
    start_time: "09:00",
    end_time: "10:00",
    status: "confirmed",
    payment_status: "paid",
    assignment_status: "assigned",
    reschedule_status: "none",
    customer_cancelled_at: null,
    booking_source: "phone",
    contact_full_name: "Client Two",
    contact_email: "two@example.test",
    contact_phone: "222",
    service_city: "Luton",
    service_postcode: "LU1 1AB",
    service_address_line1: "2 Road",
    health_notes: null,
    created_at: "2026-01-01T00:00:00Z",
    total_price: 100,
    amount_due: 0,
    amount_paid: 100,
  },
];

const ASSIGNMENTS: Row[] = [
  { id: "a1", booking_id: "b1", participant_id: "p1", assigned_staff_id: "staff-a", required_therapist_gender: "female", status: "assigned" },
  { id: "a2", booking_id: "b2", participant_id: "p2", assigned_staff_id: "staff-b", required_therapist_gender: "female", status: "assigned" },
];

const CLIENTS: Row[] = [
  { id: "c1", full_name: "Client One", client_source: "phone", created_at: "2026-01-01" },
  { id: "c2", full_name: "Client Two", client_source: "phone", created_at: "2026-01-01" },
];

const STAFF: Row[] = [
  { id: "staff-a", name: "Staff A", gender: "female", active: true, can_take_bookings: true, availability_mode: "use_global", role_id: "role-owner" },
  { id: "staff-b", name: "Staff B", gender: "female", active: true, can_take_bookings: true, availability_mode: "use_global", role_id: "role-therapist" },
];

const ENQUIRIES: Row[] = [
  { id: "e1", full_name: "Enquirer One", source: "phone", status: "new", created_at: "2026-01-01T00:00:00Z", assigned_staff_id: "staff-a" },
  { id: "e2", full_name: "Enquirer Two", source: "phone", status: "new", created_at: "2026-01-01T00:00:00Z", assigned_staff_id: "staff-b" },
];

const EMAIL_EVENTS: Row[] = [
  { id: "ev1", booking_id: "b1", staff_id: null, event_type: "confirmation", recipient_email: "one@example.test", recipient_role: "customer", delivery_status: "delivered", error_message: null, created_at: "2026-01-01T00:00:00Z" },
  { id: "ev2", booking_id: "b2", staff_id: null, event_type: "confirmation", recipient_email: "two@example.test", recipient_role: "customer", delivery_status: "delivered", error_message: null, created_at: "2026-01-01T00:00:00Z" },
];

const OPERATIONAL_EVENTS: Row[] = [
  { id: "op1", event_type: "issue", severity: "low", status: "open", summary: "b1 issue", booking_id: "b1", staff_id: null, created_at: "2026-01-01T00:00:00Z" },
  { id: "op2", event_type: "issue", severity: "low", status: "open", summary: "b2 issue", booking_id: "b2", staff_id: null, created_at: "2026-01-01T00:00:00Z" },
];

function tables() {
  return {
    bookings: BOOKINGS,
    booking_assignments: ASSIGNMENTS,
    booking_items: [],
    clients: CLIENTS,
    staff_profiles: STAFF,
    staff_availability_rules: [],
    enquiries: ENQUIRIES,
    email_delivery_events: EMAIL_EVENTS,
    operational_events: OPERATIONAL_EVENTS,
  };
}

beforeEach(() => {
  cacheHarness.clear();
});

describe("getDashboardData — Team/Mine narrowing (C-07 B2 fix round)", () => {
  it("scope='mine' narrows bookings, clients, enquiries, and booking-linked events to the actor's own assignments", async () => {
    const client = createNarrowingClient(tables());
    const profile = ownerProfile();

    const { data: mine } = await getDashboardData(client as never, profile, FILTERS, "mine");
    expect(mine.bookings.map((b) => b.id)).toEqual(["b1"]);
    expect(mine.clients.map((c) => c.id)).toEqual(["c1"]);
    expect(mine.enquiries.map((e) => e.id)).toEqual(["e1"]);
    expect(mine.emailEvents.map((e) => e.id)).toEqual(["ev1"]);
    expect(mine.operationalEvents.map((e) => e.id)).toEqual(["op1"]);
  });

  it("scope absent (and scope='team') does not narrow — both staff members' data is visible", async () => {
    const client = createNarrowingClient(tables());
    const profile = ownerProfile();

    const { data: absent } = await getDashboardData(client as never, profile, FILTERS);
    expect(absent.bookings.map((b) => b.id).sort()).toEqual(["b1", "b2"]);
    expect(absent.clients.map((c) => c.id).sort()).toEqual(["c1", "c2"]);
    expect(absent.enquiries.map((e) => e.id).sort()).toEqual(["e1", "e2"]);
    expect(absent.emailEvents.map((e) => e.id).sort()).toEqual(["ev1", "ev2"]);
    expect(absent.operationalEvents.map((e) => e.id).sort()).toEqual(["op1", "op2"]);

    const client2 = createNarrowingClient(tables());
    const { data: team } = await getDashboardData(client2 as never, profile, FILTERS, "team");
    expect(team.bookings.map((b) => b.id).sort()).toEqual(["b1", "b2"]);
  });

  it("keys the cache separately for team vs mine — switching scope always re-fetches, repeating a scope never does", async () => {
    const client = createNarrowingClient(tables());
    const profile = ownerProfile();

    await getDashboardData(client as never, profile, FILTERS, "team");
    const callsAfterFirstTeam = client.fromCalls.length;

    // Same scope again — must be served from cache, no new Supabase calls.
    await getDashboardData(client as never, profile, FILTERS, "team");
    expect(client.fromCalls.length).toBe(callsAfterFirstTeam);

    // Different scope — distinct cache key, must genuinely re-fetch.
    await getDashboardData(client as never, profile, FILTERS, "mine");
    expect(client.fromCalls.length).toBeGreaterThan(callsAfterFirstTeam);
  });

  it("the staff roster query is deliberately NOT narrowed — team and mine see the identical staff list", async () => {
    const clientMine = createNarrowingClient(tables());
    const clientTeam = createNarrowingClient(tables());
    const profile = ownerProfile();

    const { data: mine } = await getDashboardData(clientMine as never, profile, FILTERS, "mine");
    const { data: team } = await getDashboardData(clientTeam as never, profile, FILTERS, "team");

    expect(mine.staff.map((s) => s.id).sort()).toEqual(["staff-a", "staff-b"]);
    expect(team.staff.map((s) => s.id).sort()).toEqual(["staff-a", "staff-b"]);
  });
});
