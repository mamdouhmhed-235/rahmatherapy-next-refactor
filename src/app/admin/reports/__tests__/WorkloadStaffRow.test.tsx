// B-4 step 5 — WorkloadStaffRow specs.

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { WorkloadStaffRow } from "../WorkloadStaffRow";
import type { WorkloadRowWithStatus } from "../reports-helpers";

const AISHA: WorkloadRowWithStatus = {
  staffId: "staff-aisha",
  staffName: "Aisha Hassan",
  assigned: 4,
  completed: 8,
  cancelled: 2,
  total: 14,
};

const EMPTY: WorkloadRowWithStatus = {
  staffId: "staff-empty",
  staffName: "Mariam Yusuf",
  assigned: 0,
  completed: 0,
  cancelled: 0,
  total: 0,
};

describe("<WorkloadStaffRow>", () => {
  it("renders the staff name and the count summary line", () => {
    const { container } = render(<WorkloadStaffRow row={AISHA} query="range=month" />);
    expect(container.textContent).toContain("Aisha Hassan");
    expect(container.textContent).toContain("4 assigned · 8 completed · 2 cancelled");
  });

  it("renders the row as a <Link> to /admin/reports with ?staffId set, preserving other filters", () => {
    const { container } = render(
      <WorkloadStaffRow row={AISHA} query="range=month&source=website" />
    );
    const link = container.querySelector("a");
    const href = link?.getAttribute("href") ?? "";
    expect(href.startsWith("/admin/reports?")).toBe(true);
    expect(href).toContain("staffId=staff-aisha");
    expect(href).toContain("range=month");
    expect(href).toContain("source=website");
  });

  it("overwrites an existing staffId in the query (re-drill flow)", () => {
    const { container } = render(
      <WorkloadStaffRow row={AISHA} query="range=month&staffId=other-staff" />
    );
    const href = container.querySelector("a")?.getAttribute("href") ?? "";
    expect(href).toContain("staffId=staff-aisha");
    expect(href).not.toContain("staffId=other-staff");
  });

  it("renders a 3-segment bar with role='img' and the breakdown aria-label", () => {
    const { container } = render(<WorkloadStaffRow row={AISHA} query="" />);
    const bar = container.querySelector("[role='img']");
    expect(bar?.getAttribute("aria-label")).toBe("4 assigned, 8 completed, 2 cancelled");
  });

  it("renders the muted empty-state track when total=0 (no rendered role='img')", () => {
    const { container } = render(<WorkloadStaffRow row={EMPTY} query="" />);
    // total=0 path: track div is aria-hidden and has no role='img'
    expect(container.querySelector("[role='img']")).toBeNull();
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("omits zero-width segments so the bar only contains the non-zero categories", () => {
    const onlyCompleted: WorkloadRowWithStatus = {
      staffId: "s1",
      staffName: "S One",
      assigned: 0,
      completed: 5,
      cancelled: 0,
      total: 5,
    };
    const { container } = render(<WorkloadStaffRow row={onlyCompleted} query="" />);
    const bar = container.querySelector("[role='img']") as HTMLElement;
    expect(bar.children.length).toBe(1);
    expect((bar.children[0] as HTMLElement).getAttribute("title")).toBe("Completed: 5");
  });

  it("exposes data-staff-id for E2E selector targeting", () => {
    const { container } = render(<WorkloadStaffRow row={AISHA} query="" />);
    expect(container.querySelector("a")?.getAttribute("data-staff-id")).toBe("staff-aisha");
  });
});
