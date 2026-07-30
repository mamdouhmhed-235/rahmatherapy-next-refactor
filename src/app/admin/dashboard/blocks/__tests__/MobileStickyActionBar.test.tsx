// @vitest-environment jsdom
//
// Light smoke coverage for the blocks/ re-export — full behavioural coverage
// (external vs internal links, primary+secondary, a11y role, safe-area
// padding) already lives in dashboard/MobileStickyActionBar.test.tsx; this
// spec only confirms the re-export renders correctly and stays wired to the
// canonical component.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MobileStickyActionBar } from "../MobileStickyActionBar";
import type { MobileStickyAction } from "../../dashboard-helpers-b5";

describe("blocks/MobileStickyActionBar", () => {
  it("renders nothing when action is null (empty state)", () => {
    const { container } = render(<MobileStickyActionBar action={null} />);
    expect(container.textContent).toBe("");
  });

  it("renders the primary action label (happy path)", () => {
    const action: MobileStickyAction = {
      primary: {
        label: "Assign 2 unassigned →",
        href: "/admin/bookings?view=unassigned",
      },
    };
    const { getByText } = render(<MobileStickyActionBar action={action} />);
    expect(getByText("Assign 2 unassigned →")).toBeTruthy();
  });

  it("re-exports the canonical component", async () => {
    const canonical = await import("../../MobileStickyActionBar");
    const block = await import("../MobileStickyActionBar");
    expect(block.MobileStickyActionBar).toBe(canonical.MobileStickyActionBar);
  });
});
