// B-4 step 3 — InsightsStripe specs (rendering only; dismiss UX is covered
// in InsightRow.test.tsx).

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { InsightsStripe } from "../InsightsStripe";
import type { ReportInsight } from "../report-insights";

// dismissInsight is invoked from the client InsightRow; we don't exercise
// that path here but the mock prevents the server-action import from
// crashing under jsdom.
vi.mock("../insight-actions", () => ({
  dismissInsight: vi.fn().mockResolvedValue({ success: true }),
}));

const SAMPLE: ReportInsight[] = [
  {
    id: "bookings-dropped-20pct-month-2026-05",
    severity: "warning",
    message: "Bookings this month are 20% lower than the prior month.",
  },
  {
    id: "collection-low-85pct-month-2026-05",
    severity: "critical",
    message: "Net collection rate fell to 85% — below the 95% benchmark.",
    drillUrl: "/admin/reports?paymentStatus=unpaid",
  },
];

describe("<InsightsStripe>", () => {
  it("renders nothing when insights is empty (no placeholder)", () => {
    const { container } = render(<InsightsStripe insights={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one row per insight with the message text", () => {
    const { container } = render(<InsightsStripe insights={SAMPLE} />);
    const rows = container.querySelectorAll("[data-insight-id]");
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain("Bookings this month are 20% lower");
    expect(rows[1].textContent).toContain("Net collection rate fell to 85%");
  });

  it("renders a section with role='status' for screen-reader live updates (a11y §3)", () => {
    const { container } = render(<InsightsStripe insights={SAMPLE} />);
    const section = container.querySelector("section");
    expect(section?.getAttribute("role")).toBe("status");
    expect(section?.getAttribute("aria-live")).toBe("polite");
    expect(section?.getAttribute("aria-label")).toBe("Insights");
  });

  it("renders a 'View →' drill link only when drillUrl is set", () => {
    const { container } = render(<InsightsStripe insights={SAMPLE} />);
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(1);
    expect(links[0].textContent).toContain("View");
    expect(links[0].getAttribute("href")).toBe("/admin/reports?paymentStatus=unpaid");
  });
});
