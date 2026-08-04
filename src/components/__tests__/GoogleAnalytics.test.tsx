// @vitest-environment jsdom
//
// No @testing-library/jest-dom in this repo (see BookingRowActions.test.tsx
// / MobileStickyActionBar.test.tsx for the established convention) — assert
// via plain DOM properties/attributes, not `toBeEmptyDOMElement()`-style
// matchers.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { ComponentType } from "react";

// `GoogleAnalytics` reads `NEXT_PUBLIC_GA_MEASUREMENT_ID` into a module-level
// constant (required so Next.js can statically inline it at build time), so
// each test re-imports the module after stubbing env vars to force a fresh
// evaluation of that constant.
async function loadGoogleAnalytics(): Promise<ComponentType> {
  vi.resetModules();
  const mod = await import("../GoogleAnalytics");
  return mod.GoogleAnalytics;
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  document.querySelectorAll("script[data-nscript]").forEach((el) => el.remove());
});

describe("GoogleAnalytics", () => {
  it("renders null when NEXT_PUBLIC_GA_MEASUREMENT_ID is unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

    const GoogleAnalytics = await loadGoogleAnalytics();
    const { container } = render(<GoogleAnalytics />);

    expect(container.firstChild).toBeNull();
    expect(document.querySelector("script[data-nscript]")).toBeNull();
  });

  it("renders null when NODE_ENV is not production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST123";

    const GoogleAnalytics = await loadGoogleAnalytics();
    const { container } = render(<GoogleAnalytics />);

    expect(container.firstChild).toBeNull();
    expect(document.querySelector("script[data-nscript]")).toBeNull();
  });

  it("renders both gtag scripts when the env var is set and NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST123";

    const GoogleAnalytics = await loadGoogleAnalytics();
    const { container } = render(<GoogleAnalytics />);

    expect(container.firstChild).toBeNull(); // next/script inserts via effect, not inline JSX

    const loaderScript = document.querySelector(
      'script[src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"]'
    );
    expect(loaderScript).not.toBeNull();

    const initScript = document.getElementById("ga-init");
    expect(initScript).not.toBeNull();
    expect(initScript?.textContent).toContain("gtag('config', 'G-TEST123')");
  });
});
