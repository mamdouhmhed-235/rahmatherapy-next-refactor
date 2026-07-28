import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingManagementForm } from "./BookingManagementForm";
import { updateBookingManagement } from "./actions";
import type { BookingRecord } from "./types";

vi.mock("./actions", () => ({
  updateBookingManagement: vi.fn(),
  quickUpdateBooking: vi.fn(),
  updateOwnAssignmentStatus: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const BOOKING: BookingRecord = {
  id: "booking-1",
  booking_date: "2026-07-20",
  start_time: "14:00:00",
  end_time: "15:00:00",
  total_duration_mins: 60,
  total_price: 55,
  contact_full_name: "Aisha Khan",
  contact_email: "aisha@example.test",
  contact_phone: "07123456789",
  booking_source: "phone",
  amount_due: 55,
  amount_paid: 0,
  paid_at: null,
  payment_note: null,
  status: "completed",
  payment_status: "unpaid",
  payment_method: null,
  assignment_status: "fully_assigned",
  group_booking: false,
  service_address_line1: "10 Test Street",
  service_address_line2: null,
  service_city: "Luton",
  service_postcode: "LU1 1AA",
  access_notes: null,
  consent_acknowledged: true,
  customer_notes: null,
  health_notes: null,
  customer_manage_notes: null,
  customer_cancelled_at: null,
  customer_cancellation_note: null,
  last_customer_manage_action_at: null,
  reschedule_requested_at: null,
  reschedule_preferred_date: null,
  reschedule_preferred_time: null,
  reschedule_note: null,
  reschedule_status: "none",
  admin_notes: null,
  treatment_notes: null,
  created_at: "2026-07-01T09:00:00.000Z",
  clients: null,
  booking_participants: [],
  booking_items: [],
  booking_assignments: [],
};

/** The FormData the action was last called with, flattened for assertions. */
function lastPayload() {
  const call = vi.mocked(updateBookingManagement).mock.calls.at(-1);
  return Object.fromEntries((call![1] as FormData).entries());
}

describe("BookingManagementForm — reopen-completed confirm modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateBookingManagement).mockResolvedValue({ success: true });
  });

  afterEach(cleanup);

  it("intercepts a completed → confirmed save with the confirm modal", async () => {
    const user = userEvent.setup();
    render(<BookingManagementForm booking={BOOKING} />);

    await user.selectOptions(screen.getByLabelText(/^Status/), "confirmed");
    await user.click(
      screen.getByRole("button", { name: /Save status & payment/i })
    );

    expect(
      await screen.findByText("Reopen this completed booking?")
    ).not.toBeNull();
    expect(updateBookingManagement).not.toHaveBeenCalled();
  });

  it("submits the force flag and the typed reason on confirm", async () => {
    const user = userEvent.setup();
    render(<BookingManagementForm booking={BOOKING} />);

    await user.selectOptions(screen.getByLabelText(/^Status/), "pending");
    await user.click(
      screen.getByRole("button", { name: /Save status & payment/i })
    );
    await user.type(
      await screen.findByLabelText(/Reason for reopening/i),
      "client returned for retreat"
    );
    await user.click(screen.getByRole("button", { name: /Reopen booking/i }));

    await waitFor(() => expect(updateBookingManagement).toHaveBeenCalledTimes(1));
    expect(lastPayload()).toMatchObject({
      booking_id: "booking-1",
      status: "pending",
      force_completed_reversal: "on",
      completed_reversal_reason: "client returned for retreat",
    });
  });

  it("saves a completed → completed edit without the modal", async () => {
    const user = userEvent.setup();
    render(<BookingManagementForm booking={BOOKING} />);

    await user.selectOptions(screen.getByLabelText(/Payment status/), "paid");
    await user.click(
      screen.getByRole("button", { name: /Save status & payment/i })
    );

    await waitFor(() => expect(updateBookingManagement).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Reopen this completed booking?")).toBeNull();
    expect(lastPayload()).not.toHaveProperty("force_completed_reversal");
  });

  it("saves a non-completed booking's status change without the modal", async () => {
    const user = userEvent.setup();
    render(<BookingManagementForm booking={{ ...BOOKING, status: "confirmed" }} />);

    await user.selectOptions(screen.getByLabelText(/^Status/), "cancelled");
    await user.click(
      screen.getByRole("button", { name: /Save status & payment/i })
    );

    await waitFor(() => expect(updateBookingManagement).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Reopen this completed booking?")).toBeNull();
    expect(lastPayload()).toMatchObject({ status: "cancelled" });
  });
});
