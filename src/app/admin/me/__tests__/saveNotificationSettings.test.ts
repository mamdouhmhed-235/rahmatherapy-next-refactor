import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { saveNotificationSettings } from "../actions";

/**
 * C-08 Phase D Step 18 (plan §1 Step 18) — `saveNotificationSettings` specs.
 * Covers the role gate (Owner/Admin via `manage_email_templates`, confirmed
 * Owner+Admin-only at C-08 pre-flight §0.8), the self-only write (the row id
 * always comes from the resolved session profile, never the form), email
 * format validation with empty allowed, the audit row shape, and the
 * disabled-checkbox-preserves-prior-types behaviour (progress file's
 * `prefs.types` trap, applied to the write side).
 */

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

// Only the profile lookup is stubbed — the permission helper stays real so
// the action is gated exactly as it is in production.
vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

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
  } as StaffProfile;
}

const owner = staff("Owner", [PERMISSIONS.MANAGE_EMAIL_TEMPLATES]);
const coordinator = staff("Coordinator", []);

interface Insert {
  table: string;
  row: Record<string, unknown>;
}

interface UpdateCall {
  table: string;
  payload: Record<string, unknown>;
  eqCalls: [string, unknown][];
}

function stubAdminClient(opts: {
  beforeRow?: Record<string, unknown> | null;
  updateError?: { message: string } | null;
}) {
  const beforeRow =
    opts.beforeRow === undefined
      ? { notification_email: null, business_notification_prefs: null }
      : opts.beforeRow;
  const inserts: Insert[] = [];
  const updates: UpdateCall[] = [];

  const from = vi.fn((table: string) => {
    if (table === "staff_profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: beforeRow, error: null })),
          })),
        })),
        update: vi.fn((payload: Record<string, unknown>) => {
          const eqCalls: [string, unknown][] = [];
          const chain = {
            eq: vi.fn((col: string, val: unknown) => {
              eqCalls.push([col, val]);
              updates.push({ table, payload, eqCalls });
              return Promise.resolve({
                error: opts.updateError ?? null,
              });
            }),
          };
          return chain;
        }),
      };
    }
    if (table === "audit_logs") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          inserts.push({ table, row });
          return { error: null };
        }),
      };
    }
    throw new Error(`Unexpected table in saveNotificationSettings test: ${table}`);
  });

  const client = { from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);

  return { inserts, updates, client };
}

function formData(fields: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveNotificationSettings — role gate", () => {
  it("refuses a profile without manage_email_templates", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(coordinator);
    const stub = stubAdminClient({});

    const result = await saveNotificationSettings({}, formData());

    expect(result).toEqual({ error: "Insufficient permissions." });
    expect(stub.client.from).not.toHaveBeenCalled();
  });

  it("refuses an inactive profile even with the permission", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue({ ...owner, active: false });
    const stub = stubAdminClient({});

    const result = await saveNotificationSettings({}, formData());

    expect(result).toEqual({ error: "Insufficient permissions." });
    expect(stub.client.from).not.toHaveBeenCalled();
  });

  it("refuses when there is no session", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(null);
    const stub = stubAdminClient({});

    const result = await saveNotificationSettings({}, formData());

    expect(result).toEqual({ error: "Insufficient permissions." });
    expect(stub.client.from).not.toHaveBeenCalled();
  });
});

describe("saveNotificationSettings — email validation", () => {
  beforeEach(() => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
  });

  it("rejects a malformed email", async () => {
    stubAdminClient({});

    const result = await saveNotificationSettings(
      {},
      formData({ notification_email: "not-an-email" })
    );

    expect(result).toEqual({ error: "Enter a valid email address." });
  });

  it("allows an empty email (falls back to login email at send time)", async () => {
    const stub = stubAdminClient({});

    const result = await saveNotificationSettings({}, formData({ notification_email: "" }));

    expect(result).toEqual({ success: true });
    expect(stub.updates[0].payload).toMatchObject({ notification_email: null });
  });

  it("accepts a well-formed email", async () => {
    const stub = stubAdminClient({});

    const result = await saveNotificationSettings(
      {},
      formData({ notification_email: "owner@rahmatherapy.example.test" })
    );

    expect(result).toEqual({ success: true });
    expect(stub.updates[0].payload).toMatchObject({
      notification_email: "owner@rahmatherapy.example.test",
    });
  });
});

describe("saveNotificationSettings — self-only write", () => {
  it("scopes the update to the actor's own profile id, never a form-supplied id", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    const stub = stubAdminClient({});

    await saveNotificationSettings(
      {},
      formData({ notification_email: "", target_staff_id: "someone-else" })
    );

    expect(stub.updates[0].eqCalls).toEqual([["id", owner.id]]);
  });
});

describe("saveNotificationSettings — per-type prefs", () => {
  beforeEach(() => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
  });

  it("stores only explicit opt-outs when the master toggle is on", async () => {
    const stub = stubAdminClient({});

    await saveNotificationSettings(
      {},
      formData({
        notification_email: "",
        enabled: "on",
        type_new_booking_request: "on",
        type_booking_cancelled: "on",
        // reschedule_request, enquiry_logged, slot_claimed left unchecked
      })
    );

    expect(stub.updates[0].payload).toMatchObject({
      business_notification_prefs: {
        enabled: true,
        types: {
          reschedule_request: false,
          enquiry_logged: false,
          slot_claimed: false,
        },
      },
    });
  });

  it("writes {enabled:true} with no types key when every type is checked", async () => {
    const stub = stubAdminClient({});

    await saveNotificationSettings(
      {},
      formData({
        notification_email: "",
        enabled: "on",
        type_new_booking_request: "on",
        type_booking_cancelled: "on",
        type_reschedule_request: "on",
        type_enquiry_logged: "on",
        type_slot_claimed: "on",
      })
    );

    expect(stub.updates[0].payload).toMatchObject({
      business_notification_prefs: { enabled: true },
    });
    const prefs = stub.updates[0].payload.business_notification_prefs as Record<
      string,
      unknown
    >;
    expect(prefs.types).toBeUndefined();
  });

  it("preserves the previously-stored types when saving with the master toggle off", async () => {
    // The per-type checkboxes are `disabled` in the UI while the toggle is
    // off, so a real submit never carries `type_*` fields in this case —
    // the action must not read that absence as "opt out of everything".
    const stub = stubAdminClient({
      beforeRow: {
        notification_email: null,
        business_notification_prefs: {
          enabled: true,
          types: { slot_claimed: false },
        },
      },
    });

    await saveNotificationSettings({}, formData({ notification_email: "" }));

    expect(stub.updates[0].payload).toMatchObject({
      business_notification_prefs: {
        enabled: false,
        types: { slot_claimed: false },
      },
    });
  });

  it("writes {enabled:false} with no types key when nothing was ever stored", async () => {
    const stub = stubAdminClient({
      beforeRow: { notification_email: null, business_notification_prefs: null },
    });

    await saveNotificationSettings({}, formData({ notification_email: "" }));

    expect(stub.updates[0].payload).toMatchObject({
      business_notification_prefs: { enabled: false },
    });
    const prefs = stub.updates[0].payload.business_notification_prefs as Record<
      string,
      unknown
    >;
    expect(prefs.types).toBeUndefined();
  });
});

describe("saveNotificationSettings — audit row", () => {
  it("writes notification_settings_updated with before/after state", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    const stub = stubAdminClient({
      beforeRow: { notification_email: "old@rahmatherapy.example.test", business_notification_prefs: null },
    });

    await saveNotificationSettings(
      {},
      formData({ notification_email: "new@rahmatherapy.example.test", enabled: "on" })
    );

    const audit = stub.inserts.find((i) => i.table === "audit_logs");
    expect(audit?.row).toMatchObject({
      actor_staff_id: owner.id,
      action_type: "notification_settings_updated",
      target_type: "staff_profiles",
      target_id: owner.id,
      before_state: {
        notification_email: "old@rahmatherapy.example.test",
        business_notification_prefs: null,
      },
      after_state: {
        notification_email: "new@rahmatherapy.example.test",
        business_notification_prefs: { enabled: true },
      },
    });
  });

  it("surfaces a Supabase update error instead of writing an audit row", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    const stub = stubAdminClient({ updateError: { message: "42501" } });

    const result = await saveNotificationSettings({}, formData({ notification_email: "" }));

    expect(result).toEqual({ error: "Failed to save notification settings." });
    expect(stub.inserts.some((i) => i.table === "audit_logs")).toBe(false);
  });
});
