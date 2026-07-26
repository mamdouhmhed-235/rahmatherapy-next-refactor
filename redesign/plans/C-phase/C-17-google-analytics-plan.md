# C-17 — Google Analytics (GA4) on customer-facing pages — **PLAN**

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: none hard (independent — ships anytime). Soft pairing: C-18 co-ship; check whether C-18 already landed with `git log --oneline --grep="feat(redesign): C-18"` — if it hits, `GoogleAnalytics.tsx` and `src/app/booking/layout.tsx` already exist in consent-gated form: EXTEND them, do not recreate (see the coordination note at Step 2).
> Decisions: C-B-DECISIONS.md has no C-17 sections (post-handoff addition); Owner-approved D15 (evidence dir) and D16 (C-18 consent-bootstrap placement) apply. Findings applied: see refinement changelog.

**Type:** Band C plan-writing output (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Amended:** 2026-07-16 (same day) — C-18 (cookie consent) is written and pairs with this plan. **Co-ship recommended:** implement the `GoogleAnalytics` component directly in C-18's consent-gated form (C-18 plan Step 8) rather than the plain form below, then the rest of this plan applies unchanged.
**Brief:** `redesign/briefs/C-17-google-analytics-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-17-google-analytics-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. **Branch decision with the user** (brief §7): master (deploy trunk, recommended) vs the frontend line. `(public)/layout.tsx` divergence is ~9 lines — trivial either way, but confirm.
   **Resolved 2026-07-26 (C17-F3):** merge `ea97932` landed the frontend line into `master` — no branch decision remains. Work on `master`; HEAD at or descended from `ea97932`; verify with `git branch --show-current` + `git merge-base --is-ancestor ea97932 HEAD`.
2. Dev server → 200; baseline tests + static gates green.
   **Baseline caveat (2026-07-26, C17-F4):** "green" means baseline-preserving, not zero: vitest 485/491 (6 pre-existing failures in 3 files — ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1); `pnpm lint` has a 59-error baseline (55 untracked `design_handoff_area_pages/prototype` JSX + 4 pre-existing in `src/features/booking/`) — gate is no NEW errors vs that baseline. `npx tsc --noEmit` and `pnpm build` are clean. Working tree: no modifications under this plan's touched paths — `git status --porcelain -- src/components/ src/app/booking/ "src/app/(public)/layout.tsx" src/features/booking/ .env.example` returns empty. The wider tree is intentionally dirty (untracked photo/design folders, deleted .playwright-mcp logs) — NEVER stage broadly, NEVER stash/restore/checkout to "clean" it.
3. **Layout shape re-verify** (line numbers are 2026-07-16 vintage):
   ```bash
   grep -n "children" "src/app/(public)/layout.tsx" | head -3
   ls src/app/booking/   # expect: manage only — no layout.tsx yet
   grep -rn "next/script\|gtag" src/ | grep -v node_modules   # expect: empty
   ```
4. **Success-screen anchor:** `grep -n "success-heading\|SuccessScreen" src/features/booking/components/SuccessScreen.tsx src/features/booking/BookingExperience.tsx` — confirm the single mount path for the Phase B event.
   **Path-swap 2026-07-26 (C17-F1):** `PreparedStep.tsx` was deleted by merge `ea97932`. The terminal success state is now `SuccessScreen.tsx` (`"use client"` at L1; heading id `success-heading`, text "Booking request submitted"), rendered by `BookingExperience.tsx` when `currentStep === "success"` (~L683-691 — re-grep `currentStep === "success"` for the current position).
5. **Maintenance-mode layout scope** (brief §4.4): check whether the maintenance splash renders inside `(public)/layout.tsx`; note the answer, no work either way.
   **Answer (verified 2026-07-26, C17-F6):** yes — `MaintenanceBanner` (L22) and `MaintenanceModal` (L29) render inside `(public)/layout.tsx`; `BookingExperienceLoader` is gated OFF during maintenance (L28). An unconditional GA mount tracks the splash; with no booking dialog, no conversion events fire in maintenance. Harmless per brief — no work item.
6. **GA property sanity:** user confirms `G-WM8BCYG060` is the intended production property and has Realtime access for verification day.
7. **DO-NOT-TOUCH:** admin tree, root layout, RECON §5 untouchables; no real bookings during Phase B verification except the standard `.example.test` fixtures.

   ```
   DO-NOT-TOUCH (live data): booking 9d55ce2a (Badar — real customer email); Owner account rahmatherapy@outlook.com in email-test paths; any client whose email isn't *.example.test or name isn't Phase10*/Audit Test* test patterns.
   ```

---

## 1 — Safe implementation order (2 phases, 5 steps)

### Phase A — Tag + mounts

**Step 1 — `src/components/GoogleAnalytics.tsx`.** Exactly per brief §2.1 (env-gated, production-only, `afterInteractive`, consent insertion-point comment above the `gtag('js', …)` line). Unit test: renders `null` when env unset; renders `null` when `NODE_ENV !== "production"`; renders two Scripts when both conditions hold (mock env).

**Step 2 — Mounts.**
- `(public)/layout.tsx`: render `<GoogleAnalytics />` inside the existing layout return (position: end of body content — Script placement is hoisted by Next regardless).
- NEW `src/app/booking/layout.tsx`:
  ```tsx
  import { GoogleAnalytics } from "@/components/GoogleAnalytics";

  export default function BookingLayout({ children }: { children: React.ReactNode }) {
    return (
      <>
        {children}
        <GoogleAnalytics />
      </>
    );
  }
  ```
- Assert nothing admin-side imports the component. *(Executability, 2026-07-26: `grep -rn "GoogleAnalytics" src/app/admin/` — expect empty.)*

> **Coordination note (collision map §5, 2026-07-26):** "`booking/layout.tsx` does not exist yet and is created by either C-17 or C-18, whichever lands first (per C-18's own pre-flight #3 fallback). The other plan must EXTEND the existing file, not recreate it. `ConsentScripts` must land in the SAME session/window as any GA mount — never ship an unconditional (non-gated) analytics loader without the consent gate already in place." Per Decision D16, C-18's consent bootstrap is an inline `<script>` in `(public)/layout.tsx` + this booking layout — not `next/script beforeInteractive` in nested layouts.

**Step 3 — Environment variable.**
- Add `NEXT_PUBLIC_GA_MEASUREMENT_ID` to `.env.example` (present at the repo root — verified 2026-07-26, C17-F7) with a comment; NOT to any committed `.env`.

> ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
> An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
> Action: set `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-WM8BCYG060` in the Cloudflare project's PRODUCTION environment (build-time env — see the bullet below).
> Exact SQL / change: no SQL — one env-var addition, value and placement per the Production bullet immediately below.
> Post-action verification: next production build's `/` HTML contains `googletagmanager.com/gtag/js?id=G-WM8BCYG060`; absent from `/admin/login` HTML (gate item 2).
> Never auto-apply. Approval is per-action and does not carry forward.

- Production: set `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-WM8BCYG060` in the Cloudflare project env **with the user** (announced before applying; it's a public identifier, not a secret, but production env changes follow the confirm-first norm). Note: `NEXT_PUBLIC_*` vars are inlined at BUILD time — the var must be present in the build environment, not only the runtime env; verify how the OpenNext/Cloudflare pipeline injects it (build step env) before relying on a dashboard-only setting.

**Phase A verify checkpoint:** lint/tsc/tests/build green; dev HTML has no gtag (curl localhost); a production build with the env var set locally (`NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST pnpm build` + start) shows the script in `(public)` + `/booking/manage` HTML and NOT in `/admin/login` HTML.
*Executability (2026-07-26):* "green" = baseline-preserving per pre-flight #2. The inline-env form is POSIX-only — on this Windows host run it in Git Bash, or in PowerShell use `$env:NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST"; pnpm build`. Curl the dev server at `localhost`, not `127.0.0.1` (Next 16 dev behavior).

### Phase B — Conversion event

**Step 4 — `booking_request_submitted`.** Wire the fire-once effect at the Q8.1-chosen point (PreparedStep mount preferred — it IS the success state). Optional-chained `window.gtag?.()`, no payload beyond the event name (brief §2.4 — no PII). If PreparedStep is a server component today, add the smallest client leaf (`TrackBookingSubmitted.tsx`, returns null) rather than converting the step.

> **Re-anchor (2026-07-26, C17-F2 — `PreparedStep.tsx` deleted by merge `ea97932`):** the success state is now `src/features/booking/components/SuccessScreen.tsx`, already `"use client"` (L1), mounted once inside `MotionStep`/`AnimatePresence` at `BookingExperience.tsx` `currentStep === "success"` (~L683-691). The server-component contingency (`TrackBookingSubmitted.tsx` leaf) is moot. Wire the fire-once effect in `SuccessScreen` (ref-guarded for dev StrictMode double-mount) or at the `setCurrentStep("success")` transition — the Q8.1 choice is unchanged, only the anchors are. Verify: `grep -n "success-heading" src/features/booking/components/SuccessScreen.tsx` hits, and the Step 5 test passes.

**Step 5 — Test.** Component/unit test: mounting the success state calls `window.gtag` once with `("event", "booking_request_submitted")` when gtag exists; no throw when absent; StrictMode double-mount still nets one logical event (guard with a ref if needed).

**Phase B verify checkpoint:** full public booking flow on a production build — exactly one event observed (mock gtag in dev-build check; real GA DebugView on deploy).

---

## 2 — Files touched (final list)

### NEW (3)
| File | Purpose |
|---|---|
| `src/components/GoogleAnalytics.tsx` | Env-gated GA4 tag (next/script) |
| `src/app/booking/layout.tsx` | Thin layout mounting the tag for `/booking/manage` |
| `src/components/__tests__/GoogleAnalytics.test.tsx` | Gating tests (+ Step 5 event test colocated with the flow) |

### EDITED (2–3)
| File | Change |
|---|---|
| `src/app/(public)/layout.tsx` | + `<GoogleAnalytics />` mount |
| `src/features/booking/components/SuccessScreen.tsx` (or `BookingExperience.tsx` success transition) — *was `PreparedStep.tsx`, deleted by merge `ea97932` (C17-F2); the `TrackBookingSubmitted.tsx` leaf contingency is moot (`SuccessScreen` is already `"use client"`)* | Phase B fire-once event |
| `.env.example` (present at repo root — verified 2026-07-26, C17-F7) | Document the var |

### UNCHANGED (do NOT touch)
- Root `layout.tsx`, `src/app/admin/**`, middleware, build configs, RECON §5 untouchables.

---

## 3 — Verification gate

1. **Static gates:** lint, tsc, vitest (3+ new specs), build, bundle script (**+1 kB ceiling** on public bundles; gtag.js itself is external, not bundled).
   **Baseline phrasing (2026-07-26, C17-F4):** lint = no NEW errors vs the 59-error baseline; vitest = the 6 pre-existing failures in 3 files remain the only failures; tsc/build clean.
   **Bundle check (2026-07-26, C17-F5):** no public-route bundle script exists — `scripts/measure-admin-bundles.mjs` hardcodes an admin-only ROUTES list and `package.json` has no `bundle` entry. Verify the ceiling manually instead: compare the `pnpm build` route-size table (first-load JS) for `/` and `/booking/manage` before vs after — delta ≤ +1 kB (the component is ~0.3 kB; gtag.js never enters the bundle). Do not extend the admin script in this plan.
2. **Scope assertion (curl, production build):** gtag script present in `/`, `/services`, `/booking/manage` HTML; ABSENT from `/admin/login` HTML; absent from all dev-server HTML.

> ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
> An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
> Action: production deploy carrying the C-17 changes, followed by the live GA Realtime verification session (requires the user's GA Realtime access — no offline fallback exists; schedule with the user, per pre-flight #6).
> Exact SQL / change: no SQL — deploy of the Phase A/B commits with the Step 3 env var present in the build environment.
> Post-action verification: gate items 3(a)–(c) below + the item-2 curl assertions re-run against production.
> Never auto-apply. Approval is per-action and does not carry forward.

3. **Live verification (post-deploy, with the user):** GA Realtime shows (a) page_view on hard load, (b) page_view on a client-side nav between two public pages (enhanced-measurement check — if missing, implement the brief §2.3 fallback and re-verify), (c) exactly one `booking_request_submitted` after a test booking (`.example.test` fixture), then cancel/clean the test booking per existing conventions.
4. **Ad-blocker pass:** booking flow completes with gtag blocked; zero console errors.
5. **Screenshot/evidence:** GA Realtime captures for (a)–(c) + the curl outputs, stored in `redesign/evidence/C-17/` *(changed 2026-07-26 per Decision D15 / C17-F8 — `redesign/audits/**` is read-only historical record; never write there)*.

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| `NEXT_PUBLIC_*` inlining vs Cloudflare env pipeline mismatch → tag silently absent in prod | medium | low | Step 3 explicitly verifies build-time injection; gate item 2 catches absence before sign-off. |
| Enhanced measurement misses App Router navigations | low | low | Gate item 3b; documented `usePathname` fallback, implemented only on failure. |
| StrictMode/dev double-fire of the conversion event | medium | low | Fire-once ref guard + Step 5 test. |
| Tag leaks into admin HTML via a future shared layout refactor | low | low | Gate asserts absence; C-11's admin-layout work doesn't touch public layouts (documented independence). |
| Frontend-line merge conflict on `(public)/layout.tsx` | medium | trivial | One-line mount; resolve at the next routine merge. **VOID 2026-07-26 (C17-F3):** merge `ea97932` landed the frontend line into `master`; this risk row no longer applies. |
| Consent change (next amendment) restructures the init | expected | low | Insertion-point comment + brief §2.1 forward-compatibility note make it additive. |

---

## 5 — Undo procedure

Pure git revert (2 commits) + delete the Cloudflare env var (announced). No data, no migrations. GA property retains whatever it collected; deleting the var stops collection immediately on next deploy.

---

## 6 — Test fixture guidance

Phase B live verification uses one `.example.test` booking through the public flow, cancelled/cleaned afterwards per existing conventions. Badar's `9d55ce2a` and real client data untouched. No GA events are triggerable against real customers by this plan's tests (the event fires only for the person driving the browser).

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Coverage |
|---|---|
| 1 | Phase A — component + mounts + env documentation + gating tests |
| 2 | Phase B — conversion event + test |
| 3 | Verification — evidence + progress file + master plan checklist → ✅ |

`feat(redesign): C-17 {phase}` prefixes. No migration commits. The Cloudflare env var is set alongside commit 1's deploy (announced, user-confirmed).

---

## 8 — Hand-off to C-C

1. Read brief + plan; run pre-flight (esp. #1 branch decision + #6 GA access). *(#1 is resolved as of 2026-07-26 — `master` @ `ea97932` is the single trunk, no branch decision remains; C17-F3.)*
2. Phase A → verify → Phase B → verify; live GA checks need the user's GA Realtime access.
3. No migrations; one production env var (confirm-first).
4. Final commit flips the master-plan C-17 row → ✅.
5. **Successor reminder (updated 2026-07-16):** C-18 (cookie consent & PECR compliance) is written — co-ship it; do not deploy plain GA alone without surfacing the consent gap to the user first.

---

*End of C-17 plan. Brief: `redesign/briefs/C-17-google-analytics-brief.md`. Progress: `redesign/per-page-progress/C-17-google-analytics-progress.md` (filled during C-C).*
