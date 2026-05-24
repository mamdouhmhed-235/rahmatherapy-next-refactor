// @vitest-environment jsdom
//
// B-5 step 6: PullToRefresh wrapper. Verifies mobile-only behaviour, pull
// distance tracking, 80 px threshold, 2-second debounce (AUDIT G9),
// prefers-reduced-motion handling, and a11y aria-live announcement.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import {
  PullToRefresh,
  PULL_THRESHOLD_PX,
  REFRESH_DEBOUNCE_MS,
} from "./PullToRefresh";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

interface MockMqlState {
  mobile: boolean;
  reducedMotion: boolean;
}

function installMatchMedia(state: MockMqlState) {
  const listeners = new Map<string, Set<() => void>>();
  (window as unknown as { matchMedia: typeof window.matchMedia }).matchMedia = (
    query: string
  ) => {
    const matches =
      query === "(max-width: 767.9px)"
        ? state.mobile
        : query === "(prefers-reduced-motion: reduce)"
          ? state.reducedMotion
          : false;
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: (_: string, cb: EventListenerOrEventListenerObject) => {
        if (!listeners.has(query)) listeners.set(query, new Set());
        listeners.get(query)?.add(cb as () => void);
      },
      removeEventListener: (
        _: string,
        cb: EventListenerOrEventListenerObject
      ) => {
        listeners.get(query)?.delete(cb as () => void);
      },
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  };
}

function setScroll(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
}

function makeTouch(y: number) {
  return [{ clientY: y } as Touch];
}

function pull(
  container: HTMLElement,
  options: { from: number; to: number; release?: boolean }
) {
  const target = container.firstChild as HTMLElement;
  fireEvent.touchStart(target, { touches: makeTouch(options.from) });
  fireEvent.touchMove(target, { touches: makeTouch(options.to) });
  if (options.release !== false) {
    fireEvent.touchEnd(target, { changedTouches: makeTouch(options.to) });
  }
}

describe("PullToRefresh", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    setScroll(0);
    installMatchMedia({ mobile: true, reducedMotion: false });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders children", () => {
    const { getByText } = render(
      <PullToRefresh>
        <div>child content</div>
      </PullToRefresh>
    );
    expect(getByText("child content")).toBeTruthy();
  });

  it("desktop viewport does not react to touch events", () => {
    installMatchMedia({ mobile: false, reducedMotion: false });
    const { container } = render(
      <PullToRefresh>
        <div>x</div>
      </PullToRefresh>
    );
    pull(container, { from: 10, to: 300 });
    expect(refreshMock).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("mobile + pull past 80px threshold fires router.refresh()", () => {
    const { container } = render(
      <PullToRefresh>
        <div>x</div>
      </PullToRefresh>
    );
    // Damped at 0.5 — to reach 80px damped we need 160px raw.
    pull(container, { from: 0, to: 200 });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("mobile + pull short of threshold does NOT fire refresh", () => {
    const { container } = render(
      <PullToRefresh>
        <div>x</div>
      </PullToRefresh>
    );
    pull(container, { from: 0, to: 100 });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("ignores pull when scrollY > 0 (page is scrolled mid-content)", () => {
    setScroll(150);
    const { container } = render(
      <PullToRefresh>
        <div>x</div>
      </PullToRefresh>
    );
    pull(container, { from: 0, to: 200 });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("debounces consecutive refreshes within 2 seconds (AUDIT G9)", () => {
    const { container } = render(
      <PullToRefresh>
        <div>x</div>
      </PullToRefresh>
    );
    pull(container, { from: 0, to: 200 });
    expect(refreshMock).toHaveBeenCalledTimes(1);

    // Inside debounce window — second pull should NOT fire.
    act(() => {
      vi.advanceTimersByTime(REFRESH_DEBOUNCE_MS - 500);
    });
    pull(container, { from: 0, to: 200 });
    expect(refreshMock).toHaveBeenCalledTimes(1);

    // Past debounce window — third pull fires.
    act(() => {
      vi.advanceTimersByTime(600);
    });
    pull(container, { from: 0, to: 200 });
    expect(refreshMock).toHaveBeenCalledTimes(2);
  });

  it("aria-live status appears during pull with helper text", () => {
    const { container } = render(
      <PullToRefresh>
        <div>x</div>
      </PullToRefresh>
    );
    const target = container.firstChild as HTMLElement;
    fireEvent.touchStart(target, { touches: makeTouch(0) });
    fireEvent.touchMove(target, { touches: makeTouch(60) });
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(status?.textContent).toBe("Pull to refresh");
    expect(status?.getAttribute("data-pull-state")).toBe("pulling");
  });

  it("indicator switches to 'Release to refresh' past threshold", () => {
    const { container } = render(
      <PullToRefresh>
        <div>x</div>
      </PullToRefresh>
    );
    const target = container.firstChild as HTMLElement;
    fireEvent.touchStart(target, { touches: makeTouch(0) });
    fireEvent.touchMove(target, { touches: makeTouch(200) });
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toBe("Release to refresh");
    expect(status?.getAttribute("data-pull-state")).toBe("ready");
  });

  it("indicator announces 'Refreshing…' after fire", () => {
    const { container } = render(
      <PullToRefresh>
        <div>x</div>
      </PullToRefresh>
    );
    pull(container, { from: 0, to: 200 });
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toContain("Refreshing");
    expect(status?.getAttribute("data-pull-state")).toBe("refreshing");
  });

  it("spinner has animate-spin class by default", () => {
    const { container } = render(
      <PullToRefresh>
        <div>x</div>
      </PullToRefresh>
    );
    pull(container, { from: 0, to: 200 });
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });

  it("respects prefers-reduced-motion: no animate-spin class", () => {
    installMatchMedia({ mobile: true, reducedMotion: true });
    const { container } = render(
      <PullToRefresh>
        <div>x</div>
      </PullToRefresh>
    );
    pull(container, { from: 0, to: 200 });
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("threshold export reflects 80 px and debounce 2_000 ms", () => {
    expect(PULL_THRESHOLD_PX).toBe(80);
    expect(REFRESH_DEBOUNCE_MS).toBe(2_000);
  });
});
