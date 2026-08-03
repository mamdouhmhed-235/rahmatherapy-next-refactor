// @vitest-environment jsdom
//
// C-16 Phase C Step 8 — `page` belongs to ONE result set.
//
// /admin/enquiries builds every tab link, filter chip, stat link and the sort
// select from ONE `URLSearchParams` that is constructed without ever reading
// `params.page`. That is the whole reset mechanism, so it is pinned here at the
// function that builds it — and then again through the sort select, which is
// the one navigation that happens in the browser rather than as an href.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIST_PAGE_SIZE } from "@/lib/pagination";
import { PaginationBar } from "../../components/PaginationBar";
import { EnquirySortSelect } from "../EnquiryList";
import { buildEnquiryPageHref, buildEnquiryUrlParams } from "../page";

const nav = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  }),
}));

beforeEach(() => {
  nav.push.mockReset();
});

afterEach(cleanup);

describe("the canonical query string never carries a page", () => {
  it("drops ?page= while keeping every filter that narrows the list", () => {
    const params = buildEnquiryUrlParams({
      tab: "contacted",
      source: "website",
      assigned_staff: "unassigned",
      from: "2026-03-01",
      to: "2026-03-31",
      q: "zainab",
      sort: "oldest",
      page: "7",
    });

    expect(params.get("page")).toBeNull();
    expect(params.toString()).not.toContain("page=");
    expect(params.get("tab")).toBe("contacted");
    expect(params.get("source")).toBe("website");
    expect(params.get("assigned_staff")).toBe("unassigned");
    expect(params.get("from")).toBe("2026-03-01");
    expect(params.get("to")).toBe("2026-03-31");
    expect(params.get("q")).toBe("zainab");
    expect(params.get("sort")).toBe("oldest");
  });

  it("omits the default tab and sort so the canonical URL stays bare", () => {
    const params = buildEnquiryUrlParams({ tab: "all", sort: "newest", page: "3" });
    expect(params.toString()).toBe("");
  });

  it("ignores values it does not recognise", () => {
    const params = buildEnquiryUrlParams({ tab: "banana", sort: "sideways" });
    expect(params.get("tab")).toBeNull();
    expect(params.get("sort")).toBeNull();
  });
});

describe("the pager is the only thing that writes a page", () => {
  it("adds it for page 2 and leaves page 1 canonical", () => {
    const params = buildEnquiryUrlParams({ tab: "new", q: "zainab" });

    expect(buildEnquiryPageHref(params, 2)).toContain("page=2");
    expect(buildEnquiryPageHref(params, 2)).toContain("q=zainab");
    expect(buildEnquiryPageHref(params, 1)).not.toContain("page=");
  });

  it("falls back to the bare path when nothing is set", () => {
    expect(buildEnquiryPageHref(new URLSearchParams(), 1)).toBe("/admin/enquiries");
  });
});

describe("changing the sort restarts at page 1", () => {
  it("pushes a URL with the new sort and no page, from a page-3 request", async () => {
    const params = buildEnquiryUrlParams({ tab: "new", page: "3" });
    render(
      <EnquirySortSelect currentSort="newest" urlParamsString={params.toString()} />
    );

    await userEvent.selectOptions(screen.getByLabelText("Sort"), "oldest");

    expect(nav.push).toHaveBeenCalledTimes(1);
    const pushed = nav.push.mock.calls[0][0] as string;
    expect(pushed).toContain("sort=oldest");
    expect(pushed).toContain("tab=new");
    expect(pushed).not.toContain("page=");
  });
});

describe("the pager itself", () => {
  it("renders nothing for the one-page result getEnquiriesListPage reports", () => {
    const { container } = render(
      <PaginationBar
        page={1}
        pageCount={1}
        total={3}
        pageSize={LIST_PAGE_SIZE}
        makeHref={(page) => buildEnquiryPageHref(new URLSearchParams(), page)}
      />
    );

    expect(container.textContent).toBe("");
  });
});
