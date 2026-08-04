# C-18 — Adversarial plan review (whole-diff sweep, `70e2103..26a7d3f`)

**Role:** independent adversarial reviewer, protocol §2.5. No prior involvement in C-18's implementation or per-phase verification. Read-only (`git log`/`diff`/`show`/`status` only) plus SELECT-only SQL and one attached read-only browser session against the Owner's already-running `localhost:3000`. This file is the only file I wrote.

**Premise going in:** assume something is wrong and find it. **What I found:** the plan is sound and the shipped code matches it, including two genuine-but-narrow findings below (one MEDIUM dormant coverage gap, one LOW edge case) and one process/documentation gap that is about the audit trail, not the code. No scope creep, no lost steps, no false public statement, no orphaned dead code, no state-machine disagreement between surfaces. Everything below is what I personally read, ran, or clicked — not a restatement of any other agent's report, though where another read-only evidence file already existed for the same code I cross-checked it and say so explicitly.

---

## 0 — What I examined

- Full diff `git diff 70e2103..26a7d3f` (43 files, +8134/-47) read file-by-file for every non-evidence, non-progress file: `cookie-registry.ts`, `consent-state.ts`, `ConsentScripts.tsx`, `consent-store.ts`, `CookieBanner.tsx`, `ConsentPreferencesPanel.tsx`, `ConsentActionButton.tsx`, `GoogleAnalytics.tsx`, `(public)/layout.tsx`, `cookies/page.tsx`, `CookieRegistryGroups.tsx`, `api/consent-events/route.ts`, the migration SQL, `sentry.client.config.ts`, `SentryProvider.tsx`, `BookingExperience.tsx` diff, `returning-customer.ts`, `booking-store.ts`, `SiteFooter.tsx`, `booking/manage/page.tsx`.
- Plan (`C-18-cookie-consent-plan.md`), brief, and progress file (all 13 plan steps, §3 Owner decisions 1-9, §3.1's "twelve false statements" postmortem, §3.5's migration-grant finding).
- All 19 commits between `70e2103` and `26a7d3f` individually (`git log --oneline`, `git show --stat` on the three commits with no prior written verification).
- **Static gates, run myself, not restated:** `npx tsc --noEmit` (0 errors), `npx vitest run` (full suite), `npx eslint .` (full repo).
- **Live database, SELECT-only, run myself:** RLS/grants/row contents on `public.consent_events` via `mcp__supabase__execute_sql` against project `twzutkfgqclqurvkmvqz`.
- **Live browser, run myself:** attached to the Owner's already-running dev server (never spawned/restarted/killed), first-visit state, Accept-all, Reject-all, a planted-cookie withdrawal, a route-change Replay start, and a 375px booking-dialog/banner z-order check.
- Four **uncommitted** evidence files already sitting in the working tree (`phase-d-verify-full.md`, `phase-ef-verify-full.md`, `fix-round-verify.md`, `registry-rls-accuracy.md`) — read as *candidate leads*, then independently re-checked against source/live state rather than taken on faith. Every claim from them that I re-checked held. That re-checking is reported inline below, attributed as mine.

---

## 1 — Scope creep (hunt item 1)

Compared the full `--stat` file list against the plan's §2 files-touched table plus the nine Owner decisions in the progress file's §3.

**No unauthorised file found.** Every touched file maps to either the plan's original list or a recorded decision:
- Registry/consent-state/ConsentScripts/CookieBanner/ConsentPreferencesPanel/ConsentActionButton/consent-store — Phase A/B/C, as planned (the plan asked for "a tiny provider/hook"; the implementer built a module-level store instead, documented and justified in `consent-store.ts`'s own header comment — a technique substitution, not scope creep, since the (public) layout must stay a server component, and I verified `(public)/layout.tsx` is indeed still a plain function with no `"use client"`).
- `GoogleAnalytics.tsx`, `(public)/layout.tsx`, `cookies/page.tsx` + `CookieRegistryGroups.tsx`, `api/consent-events/route.ts`, the migration, `SiteFooter.tsx` — plan-listed.
- `sentry.client.config.ts`, `SentryProvider.tsx` — Owner decisions 1/3/9 (the third registry purpose, the second gated loader).
- `BookingExperience.tsx` — Owner decision 6 (the functional gate), confirmed **zero** unrelated lines touched (`git diff` shows exactly the import, the two `*IfConsented` wrapper exports, and the two call-site swaps at the pre-fill effect and the submit handler).
- `booking/manage/page.tsx` — not literally named in the plan's files-touched table, but the plan's own Step 12 executability note anticipated exactly this ("if that page lacks the SiteFooter, add the link to its page shell"), and the commit that added it (`295f4d2`) is the Phase F commit. Not scope creep.
- `redesign/per-page-progress/OWNER-ACTION-BACKLOG.md` — two rows added, both Owner-facing (the Sentry console scrubbing rule, the unpinned upgrade-hazard channel), consistent with the C-18 Phase 0 fix. Documentation, not app scope.

**`src/app/admin/**`, root `src/app/layout.tsx`, `src/lib/maintenance.ts`, middleware, build configs — untouched.** Confirmed by absence from `--stat` (admin, root layout, middleware, configs) and by `git show --stat` on every commit for `src/lib/maintenance.ts` specifically (empty on all 19).

---

## 2 — Lost steps (hunt item 2)

Walked plan Steps 1-13 against the diff:

| Step | Status |
|---|---|
| 1 (registry) | Shipped, `cookie-registry.ts`, 6 entries, completeness test present |
| 2 (`/cookies` page) | Shipped |
| 3 (`consent-state.ts`) | Shipped, plus `functional` added to `ConsentChoices` beyond the brief's `{analytics}` — Owner-approved (progress §3, decision 6) |
| 4 (`ConsentScripts.tsx`) | Shipped **superseded as documented**: server-read → client-read (Owner decision 5, correctly recorded and correctly implemented — see §7 below); `booking/layout.tsx` correctly **never created** (C-17 had created and then deleted it over the token leak; C-18 does not recreate it, matching the plan's own executability note) |
| 5 (banner) | Shipped, parity enforced by the type system (`className`/`style` stripped from `ConsentActionButtonProps`) |
| 6 (panel) | Shipped |
| 7 (wiring) | Shipped, including the withdrawal ordering (beacon before reload, by construction — synchronous code, not a race) |
| 8 (gated GA loader) | Shipped, both C-17's env/production check and the Phase C analytics check present, both required |
| 9 (migration) | Shipped with an added `GRANT INSERT` the brief's SQL omitted — correctly identified as load-bearing (§3.5), Owner-approved 2026-08-04, applied as `20260804182200` |
| 10 (route) | Shipped, always-204, zod-validated, size-capped, no `.select()` chained |
| 11 (client logging) | Shipped, `sendBeacon` preferred / `fetch(keepalive)` fallback, fire-and-forget |
| 12 (footer link) | Shipped, plus the `/booking/manage` fallback path the plan's own note anticipated |
| 13 (verification + bookkeeping) | Partially discharged — see §8, the one real gap this review found |

No step was quietly dropped. The two known-superseded items (Step 4 wording, `booking/layout.tsx`) are exactly the two the dispatch named, and both check out against the code, not just the commit message.

---

## 3 — Style/idiom drift (hunt item 3)

Read every touched file's comment density, naming, and test structure across the opus-routed phases (B, C, D) and the sonnet-routed ones (A, E, F, and the fix round). Found **no drift**: every file carries the same register (long header comments stating WHY, not just what), the same test-file shape (`describe`/`it` blocks with a comment above each non-obvious assertion), the same `*ForTests()` naming convention for module-store test hooks, and the same "disclosed residual" pattern (a comment naming a known limitation rather than hiding it) from Phase A's registry comments through the final fix round's commit message.

Standing code rules, checked directly:
- **No `border-l-4`** anywhere in the diff — grepped.
- **`prefers-reduced-motion`** — `CookieBanner.tsx` uses `motion-reduce:animate-none` (CSS, deliberately not framer-motion's hook, disclosed and bundle-justified in its own comment). `ConsentPreferencesPanel.tsx`'s backdrop/popup fade has no reduced-motion variant — checked whether this is C-18 drift by grepping `motion-reduce` across the whole repo: **neither `src/components/ui/dialog.tsx` (the shared wrapper) nor `BookingDialog.tsx` (the pattern `ConsentPreferencesPanel.tsx` explicitly says it copies) uses `motion-reduce` either.** This matches pre-existing codebase convention for Base UI dialogs, not a C-18 regression.
- **`updateTag`/`unstable_cache`/`Set`/`Map`/`Date`** — none of the new consent code touches caching at all; grepped, zero hits.
- **`createSupabaseAdminClient()` only after `getStaffProfile()`** — the one new call site (`api/consent-events/route.ts`) does not call `getStaffProfile()` first, but this is a public, unauthenticated, fire-and-forget logging endpoint by design (matching the pre-existing pattern in `api/availability/route.ts` and `api/bookings/route.ts`, both public booking-flow routes that also use the admin client without staff auth). Not a violation of the rule's intent.
- **Mobile-first / clean at 375** — live-verified myself (§6).

---

## 4 — The copy, regenerated myself (hunt item 4)

I did not read the prior agents' 54-string and 7-string tables and agree with them. I opened `cookies/page.tsx`, `CookieRegistryGroups.tsx`, `CookieBanner.tsx`, `ConsentPreferencesPanel.tsx`, `ConsentActionButton.tsx`, `SiteFooter.tsx`, `booking/manage/page.tsx`, and all six `COOKIE_REGISTRY` entries' `description`/`duration` fields myself, and checked each against the code that actually implements it:

- **`rahma_consent`** description/duration — checked against `consent-state.ts`'s `CONSENT_MAX_AGE_S` (182 days) and `writeConsent()`'s only call sites (traced: `recordConsentChoices` ← banner/panel button clicks only). TRUE.
- **`zam-therapy-booking-draft-v3`** — checked against `booking-store.ts`'s `partialize`, which persists `selectedPackageIds` only. TRUE. Checked the "persists after submission" duration claim against `resetDraft()`'s one caller (`startOver`, `BookingExperience.tsx:549`) — still only reachable from "Start a new request," confirmed unchanged by this diff, so the claim is still true and the pre-existing behaviour (a known, disclosed, out-of-scope privacy wart) is unchanged.
- **`rahma-booking-contact-v1`** — checked the field list (10, matching `storedContactSchema` exactly) and the "switch it off and anything already stored is deleted" claim against `applyChoiceTransition`'s `if (previous.functional && !next.functional) { … clearReturningCustomer(); }` branch. TRUE. Live-confirmed the gate is wired, not just testable, via `BookingExperience.tsx:64-71`'s two `*IfConsented` wrappers being the ones actually called at the pre-fill effect (`:309`) and submit handler (`:520`).
- **`_ga / _ga_*`** — checked against `GoogleAnalytics.tsx`'s two-condition gate and confirmed live (§6): zero Google requests before consent, `gtag('consent','update',{analytics_storage:'granted'})` fires on Accept-all, `_ga*` cookies actually deleted on withdrawal.
- **`maintenance-modal-seen`** — checked `dormant` is gone from the type (`CookieRegistryEntry` has no such field — confirmed by reading the whole interface) and that the description makes no "currently off" claim, matching the **committed** `MAINTENANCE_MODE = true` (checked via `git show HEAD:src/lib/maintenance.ts`, not the Owner's uncommitted working copy).
- **`sentryReplaySession`** — checked the admin/booking-manage carve-outs against `sentry.client.config.ts`'s `isReplayBlockedPath`/`isAdminPath` ordering (both checked *before* the consent branch) and live-confirmed both: granted consent + direct load of `/booking/manage?token=…` → no Replay session written; granted consent + normal public route change → Replay session written (§6).
- **Purpose descriptions/labels, purpose-status badges, page headings/intro/`<title>`/`<meta description>`, banner sentence, panel title/description/locked-reason/button labels, footer link, `booking/manage` paragraph** — read every one of these strings standing alone against the code. All TRUE. Two I specifically stress-tested for the exact failure class Phase A produced (a claim read true in isolation but false next to its neighbour, or true today but silently invalidated by a later phase):
  - The analytics purpose-status badge ("Off unless you switch it on") has no room for the `/admin` carve-out on its own — but it sits directly beside `PURPOSE_DESCRIPTIONS.analytics` and the `sentryReplaySession` entry's own text, both of which name the exception in the same visual block. Not read in true isolation the way the Phase A heading/card contradiction was. Judged TRUE-with-context, matching what the last independent Phase D check separately concluded — I re-derived this myself before reading that conclusion.
  - `sentryReplaySession`'s "only runs on our public pages" doesn't separately flag the *stricter* `/booking/manage` carve-out (never runs there even with consent). Not false (it's a necessary, not sufficient, condition, and `/booking/manage` genuinely is not a "public page" it needs to distinguish), but it's the kind of omission the §3.1 lesson exists to catch — recorded for completeness, not counted as a defect.

**No false statement found**, no heading contradicted by its own card, no button promising a control that doesn't exist. I regenerated the list from the code, not from a prior list, and it came out clean.

---

## 5 — Cross-phase contradictions and the PHASE D OBLIGATION list (hunt item 5)

Read `cookie-registry.ts`'s obligation block (lines ~232-269 at HEAD) against the actual gates:

| Item | Claimed gate | Verified |
|---|---|---|
| 1 — functional | `saveReturningCustomerIfConsented`/`loadReturningCustomerIfConsented` in `BookingExperience.tsx` | Confirmed at the real call sites, not just the exported functions |
| 2 — analytics (GA + Replay) | `GoogleAnalytics.tsx` + `syncSessionReplay()` | Confirmed both, live |
| 3 — group badge | `CookieRegistryGroups.tsx` | Confirmed purpose-aware and matching the gates above |
| 4 — `_ga` description | GA gate | Confirmed live |
| 5 — `sentryReplaySession` description | Replay gate + Owner decision 9's `/admin` carve-out | Confirmed live, including the `/admin`-unconditional-off branch checked *before* the consent branch |
| 6 — `rahma_consent` description | banner/panel now write the cookie | Confirmed — `writeConsent()`'s only callers are the button handlers |

**All six genuinely discharged, none stale.** No item claims "OPEN (Phase D)" while Phase D has shipped, and no item claims a gate that doesn't exist.

**One real gap this list itself doesn't cover**, found by reading `consent-store.ts`'s `logConsentEvent` against `cookie-registry.ts`'s `groupRegistryByPurpose()` together — see Finding 1 below. It is not a PHASE D OBLIGATION violation (no copy is false because of it today), but it is exactly the *shape* of defect that obligation list exists to prevent, one level removed: a legal record making a claim about what was offered that the registry's own filtering logic could someday make untrue.

---

## 6 — Dead code and the consent state machine end-to-end (hunt items 6-7), live-verified

`dormant?`/`provisionalNote?` — grepped `src/`: the only matches are the two *negative* assertions in `registry-completeness.test.ts` (`not.toHaveProperty("dormant")` / `"provisionalNote"`). No renderer, no interface field, no registry entry still carries either. Confirmed the interface (`CookieRegistryEntry`) only has `name/provider/type/purpose/duration/description` — nothing orphaned.

**Read `consent-state.ts`, `consent-store.ts`, `ConsentScripts.tsx`, `CookieBanner.tsx`, `ConsentPreferencesPanel.tsx`, `GoogleAnalytics.tsx`, `sentry.client.config.ts`, `SentryProvider.tsx`, `BookingExperience.tsx`'s gate as one system, then drove it live** against the Owner's dev server (attached to the already-running `localhost:3000`, never restarted; cleaned up every cookie/localStorage/sessionStorage key I planted afterward):

1. **Fresh state**: `document.cookie` had no `rahma_consent`; `dataLayer` held exactly one entry, the default-denied push; banner visible with the exact copy from source; zero network requests to any Google host.
2. **Accept-all**: cookie written `{v, id, choices:{analytics:true,functional:true}, ts}`; `dataLayer` gained `['consent','update',{analytics_storage:'granted'}]`; banner disappeared; `POST /api/consent-events/` → 204; **`sentryReplaySession` was NOT written immediately** — confirmed the documented "Replay starts at the next route change, not at the grant" behaviour empirically: `sessionStorage` was still empty right after the click.
3. **Client-side route change** (clicked "About"): `sentryReplaySession` appeared in `sessionStorage` (`sampled:"buffer"`), confirming the deferred-start design works as documented, not just as commented.
4. **Withdrawal**: planted fake `_ga`/`_ga_TESTID` cookies, opened the panel via `?cookie-settings=1`, clicked Reject-all. Result: `rahma_consent` rewritten to `{analytics:false,functional:false}` with a fresh timestamp; **`_ga` and `_ga_TESTID` cookies actually gone** from `document.cookie`; `sentryReplaySession` gone from `sessionStorage`; page reloaded; a second `POST /api/consent-events/` fired before the reload. (One tooling note: my first attempt via coordinate-based click silently failed to register — the pane wasn't compositing frames for screenshots at the time, a known limitation per this repo's own browser-verification notes, not an app defect. A direct `element.click()` dispatch on the located button succeeded and is what produced the result above.)
5. **375px booking-dialog interplay**: opened the booking dialog at 375×812. Dialog: `role="dialog"`, full-viewport rect `(0,0,375,812)`, `z-index:9999`. Banner: rect `(0,462)-(375,812)`, `z-index:900`. The banner sits entirely beneath the dialog's footprint at the higher z-index — the accepted C18-F4 posture, confirmed by measurement, not by reading the comment.
6. **Own SELECT-only SQL** against `public.consent_events` (project `twzutkfgqclqurvkmvqz`): table exists, `relrowsecurity=true`, 0 policies, `service_role` has INSERT and not SELECT, `anon`/`authenticated` have neither. Read all 6 rows currently in the table (2 of them mine, from steps 2 and 4 above): every row's `consent_id` for a grant→withdrawal pair matches (mine: `f846ffc4-…` on both the `granted` row and the later `withdrawn` row) — the pseudonymous-id-survives-a-withdrawal claim, confirmed against a real write, not a unit test. No IP, no PII, no UA in any row.

**No disagreement found between any two surfaces.** Every choice the banner/panel records is read by every gate that claims to honour it; every purpose the panel shows has an enforcing gate; every transition leaves every surface consistent (a grant is picked up by GA immediately and by Replay at the next navigation — both by design, not by accident, and both verified live).

**Housekeeping note, not a defect:** my two live test writes bring the table to 6 rows total, all clearly verification-session data (no real client's `rahma_consent` id), consistent with the plan's own §6 fixture guidance ("prune with user confirmation post-verification"). I did not delete them — SQL is SELECT-only for this review. Flagging for the Owner/orchestrator if a prune is wanted before go-live.

---

## 7 — Owner decision 5 (client-read consent), specifically stress-tested

This is the one place the plan's own text was superseded, so I gave it extra scrutiny rather than accepting the progress file's account. Read `ConsentScripts.tsx` in full: the inline script is a hand-written second parser of the cookie (unavoidable — it's a string, it cannot import `readConsent`). Checked its rules line-by-line against `consent-state.ts`'s `parseConsentCookie`/`readConsent`: same cookie-name exact-match (not substring), same percent-decode-with-fallback, same JSON.parse-in-try/catch, same `v`/`id`/`ts`/`choices.analytics`/`choices.functional` presence-and-type checks, same version-mismatch-is-null semantics. Both cookie name and banner version are interpolated from their single source constants (`CONSENT_COOKIE`, `CONSENT_BANNER_VERSION`), never retyped as literals. Live-confirmed the read happens before hydration and before any Google code (item 1 in §6). This is a real second-source-of-truth risk, correctly identified as such in the code's own comments, and correctly mitigated by construction (shared constants) rather than by promise alone.

---

## Findings

### Finding 1 — MEDIUM (dormant, not currently live): consent-proof `purposes_offered` can silently drift from what the panel actually shows

**File:** `src/components/consent/consent-store.ts` (`logConsentEvent`, `purposes_offered: NON_ESSENTIAL_PURPOSES`) and `src/lib/consent/cookie-registry.ts` (`NON_ESSENTIAL_PURPOSES = PURPOSE_ORDER.filter(p => p !== "essential")`).

`NON_ESSENTIAL_PURPOSES` is a **static taxonomy list** (`["functional","analytics"]`, from `PURPOSE_ORDER`), independent of whether `COOKIE_REGISTRY` actually has any entries for a purpose. The panel's own toggle list, `GATED_PURPOSES` (`ConsentPreferencesPanel.tsx`), is different: it comes from `groupRegistryByPurpose()`, which **drops any purpose with zero registry entries** (`cookie-registry.ts`: `.filter((group) => group.entries.length > 0)`). At HEAD the two lists happen to be identical — `functional` has 1 live entry (`rahma-booking-contact-v1`), `analytics` has 2 (`_ga`, `sentryReplaySession`) — so this is not reachable today; I confirmed the counts directly by reading `COOKIE_REGISTRY`.

**Failure scenario:** if a future change ever removed the last registry entry for a non-essential purpose while leaving that purpose in `CookiePurpose`/`ConsentChoices` (a far more plausible edit than adding a brand-new purpose — e.g. retiring the booking-contact cookie), the panel would stop rendering a toggle for it (`groupRegistryByPurpose` drops the empty group), but every subsequent consent-proof beacon would still list it in `purposes_offered`. The legal record would then claim a purpose was shown and offered to the visitor when no control for it existed on the page — the exact "record makes a claim the UI doesn't back up" defect class Phase A's twelve false statements belonged to, just relocated from visible copy into the (invisible, but legally load-bearing) proof log.

No test guards this direction. The one new test added for this exact code path (`0d2246c`, "Phase E/F verifier finding: purposes_offered derives from the registry") pins that `ConsentChoices`'s keys equal `NON_ESSENTIAL_PURPOSES` — it guards the interface against drifting from the taxonomy, not the taxonomy against drifting from the registry's actual entries. `registry-completeness.test.ts` has no assertion that every member of `NON_ESSENTIAL_PURPOSES` has ≥1 live `COOKIE_REGISTRY` entry.

**Recommendation:** derive `purposes_offered` from `GATED_PURPOSES`-equivalent, registry-entry-driven data (or add a completeness-test assertion that `NON_ESSENTIAL_PURPOSES` and the registry's populated purposes stay identical), so a purpose losing its last entry fails a test instead of shipping a beacon claim the UI can no longer back up.

### Finding 2 — LOW: Session Replay can get stuck stopped for the rest of a page's life after passing through a blocked route

**File:** `sentry.client.config.ts:180-191` (`if (replay) return;` inside `syncSessionReplay`).

`Sentry.getReplay()` returns the registered integration instance once `Sentry.addIntegration(Sentry.replayIntegration(...))` has ever run, regardless of whether it is currently stopped. So once Replay has started and then been stopped by `syncSessionReplay` returning early on `/admin` or `/booking/manage`, the function's own `if (replay) return;` guard means it will **never call `addIntegration` again for the rest of that page life**, even if the visitor is later on an eligible route with analytics still granted. Traced: the withdrawal path is unaffected (it forces `window.location.reload()`, which resets all module state), and `/booking/manage` is unreachable via any in-app client-side link *to* it (confirmed: the only route in is a direct/email load, per the Phase 0 fix's own comment, so replay is never even started before that block fires). The one path where this actually bites is a visitor whose analytics grant survives a client-side navigation into `/admin` (which requires staff authentication) and then a client-side navigation back out to a public route without a full reload — narrow, and not reachable by an ordinary anonymous public/booking visitor.

Not a live defect for any realistic visitor journey audited by this review; recorded because the invariant that makes it safe ("nothing resumes automatically, and nothing needs to") is implicit rather than tested, in the same family as the already-fixed F1 finding (`c327973`) about `replayGate` registration timing — this is a second, distinct gap in the same function, not a recurrence of F1 itself (F1 was about the gate being *unregistered*; this is about the gate being registered but *stuck stopped*).

### Finding 3 — INFO / process: six phases of already-completed independent verification exist only in the uncommitted working tree

Confirmed via `git log --oneline -- <path>` (empty for all four) and `git status --porcelain`: `redesign/evidence/C-18/phase-d-verify-full.md`, `phase-ef-verify-full.md`, `fix-round-verify.md`, `registry-rls-accuracy.md`, a `live-gate-screens/` directory, and a four-item append to `C-18-cookie-consent-progress.md`'s §3 (Owner decisions 7-9: the migration approval, the bundle-ceiling ratification, and the `/admin` Replay-off decision) are all **untracked or unstaged** — they exist on disk but nowhere in git history. The last *committed* state of the progress file is `4c25588` (Phase C's verification), ten commits and three phases before HEAD `26a7d3f`. Its own "▶ Position" section still reads "Phases C–G not started," which materially misstates how much of C-18 has shipped and been independently checked, if anyone reads only the committed record.

This is not a code defect — I independently re-checked the substance of these uncommitted reports myself (§0, §6-7 above) and found their conclusions correct. But it is a genuine audit-trail risk for a program that otherwise runs on git history as the record of truth: this verification work (including a real, already-fixed finding, F1) would vanish without a trace if the working tree were ever reset, and the committed progress file currently undersells the programme's own state by a wide margin. Worth a documentation-only commit before C-18 is called closed.

---

## Overall

**PASS.** No CRITICAL or HIGH finding. Two genuine, narrow findings (MEDIUM dormant coverage gap on the consent-proof beacon's purpose list; LOW edge-case on Replay's resume behaviour after a blocked route) and one process/documentation gap (uncommitted verification trail, stale "Position" section). All plan steps accounted for; scope creep list matches the nine recorded Owner decisions exactly with none left over; the twelve-false-statements defect class was hunted for directly in this pass's own regenerated copy sweep and not reproduced; the PHASE D OBLIGATION list is genuinely fully discharged; no dead code found; the consent state machine agrees with itself end-to-end, confirmed by live interaction and a live database read, not source reading alone.

**Gates, run by me:** `tsc --noEmit` 0 errors · `vitest run` 5 failed / 1974 passed (1979), identity-exact to `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 · `eslint .` 66 problems (59E/7W), identity-exact to the six baseline files (`design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`) · `next build`/`pnpm build` **not run**, per this review's hard rule (the orchestrator's single build gate runs last).
