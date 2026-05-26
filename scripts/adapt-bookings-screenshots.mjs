/**
 * Bookings page adapt-after screenshot + audit script.
 *
 * Drives a Playwright Chromium browser against the running dev server at
 * http://localhost:3000, logs in once per role, captures full-page screenshots
 * at tablet (768×1024) and mobile (375×812), then audits for horizontal scroll
 * and sub-44px interactive elements.
 *
 * Output:
 *   redesign/baseline/bookings-adapt-after-<role>-<bp>.png
 *
 * Roles tested:
 *   - owner: visual reference for the full Owner / Admin / Coordinator surface
 *     (those three roles share the same chrome on this page)
 *   - therapist: distinct role variant (3 primary tabs, simplified filter bar,
 *     no payment chip, no inline action buttons)
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUTPUT_DIR = path.resolve("redesign/baseline");

const ROLES = [
  { name: "owner", email: "rahmatherapy@outlook.com", password: "Password123" },
  {
    name: "therapist",
    email: "test.therapist@rahmatherapy.example.test",
    password: "TherapistTest123!",
  },
];

const BREAKPOINTS = [
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 },
];

async function loginAs(page, role) {
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', role.email);
  await page.fill('input[type="password"]', role.password);
  await Promise.all([
    page.waitForURL(/\/admin\/(dashboard|bookings)/, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function signOut(page) {
  // POST to /admin/signout to clear cookies between roles.
  await page.evaluate(async () => {
    await fetch("/admin/signout", { method: "POST", credentials: "include" });
  });
}

async function audit(page, label) {
  const horizontalScroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflows:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  }));

  const smallTapTargets = await page.evaluate(() => {
    const interactive = Array.from(
      document.querySelectorAll(
        "a, button, summary, [role='button'], input:not([type='hidden']), select"
      )
    );
    const failures = [];
    function isVisible(el) {
      // checkVisibility honours display:none / visibility:hidden up the tree.
      if (typeof el.checkVisibility === "function") {
        return el.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
        });
      }
      // Fallback: walk up.
      let cur = el;
      while (cur && cur !== document.documentElement) {
        const s = window.getComputedStyle(cur);
        if (s.display === "none" || s.visibility === "hidden") return false;
        cur = cur.parentElement;
      }
      return true;
    }
    for (const el of interactive) {
      if (!isVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // WCAG 2.5.5 (AAA) / brief commitment: 44×44px floor on mobile.
      if (rect.width < 44 || rect.height < 44) {
        failures.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").trim().slice(0, 40),
          ariaLabel: el.getAttribute("aria-label"),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }
    }
    return failures.slice(0, 30);
  });

  return { label, horizontalScroll, smallTapTargets };
}

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const audits = [];

  try {
    for (const role of ROLES) {
      for (const bp of BREAKPOINTS) {
        const ctx = await browser.newContext({
          viewport: { width: bp.width, height: bp.height },
          deviceScaleFactor: 2,
        });
        const page = await ctx.newPage();
        await loginAs(page, role);
        await page.goto(`${BASE_URL}/admin/bookings`, {
          waitUntil: "networkidle",
        });
        // Settle: wait for at least one card or empty state to render.
        await page.waitForTimeout(800);

        const filePath = path.join(
          OUTPUT_DIR,
          `bookings-adapt-after-${role.name}-${bp.name}.png`
        );
        await page.screenshot({ path: filePath, fullPage: true });

        const audit_ = await audit(page, `${role.name}/${bp.name}`);
        audits.push({ ...audit_, file: filePath });

        await signOut(page);
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log("\n========== AUDIT RESULTS ==========\n");
  for (const a of audits) {
    console.log(`\n--- ${a.label} ---`);
    console.log(`  Screenshot: ${a.file}`);
    console.log(
      `  Horizontal scroll: ${
        a.horizontalScroll.overflows ? "OVERFLOWS" : "ok"
      } (scrollWidth=${a.horizontalScroll.scrollWidth}, clientWidth=${a.horizontalScroll.clientWidth})`
    );
    if (a.smallTapTargets.length === 0) {
      console.log("  Tap targets: all visible interactive elements >= 44×44");
    } else {
      console.log(
        `  Sub-44px tap targets (${a.smallTapTargets.length} shown, capped at 30):`
      );
      for (const t of a.smallTapTargets) {
        console.log(
          `    ${t.tag} ${t.w}×${t.h}  "${
            t.text || t.ariaLabel || "(no label)"
          }"`
        );
      }
    }
  }
  console.log("\n===================================\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
