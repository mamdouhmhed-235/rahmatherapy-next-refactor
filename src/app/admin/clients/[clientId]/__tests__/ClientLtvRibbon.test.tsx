import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ClientLtvRibbon } from "../ClientLtvRibbon";
import type { ClientBookingRecord } from "../../types";

function booking(overrides: Partial<ClientBookingRecord> = {}): ClientBookingRecord {
  return {
    id: overrides.id ?? "b-x",
    client_id: overrides.client_id ?? "c1",
    booking_date: overrides.booking_date ?? "2026-05-10",
    start_time: "09:00",
    end_time: "10:00",
    status: overrides.status ?? "completed",
    payment_status: "paid",
    assignment_status: "assigned",
    group_booking: false,
    total_price: overrides.total_price ?? 50,
    amount_due: 50,
    amount_paid: overrides.amount_paid ?? 50,
    service_city: null,
    service_postcode: null,
    created_at: "2026-05-01T00:00:00Z",
    booking_items: overrides.booking_items ?? [
      { service_name_snapshot: "Massage 60", service_price_snapshot: 50, service_duration_snapshot: 60 },
    ],
  };
}

describe("ClientLtvRibbon", () => {
  it("returns null when the client has zero bookings (brief §5.4)", () => {
    const { container } = render(
      <ClientLtvRibbon clientId="c1" bookings={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the loyal letterhead for a client with 12 completed visits", () => {
    const bookings = Array.from({ length: 12 }, (_, i) =>
      booking({
        id: `b${i}`,
        amount_paid: 80,
        booking_date: `2026-${String((i % 12) + 1).padStart(2, "0")}-15`,
      })
    );
    const { container, getByText, getByLabelText } = render(
      <ClientLtvRibbon clientId="c1" bookings={bookings} />
    );

    expect(getByLabelText("Client lifetime overview")).toBeTruthy();
    expect(getByText("LTV")).toBeTruthy();
    expect(getByText("£960.00")).toBeTruthy();
    expect(getByText("Across 12 visits")).toBeTruthy();
    expect(getByText("Visits")).toBeTruthy();
    expect(getByText("Avg booking")).toBeTruthy();
    expect(getByText("£80.00")).toBeTruthy();
    expect(getByText("Loyal")).toBeTruthy();
    expect(getByText("Massage 60")).toBeTruthy();

    const sparkline = container.querySelector(
      '[aria-label="12-month visit trend for this client"]'
    );
    expect(sparkline).not.toBeNull();
  });

  it("renders the New chip and singular 'visit' word for a client with 1 completed visit", () => {
    const { getByText, getAllByText } = render(
      <ClientLtvRibbon
        clientId="c1"
        bookings={[booking({ id: "b1", amount_paid: 73 })]}
      />
    );
    expect(getByText("New")).toBeTruthy();
    expect(getByText("Across 1 visit")).toBeTruthy();
    // £73.00 appears twice: LTV cell + Avg booking cell (1 visit × £73 = £73 avg)
    expect(getAllByText("£73.00").length).toBe(2);
  });

  it("maps repeat-status thresholds: 1 → New, 3 → Returning, 7 → Regular, 12 → Loyal", () => {
    const buckets: { count: number; chip: string }[] = [
      { count: 1, chip: "New" },
      { count: 3, chip: "Returning" },
      { count: 7, chip: "Regular" },
      { count: 12, chip: "Loyal" },
    ];
    for (const { count, chip } of buckets) {
      const bookings = Array.from({ length: count }, (_, i) =>
        booking({ id: `b${i}`, booking_date: `2026-${String((i % 12) + 1).padStart(2, "0")}-10` })
      );
      const { getByText, unmount } = render(
        <ClientLtvRibbon clientId="c1" bookings={bookings} />
      );
      expect(getByText(chip)).toBeTruthy();
      unmount();
    }
  });

  it("renders the all-cancelled zero state (ribbon visible, £0 LTV, Never last seen, em-dash service, New chip)", () => {
    const { container, getByText, getAllByText } = render(
      <ClientLtvRibbon
        clientId="c1"
        bookings={[
          booking({ id: "b1", status: "cancelled", amount_paid: 0 }),
          booking({ id: "b2", status: "cancelled", amount_paid: 0 }),
        ]}
      />
    );
    expect(container.firstChild).not.toBeNull();
    // £0.00 appears twice: LTV cell + Avg booking cell
    expect(getAllByText("£0.00").length).toBe(2);
    expect(getByText("Never")).toBeTruthy();
    expect(getByText("—")).toBeTruthy();
    expect(getByText("New")).toBeTruthy();
    // Visits cell reads "0 / 2" — split across nodes; check via tile attribute
    const visitsTile = container.querySelector('[data-tile-label="Visits"]');
    expect(visitsTile?.textContent?.replace(/\s+/g, " ").trim()).toContain("0");
    expect(visitsTile?.textContent?.replace(/\s+/g, " ").trim()).toContain("2");
  });

  it("hides the sparkline when every monthly bucket is zero (all-cancelled case)", () => {
    const { container } = render(
      <ClientLtvRibbon
        clientId="c1"
        bookings={[
          booking({ id: "b1", status: "cancelled", amount_paid: 0 }),
        ]}
      />
    );
    const sparkline = container.querySelector(
      '[aria-label="12-month visit trend for this client"]'
    );
    expect(sparkline).toBeNull();
  });

  it("renders the therapist-narrowed sub-line when scopeNarrowed is true", () => {
    const { getByText } = render(
      <ClientLtvRibbon
        clientId="c1"
        bookings={[
          booking({ id: "b1", amount_paid: 50 }),
          booking({ id: "b2", amount_paid: 50 }),
          booking({ id: "b3", amount_paid: 50 }),
        ]}
        scopeNarrowed
      />
    );
    expect(getByText("Across 3 visits with you")).toBeTruthy();
  });

  it("truncates Preferred service over 20 chars and exposes the full name via title attribute", () => {
    const longService = "Extended deep tissue therapeutic massage";
    const { container, getByText } = render(
      <ClientLtvRibbon
        clientId="c1"
        bookings={[
          booking({
            id: "b1",
            booking_items: [
              {
                service_name_snapshot: longService,
                service_price_snapshot: 90,
                service_duration_snapshot: 90,
              },
            ],
          }),
        ]}
      />
    );
    const truncated = `${longService.slice(0, 20).trimEnd()}…`;
    const node = getByText(truncated);
    expect(node).toBeTruthy();
    expect(node.getAttribute("title")).toBe(longService);
    // ensure the full name is NOT in the visible text
    expect(container.textContent ?? "").not.toContain(longService);
  });

  it("exposes a tooltip with the absolute date on Last seen", () => {
    const { getByText } = render(
      <ClientLtvRibbon
        clientId="c1"
        bookings={[booking({ id: "b1", booking_date: "2026-04-30" })]}
      />
    );
    // Use a regex so we don't depend on the precise relative-time wording (it
    // shifts with the system clock during CI). Just assert the title carries
    // an absolute date.
    const lastSeenLabel = getByText("Last seen");
    const valueNode = lastSeenLabel.parentElement?.querySelector("[title]");
    expect(valueNode).not.toBeNull();
    expect(valueNode?.getAttribute("title")).toMatch(/2026/);
  });
});
