// C-23 Phase C, Step 6 — useMonthAvailability specs.
//
// Three cases required by the plan: cache hit, abort on key change, failure →
// null. Mirrors the fetch-mocking convention in
// src/app/admin/emails/templates/__tests__/LivePreview.test.tsx
// (vi.stubGlobal("fetch", ...)) and the renderHook/act convention in
// src/app/admin/components/use-reduced-motion.test.tsx.

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMonthAvailability } from "./use-month-availability";

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

describe("useMonthAvailability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("caches a month key — navigating away and back doesn't refetch it", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse({ days: [{ date: "2026-08-10", hasSlots: true, slotCount: 2 }] })
      )
      .mockImplementationOnce(() =>
        jsonResponse({ days: [{ date: "2026-09-10", hasSlots: false, slotCount: 0 }] })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ month }) => useMonthAvailability(month, ["hijama-package"], ["female"], "Luton", true),
      { initialProps: { month: "2026-08" } }
    );

    await waitFor(() => expect(result.current.days?.get("2026-08-10")).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender({ month: "2026-09" });
    await waitFor(() => expect(result.current.days?.get("2026-09-10")).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    rerender({ month: "2026-08" });
    await waitFor(() => expect(result.current.days?.get("2026-08-10")).toBe(true));
    // Cache hit on the return to August — no third network call.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts the in-flight request when the cache key changes before it resolves", async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedSignal = init.signal as AbortSignal;
      return new Promise(() => {
        // Never resolves — the point is to observe the abort, not a response.
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = renderHook(
      ({ month }) => useMonthAvailability(month, ["hijama-package"], ["female"], "Luton", true),
      { initialProps: { month: "2026-08" } }
    );

    await waitFor(() => expect(capturedSignal).toBeDefined());
    expect(capturedSignal?.aborted).toBe(false);

    rerender({ month: "2026-09" });

    expect(capturedSignal?.aborted).toBe(true);
  });

  it("aborts the in-flight request on unmount", async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedSignal = init.signal as AbortSignal;
      return new Promise(() => {});
    });
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = renderHook(() =>
      useMonthAvailability("2026-08", ["hijama-package"], ["female"], "Luton", true)
    );

    await waitFor(() => expect(capturedSignal).toBeDefined());
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  it("resolves to null on a failed response — never blocking booking", async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ error: "boom" }, false));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useMonthAvailability("2026-08", ["hijama-package"], ["female"], "Luton", true)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.days).toBeNull();
  });
});
