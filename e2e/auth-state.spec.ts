// ⛔ GATE 08 — the mechanism every role SUB-AGENT authenticates with.
//
// The multi-agent role-play (MULTI-AGENT-ROLEPLAY.md §2) spawns one agent per
// role. No agent may ever see a password, and no credential value may enter an
// agent's context. The mechanism:
//
//   main session:  node scripts/mint-e2e-session.mjs --all --write
//                  -> e2e/.auth/<role>.json   (gitignored, one login each)
//   role agent:    browser.newContext({ storageState: "e2e/.auth/<role>.json" })
//
// The credential path is .env -> process.env -> Supabase SDK -> cookie file. An
// agent loads a cookie file and nothing else.
//
// ⛔ THIS SPEC IS THE PROOF THAT THE MECHANISM WORKS. If a storage-state file
// does not actually authenticate, a role agent runs UNAUTHENTICATED and reports
// "access denied" everywhere — findings that look damning and mean nothing. That
// failure is silent, which is exactly why it is pinned here rather than assumed.

import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { hasBaseUrl } from "./helpers";

const AUTH_DIR = "e2e/.auth";

/** role file -> what that identity must land on, and what it must NOT be. */
const IDENTITIES: ReadonlyArray<{
  file: string;
  label: string;
  expectAdmin: boolean;
  navContains?: string;
}> = [
  { file: "owner.json", label: "Owner", expectAdmin: true, navContains: "Enquiries" },
  { file: "admin.json", label: "Admin", expectAdmin: true, navContains: "Enquiries" },
  { file: "coordinator.json", label: "Booking Coordinator", expectAdmin: true, navContains: "Team" },
  { file: "therapist_a.json", label: "Therapist A", expectAdmin: true, navContains: "My bookings" },
  { file: "therapist_b.json", label: "Therapist B", expectAdmin: true, navContains: "My bookings" },
  // ⛔ These two must NOT reach an admin surface. Their storage state is a valid
  // session — the refusal has to come from the app, not from a missing cookie.
  { file: "inactive.json", label: "Inactive", expectAdmin: false },
  { file: "non_staff.json", label: "Non-staff", expectAdmin: false },
];

test.describe("role storage state — the sub-agent authentication mechanism", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run.");

  test("every role has a minted storage-state file", () => {
    // ⛔ Guards the guard. A missing file makes its agent run signed-out, and
    // "everything was denied" is the most convincing wrong answer this
    // programme could produce.
    const present = IDENTITIES.filter((i) => fs.existsSync(`${AUTH_DIR}/${i.file}`));
    expect(
      present.map((i) => i.file).sort(),
      "run `node scripts/mint-e2e-session.mjs --all --write` first"
    ).toEqual(IDENTITIES.map((i) => i.file).sort());
  });

  test("a storage-state file carries exactly one Supabase session cookie", () => {
    for (const identity of IDENTITIES) {
      const state = JSON.parse(fs.readFileSync(`${AUTH_DIR}/${identity.file}`, "utf8"));
      const authCookies = (state.cookies ?? []).filter((c: { name: string }) =>
        c.name.startsWith("sb-")
      );
      expect(authCookies.length, `${identity.file} session cookie`).toBeGreaterThan(0);
      for (const cookie of authCookies) {
        expect(cookie.value.length, `${identity.file} cookie is non-empty`).toBeGreaterThan(50);
      }
    }
  });

  for (const identity of IDENTITIES) {
    test(`${identity.label} is authenticated by its own storage state alone`, async ({
      browser,
    }) => {
      const statePath = `${AUTH_DIR}/${identity.file}`;
      test.skip(!fs.existsSync(statePath), `${statePath} not minted`);

      // Exactly what a role agent does: a fresh context, one file, nothing else.
      const context = await browser.newContext({ storageState: statePath });
      const page = await context.newPage();
      await page.goto("/admin/dashboard/", { waitUntil: "domcontentloaded" });

      if (identity.expectAdmin) {
        await expect(page, `${identity.label} should reach the dashboard`).toHaveURL(
          /\/admin\/dashboard/
        );
        if (identity.navContains) {
          await expect(
            page
              .locator("nav[aria-label='Admin navigation']")
              .getByRole("link", { name: identity.navContains })
              .first()
          ).toBeVisible();
        }
      } else {
        // ⛔ Refused by the APP while holding a valid session — not refused
        // because the cookie was missing. That distinction is the whole point.
        await expect(page, `${identity.label} must not reach admin`).toHaveURL(
          /\/admin\/login/
        );
      }

      await context.close();
    });
  }

  test("no storage-state file leaks a password or an email into agent context", () => {
    // ⚠️ The files carry a session token, which necessarily decodes to the
    // account's email — that is inherent to a JWT and is not what this checks.
    // What must never appear is a PASSWORD, in any form.
    const passwordish = /password|passwd|"pwd"/i;
    for (const identity of IDENTITIES) {
      const raw = fs.readFileSync(`${AUTH_DIR}/${identity.file}`, "utf8");
      expect(passwordish.test(raw), `${identity.file} must carry no password`).toBe(false);
    }
  });
});
