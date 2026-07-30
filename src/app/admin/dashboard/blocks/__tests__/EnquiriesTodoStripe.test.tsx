// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { EnquiriesTodoStripe } from "../EnquiriesTodoStripe";
import type { ActiveEnquiryRow } from "../EnquiriesTodoStripe";

function enquiries(): ActiveEnquiryRow[] {
  return [
    {
      id: "e1",
      fullName: "Jane Doe",
      source: "website",
      status: "new",
      createdAt: new Date().toISOString(),
    },
  ];
}

describe("blocks/EnquiriesTodoStripe (was ActiveEnquiriesCard)", () => {
  it("renders the active count + enquiry rows (happy path)", () => {
    const { getByText } = render(
      <EnquiriesTodoStripe enquiries={enquiries()} totalActive={1} canManageEnquiries={true} />
    );
    expect(getByText("Active enquiries")).toBeTruthy();
    expect(getByText("Jane Doe")).toBeTruthy();
  });

  it("renders the empty-state copy when there are no active enquiries", () => {
    const { getByText } = render(
      <EnquiriesTodoStripe enquiries={[]} totalActive={0} canManageEnquiries={true} />
    );
    expect(getByText("No active enquiries")).toBeTruthy();
  });

  it("hides the 'All enquiries' link when the viewer lacks canManageEnquiries", () => {
    const { queryByText } = render(
      <EnquiriesTodoStripe enquiries={enquiries()} totalActive={1} canManageEnquiries={false} />
    );
    expect(queryByText("All enquiries")).toBeNull();
  });
});
