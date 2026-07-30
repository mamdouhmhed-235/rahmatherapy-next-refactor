// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ClaimQueueStripe } from "../ClaimQueueStripe";
import type { ClaimQueueBooking } from "../ClaimQueueStripe";

function booking(overrides: Partial<ClaimQueueBooking> = {}): ClaimQueueBooking {
  return {
    id: "b1",
    contactName: "Jane Doe",
    bookingDate: "Mon 3 Aug",
    time: "09:00",
    city: "Luton",
    requiredGender: null,
    ...overrides,
  };
}

describe("blocks/ClaimQueueStripe", () => {
  it("renders each unassigned booking (happy path)", () => {
    const { getByText } = render(<ClaimQueueStripe bookings={[booking()]} />);
    expect(getByText("Jane Doe")).toBeTruthy();
    expect(getByText("1 booking needs a therapist.")).toBeTruthy();
  });

  it("renders the empty-state copy when the queue is empty", () => {
    const { getByText } = render(<ClaimQueueStripe bookings={[]} />);
    expect(getByText("Nothing in the queue")).toBeTruthy();
  });

  it("flags same-gender-required bookings", () => {
    const { getByText } = render(
      <ClaimQueueStripe bookings={[booking({ requiredGender: "female" })]} />
    );
    expect(getByText("Same-gender")).toBeTruthy();
  });

  it("caps the visible list to 5 and links to the full unassigned view", () => {
    const bookings = Array.from({ length: 6 }, (_, i) =>
      booking({ id: `b${i}`, contactName: `Client ${i}` })
    );
    const { getByText, queryByText } = render(<ClaimQueueStripe bookings={bookings} />);
    expect(getByText("Client 4")).toBeTruthy();
    expect(queryByText("Client 5")).toBeNull();
    const link = getByText(/See all 6 unassigned/);
    expect(link.closest("a")?.getAttribute("href")).toBe("/admin/bookings?view=unassigned");
  });
});
