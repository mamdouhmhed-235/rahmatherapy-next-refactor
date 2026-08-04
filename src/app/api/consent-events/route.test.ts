// C-18 Phase E Step 10 — the consent-proof logging route. Locked posture: this
// endpoint ALWAYS answers 204, whatever happened underneath (valid insert,
// malformed shape, unknown banner_version, oversized body, or a DB error) — so
// every test here asserts on side effects (was an insert attempted? did
// console.error fire?) rather than on the response body, which never
// distinguishes success from failure by design (no probe oracle).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CONSENT_BANNER_VERSION } from "@/lib/consent/cookie-registry";
import { POST } from "./route";

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

const insert = vi.fn();
const from = vi.fn(() => ({ insert }));

const validBody = {
  consent_id: "3f1d5f6e-1c2b-4a3d-9e8f-0a1b2c3d4e5f",
  banner_version: CONSENT_BANNER_VERSION,
  purposes_offered: ["analytics", "functional"],
  choices: { analytics: true, functional: false },
  action: "granted",
};

function postEvent(body: unknown, headers: Record<string, string> = {}) {
  const rawBody = typeof body === "string" ? body : JSON.stringify(body);
  return POST(
    new Request("http://localhost/api/consent-events/", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: rawBody,
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  insert.mockResolvedValue({ error: null });
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ from } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/consent-events", () => {
  it("always answers 204 on a valid payload", async () => {
    const response = await postEvent(validBody);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("inserts exactly the validated fields, with no .select() chained", async () => {
    // The mocked query builder only ever exposes .insert(), which resolves
    // directly to { error } — no chainable .select(). If the route called
    // .select() on the result, that would throw a TypeError, get caught by
    // the route's own try/catch, and log "insert threw" instead of leaving
    // console.error untouched — this pins that the happy path stays clean.
    const response = await postEvent(validBody);

    expect(from).toHaveBeenCalledWith("consent_events");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({
      consent_id: validBody.consent_id,
      banner_version: validBody.banner_version,
      purposes_offered: validBody.purposes_offered,
      choices: validBody.choices,
      action: validBody.action,
    });
    expect(response.status).toBe(204);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("204s on a malformed shape and never attempts an insert", async () => {
    const response = await postEvent({ nonsense: true });

    expect(response.status).toBe(204);
    expect(insert).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("204s on invalid JSON and never attempts an insert", async () => {
    const response = await postEvent("{not valid json");

    expect(response.status).toBe(204);
    expect(insert).not.toHaveBeenCalled();
  });

  it("204s on an unknown banner_version and never attempts an insert", async () => {
    const response = await postEvent({
      ...validBody,
      banner_version: "2000-01-01.1",
    });

    expect(response.status).toBe(204);
    expect(insert).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      "[consent-events] dropped: unknown banner_version",
      "2000-01-01.1"
    );
  });

  it("204s on an action outside the four the migration's CHECK constraint allows", async () => {
    const response = await postEvent({ ...validBody, action: "maybe" });

    expect(response.status).toBe(204);
    expect(insert).not.toHaveBeenCalled();
  });

  it("204s when consent_id is not a uuid", async () => {
    const response = await postEvent({ ...validBody, consent_id: "not-a-uuid" });

    expect(response.status).toBe(204);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an oversized body cheaply via Content-Length, before reading it", async () => {
    const response = await postEvent(validBody, {
      "content-length": String(10 * 1024 * 1024),
    });

    expect(response.status).toBe(204);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an oversized body even when Content-Length is missing or wrong", async () => {
    const oversized = {
      ...validBody,
      choices: { analytics: true, functional: false, junk: "x".repeat(8192) },
    };
    // No Content-Length header at all — the actual-body-length check has to
    // catch it on its own.
    const response = await POST(
      new Request("http://localhost/api/consent-events/", {
        method: "POST",
        body: JSON.stringify(oversized),
      })
    );

    expect(response.status).toBe(204);
    expect(insert).not.toHaveBeenCalled();
  });

  it("204s and logs, without throwing, on a DB error", async () => {
    insert.mockResolvedValue({
      error: { code: "42501", message: "permission denied for table consent_events" },
    });

    const response = await postEvent(validBody);

    expect(response.status).toBe(204);
    expect(console.error).toHaveBeenCalledWith(
      "[consent-events] insert failed",
      expect.objectContaining({ code: "42501" })
    );
  });

  it("204s and logs, without throwing, when the admin client itself throws", async () => {
    vi.mocked(createSupabaseAdminClient).mockImplementation(() => {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    });

    const response = await postEvent(validBody);

    expect(response.status).toBe(204);
    expect(console.error).toHaveBeenCalledWith(
      "[consent-events] insert threw",
      expect.any(Error)
    );
  });
});
