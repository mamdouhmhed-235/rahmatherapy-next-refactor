// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { RecentActivityStripe } from "../RecentActivityStripe";
import type { NotificationItem } from "../../../reports/reporting";

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "n1",
    type: "email",
    title: "Email delivery failed",
    detail: "Booking confirmation could not be delivered.",
    severity: "critical",
    timestamp: "2026-07-30 09:00",
    href: "/admin/emails",
    ...overrides,
  };
}

describe("blocks/RecentActivityStripe", () => {
  it("renders each activity item (happy path)", () => {
    const { getByText } = render(<RecentActivityStripe items={[item()]} />);
    expect(getByText("Email delivery failed")).toBeTruthy();
  });

  it("renders the empty-state copy when there is no activity", () => {
    const { getByText } = render(<RecentActivityStripe items={[]} />);
    expect(getByText("Nothing to report")).toBeTruthy();
  });

  it("caps to maxItems and reports the remainder", () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      item({ id: `n${i}`, title: `Event ${i}` })
    );
    const { getByText, queryByText } = render(
      <RecentActivityStripe items={items} maxItems={6} />
    );
    expect(getByText("Event 5")).toBeTruthy();
    expect(queryByText("Event 6")).toBeNull();
    expect(getByText("Showing 6 of 8.")).toBeTruthy();
  });

  it("renders items without an href as plain (non-link) rows", () => {
    const { getByText } = render(
      <RecentActivityStripe items={[item({ href: null, title: "No link event" })]} />
    );
    const node = getByText("No link event");
    expect(node.closest("a")).toBeNull();
  });
});
