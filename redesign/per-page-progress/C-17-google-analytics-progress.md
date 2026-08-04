# C-17 — Google Analytics (GA4) — PROGRESS

**Plan:** `redesign/plans/C-phase/C-17-google-analytics-plan.md`
**Brief:** `redesign/briefs/C-17-google-analytics-brief.md`
**Programme:** Band C, C-C implementation — plan **#17 of 22** (§4 order). **Co-ships with C-18**, which follows immediately.
**Predecessor:** C-16, final commit `d22ab37` (closeout `099903a`).
**Migration:** none. **Two ⛔ Zone-2 items outstanding by design** — see §4.

---

## 0 — Pre-flight (2026-08-04, at `099903a`)

All checks clean and matching the plan's 2026-07-26 re-anchoring:
- Branch `master`; `git merge-base --is-ancestor ea97932 HEAD` → exit 0. The C17-F3 branch decision is moot (merge `ea97932` landed the frontend line into master).
- `git status --porcelain` over every C-17 path → **empty**.
- `grep -rn "next/script\|gtag" src/` → **empty** (no prior analytics anywhere).
- `src/app/booking/` contained only `manage` — no `layout.tsx`, so C-17 was the plan creating it (collision map §5).
- Success anchor confirmed live: `success-heading` at `SuccessScreen.tsx:40`; `currentStep === "success"` at `BookingExperience.tsx:684`. **The plan's original `PreparedStep.tsx` anchor is dead** (deleted by merge `ea97932`) and its `TrackBookingSubmitted.tsx` contingency is moot — `SuccessScreen` is already `"use client"`.
- Maintenance-mode note (C17-F6) re-confirmed: `MaintenanceBanner`/`MaintenanceModal` render inside `(public)/layout.tsx` and `BookingExperienceLoader` is gated OFF during maintenance, so GA tracks the splash and no conversion can fire. Expected, harmless, no work item.

**Verification tiers (§2.9c):** Phase A **FULL**, Phase B **FULL** — both touch the live public site; the env gate must be exact or GA leaks into dev or admin, and Phase B sits on the customer booking success path.
**Model routing (§5):** all dispatches `sonnet` — env-gated script mount and a fire-once effect, both routine against an explicit spec. All verifiers `sonnet`.

---

## 1 — Phases

| Phase | Commit | Tier | Result |
|---|---|---|---|
| A — tag + mounts + env doc | `05f251e` | FULL | **FAIL** (credential leak) → fixed `d5425ec` → **PASS** |
| B — conversion event | `e545f38` | FULL | **PASS** |
| Closeout review + gates | — | — | **PASS** |

**Phase A** shipped `src/components/GoogleAnalytics.tsx`, gated `if (!GA_ID || process.env.NODE_ENV !== "production") return null;`. A verifier confirmed by build inspection — not inference — that with the var absent at build time the branch is **fully dead-code-eliminated**: zero traces in served HTML *and* zero in compiled `.next/static` chunks.

**Phase B** wired a fire-once `useEffect` in `SuccessScreen`, ref-guarded, calling `window.gtag?.("event", "booking_request_submitted")` — optional-chained, **no payload** (brief §2.4: no PII).

---

## 2 — ⚠️ The Phase A FAIL: a credential leak the plan itself specified

**The plan told us to mount GA on `/booking/**`, and doing so would have sent live booking credentials to Google.**

`/booking/manage` receives the customer's booking-management **bearer token in the query string** (`manage/page.tsx:18,46` — `searchParams: { token?: string }`); that token authorises viewing, rescheduling and cancelling a real booking. GA4 collects `page_location` — the full URL including the query — on every page_view. The project already classifies the value as sensitive: **`sentry-scrubbing.ts:4` redacts `manage.*token` and a bare `token` before anything reaches Sentry**. So the mount would have handed Google a credential the codebase deliberately withholds from its own error tracker.

**C-18's consent gate would NOT have fixed it** — a customer who accepts cookies leaks the token anyway.

Neither the plan, the brief, nor the implementation caught it; it was found by the Phase A FULL verifier asking, specifically, whether a tokenised route was safe to mount analytics on.

**⛔ Raised to the Owner as a plan-vs-reality contradiction** (the plan lists `booking/layout.tsx` as a NEW file whose purpose is the mount, and its §3 gate asserts gtag is *present* there). Three options were put: drop the mount; sanitise `page_location`; or move the token out of the URL entirely.

**Owner decision, chat 2026-08-04: drop the GA mount from the booking route.**

Implemented at `d5425ec`: `src/app/booking/layout.tsx` **deleted** (it existed only for the mount; App Router routing keys off `page.tsx`, verified — `/booking/manage` still routes and renders). **No placeholder left behind** — per the collision map, if C-18 needs a layout there it creates one.

**Plan deviations this creates, both Owner-approved:**
- §2's NEW-files list loses `src/app/booking/layout.tsx`.
- **§3 gate item 2 is INVERTED for that route**: gtag must be **ABSENT** from `/booking/manage`, not present. Anyone re-reading the plan will find text that contradicts the shipped state — this record is the reconciliation.

**Durable guard:** `src/app/booking/__tests__/no-google-analytics.test.ts` recursively scans `src/app/booking/**` and fails if any file references `GoogleAnalytics`, with a failure message naming the reason. Proven non-vacuous by dropping a probe file and watching it fail. **Disclosed limit:** it is a string match — a renamed barrel re-export, or a raw inline `<Script>` pointed at googletagmanager.com, would evade it.

**Sweep for a second instance: none found.** `grep -rn "searchParams" "src/app/(public)/"` returns zero — no public route reads query params at all. The only URL state written anywhere public is `booking=1` plus `services=<packageId>`, enum-validated. Re-derived independently by the closeout reviewer.

---

## 3 — Phase B: fire-once, chased down properly

The reviewer's brief flagged that a `useRef` guard is **per component instance**, so any genuine remount of `SuccessScreen` inside `MotionStep`/`AnimatePresence` would create a fresh ref and fire a **second conversion event for one real booking** — inflating the single metric this plan exists to produce. Every vector was chased and closed with evidence:

- `AnimatePresence mode="wait"` only transitions between *different* keys; `SuccessScreen` sits under a hardcoded, stable `"success"` key (`BookingExperience.tsx:684-692`).
- `MotionStep`'s `useReducedMotion()` branch swaps `div` for `motion.div` — a genuine remount hazard — **but framer-motion's own source** (`use-reduced-motion.mjs:32-45`) shows a `useState` lazy initialiser **with no listener**, so it cannot change after mount.
- No route change, Suspense boundary or resize listener anywhere in `src/features/booking/**`.
- Dialog close/reopen: all 23 `data-booking-trigger` sites reopen through one handler (`useBookingUrlState.ts:69-72`) that resets `currentStep` away from `"success"` in the same batched update.
- `currentStep` is not persisted (`partialize` keeps only `selectedPackageIds`), the URL uses `replaceState` (no history entry), and `BOOKING_STEPS` excludes `"success"` — so no reload, deep link or back-nav reaches a new mount without a new submission.

**Non-blocking coverage gap, recorded:** no test exercises a *genuine* remount — only StrictMode's same-instance double-invoke, which is a different mechanism. The guarantee currently rests on the render-tree analysis above rather than on a test.

---

## 4 — ⛔ Outstanding Zone-2 items (deferred by design, NOT failures)

1. **Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in the Cloudflare PRODUCTION environment.** `NEXT_PUBLIC_*` is inlined at **build** time, so it must be present in the *build* environment — a dashboard-only runtime setting is not enough. `.env.example` documents the name; no value is committed anywhere.
2. **Production deploy + live GA Realtime verification** (plan §3 item 3): page_view on hard load; page_view on a client-side nav between two public pages (the enhanced-measurement check — if absent, implement the brief §2.3 fallback and re-verify); and **exactly one** `booking_request_submitted` after a test booking on a `*.example.test` fixture, then clean the fixture up. Needs the Owner's GA Realtime access; **no offline substitute exists**.
3. **⏸ Owner confirmation still open** (pre-flight #6): that `G-WM8BCYG060` is the intended production property and that Realtime access is available on verification day.

All three ride with the deferred end-of-programme deploy. Also outstanding: the **ad-blocker pass** (plan §3 item 4 — booking flow completes with gtag blocked, zero console errors), which needs a browser.

---

## 5 — Closeout gate (2026-08-04, at `d5425ec`)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx vitest run` | **5 failed / 1820 passed (1825)** — identity exact (`admin-access` ×2, `ManualBookingForm` ×3) |
| `npx eslint .` | **59E / 7W**, same six files (verified via JSON formatter, not visual scan) |
| `pnpm build` | clean, **52 routes**; `/booking/manage` still routes |
| Scope assertion (production build + curl) | gtag **present** `/`, `/services`; **absent** `/booking/manage?token=…`, `/admin/login`; absent from all dev URLs |
| Bundle ceiling (+1 kB) | **NOT RUN** — the literal before/after route-size diff needs a checkout of `099903a`, forbidden for a read-only reviewer, and no stored baseline exists. **Supplementary, clearly labelled:** gzipped First Load JS was byte-for-byte identical with the GA env on vs off across `/`, `/home`, `/services`, `/booking/manage` — consistent with the ceiling, not proof of it. Tenth-plus occurrence of this tooling gap programme-wide. |
| Adversarial full-range review | **PASS**, no findings |

---

## 6 — ▶ Position

**✅ C-17 SHIPPED 2026-08-04**, final commit `d5425ec`. Working tree clean within C-17's scope; the only modification in `src/` is the standing deliberate `src/lib/maintenance.ts`.

**Commits:** `05f251e` Phase A · `e545f38` Phase B · `d5425ec` leak fix.

**➡️ Inherited baseline for C-18 — BY IDENTITY:** tsc 0 · build clean, 52 routes · vitest failures exactly `admin-access` ×2 + `ManualBookingForm` ×3 · eslint 59E/7W in the same six files. No expected shrinkage outstanding.

**➡️ Two C-18 premises are now settled differently from its plan text:**
1. **`src/components/GoogleAnalytics.tsx` EXISTS.** C-18's note (C18-F3) assumed C-17 was unimplemented and that C-18 would create it in gated form. It does not — **C-18 EDITS it** into a consent-gated loader, and the `// C-18 consent insertion point` comment is already in place at `GoogleAnalytics.tsx:17`, positioned so `gtag('consent','default',…)` executes **before** `gtag('js')`. Verified twice.
2. **`src/app/booking/layout.tsx` does NOT exist** — created by C-17, then deleted under the Owner's leak decision, with no placeholder. C-18's files-touched list says to mount `ConsentScripts` + `CookieBanner` there. **That is now a live question, not a copy-paste:** with no analytics loading on `/booking/**` at all, there is nothing on that route to gate, and mounting a banner would put a cookie prompt in front of a customer who followed an email link to cancel an appointment. **To be raised with the Owner at C-18's plan start.**
