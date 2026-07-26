# C-17 — Google Analytics (GA4) on customer-facing pages

**Type:** Band C plan-writing brief (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Predecessors:**
- User direction 2026-07-16: set up Google Analytics on the customer-facing pages; the GA4 tag exists (`G-WM8BCYG060`). **Consent decision (user, 2026-07-16): NO consent setup in C-17** — the user will run Google's own consent-setup process; a consent/cookie-banner change is planned as the NEXT amendment. C-17 must not block or pre-empt it.
- Code audit 2026-07-16: no analytics of any kind in `src/`; no CSP headers exist (nothing blocks googletagmanager.com); customer surfaces = the `(public)` route group (marketing pages + the embedded booking flow via `(public)/layout.tsx`) **plus** `/booking/manage` (outside the group, root-layout only); the booking success screen is `PreparedStep.tsx` ("Booking request submitted"), mounted by `BookingExperience.tsx`. **Update 2026-07-26 (C17-F2):** `PreparedStep.tsx` was deleted by merge `ea97932`; the success screen is now `SuccessScreen.tsx` (`"use client"`, heading id `success-heading`, same "Booking request submitted" text), rendered by `BookingExperience.tsx` when `currentStep === "success"` (~L683-691).
**Amended:** 2026-07-16 (same day) — **C-18 (cookie consent & PECR compliance) is now written** and consumes this brief's consent insertion point: the `GoogleAnalytics` component becomes C-18's consent-gated loader (basic Consent Mode v2 — gtag not injected until analytics consent). **Co-ship C-17 + C-18 recommended**; if C-17 is implemented first standalone, implement it directly in the gated form per C-18 plan Step 8 (skip the plain-GA intermediate).
**Companion files:**
- Plan: `redesign/plans/C-phase/C-17-google-analytics-plan.md`
- Progress: `redesign/per-page-progress/C-17-google-analytics-progress.md` (filled during C-C)

---

## 0 — TL;DR

Smallest plan of the band. Two phases:

1. **Phase A — the tag:** a `GoogleAnalytics` component built on Next's `Script` (`afterInteractive` — zero impact on page paint), measurement ID from `NEXT_PUBLIC_GA_MEASUREMENT_ID`, **renders nothing unless the env var is set AND `NODE_ENV === "production"`** (dev work + Playwright sweeps never pollute real analytics). Mounted in `(public)/layout.tsx` + a thin new `src/app/booking/layout.tsx`. **Admin pages are never tracked.**
2. **Phase B — the conversion event:** `booking_request_submitted` fired once when the customer reaches the booking success screen — GA measures the business's actual conversion, not just traffic.

**No new package** (avoids a Zone-2 dependency approval — plain `next/script` is sufficient). **Zero migrations.** **Fully independent** — ships at any point, first even; only deployment-env coordination needed (one Cloudflare env var).

---

## 1 — Why this plan exists

The clinic has zero visibility into site traffic, page performance, or booking conversion. The user has created the GA4 property; the reference tag:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-WM8BCYG060"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-WM8BCYG060');
</script>
```

Pasting this verbatim into a Next.js App Router layout is the naive path; C-17 translates it to the idiomatic equivalent (`next/script`, `afterInteractive`) with environment gating and scope control.

---

## 2 — Scope

### 2.1 `GoogleAnalytics` component (Phase A)

New `src/components/GoogleAnalytics.tsx` (server component — no client boundary needed):

```tsx
import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function GoogleAnalytics() {
  if (!GA_ID || process.env.NODE_ENV !== "production") return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
```

- `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-WM8BCYG060` set in the Cloudflare production environment (+ documented in `.env.example`, which exists at the repo root — verified 2026-07-26, C17-F7). Unset locally → component renders nothing → dev/CI/Playwright traffic never reaches GA.
- **Consent forward-compatibility (locked 2026-07-16):** the init script is written so the upcoming consent change can prepend a `gtag('consent', 'default', …)` block without restructuring — a one-line comment marks the insertion point. Nothing else consent-related ships in C-17.

### 2.2 Mount points (Phase A)

| Layout | Covers | Action |
|---|---|---|
| `src/app/(public)/layout.tsx` | home, about, services, reviews, FAQs, areas + the embedded booking flow | render `<GoogleAnalytics />` |
| `src/app/booking/layout.tsx` | `/booking/manage` (customer manage-booking page) | **NEW thin layout** — passthrough children + `<GoogleAnalytics />` |
| `src/app/admin/*` | staff surfaces | **never** — no mount, and the verification gate asserts the script is absent from admin HTML |

Root layout untouched (mounting there would leak tracking into `/admin`).

### 2.3 Page-view tracking on client-side navigation

GA4's enhanced measurement ("Page changes based on browser history events", on by default) captures App Router client navigations. C-17 relies on it rather than wiring a manual route listener; the verification gate proves both a hard load AND a client-side navigation register as page_views in GA Realtime. If enhanced measurement proves unreliable at verification time, the documented fallback is a small `usePathname`-driven `page_view` effect — implemented only if the gate fails.

### 2.4 `booking_request_submitted` conversion event (Phase B)

Fired exactly once when the customer lands on the success screen. Wire at the `PreparedStep` mount (or the step-transition in `BookingExperience.tsx` — implementer picks the cleaner single-fire point). **Re-anchor 2026-07-26 (C17-F2):** `PreparedStep.tsx` was deleted by merge `ea97932` — wire at the `SuccessScreen.tsx` mount instead (already `"use client"`; ref-guard for dev StrictMode double-mount) or at the `setCurrentStep("success")` transition in `BookingExperience.tsx` (~L683-691):

```ts
// fire-and-forget; tolerate gtag absence (env-gated tag, ad-blockers)
useEffect(() => {
  (window as { gtag?: (...args: unknown[]) => void }).gtag?.(
    "event", "booking_request_submitted"
  );
}, []);
```

- **No PII in the payload** — event name only. No client name, email, service, or price leaves the browser.
- Marking it as a key event / conversion inside the GA4 property is the user's dashboard-side step (documented in the plan's hand-off, not code).
- The customer manage-page cancel flow gets NO event (out of scope; can join the consent change later if wanted).

---

## 3 — RBAC / privacy posture

- Admin surfaces untracked by construction (§2.2) — staff activity is not marketing data.
- No PII in any payload (§2.4). IP handling is GA4-default (Google discards IPs in EU/UK processing); nothing custom.
- **Consent:** deliberately out of scope per user decision 2026-07-16 — the next planned change covers Google's consent setup (Consent Mode + banner). C-17 leaves a marked insertion point and takes no position.

---

## 4 — States & edge cases

- **4.1 Ad-blockers:** gtag never loads; `gtag?.()` optional-chaining means zero errors; booking flow unaffected. Accepted measurement loss (industry-standard).
- **4.2 Env var unset in production** (misconfig): component renders nothing — site works, analytics silently off; verification gate catches it at ship time.
- **4.3 Double-fire risk on the success screen** (re-render / back-nav): effect runs on mount only; back-navigation into the flow resets state such that re-reaching the success screen (`SuccessScreen`, formerly `PreparedStep` — C17-F2) implies a new submission — acceptable; verification checks a normal flow fires exactly one event.
- **4.4 Maintenance mode** (master's maintenance feature): maintenance page is public-layout-scoped? — verified at impl; tracking the maintenance splash is harmless either way. **Answered 2026-07-26 (C17-F6):** yes — `MaintenanceBanner` (L22) and `MaintenanceModal` (L29) render inside `(public)/layout.tsx`, with `BookingExperienceLoader` gated off (L28); the splash gets page_views, and no conversion events are possible during maintenance. Harmless — no work item.
- **4.5 Existing production traffic pre-C-17:** none is captured; GA history simply starts at deploy. No backfill exists or is possible.

---

## 5 — Migration footprint

**None.** One environment variable in Cloudflare (set by the user or with the user at the keyboard — it's public-prefixed, not a secret, but production env changes are announced in the session before applying).

---

## 6 — Files touched

### NEW (3)
- `src/components/GoogleAnalytics.tsx`
- `src/app/booking/layout.tsx` (thin passthrough + mount)
- `src/components/__tests__/GoogleAnalytics.test.tsx` (env gating: unset → null; non-production → null)

### EDITED (2–3)
- `src/app/(public)/layout.tsx` — mount
- `src/features/booking/components/SuccessScreen.tsx` (or `BookingExperience.tsx`) — Phase B event *(was `PreparedStep.tsx`, deleted by merge `ea97932` — C17-F2)*
- (`.env.example` — exists at repo root, verified 2026-07-26 (C17-F7); document the var)

### UNCHANGED
- Root layout, admin tree, middleware, all RECON §5 untouchables.

---

## 7 — Sequencing and dependencies

- **Independent of all 16 other plans** (like C-14) — ships anytime.
- **Branch note (2026-07-16):** `(public)/layout.tsx` differs by ~9 lines between master and the frontend line (`redesign/start-state`); implementing on master risks only a trivial conflict at the next routine frontend merge. Confirm the target branch with the user at impl time (master is the deploy trunk; the mount is a one-line addition either way). **Resolved 2026-07-26 (C17-F3):** merge `ea97932` landed the frontend line into `master` — `master` is the single source of truth; no branch decision or merge-conflict risk remains.
- **Successor (WRITTEN 2026-07-16):** C-18 — cookie consent & PECR compliance (`redesign/briefs/C-18-cookie-consent-brief.md`). Hard pairing: co-ship recommended; C-18 Phase D rewrites this plan's component into the consent-gated loader. Deploying C-17 alone collects without consent — a recorded user-accepted interim gap, superseded by C-18's availability.
- Bundle: gtag.js loads `afterInteractive` from Google's CDN (not part of the app bundle); the component itself is ~0.3 kB. Ceiling: +1 kB on public bundles. *(Verification note 2026-07-26, C17-F5: no public-route bundle script exists — `scripts/measure-admin-bundles.mjs` is admin-only. Check the ceiling via the `pnpm build` route-size table for `/` and `/booking/manage`, before vs after.)*

---

## 8 — Open questions

**Q8.1 — Event fire point: `PreparedStep` mount vs `BookingExperience` step transition?** Implementer picks whichever guarantees single-fire most simply; the test asserts single-fire either way. *(2026-07-26: `PreparedStep` is now `SuccessScreen` — C17-F2; the question itself is unchanged.)*

**Q8.2 — Track the maintenance splash?** Impl-time verify of its layout scope; harmless either way; no work item. **Answered 2026-07-26 (C17-F6):** the splash IS public-layout-scoped, so it is tracked; harmless — still no work item.

---

## 9 — Acceptance criteria (what "done" looks like)

1. Production HTML of every `(public)` page + `/booking/manage` contains the gtag script; **admin pages' HTML does not** (curl assertion).
2. Dev-server HTML contains NO gtag script (env gating proven).
3. GA Realtime shows a page_view for a hard load AND for a client-side navigation between public pages.
4. Completing a test booking on production shows exactly one `booking_request_submitted` event in GA Realtime/DebugView; no PII in the payload (network-tab inspection).
5. Booking flow works identically with an ad-blocker active (gtag absent).
6. Static gates pass; +1 kB ceiling respected; zero migrations; no new packages.
7. Consent insertion point present as a marked comment; nothing consent-related shipped.

---

## 10 — Out of scope (explicit non-goals)

- **Cookie consent / Consent Mode / banner** — the user's declared next change; C-17 only leaves the insertion point.
- Admin-side analytics of any kind.
- Additional events (manage-page cancellations, scroll depth, outbound clicks) — GA4 enhanced measurement defaults only + the one conversion event.
- Google Tag Manager (the full GTM container) — plain gtag.js is sufficient and lighter; GTM only if a future need demands it.
- Server-side tagging, UTM strategy, GA property/dashboard configuration (user-side, in the GA UI).

---

*End of C-17 brief. Plan file follows: `redesign/plans/C-phase/C-17-google-analytics-plan.md`.*
