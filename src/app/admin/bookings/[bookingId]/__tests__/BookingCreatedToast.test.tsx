// @vitest-environment jsdom
//
// C-07 Phase A fix round (FIX 2) — ManualBookingForm's onSubmit sets the
// generic "booking-new-created-toast" sessionStorage flag on EVERY
// submission through that form, including the `justCreated` (ordinary,
// non-enquiry) path. Before this fix, that flag's generic "Booking request
// submitted." toast fired alongside `justCreated`'s more specific "Booking
// created." toast — a double-toast on the most common booking path. Exactly
// one toast should fire on that path now; the plain re-visit path (neither
// flag set) is untouched.

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { toast } from "sonner";
import { BookingCreatedToast } from "../BookingCreatedToast";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
  }),
}));

const CREATED_TOAST_KEY = "booking-new-created-toast";

afterEach(() => {
  sessionStorage.clear();
  vi.mocked(toast).mockClear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.info).mockClear();
});

describe("BookingCreatedToast — justCreated single-toast fix", () => {
  it("fires exactly one toast on the justCreated path when the generic flag is also set", () => {
    sessionStorage.setItem(CREATED_TOAST_KEY, Date.now().toString());

    render(<BookingCreatedToast justCreated clientId="client-1" />);

    expect(toast).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(
      "Booking created.",
      expect.objectContaining({
        action: expect.objectContaining({ label: "View client" }),
      })
    );
  });

  it("still fires the generic toast when the flag is set but no just_created/just_converted param is present", () => {
    sessionStorage.setItem(CREATED_TOAST_KEY, Date.now().toString());

    render(<BookingCreatedToast />);

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("leaves the enquiry path's double-toast untouched (pre-existing, deferred to C-12+)", () => {
    sessionStorage.setItem(CREATED_TOAST_KEY, Date.now().toString());

    render(<BookingCreatedToast justConverted />);

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
  });
});
