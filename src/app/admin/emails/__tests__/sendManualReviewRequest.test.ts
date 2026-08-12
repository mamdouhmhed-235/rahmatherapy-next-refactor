import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendReviewRequestEmail } from "@/lib/email/notifications";
import { sendManualReviewRequest } from "../actions";

/**
 * Item 1 Batch B (plan §1.7/§1.12). Covers the RBAC gate, the H11
 * `booking_assignments` scope check, the rate limit, the cooldown bypass, the
 * `automated: false` audit row, and the deliberate absence of a quiet-hours
 * gate.
 *
 * The operational-event assertions here check the event's CONTENT (type,
 * severity, booking id, staff id), not merely that a row was written —
 * `resendEmail.test.ts`'s equivalent test asserts only
 * `inserts.some(i => i.table === "operational_events")`, which would pass with
 * every field wrong. That gap is what these fill.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

// Only the profile lookup is stubbed — the permission + scope helpers stay
// real so the action is gated exactly as it is in production.
vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

// Spread the real module and override only the sender, rather than listing
// every export by hand. A hand-listed factory that forgets an export the
// action imports yields `undefined` at the call site — loud, but avoidable.
vi.mock("@/lib/email/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/notifications")>()),
  sendReviewRequestEmail: vi.fn(),
}));

// Defence in depth. Nothing here should reach the transport — the sender
// itself is mocked above — but spreading the real notifications module pulls
// client.ts into the graph, and `sendEmail` there is an unguarded wrapper over
// the real Resend SDK with a live API key in this environment.
vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn(),
  getFromEmail: vi.fn(() => "Rahma Therapy <no-reply@rahmatherapy.example.test>"),
  extractEmailAddress: vi.fn((value: string) => value),
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

const owner = staff("Owner", [
  PERMISSIONS.RESEND_BOOKING_EMAILS,
  PERMISSIONS.VIEW_BOOKINGS_ALL,
]);
// Deliberately holds VIEW_BOOKINGS_ALL. Without it, this actor would also
// fail the H11 scope check, and the permission test below would pass for the
// wrong reason — proven toothless by mutation before this fixture was widened.
const noPermission = staff("Reception", [PERMISSIONS.VIEW_BOOKINGS_ALL]);
const therapist = staff("Therapist", [
  PERMISSIONS.RESEND_BOOKING_EMAILS,
  PERMISSIONS.VIEW_BOOKINGS_ASSIGNED,
]);

const BOOKING_ID = "booking-1";

interface Insert {
  table: string;
  row: Record<string, unknown>;
}

function makeChain(resolve: () => unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  const passthrough = ["select", "eq", "is", "gte", "order", "limit"];
  for (const method of passthrough) {
    chain[method] = () => chain;
  }
  chain.maybeSingle = vi.fn(async () => resolve());
  chain.then = (
    onFulfilled: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown
  ) => Promise.resolve(resolve()).then(onFulfilled, onRejected);
  return chain;
}

function stubAdminClient(opts: {
  assignmentCount?: number;
  recentSend?: Record<string, unknown> | null;
} = {}) {
  const inserts: Insert[] = [];

  const from = vi.fn((table: string) => {
    if (table === "booking_assignments") {
      return makeChain(() => ({
        count: opts.assignmentCount ?? 0,
        data: null,
        error: null,
      }));
    }
    if (table === "email_delivery_events") {
      return makeChain(() => ({ data: opts.recentSend ?? null, error: null }));
    }
    if (table === "audit_logs" || table === "operational_events") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          inserts.push({ table, row });
          return { error: null };
        }),
      };
    }
    throw new Error(`Unexpected table in sendManualReviewRequest test: ${table}`);
  });

  const client = { from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);
  return { inserts, client };
}

function formData(bookingId: string = BOOKING_ID) {
  const data = new FormData();
  data.set("booking_id", bookingId);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.mocked(getStaffProfile).mockResolvedValue(owner);
  vi.mocked(sendReviewRequestEmail).mockResolvedValue({ sent: true });
});

describe("sendManualReviewRequest", () => {
  it("refuses without resend_booking_emails permission", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(noPermission);
    stubAdminClient();

    const result = await sendManualReviewRequest(formData());

    // The exact message matters: it proves the refusal came from the
    // permission gate, not from the scope check further down.
    expect(result).toEqual({
      ok: false,
      error: "You can't send review requests.",
    });
    expect(sendReviewRequestEmail).not.toHaveBeenCalled();
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("refuses an unassigned Therapist-class actor and records a failed_review_request_attempt with the booking and staff ids", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(therapist);
    const stub = stubAdminClient({ assignmentCount: 0 });

    const result = await sendManualReviewRequest(formData());

    expect(result).toEqual({
      ok: false,
      error: "You can only send review requests for bookings assigned to you.",
    });
    expect(sendReviewRequestEmail).not.toHaveBeenCalled();

    const events = stub.inserts.filter((i) => i.table === "operational_events");
    expect(events).toHaveLength(1);
    expect(events[0].row).toMatchObject({
      event_type: "failed_review_request_attempt",
      severity: "warning",
      booking_id: BOOKING_ID,
      staff_id: therapist.id,
    });
  });

  it("allows an assigned Therapist-class actor", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(therapist);
    const stub = stubAdminClient({ assignmentCount: 1 });

    const result = await sendManualReviewRequest(formData());

    expect(result).toEqual({ ok: true });
    expect(sendReviewRequestEmail).toHaveBeenCalledTimes(1);
    expect(stub.inserts.filter((i) => i.table === "operational_events")).toHaveLength(0);
  });

  it("bypasses the 6-month client cooldown but still respects the per-booking sentinel", async () => {
    stubAdminClient();

    await sendManualReviewRequest(formData());

    // The bypass is the whole point of the manual send.
    expect(sendReviewRequestEmail).toHaveBeenCalledWith(
      BOOKING_ID,
      expect.anything(),
      { ignoreClientCooldown: true }
    );

    // ...but the sentinel still wins. `sendReviewRequestEmail` owns that
    // check; the action must surface its refusal rather than override it.
    vi.mocked(sendReviewRequestEmail).mockResolvedValue({
      sent: false,
      reason: "already_sent",
    });
    const stub = stubAdminClient();

    const blocked = await sendManualReviewRequest(formData());

    expect(blocked).toEqual({
      ok: false,
      error: "A review request has already been sent for this booking.",
    });
    expect(stub.inserts.filter((i) => i.table === "audit_logs")).toHaveLength(0);
  });

  it("respects RESEND_RATE_LIMIT_SECONDS", async () => {
    const stub = stubAdminClient({ recentSend: { id: "event-recent" } });

    const result = await sendManualReviewRequest(formData());

    expect(result).toEqual({
      ok: false,
      error: "Recently sent. Try again in 60 seconds.",
    });
    expect(sendReviewRequestEmail).not.toHaveBeenCalled();
    expect(stub.inserts).toHaveLength(0);
  });

  it("writes an audit row with automated: false", async () => {
    const stub = stubAdminClient();

    await sendManualReviewRequest(formData());

    const audits = stub.inserts.filter((i) => i.table === "audit_logs");
    expect(audits).toHaveLength(1);
    expect(audits[0].row).toMatchObject({
      actor_staff_id: owner.id,
      action_type: "review_email_sent",
      target_type: "bookings",
      target_id: BOOKING_ID,
      after_state: { booking_id: BOOKING_ID, automated: false },
    });
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "emails",
      "audit",
    ]);
  });

  it("is not subject to the cron's quiet-hours guard", async () => {
    // 02:00 Europe/London sits inside the cron's 21:00–08:00 suppression
    // window. A human choosing to send now overrides that heuristic by
    // design (Owner decision, 2026-08-11) — asserted rather than assumed, so
    // nobody later "fixes" the manual path by adding a gate to it.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T01:00:00.000Z"));
    try {
      stubAdminClient();

      const result = await sendManualReviewRequest(formData());

      expect(result).toEqual({ ok: true });
      expect(sendReviewRequestEmail).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses an empty booking id without touching the database", async () => {
    const stub = stubAdminClient();

    const result = await sendManualReviewRequest(new FormData());

    expect(result).toEqual({ ok: false, error: "No booking selected." });
    expect(sendReviewRequestEmail).not.toHaveBeenCalled();
    expect(stub.inserts).toHaveLength(0);
  });

  it("reports a thrown send as an operational event and a clean error, without an audit row", async () => {
    vi.mocked(sendReviewRequestEmail).mockRejectedValue(new Error("Resend is down."));
    const stub = stubAdminClient();

    const result = await sendManualReviewRequest(formData());

    expect(result).toEqual({ ok: false, error: "Couldn't send the review request." });
    expect(stub.inserts.filter((i) => i.table === "audit_logs")).toHaveLength(0);
    const events = stub.inserts.filter((i) => i.table === "operational_events");
    expect(events).toHaveLength(1);
    expect(events[0].row).toMatchObject({
      event_type: "failed_review_request_attempt",
      severity: "error",
      booking_id: BOOKING_ID,
      staff_id: owner.id,
    });
    expect(updateTag).not.toHaveBeenCalled();
  });
});
