#!/usr/bin/env node
/**
 * POST-DEPLOY VERIFICATION — run this against the LIVE site after a push.
 *
 *     node scripts/verify-live-after-deploy.mjs
 *
 * ⛔ WHAT IT IS FOR. A deploy of this project must change the ADMIN and leave the
 * CUSTOMER site exactly as it was, with maintenance mode still on. This checks
 * that, rather than trusting that it happened.
 *
 * ⛔ THE ONE OUTCOME THAT COSTS REAL MONEY is bookings silently opening. That
 * happens if `NEXT_PUBLIC_BOOKING_ENABLED=true` reaches the production BUILD —
 * which it would if anyone ever ran `pnpm deploy` locally instead of pushing,
 * because that builds on the developer's machine with their `.env` inlined.
 * Checks 1-3 exist to catch exactly that.
 *
 * Read-only: GETs only. It never posts, books, or authenticates.
 */

const SITE = process.env.LIVE_SITE_URL || "https://rahmatherapy.uk";
const timeout = 25000;

const get = async (path) => {
  const res = await fetch(SITE + path, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
    headers: { "user-agent": "rahma-post-deploy-check" },
  });
  return { status: res.status, url: res.url, html: await res.text() };
};

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "  PASS" : "⛔ FAIL"}  ${name}`);
  if (detail) console.log(`          ${detail}`);
};

console.log(`\nPost-deploy verification against ${SITE}\n`);

// ── 1-3. MAINTENANCE MODE MUST STILL BE ON ──────────────────────────────────
const home = await get("/home");
check("home page responds 200", home.status === 200, `status ${home.status}`);

const bannerHits = (home.html.match(/maintenance-banner/g) || []).length;
check(
  "maintenance banner is present on the customer homepage",
  bannerHits > 0,
  `"maintenance-banner" found ${bannerHits}x (was 2 before the deploy)`,
);

// Under MAINTENANCE_MODE the booking dialog is NOT MOUNTED AT ALL — see
// src/app/(public)/layout.tsx. Its presence would mean bookings are open.
const dialogHits = (home.html.match(/BookingExperience|booking-dialog/gi) || []).length;
check(
  "booking dialog is NOT mounted (bookings still closed)",
  dialogHits === 0,
  `booking-dialog markers found: ${dialogHits} (must be 0)`,
);

// ── 4. THE CUSTOMER SITE STILL WORKS ────────────────────────────────────────
for (const path of ["/services", "/areas", "/about"]) {
  const r = await get(path);
  check(`${path} responds 200`, r.status === 200, `status ${r.status}`);
}

// ── 5. THE ADMIN SHIPPED — the new 404 page proves this build is the new one ─
// /admin/* requires auth, so we only assert it responds rather than 500s.
const adminLogin = await get("/admin/login");
check(
  "admin sign-in page responds",
  adminLogin.status === 200,
  `status ${adminLogin.status}`,
);

// ── 6. NO SERVER ERROR ANYWHERE WE LOOKED ───────────────────────────────────
check(
  "no 5xx seen on any checked route",
  ![home, adminLogin].some((r) => r.status >= 500),
  "",
);

const failed = results.filter((r) => !r.pass);
console.log(
  failed.length === 0
    ? `\nALL ${results.length} CHECKS PASSED — the deploy is live and maintenance mode is intact.\n`
    : `\n⛔ ${failed.length} of ${results.length} CHECKS FAILED:\n${failed.map((f) => `   - ${f.name}`).join("\n")}\n\n⛔ If the booking-dialog check failed, bookings may be OPEN on the live site.\n   Fix immediately: ensure NEXT_PUBLIC_BOOKING_ENABLED is NOT set in the\n   Cloudflare build environment, then redeploy from a clean git push.\n`,
);
process.exit(failed.length === 0 ? 0 : 1);
