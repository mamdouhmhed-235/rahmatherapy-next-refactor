# C-18 — Cookie consent — PROGRESS

**Plan:** `redesign/plans/C-phase/C-18-cookie-consent-plan.md`
**Brief:** `redesign/briefs/C-18-cookie-consent-brief.md`
**Programme:** Band C, C-C implementation — plan **#18 of 22** (§4 order). **Co-ships with C-17**, which shipped immediately before at `d5425ec`.
**Predecessor:** C-17, closeout `70e2103`.
**Migration:** ONE — `c18_consent_events`. **⛔ Zone-2, not yet applied.**

---

## 0 — Pre-flight (2026-08-04, at `70e2103`)

- Branch `master`; `git merge-base --is-ancestor ea97932 HEAD` → exit 0. The C18-F1 branch decision is moot.
- `git status --porcelain` over every C-18 path → **empty**.
- **C-17 landing state (pre-flight #3): C-17 HAS landed.** `src/components/GoogleAnalytics.tsx` exists and is mounted in `(public)/layout.tsx`. **So Step 8 is a REWRITE, not a create** — the plan's C18-F3 fallback (create-in-gated-form) does not apply. The `// C-18 consent insertion point` comment is already in place at `GoogleAnalytics.tsx:17`, positioned so `gtag('consent','default',…)` executes **before** `gtag('js')`.
- **`src/app/booking/layout.tsx` does NOT exist.** C-17 created it, then **deleted** it under an Owner ruling (its GA mount leaked the manage token to Google). No placeholder was left. See §2.
- Pre-flight #5: `SELECT to_regclass('public.consent_events')` → **null**. Table genuinely absent.
- No sitemap file exists (`src/app/sitemap.*`) → Step 2's "add to the sitemap" conditional is a **no-op**, as the plan's own executability note predicted.
- `footerContent.legalLinks` is `[]` (`src/content/site/footer.ts:26`) → Step 12's footer link is the **first** entry, not an insertion into an existing row.
- **⚠️ Dev server DOWN** (`curl` → 000). Protocol §0 forbids agents spawning servers; the Owner runs `pnpm dev`. **Pre-flight #4's browser confirmation pass is therefore OUTSTANDING** — see §1.

**Verification tiers (§2.9c):** Phase B **FULL** (consent-state correctness + Consent Mode ordering — wrong here and the gate is decorative), Phase D **FULL** (gated loaders, live public surface), Phase E **FULL** (migration + API route). Phases A, C, F **TARGETED**.
**Model routing (§5):** Phases B and D `opus` — Consent Mode ordering must hold before the first hit and the loaders must never mount on a stale consent read. Phase 0's leak fix was `opus`. Everything else `sonnet`; all verifiers `sonnet`.

---

## 1 — Phase A input: the cookie inventory (pre-flight #4)

**Source-derived pass complete** — `redesign/evidence/C-18/cookie-inventory-source.md`. **12 distinct client-storage mechanisms**; 5 reach an anonymous public/booking visitor (the registry's actual scope), 7 are staff-only inside `/admin`.

All four of the plan's hypotheses confirmed accurate: `zam-therapy-booking-draft-v3` (localStorage, zustand persist, only `selectedPackageIds`); `rahma-booking-contact-v1` (**PII-bearing** — full name, phone, email, address, 180-day expiry); `maintenance-modal-seen` (sessionStorage, **currently dormant** since `MAINTENANCE_MODE = false` means `MaintenanceModal` never mounts); and **no Supabase auth cookies for anonymous visitors** — verified, since the only cookie-writing Supabase client is called exclusively from `src/app/admin/**` and middleware's matcher is `/admin/:path*`.

**⚠️ One mechanism the plan's registry never contemplated: Sentry Session Replay** (`sentryReplaySession`, sessionStorage), mounted at the **ROOT** layout, therefore covering `(public)`, `/admin` **and** `/booking/manage`. Recording 10% of sessions and 100% of sessions with an error. See §2.

**Two classification questions raised rather than defaulted:**
- **`rahma-booking-contact-v1` is probably NOT essential.** It pre-fills a returning customer's form across visits — a convenience, not something the current booking transaction depends on. The registry's `essential | analytics` enum has no bucket for it.
- Session Replay likewise fits neither bucket. **The registry needs a third purpose category.**

**⏳ OUTSTANDING — browser confirmation pass (needs the Owner's dev server).** 7 items the source pass could not settle, including Google's actual cookie set and attributes, any Cloudflare-platform cookies, and a live Application-tab sweep to close gaps a static grep cannot see. **The `/cookies` page is a legal statement about what the site stores; the registry must not be finalised on source reading alone.**

---

## 2 — ⚠️ Phase 0: an ACTIVE production credential leak, found and fixed

**Not in the plan.** Found by the pre-flight #4 inventory, investigated read-only (`redesign/evidence/C-18/sentry-replay-investigation.md`), and fixed under explicit Owner authorisation.

**The defect.** `/booking/manage?token=<bearer>` carries the customer's booking-management credential in the query string. Sentry Session Replay was capturing and transmitting it. Established from the **installed package source** (v10.51.0), not inferred:
- **`beforeSend` never runs on Replay data.** `client._processEvent()` gates it behind `isErrorEvent()`; Replay's `sendReplayRequest()` bypasses that private method and calls a plain `prepareEvent()`. The project's own `scrubSentryEvent` — which *does* redact `manage.*token` — never saw replay payloads.
- The URL was captured in **four** channels, one of which (`replay_event.request.url` + the `Referer` header, via `httpContextIntegration.preprocessEvent`) the first investigation missed and the implementer found.
- `maskAllText`/`maskAllInputs`/`blockAllMedia` default true but mask **DOM content, not URL metadata**. `sendDefaultPii: false` is never referenced in the Replay package.

**Owner confirmed `NEXT_PUBLIC_SENTRY_DSN` IS set in production** — so this was live, not theoretical.

**A correction to the first Owner decision, surfaced before implementing:** consent-gating Replay does **not** fix this. A visitor who consents to analytics has not consented to their own booking credential being sent to a third party. The two needed separate treatment, and the Owner agreed to fix both inside C-18.

**Fixed at `09b2e26`** (model `opus`; files `sentry.client.config.ts`, `SentryProvider.tsx`, new `SentryProvider.test.tsx`):
- Replay removed from `Sentry.init`'s integrations; added deliberately via `Sentry.addIntegration()` only on non-blocked paths, through a route-aware `SentryProvider` with a stale-route guard.
- **Direct load** (the only way the route is reached today — confirmed: no in-app link exists, only `createManageUrl` for emails) holds because no `ReplayContainer` is ever constructed, including no resumption of a sticky `sentryReplaySession`.
- **Client-side navigation** holds by transmission control, since capture cannot be prevented — `handleHistorySpanListener` pushes the URL synchronously with `pushState`, before any React effect. All four flush channels are redacted or dropped.
- **Disclosed residual, correctly characterised:** on the SPA path rrweb may record some masked DOM mutations before `stop()` lands. Inherent to any after-the-fact stop; moot while the route is email-only.

**Verified FULL — PASS.** The critical check was `integrations: []`: if it *replaced* rather than merged the defaults, the fix would have silently gutted production error monitoring — worse than the leak, and invisible to every test. Traced through four package layers at pinned 10.51.0: `getIntegrationsToSetup` merges, Replay was never a browser default, no kill-switch option is in play. `dsn`, `beforeSend`, `tracesSampleRate`, `sendDefaultPii`, `enableLogs` all unchanged. `next build` clean with public routes still static — `usePathname()` in a root-layout client component did not deopt prerendering.

**⚠️ Carried forward: Channel 4 (`Meta.data.href`) has no regression test.** It rests on verified-but-unpinned SDK defaults (`continuousCheckout` undefined in session mode; `forceFlush: false` in buffer-mode `stop()`). **A future Sentry upgrade could silently reopen it.** Logged in `OWNER-ACTION-BACKLOG.md`.

**Owner-side actions this fix cannot perform** (the code fix reaches production only at deploy, so captures continue until then): ingest-side Advanced Data Scrubbing rules in the Sentry console — which, unlike `beforeSend`, DO cover replay payloads; consideration of already-stored replays containing live tokens, and of retention; or disabling Session Replay ingestion at project level. **External-console actions, Owner-only.**

---

## 3 — Owner decisions recorded (all 2026-08-04, in chat)

| # | Decision |
|---|---|
| 1 | **Sentry Session Replay: register it in the cookie registry AND consent-gate it.** Not classified essential — session replay reconstructs what a visitor saw and typed on a health-services booking site, which is the hardest kind of storage to argue is strictly necessary. Error reporting itself stays ungated for everyone. |
| 2 | **The token leak: investigate before C-18 proceeds** — done, §2. |
| 3 | **Fix both inside C-18**, with an approved files-touched extension covering `sentry.client.config.ts` and the Sentry provider. |
| 4 | **`NEXT_PUBLIC_SENTRY_DSN` is set in production** — the leak was live. |
| 5 | **Phase B's consent script reads the cookie CLIENT-side, not via `cookies()`.** Server-reading opted the whole `(public)` route group out of static generation (Next 16.2.4: `next/dist/server/request/cookies.js:88` → `throwToInterruptStaticGeneration`), taking 15 prerendered public pages dynamic. It is also *wrong behind a CDN*: an edge-cached page would carry one visitor's consent state to the next. The same single inline script now reads `document.cookie` at parse time — still before hydration, still before any Google code, no flash. **Plan Step 4's "server-read" wording is superseded.** |
| 6 | **`rahma-booking-contact-v1` stays `functional` and gets a REAL gate.** The panel's Functional toggle must actually skip the write, so **C-18's files-touched list extends to `src/features/booking/BookingExperience.tsx` (~:494)** — third approved extension. A visitor who declines loses form pre-fill on a later booking; that is the intended consequence. Rationale: nothing about the *current* booking depends on it, it is a cross-visit convenience, and it holds the registry's most sensitive fields (gender, access notes) for 180 days. **A toggle that did not gate the write would be a control that lies** — the exact defect class Phase A produced twelve times. |

**Scope this adds beyond the plan's text, all recorded so the diff stays auditable:** a third registry purpose category · a second gated loader in Phase D (GA is a script mount; Replay is an SDK integration that must start late without breaking error capture) · a wider Phase C withdrawal path (Replay stop as well as GA cookie clearing) · `sentry.client.config.ts` + `SentryProvider.tsx` in files-touched.

---

## 3.1 — Phase A (registry + `/cookies` notice page) — **PASS after five fix rounds**

| Commit | What |
|---|---|
| `6ef68a7` | Registry (5 entries), `/cookies` page, 20-test completeness spec |
| `60114d3` | Replay description: "10% of visits are recorded" → every visit is recorded |
| `a5b5d9c` | Draft-clearing claim, contact-store field list, `_ga` consent claim; Phase D string-pin removed |
| `7d83d38` | Purpose-group copy + badge; four further page-body claims |
| `d7ee2bb` | Heading/card contradiction; scope claim narrowed |
| `93a3185` | Intro scope reconciled with the registry's own `Set by:` labels |

**Tier upgraded TARGETED → FULL at the orchestrator's call**, logged: this is a public legal statement, and the first verification found defects a diff-scope check would have passed.

### ⚠️ Twelve false statements, one cause

Every one described **the finished plan rather than the shipped code**. Not carelessness — the plan describes an end state, and copy written alongside it inherits that tense. `/cookies` is simply the place where that stops being an internal note and becomes a claim to the public.

The twelve, by class:
- **Consent promises with no consent system** (5): `_ga` and `sentryReplaySession` each claiming "only … once you accept analytics cookies"; the `functional`/`analytics` purpose descriptions and the badge on every non-essential group promising "off by default"; the essential purpose citing a "cookie banner" that does not exist.
- **Controls that do not exist** (3): the "How we record your consent" card written in the present tense when nothing is recorded anywhere; the "Change your choices" card and its button; the intro and `<meta name="description">` both promising "how to change your mind".
- **Facts contradicted by source** (2): the booking draft claimed cleared on submit — `resetDraft()`'s only caller is the "Start a new request" button, so it persists; and the contact store described as name/phone/email/address when it holds **ten** fields including gender, access notes and parking notes.
- **Self-contradiction** (2): a heading reading "Change your choices" above a body saying there is no control; and the intro's "our own code sets" colliding with the registry's own `Set by: Google` / `Set by: Sentry` labels — **this one introduced by the fix for the previous one.**

**What the last three had in common: none were prose.** A heading, a button label, a `<meta>` description — strings read *standing alone*, which three prose-focused reviews walked past. The final round swept all **21** non-prose strings (title, metas, every heading, every badge and label, provider names) with a verdict for each in isolation; only the known heading was false. That sweep is the evidence the blind spot is closed.

**No test pins this copy, deliberately.** A string-matcher was added and then removed (`a5b5d9c`) because it could only confirm two sentences sat near each other while the thing they described did not exist. The replacement is a **PHASE D OBLIGATION** comment in `cookie-registry.ts` listing every piece of copy that must flip, requiring Phase D to ship the real gate **and a test asserting the gate exists** before flipping any of it.

**Registry shape:** a third purpose, `functional`, was added — `rahma-booking-contact-v1` (ten fields, 180 days) is neither essential nor analytics. Its classification is **provisional pending an Owner ruling before Phase C**, carried in a `provisionalNote` the completeness test asserts is present.

**Also recorded:** the page has no `<h1>` (`SectionHeading` hardcodes `<h2>`) — pre-existing, shared across public pages, an accessibility/hierarchy issue rather than a truthfulness one, not C-18's to fix.

### Owner-facing behaviour finding, reported not fixed
`zam-therapy-booking-draft-v3` **persists on the device after a booking is submitted** — `resetDraft()` fires only from "Start a new request". Now accurately described, but the behaviour is a small privacy wart the Owner may want closed by calling `resetDraft()` on the submit-success path. That means editing `BookingExperience.tsx`, outside C-18's scope.

## 3.2 — Phase B (consent state + Consent Mode ordering) — IMPLEMENTED, **NOT YET INDEPENDENTLY VERIFIED**

| Commit | What | Model |
|---|---|---|
| `6dd05e5` | Step 3 `consent-state.ts` (+21 tests) · Step 4 `ConsentScripts.tsx` · mount in `(public)/layout.tsx` · **sixth registry entry `rahma_consent`** | `opus` |
| `5259ae6` | Client-read switch (Owner decision 5) + 11 equivalence/hostile-input tests | `opus` |

**`consent-state.ts`** — `ConsentState {v,id,choices:{analytics},ts}`, `CONSENT_COOKIE="rahma_consent"`, `CONSENT_MAX_AGE_S` 182 days. `readConsent()` returns null on absent/malformed/**version-mismatch**; `writeConsent()` preserves an existing `id`, else mints via `crypto.randomUUID()`; `clearGaCookies()` expires `_ga`/`_ga_*` across a documented **domain matrix** — host-only (no Domain attribute), `www.rahmatherapy.uk`, `.www…`, `rahmatherapy.uk`, and **`.rahmatherapy.uk`, which is the one gtag actually sets**. A deletion written without the Domain attribute creates a host-only cookie of the same name while the original keeps being sent — silently. Name match is `=== "_ga" || startsWith("_ga_")`, so `my_ga`, `_gali`, `_gat_x` survive (the substring trap broke the first draft assertion and is now pinned).

**`ConsentScripts.tsx`** — server component emitting ONE inline `<script id="consent-default">` (D16: **not** `next/script beforeInteractive`, which Next 16.2.4 restricts to the DO-NOT-TOUCH root layout). Stub → `gtag('consent','default',{…all denied, wait_for_update:500})` → reads `document.cookie` and fires `update {analytics_storage:'granted'}` only for a valid current-version grant. Mounted **first and unconditionally in both branches** of `(public)/layout.tsx`, including maintenance mode. **`src/app/booking/layout.tsx` was NOT created** — superseded (§2, §3 decision 5).

**Ordering evidence:** the script is the first script with any inline content anywhere in the document (`<body>` at offset 5035, script at 5079; next inline is JSON-LD at 9930). It is *not* the first `<script>` **tag** — Next emits ~30 `<script src… async>` runtime chunks in `<head>` first. That is D16's accepted weaker-than-pre-hydration guarantee; none are Google code, and the gated loader will be the only Google-code source, so "default before Google" holds by construction.

**The second-source-of-truth risk, handled explicitly.** The inline script is a string and cannot import, so its parse logic is inherently a second copy of `readConsent()` — this programme's most repeated defect class. Mitigation: constants interpolated from their single definitions (never retyped); identical rule order; and **an equivalence test over a 31-entry corpus** asserting the emitted script and `readConsent()` agree on every entry *and* that each entry gets its independently-pinned answer, so they cannot pass by being wrong together. Corpus covers name-collisions (`not_rahma_consent`, `rahma_consent_old`), jar position, decoy-first, broken percent-encoding and ten wrong-shape payloads. **Mutation-checked:** deleting the `id`/`ts` clause failed both equivalence tests on exactly the `no id` case.

**Malformed input cannot throw** — 44 hostile strings through `expect(...).not.toThrow()`, plus a real-browser check (`rahma_consent=%7Bnot-json%2C` → default-denied only, zero console errors, and `["n","p","r","i","q","d","s"].filter(k=>k in window)` → `[]`, so the IIFE leaks nothing).

**Two accepted additions beyond the dispatch's literal "nothing more"**, both correct and recorded: percent-decoding (`writeConsent` percent-encodes, so without it *every real granted cookie* would fail to parse) and `id`/`ts` presence checks (without them `{v,choices:{analytics:true}}` is honoured by the script but rejected by `readConsent()` — a live divergence that would show up in Phase C as a banner displayed to someone already granted).

**Sixth registry entry `rahma_consent`** — `essential`, 182 days, description states plainly that **nothing writes it yet** (`writeConsent()` has zero callers; banner is Phase C). Added to the PHASE D OBLIGATION list as **item 6**, with the note that it flips *earlier* than the other five — it stops being true the moment Phase C's banner first calls `writeConsent()`. Deliberately **not** marked `dormant`: that flag's rendered copy says a feature is "switched off" and "starts again when switched back on", true of `maintenance-modal-seen` but false here (it has never started).

**Static generation confirmed restored** after the client-read switch: `53/53` static pages, all public routes `○`/`●`, 20 fresh prerendered HTML files; `/admin`, `/api`, `/booking/manage` remain `ƒ`. The build did not disturb the Owner's dev server (`/about` → 200 immediately after, and again after commit).

**Self-gates at `5259ae6`:** tsc 0 · consent suites 51/51 (19 registry + 21 state + 11 new) · full suite **5 failed / 1878 passed (1883)**, identity-exact · eslint 59E/7W in the same six files.

---

# ▶▶ INTERRUPT CHECKPOINT — 2026-08-04 — READ THIS FIRST ON RESUME

**Position: C-18 Phase B complete and committed; NOT independently verified. Nothing is mid-flight.**

| Field | Value |
|---|---|
| Plan | **C-18** (cookie consent), plan #18 of 22 |
| Phase / step | **Phase B (Steps 3–4) done.** Phase C (Steps 5–7) not started |
| Last-good commit | **`5259ae6`** (code) · this checkpoint commit follows it |
| Files mid-flight | **NONE** — working tree clean in C-18 scope; only `src/lib/maintenance.ts` (standing Owner change, never stage) |
| Programme | **17 of 22 shipped.** C-18 is #18; then C-19 → C-20 → C-23 → C-14 → C-10 |

### EXACT NEXT ACTION
**Dispatch a FULL-tier independent verifier for Phase B** (`6dd05e5` + `5259ae6`), `model: sonnet`, writing to `redesign/evidence/C-18/phase-b-verify-full.md`. It has not been verified by anyone but its own implementer. Lead it on:
1. **The equivalence claim** — does the emitted `CONSENT_SCRIPT` genuinely agree with `readConsent()` on all 31 corpus entries, and is the corpus itself non-vacuous? This is the second-source-of-truth risk.
2. **Consent Mode ordering** — default-denied established before any Google code could run, verified against streamed HTML.
3. **`clearGaCookies`'s domain matrix** — would it actually delete a cookie set on `.rahmatherapy.uk`? A miss here makes "withdraw consent" silently ineffective.
4. **Static generation** — public routes still `○`/`●`; no `cookies()`/`headers()`/`draftMode()` reachable from the `(public)` subtree.
5. **The sixth registry entry's description is true at this commit** (nothing writes the cookie yet).

**Then Phase C (Steps 5–7)** — banner, preferences panel, interaction wiring. `model: opus` recommended (dark-pattern parity, focus management, and the withdrawal sequence). Tier FULL.

### Phase C must honour, all Owner-decided (§3)
- **The `functional` toggle must ACTUALLY gate `rahma-booking-contact-v1`'s write** at `src/features/booking/BookingExperience.tsx` (~:494) — **files-touched extension approved**. A toggle that does not gate would be a control that lies.
- **Parity by construction** — Accept-all and Reject-all rendered from the SAME styled component, label the only difference (brief §2.3 dark-pattern guard).
- **Toggles off by default**, rendered from the registry's non-essential purposes (now `functional` + `analytics`).
- **Z-order (C18-F4):** the booking flow is a Base UI modal at z-index 9998/9999. The banner sits BELOW it and is unreachable while the dialog is open — accepted posture. Gate #8's "primary actions unobstructed" check must be run WITH the dialog open, and the banner must never overlay the dialog's action row.
- **Withdrawal path:** update-denied → `clearGaCookies()` → log `withdrawn` → `location.reload()`. **Also stop Sentry Replay** — and note `Replay.stop()` force-flushes in session mode (no discard-without-sending API); see §2.
- **The moment the banner first calls `writeConsent()`, registry item 6's copy stops being true** — flip it in the same commit.

### Phase D owes six copy flips, each requiring a real gate + a test that the gate exists
The consolidated **PHASE D OBLIGATION** comment in `src/lib/consent/cookie-registry.ts` is the authority. A string-matching pin was tried and **removed** (`a5b5d9c`) for proving nothing about the world outside its own file — **do not reinstate one.** Phase D also gates **Sentry Replay**, which is NOT in the plan's Step 8 (Owner decision 1).

### ⛔ Still ahead in C-18
**Phase E Step 9 — the `consent_events` migration.** Zone-2, orchestrator-only, per-action Owner approval, exact SQL shown verbatim in chat first. `SELECT to_regclass('public.consent_events')` → **null** confirmed at pre-flight. §1.3's backup precondition was discharged once at C-06 and does not re-fire.

### INHERITED BASELINE — BY IDENTITY (use this, not any number inside the plan)
- tsc **0 errors** · build clean, **53/53 static pages**, public routes static.
- vitest → failures are exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3. **Judge by identity, never by count** — recorded counts have drifted repeatedly while identities stayed exact. Totals at `5259ae6`: 5 failed / 1878 passed (1883).
- eslint → **59 errors / 7 warnings** in exactly `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`. 93% sit in an untracked directory, so this baseline is not reproducible from a fresh clone.

### Standing facts a fresh agent must not relearn the hard way
- **`src/lib/maintenance.ts` is deliberately dirty** (`MAINTENANCE_MODE = false`, Owner-authorised, never staged/committed/reverted, excluded from isolation checks). It must return to `true` before any deploy.
- **The dev server is Owner-run** on `localhost:3000` (never `127.0.0.1`); agents must never spawn or kill it. It was warm at checkpoint time.
- **The deploy is deferred to end-of-programme** by recorded Owner decision — nothing in C-17/C-18 has reached production.
- **Owner-side actions outstanding** are in `OWNER-ACTION-BACKLOG.md`, including the **Sentry ingest-scrubbing rule** (the only thing that stops new booking-token captures before the deploy) and the C-17 GA env var + live verification.

## 4 — ▶ Position

**Superseded by the INTERRUPT CHECKPOINT above — read that first.** Phase 0 ✅ verified · Phase A ✅ verified (five fix rounds) · Phase B implemented at `5259ae6`, **awaiting independent verification** · Phases C–G not started.

**⛔ Still ahead:** the `consent_events` migration at Phase E Step 9 — orchestrator-only, exact SQL shown verbatim in chat, per-action Owner approval. §1.3's backup precondition was discharged once at C-06 and does not re-fire.

**⏳ Owner actions outstanding:** start `pnpm dev` for the inventory browser pass; Sentry-console mitigations (§2).
