// C-15 Phase C, Step 10/12 — LivePreview specs.
//
// Focus: `injectFixedPartOutline`, the pure function behind the "Show
// what's editable" toggle. Dispatch requirement — prove (a) the annotated
// output differs from the unannotated one, and (b) the default/unflagged
// path is byte-identical to whatever the preview endpoint returned (i.e.
// this component can never itself cause a drift from real render output,
// because when annotation is off it doesn't touch the string at all).
//
// This function is 100% client-side and never imports/touches
// src/lib/email/templates.ts or sample-data.ts — it post-processes the HTML
// string this component already fetched from the preview endpoint. That is
// precisely why Phase A's render-parity gate (registry-defaults.test.ts)
// needed no changes for this feature: nothing here runs on the server or on
// any send path, so it is structurally incapable of reaching a real send,
// not merely unlikely to.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { injectFixedPartOutline, LivePreview } from "../components/LivePreview";

const SAMPLE_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><title>Booking request received</title></head>' +
  '<body><div style="background:#f7f3ec;padding:18px;">Appointment</div>' +
  '<ul style="margin:0;padding-left:18px;"><li>Participant 1</li></ul></body></html>';

describe("injectFixedPartOutline", () => {
  it("returns HTML that differs from the input when annotating", () => {
    const annotated = injectFixedPartOutline(SAMPLE_HTML);
    expect(annotated).not.toBe(SAMPLE_HTML);
  });

  it("adds a single <style> block targeting the two shared fixed-part signatures", () => {
    const annotated = injectFixedPartOutline(SAMPLE_HTML);
    expect(annotated).toContain("<style>");
    expect(annotated).toContain('div[style*="background:#f7f3ec"]');
    expect(annotated).toContain('ul[style*="padding-left:18px"]');
  });

  it("leaves the original body content byte-identical — only the <head> gains a tag", () => {
    const annotated = injectFixedPartOutline(SAMPLE_HTML);
    const bodyBefore = SAMPLE_HTML.slice(SAMPLE_HTML.indexOf("<body>"));
    const bodyAfter = annotated.slice(annotated.indexOf("<body>"));
    expect(bodyAfter).toBe(bodyBefore);
  });

  it("degrades gracefully (prepends) for a response with no </head>, rather than corrupting it", () => {
    const noHead = "<html><body>plain</body></html>";
    const annotated = injectFixedPartOutline(noHead);
    expect(annotated).toContain("plain");
    expect(annotated.startsWith("<style>")).toBe(true);
  });

});

describe("LivePreview — annotate toggle never triggers a network request", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the exact bytes the endpoint returned when annotate is off, and switching it on changes only the displayed HTML — not the fetch call count", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_HTML),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <LivePreview templateId="booking_confirmation" cardName="Booking confirmation" values={{}} />
    );

    await waitFor(() => {
      const iframe = document.querySelector("iframe");
      expect(iframe).not.toBeNull();
    });

    const iframe = document.querySelector("iframe") as HTMLIFrameElement;
    // `annotate` defaults to off — the byte-identical guarantee.
    expect(iframe.srcdoc).toBe(SAMPLE_HTML);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("switch", { name: "Show what's editable" }));

    expect(iframe.srcdoc).not.toBe(SAMPLE_HTML);
    expect(iframe.srcdoc).toContain("<style>");
    // Still exactly one network call — the toggle is a pure client
    // transform of already-fetched content, never a new request.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
