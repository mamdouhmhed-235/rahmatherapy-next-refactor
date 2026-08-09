# C-10 Bottom-spacing overlap catalogue

**Date:** 2026-08-09
**Auditor:** C-C orchestrator, driving the Owner's authenticated admin session (Minhaj rahman · Owner / Main Admin · `01582c5d-bd75-4c49-b207-6f5597e15218`)
**Viewports walked:** 375 (full sweep) + 768 and 1280 (spot-checks)
**HEAD at sweep:** `5e79506`

## Summary

- **Surfaces walked: 25** measured live at 375px, plus 3 accounted for and not measurable (below).
- **Surfaces with insufficient breathing room: 1** — `/admin/audit`.
- **Surfaces with sticky-save-bar issues: 0 functional**, 1 cosmetic inconsistency (`/admin/bookings/new`).
- **Unrelated blocking defect found: 1** — `/admin/me` throws a client-side exception and renders nothing. Out of C-10's scope; escalated separately.
- NEW routes verified: `/admin/clients/[clientId]/edit` (C-06) ✅ clean.

---

## 0 — Instrument: how these numbers were obtained, and why the plan's snippet was not used verbatim

The plan's Phase A snippet was **run and found unreliable in both directions**. It is recorded here because a catalogue is only worth its measurement.

**a. Two of its three nav selectors do not match this site.** It looks for `nav[aria-label*="mobile" i]`, `[data-mobile-nav]`, or `nav.fixed.bottom-0`. The real element is `nav.admin-bottom-tabbar` (`AdminTopNav.tsx:648`) whose aria-label is **"Admin navigation"**, with no `data-mobile-nav`. Only the third selector matches. Had the markup differed slightly, every surface would have reported a meaningless `no-mobile-nav`.

**b. Its "last content element" heuristic under-reports.** It takes `visible[visible.length - 1]` — the last element in **DOM order**, not the visually lowest. On `/admin/dashboard` that is an SVG `path` at y=626, reporting a comfortable 129px of room.

**c. A naive "lowest visible element" heuristic over-reports.** Filtering only on `display`/`visibility`/height and taking the maximum `bottom` gives `/admin/dashboard` a **−26px OVERLAP**. A screenshot (`dashboard-375-bottom.png`) shows no overlap whatever: the last card ends ~100px clear. The culprit is the collapsed "Health check" disclosure — laid out and measurable, but clipped and never painted.

**The instrument actually used** walks text nodes inside `<main>`, takes each `Range`'s rect, and keeps only text that is genuinely painted, confirmed by `document.elementsFromPoint(...)` hit-testing its own parent. Room = `navTop − lowestPaintedTextBottom`, measured after scrolling to the true document bottom.

**It was validated in both directions before use:**
- Against ground truth: `/admin/dashboard` → lowest painted text "Check pending bookings" at y=630, room **126**, `ok` — matching the screenshot.
- Against blindness: a synthetic `SYNTHETIC OVERLAP PROBE` element injected behind the bar produced room **−31 / OVERLAP**; removing it restored **126 / ok**. The probe was removed and its absence confirmed in the same call. Nothing was persisted.

Threshold is the plan's: **≥ 20px = ok**.

---

## 1 — Per-surface results (375px)

| # | Surface | Room (px) | Verdict | Notes |
|---|---|---|---|---|
| 1 | `/admin/dashboard` | 126 | ✅ ok | Audit #01 re-confirmed |
| 2 | `/admin/bookings` | 32 | ✅ ok | |
| 3 | `/admin/bookings/new` | 222 | ✅ ok | Sticky bar `bottom-0` — cosmetic only, see F2 |
| 4 | `/admin/bookings/[bookingId]` | 130 | ✅ ok | |
| 5 | `/admin/clients` | 125 | ✅ ok | |
| 6 | `/admin/clients/new` | 156 | ✅ ok | Sticky save bar `bottom: 56px` — correct pattern |
| 7 | `/admin/clients/[clientId]` | 56 | ✅ ok | |
| 8 | `/admin/clients/[clientId]/edit` | 156 | ✅ ok | **C-06 NEW route** — clean from the start; sticky `bottom: 56px` |
| 9 | `/admin/enquiries` | 129 | ✅ ok | |
| 10 | `/admin/calendar` | 157 | ✅ ok | |
| 11 | `/admin/staff` | 84 | ✅ ok | |
| 12 | `/admin/staff/[id]` | 153 | ✅ ok | |
| 13 | `/admin/staff/[id]/availability` | 118 | ✅ ok | C-14 Phase B surface, measured post-change |
| 14 | `/admin/staff/[id]/performance` | 124 | ✅ ok | |
| 15 | `/admin/availability` | 34 | ✅ ok | C-14 Phase A/C surface, measured post-change |
| 16 | `/admin/services` | 74 | ✅ ok | |
| 17 | `/admin/settings` | 26 | ✅ ok | Sticky save bar `fixed`, `bottom: 56px` — correct pattern |
| 18 | `/admin/operations` | 68 | ✅ ok | |
| 19 | `/admin/emails` | 148 | ✅ ok | |
| 20 | `/admin/roles` | 131 | ✅ ok | |
| 21 | `/admin/roles/[id]` | 131 | ✅ ok | |
| 22 | `/admin/privacy` | 110 | ✅ ok | |
| 23 | `/admin/account-password-requests` | 214 | ✅ ok | |
| 24 | **`/admin/audit`** | **1** | **⚠️ FAIL** | Lowest painted text "End of audit log." at y=754, nav top y=755. See F1 |
| 25 | `/admin/reports` | 78 | ✅ ok | |
| 26 | **`/admin/me`** | — | **🔴 BROKEN** | Client-side exception; page renders no `<main>`. See F3 |

### Not measurable, and why

- **`/admin/email-templates/preview/[id]`** — not an admin page. It is a **route handler** (`preview/[id]/route.ts`) returning raw email HTML for an iframe; it carries no admin chrome and therefore no bottom nav. N/A rather than untested.
- **`/admin/bookings/series/[templateId]`** (C-02 NEW) — `recurring_booking_templates` holds **0 rows**, so no instance of this route exists to walk. Not live-measurable today. Creating one is a production write and was not done for a spacing check.

### Viewport spot-checks

At **768** and **1280**, `nav.admin-bottom-tabbar` is `display: none` (`md:hidden`) and `main`'s bottom padding switches to `32px` (`md:pb-8`). No fixed bottom nav can cover content at or above the `md` breakpoint, so the overlap class of defect exists **only below 768px**. Verified on `/admin/audit`.

---

## 2 — Findings

### F1 — ⚠️ The shared admin container guarantees ~0px of breathing room, not ≥20px

**Surface where it shows: `/admin/audit`** (screenshot: `audit-375-bottom-1px.png` — "End of audit log." sits flush against the nav's top border, no gap).

**Root cause, and it is one shared number.** `AdminTopNav.tsx:346` pads `<main>` with `pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]` = **56px**. The tab bar at `AdminTopNav.tsx:648` renders **57px** tall — `2.75rem`/`3.5rem` of inner height plus its **1px `border-t`**. The padding is therefore 1px *less* than the bar it is meant to clear, and by design leaves **zero** breathing room.

Every other surface passes **incidentally**, on whatever margin its last card happens to contribute — which is why the measured rooms scatter from 26px to 222px with no floor. `/admin/audit` is the surface whose last element sits flush against the padding box, so it exposes the shared shortfall.

**Fix (Phase B, plan Pattern 3):** raise the shared mobile padding so it clears the bar *and* the standard, e.g. `pb-[calc(3.5rem+1.25rem+env(safe-area-inset-bottom,0px))]` (76px → ≥20px floor everywhere). `md:pb-8` is unchanged, so desktop is unaffected. One line, one shared file, fixes the floor for all 25 surfaces rather than patching `/admin/audit` alone.

### F2 — Cosmetic: `/admin/bookings/new`'s save bar uses a different sticky convention

Its bar is `sticky bottom-0 z-20`; `/admin/clients/new`, `/admin/clients/[id]/edit` and `/admin/settings` all use `bottom: 56px`. The plan predicted this would be an overlap ("high suspect").

**Tested, and it is not.** Across five scroll positions the bar's rect moves **1:1 with scroll** (bottom 1024 → 937 → 850 → 763 → 676 against scroll deltas of exactly 87px), proving `sticky` never engages here — its containing block gives it no room to stick. At rest (fully scrolled) it sits **79px clear** of the nav. The only contact is a transient **8px** graze at ~75% scroll, and hit-testing shows the "Continue" control itself reachable throughout.

**Recommendation: leave the behaviour, align the class for consistency** if Phase B touches the file anyway. Recorded as a style inconsistency, not a defect — the CSS reads wrong, the behaviour is right.

### F3 — 🔴 `/admin/me` is broken (OUT OF C-10 SCOPE, pre-existing, escalated)

The page renders only *"Application error: a client-side exception has occurred."*

```
Uncaught TypeError: NOTIFICATION_ALERT_TYPES.map is not a function
```

`src/app/admin/me/actions.ts` is a **`"use server"`** module. Such a module may only export async functions. It exports the const array `NOTIFICATION_ALERT_TYPES` (`actions.ts:13`), and the client component `NotificationSettingsCard.tsx:8` imports it across the server/client boundary, where it arrives as a server-reference stub rather than an array — so `.map` does not exist and the render throws.

**Not caused by this session:** `git log b5c8c81..HEAD -- src/app/admin/me/` is empty. Introduced by **C-08 Phase D Step 17** (`302f90e`), last touched by C-09 (`457e3ff`).

**Why it matters beyond C-10:** Next treats a non-async export from a `"use server"` module as a **build-time error**, so this is a live candidate to fail the single end-of-programme `pnpm build`. Raised with the Owner rather than fixed here — no plan owns this file.

---

## 3 — Remediation list

1. `src/app/admin/components/AdminTopNav.tsx:346` — raise the mobile `main` bottom padding so the ≥20px floor holds for every admin surface (F1). Fixes `/admin/audit`; removes the incidental-pass fragility everywhere else.

*(F2 optional/cosmetic. F3 is not C-10 work.)*

---

## 4 — Phase B remediation: DONE and verified live — `51942b0`

**Owner approved editing `AdminTopNav.tsx` despite C-10's plan listing the mobile nav component as UNCHANGED**, on the basis that the shared floor is the actual defect and a per-surface patch would leave it in place.

**One line.** `AdminTopNav.tsx:346`:

```
- pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]      // 56px, vs a 57px bar → ~0px floor
+ pb-[calc(3.5rem+1.5rem+env(safe-area-inset-bottom,0px))] // 80px → 23px floor
```

`md:pb-8` (desktop), the tab-bar markup, and the `.admin-bottom-tabbar > div { height: 2.75rem }` rule at `:254` are all untouched. The `env(safe-area-inset-bottom,0px)` term is preserved — it is there for notched devices.

### Re-measured live at 375px with the same validated instrument

| Surface | Before | After | Δ |
|---|---|---|---|
| **`/admin/audit`** (the failing surface) | **1** | **25** ✅ | +24 |
| `/admin/dashboard` | 126 | 150 | +24 |
| `/admin/bookings` | 32 | 56 | +24 |
| `/admin/availability` | 34 | 58 | +24 |
| `/admin/settings` | 26 | 26 | 0 — **expected** |

`main`'s computed `padding-bottom` is **80px** on every one. Screenshot: `audit-375-bottom-AFTER.png`.

**Why `/admin/settings` is unchanged, and why that is correct rather than a failed fix:** its lowest painted text ("Save settings") lives inside a **`position: fixed`** save bar pinned at `bottom: 56px`. A fixed element is positioned against the viewport, not against `main`'s padding box, so container padding cannot move it — and it does not need to, because it is already deliberately offset by exactly the tab bar's height. Its 26px was never at risk. Had this surface *also* shifted by +24, that would have indicated the fix was moving things it should not.

The uniform +24 across every in-flow surface, and exactly 0 on the one fixed-positioned case, is the signature of a change that did precisely what was intended and nothing else.

**F1 closed.** F2 left as recorded (cosmetic, behaviour verified correct). F3 was not C-10 work and was fixed separately under its own Owner decision — see §2 F3 and commit `78cf0f3`; `/admin/me` now renders, confirmed live with zero console errors.

## 4 — Verified clean

`/admin/dashboard` · `/admin/bookings` · `/admin/bookings/new` · `/admin/bookings/[bookingId]` · `/admin/clients` · `/admin/clients/new` · `/admin/clients/[clientId]` · `/admin/clients/[clientId]/edit` · `/admin/enquiries` · `/admin/calendar` · `/admin/staff` · `/admin/staff/[id]` · `/admin/staff/[id]/availability` · `/admin/staff/[id]/performance` · `/admin/availability` · `/admin/services` · `/admin/settings` · `/admin/operations` · `/admin/emails` · `/admin/roles` · `/admin/roles/[id]` · `/admin/privacy` · `/admin/account-password-requests` · `/admin/reports`
