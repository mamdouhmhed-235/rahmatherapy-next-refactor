// C-15 Phase B — Step 8 tests for the extended preview route.
//
// GET: now resolves saved overrides (previously always hardcoded defaults)
// and covers all 16 registered templates via the shared SAMPLE_RENDERERS
// dispatch table (previously only 9 of 16).
// POST (new): auth parity with GET, unknown-template 404, unknown-field/
// oversize-value 400, draft merge wins over saved override, output
// contains sample data, draft values are never persisted.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffProfile } from "@/lib/auth/rbac";
import { GET, POST } from "../route";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

const { getStaffProfile } = await import("@/lib/auth/rbac");
const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");

function profile(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    id: "staff-1",
    auth_user_id: "auth-1",
    name: "Owner Test",
    email: "owner@example.test",
    role_id: "role-1",
    role_name: "Owner",
    gender: "female",
    active: true,
    can_take_bookings: false,
    availability_mode: "manual",
    permissions: new Set<string>(),
    ...overrides,
  };
}

// canSeePreview gates on canManageEmailSettings || canViewEmailLogs ||
// canResendBookingEmails — the route's pre-existing FAKE interim gate
// (comment at the top of route.ts), unchanged by C-15 Phase B.
// "manage_email_settings" here, NOT "manage_email_templates" (a different
// permission — MANAGE_EMAIL_TEMPLATES gates saves/resets in actions.ts).
const AUTHORIZED_PROFILE = profile({
  permissions: new Set(["manage_email_settings"]),
});

/** Stubs the one Supabase call resolveTemplateOverrides makes. */
function stubSavedOverrides(rows: { field_key: string; value: string }[] = []) {
  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: rows, error: null }),
      }),
    }),
  } as unknown as ReturnType<typeof createSupabaseAdminClient>);
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function getRequest(id: string) {
  return GET(new Request(`https://internal.invalid/admin/email-templates/preview/${id}`), ctx(id));
}

function postRequest(id: string, body: unknown) {
  return POST(
    new Request(`https://internal.invalid/admin/email-templates/preview/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    ctx(id)
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  stubSavedOverrides([]);
});

describe("auth parity between GET and POST", () => {
  it("GET returns 401 when unauthenticated", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(null);
    const res = await getRequest("booking_confirmation");
    expect(res.status).toBe(401);
  });

  it("POST returns 401 when unauthenticated", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(null);
    const res = await postRequest("booking_confirmation", { draftValues: {} });
    expect(res.status).toBe(401);
  });

  it("GET returns 403 for a profile with none of the qualifying permissions", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(profile());
    const res = await getRequest("booking_confirmation");
    expect(res.status).toBe(403);
  });

  it("POST returns 403 for a profile with none of the qualifying permissions", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(profile());
    const res = await postRequest("booking_confirmation", { draftValues: {} });
    expect(res.status).toBe(403);
  });

  it("POST accepts the same qualifying permissions GET does (view-only, not just manage)", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(
      profile({ permissions: new Set(["view_email_logs"]) })
    );
    const res = await postRequest("booking_confirmation", { draftValues: {} });
    expect(res.status).toBe(200);
  });
});

describe("GET — extended coverage + saved overrides", () => {
  beforeEach(() => {
    vi.mocked(getStaffProfile).mockResolvedValue(AUTHORIZED_PROFILE);
  });

  it("renders all 18 registered templates (previously only 9 of 16)", async () => {
    const ids = [
      "booking_confirmation",
      "booking_cancellation_client",
      "booking_reminder",
      "booking_plain_text",
      "staff_assignment",
      "staff_booking_change",
      "admin_booking_notification",
      "admin_booking_cancellation",
      "admin_reschedule_request",
      "review_request_client",
      "booking_confirmed_client",
      "staff_unassignment",
      "claim",
      "client_assigned_therapist",
      "enquiry_logged",
      "booking_restored_client",
      "recurring_series_created_client",
      "recurring_series_cancelled_client",
    ];
    for (const id of ids) {
      const res = await getRequest(id);
      const html = await res.text();
      expect(res.status, id).toBe(200);
      // Every one of the 16 renderers wraps its body in renderLayout's
      // <!doctype html> shell (or, for booking_plain_text, the plain-text
      // envelope) — the placeholder never does. Not every template's
      // default copy names the client or the company (e.g.
      // staff_booking_change's default wrapper is just the raw change
      // summary), so this checks real coverage without depending on wording
      // any one template happens to use.
      expect(html, id).not.toContain("Preview placeholder");
      expect(html, id).toContain("<!doctype html>");
      expect(html.length, id).toBeGreaterThan(200);
    }
  });

  it("reflects a saved override, not just the hardcoded default", async () => {
    stubSavedOverrides([
      { field_key: "greeting_intro", value: "Salaam {clientName}, saved override text." },
    ]);
    const res = await getRequest("booking_confirmation");
    const html = await res.text();
    expect(html).toContain("Salaam Aisha Khan, saved override text.");
  });

  it("falls back to the placeholder for a genuinely unknown id, not a 500", async () => {
    const res = await getRequest("not_a_real_template");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Preview placeholder");
  });
});

describe("POST — draft-preview handler", () => {
  beforeEach(() => {
    vi.mocked(getStaffProfile).mockResolvedValue(AUTHORIZED_PROFILE);
  });

  it("returns 404 for an unknown template", async () => {
    const res = await postRequest("not_a_real_template", { draftValues: {} });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/unknown template/i);
  });

  it("returns 400 for an unknown field key", async () => {
    const res = await postRequest("booking_confirmation", {
      draftValues: { not_a_real_field: "x" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when a field exceeds its registry maxLength", async () => {
    // greeting_intro's maxLength is 300.
    const res = await postRequest("booking_confirmation", {
      draftValues: { greeting_intro: "x".repeat(301) },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when draftValues isn't an object", async () => {
    const res = await postRequest("booking_confirmation", { draftValues: "not-an-object" });
    expect(res.status).toBe(400);
  });

  it("draft merge wins over a saved override for the same field", async () => {
    stubSavedOverrides([
      { field_key: "greeting_intro", value: "Salaam {clientName}, saved text." },
    ]);
    const res = await postRequest("booking_confirmation", {
      draftValues: { greeting_intro: "Draft text for {clientName}, unsaved." },
    });
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain("Draft text for Aisha Khan, unsaved.");
    expect(html).not.toContain("Salaam Aisha Khan, saved text.");
  });

  it("a field the draft doesn't mention keeps the saved override", async () => {
    stubSavedOverrides([
      { field_key: "greeting_intro", value: "Salaam {clientName}, saved text." },
    ]);
    const res = await postRequest("booking_confirmation", { draftValues: {} });
    const html = await res.text();
    expect(html).toContain("Salaam Aisha Khan, saved text.");
  });

  it("an empty-string draft value falls back to the registry default, not the still-saved override (C-15 Phase B fix, draft-merge path)", async () => {
    stubSavedOverrides([]);
    const baseline = await postRequest("booking_confirmation", { draftValues: {} });
    const htmlBaseline = await baseline.text();

    stubSavedOverrides([
      { field_key: "greeting_intro", value: "Salaam {clientName}, saved text." },
    ]);
    const clearedInEditor = await postRequest("booking_confirmation", {
      draftValues: { greeting_intro: "" },
    });
    const htmlCleared = await clearedInEditor.text();

    // Clearing the field in the editor (draft "") must render the registry
    // default — same as no saved override at all — not the still-saved
    // override, and not a blank paragraph.
    expect(htmlCleared).toBe(htmlBaseline);
    expect(htmlCleared).not.toContain("saved text");
  });

  it("output contains sample data, rendered through the real render function", async () => {
    const res = await postRequest("booking_confirmation", { draftValues: {} });
    const html = await res.text();
    expect(html).toContain("Aisha Khan");
    expect(html).toContain("Rahma Therapy");
  });

  it("a template whose extras aren't in SAMPLE_TEMPLATE_INPUT still renders (per-template extras, brief §5.10)", async () => {
    const res = await postRequest("staff_booking_change", { draftValues: {} });
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain("Time changed from 14:00 to 14:30.");
  });

  it("renders the plain_text template's draft through the same envelope GET uses", async () => {
    const res = await postRequest("booking_plain_text", {
      draftValues: { footer_contact: "Call us on 07000 000000." },
    });
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain("white-space:pre-wrap");
    expect(html).toContain("Call us on 07000 000000.");
  });

  it("never persists the draft — the stubbed admin client exposes no write method at all", async () => {
    // stubSavedOverrides wires only from().select().eq() — no insert/update/
    // upsert/delete. If this handler ever tried to persist the draft, that
    // call would throw ("... is not a function") and the response would be
    // a 500, not a 200. A 200 here is the strongest available proof this
    // request never asked the client to write anything.
    stubSavedOverrides([]);
    const res = await postRequest("booking_confirmation", {
      draftValues: { greeting_intro: "Unsaved draft text, never written." },
    });
    expect(res.status).toBe(200);
  });
});
