import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getSelectedPackages } from "../data/booking-packages";
import { emptyBookingDetails } from "../types";
import { BookingSummary } from "./BookingSummary";

describe("BookingSummary", () => {
  it("shows the group total as participants times per-person total", () => {
    const selectedPackages = getSelectedPackages(["hijama-package"]);

    render(
      <BookingSummary
        selectedPackages={selectedPackages}
        perPersonTotal={45}
        estimatedTotal={90}
        details={{
          ...emptyBookingDetails,
          bookingFor: "group",
          numberOfPeople: 2,
          participantGenders: ["female", "male"],
          participantNames: ["Aisha", "Omar"],
        }}
        preferredDate="2026-06-01"
        preferredTime="10:00"
        actions={<button type="button">Continue</button>}
      />
    );

    expect(screen.getByText("2 x £45")).toBeTruthy();
    expect(screen.getByText("£90")).toBeTruthy();
    expect(screen.getByText("2 people")).toBeTruthy();
  });
});
