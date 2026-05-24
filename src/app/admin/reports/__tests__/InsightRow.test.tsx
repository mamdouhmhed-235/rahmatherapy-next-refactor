// B-4 step 3 — InsightRow specs covering the optimistic dismiss flow,
// severity icon switching, drill-link gating, and aria-label compliance.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor, act } from "@testing-library/react";
import { InsightRow } from "../InsightRow";

const dismissMock = vi.fn();
vi.mock("../insight-actions", () => ({
  dismissInsight: (id: string) => dismissMock(id),
}));

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

beforeEach(() => {
  dismissMock.mockReset();
  toastErrorMock.mockReset();
});

describe("<InsightRow>", () => {
  it("renders the message text with AlertTriangle for critical severity", () => {
    dismissMock.mockResolvedValue({ success: true });
    const { container } = render(
      <InsightRow
        insightId="collection-low-85pct-month-2026-05"
        severity="critical"
        message="Net collection rate fell to 85%."
      />
    );
    expect(container.textContent).toContain("Net collection rate fell to 85%");
    expect(container.querySelector("svg.lucide-triangle-alert")).not.toBeNull();
  });

  it("renders AlertCircle for warning severity", () => {
    dismissMock.mockResolvedValue({ success: true });
    const { container } = render(
      <InsightRow insightId="i-1" severity="warning" message="warn" />
    );
    expect(container.querySelector("svg.lucide-circle-alert")).not.toBeNull();
  });

  it("renders Sparkles for info severity", () => {
    dismissMock.mockResolvedValue({ success: true });
    const { container } = render(
      <InsightRow insightId="i-1" severity="info" message="info" />
    );
    expect(container.querySelector("svg.lucide-sparkles")).not.toBeNull();
  });

  it("renders the View → drill link only when drillHref is set", () => {
    dismissMock.mockResolvedValue({ success: true });
    const { container, rerender } = render(
      <InsightRow insightId="i-1" severity="warning" message="warn" />
    );
    expect(container.querySelector("a")).toBeNull();

    rerender(
      <InsightRow
        insightId="i-1"
        severity="warning"
        message="warn"
        drillHref="/admin/enquiries?tab=new"
      />
    );
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/admin/enquiries?tab=new");
  });

  it("attaches the dismiss aria-label with the message body for screen readers", () => {
    dismissMock.mockResolvedValue({ success: true });
    const { container } = render(
      <InsightRow insightId="i-1" severity="warning" message="Outstanding grew." />
    );
    const dismiss = container.querySelector('button[aria-label]');
    expect(dismiss?.getAttribute("aria-label")).toBe("Dismiss insight: Outstanding grew.");
  });

  it("optimistically removes the row when dismiss is clicked (success path)", async () => {
    dismissMock.mockResolvedValue({ success: true });
    const { container } = render(
      <InsightRow insightId="i-1" severity="warning" message="warn" />
    );
    const dismiss = container.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(dismiss);
    });
    expect(container.firstChild).toBeNull();
    expect(dismissMock).toHaveBeenCalledWith("i-1");
  });

  it("rolls back the row + fires a toast.error when the server action errors", async () => {
    dismissMock.mockResolvedValue({ error: "boom" });
    const { container } = render(
      <InsightRow insightId="i-1" severity="warning" message="warn" />
    );
    const dismiss = container.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(dismiss);
    });
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
      // Row should still be visible after rollback.
      expect(container.querySelector("[data-insight-id]")).not.toBeNull();
    });
  });
});
