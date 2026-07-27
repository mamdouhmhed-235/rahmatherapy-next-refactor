import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendBookingCreatedEmails } from "@/lib/email/notifications";
import { ensureBookingManageUrl } from "@/lib/booking/manage-token";
import { createManualBooking } from "../actions";

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

vi.mock("@/lib/email/notifications", () => ({
  sendBookingCreatedEmails: vi.fn(),
  sendAssignedStaffBookingChangeEmails: vi.fn(),
  sendBookingCancellationEmails: vi.fn(),
  sendStaffAssignmentEmail: vi.fn(),
}));

vi.mock("@/lib/booking/manage-token", () => ({
  ensureBookingManageUrl: vi.fn(),
}));

const rpc = vi.fn();

const bookingManager = {
  id: "staff-1",
  auth_user_id: "auth-1",
  name: "Owner",
  email: "owner@example.test",
  role_id: "role-1",
  role_name: "Owner",
  gender: "female",
  active: true,
  can_take_bookings: false,
  availability_mode: "use_global",
  permissions: new Set(["manage_bookings_all"]),
} satisfies Awaited<ReturnType<typeof getStaffProfile>>;

function manualBookingFormData(
  overrides: Record<string, string> = {}
): FormData {
  const formData = new FormData();
  formData.append("service_slugs", "hijama-package");
  formData.set("booking_source", "phone");
  formData.set("booking_date", "2026-06-01");
  formData.set("start_time", "10:00");
  formData.set("booking_for", "self");
  formData.set("full_name", "Aisha Khan");
  formData.set("email", "aisha@example.test");
  formData.set("phone", "07123 456 789");
  formData.set("number_of_people", "1");
  formData.set("participant_name_0", "Aisha Khan");
  formData.set("participant_gender_0", "female");
  formData.set("address", "10 Test Street");
  formData.set("postcode", "LU1 1AA");
  formData.set("city", "Luton");
  formData.set("area", "Bedfordshire");
  formData.set("consent_acknowledged", "on");
  formData.set("send_confirmation_email", "on");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

describe("createManualBooking with no email (C-06 Phase F)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({
      data: {
        bookingId: "booking-new",
        participantCount: 1,
        itemCount: 1,
        assignmentCount: 1,
      },
      error: null,
    });
    vi.mocked(getStaffProfile).mockResolvedValue(bookingManager);
    vi.mocked(ensureBookingManageUrl).mockResolvedValue("https://example.test/manage");
    vi.mocked(sendBookingCreatedEmails).mockResolvedValue({ manageUrl: null });
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      rpc,
      from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>);
  });

  it("accepts an empty email and hands the RPC an empty string to null out", async () => {
    const result = await createManualBooking({}, manualBookingFormData({ email: "" }));

    expect(result).toBeUndefined();
    // The RPC normalises "" to NULL — sending "" rather than dropping the key
    // keeps the argument-key set identical for both callers, which is what
    // PostgREST resolves the overload on.
    expect(rpc).toHaveBeenCalledWith(
      "create_booking_request",
      expect.objectContaining({ p_contact_email: "" })
    );
  });

  it("does not attempt a confirmation send when there is no address", async () => {
    await createManualBooking({}, manualBookingFormData({ email: "" }));

    // send_confirmation_email is still "on" in this payload: the form hides the
    // checkbox, but the server must not depend on that.
    expect(sendBookingCreatedEmails).not.toHaveBeenCalled();
  });

  it("still sends the confirmation when an email is present", async () => {
    await createManualBooking({}, manualBookingFormData());

    expect(sendBookingCreatedEmails).toHaveBeenCalledTimes(1);
  });

  it("keeps phone required", async () => {
    const result = await createManualBooking({}, manualBookingFormData({ phone: "", email: "" }));

    expect(result.error).toBe("Check the highlighted booking details.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("still rejects a malformed email — optional is not unvalidated", async () => {
    const result = await createManualBooking(
      {},
      manualBookingFormData({ email: "sara-at-example" })
    );

    expect(result.error).toBe("Check the highlighted booking details.");
    expect(rpc).not.toHaveBeenCalled();
  });
});
