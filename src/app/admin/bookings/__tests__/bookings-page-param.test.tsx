// @vitest-environment jsdom
//
// C-16 Phase C Step 7 — `page` belongs to ONE result set.
//
// Every navigation that changes which rows are listed has to drop it, or a
// reader who switches view from page 3 lands on page 3 of a list that may now
// be one page long (or empty). The paths are spread across three surfaces —
// the view chips, the filter chrome, the saved views — so they are pinned
// together here, as URLs, rather than one by one at their call sites.
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIST_PAGE_SIZE } from "@/lib/pagination";
import { PaginationBar } from "../../components/PaginationBar";
import { BookingsChrome } from "../BookingsChrome";
import { buildClearSearchHref } from "../page";

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, refresh: vi.fn() }),
  useSearchParams: () => nav.searchParams,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  }),
}));

const STAFF_ID = "staff-1";

function renderChrome({
  query,
  canViewAll = true,
  viewCounts,
}: {
  query: Record<string, string>;
  canViewAll?: boolean;
  viewCounts?: Partial<Record<string, number>>;
}) {
  nav.searchParams = new URLSearchParams(query);
  return render(
    <BookingsChrome
      currentView={(query.view ?? "attention") as never}
      query={query}
      services={[]}
      staff={[]}
      canViewAll={canViewAll}
      staffId={STAFF_ID}
      viewCounts={viewCounts as never}
    />
  );
}

/**
 * The view chips only — not the chrome's other links (e.g. "Clear filters").
 * The overflow chips carry `role="menuitem"`, which replaces their implicit
 * link role, so both roles have to be collected.
 */
function chipHrefs() {
  const nav = within(screen.getByRole("navigation", { name: "Booking views" }));
  return [...nav.queryAllByRole("link"), ...nav.queryAllByRole("menuitem")].map(
    (chip) => chip.getAttribute("href") ?? ""
  );
}

beforeEach(() => {
  nav.push.mockReset();
  window.localStorage.clear();
});

afterEach(cleanup);

describe("page resets when the result set changes", () => {
  it("view chips carry every filter across but never the page", async () => {
    renderChrome({
      query: { view: "attention", status: "pending", location: "luton", page: "3" },
    });

    // The overflow chips live behind "More", so open it and assert on both.
    await userEvent.click(screen.getByRole("button", { name: /more/i }));

    const hrefs = chipHrefs();
    expect(hrefs).toHaveLength(11);
    for (const href of hrefs) {
      expect(href).toContain("status=pending");
      expect(href).toContain("location=luton");
      expect(href).not.toContain("page=");
    }
  });

  it("clearing one filter chip drops the page with it", async () => {
    renderChrome({ query: { view: "all", status: "pending", page: "4" } });

    await userEvent.click(screen.getByLabelText("Clear Status filter"));

    expect(nav.push).toHaveBeenCalledTimes(1);
    const pushed = nav.push.mock.calls[0][0] as string;
    expect(pushed).not.toContain("page=");
    expect(pushed).toContain("view=all");
  });

  it("the filter form has no page field, so submitting a search starts at page 1", () => {
    const { container } = renderChrome({
      query: { view: "all", search: "zainab", page: "6" },
    });

    expect(container.querySelector('[name="page"]')).toBeNull();
    // The form's only carried-over param is the view.
    expect(container.querySelector('input[name="view"]')).not.toBeNull();
  });

  it("buildClearSearchHref keeps the other filters and drops the page", () => {
    const href = buildClearSearchHref("all", {
      view: "all",
      search: "zainab",
      status: "pending",
      page: "5",
    });

    expect(href).toContain("status=pending");
    expect(href).not.toContain("search=");
    expect(href).not.toContain("page=");
  });
});

describe("saved views store filters, never a page", () => {
  it("saving from page 3 persists a page-free query string", async () => {
    renderChrome({ query: { view: "all", payment_status: "unpaid", page: "3" } });

    await userEvent.click(screen.getByRole("button", { name: /save this view/i }));
    await userEvent.type(screen.getByLabelText("Name this view"), "Unpaid");
    await userEvent.click(screen.getByRole("button", { name: "Save view" }));

    const stored = JSON.parse(
      window.localStorage.getItem(
        `rahma.admin.bookings.saved-views.v2.${STAFF_ID}`
      ) ?? "[]"
    ) as Array<{ query: string }>;

    expect(stored).toHaveLength(1);
    expect(stored[0].query).toContain("payment_status=unpaid");
    expect(stored[0].query).not.toContain("page=");
  });

  it("a view saved before this change does not re-apply its stale page", async () => {
    window.localStorage.setItem(
      `rahma.admin.bookings.saved-views.v2.${STAFF_ID}`,
      JSON.stringify([
        { id: "v1", label: "Unpaid", query: "view=all&payment_status=unpaid&page=3" },
      ])
    );

    renderChrome({ query: { view: "all" } });

    await userEvent.click(screen.getByTitle("Apply this view"));

    expect(nav.push).toHaveBeenCalledTimes(1);
    const pushed = nav.push.mock.calls[0][0] as string;
    expect(pushed).toContain("payment_status=unpaid");
    expect(pushed).not.toContain("page=");
  });

  it("still reads as the active view while the reader is on page 2", () => {
    window.localStorage.setItem(
      `rahma.admin.bookings.saved-views.v2.${STAFF_ID}`,
      JSON.stringify([
        { id: "v1", label: "Unpaid", query: "view=all&payment_status=unpaid" },
      ])
    );

    renderChrome({ query: { view: "all", payment_status: "unpaid", page: "2" } });

    expect(
      screen.getByTitle("Apply this view").getAttribute("aria-current")
    ).toBe("true");
  });
});

describe("chip counts render on the chips that are rendered", () => {
  it("shows each visible chip's count, with an unambiguous spoken form", () => {
    renderChrome({
      query: { view: "attention" },
      viewCounts: { attention: 12, today: 0, upcoming: 40, claimable: 1 },
    });

    const attention = screen.getByRole("link", { name: /needs attention/i });
    expect(attention.textContent).toContain("12");
    // Spoken as "Needs Attention, 12 bookings" — not a bare number.
    expect(attention.textContent).toContain("12 bookings");

    expect(
      screen.getByRole("link", { name: /claimable/i }).textContent
    ).toContain("1 booking");
  });

  it("renders the label alone when no count was available", () => {
    renderChrome({ query: { view: "attention" } });

    const attention = screen.getByRole("link", { name: "Needs Attention" });
    expect(attention.textContent).toBe("Needs Attention");
  });
});

describe("the pager itself", () => {
  it("renders nothing for the one-page result getBookingsListPage reports", () => {
    // The exact props page.tsx passes when `getBookingsListPage` returns
    // `{ total: 12, page: 1, pageCount: 1 }` — including the therapist-scoped
    // branch, which always reports one page.
    const { container } = render(
      <PaginationBar
        page={1}
        pageCount={1}
        total={12}
        pageSize={LIST_PAGE_SIZE}
        makeHref={(page) => `/admin/bookings?page=${page}`}
      />
    );

    expect(container.textContent).toBe("");
  });
});
