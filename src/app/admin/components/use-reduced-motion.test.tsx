import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReducedMotion } from "./use-reduced-motion";

describe("useReducedMotion", () => {
  // Listeners are React's `onChange` callbacks (one per useSyncExternalStore
  // subscription). Closure-captured `matches` flips via the test, then any
  // listener call re-triggers React → React re-reads getSnapshot → reads
  // window.matchMedia(...).matches → sees the new value.
  let listeners: Array<() => void> = [];
  let matches = false;

  beforeEach(() => {
    listeners = [];
    matches = false;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (_: string, fn: () => void) => {
        listeners.push(fn);
      },
      removeEventListener: (_: string, fn: () => void) => {
        listeners = listeners.filter((l) => l !== fn);
      },
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when reduced-motion is not set", () => {
    matches = false;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when reduced-motion is set on mount", () => {
    matches = true;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("updates when the media query change event fires", () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => {
      matches = true;
      listeners.forEach((fn) => fn());
    });
    expect(result.current).toBe(true);
  });
});
