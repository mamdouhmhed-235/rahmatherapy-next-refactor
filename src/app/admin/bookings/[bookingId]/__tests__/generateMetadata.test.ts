// C-13 Phase F fix round — the verifier's blocking finding: `generateMetadata`
// replicated the page body's RBAC + scoped-relation gates but never checked
// `scopedRelation.claimableOnly`, so a claimable-only-scoped viewer (a
// therapist who can see the slot but not the client) got the real customer
// name server-rendered into the browser tab title even though the page body
// redacts it everywhere else. These specs pin the fix: claimableOnly now
// short-circuits to the neutral title BEFORE the identity SELECT runs.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateMetadata } from "../page";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

// Only the profile lookup is stubbed — permission helpers (canManageBookings,
// canManageAllBookings, canClaimAssignments) stay real so the gate is exercised
// exactly as it is in production.
vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

const NEUTRAL_TITLE = "Booking detail - Rahma Therapy Admin";

function staff(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    id: "staff-1",
    auth_user_id: "auth-1",
    name: "Staff",
    email: "staff@rahmatherapy.example.test",
    role_id: "role-1",
    role_name: "role",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set<string>(),
    ...overrides,
  };
}

const fullScopeProfile = staff({
  permissions: new Set([PERMISSIONS.MANAGE_BOOKINGS_ALL]),
});
const claimableTherapist = staff({
  permissions: new Set([
    PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED,
    PERMISSIONS.CLAIM_ASSIGNMENTS,
  ]),
});
const noAccessTherapist = staff({
  permissions: new Set([PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED]),
});

type IdentityBookingRow = {
  contact_full_name: string | null;
  clients: { full_name: string | null } | null;
  booking_participants: Array<{
    display_name: string | null;
    is_main_contact: boolean | null;
  }>;
};

/**
 * Stand-in for the admin client covering exactly the two query shapes
 * `generateMetadata` (via `getScopedBookingRelation`) can issue: the
 * `booking_assignments` count checks (assigned, then claimable) and the
 * `bookings` identity SELECT. A full-scope profile short-circuits
 * `getScopedBookingRelation` before any `booking_assignments` query, so
 * `assignedCount`/`claimableCount` are irrelevant in those tests.
 */
function stubAdminClient({
  assignedCount = 0,
  claimableCount = 0,
  bookingRow = null as IdentityBookingRow | null,
} = {}) {
  let bookingAssignmentsCalls = 0;
  const bookingsSelectCalls: string[] = [];

  const from = vi.fn((table: string) => {
    if (table === "booking_assignments") {
      bookingAssignmentsCalls += 1;
      // First call is always the assigned-staff check; a second call (only
      // reached when `canClaimAssignments` is true) is the claimable check.
      const count = bookingAssignmentsCalls === 1 ? assignedCount : claimableCount;
      return {
        select: () => {
          const chain: {
            eq: () => typeof chain;
            is: () => typeof chain;
            then: (
              onFulfilled: (value: { count: number; error: null }) => unknown,
              onRejected?: (reason: unknown) => unknown
            ) => Promise<unknown>;
          } = {
            eq: () => chain,
            is: () => chain,
            then: (onFulfilled, onRejected) =>
              Promise.resolve({ count, error: null }).then(onFulfilled, onRejected),
          };
          return chain;
        },
      };
    }
    if (table === "bookings") {
      return {
        select: (columns: string) => {
          bookingsSelectCalls.push(columns);
          return {
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: bookingRow, error: null }),
            }),
          };
        },
      };
    }
    throw new Error(`stubAdminClient: unexpected table "${table}"`);
  });

  const client = { from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);

  return { bookingsSelectCalls, bookingAssignmentsCallCount: () => bookingAssignmentsCalls };
}

function metadataFor(bookingId = "booking-1") {
  return generateMetadata({ params: Promise.resolve({ bookingId }) });
}

describe("generateMetadata (booking detail tab title)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the neutral title for a signed-out viewer and never touches the admin client", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(null);

    expect(await metadataFor()).toEqual({ title: NEUTRAL_TITLE });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  // The blocking finding this fix round exists for.
  it("returns the neutral title for a claimable-only-scoped viewer, and never selects identity fields", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(claimableTherapist);
    const stub = stubAdminClient({ assignedCount: 0, claimableCount: 1 });

    expect(await metadataFor()).toEqual({ title: NEUTRAL_TITLE });
    // The real assertion: the "bookings" identity SELECT never runs on this
    // path, so `contact_full_name` / `clients` / `booking_participants` are
    // never fetched for a claimable-only viewer — not fetched-then-discarded.
    expect(stub.bookingsSelectCalls).toHaveLength(0);
  });

  it("returns the neutral title for a viewer with no relation to the booking at all", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(noAccessTherapist);
    const stub = stubAdminClient({ assignedCount: 0, claimableCount: 0 });

    expect(await metadataFor()).toEqual({ title: NEUTRAL_TITLE });
    expect(stub.bookingsSelectCalls).toHaveLength(0);
  });

  it("returns the composite identity title for a full-scope viewer on a group booking", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(fullScopeProfile);
    stubAdminClient({
      bookingRow: {
        contact_full_name: "Aisha Khan",
        clients: null,
        booking_participants: [
          { display_name: "Aisha Khan", is_main_contact: true },
          { display_name: "Person 2", is_main_contact: false },
          { display_name: "Person 3", is_main_contact: false },
        ],
      },
    });

    expect(await metadataFor()).toEqual({
      title: "Aisha Khan + 2 others - Booking detail - Rahma Therapy Admin",
    });
  });

  it("returns the single-name identity title for a full-scope viewer on a single booking", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(fullScopeProfile);
    stubAdminClient({
      bookingRow: {
        contact_full_name: "Aisha Khan",
        clients: null,
        booking_participants: [{ display_name: "Aisha Khan", is_main_contact: true }],
      },
    });

    expect(await metadataFor()).toEqual({
      title: "Aisha Khan - Booking detail - Rahma Therapy Admin",
    });
  });

  it("returns the neutral title when the booking id does not resolve to a row", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(fullScopeProfile);
    stubAdminClient({ bookingRow: null });

    await expect(metadataFor("missing-booking")).resolves.toEqual({
      title: NEUTRAL_TITLE,
    });
  });

  it("never throws across the full matrix of viewer/booking states", async () => {
    const cases: Array<[
      StaffProfile | null,
      Parameters<typeof stubAdminClient>[0],
    ]> = [
      [null, {}],
      [claimableTherapist, { assignedCount: 0, claimableCount: 1 }],
      [noAccessTherapist, { assignedCount: 0, claimableCount: 0 }],
      [fullScopeProfile, { bookingRow: null }],
      [
        fullScopeProfile,
        {
          bookingRow: {
            contact_full_name: null,
            clients: null,
            booking_participants: [],
          },
        },
      ],
    ];

    for (const [profile, options] of cases) {
      vi.mocked(getStaffProfile).mockResolvedValue(profile);
      stubAdminClient(options);
      await expect(metadataFor()).resolves.toBeTruthy();
    }
  });
});
