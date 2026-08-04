// C-23 Phase B, Step 4 — tests for the authenticated admin month endpoint.
//
// The engine itself is covered by src/lib/booking/__tests__/availability-options.test.ts;
// here calculateAvailableDays is mocked so these tests assert the route's own
// contract: auth, permission, payload validation, the options it hands the
// engine, and the standing rule that the service-role client is never created
// before the permission check passes.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffProfile } from "@/lib/auth/rbac";
import { POST } from "./route";

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

vi.mock("@/lib/booking/availability", () => ({
  calculateAvailableDays: vi.fn(),
}));

// Not imported by the route — see its header comment. Mocked purely so the
// assertion below can prove it is never reached.
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  AVAILABILITY_RATE_LIMIT: {},
  RATE_LIMITED_AVAILABILITY_MESSAGE: "rate limited",
}));

const { getStaffProfile } = await import("@/lib/auth/rbac");
const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
const { calculateAvailableDays } = await import("@/lib/booking/availability");
const { checkRateLimit } = await import("@/lib/rate-limit");

function profile(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    id: "staff-1",
    auth_user_id: "auth-1",
    name: "Coordinator Test",
    email: "coordinator@example.test",
    role_id: "role-1",
    role_name: "Coordinator",
    gender: "female",
    active: true,
    can_take_bookings: false,
    availability_mode: "manual",
    permissions: new Set<string>(),
    ...overrides,
  };
}

// The same gate /admin/bookings/new's page.tsx uses.
const AUTHORIZED_PROFILE = profile({
  permissions: new Set(["manage_bookings_all"]),
});

const VALID_BODY = {
  month: "2026-06",
  serviceIds: ["hijama-package"],
  participantGenders: ["female"],
  city: "Luton",
};

const ENGINE_RESULT = {
  days: [{ date: "2026-06-01", hasSlots: true, slotCount: 3 }],
  durationMins: 60,
  requiredStaffByGender: { male: 0, female: 1 },
};

function post(body: unknown, { raw = false } = {}) {
  return POST(
    new Request("https://internal.invalid/api/admin/availability/month", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ? (body as string) : JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createSupabaseAdminClient).mockReturnValue(
    {} as unknown as ReturnType<typeof createSupabaseAdminClient>
  );
  vi.mocked(calculateAvailableDays).mockResolvedValue(
    ENGINE_RESULT as unknown as Awaited<ReturnType<typeof calculateAvailableDays>>
  );
});

describe("POST /api/admin/availability/month — access control", () => {
  it("rejects an unauthenticated request with 401", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(null);

    const response = await post(VALID_BODY);

    expect(response.status).toBe(401);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(calculateAvailableDays).not.toHaveBeenCalled();
  });

  it("rejects a signed-in staff member without manage_bookings_all with 403", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(
      profile({ permissions: new Set(["manage_bookings_assigned"]) })
    );

    const response = await post(VALID_BODY);

    expect(response.status).toBe(403);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(calculateAvailableDays).not.toHaveBeenCalled();
  });

  it("rejects a deactivated account that still carries the permission", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(
      profile({ active: false, permissions: new Set(["manage_bookings_all"]) })
    );

    const response = await post(VALID_BODY);

    expect(response.status).toBe(403);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("never consults the public availability rate limiter", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(AUTHORIZED_PROFILE);

    await post(VALID_BODY);

    expect(checkRateLimit).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/availability/month — payload validation", () => {
  beforeEach(() => {
    vi.mocked(getStaffProfile).mockResolvedValue(AUTHORIZED_PROFILE);
  });

  it("returns 400 for a malformed month", async () => {
    const response = await post({ ...VALID_BODY, month: "2026-13" });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body.fieldErrors).toBeDefined();
    expect(calculateAvailableDays).not.toHaveBeenCalled();
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await post({ month: "2026-06" });

    expect(response.status).toBe(400);
    expect(calculateAvailableDays).not.toHaveBeenCalled();
  });

  it("returns 400 for an unparseable body", async () => {
    const response = await post("{not json", { raw: true });

    expect(response.status).toBe(400);
    expect(calculateAvailableDays).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/availability/month — authorised request", () => {
  beforeEach(() => {
    vi.mocked(getStaffProfile).mockResolvedValue(AUTHORIZED_PROFILE);
  });

  it("returns the month's days for valid staff", async () => {
    const response = await post(VALID_BODY);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toStrictEqual({
      month: "2026-06",
      days: ENGINE_RESULT.days,
      durationMins: 60,
      requiredStaffByGender: { male: 0, female: 1 },
    });
  });

  it("asks the engine for the admin policy — both relaxations on", async () => {
    await post(VALID_BODY);

    expect(calculateAvailableDays).toHaveBeenCalledTimes(1);
    expect(vi.mocked(calculateAvailableDays).mock.calls[0][2]).toStrictEqual({
      ignoreBookingWindow: true,
      ignorePublicPause: true,
    });
  });

  it("expands the month into its full set of dates", async () => {
    await post({ ...VALID_BODY, month: "2026-02" });

    const [input] = vi.mocked(calculateAvailableDays).mock.calls[0];
    expect(input.dates).toHaveLength(28);
    expect(input.dates[0]).toBe("2026-02-01");
    expect(input.dates[27]).toBe("2026-02-28");
  });

  it("passes a reason through when the engine reports one", async () => {
    vi.mocked(calculateAvailableDays).mockResolvedValue({
      ...ENGINE_RESULT,
      reason: "No eligible staff are available.",
    } as unknown as Awaited<ReturnType<typeof calculateAvailableDays>>);

    const response = await post(VALID_BODY);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.reason).toBe("No eligible staff are available.");
  });
});
