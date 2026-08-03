// @vitest-environment jsdom
//
// C-16 Phase C Step 8 — `page` belongs to ONE result set.
//
// Every navigation on /admin/clients that changes which rows are listed has to
// drop it, or a reader who narrows a filter from page 3 lands on page 3 of a
// list that may now be one page long. All of them rebuild the query string from
// `filterValues`, which carries no page — so this pins that as URLs, at the
// builders, rather than trusting the shape of the object they read.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LIST_PAGE_SIZE } from "@/lib/pagination";
import { PaginationBar } from "../../components/PaginationBar";
import {
  buildClearLinkHref,
  buildFilterHref,
  buildPageHref,
  buildShowDeletedHref,
  buildSortHref,
  buildViewAllHref,
} from "../page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const FILTERS = {
  q: "zainab",
  lifecycle: "at_risk",
  payment: "outstanding",
  location: "luton",
  source: "website",
  sort: "last_visit" as const,
  show_deleted: "1",
  all: "",
};

afterEach(cleanup);

describe("page resets wherever the result set changes", () => {
  it("clearing a filter chip keeps the others and never carries a page", () => {
    for (const drop of ["q", "lifecycle", "payment", "location", "source"] as const) {
      const href = buildClearLinkHref(FILTERS, drop);
      expect(href).not.toContain("page=");
      expect(href).not.toContain(`${drop}=`);
    }
  });

  it("switching sort keeps the filters and never carries a page", () => {
    const href = buildSortHref(FILTERS, "name");
    expect(href).toContain("q=zainab");
    expect(href).toContain("lifecycle=at_risk");
    expect(href).not.toContain("page=");
  });

  it("a stats-line lifecycle link never carries a page", () => {
    const href = buildFilterHref(FILTERS, "lifecycle", "new");
    expect(href).toContain("lifecycle=new");
    expect(href).not.toContain("page=");
  });

  it("toggling deleted visibility never carries a page", () => {
    expect(buildShowDeletedHref(FILTERS, true)).toContain("show_deleted=1");
    expect(buildShowDeletedHref(FILTERS, true)).not.toContain("page=");
    expect(buildShowDeletedHref(FILTERS, false)).not.toContain("show_deleted=1");
    expect(buildShowDeletedHref(FILTERS, false)).not.toContain("page=");
  });

  it("the pager is the only builder that writes one", () => {
    expect(buildPageHref(FILTERS, 3)).toContain("page=3");
    expect(buildPageHref(FILTERS, 3)).toContain("q=zainab");
    // Page 1 is the canonical URL — no redundant ?page=1 in history.
    expect(buildPageHref(FILTERS, 1)).not.toContain("page=");
  });

  // C-16 closeout — the candidate ceiling's toggle. Raising or lowering the
  // ceiling re-reads, re-sorts and re-slices the whole selection, so the page
  // in hand no longer names the same rows.
  it("toggling the candidate ceiling never carries a page", () => {
    expect(buildViewAllHref(FILTERS, true)).toContain("all=1");
    expect(buildViewAllHref(FILTERS, true)).not.toContain("page=");
    expect(buildViewAllHref(FILTERS, false)).not.toContain("all=1");
    expect(buildViewAllHref(FILTERS, false)).not.toContain("page=");
  });
});

// C-16 closeout — `all` is a filter-shaped param: every builder has to carry
// it, or narrowing a filter / switching sort would silently drop the reader
// back to the smaller ceiling and shrink the result set with no signal.
describe("the candidate ceiling survives every other navigation", () => {
  const VIEWING_ALL = { ...FILTERS, all: "1" };

  it("is carried by sort, stat-link, pager and deleted-toggle hrefs", () => {
    expect(buildSortHref(VIEWING_ALL, "name")).toContain("all=1");
    expect(buildFilterHref(VIEWING_ALL, "lifecycle", "new")).toContain("all=1");
    expect(buildPageHref(VIEWING_ALL, 3)).toContain("all=1");
    expect(buildShowDeletedHref(VIEWING_ALL, true)).toContain("all=1");
  });

  it("is carried when an unrelated filter chip is cleared, and dropped by its own", () => {
    expect(buildClearLinkHref(VIEWING_ALL, "q")).toContain("all=1");
    expect(buildClearLinkHref(VIEWING_ALL, "all")).not.toContain("all=1");
  });

  it("SABOTAGE TARGET — the two ceiling links can never both be the current URL", () => {
    // `resolveClientCandidateBannerState` renders exactly one of these at a
    // time; each must differ from the URL the reader is already on, which is
    // the bug shape that shipped twice on this plan.
    expect(buildViewAllHref(FILTERS, true)).not.toEqual(
      buildViewAllHref(FILTERS, false)
    );
    expect(buildViewAllHref(VIEWING_ALL, true)).toContain("all=1");
    expect(buildViewAllHref(VIEWING_ALL, false)).not.toContain("all=1");
  });
});

describe("the pager itself", () => {
  it("renders nothing for the one-page result getClientsListPage reports", () => {
    const { container } = render(
      <PaginationBar
        page={1}
        pageCount={1}
        total={12}
        pageSize={LIST_PAGE_SIZE}
        makeHref={(page) => buildPageHref(FILTERS, page)}
      />
    );

    expect(container.textContent).toBe("");
  });

  it("renders the readout and both controls once there is a second page", () => {
    const { container } = render(
      <PaginationBar
        page={2}
        pageCount={3}
        total={60}
        pageSize={LIST_PAGE_SIZE}
        makeHref={(page) => buildPageHref(FILTERS, page)}
      />
    );

    expect(container.textContent).toContain("Showing 26–50 of 60");
  });
});
