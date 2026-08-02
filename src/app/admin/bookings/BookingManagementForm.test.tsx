import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { addBusinessDays, getBusinessDate } from "@/lib/time/london";
import { BookingManagementForm } from "./BookingManagementForm";
import { updateBookingManagement } from "./actions";
import {
  CANCELLATION_UNDO_DELAY_SECONDS,
  COMPLETED_REVERSAL_MIN_REASON_LENGTH,
} from "./_helpers";
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
  cancelled_at: null,
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
  recurring_template_id: null,
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

const REASON_REQUIRED = `Provide a reason (min ${COMPLETED_REVERSAL_MIN_REASON_LENGTH} chars).`;

/** Moves the status off `completed` and opens the confirm modal. */
async function openReopenModal(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/^Status/), "confirmed");
  await user.click(
    screen.getByRole("button", { name: /Save status & payment/i })
  );
  return screen.findByLabelText(/Reason for reopening/i);
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

  it("refuses the confirm when no reason has been given", async () => {
    const user = userEvent.setup();
    render(<BookingManagementForm booking={BOOKING} />);

    await openReopenModal(user);
    await user.click(screen.getByRole("button", { name: /Reopen booking/i }));

    expect(await screen.findByText(REASON_REQUIRED)).not.toBeNull();
    expect(updateBookingManagement).not.toHaveBeenCalled();
  });

  it("refuses the confirm when the reason is shorter than the minimum", async () => {
    const user = userEvent.setup();
    render(<BookingManagementForm booking={BOOKING} />);

    const reason = await openReopenModal(user);
    await user.type(reason, "ok ");
    await user.click(screen.getByRole("button", { name: /Reopen booking/i }));

    expect(await screen.findByText(REASON_REQUIRED)).not.toBeNull();
    expect(updateBookingManagement).not.toHaveBeenCalled();
  });

  it("submits the trimmed reason once it meets the minimum", async () => {
    const user = userEvent.setup();
    render(<BookingManagementForm booking={BOOKING} />);

    const reason = await openReopenModal(user);
    await user.type(reason, "  booked in error  ");
    await user.click(screen.getByRole("button", { name: /Reopen booking/i }));

    await waitFor(() => expect(updateBookingManagement).toHaveBeenCalledTimes(1));
    expect(lastPayload()).toMatchObject({
      force_completed_reversal: "on",
      completed_reversal_reason: "booked in error",
    });
    expect(screen.queryByText(REASON_REQUIRED)).toBeNull();
  });

  it("renders the server's completed_reversal_reason rejection", async () => {
    vi.mocked(updateBookingManagement).mockResolvedValue({
      error: "Reopening a completed booking requires a reason.",
      fieldErrors: { completed_reversal_reason: "Reason rejected by the server." },
    });
    const user = userEvent.setup();
    render(<BookingManagementForm booking={BOOKING} />);

    const reason = await openReopenModal(user);
    await user.type(reason, "booked in error");
    await user.click(screen.getByRole("button", { name: /Reopen booking/i }));

    expect(
      await screen.findByText("Reason rejected by the server.")
    ).not.toBeNull();
  });
});

// C-04a fix round — the chips must never offer a call `quickUpdateBooking`
// refuses: `completed`, `cancelled` and `no_show` are terminal for the
// one-click actions.
describe("BookingManagementForm — quick actions on terminal statuses", () => {
  afterEach(cleanup);

  it("offers no live Cancel chip on a completed booking", () => {
    render(<BookingManagementForm booking={BOOKING} />);

    expect(screen.queryByRole("button", { name: /Cancel booking/i })).toBeNull();
    // The strip still rendered — only the terminal chip went quiet.
    expect(screen.getByRole("button", { name: /Mark paid/i })).not.toBeNull();
  });

  it("offers no live Mark complete chip on a cancelled booking", () => {
    render(<BookingManagementForm booking={{ ...BOOKING, status: "cancelled" }} />);

    expect(screen.queryByRole("button", { name: /Mark complete/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Mark paid/i })).not.toBeNull();
  });

  // Confirm included: a live Confirm chip on a no-show booking was one click
  // from silently un-doing the no-show, bypassing Restore entirely.
  it("offers no live status chip on a no-show booking", () => {
    render(<BookingManagementForm booking={{ ...BOOKING, status: "no_show" }} />);

    expect(screen.queryByRole("button", { name: /Cancel booking/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Mark complete/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Confirm booking/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Mark paid/i })).not.toBeNull();
  });

  it("keeps both chips live on a confirmed booking", () => {
    render(<BookingManagementForm booking={{ ...BOOKING, status: "confirmed" }} />);

    expect(screen.getByRole("button", { name: /Cancel booking/i })).not.toBeNull();
    expect(screen.getByRole("button", { name: /Mark complete/i })).not.toBeNull();
  });

  // Over-blocking canary for the Confirm chip: `pending` is the status it exists
  // for, and widening `isDone` must not reach it.
  it("keeps the Confirm chip live on a pending booking", () => {
    render(<BookingManagementForm booking={{ ...BOOKING, status: "pending" }} />);

    expect(screen.getByRole("button", { name: /Confirm booking/i })).not.toBeNull();
  });
});

// Derived from London's today rather than pinned: S6 compares the appointment
// moment against the real clock, so a frozen fixture date would rot.
const TODAY = getBusinessDate();
const TOMORROW = addBusinessDays(TODAY, 1);
const YESTERDAY = addBusinessDays(TODAY, -1);

/** The options object of the last `toast.success`, or undefined when omitted. */
function lastToastOptions() {
  return vi.mocked(toast.success).mock.calls.at(-1)?.[1] as
    | { action?: { label: string }; duration?: number }
    | undefined;
}

function lastToastMessage() {
  return String(vi.mocked(toast.success).mock.calls.at(-1)?.[0]);
}

describe("BookingManagementForm — the cancellation toast's Undo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateBookingManagement).mockResolvedValue({ success: true });
  });

  afterEach(cleanup);

  /** Drives a live booking to `cancelled` through the Status form. */
  async function cancelThroughTheForm(bookingDate: string) {
    const user = userEvent.setup();
    render(
      <BookingManagementForm
        booking={{ ...BOOKING, status: "confirmed", booking_date: bookingDate }}
      />
    );
    await user.selectOptions(screen.getByLabelText(/^Status/), "cancelled");
    await user.click(
      screen.getByRole("button", { name: /Save status & payment/i })
    );
    await waitFor(() => expect(updateBookingManagement).toHaveBeenCalledTimes(1));
  }

  // The blocker. The Undo posts `action=restore`, so S6 refuses it outright on a
  // booking whose appointment moment has gone: the admin gets "Couldn't undo:
  // …appointment time has already passed…", the queued cancellation still
  // reaches the client, and the booking is left permanently unrestorable.
  // Offering the button at all is the defect. Remove the past-moment condition
  // and this fails.
  it("offers no Undo once the appointment moment has passed", async () => {
    await cancelThroughTheForm(YESTERDAY);

    expect(lastToastOptions()?.action).toBeUndefined();
    // ...and the copy does not promise one either.
    expect(lastToastMessage()).not.toMatch(/undo/i);
  });

  it("offers the Undo on a future-dated booking", async () => {
    await cancelThroughTheForm(TOMORROW);

    expect(lastToastOptions()?.action?.label).toBe("Undo");
    expect(lastToastMessage()).toMatch(/undo/i);
  });

  // The toast has to close before the cron may claim the queued row. Equal
  // values are not enough: the server's delay starts when the row is written,
  // the toast's when React renders the result, so the toast outlives the window
  // by the round trip.
  it("closes the Undo before the server's delay elapses", async () => {
    await cancelThroughTheForm(TOMORROW);

    expect(lastToastOptions()!.duration).toBeLessThan(
      CANCELLATION_UNDO_DELAY_SECONDS * 1000
    );
  });

  // The queued row is drained by a minute-granular cron, so the real wait is the
  // delay plus up to another minute. No cancel copy may name a number of seconds.
  it("never names a number of seconds", async () => {
    await cancelThroughTheForm(TOMORROW);

    expect(lastToastMessage()).not.toMatch(/\d+\s*seconds?/i);
  });

  it("says nothing about an Undo on an ordinary save", async () => {
    const user = userEvent.setup();
    render(<BookingManagementForm booking={{ ...BOOKING, status: "confirmed" }} />);

    await user.selectOptions(screen.getByLabelText(/Payment status/), "paid");
    await user.click(
      screen.getByRole("button", { name: /Save status & payment/i })
    );

    await waitFor(() => expect(updateBookingManagement).toHaveBeenCalledTimes(1));
    expect(lastToastMessage()).toBe("Booking updated.");
    expect(lastToastOptions()).toBeUndefined();
  });
});
