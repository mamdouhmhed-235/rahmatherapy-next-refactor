// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PendingBookingsStripe } from "../PendingBookingsStripe";
import type { AttentionSummaryRow } from "../PendingBookingsStripe";

describe("blocks/PendingBookingsStripe (was 'Needs your attention')", () => {
  it("renders the heading + active severity rows (happy path)", () => {
    const rows: AttentionSummaryRow[] = [
      {
        key: "emails",
        label: "Client confirmation emails",
        detail: "Delivery failed or bounced",
        count: 2,
        severity: "critical",
        href: "/admin/emails",
      },
      {
        key: "staff-gaps",
        label: "Staff gaps",
        detail: "Well covered",
        count: 0,
        severity: "clear",
        href: "/admin/staff",
      },
    ];
    const { getByText } = render(<PendingBookingsStripe rows={rows} groups={[]} />);
    expect(getByText("Needs your attention")).toBeTruthy();
    expect(getByText("Client confirmation emails")).toBeTruthy();
  });

  it("renders the all-clear empty state when every row is 'clear'", () => {
    const rows: AttentionSummaryRow[] = [
      {
        key: "staff-gaps",
        label: "Staff gaps",
        detail: "Well covered",
        count: 0,
        severity: "clear",
        href: null,
      },
    ];
    const { getByText } = render(<PendingBookingsStripe rows={rows} groups={[]} />);
    expect(getByText("All caught up")).toBeTruthy();
  });

  it("caps rendering to the top 5 active rows", () => {
    const rows: AttentionSummaryRow[] = Array.from({ length: 7 }, (_, i) => ({
      key: `row-${i}`,
      label: `Signal ${i}`,
      detail: "Needs review",
      count: 1,
      severity: "warning" as const,
      href: null,
    }));
    const { container } = render(<PendingBookingsStripe rows={rows} groups={[]} />);
    expect(container.textContent).toContain("Signal 4");
    expect(container.textContent).not.toContain("Signal 5");
  });
});
