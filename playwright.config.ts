import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // P-3: refuses an unconfigured run instead of skipping every spec and
  // reporting success. Also enforces the production-database boundary that was
  // previously only a comment. See e2e/global-setup.ts.
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  // ⛔ `channel: "chrome"` drives the Chrome ALREADY INSTALLED on this machine
  // rather than Playwright's own downloaded Chromium.
  //
  // Why: gate 08 (2026-08-20) found Playwright's browser binaries had never been
  // downloaded here — which is its own evidence that not one of these specs has
  // ever executed. The Owner declined a ~150 MB download, and there is no need
  // for one: a real Chrome is present, and driving the browser customers
  // actually use is arguably the better test anyway.
  //
  // Override with PLAYWRIGHT_CHANNEL if a machine has no Chrome (Edge works:
  // PLAYWRIGHT_CHANNEL=msedge). Unset it to fall back to bundled Chromium.
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
      },
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
      },
    },
  ],
});
