import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { saveThemePreference } from "../theme-actions";

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

function profile(): StaffProfile {
  return {
    id: "staff-1",
    auth_user_id: "auth-1",
    name: "Test Therapist",
    email: "test.therapist@rahmatherapy.example.test",
    role_id: "role-1",
    role_name: "Therapist",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set<string>(),
  };
}

/** Records the update payload + the id filter so specs can assert the write is
 *  scoped to the caller's own row. */
function stubAdminClient(error: { message: string } | null) {
  const eq = vi.fn().mockResolvedValue({ error });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ from } as never);
  return { from, update, eq };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStaffProfile).mockResolvedValue(profile());
});

describe("saveThemePreference", () => {
  it.each(["dark", "light", "system"])("writes the valid theme %s to the caller's own row", async (theme) => {
    const client = stubAdminClient(null);

    await expect(saveThemePreference(theme)).resolves.toEqual({ success: true });

    expect(client.from).toHaveBeenCalledWith("staff_profiles");
    expect(client.update).toHaveBeenCalledWith({ theme_preference: theme });
    expect(client.eq).toHaveBeenCalledWith("id", "staff-1");
  });

  it.each(["", "DARK", "midnight", "system "])(
    "rejects the invalid theme %o before any client is created",
    async (theme) => {
      const client = stubAdminClient(null);

      await expect(saveThemePreference(theme)).resolves.toEqual({
        success: false,
        error: "Invalid theme value.",
      });
      expect(createSupabaseAdminClient).not.toHaveBeenCalled();
      expect(client.update).not.toHaveBeenCalled();
    }
  );

  it("returns the Supabase error instead of discarding it", async () => {
    stubAdminClient({ message: 'permission denied for table "staff_profiles"' });

    await expect(saveThemePreference("dark")).resolves.toEqual({
      success: false,
      error: 'permission denied for table "staff_profiles"',
    });
  });

  it("refuses to create the service-role client without a session", async () => {
    stubAdminClient(null);
    vi.mocked(getStaffProfile).mockResolvedValue(null);

    await expect(saveThemePreference("dark")).resolves.toEqual({
      success: false,
      error: "Not authenticated.",
    });
    // Rule 11 — createSupabaseAdminClient() only after getStaffProfile().
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
