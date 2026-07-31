import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractEmailAddress } from "@/lib/email/client";
import { resolveBusinessNotificationRecipients } from "../notifications";

/**
 * C-08 Phase D (plan §1 Step 14, brief §2.9). Direct coverage of the
 * resolver's decision table, independent of any one sender:
 *  - opted-in resolution (active Owner/Admin, `prefs.enabled === true`)
 *  - missing-`types` defaults to "all types on" — the Step 13 seed writes
 *    `{"enabled": true}` with NO `types` key, so a resolver testing
 *    `prefs.types[type] === false` must not read that as "all off"
 *  - per-type opt-out (`prefs.types[type] === false`)
 *  - skip-self (`excludeStaffId`)
 *  - `notification_email ?? email`
 *  - zero-opt-in-anywhere fallback to `getAdminRecipient`
 *  - emptied-NON-empty-list → `skipReason` (`all_recipients_opted_out` /
 *    `actor_excluded`), which is NOT the same outcome as the fallback
 */

vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn(),
  getFromEmail: vi.fn(() => "Rahma Therapy <no-reply@rahmatherapy.example.test>"),
  extractEmailAddress: vi.fn((value: string) => value),
}));

function staffRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "staff-owner",
    email: "owner@rahmatherapy.example.test",
    notification_email: null,
    business_notification_prefs: { enabled: true },
    roles: { name: "Owner" },
    ...overrides,
  };
}

function stubClient({
  staffProfiles = [],
  settings = { contact_email: "clinic@rahmatherapy.example.test" },
}: {
  staffProfiles?: Record<string, unknown>[];
  settings?: Record<string, unknown> | null;
}) {
  const from = vi.fn((table: string) => {
    if (table === "staff_profiles") {
      return {
        select: () => ({
          eq: () => ({
            returns: () => Promise.resolve({ data: staffProfiles, error: null }),
          }),
        }),
      };
    }
    if (table === "business_settings") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: settings, error: null }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table in resolver test: ${table}`);
  });

  return { from } as unknown as SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveBusinessNotificationRecipients — opted-in resolution", () => {
  it("returns every active Owner/Admin opted in, mapped to notification_email ?? email", async () => {
    const client = stubClient({
      staffProfiles: [
        staffRow({ id: "staff-owner", email: "owner@x.test", notification_email: "owner-alt@x.test" }),
        staffRow({
          id: "staff-admin",
          email: "admin@x.test",
          notification_email: null,
          roles: { name: "Admin" },
        }),
      ],
    });

    const result = await resolveBusinessNotificationRecipients(client, {
      type: "new_booking_request",
    });

    expect(result.skipReason).toBeNull();
    expect(result.recipients).toEqual(
      expect.arrayContaining([
        { staffId: "staff-owner", email: "owner-alt@x.test" },
        { staffId: "staff-admin", email: "admin@x.test" },
      ])
    );
    expect(result.recipients).toHaveLength(2);
  });

  it("ignores active non-Owner/Admin roles and inactive-implied rows not in the fetch", async () => {
    // The bulk query filters `active = true` at the DB level; this proves
    // the role filter in application code excludes a Coordinator/Therapist
    // row even if (hypothetically) it slipped into the result set opted in.
    const client = stubClient({
      staffProfiles: [
        staffRow({ id: "staff-coord", email: "coord@x.test", roles: { name: "Booking Coordinator" } }),
        staffRow({ id: "staff-owner" }),
      ],
    });

    const result = await resolveBusinessNotificationRecipients(client, {
      type: "new_booking_request",
    });

    expect(result.recipients).toEqual([{ staffId: "staff-owner", email: "owner@rahmatherapy.example.test" }]);
  });

  it("excludes an Owner/Admin row that hasn't opted in (prefs null or enabled !== true)", async () => {
    const client = stubClient({
      staffProfiles: [
        staffRow({ id: "staff-owner", business_notification_prefs: null }),
        staffRow({ id: "staff-admin", roles: { name: "Admin" }, business_notification_prefs: { enabled: false } }),
      ],
    });

    const result = await resolveBusinessNotificationRecipients(client, {
      type: "new_booking_request",
    });

    // Both rows are non-opted-in, so this is the zero-opt-in-anywhere case —
    // falls back to getAdminRecipient rather than returning an empty list.
    expect(result.recipients).toEqual([{ staffId: null, email: "clinic@rahmatherapy.example.test" }]);
    expect(result.skipReason).toBeNull();
  });
});

describe("resolveBusinessNotificationRecipients — missing-`types` trap", () => {
  it("treats a prefs object with NO `types` key as every type being on", async () => {
    // Byte-identical to the Step 13 seed: {"enabled": true}, no `types` key.
    const client = stubClient({ staffProfiles: [staffRow({ business_notification_prefs: { enabled: true } })] });

    const result = await resolveBusinessNotificationRecipients(client, {
      type: "slot_claimed",
    });

    expect(result.recipients).toEqual([{ staffId: "staff-owner", email: "owner@rahmatherapy.example.test" }]);
    expect(result.skipReason).toBeNull();
  });

  it("treats a prefs object with an empty `types` map the same way — still all on", async () => {
    const client = stubClient({
      staffProfiles: [staffRow({ business_notification_prefs: { enabled: true, types: {} } })],
    });

    const result = await resolveBusinessNotificationRecipients(client, {
      type: "slot_claimed",
    });

    expect(result.recipients).toHaveLength(1);
  });
});

describe("resolveBusinessNotificationRecipients — per-type opt-out", () => {
  it("excludes a recipient whose types map explicitly turns this type off", async () => {
    const client = stubClient({
      staffProfiles: [
        staffRow({
          id: "staff-owner",
          business_notification_prefs: { enabled: true, types: { slot_claimed: false } },
        }),
        staffRow({ id: "staff-admin", roles: { name: "Admin" } }), // no types key — stays on
      ],
    });

    const result = await resolveBusinessNotificationRecipients(client, {
      type: "slot_claimed",
    });

    expect(result.recipients).toEqual([{ staffId: "staff-admin", email: "owner@rahmatherapy.example.test" }]);
  });

  it("a per-type opt-out on ONE alert type does not affect a different type", async () => {
    const client = stubClient({
      staffProfiles: [
        staffRow({ business_notification_prefs: { enabled: true, types: { slot_claimed: false } } }),
      ],
    });

    const result = await resolveBusinessNotificationRecipients(client, {
      type: "booking_cancelled",
    });

    expect(result.recipients).toHaveLength(1);
  });

  it("writes all_recipients_opted_out (not the fallback) when per-type prefs empty a NON-empty opt-in list", async () => {
    const client = stubClient({
      staffProfiles: [
        staffRow({
          id: "staff-owner",
          business_notification_prefs: { enabled: true, types: { slot_claimed: false } },
        }),
      ],
    });

    const result = await resolveBusinessNotificationRecipients(client, {
      type: "slot_claimed",
    });

    expect(result.recipients).toEqual([]);
    expect(result.skipReason).toBe("all_recipients_opted_out");
  });
});

describe("resolveBusinessNotificationRecipients — skip-self", () => {
  it("excludes the acting staff id from an otherwise multi-recipient list", async () => {
    const client = stubClient({
      staffProfiles: [
        staffRow({ id: "staff-owner" }),
        staffRow({ id: "staff-admin", roles: { name: "Admin" } }),
      ],
    });

    const result = await resolveBusinessNotificationRecipients(client, {
      type: "enquiry_logged",
      excludeStaffId: "staff-admin",
    });

    expect(result.recipients).toEqual([{ staffId: "staff-owner", email: "owner@rahmatherapy.example.test" }]);
  });

  it("writes actor_excluded (not the fallback) when skip-self empties a NON-empty opt-in list", async () => {
    const client = stubClient({ staffProfiles: [staffRow({ id: "staff-owner" })] });

    const result = await resolveBusinessNotificationRecipients(client, {
      type: "enquiry_logged",
      excludeStaffId: "staff-owner",
    });

    expect(result.recipients).toEqual([]);
    expect(result.skipReason).toBe("actor_excluded");
  });

  it("no exclusion when excludeStaffId is omitted (customer-initiated events)", async () => {
    const client = stubClient({ staffProfiles: [staffRow({ id: "staff-owner" })] });

    const result = await resolveBusinessNotificationRecipients(client, {
      type: "reschedule_request",
    });

    expect(result.recipients).toHaveLength(1);
  });
});

describe("resolveBusinessNotificationRecipients — zero-opt-in-anywhere fallback", () => {
  it("falls back to getAdminRecipient(settings) when NO profile has ever opted in", async () => {
    const client = stubClient({ staffProfiles: [] });

    const result = await resolveBusinessNotificationRecipients(client, {
      type: "new_booking_request",
    });

    expect(result.recipients).toEqual([{ staffId: null, email: "clinic@rahmatherapy.example.test" }]);
    expect(result.skipReason).toBeNull();
  });

  it("resolves to no recipients and no skipReason when the fallback itself has nothing configured", async () => {
    // getAdminRecipient falls back to the from-address's local part when
    // contact_email is null — simulate the fully-unconfigured state by
    // making that fallback resolve empty too (same idiom as
    // sendClaimNotificationEmail.test.ts's equivalent case).
    vi.mocked(extractEmailAddress).mockReturnValueOnce("");
    const client = stubClient({ staffProfiles: [], settings: { contact_email: null } });

    const result = await resolveBusinessNotificationRecipients(client, {
      type: "new_booking_request",
    });

    expect(result.recipients).toEqual([]);
    expect(result.skipReason).toBeNull();
  });
});
