import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClientRowMenu, type LastBookingSummary } from "../ClientRowMenu";

// The popover is a Radix portal driven by floating-ui, which needs browser APIs
// jsdom doesn't provide. Only the affordances *inside* the menu are under test,
// so render the content inline and leave Radix out of it.
vi.mock("../../components/admin-popover", () => ({
  Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Trigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Pulls in `sonner` + the delete server action; irrelevant to the links here.
vi.mock("../components/DeleteClientButton", () => ({
  DeleteClientButton: () => <button type="button">Delete client</button>,
}));

const CLIENT_ID = "3f7b1f2e-6c1a-4f0e-9a5d-2b8c4e6d1a90";

const noBookings: LastBookingSummary = { lastVisit: null, nextBooking: null };

function profileLink() {
  return screen.queryByRole("link", { name: "View client profile" });
}

function auditLink() {
  return screen.getByRole("link", { name: "View audit history" });
}

describe("ClientRowMenu", () => {
  it("offers the client profile on a live row", () => {
    render(
      <ClientRowMenu
        clientId={CLIENT_ID}
        clientName="Sara Mohamed"
        lastBooking={noBookings}
      />
    );

    expect(profileLink()?.getAttribute("href")).toBe(
      `/admin/clients/${CLIENT_ID}`
    );
  });

  // The detail route calls `notFound()` on a soft-deleted client, so offering
  // "View client profile" there is a link straight to a 404 (brief §5.3).
  it("drops the profile link on a soft-deleted row", () => {
    render(
      <ClientRowMenu
        clientId={CLIENT_ID}
        clientName="Sara Mohamed"
        lastBooking={noBookings}
        deleted
      />
    );

    expect(profileLink()).toBeNull();
    expect(screen.queryByRole("link", { name: "Start new booking" })).toBeNull();
  });

  // `target_type=client` (singular) matched nothing: C-06 writes client rows as
  // `target_type: "clients"` and the audit page filters with an exact `eq`,
  // having first dropped any value missing from its singular option list. It
  // reads no `target_id` param at all. `q` is the audit query's full-UUID lookup
  // across `id / target_id / actor_staff_id`.
  it.each([
    ["live", false],
    ["soft-deleted", true],
  ])("points audit history at this client's rows on a %s row", (_label, deleted) => {
    render(
      <ClientRowMenu
        clientId={CLIENT_ID}
        clientName="Sara Mohamed"
        lastBooking={noBookings}
        deleted={deleted}
      />
    );

    const href = auditLink().getAttribute("href") ?? "";
    expect(href).toBe(`/admin/audit?q=${CLIENT_ID}`);
    expect(href).not.toContain("target_type=");
    expect(href).not.toContain("target_id=");
  });
});
