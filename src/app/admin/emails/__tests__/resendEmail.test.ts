import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  sendAssignedStaffBookingChangeEmails,
  sendBookingCancellationEmails,
  sendBookingConfirmedClientEmail,
  sendBookingCreatedEmails,
  sendBookingReminderEmail,
  sendStaffAssignmentEmail,
  sendStaffUnassignmentEmail,
} from "@/lib/email/notifications";
import { resendEmail } from "../actions";

/**
 * C-08 Phase C (plan §1 Step 11). Covers `resendEmail`'s RBAC gate, the
 * H11 `booking_assignments` scope check the plan's own sketch omitted
 * (progress file §3 item 1), the rate-limit's null-`booking_id` handling
 * (item 4), and `dispatchResend`'s honest subset — real resends for the
 * event types reconstructable from the delivery row alone, a structured
 * error for the ones that aren't (item 5).
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

vi.mock("@/lib/email/notifications", () => ({
  sendBookingCreatedEmails: vi.fn(),
  sendBookingCancellationEmails: vi.fn(),
  sendBookingReminderEmail: vi.fn(),
  sendStaffAssignmentEmail: vi.fn(),
  sendAssignedStaffBookingChangeEmails: vi.fn(),
  sendBookingConfirmedClientEmail: vi.fn(),
  sendStaffUnassignmentEmail: vi.fn(),
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
const coordinator = staff("Coordinator", []);
const therapist = staff("Therapist", [
  PERMISSIONS.RESEND_BOOKING_EMAILS,
  PERMISSIONS.VIEW_BOOKINGS_ASSIGNED,
]);

const ORIGINAL_EVENT = {
  id: "event-1",
  booking_id: "booking-1",
  event_type: "booking_reminder",
  recipient_email: "client@example.test",
  recipient_role: "customer",
  delivery_status: "accepted",
  staff_id: null as string | null,
  created_at: "2026-01-01T00:00:00.000Z",
};

interface Insert {
  table: string;
  row: Record<string, unknown>;
}

interface TrackedCall {
  method: string;
  args: unknown[];
}

// Thenable chain stub: every filter method returns itself so any call
// sequence (`.eq().eq()`, `.select().eq().gte().limit()`, ...) resolves to
// the same configured result, whether the caller terminates with
// `.maybeSingle()` or awaits the chain directly (the real Supabase query
// builder supports both, and `resendEmail` uses each style at different
// points).
function makeChain(
  resolve: () => unknown,
  record?: (call: TrackedCall) => void
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  const track =
    (method: string) =>
    (...args: unknown[]) => {
      record?.({ method, args });
      return chain;
    };
  chain.select = track("select");
  chain.eq = track("eq");
  chain.is = track("is");
  chain.gte = track("gte");
  chain.order = track("order");
  chain.limit = track("limit");
  chain.update = track("update");
  chain.maybeSingle = vi.fn(async () => resolve());
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(resolve()).then(onFulfilled, onRejected);
  return chain;
}

function stubAdminClient(opts: {
  original?: Record<string, unknown> | null;
  assignmentCount?: number;
  recentMatch?: Record<string, unknown> | null;
  newest?: Record<string, unknown> | null;
}) {
  const original = opts.original === undefined ? ORIGINAL_EVENT : opts.original;
  const inserts: Insert[] = [];
  const deliveryCalls: TrackedCall[][] = [];
  let deliveryCallIndex = 0;

  const from = vi.fn((table: string) => {
    if (table === "email_delivery_events") {
      deliveryCallIndex += 1;
      const callIndex = deliveryCallIndex;
      const calls: TrackedCall[] = [];
      deliveryCalls.push(calls);
      return makeChain(() => {
        if (callIndex === 1) return { data: original, error: null };
        if (callIndex === 2) return { data: opts.recentMatch ?? null, error: null };
        return { data: opts.newest ?? null, error: null };
      }, (call) => calls.push(call));
    }
    if (table === "booking_assignments") {
      return makeChain(() => ({
        count: opts.assignmentCount ?? 0,
        data: null,
        error: null,
      }));
    }
    if (table === "audit_logs" || table === "operational_events") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          inserts.push({ table, row });
          return { error: null };
        }),
      };
    }
    throw new Error(`Unexpected table in resendEmail test: ${table}`);
  });

  const client = { from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);

  return { inserts, deliveryCalls, client };
}

function formData(deliveryEventId = "event-1") {
  const data = new FormData();
  data.set("delivery_event_id", deliveryEventId);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendBookingCreatedEmails).mockReset().mockResolvedValue({ manageUrl: null });
  vi.mocked(sendBookingCancellationEmails).mockReset().mockResolvedValue(undefined);
  vi.mocked(sendBookingReminderEmail).mockReset().mockResolvedValue(undefined);
  vi.mocked(sendStaffAssignmentEmail).mockReset().mockResolvedValue(undefined);
  vi.mocked(sendAssignedStaffBookingChangeEmails).mockReset().mockResolvedValue(undefined);
  vi.mocked(sendBookingConfirmedClientEmail).mockReset().mockResolvedValue(undefined);
  vi.mocked(sendStaffUnassignmentEmail).mockReset().mockResolvedValue(undefined);
});

describe("resendEmail — RBAC", () => {
  it("refuses a profile without resend_booking_emails", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(coordinator);
    const stub = stubAdminClient({});

    const result = await resendEmail(formData());

    expect(result).toEqual({ ok: false, error: "Insufficient permissions." });
    expect(stub.client.from).not.toHaveBeenCalled();
  });

  it("refuses an inactive profile even with the permission", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue({ ...owner, active: false });
    stubAdminClient({});

    const result = await resendEmail(formData());
    expect(result).toEqual({ ok: false, error: "Insufficient permissions." });
  });
});

describe("resendEmail — event lookup", () => {
  beforeEach(() => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
  });

  it("errors when the delivery event id is missing", async () => {
    const result = await resendEmail(new FormData());
    expect(result).toEqual({ ok: false, error: "Delivery event is required." });
  });

  it("errors when the event isn't found", async () => {
    stubAdminClient({ original: null });
    const result = await resendEmail(formData());
    expect(result).toEqual({ ok: false, error: "Delivery event not found." });
  });

  it("refuses to resend a skipped event", async () => {
    stubAdminClient({
      original: { ...ORIGINAL_EVENT, delivery_status: "skipped" },
    });
    const result = await resendEmail(formData());
    expect(result).toEqual({
      ok: false,
      error: "Skipped events have no content to resend.",
    });
  });
});

describe("resendEmail — booking_assignments scope check (H11 middle path)", () => {
  it("refuses a Therapist-class actor with no assignment on the booking", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(therapist);
    const stub = stubAdminClient({ assignmentCount: 0 });

    const result = await resendEmail(formData());

    expect(result).toEqual({
      ok: false,
      error: "You can only resend emails for bookings assigned to you.",
    });
    expect(stub.inserts.some((i) => i.table === "operational_events")).toBe(true);
    expect(sendBookingReminderEmail).not.toHaveBeenCalled();
  });

  it("allows a Therapist-class actor with a matching assignment", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(therapist);
    stubAdminClient({ assignmentCount: 1, newest: { id: "event-2" } });

    const result = await resendEmail(formData());

    expect(result.ok).toBe(true);
    expect(sendBookingReminderEmail).toHaveBeenCalledWith("booking-1", expect.anything());
  });

  it("refuses a Therapist-class actor outright when the event has no booking_id, without querying booking_assignments", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(therapist);
    const stub = stubAdminClient({
      original: { ...ORIGINAL_EVENT, booking_id: null },
    });

    const result = await resendEmail(formData());

    expect(result.ok).toBe(false);
    expect(stub.client.from).not.toHaveBeenCalledWith("booking_assignments");
  });

  it("skips the assignment check entirely for Owner/Admin-class actors", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    const stub = stubAdminClient({ newest: { id: "event-2" } });

    await resendEmail(formData());

    expect(stub.client.from).not.toHaveBeenCalledWith("booking_assignments");
  });
});

describe("resendEmail — rate limit", () => {
  beforeEach(() => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
  });

  it("rejects a resend within the rate-limit window", async () => {
    stubAdminClient({ recentMatch: { id: "event-recent" } });

    const result = await resendEmail(formData());

    expect(result).toEqual({
      ok: false,
      error: "Recently sent. Try again in 60 seconds.",
    });
    expect(sendBookingReminderEmail).not.toHaveBeenCalled();
  });

  it("uses IS NULL semantics for a null booking_id, not eq(booking_id, null)", async () => {
    const stub = stubAdminClient({
      original: { ...ORIGINAL_EVENT, booking_id: null },
      recentMatch: { id: "event-recent" },
    });

    const result = await resendEmail(formData());

    // The rate-limit query is the 2nd email_delivery_events call (1st is the
    // original-event fetch).
    const rateLimitCalls = stub.deliveryCalls[1];
    expect(rateLimitCalls).toContainEqual({ method: "is", args: ["booking_id", null] });
    expect(
      rateLimitCalls.some((c) => c.method === "eq" && c.args[0] === "booking_id")
    ).toBe(false);
    // The correctly-targeted query still finds the match — proving this
    // isn't just "the rate limit gave up", but genuinely caught the repeat.
    expect(result.ok).toBe(false);
  });

  it("uses eq(booking_id, ...) when booking_id is present", async () => {
    const stub = stubAdminClient({ recentMatch: { id: "event-recent" } });

    await resendEmail(formData());

    const rateLimitCalls = stub.deliveryCalls[1];
    expect(rateLimitCalls).toContainEqual({ method: "eq", args: ["booking_id", "booking-1"] });
    expect(rateLimitCalls.some((c) => c.method === "is")).toBe(false);
  });
});

describe("resendEmail — dispatch by event type", () => {
  beforeEach(() => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
  });

  it("resends booking_confirmation via sendBookingCreatedEmails", async () => {
    stubAdminClient({
      original: { ...ORIGINAL_EVENT, event_type: "booking_confirmation" },
      newest: { id: "event-2" },
    });

    const result = await resendEmail(formData());

    expect(result.ok).toBe(true);
    expect(sendBookingCreatedEmails).toHaveBeenCalledWith("booking-1", expect.anything());
  });

  it.each(["booking_cancellation_customer", "booking_cancellation_admin"])(
    "resends %s via sendBookingCancellationEmails",
    async (eventType) => {
      stubAdminClient({
        original: { ...ORIGINAL_EVENT, event_type: eventType },
        newest: { id: "event-2" },
      });

      const result = await resendEmail(formData());

      expect(result.ok).toBe(true);
      expect(sendBookingCancellationEmails).toHaveBeenCalledWith(
        "booking-1",
        expect.anything(),
        { initiatedBy: "admin" }
      );
    }
  );

  it("resends staff_assignment using the row's recipient_email and staff_id", async () => {
    stubAdminClient({
      original: {
        ...ORIGINAL_EVENT,
        event_type: "staff_assignment",
        recipient_email: "staff@example.test",
        staff_id: "staff-99",
      },
      newest: { id: "event-2" },
    });

    const result = await resendEmail(formData());

    expect(result.ok).toBe(true);
    expect(sendStaffAssignmentEmail).toHaveBeenCalledWith(
      "booking-1",
      "staff@example.test",
      expect.anything(),
      "staff-99"
    );
  });

  it("resends staff_unassignment using the row's staff_id", async () => {
    stubAdminClient({
      original: {
        ...ORIGINAL_EVENT,
        event_type: "staff_unassignment",
        staff_id: "staff-42",
      },
      newest: { id: "event-2" },
    });

    const result = await resendEmail(formData());

    expect(result.ok).toBe(true);
    expect(sendStaffUnassignmentEmail).toHaveBeenCalledWith(
      "booking-1",
      "staff-42",
      expect.anything()
    );
  });

  it("refuses staff_unassignment resend when the row has no staff_id", async () => {
    stubAdminClient({
      original: {
        ...ORIGINAL_EVENT,
        event_type: "staff_unassignment",
        staff_id: null,
      },
    });

    const result = await resendEmail(formData());

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unassigned staff member isn't recorded/);
    expect(sendStaffUnassignmentEmail).not.toHaveBeenCalled();
  });

  it("resends staff_booking_change with a generic resend message", async () => {
    stubAdminClient({
      original: { ...ORIGINAL_EVENT, event_type: "staff_booking_change" },
      newest: { id: "event-2" },
    });

    const result = await resendEmail(formData());

    expect(result.ok).toBe(true);
    expect(sendAssignedStaffBookingChangeEmails).toHaveBeenCalledWith(
      "booking-1",
      expect.anything(),
      "Resent change notification."
    );
  });

  it("resends booking_confirmed_client", async () => {
    stubAdminClient({
      original: { ...ORIGINAL_EVENT, event_type: "booking_confirmed_client" },
      newest: { id: "event-2" },
    });

    const result = await resendEmail(formData());

    expect(result.ok).toBe(true);
    expect(sendBookingConfirmedClientEmail).toHaveBeenCalledWith(
      "booking-1",
      expect.anything()
    );
  });

  it("refuses a review-request resend with a reason, rather than the raw event type", async () => {
    // Before this case existed the switch fell through to `default`, so the
    // admin saw "Cannot resend event type: review_request_client" — accurate
    // but written for a developer. It must also stay a REFUSAL: routing it to
    // sendReviewRequestEmail would hit the per-booking sentinel, send nothing,
    // and still report success, because dispatchResend returns void.
    stubAdminClient({
      original: { ...ORIGINAL_EVENT, event_type: "review_request_client" },
    });

    const result = await resendEmail(formData());

    expect(result.ok).toBe(false);
    expect(result.error).toBe(
      "Resend isn't supported for review requests — each booking is only ever asked once."
    );
  });

  it.each(["claim", "client_assigned_therapist"])(
    "returns a structured error for %s instead of silently sending nothing",
    async (eventType) => {
      stubAdminClient({ original: { ...ORIGINAL_EVENT, event_type: eventType } });

      const result = await resendEmail(formData());

      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toMatch(/isn't recorded/);
      expect(sendBookingCreatedEmails).not.toHaveBeenCalled();
    }
  );

  it("returns a structured error for an unrecognised event type", async () => {
    stubAdminClient({
      original: { ...ORIGINAL_EVENT, event_type: "admin_booking_notification" },
    });

    const result = await resendEmail(formData());

    expect(result).toEqual({
      ok: false,
      error: "Cannot resend event type: admin_booking_notification",
    });
  });
});

describe("resendEmail — happy path", () => {
  beforeEach(() => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
  });

  it("dispatches, records the audit_logs linkage, and returns the new event id", async () => {
    const stub = stubAdminClient({ newest: { id: "event-2" } });

    const result = await resendEmail(formData());

    expect(result).toEqual({ ok: true, newEventId: "event-2" });
    expect(sendBookingReminderEmail).toHaveBeenCalledWith("booking-1", stub.client);

    const audit = stub.inserts.find((i) => i.table === "audit_logs");
    expect(audit?.row).toMatchObject({
      actor_staff_id: owner.id,
      action_type: "email_resent",
      target_type: "email_delivery_events",
      target_id: "event-2",
      after_state: {
        resent_from: "event-1",
        event_type: "booking_reminder",
        recipient_email: "client@example.test",
      },
    });
    // C-08 Phase D Step 13 landed `email_delivery_events.metadata` — the
    // resend now stamps the linkage on the new delivery-event row itself
    // (previously this spec asserted the opposite: that no metadata write
    // happened at all, because the column didn't exist yet).
    const metadataUpdateCalls = stub.deliveryCalls[3];
    expect(metadataUpdateCalls).toContainEqual({
      method: "update",
      args: [{ metadata: { resent_from_event_id: "event-1" } }],
    });
    expect(metadataUpdateCalls).toContainEqual({ method: "eq", args: ["id", "event-2"] });

    // C-09 Phase B fix round — Step 3 spec coverage: this file mocked
    // updateTag but never asserted which tags were actually passed.
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "emails",
      "audit",
    ]);
  });

  it("returns ok:true with no newEventId when the resent row can't be found, without throwing", async () => {
    stubAdminClient({ newest: null });

    const result = await resendEmail(formData());

    expect(result).toEqual({ ok: true, newEventId: undefined });
  });
});
