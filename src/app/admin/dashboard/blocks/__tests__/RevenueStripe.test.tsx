// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { RevenueStripe } from "../RevenueStripe";

describe("blocks/RevenueStripe", () => {
  it("renders each tile's label + value (happy path)", () => {
    const { getByText } = render(
      <RevenueStripe
        tiles={[
          { label: "Today", value: "£85.00" },
          { label: "Week", value: "£445.00" },
          { label: "Month", value: "£1,800.00" },
          { label: "Lifetime", value: "£43,000.00" },
        ]}
      />
    );
    expect(getByText("Today")).toBeTruthy();
    expect(getByText("£445.00")).toBeTruthy();
    expect(getByText("Lifetime")).toBeTruthy();
  });

  it("renders the optional scope note", () => {
    const { getByText } = render(
      <RevenueStripe
        tiles={[{ label: "Today", value: "£0.00" }]}
        scopeNote="Scoped to your reporting range"
      />
    );
    expect(getByText("Scoped to your reporting range")).toBeTruthy();
  });

  it("renders nothing when given zero tiles (e.g. Coordinator has no revenue access)", () => {
    const { container } = render(<RevenueStripe tiles={[]} />);
    expect(container.textContent).toBe("");
  });
});
