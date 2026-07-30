// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { DashboardHeader } from "../DashboardHeader";

describe("blocks/DashboardHeader", () => {
  it("renders title, subtitle and role badge (happy path)", () => {
    const { getByText } = render(
      <DashboardHeader
        title="Today at Rahma Therapy"
        subtitle="Thursday, 30 July · Luton"
        lastChecked="09:00"
        roleLabel="Owner"
      />
    );
    expect(getByText("Today at Rahma Therapy")).toBeTruthy();
    expect(getByText("Thursday, 30 July · Luton")).toBeTruthy();
    expect(getByText("Owner")).toBeTruthy();
  });

  it("omits the role badge when roleLabel is absent (empty state)", () => {
    const { container, getByText } = render(
      <DashboardHeader title="Dashboard" subtitle="Today" lastChecked="09:00" />
    );
    expect(getByText("Dashboard")).toBeTruthy();
    expect(container.querySelector("[aria-label^='Signed in as']")).toBeNull();
  });

  it("re-exports the canonical dashboard-header component", async () => {
    const canonical = await import("../../dashboard-header");
    const block = await import("../DashboardHeader");
    expect(block.DashboardHeader).toBe(canonical.DashboardHeader);
  });
});
