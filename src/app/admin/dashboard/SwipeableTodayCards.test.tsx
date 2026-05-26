// @vitest-environment jsdom
//
// B-5 step 7: SwipeableTodayCards. Verifies role + label, keyboard arrow
// scroll, "View all" trailing card emission, and reduced-motion scroll
// behaviour swap.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { SwipeableTodayCards } from "./SwipeableTodayCards";

interface MockMqlState {
  reducedMotion: boolean;
}

function installMatchMedia(state: MockMqlState) {
  (window as unknown as { matchMedia: typeof window.matchMedia }).matchMedia = (
    query: string
  ) => {
    const matches =
      query === "(prefers-reduced-motion: reduce)" ? state.reducedMotion : false;
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    } as MediaQueryList;
  };
}

describe("SwipeableTodayCards", () => {
  let scrollSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    installMatchMedia({ reducedMotion: false });
    scrollSpy = vi.fn();
    Element.prototype.scrollBy = scrollSpy as unknown as typeof Element.prototype.scrollBy;
  });

  afterEach(() => {
    delete (Element.prototype as { scrollBy?: unknown }).scrollBy;
  });

  it("renders all children inside the region", () => {
    const { container, getByText } = render(
      <SwipeableTodayCards>
        <div>card-a</div>
        <div>card-b</div>
      </SwipeableTodayCards>
    );
    expect(getByText("card-a")).toBeTruthy();
    expect(getByText("card-b")).toBeTruthy();
    expect(container.querySelector('[role="region"]')).not.toBeNull();
  });

  it("renders 'View all' trailing CTA when viewAllHref is provided", () => {
    const { getByText } = render(
      <SwipeableTodayCards viewAllHref="/admin/bookings?view=today" viewAllLabel="View all 8 today →">
        <div>card</div>
      </SwipeableTodayCards>
    );
    expect(getByText("View all 8 today →")).toBeTruthy();
  });

  it("falls back to default 'View all →' label", () => {
    const { getByText } = render(
      <SwipeableTodayCards viewAllHref="/admin/bookings?view=today">
        <div>card</div>
      </SwipeableTodayCards>
    );
    expect(getByText("View all →")).toBeTruthy();
  });

  it("omits the trailing CTA when viewAllHref is not provided", () => {
    const { queryByText } = render(
      <SwipeableTodayCards>
        <div>card</div>
      </SwipeableTodayCards>
    );
    expect(queryByText("View all →")).toBeNull();
  });

  it("region carries the aria-label (default + override)", () => {
    const { container, rerender } = render(
      <SwipeableTodayCards>
        <div>card</div>
      </SwipeableTodayCards>
    );
    expect(
      container.querySelector('[role="region"]')?.getAttribute("aria-label")
    ).toBe("Today's bookings carousel");

    rerender(
      <SwipeableTodayCards ariaLabel="Coordinator unassigned today">
        <div>card</div>
      </SwipeableTodayCards>
    );
    expect(
      container.querySelector('[role="region"]')?.getAttribute("aria-label")
    ).toBe("Coordinator unassigned today");
  });

  it("region is tabbable (tabIndex=0)", () => {
    const { container } = render(
      <SwipeableTodayCards>
        <div>card</div>
      </SwipeableTodayCards>
    );
    expect(
      container.querySelector('[role="region"]')?.getAttribute("tabIndex")
    ).toBe("0");
  });

  it("ArrowRight scrolls right by ~one card width", () => {
    const { container } = render(
      <SwipeableTodayCards>
        <div>card</div>
      </SwipeableTodayCards>
    );
    const region = container.querySelector('[role="region"]') as HTMLElement;
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    const [arg] = scrollSpy.mock.calls[0];
    expect(arg.left).toBeGreaterThan(0);
    expect(arg.behavior).toBe("smooth");
  });

  it("ArrowLeft scrolls left", () => {
    const { container } = render(
      <SwipeableTodayCards>
        <div>card</div>
      </SwipeableTodayCards>
    );
    const region = container.querySelector('[role="region"]') as HTMLElement;
    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    const [arg] = scrollSpy.mock.calls[0];
    expect(arg.left).toBeLessThan(0);
  });

  it("other keys do not scroll", () => {
    const { container } = render(
      <SwipeableTodayCards>
        <div>card</div>
      </SwipeableTodayCards>
    );
    const region = container.querySelector('[role="region"]') as HTMLElement;
    fireEvent.keyDown(region, { key: "Enter" });
    fireEvent.keyDown(region, { key: "ArrowDown" });
    fireEvent.keyDown(region, { key: " " });
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("prefers-reduced-motion → behavior:auto on keyboard scroll", () => {
    installMatchMedia({ reducedMotion: true });
    const { container } = render(
      <SwipeableTodayCards>
        <div>card</div>
      </SwipeableTodayCards>
    );
    const region = container.querySelector('[role="region"]') as HTMLElement;
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(scrollSpy.mock.calls[0][0].behavior).toBe("auto");
  });

  it("'View all' card is hidden on desktop (md:hidden)", () => {
    const { getByText } = render(
      <SwipeableTodayCards viewAllHref="/admin/bookings?view=today">
        <div>card</div>
      </SwipeableTodayCards>
    );
    const cta = getByText("View all →");
    expect(cta.className).toContain("md:hidden");
  });
});
