import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { QuickLinks } from "../QuickLinks";

describe("QuickLinks", () => {
  it("renders null when given zero links (brief §2.2)", () => {
    const { container } = render(<QuickLinks links={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders all 3 sample links with accessible names + correct hrefs", () => {
    const links = [
      { label: "Today's visits", href: "/admin/bookings?view=today" },
      { label: "Claimable work", href: "/admin/bookings?view=claimable" },
      { label: "My staff profile", href: "/admin/staff/s1" },
    ];
    const { getByRole } = render(<QuickLinks links={links} />);

    for (const link of links) {
      const anchor = getByRole("link", { name: link.label });
      expect(anchor.getAttribute("href")).toBe(link.href);
    }
  });

  it("renders the default 'Quick links' title, overridable via the title prop", () => {
    const links = [{ label: "Dashboard", href: "/admin/dashboard" }];
    const { getByText, rerender } = render(<QuickLinks links={links} />);
    expect(getByText("Quick links")).toBeTruthy();

    rerender(<QuickLinks links={links} title="Owner shortcuts" />);
    expect(getByText("Owner shortcuts")).toBeTruthy();
  });
});
