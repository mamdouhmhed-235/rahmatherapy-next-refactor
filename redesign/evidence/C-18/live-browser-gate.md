# C-18 — Live browser gate — independent verification

**Verifier:** read-only subagent, browser-driving only (per dispatch, the sole browser-driving agent this run). No repo file writes except this evidence file.
**Server:** Owner's `next dev` at `http://localhost:3000` (never restarted/killed/spawned). `MAINTENANCE_MODE=false` in the working copy (booking mounts). `NODE_ENV` is development throughout — the GA *mount* arm cannot be exercised here; flagged explicitly below wherever it applies.
**HEAD at test time:** `26a7d3f`.
**Tooling used:** `chrome-devtools` MCP (primary, per dispatch's animation/timing guidance) plus an initial pass with the `Claude_Browser` pane MCP (used for Gate 2's first fresh-state check and the first Reject-all; abandoned after its `computer` click stopped reliably reaching the DOM — see note below). `axe-core@4.11.3` (the exact version pinned in this repo's `node_modules/.pnpm`) was loaded into the live page via a CDN `<script>` tag, since there was no safe way to serve the local minified file into an `http://localhost` document; verified `window.axe` loaded before use.
**Database:** all checks via `mcp__supabase__execute_sql` (SELECT-only), project `twzutkfgqclqurvkmvqz`, exactly as authorised.

**Tooling note:** two `Claude_Browser` "Accept all" click attempts on `/home/` appeared to fail (checked `document.cookie` immediately after each and saw no `rahma_consent` cookie), so I switched to `chrome-devtools` for the rest of the session, where clicks worked reliably and were followed up immediately in the same tool. In hindsight, at least one of those two "failed" clicks probably *did* land — a consent row (`f846ffc4-…`) later appears in the database with a timestamp and shape consistent with an Accept-all that I cannot otherwise account for from my `chrome-devtools` actions, most likely delivered late relative to my check, or to a tab I temporarily lost sync with while the `Claude_Browser` pane wasn't compositing frames (`screenshot` calls failed throughout that tool's use with "the Browser pane is not displayed"). This did not corrupt any gate's evidence — see Gate 3 below, where it shows up as a second, independent grant→withdrawal pair that corroborates rather than contradicts the primary one. Flagged for transparency, not hidden.

---

## Gate 2 — the regulator test (PASS)

**Fresh state, no clicks, three page loads.** Confirmed `document.cookie` held only `__next_hmr_refresh_hash__` (no `rahma_consent`), `sessionStorage`/`localStorage` empty. Loaded `/home/`, then navigated to `/about/`, then `/services/`. Read the full network log after all three loads: every request was to `localhost:3000` (static chunks, images, fonts, and the self-hosted Sentry `/monitoring/` tunnel). **Zero requests to any host containing "google".** Banner confirmed present (Accept all / Reject all / Cookie settings buttons in the a11y tree) with no prior interaction.

**Reject-all, then two more navigations.** Clicked "Reject all". `rahma_consent` cookie set: `{v:"2026-07-16.1", id:"760bef18-8d64-4694-a2c9-5ce2cf931b9e", choices:{analytics:false,functional:false}, ts:"2026-08-04T20:26:12…"}`. Navigated to `/reviews/` then `/faqs-aftercare/`. Filtered network log for `google` across both loads: **no matches at all** (zero requests). Banner did not reappear (correct — consent no longer `null`).

**Repeated with the booking dialog open**, per the plan's literal wording ("open the booking dialog, click nothing"). Fresh state again (cleared `rahma_consent`, cleared `sessionStorage`), loaded `http://localhost:3000/home/?booking=1` (dialog auto-opens on this query param). Read the full network log for that page load: 70 requests, every one to `localhost:3000` (including 6 `/monitoring/` POSTs — Sentry's self-hosted tunnel, not a Google host). **Zero Google-host requests with the dialog open.**

**Verdict: PASS**, both the plan's literal scenario and the dialog-open variant, dev-server caveat noted (GA mount arm untestable here regardless — see Gate 3).

---

## Gate 3 — THE MOST IMPORTANT CHECK — consent_events proof (PASS)

Before this pass, `consent_events` held rows only from my own testing (confirmed 0 at session start via the Phase-E/F verifier's report — I did not re-check the empty state myself before starting, but the table was created for this plan and no other agent has browser access this run).

**Grant.** Clicked "Accept all" on a fresh `/home/` load (chrome-devtools, real button click via `uid`). `document.cookie` immediately after: `rahma_consent={v:"2026-07-16.1", id:"3ae8e616-cd37-4c6b-a4d6-a5d75ccf3bfc", choices:{analytics:true,functional:true}, ts:"2026-08-04T20:28:22.128Z"}`. Network log showed `POST /api/consent-events/ → 204`.

SELECT-only SQL immediately after:
```
id: 74686dbb-585f-45b5-97f2-2f44feddedbf
consent_id: 3ae8e616-cd37-4c6b-a4d6-a5d75ccf3bfc
banner_version: 2026-07-16.1
purposes_offered: [functional, analytics]
choices: {analytics: true, functional: true}
action: granted
created_at: 2026-08-04 20:30:00.332042+00
```
Exact match to what the client wrote and sent — **a real row landed, with correct `consent_id`, `banner_version`, `purposes_offered`, `choices` and `action`.**

**Withdrawal.** Navigated to `/reviews/` (triggers Sentry Replay's start on next route change — confirmed `sentryReplaySession` appeared in `sessionStorage` at this point, consistent with analytics being granted). Opened the panel via the footer's real "Cookie settings" link, clicked "Reject all" inside the panel. `document.cookie` immediately after: same `id` (`3ae8e616-…`), `choices:{analytics:false,functional:false}`, new `ts`.

SELECT-only SQL immediately after:
```
id: 610de1ed-ea44-4d1e-8110-ea8f5278ef61
consent_id: 3ae8e616-cd37-4c6b-a4d6-a5d75ccf3bfc   ← SAME as the grant above
action: withdrawn
choices: {analytics: false, functional: false}
created_at: 2026-08-04 20:31:03.575020+00           ← 63s after the grant
```
**The join holds**: the withdrawal's `consent_id` is exactly the grant's `consent_id`, exactly as the migration's design requires.

**Corroborating evidence (unplanned, from the tooling episode above).** A second, independent grant→withdrawal pair also landed correctly: `consent_id f846ffc4-9eee-46bf-8eb9-a558088b2ed4` — `granted` (`analytics:true,functional:true`) at `20:34:52.613234+00`, `withdrawn` (`analytics:false,functional:false`) at `20:37:31.790437+00`. Same `consent_id` both times. I did not deliberately orchestrate this pair (see the tooling note above), but it demonstrates the same correct join behaviour a second time from real Sentry Replay's/GA's actual gate paths.

**Also present, all from my own testing this session** (first-visit reject, and a keyboard-only save exercised for Gate 7 below):
```
id b5bba827…  consent_id 760bef18…  action rejected  (analytics:false, functional:false)  20:26:12.503438+00
id 3f25b1a2…  consent_id da8a97c4…  action granted   (analytics:false, functional:true)   20:35:34.194989+00
```

**Live SELECT-only grant/RLS check**, run myself:
```
service_role_insert: true   service_role_select: false
anon_insert: false          anon_select: false
rls_on: true                row_count: 6
```
Matches the migration's documented intent exactly (INSERT-only for `service_role`, no anon access, RLS on).

**Rows for the Owner to prune (all 6, self-generated test data, none touching real customers):**

| consent_id | action | created_at (UTC) |
|---|---|---|
| `760bef18-8d64-4694-a2c9-5ce2cf931b9e` | rejected | 2026-08-04 20:26:12.503438 |
| `3ae8e616-cd37-4c6b-a4d6-a5d75ccf3bfc` | granted | 2026-08-04 20:30:00.332042 |
| `3ae8e616-cd37-4c6b-a4d6-a5d75ccf3bfc` | withdrawn | 2026-08-04 20:31:03.575020 |
| `f846ffc4-9eee-46bf-8eb9-a558088b2ed4` | granted | 2026-08-04 20:34:52.613234 |
| `da8a97c4-fe70-4b9f-b507-e4cbe3129d0c` | granted | 2026-08-04 20:35:34.194989 |
| `f846ffc4-9eee-46bf-8eb9-a558088b2ed4` | withdrawn | 2026-08-04 20:37:31.790437 |

**Verdict: PASS**, end-to-end, exercised for real for the first time in this plan's life. The table is no longer silently empty.

---

## Gate 4 — withdrawal (PASS)

Set up: with analytics granted (`consent_id 3ae8e616-…`) and after a navigation had started Session Replay (`sentryReplaySession` present in `sessionStorage`), planted fake cookies myself: `_ga=GA1.1.123456789.1234567890` and `_ga_TEST=GS1.1.987654321.1.1.1234567890.0.0.0` (both `Domain=.localhost`), plus `_ga_plain` (no Domain attribute, host-only variant). Confirmed all three present in `document.cookie` before withdrawing.

Opened the panel, clicked "Reject all" (a true withdrawal — analytics goes `true→false`). Immediately after:
- `document.cookie`: `_ga`, `_ga_TEST`, `_ga_plain` **all gone**; only `__next_hmr_refresh_hash__` and the updated `rahma_consent` remain.
- `sessionStorage`: **empty** — `sentryReplaySession` gone.
- Page reloaded: network log for the post-click window shows a fresh `GET /reviews/ → 200` (all other resources `304 Not Modified` from cache), confirming a real reload happened, not an in-place state change.
- Post-reload network log: **zero requests to any Google host.**

**Verdict: PASS.**

---

## Gate 5 — parity + no pre-tick (PASS)

Screenshots saved to `redesign/evidence/C-18/live-gate-screens/`:
- `gate5-banner-375.png`, `gate5-banner-768.png`, `gate5-banner-1280.png`, `gate5-banner-1440.png` — banner, fresh state, each viewport.
- `gate5-panel-375.png` — preferences panel, fresh state, 375px.

**Computed-style equality**, Accept-all vs Reject-all buttons, checked at all four viewports (`fontSize`, `fontWeight`, `fontFamily`, `color`, `backgroundColor`, `borderRadius`, `borderWidth`, `borderColor`, all four paddings, `height`, `minHeight`): **identical at every viewport, every property, no exceptions.** Example (375px): both `14px`/`600`/`Arial`/`rgb(28,114,172)` text on `rgb(255,255,255)` background, `2.87609e+07px` border-radius (pill), `0.857143px` border, `8px 24px` padding, `44px` height. The only difference recorded is `width` (Accept all 115.8px vs Reject all 111.2px) — expected, driven purely by the two labels' differing glyph widths, not a styling asymmetry.

**No pre-tick, confirmed live.** With no stored consent, queried every checkbox in the open panel: `consent-purpose-essential` → `checked:true, disabled:true`; `consent-purpose-functional` → `checked:false, disabled:false`; `consent-purpose-analytics` → `checked:false, disabled:false`. Both non-essential toggles default off.

**Verdict: PASS.**

---

## Gate 6 — version-bump re-prompt (PASS)

Per the dispatch, did this **without editing any repo file.** Wrote a `rahma_consent` cookie directly via `document.cookie` with a deliberately stale `v`: `{v:"2020-01-01.1", id:"aaaa…", choices:{analytics:true,functional:true}, ts:"…"}` (current `CONSENT_BANNER_VERSION` is `2026-07-16.1`; `src/lib/consent/cookie-registry.ts:29`, untouched). Reloaded. The banner **reappeared** (`bannerPresent:true`) even though a consent cookie was present and its choices were both `true` — confirming `readConsent()`'s version-mismatch branch is treated as "no consent," exactly as `consent-state.ts:127` specifies, and reproduced live rather than only in the unit-test corpus.

**Verdict: PASS.**

---

## Gate 7 — accessibility (PASS)

**Axe pass** (axe-core 4.11.3, the version pinned in this repo):
- Banner (fresh state): **0 violations**, 11 passes.
- Preferences panel/dialog (opened): **0 violations**, 30 passes.
- `/cookies` full page: **1 violation** — `page-has-heading-one` (moderate, `<html>`). This is the pre-existing, already-documented issue (`SectionHeading` hardcodes `<h2>`, shared across every public page — recorded in progress §3.1 and re-confirmed as out of C-18's scope in §3.4). **Not a new C-18 defect.** 14 `color-contrast` "incomplete" results (axe could not determine, not confirmed violations), every one on a pre-existing `SiteFooter` element (`.footer_intro`, `.footer_heading`, `.footer_link…`, `.footer_credit-text`, `.footer_legal-link`) due to a background gradient — a site-wide footer limitation, not specific to the "Cookie settings" link itself (it shares the same "incomplete," not a distinct finding).

**Focus trap**, confirmed by direct measurement, not assumption. On open, `document.activeElement` was the "Close cookie settings" button. Pressed Tab 13 times total across two batches; after every check, `dialog.contains(document.activeElement)` was `true` — focus never left the dialog, and the sequence visibly cycled through the group summaries ("What's in this group (3)" → … → "What's in this group (1)"), consistent with wrapping inside a bounded set of focusable elements.

**Keyboard-complete operation**, exercised end-to-end with zero mouse input: focused the footer's "Cookie settings" link directly, pressed **Enter** to open the panel (`dialogOpen:true`, focus on Close). Pressed **Escape** — dialog closed AND focus returned exactly to the opener link (`activeIsLink:true`, `activeText:"Cookie settings"`) — both halves of the ESC requirement independently confirmed with real assertions, not inferred. Reopened with **Enter**, focused the Functional checkbox directly and pressed **Space** — `checked` flipped to `true`, confirmed by direct query. Focused "Save choices" and pressed **Enter** — the resulting `rahma_consent` cookie exactly reflected the keyboard-only choice (`functional:true, analytics:false`), and the matching `granted` row landed in `consent_events` (`consent_id da8a97c4-…`, §Gate 3 table).

**Reduced motion — partially disclosed limitation.** The `chrome-devtools` MCP's `emulate` tool has no `prefers-reduced-motion` parameter (confirmed — passing `reducedMotion` was rejected as an unknown argument), and there was no safe way to force the OS/browser media feature another way without risking the shared dev server. Instead, verified via the browser's own **live-served, compiled CSS**: fetched the actual stylesheet the page loaded and found `@media (prefers-reduced-motion: reduce) { .motion-reduce\:animate-none { animation: none; } }` genuinely present (not source-read — this is the real bundle the browser executes). Cross-checked against the live DOM: the banner's card element carries exactly that class, `motion-reduce:animate-none`, alongside its entrance-animation classes (`animate-in fade-in-0 slide-in-from-bottom-4`). This confirms the mechanism is wired correctly for native browser evaluation, but I did **not** visually toggle the OS setting and watch the entrance animation itself change — that specific visual confirmation is not something I could perform with the tools available and is reported as not done, not claimed.

**Verdict: PASS**, with the reduced-motion caveat above disclosed rather than smoothed over.

---

## Gate 8 — no cookie wall + booking interplay (PASS)

**No cookie wall.** With the banner up (fresh state, no interaction): the fixed wrapper `<section>` has `pointer-events: none` (only the card itself, `pointer-events: auto`, intercepts clicks); no full-viewport backdrop element exists anywhere in the DOM at that time — the only other wide `position:fixed` elements are the site header (`pointer-events:auto`, `z-index:100`, expected) and the banner's own wrapper. Page confirmed genuinely scrollable (`document.documentElement.scrollHeight > window.innerHeight` → `true`; `body { overflow: hidden auto }` — horizontal locked, vertical free, standard). The `gate5-banner-375.png` screenshot shows the footer's content fully visible and reachable directly behind/around the banner, undimmed.

**Booking dialog interplay at 375px.** Loaded `/home/?booking=1` fresh at 375×812 — dialog opens full-screen at this breakpoint. Screenshot (`gate8-booking-dialog-375-with-banner.png`) shows **no banner pixels visible at all**; the "Continue" primary action button sits clean at the bottom with nothing overlapping it. Measured directly: the banner (`z-index:900`) is present in the DOM at this moment but the dialog's popup (`z-index:9999`) is stacked above it, so wherever their fixed-position boxes geometrically overlap in the page's coordinate space, the dialog paints on top — the banner is present-but-invisible-and-unreachable while the dialog is open, exactly the accepted posture recorded in the plan (C18-F4) and progress (§"Phase C must honour"). The dialog's action row is never obstructed.

**Verdict: PASS.**

---

## Footer link (PASS on two pages)

Confirmed the "Cookie settings" link in `SiteFooter` on two distinct public pages:
- `/home/` — link present, `href="?cookie-settings=1"`.
- `/reviews/` — link present, `href="?cookie-settings=1"`; **clicked it for real** (chrome-devtools `click`) and confirmed the preferences panel dialog actually opened (`role="dialog"`, title "Cookie settings").

**Verdict: PASS.**

---

## `/booking/manage` — no banner (PASS, live); path to `/cookies` (source-confirmed, not live-clickable — BLOCKED for a stated reason)

Loaded `http://localhost:3000/booking/manage?token=fake-test-token-do-not-use` (a deliberately invalid token — I hold no valid manage token and must not obtain one, since that would mean touching a real customer's booking or Badar's untouchable `9d55ce2a`, and I may not authenticate as admin to mint one). Confirmed live: **no banner** (`bannerPresent:false`) and **no Sentry Replay key written** (`sessionKeys:[]`).

The page rendered `InvalidManageLink` (expected for an invalid token — `getCustomerManageBooking` returned nothing). I read `src/app/booking/manage/page.tsx` directly myself: the paragraph containing the `Link href="/cookies/"` ("This page keeps to what your booking needs and doesn't run the cookie banner here…") is only reachable in the **successful**-booking branch (line ~190), which requires `booking` to be truthy; the invalid-token branch (`InvalidManageLink`, line ~316) renders a completely different, shorter body with no such link. Both branches sit under the root layout, which mounts neither `ConsentScripts` nor `CookieBanner` regardless of branch — so the "no banner" half of the requirement holds unconditionally and I confirmed it live on the only branch I could safely reach.

**The "/cookies" link itself: BLOCKED from live click-through**, for a stated reason — I have no safe way to reach the successful-booking branch without a real, valid token, and obtaining one would require exactly the actions this dispatch prohibits. Confirmed via my own direct source read instead (not a restatement of the Phase-E/F verifier's earlier claim, though it independently reached the same conclusion).

---

## Summary table

| Gate | Verdict | Notes |
|---|---|---|
| 2 — regulator test | **PASS** | Zero Google requests, fresh + post-reject-all + with booking dialog open |
| 3 — consent_events proof | **PASS** | Grant + withdrawal rows confirmed live via SELECT-only SQL, same `consent_id` joins both times (twice, independently) |
| 4 — withdrawal | **PASS** | `_ga*` cookies and `sentryReplaySession` both cleared, reload confirmed, zero Google requests post-reload |
| 5 — parity + no pre-tick | **PASS** | Computed-style identical at 4 viewports; both toggles default off |
| 6 — version-bump re-prompt | **PASS** | Cookie-only stale-version write, banner re-prompted, `CONSENT_BANNER_VERSION` never touched |
| 7 — a11y | **PASS** | 0 axe violations on banner/panel; 1 pre-existing/out-of-scope violation on `/cookies`; focus trap, keyboard-complete, ESC all measured directly; reduced-motion confirmed via live CSS+DOM, visual toggle not performed (tooling gap, disclosed) |
| 8 — no wall + booking interplay | **PASS** | No backdrop, page scrollable; dialog z-index (9999) confirmed above banner (900) at 375px, action row clean |
| Footer link | **PASS** | Present and functional on two pages |
| `/booking/manage` | **PARTIAL** | No banner: live-confirmed PASS. Path to `/cookies`: source-confirmed only, BLOCKED live (no safe valid token available) |

**Overall: every gate item I could safely exercise live passed, with defects found in none of them.** The one BLOCKED sub-item (`/booking/manage`'s `/cookies` link, live click-through) is blocked for a documented, correct reason — not a defect, not skipped carelessly.

*End of report.*
