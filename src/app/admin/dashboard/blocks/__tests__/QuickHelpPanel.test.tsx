// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { QuickHelpPanel } from "../QuickHelpPanel";
import type { QuickHelpLink } from "../../therapist-fullness";

function links(): QuickHelpLink[] {
  return [
    { key: "profile", label: "Update profile", href: "/admin/me" },
    { key: "availability", label: "Set availability", href: "/admin/staff/1/availability" },
  ];
}

describe("blocks/QuickHelpPanel", () => {
  it("renders every link label (happy path)", () => {
    const { getByText } = render(<QuickHelpPanel links={links()} />);
    expect(getByText("Update profile")).toBeTruthy();
    expect(getByText("Set availability")).toBeTruthy();
  });

  it("renders nothing when the link list is empty", () => {
    const { container } = render(<QuickHelpPanel links={[]} />);
    expect(container.textContent).toBe("");
  });
});
