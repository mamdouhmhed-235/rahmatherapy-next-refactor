// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PaginationBar } from "./PaginationBar";

describe("PaginationBar — offset mode", () => {
  function makeHref(page: number) {
    return `/admin/clients?page=${page}`;
  }

  it("renders nothing when pageCount is 1", () => {
    const { container } = render(
      <PaginationBar page={1} pageCount={1} total={12} pageSize={25} makeHref={makeHref} />
    );
    expect(container.textContent).toBe("");
  });

  it("renders nothing when pageCount is 0", () => {
    const { container } = render(
      <PaginationBar page={1} pageCount={0} total={0} pageSize={25} makeHref={makeHref} />
    );
    expect(container.textContent).toBe("");
  });

  it("renders the readout with thousands separators and tabular-nums", () => {
    const { getByText } = render(
      <PaginationBar page={2} pageCount={137} total={3412} pageSize={25} makeHref={makeHref} />
    );
    const readout = getByText("Showing 26–50 of 3,412");
    expect(readout.className).toContain("tabular-nums");
  });

  it("disables Previous (renders a non-link) on page 1", () => {
    const { getByLabelText } = render(
      <PaginationBar page={1} pageCount={5} total={125} pageSize={25} makeHref={makeHref} />
    );
    const prev = getByLabelText("Previous page");
    expect(prev.tagName).toBe("SPAN");
    expect(prev.getAttribute("aria-disabled")).toBe("true");
  });

  it("renders Previous as a real link on any page after the first", () => {
    const { getByLabelText } = render(
      <PaginationBar page={2} pageCount={5} total={125} pageSize={25} makeHref={makeHref} />
    );
    const prev = getByLabelText("Previous page");
    expect(prev.tagName).toBe("A");
    expect(prev.getAttribute("href")).toBe("/admin/clients?page=1");
  });

  it("disables Next (renders a non-link) on the last page", () => {
    const { getByLabelText } = render(
      <PaginationBar page={5} pageCount={5} total={125} pageSize={25} makeHref={makeHref} />
    );
    const next = getByLabelText("Next page");
    expect(next.tagName).toBe("SPAN");
    expect(next.getAttribute("aria-disabled")).toBe("true");
  });

  it("renders Next as a real link on any page before the last", () => {
    const { getByLabelText } = render(
      <PaginationBar page={2} pageCount={5} total={125} pageSize={25} makeHref={makeHref} />
    );
    const next = getByLabelText("Next page");
    expect(next.tagName).toBe("A");
    expect(next.getAttribute("href")).toBe("/admin/clients?page=3");
  });

  it("computes the readout's upper bound from total on the final, partial page", () => {
    const { getByText } = render(
      <PaginationBar page={5} pageCount={5} total={112} pageSize={25} makeHref={makeHref} />
    );
    expect(getByText("Showing 101–112 of 112")).toBeTruthy();
  });
});

describe("PaginationBar — cursor mode", () => {
  it("renders nothing when neither prevHref nor nextHref is present", () => {
    const { container } = render(<PaginationBar mode="cursor" />);
    expect(container.textContent).toBe("");
  });

  it("shows no total readout", () => {
    const { container } = render(
      <PaginationBar mode="cursor" nextHref="/admin/audit?cursor=abc" />
    );
    expect(container.textContent).not.toMatch(/of \d/);
  });

  it("disables Previous (renders a non-link) with no prevHref", () => {
    const { getByLabelText } = render(
      <PaginationBar mode="cursor" nextHref="/admin/audit?cursor=abc" />
    );
    const prev = getByLabelText("Previous page");
    expect(prev.tagName).toBe("SPAN");
  });

  it("renders Next as a real link when nextHref is present", () => {
    const { getByLabelText } = render(
      <PaginationBar mode="cursor" nextHref="/admin/audit?cursor=abc" />
    );
    const next = getByLabelText("Next page");
    expect(next.tagName).toBe("A");
    expect(next.getAttribute("href")).toBe("/admin/audit?cursor=abc");
  });

  it("disables Next (renders a non-link) with no nextHref", () => {
    const { getByLabelText } = render(
      <PaginationBar mode="cursor" prevHref="/admin/audit?cursor=xyz" />
    );
    const next = getByLabelText("Next page");
    expect(next.tagName).toBe("SPAN");
  });
});
