// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://localhost:3000/" }
//
// C-18 Phase F Step 12 — the persistent withdrawal surface (brief §2.5): a
// "Cookie settings" link present on every public page via this shared footer.
// SiteFooter itself stays a server component (no consent-store import, no
// "use client") — the link only needs the delegated-click marker attribute
// CookieBanner already answers, which the second describe block below proves
// by actually opening the panel through it rather than just asserting the
// attribute is present.
//
// The https origin matches the other consent suites' convention even though
// this file does not write the consent cookie itself.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookieBanner } from "@/components/consent/CookieBanner";
import { resetConsentStoreForTests } from "@/components/consent/consent-store";
import { SiteFooter } from "../SiteFooter";

beforeEach(() => {
  resetConsentStoreForTests();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  cleanup();
});

describe("the footer link itself", () => {
  it("is present, labelled 'Cookie settings', and carries the delegated-click trigger", () => {
    render(<SiteFooter />);

    const link = screen.getByRole("link", { name: "Cookie settings" });
    expect(link.getAttribute("data-cookie-settings-trigger")).toBe("true");
    // The no-JS fallback: CookieBanner also opens the panel on load when this
    // query param is present, so the href alone (a real navigation) works too.
    expect(link.getAttribute("href")).toBe("?cookie-settings=1");
  });

  it("is a plain server-rendered anchor, not a client-only control", () => {
    // SiteFooter has no "use client" directive and imports no consent-store
    // hook — if it needed one to open the panel, this file would not compile
    // as a server component. This test pins the observable half: the link
    // works without SiteFooter itself ever calling into consent-store.
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: "Cookie settings" });
    expect(link.tagName).toBe("A");
  });
});

describe("wired to the existing delegation, on a real public page", () => {
  it("opens the preferences panel when clicked, exactly like the /cookies page's own trigger", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SiteFooter />
        <CookieBanner />
      </>
    );

    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("link", { name: "Cookie settings" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
