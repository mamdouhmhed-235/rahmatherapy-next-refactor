// @vitest-environment jsdom
//
// B-5 step 5: MobileStickyActionBar render contract. The action shape is
// pre-computed by mobileStickyActionForVariant() (covered in
// dashboard-helpers-b5.test.ts). These specs verify the rendering layer:
// presence/absence, a11y role, primary/secondary distinction, external vs
// internal link handling, mobile-only visibility class.

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MobileStickyActionBar } from "./MobileStickyActionBar";
import type { MobileStickyAction } from "./dashboard-helpers-b5";

describe("MobileStickyActionBar", () => {
  it("renders nothing when action is null", () => {
    const { container } = render(<MobileStickyActionBar action={null} />);
    expect(container.querySelector('[role="region"]')).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("renders region role + 'Quick actions' aria-label (SHARED-NOTES §3)", () => {
    const action: MobileStickyAction = {
      primary: { label: "Assign 3 unassigned →", href: "/admin/bookings?view=unassigned" },
    };
    const { container } = render(<MobileStickyActionBar action={action} />);
    const region = container.querySelector('[role="region"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-label")).toBe("Quick actions");
  });

  it("primary-only action renders one link", () => {
    const action: MobileStickyAction = {
      primary: {
        label: "Assign 3 unassigned →",
        href: "/admin/bookings?view=unassigned",
      },
    };
    const { container, getByText } = render(
      <MobileStickyActionBar action={action} />
    );
    expect(getByText("Assign 3 unassigned →")).toBeTruthy();
    const links = container.querySelectorAll("a, [data-testid]");
    expect(container.querySelectorAll("a").length).toBe(1);
    void links;
  });

  it("primary + secondary renders both side-by-side", () => {
    const action: MobileStickyAction = {
      primary: {
        label: "Open in Maps",
        href: "https://www.google.com/maps/search/?api=1&query=foo",
        external: true,
      },
      secondary: { label: "Call client", href: "tel:07700900000", external: true },
    };
    const { container, getByText } = render(
      <MobileStickyActionBar action={action} />
    );
    expect(getByText("Open in Maps")).toBeTruthy();
    expect(getByText("Call client")).toBeTruthy();
    expect(container.querySelectorAll("a").length).toBe(2);
  });

  it("external items render as native <a> (tel: and Maps survive correctly)", () => {
    const action: MobileStickyAction = {
      primary: { label: "Call client", href: "tel:07700900000", external: true },
    };
    const { container } = render(<MobileStickyActionBar action={action} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("tel:07700900000");
  });

  it("internal items render via next/link (relative href preserved)", () => {
    const action: MobileStickyAction = {
      primary: {
        label: "Browse claimable →",
        href: "/admin/bookings?view=claimable",
      },
    };
    const { container } = render(<MobileStickyActionBar action={action} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/admin/bookings?view=claimable");
  });

  it("bar is hidden on md+ via 'md:hidden' utility class", () => {
    const action: MobileStickyAction = {
      primary: { label: "x", href: "/x" },
    };
    const { container } = render(<MobileStickyActionBar action={action} />);
    const region = container.querySelector('[role="region"]');
    expect(region?.className).toContain("md:hidden");
  });

  it("bar is positioned fixed to bottom of viewport (mobile sticky)", () => {
    const action: MobileStickyAction = {
      primary: { label: "x", href: "/x" },
    };
    const { container } = render(<MobileStickyActionBar action={action} />);
    const region = container.querySelector('[role="region"]');
    // Tailwind: `fixed bottom-0 inset-x-0 z-40` — assert each piece.
    expect(region?.className).toContain("fixed");
    expect(region?.className).toContain("bottom-0");
    expect(region?.className).toContain("inset-x-0");
    expect(region?.className).toContain("z-40");
    // jsdom strips env() from CSSOM, so safe-area-inset-bottom is verified at
    // the Playwright layer (step 15) instead of here.
  });
});
