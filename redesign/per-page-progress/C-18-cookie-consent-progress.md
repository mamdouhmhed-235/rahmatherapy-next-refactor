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

**Scope this adds beyond the plan's text, all recorded so the diff stays auditable:** a third registry purpose category · a second gated loader in Phase D (GA is a script mount; Replay is an SDK integration that must start late without breaking error capture) · a wider Phase C withdrawal path (Replay stop as well as GA cookie clearing) · `sentry.client.config.ts` + `SentryProvider.tsx` in files-touched.

---

## 4 — ▶ Position

**Phase 0 complete and verified.** Next: **Phase A** (registry + `/cookies` notice page), drafted from the source inventory, with the browser confirmation pass folded in before closeout.

**⛔ Still ahead:** the `consent_events` migration at Phase E Step 9 — orchestrator-only, exact SQL shown verbatim in chat, per-action Owner approval. §1.3's backup precondition was discharged once at C-06 and does not re-fire.

**⏳ Owner actions outstanding:** start `pnpm dev` for the inventory browser pass; Sentry-console mitigations (§2).
