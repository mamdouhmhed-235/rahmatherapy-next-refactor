// @vitest-environment jsdom
//
// Locks in B-5 M2 fix on <OperationsHealthCard>: panel-level "View details"
// link removed; each active row carries its own href + "View →" affordance.

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { OperationsHealthCard } from "./dashboard-cards";

const fullAccess = {
  emails: true,
  operations: true,
  staff: true,
  enquiries: true,
};

describe("OperationsHealthCard (M2 fix)", () => {
  it("does NOT render a panel-level 'View details' link", () => {
    const { container } = render(
      <OperationsHealthCard
        failedEmails={2}
        openEnquiries={0}
        openOperations={1}
        availabilityGaps={0}
        permissionAccess={fullAccess}
      />
    );
    const links = Array.from(container.querySelectorAll("a"));
    expect(
      links.some((a) => a.textContent?.trim() === "View details")
    ).toBe(false);
  });

  it("renders each active row as a Link with its own href", () => {
    const { container } = render(
      <OperationsHealthCard
        failedEmails={3}
        openEnquiries={0}
        openOperations={2}
        availabilityGaps={1}
        permissionAccess={fullAccess}
      />
    );
    const emailLink = container.querySelector<HTMLAnchorElement>(
      "a[data-row-key='emails']"
    );
    const opsLink = container.querySelector<HTMLAnchorElement>(
      "a[data-row-key='operations']"
    );
    const staffLink = container.querySelector<HTMLAnchorElement>(
      "a[data-row-key='staff']"
    );
    expect(emailLink?.getAttribute("href")).toBe("/admin/emails");
    expect(opsLink?.getAttribute("href")).toBe("/admin/operations");
    expect(staffLink?.getAttribute("href")).toBe("/admin/staff");
  });

  it("each active row carries a visible 'View →' affordance", () => {
    const { container } = render(
      <OperationsHealthCard
        failedEmails={2}
        openEnquiries={0}
        openOperations={0}
        availabilityGaps={0}
        permissionAccess={fullAccess}
      />
    );
    const emailLink = container.querySelector(
      "a[data-row-key='emails']"
    );
    expect(emailLink?.textContent).toContain("View →");
  });

  it("rows without permission render as static content (no anchor)", () => {
    const { container } = render(
      <OperationsHealthCard
        failedEmails={2}
        openEnquiries={1}
        openOperations={1}
        availabilityGaps={1}
        permissionAccess={{
          emails: false,
          operations: false,
          staff: false,
          enquiries: false,
        }}
      />
    );
    // No row should be wrapped in an anchor when permissions are absent.
    expect(container.querySelector("a[data-row-key]")).toBeNull();
    // …and no stray "View →" affordance either.
    expect(container.textContent).not.toContain("View →");
  });

  it("'All clear' state hides the priority list but keeps the clear-line footer", () => {
    const { container } = render(
      <OperationsHealthCard
        failedEmails={0}
        openEnquiries={0}
        openOperations={0}
        availabilityGaps={0}
        permissionAccess={fullAccess}
      />
    );
    expect(container.querySelector("a[data-row-key]")).toBeNull();
    expect(container.textContent).toContain("All clear");
  });
});
