import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { updateClient } from "../actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

// Only the profile lookup is stubbed — the permission helpers stay real so the
// action is gated exactly as it is in production.
vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

const CURRENT_ROW = {
  id: "client-1",
  full_name: "Sara Mohamed",
  phone: "07100 000 000",
  email: "sara@example.test",
  gender_preference: "no_preference",
  address: "1 Test Street",
  postcode: "LU1 1AA",
  city: "Luton",
  area: "Bury Park",
  client_source: "website",
  source_detail: null,
  notes: "Prefers mornings.",
  updated_at: "2026-07-01T09:00:00.000Z",
  deleted_at: null as string | null,
};

function staff(name: string, permissions: string[]): StaffProfile {
  return {
    id: `staff-${name}`,
    auth_user_id: `auth-${name}`,
    name,
    email: `${name}@rahmatherapy.example.test`,
    role_id: `role-${name}`,
    role_name: name,
    gender: "female",
    active: true,
    can_take_bookings: false,
    availability_mode: "use_global",
    permissions: new Set(permissions),
  };
}

const owner = staff("Owner", [
  PERMISSIONS.MANAGE_CLIENTS_ALL,
  PERMISSIONS.MANAGE_CLIENT_IDENTITY_FIELDS,
]);
const coordinator = staff("Coordinator", [PERMISSIONS.MANAGE_CLIENTS_ALL]);
const therapist = staff("Therapist", [PERMISSIONS.VIEW_CLIENTS_ASSIGNED]);

/**
 * Minimal stand-in for the Supabase admin client covering exactly the four
 * calls `updateClient` makes: the current-row fetch, the email-collision probe,
 * the UPDATE, and the audit insert.
 */
function stubAdminClient({
  current = CURRENT_ROW,
  emailClash = null as { id: string; full_name: string } | null,
} = {}) {
  const updates: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  /** Every email the collision probe was actually asked about. */
  const emailProbes: string[] = [];

  const from = vi.fn((table: string) => {
    if (table === "audit_logs") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          audits.push(row);
          return { error: null };
        }),
      };
    }
    return {
      // The current-row fetch asks for `updated_at`; the collision probe only
      // asks for `id, full_name`.
      select: (columns: string) =>
        columns.includes("updated_at")
          ? {
              eq: () => ({
                single: async () => ({ data: current, error: null }),
              }),
            }
          : {
              eq: (_column: string, value: string) => {
                emailProbes.push(value);
                return {
                  neq: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: emailClash, error: null }),
                    }),
                  }),
                };
              },
            },
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    };
  });

  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    from,
  } as unknown as ReturnType<typeof createSupabaseAdminClient>);

  return { updates, audits, emailProbes };
}

function editFormData(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    client_id: CURRENT_ROW.id,
    client_updated_at: CURRENT_ROW.updated_at,
    full_name: CURRENT_ROW.full_name,
    phone: CURRENT_ROW.phone,
    email: CURRENT_ROW.email,
    gender_preference: CURRENT_ROW.gender_preference,
    address: CURRENT_ROW.address,
    postcode: CURRENT_ROW.postcode,
    city: CURRENT_ROW.city,
    area: CURRENT_ROW.area,
    client_source: CURRENT_ROW.client_source,
    source_detail: "",
    notes: CURRENT_ROW.notes,
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

describe("updateClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets an identity-field manager change any field", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    const { updates, audits } = stubAdminClient();

    await updateClient(
      {},
      editFormData({
        full_name: "Sara Mohammed",
        email: "sara.mohammed@example.test",
        gender_preference: "female",
        phone: "07100 111 222",
      })
    );

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({
      full_name: "Sara Mohammed",
      email: "sara.mohammed@example.test",
      gender_preference: "female",
      phone: "07100 111 222",
    });
    expect(audits[0]).toMatchObject({
      action_type: "client_updated",
      target_type: "clients",
      target_id: "client-1",
      before_state: CURRENT_ROW,
      after_state: updates[0],
    });
    expect(redirect).toHaveBeenCalledWith("/admin/clients/client-1?updated=1");
  });

  // `report-data` and `dashboard-data` are the only cache tags this codebase
  // actually caches under. Invalidating a name nothing is tagged with is a
  // no-op, so a renamed client would keep showing its old name on the dashboard
  // and in reports until something else happened to bust those caches.
  it("invalidates the real report and dashboard cache tags", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    stubAdminClient();

    await updateClient({}, editFormData({ phone: "07999 888 777" }));

    // C-09 Phase B — resource tags (clients, audit) ride alongside the
    // pre-existing report-data/dashboard-data pair.
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
      "clients",
      "audit",
    ]);
  });

  it("lets a coordinator change operational fields", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(coordinator);
    const { updates } = stubAdminClient();

    await updateClient(
      {},
      editFormData({ phone: "07999 888 777", address: "2 New Street", notes: "" })
    );

    expect(updates[0]).toEqual({
      phone: "07999 888 777",
      address: "2 New Street",
      notes: null,
    });
    expect(redirect).toHaveBeenCalledWith("/admin/clients/client-1?updated=1");
  });

  it("drops identity edits from a coordinator's patch and audits only what changed", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(coordinator);
    const { updates, audits } = stubAdminClient();

    await updateClient(
      {},
      editFormData({
        // Operational — allowed.
        phone: "07999 888 777",
        // Identity — must never reach the database from a coordinator, even
        // when the payload is hand-crafted past the disabled inputs.
        full_name: "Renamed By Coordinator",
        email: "renamed@example.test",
        gender_preference: "male",
      })
    );

    expect(updates[0]).toEqual({ phone: "07999 888 777" });
    expect(audits[0].after_state).toEqual({ phone: "07999 888 777" });
  });

  it("strips a coordinator's identity fields before probing for an email collision", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(coordinator);
    const { updates, emailProbes } = stubAdminClient({
      emailClash: { id: "client-2", full_name: "Fatima Ahmed" },
    });

    await updateClient(
      {},
      editFormData({
        phone: "07999 888 777",
        // A coordinator cannot change the email, so a crafted colliding value
        // must never reach the probe. If the probe ran first it would answer
        // with a clash and the operator would see a spurious "Email already in
        // use" for an edit the server was going to discard anyway.
        email: "fatima@example.test",
      })
    );

    expect(emailProbes).toEqual([]);
    expect(updates[0]).toEqual({ phone: "07999 888 777" });
    expect(redirect).toHaveBeenCalledWith("/admin/clients/client-1?updated=1");
  });

  it("refuses an email already held by another client and writes nothing", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    const { updates, audits } = stubAdminClient({
      emailClash: { id: "client-2", full_name: "Fatima Ahmed" },
    });

    const result = await updateClient(
      {},
      editFormData({ email: "fatima@example.test" })
    );

    expect(result).toEqual({
      error: "Email already in use by Fatima Ahmed. Resolve manually.",
    });
    expect(updates).toHaveLength(0);
    expect(audits).toHaveLength(0);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("rejects a save built against a stale copy of the record", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    const { updates } = stubAdminClient();

    const result = await updateClient(
      {},
      editFormData({
        client_updated_at: "2026-06-30T09:00:00.000Z",
        phone: "07999 888 777",
      })
    );

    expect(result).toEqual({
      error: "This client was updated by someone else. Reload to see the latest.",
    });
    expect(updates).toHaveLength(0);
  });

  // The edit route 404s on a deleted client, but this action is `"use server"`
  // and therefore dispatchable on its own. A permitted actor POSTing straight at
  // it must not be able to resurrect an erased record's PII — neither in
  // `clients` nor in the `client_updated` audit row that would carry it.
  it("refuses to update a soft-deleted client and writes nothing", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    const { updates, audits } = stubAdminClient({
      current: { ...CURRENT_ROW, deleted_at: "2026-07-10T12:00:00.000Z" },
    });

    const result = await updateClient(
      {},
      editFormData({
        full_name: "Erased Person",
        email: "erased@example.test",
        phone: "07999 888 777",
      })
    );

    expect(result).toEqual({
      error: "This client has been deleted and can no longer be edited.",
    });
    expect(updates).toHaveLength(0);
    expect(audits).toHaveLength(0);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("refuses a therapist outright", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(therapist);
    const { updates } = stubAdminClient();

    const result = await updateClient({}, editFormData({ phone: "07999 888 777" }));

    expect(result).toEqual({ error: "Insufficient permissions." });
    expect(updates).toHaveLength(0);
  });
});
