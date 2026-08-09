# C-10 — Bottom-spacing / footer overlap fix — PROGRESS

**Plan:** `redesign/plans/C-phase/C-10-bottom-spacing-footer-overlap-plan.md`
**Brief:** `redesign/briefs/C-10-bottom-spacing-footer-overlap-brief.md`
**Programme:** Band C, C-C implementation — §4 order position 22, **LAST**, and correctly so.
**Predecessor HEAD at plan start:** `0bc2a02`.
**Migrations:** none. **Packages:** none. **Commits:** 1 code + evidence/bookkeeping.
**Catalogue:** `redesign/evidence/C-10/c-10-overlap-catalogue.md`

---

## 0 — Pre-flight (2026-08-09)

| # | Check | Result |
|---|---|---|
| 1 | branch `master`; `ea97932` ancestor | ✅ `master`, `merge-base --is-ancestor` exit 0 |
| 1 | tree clean over the plan's paths | ✅ except the standing `src/lib/maintenance.ts` |
| 2 | dev server | ✅ up, Owner-run (`/` → 308 `/home/` → 200; the plan's literal `/admin/login/` → 200 is stale in form, not substance) |
| 3 | baseline gates | ✅ **by identity** — the plan's "485/491, 6 failures incl. `createBookingTransaction`" is a frozen 2026-05 snapshot and is **SUPERSEDED** |
| 4 | **C-16 merged (HARD dependency)** | ✅ `4a9bef9`, `e822e12`, `2f376f9` — pagination landed, so the geometry measured here is final |
| 4 | **C-14 complete before measuring** | ✅ all four phases + follow-ups shipped first, deliberately — see §3 |
| 5 | locate `AdminPageScaffold` | ✅ `src/app/admin/components/admin-ui.tsx:113` |
| 6 | surfaces NOT using it | 7 of 31 admin pages — all measured anyway; scaffold use turned out to be irrelevant to the outcome (see §2) |

**Why C-10 ran last, and why that mattered.** C-10 measures *final* page heights. C-14's remaining phases changed the admin availability pages, so cataloguing earlier would have recorded geometry C-14 then invalidated — exactly the failure C-10's own pre-flight #4 warns about for C-16. `/admin/availability` and `/admin/staff/[id]/availability` were both measured **after** C-14's last commit.

---

## 1 — Phase A: discovery — `redesign/evidence/C-10/c-10-overlap-catalogue.md`

**25 surfaces walked live at 375px** on the Owner's authenticated session (Minhaj rahman · Owner / Main Admin), plus 768 and 1280 spot-checks. **Tier: FULL** — the deliverable is a measurement, and a measurement nobody validated is worth nothing.

### 1.1 — The plan's measurement snippet was run, found unreliable **in both directions**, and replaced

This is the single most important thing in this plan's record, because every other number depends on it.

- **Two of its three nav selectors do not match this site.** It looks for `nav[aria-label*="mobile" i]`, `[data-mobile-nav]`, or `nav.fixed.bottom-0`. The real element is `nav.admin-bottom-tabbar`, whose aria-label is **"Admin navigation"**, with no `data-mobile-nav`. Only the third alternative matches — the sweep survived on luck.
- **Its "last content element" heuristic UNDER-reports.** It takes the last element in **DOM order**, not the visually lowest. On `/admin/dashboard` that is an SVG `path`, reporting a comfortable 129px.
- **The obvious stricter heuristic OVER-reports.** Taking the maximum `bottom` over elements filtered only on `display`/`visibility`/height gives `/admin/dashboard` a **−26px OVERLAP**. A screenshot shows no overlap at all. The culprit is the collapsed "Health check" disclosure — laid out and measurable, but clipped and never painted.

**Replacement instrument:** walk text nodes in `<main>`, take each `Range`'s rect, and keep only text confirmed genuinely painted by `document.elementsFromPoint(...)` hit-testing its own parent. Measured after scrolling to the true document bottom.

**Validated in both directions before a single surface was catalogued** — the step that makes the rest trustworthy:
- *Not blind:* a synthetic probe injected behind the bar produced **−31 / OVERLAP**; removing it restored **126 / ok**. Probe removed, absence confirmed in the same call, nothing persisted.
- *Not over-eager:* it agrees with the screenshot on the known-good page.

### 1.2 — Result: 24 of 25 clean; the plan's predicted "high suspect" was clean; the real defect was elsewhere

Full per-surface table in the catalogue. Headlines:

- **`/admin/bookings/new` — the plan's named high suspect — PASSED.** Its save bar is `sticky bottom-0 z-20`, which reads wrong. Tested across five scroll positions, its rect moves **1:1 with scroll** (bottom 1024 → 937 → 850 → 763 → 676 against scroll deltas of exactly 87px), proving `sticky` never engages: its containing block gives it no room. At rest it sits **79px clear**, and its "Continue" control hit-tests as reachable throughout. Only a transient 8px graze mid-scroll. *The CSS looks wrong; the behaviour is right.* Recorded as a cosmetic inconsistency, not a defect — three sibling forms use `bottom: 56px`.
- **`/admin/audit` — the one genuine failure**, at **1px** of room against the plan's ≥20px standard, confirmed by screenshot with the last line flush against the bar's border.
- **Three dynamic routes could not be measured live, and are recorded as such rather than as passes:** `/admin/email-templates/preview/[id]` is a **route handler** returning raw email HTML for an iframe (no admin chrome, so no bottom nav — N/A, not untested); `/admin/bookings/series/[templateId]` has **0 rows** in `recurring_booking_templates`, so no instance exists to walk, and creating one is a production write not justified by a spacing check.
- **At 768 and 1280** the bar is `display:none` (`md:hidden`) and padding switches to 32px (`md:pb-8`), so this defect class exists **only below 768px**.

### 1.3 — Root cause: one shared number, not 25 page-level mistakes

`AdminTopNav.tsx:346` padded `<main>` with `pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]` = **56px**. The tab bar at `:648` renders **57px** — its inner height plus a **1px `border-t`**. The padding was therefore 1px *less* than the bar it exists to clear, and the guaranteed breathing room was **~0px, by construction**.

Every other surface passed **incidentally**, on whatever margin its last card happened to contribute — which is why the measured rooms scattered from 26px to 222px with no floor. `/admin/audit` is simply the surface whose content ends flush against the padding box, so it exposed the shared shortfall. **The plan anticipated 5–15 per-surface CSS fixes; the correct fix was one line.**

---

## 2 — Phase B: remediation — `51942b0`, `sonnet`

`src/app/admin/components/AdminTopNav.tsx:346` only:

```
- pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]        // 56px → ~0px floor
+ pb-[calc(3.5rem+1.5rem+env(safe-area-inset-bottom,0px))]  // 80px → 23px floor
```

**⚠️ Rule-6(b) deviation, Owner-approved in chat 2026-08-09.** C-10's plan lists the **mobile nav component as UNCHANGED**, and this line lives in that file. The Owner was given the alternative — patch `/admin/audit` alone, staying inside the plan's anticipated per-surface shape — and chose the shared fix, because the per-surface patch leaves the ~0px floor in place for every future page. `md:pb-8`, the tab-bar markup, and the `height: 2.75rem` rule at `:254` were **not** touched.

### 2.1 — Verified live, and the *shape* of the result is the evidence

| Surface | Before | After | Δ |
|---|---|---|---|
| **`/admin/audit`** | **1** | **25** ✅ | +24 |
| `/admin/dashboard` | 126 | 150 | +24 |
| `/admin/bookings` | 32 | 56 | +24 |
| `/admin/availability` | 34 | 58 | +24 |
| `/admin/settings` | 26 | 26 | **0 — expected** |

A uniform **+24** on every in-flow surface and exactly **0** on the one fixed-positioned case. `/admin/settings`'s lowest text sits inside a `position: fixed` save bar pinned at `bottom: 56px`; a fixed element is positioned against the viewport, not against `main`'s padding box, so container padding cannot and should not move it — it is already offset by exactly the bar's height. **Had settings also shifted, the fix would have been moving things it had no business moving.** Screenshot: `audit-375-bottom-AFTER.png`.

---

## 3 — What the sweep found that C-10 was not looking for

### 🔴 `/admin/me` was completely broken — and no gate in the programme had caught it

The page rendered only *"Application error: a client-side exception has occurred."*

```
Uncaught TypeError: NOTIFICATION_ALERT_TYPES.map is not a function
```

`src/app/admin/me/actions.ts` is a **`"use server"`** module, which may only export async functions. It also exported the const array `NOTIFICATION_ALERT_TYPES`, and the client component `NotificationSettingsCard.tsx` imported it across the boundary, where it arrives as a server-reference stub.

**Pre-existing, not this session:** `git log b5c8c81..HEAD -- src/app/admin/me/` is empty. Introduced by **C-08 Phase D Step 17** (`302f90e`), last touched by C-09 (`457e3ff`). C-08 shipped ✅ with this page dead.

**Why nothing caught it:** `tsc` resolves the import fine, the types are correct, and unit tests never mount the page. It is only visible if someone *loads it* — which is precisely what a Playwright/browser catalogue sweep does, and what no other gate in this programme did for this route.

**Fixed under its own Owner decision — `78cf0f3`.** The constant moved to a plain `src/app/admin/me/alert-types.ts`; `as const` tuple typing preserved so both the `Record<(typeof …)[number], string>` derivation and the `for…of` iteration still work. An audit of the same file for the same defect class found only `export interface SaveNotificationSettingsState`, which is erased at compile time and therefore safe. A new test asserts the module carries no `"use server"` directive and renders the card without throwing.

**Verified live by the orchestrator** (the implementer could not — no browser/auth work): `/admin/me` renders, `<main>` present, alert-type controls present, **zero console errors**.

**It also removed a real risk to the single end-of-programme build**, since Next treats a non-async export from a `"use server"` module as a build-time error.

---

## 4 — Gates (by identity)

- `npx tsc --noEmit` → **0**.
- `npx vitest run` → failures exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 by name. **5 failed / 2214 passed / 2219** after Phase B (+3 specs from the `/admin/me` fix).
- `pnpm lint` → **59 errors / 7 warnings** in exactly `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`.
- **Disclosed flakiness, investigated not waved away:** under full-suite load, 1–2 extra `ManualBookingForm.test.tsx > optional email` sub-tests intermittently time out at 5000ms. Run in isolation the file reproduces exactly its 3 baseline failures every time, and it has **zero import relationship** to anything changed here. Pre-existing timing contention, not a regression.

## 5 — Deferred / not done

- **F2** (`/admin/bookings/new`'s `sticky bottom-0` vs siblings' `bottom: 56px`) — behaviour verified correct; class left alone rather than churn a file for cosmetics.
- **Two dynamic routes not live-measurable** (§1.2) — recorded as such, never as passes.
- The plan's §4.4 per-fail screenshot convention is satisfied: before/after for the one failure, plus the dashboard capture that disproved the false positive.
