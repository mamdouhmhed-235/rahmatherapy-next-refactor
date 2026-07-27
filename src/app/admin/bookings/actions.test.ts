import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createManualBooking } from "./actions";

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

function manualBookingFormData() {
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
  return formData;
}

describe("createManualBooking", () => {
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
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      rpc,
      from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>);
  });

  it("opts the admin path into the RPC's duplicate exception", async () => {
    await createManualBooking({}, manualBookingFormData());

    // The public route leaves this off (pinned as `false` in
    // createBookingTransaction.test.ts) so a returning customer is linked
    // silently. Admin staff must instead be shown the match and decide, so
    // flipping this to false here would swap the duplicate-warning banner for
    // a silent link — and flipping the public side to true would 409 real
    // customers mid-booking.
    expect(rpc).toHaveBeenCalledWith(
      "create_booking_request",
      expect.objectContaining({ p_raise_on_duplicate: true })
    );
    // Proves the assertion above ran on a completed booking, not an early
    // permission/validation return that never reached the RPC.
    expect(redirect).toHaveBeenCalledWith("/admin/bookings/booking-new");
  });
});
