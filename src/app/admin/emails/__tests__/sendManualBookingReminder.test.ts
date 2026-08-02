import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendBookingReminderEmail } from "@/lib/email/notifications";
import { sendManualBookingReminder } from "../actions";

/**
 * C-09 Phase B fix round — Step 3 spec coverage. sendManualBookingReminder
 * had no dedicated spec at all. Asserts the pre-existing emails + audit tag
 * invalidation (this function is not itself part of the fix — resendEmail
 * in the same file already carries the correct pair).
 */

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

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

vi.mock("@/lib/email/notifications", () => ({
  sendBookingReminderEmail: vi.fn(),
  sendAssignedStaffBookingChangeEmails: vi.fn(),
  sendBookingCancellationEmails: vi.fn(),
  sendBookingConfirmedClientEmail: vi.fn(),
  sendBookingCreatedEmails: vi.fn(),
  sendStaffAssignmentEmail: vi.fn(),
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

const BOOKING_ID = "booking-1";

function stubAdminClient() {
  const audits: Record<string, unknown>[] = [];

  const from = vi.fn((table: string) => {
    if (table === "audit_logs" || table === "operational_events") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          audits.push(row);
          return { error: null };
        }),
      };
    }
    throw new Error(`Unexpected table in sendManualBookingReminder test: ${table}`);
  });

  return { client: { from }, audits };
}

function formData() {
  const data = new FormData();
  data.set("booking_id", BOOKING_ID);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStaffProfile).mockResolvedValue(owner);
  vi.mocked(sendBookingReminderEmail).mockResolvedValue(undefined);
});

describe("sendManualBookingReminder — cache tag invalidation", () => {
  it("invalidates the emails and audit cache tags on a successful send", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await sendManualBookingReminder(formData());

    expect(sendBookingReminderEmail).toHaveBeenCalledWith(BOOKING_ID, stub.client);
    expect(stub.audits).toHaveLength(1);
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "emails",
      "audit",
    ]);
  });

  it("never calls updateTag when the send fails", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);
    vi.mocked(sendBookingReminderEmail).mockRejectedValue(new Error("Resend is down."));

    await sendManualBookingReminder(formData());

    expect(updateTag).not.toHaveBeenCalled();
  });
});
