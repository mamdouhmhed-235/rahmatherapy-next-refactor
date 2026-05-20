/**
 * Comprehensive bookings-page verification.
 *
 * Drives Playwright Chromium against http://localhost:3000 (user's dev server).
 * Captures:
 *   1. Screenshots at 375 / 768 / 1440 (Owner role; Therapist sanity at 375 + 1440)
 *   2. Fills filter form, submits, confirms URL updates + chip appears
 *   3. Clicks the first "Confirm" quick action (tablet+ where it's visible)
 *   4. Opens Cancel booking via row trailing menu, confirms modal appears, dismisses
 *   5. Opens "More views" dropdown, presses Escape, confirms it closes
 *   6. Collects console errors + warnings across all viewports
 *   7. Records network requests to confirm RECON.md endpoint contract is preserved
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.resolve("redesign/baseline");

const OWNER = { email: "rahmatherapy@outlook.com", password: "Password123" };
const THERAPIST = {
  email: "test.therapist@rahmatherapy.example.test",
  password: "TherapistTest123!",
};

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

async function login(page, creds) {
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await Promise.all([
    page.waitForURL(/\/admin\/(dashboard|bookings)/, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function signOut(page) {
  await page.evaluate(async () => {
    await fetch("/admin/signout", { method: "POST", credentials: "include" });
  });
}

const consoleErrors = [];
const consoleWarnings = [];
const networkRequests = [];

function attachListeners(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({ label, text: msg.text() });
    } else if (msg.type() === "warning") {
      consoleWarnings.push({ label, text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push({ label, text: `pageerror: ${err.message}` });
  });
  page.on("request", (req) => {
    const url = req.url();
    if (
      url.startsWith(BASE_URL) ||
      url.includes("supabase.co") ||
      url.includes("supabase.")
    ) {
      networkRequests.push({
        label,
        method: req.method(),
        url: url.replace(BASE_URL, ""),
      });
    }
  });
}

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const summary = { screenshots: [], interactions: [], errors: [] };

  try {
    // ─── A. Screenshots: Owner at all 3 viewports ───────────────────────────
    for (const bp of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: bp.width, height: bp.height },
        deviceScaleFactor: 2,
      });
      const page = await ctx.newPage();
      attachListeners(page, `owner/${bp.name}`);
      await login(page, OWNER);
      await page.goto(`${BASE_URL}/admin/bookings`, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(700);
      const file = path.join(
        OUTPUT_DIR,
        `bookings-verify-owner-${bp.name}.png`
      );
      await page.screenshot({ path: file, fullPage: true });

      // No horizontal scroll check
      const scroll = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      summary.screenshots.push({
        label: `owner/${bp.name}`,
        file,
        horizontalScroll: scroll.sw > scroll.cw,
        sw: scroll.sw,
        cw: scroll.cw,
      });
      await signOut(page);
      await ctx.close();
    }

    // ─── B. Therapist sanity at 375 + 1440 ──────────────────────────────────
    for (const bpName of ["mobile", "desktop"]) {
      const bp = VIEWPORTS.find((v) => v.name === bpName);
      const ctx = await browser.newContext({
        viewport: { width: bp.width, height: bp.height },
        deviceScaleFactor: 2,
      });
      const page = await ctx.newPage();
      attachListeners(page, `therapist/${bp.name}`);
      await login(page, THERAPIST);
      await page.goto(`${BASE_URL}/admin/bookings`, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(700);
      const file = path.join(
        OUTPUT_DIR,
        `bookings-verify-therapist-${bp.name}.png`
      );
      await page.screenshot({ path: file, fullPage: true });

      const scroll = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      summary.screenshots.push({
        label: `therapist/${bp.name}`,
        file,
        horizontalScroll: scroll.sw > scroll.cw,
        sw: scroll.sw,
        cw: scroll.cw,
      });
      await signOut(page);
      await ctx.close();
    }

    // ─── C. Interaction tests on desktop / Owner ───────────────────────────
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    attachListeners(page, "interactions");
    await login(page, OWNER);
    await page.goto(`${BASE_URL}/admin/bookings`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(500);

    // Test 1: Fill filter "status" select + submit, confirm URL has ?status=
    try {
      await page.selectOption('select[name="status"]', "confirmed");
      await Promise.all([
        page.waitForURL(/status=confirmed/, { timeout: 10_000 }),
        page.click('button[type="submit"]:has-text("Apply filters")'),
      ]);
      const url = page.url();
      summary.interactions.push({
        name: "Filter form submit (status=confirmed)",
        passed: url.includes("status=confirmed"),
        observed: `URL: ${url.replace(BASE_URL, "")}`,
      });
      // Verify chip appears
      const hasChip = await page
        .locator("text=Status: Confirmed")
        .first()
        .isVisible()
        .catch(() => false);
      summary.interactions.push({
        name: "Active filter chip rendered with Sentence-case 'Confirmed'",
        passed: hasChip,
        observed: hasChip
          ? "chip visible"
          : "chip not found (Sentence-case missing or chip absent)",
      });
    } catch (err) {
      summary.interactions.push({
        name: "Filter form submit",
        passed: false,
        observed: `error: ${err.message}`,
      });
    }

    // Reset to default view for the rest of tests
    await page.goto(`${BASE_URL}/admin/bookings?view=attention`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(500);

    // Test 2: Click the More views dropdown summary, then press Escape
    try {
      await page.click('summary[aria-label="Other views"]');
      await page.waitForTimeout(150);
      const openAfterClick = await page.evaluate(() => {
        const det = document.querySelector(
          'summary[aria-label="Other views"]'
        )?.parentElement;
        return det instanceof HTMLDetailsElement ? det.open : false;
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
      const openAfterEscape = await page.evaluate(() => {
        const det = document.querySelector(
          'summary[aria-label="Other views"]'
        )?.parentElement;
        return det instanceof HTMLDetailsElement ? det.open : false;
      });
      summary.interactions.push({
        name: "More dropdown opens on click and closes on Escape",
        passed: openAfterClick === true && openAfterEscape === false,
        observed: `openAfterClick=${openAfterClick}, openAfterEscape=${openAfterEscape}`,
      });
    } catch (err) {
      summary.interactions.push({
        name: "More dropdown Escape",
        passed: false,
        observed: `error: ${err.message}`,
      });
    }

    // Test 3: Open row trailing menu, click Cancel booking, confirm modal appears, dismiss
    try {
      const firstMoreBtn = page
        .locator("summary[aria-label^='More actions']")
        .first();
      await firstMoreBtn.click();
      await page.waitForTimeout(150);
      await page.locator("button:has-text('Cancel booking')").first().click();
      await page.waitForTimeout(250);
      const dialogVisible = await page
        .locator("text=Cancel this booking?")
        .first()
        .isVisible()
        .catch(() => false);
      // Dismiss the modal (click "Keep it")
      if (dialogVisible) {
        await page.locator('button:has-text("Keep it")').first().click();
        await page.waitForTimeout(200);
      }
      summary.interactions.push({
        name: "Row Cancel booking opens ConfirmActionModal",
        passed: dialogVisible,
        observed: dialogVisible ? "modal visible" : "modal not found",
      });
    } catch (err) {
      summary.interactions.push({
        name: "Cancel booking modal",
        passed: false,
        observed: `error: ${err.message}`,
      });
    }

    // Test 4: Click first visible "Confirm" quick action button (1440 / Owner)
    try {
      const confirmBtn = page
        .locator("button:has-text('Confirm')")
        .filter({ hasNot: page.locator("text=Confirm booking") })
        .first();
      const wasVisible = await confirmBtn.isVisible().catch(() => false);
      if (wasVisible) {
        await confirmBtn.click();
        await page.waitForTimeout(1500);
        const urlAfter = page.url();
        // Look for the Sonner success toast
        const toast = await page
          .locator("text=Booking confirmed.")
          .first()
          .isVisible()
          .catch(() => false);
        summary.interactions.push({
          name: "Confirm quick action fires (success toast appears)",
          passed: toast,
          observed: `toast=${toast}, url=${urlAfter.replace(BASE_URL, "")}`,
        });
      } else {
        summary.interactions.push({
          name: "Confirm quick action visible at 1440",
          passed: false,
          observed: "Confirm button not visible (no pending bookings?)",
        });
      }
    } catch (err) {
      summary.interactions.push({
        name: "Confirm quick action",
        passed: false,
        observed: `error: ${err.message}`,
      });
    }

    await signOut(page);
    await ctx.close();
  } finally {
    await browser.close();
  }

  // ─── Reporting ────────────────────────────────────────────────────────────
  console.log("\n========== VERIFICATION REPORT ==========\n");
  console.log("\n--- Screenshots ---");
  for (const s of summary.screenshots) {
    console.log(
      `  ${s.label.padEnd(20)} ${s.file.replace(path.resolve("."), ".")}` +
        `  hScroll=${s.horizontalScroll ? "OVERFLOW" : "ok"} (sw=${s.sw}/cw=${s.cw})`
    );
  }

  console.log("\n--- Interactions ---");
  for (const i of summary.interactions) {
    console.log(`  ${i.passed ? "[PASS]" : "[FAIL]"} ${i.name}`);
    console.log(`         ${i.observed}`);
  }

  console.log("\n--- Console errors ---");
  if (consoleErrors.length === 0) {
    console.log("  (none)");
  } else {
    for (const e of consoleErrors.slice(0, 30)) {
      console.log(`  [${e.label}] ${e.text.slice(0, 200)}`);
    }
    if (consoleErrors.length > 30) {
      console.log(`  ... and ${consoleErrors.length - 30} more`);
    }
  }

  console.log("\n--- Console warnings (interesting only, max 20) ---");
  if (consoleWarnings.length === 0) {
    console.log("  (none)");
  } else {
    // Filter out HMR / dev-server noise
    const interesting = consoleWarnings.filter(
      (w) =>
        !w.text.includes("HMR") &&
        !w.text.includes("Fast Refresh") &&
        !w.text.includes("[next-auth]") &&
        !w.text.includes("Download the React DevTools")
    );
    for (const w of interesting.slice(0, 20)) {
      console.log(`  [${w.label}] ${w.text.slice(0, 200)}`);
    }
    if (interesting.length === 0) {
      console.log("  (only dev-server HMR noise; filtered out)");
    }
  }

  console.log("\n--- Distinct request paths (non-static) ---");
  const distinctPaths = new Set();
  for (const r of networkRequests) {
    if (
      r.url.includes("/_next/") ||
      r.url.includes(".css") ||
      r.url.includes(".js") ||
      r.url.includes(".woff") ||
      r.url.includes(".ico")
    )
      continue;
    distinctPaths.add(`${r.method} ${r.url.split("?")[0]}`);
  }
  for (const p of Array.from(distinctPaths).sort()) {
    console.log(`  ${p}`);
  }

  console.log("\n=========================================\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
