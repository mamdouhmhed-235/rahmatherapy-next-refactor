import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { addBusinessDays, getBusinessDate } from "@/lib/time/london";
import { quickUpdateBooking } from "../actions";
import { BookingRowActions } from "../BookingRowActions";

/**
 * The row menu had no coverage at all, and that is how two dead controls
 * shipped: both of its confirm modals are rendered INSIDE the `menuOpen`
 * subtree, so anything that closes the menu takes the dialog with it. Cancel was
 * dead before Phase G; Restore inherited the pattern when Phase G added it.
 *
 * The first two specs below are the guard that was missing — they drive the menu
 * exactly as an admin does, all the way through the confirm dialog, and assert
 * the server action actually fired.
 *
 * `../actions` is mocked in full, so nothing here reaches Supabase, the
 * notifications module or Resend.
 */
vi.mock("../actions", () => ({
  quickUpdateBooking: vi.fn(),
  claimBookingAssignment: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  }),
}));

// Derived from London's today rather than pinned: S6 compares the appointment
// moment against the real clock, so a frozen fixture date would rot.
const TODAY = getBusinessDate();
const TOMORROW = addBusinessDays(TODAY, 1);
const YESTERDAY = addBusinessDays(TODAY, -1);

function renderRow(
  overrides: Partial<Parameters<typeof BookingRowActions>[0]> = {}
) {
  return render(
    <BookingRowActions
      bookingId="booking-1"
      clientName="Aisha Khan"
      role="full"
      status="confirmed"
      paymentStatus="unpaid"
      assignmentStatus="unassigned"
      mapUrl={null}
      claimableAssignmentId={null}
      bookingDate={TOMORROW}
      startTime="14:00:00"
      cancelledAt={null}
      customerCancelledAt={null}
      {...overrides}
    />
  );
}

/** Opens the row menu and clicks one of its items by name. */
async function openMenuItem(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp
) {
  await user.click(screen.getByRole("button", { name: /More actions/i }));
  await user.click(screen.getByRole("menuitem", { name }));
}

/** The FormData the action was last called with, flattened for assertions. */
function lastPayload() {
  const call = vi.mocked(quickUpdateBooking).mock.calls.at(-1);
  return Object.fromEntries((call![0] as FormData).entries());
}

/** The options object of the last `toast.success`, or undefined when omitted. */
function lastToastOptions() {
  return vi.mocked(toast.success).mock.calls.at(-1)?.[1] as
    | { action?: { label: string }; duration?: number }
    | undefined;
}

function lastToastMessage() {
  return String(vi.mocked(toast.success).mock.calls.at(-1)?.[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(quickUpdateBooking).mockResolvedValue({ success: true });
});

afterEach(cleanup);

describe("BookingRowActions — the menu's confirm dialogs actually fire", () => {
  // The regression guard. Against the code this repaired, the confirm button is
  // never reachable: clicking the menu item closed the menu and unmounted the
  // dialog with it, so `Unable to find role="button" name "Restore booking"`.
  it("restores a cancelled booking through the confirm dialog", async () => {
    const user = userEvent.setup();
    renderRow({
      status: "cancelled",
      bookingDate: TOMORROW,
      cancelledAt: new Date().toISOString(),
    });

    await openMenuItem(user, /Restore booking/i);
    await user.click(await screen.findByRole("button", { name: /^Restore booking$/ }));

    expect(quickUpdateBooking).toHaveBeenCalledTimes(1);
    expect(lastPayload()).toMatchObject({
      booking_id: "booking-1",
      action: "restore",
    });
  });

  it("cancels a live booking through the confirm dialog", async () => {
    const user = userEvent.setup();
    renderRow({ status: "confirmed", bookingDate: TOMORROW });

    await openMenuItem(user, /Cancel booking/i);
    await user.click(await screen.findByRole("button", { name: /^Cancel booking$/ }));

    expect(quickUpdateBooking).toHaveBeenCalledTimes(1);
    expect(lastPayload()).toMatchObject({
      booking_id: "booking-1",
      action: "cancel",
    });
  });

  // The dialog's own dismiss must NOT fire the action — the canary against
  // "repairing" the menu by making every click confirm.
  it("fires nothing when the confirm dialog is dismissed", async () => {
    const user = userEvent.setup();
    renderRow({ status: "confirmed", bookingDate: TOMORROW });

    await openMenuItem(user, /Cancel booking/i);
    await user.click(await screen.findByRole("button", { name: /Keep it/i }));

    expect(quickUpdateBooking).not.toHaveBeenCalled();
  });
});

describe("BookingRowActions — the cancel toast's Undo", () => {
  // The Undo posts `action=restore`, so S6 refuses it on a booking whose
  // appointment moment has gone: the admin would get "…appointment time has
  // already passed…", the queued cancellation would still reach the client, and
  // the booking would be left permanently unrestorable. Remove the past-moment
  // condition and this fails.
  it("offers no Undo once the appointment moment has passed", async () => {
    const user = userEvent.setup();
    renderRow({ status: "confirmed", bookingDate: YESTERDAY });

    await openMenuItem(user, /Cancel booking/i);
    await user.click(await screen.findByRole("button", { name: /^Cancel booking$/ }));

    // Non-vacuity first: "no Undo" only means anything once the cancel actually
    // ran and a toast actually went up. Without these two the spec passes
    // happily against a menu whose confirm button never fires at all.
    expect(quickUpdateBooking).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);

    expect(lastToastOptions()?.action).toBeUndefined();
    // ...and the copy does not promise one either.
    expect(lastToastMessage()).not.toMatch(/undo/i);
  });

  it("offers the Undo on a future-dated booking", async () => {
    const user = userEvent.setup();
    renderRow({ status: "confirmed", bookingDate: TOMORROW });

    await openMenuItem(user, /Cancel booking/i);
    await user.click(await screen.findByRole("button", { name: /^Cancel booking$/ }));

    expect(lastToastOptions()?.action?.label).toBe("Undo");
    expect(lastToastMessage()).toMatch(/undo/i);
  });

  // The confirm copy has to make the same promise the toast will keep.
  it("promises the undo window only where S6 leaves one", async () => {
    const user = userEvent.setup();
    const { unmount } = renderRow({ status: "confirmed", bookingDate: TOMORROW });

    await openMenuItem(user, /Cancel booking/i);
    expect(
      await screen.findByText(/there is a brief window to undo it/i)
    ).not.toBeNull();
    unmount();

    renderRow({ status: "confirmed", bookingDate: YESTERDAY });
    await openMenuItem(user, /Cancel booking/i);
    expect(
      await screen.findByText(/cannot be undone/i)
    ).not.toBeNull();
  });

  // The queued row is drained by a minute-granular cron, so the real wait is the
  // delay plus up to another minute. No cancel copy may name a number of seconds.
  it("never names a number of seconds", async () => {
    const user = userEvent.setup();
    renderRow({ status: "confirmed", bookingDate: TOMORROW });

    await openMenuItem(user, /Cancel booking/i);
    expect(screen.queryByText(/\d+\s*seconds?/i)).toBeNull();

    await user.click(await screen.findByRole("button", { name: /^Cancel booking$/ }));
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(lastToastMessage()).not.toMatch(/\d+\s*seconds?/i);
  });
});


describe("BookingRowActions — restore copy", () => {
  // A restore inside the undo window sweeps the queued cancellation and
  // suppresses the "you're back on" email, which is the normal case for an Undo.
  // Neither the modal nor the toast may claim the client heard anything.
  it("claims nothing about the client", async () => {
    const user = userEvent.setup();
    renderRow({
      status: "cancelled",
      bookingDate: TOMORROW,
      cancelledAt: new Date().toISOString(),
    });

    await openMenuItem(user, /Restore booking/i);
    const description = await screen.findByText(/goes back to confirmed/i);
    expect(description.textContent).not.toMatch(/client/i);

    await user.click(screen.getByRole("button", { name: /^Restore booking$/ }));
    expect(lastToastMessage()).toBe("Booking restored.");
  });
});
