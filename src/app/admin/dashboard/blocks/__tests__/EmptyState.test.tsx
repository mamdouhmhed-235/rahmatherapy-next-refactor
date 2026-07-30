// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "../EmptyState";

describe("blocks/EmptyState", () => {
  it("renders icon, title and message (happy path)", () => {
    const { getByText } = render(
      <EmptyState icon={CalendarDays} title="Quiet day" message="Nothing in your queue." />
    );
    expect(getByText("Quiet day")).toBeTruthy();
    expect(getByText("Nothing in your queue.")).toBeTruthy();
  });

  it("renders an action link when provided", () => {
    const { getByText } = render(
      <EmptyState
        icon={CalendarDays}
        title="No bookings yet"
        message="New bookings will appear here."
        action={{ label: "Create booking", href: "/admin/bookings/new" }}
      />
    );
    const link = getByText("Create booking").closest("a");
    expect(link?.getAttribute("href")).toBe("/admin/bookings/new");
  });

  it("re-exports the canonical admin EmptyState component", async () => {
    const canonical = await import("../../../components/EmptyState");
    const block = await import("../EmptyState");
    expect(block.EmptyState).toBe(canonical.EmptyState);
  });
});
