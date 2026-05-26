// B-4 step 2 — ScopePill specs.

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ScopePill } from "../ScopePill";

describe("<ScopePill>", () => {
  it("renders 'Scope: {who} · {rangeLabel}' with the leading Filter icon", () => {
    const { container } = render(<ScopePill who="All staff" rangeLabel="Monthly" />);
    const pill = container.querySelector("a");
    expect(pill?.textContent).toContain("Scope:");
    expect(pill?.textContent).toContain("All staff");
    expect(pill?.textContent).toContain("Monthly");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders a 'Me' scope correctly for the Personal flow", () => {
    const { container } = render(<ScopePill who="Me" rangeLabel="This week" />);
    expect(container.querySelector("a")?.textContent).toContain("Me · This week");
  });

  it("renders a staff-name scope correctly for the drill flow", () => {
    const { container } = render(<ScopePill who="Aisha Hassan" rangeLabel="Custom" />);
    expect(container.querySelector("a")?.textContent).toContain("Aisha Hassan · Custom");
  });

  it("anchors to #admin-reports-filters by default for desktop refine-scope jump", () => {
    const { container } = render(<ScopePill who="All staff" rangeLabel="Monthly" />);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("#admin-reports-filters");
  });

  it("accepts a custom filterAnchorId for layouts that target a different form", () => {
    const { container } = render(
      <ScopePill who="All staff" rangeLabel="Monthly" filterAnchorId="custom-anchor" />
    );
    expect(container.querySelector("a")?.getAttribute("href")).toBe("#custom-anchor");
  });
});
