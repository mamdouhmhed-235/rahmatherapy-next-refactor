# Admin backend — responsive & visual audit

**Captured** 2026-09-01 · **commit** `fdeb273` (master, clean tree) · **production build**
**Database** untouched — `verify-baseline.mjs` returned `BASELINE EXACT` before and after.

⛔ **This document reports and explains. It contains no fix plan and no code was changed.**

---

## 1. The answer in one table

| | |
|---|---|
| Cells captured | **640 / 640 usable** (32 pages × 4 roles × 5 widths), 0 void |
| Measured defect rows | **89,568** |
| Draft findings | 74 |
| **Confirmed after adversarial verification** | **59** (50 clean, 9 with corrected scope) |
| Rejected by verification | 15 (14 not-a-defect, 1 duplicate) |
| **Pages affected** | **32 of 32** |
| **Worst width** | **768px** |

---

## 2. Worst width: 768px, and it is not close

Every finding kind was counted per width across all 32 pages.

| Width | Total defect rows | Pages with content **cut off and unreachable** | Pages with a control **proven painted over** |
|---|---|---|---|
| 320 | 21,024 | 10 / 32 | 32 / 32 |
| 375 | 19,937 | 5 / 32 | 32 / 32 |
| 414 | 19,703 | 4 / 32 | 32 / 32 |
| **768** | **26,768** | **32 / 32** | **32 / 32** |
| 1280 | 2,136 | 0 / 32 | 5 / 32 |

768px is the worst on both counts and is the only width where **every single page** loses
content off the right edge with no way to reach it.

⚠️ The two halves of the reported symptom peak at different widths:
- **"Spilling over the screen"** is worst at **768px** (5,490 off-right-edge rows vs 1,614 at 320).
- **"Menus and panels hiding behind"** is worst at **320–414px** (3,835 painted-over controls at 375).

---

## 3. ⛔ Why the usual overflow number reads zero here

`overflow-x: hidden` is declared **three times** on ancestors of every admin page:

| Where | Line |
|---|---|
| `src/app/globals.css` | 38–42 — `html, body { … overflow-x: hidden }` |
| `src/styles/site-parity.css` | 32 — `body { … overflow-x: hidden }` |
| `src/app/admin/components/AdminTopNav.tsx` | 204 — `div.admin-shell.min-h-screen.overflow-x-hidden` |

**Consequence:** `documentElement.scrollWidth` can never exceed `clientWidth`, so the standard
horizontal-overflow check reads **0 on all 640 cells** — including pages that overflow by 180px.

**Proven, not assumed.** A 900px `<div>` injected into a 320px viewport:

| measurement | value |
|---|---|
| `documentElement.scrollWidth` / `clientWidth` | 375 / 375 |
| `body.scrollWidth` / `body.clientWidth` | **900** / 375 |

⚠️ **And this makes the damage worse, not cosmetic.** Because the value is `hidden` and not `auto`,
content past the right edge **cannot be scrolled to**. It is not off-screen — it is gone. 250 of the
off-right-edge rows carry `NO scrollable ancestor — unreachable`.

---

## 4. The three biggest recurring causes

### Cause 1 — `overflow-x: hidden`, declared three times, turns every spill into deleted content
**Spans:** 8 of 8 areas · every page · every width.
This is what converts a horizontal overflow from "swipe to see it" into "it no longer exists".
It is also why the headline overflow number is unusable (§3).

### Cause 2 — the `md:` breakpoint is exactly 768px, and the header needs ~940px there
**Spans:** 8 of 8 areas · 8 separate finding IDs for one component (`AdminTopNav.tsx`).

At exactly 768px two things happen in the same instant:
- the desktop nav rail switches **ON** (`hidden md:block`, `AdminTopNav.tsx:314/320/323`), and
- the mobile bottom tab bar switches **OFF** (`md:hidden`, `AdminTopNav.tsx:648`).

The header then needs 938–941px in a 768px viewport, so the right-hand rail is pushed past the edge —
where Cause 1 makes it unreachable. Measured on `/admin/dashboard`, owner:

| Width | Bottom tab bar rendered | Elements >50px past right edge | Worst |
|---|---|---|---|
| 414 | **1** (present) | 2 | 215px |
| **768** | **0** (gone) | **19** | 178px |
| 1280 | 0 | **0** | — |

⛔ **At 768px there is no route to notifications, search, the account menu or sign-out.** The mobile
bar has been switched off and the desktop rail cannot be reached. Confirmed for owner, admin and
coordinator; `therapist_a` has a shorter rail and is genuinely clean here
(`counts.outOfBounds = 0` at 768 on all 32 pages).

### Cause 3 — a fixed bottom tab bar painting over content with no reserved scroll band
**Spans:** 8 of 8 areas · **12,980** `covered-by-fixed-or-sticky` rows plus 994
`painted-over-while-scrolled` rows.

`nav.admin-bottom-tabbar` (`AdminTopNav.tsx:648`) is `position: fixed; bottom: 0; z-index: 40`, 57px
tall. Pages pad their **last** element (`pb-24`, `pb-44`) but nothing protects whatever happens to
land in the bottom 57px band at the current scroll offset.

⚠️ Its worst form: **two different** mobile action bars are both `position: fixed; bottom: 0;
z-index: 40`, so equal stacking lets DOM order decide and the nav always wins — the page's own primary
button is drawn underneath and **can never be tapped at any scroll position**
(`dashboard/MobileStickyActionBar.tsx:27` and `components/PerformanceSurface.tsx:548`, identical
geometry: 390×44 = 17,160px² at 414).

⛔ Occlusion here is **measured, not inferred** — `document.elementFromPoint()` was called at each
control's centre and returned a different element. z-index was never used to conclude anything.

---

## 5. Two further shared causes worth naming

- **Grid containers without `minmax(0, 1fr)`** adopt their widest row's max-content width as a hard
  floor, so one long unbreakable string (an email address, a tab strip) sets the width of every
  sibling. On `/admin/clients` at 320 the implicit track resolves to **531.8px inside a 288px box**,
  pushing all 14 row menus fully off-screen. Spans 6 findings across 3 areas.
- **`shrink-0` chips inside an `overflow-x-auto` strip with no scroll affordance** — 9 places. The row
  becomes a hidden side-scroller with no fade, arrow or partial-chip peek to say so. The booking tabs
  hide 313.95px; the calendar week strip 357px.

---

## 6. Security check (not a layout check)

`inactive` and `non_staff` were pointed at `/admin`, `/admin/dashboard`, `/admin/bookings` and
`/admin/settings` at 375 and 1280.

| Role | Result |
|---|---|
| `inactive` | **Refused** — redirected to `/admin/login/?reason=inactive`, 0 booking rows rendered |
| `non_staff` | **Refused** — redirected to `/admin/login/`, 0 booking rows rendered |
| `owner` (control) | **Admitted** — reached each page, 8 booking rows on `/admin/bookings` |

⛔ The control matters: without it, a refusal is indistinguishable from a broken page (GOTCHAS G2).

---

## 7. ⚠️ Honest limits of this audit

**Things that went wrong during capture and how they were handled**

1. **A first capture pass produced 640 files of which 498 were void.** The server died partway and
   every later cell recorded `status: null`. All were discarded. The harness now aborts after three
   consecutive dead cells.
2. **An unrelated project (`opencode-go/learning_program_site`) seized port 3001** when the server
   died and began answering requests. All 640 cells were swept: every one carries a Rahma page title,
   so nothing foreign entered the dataset. An application-identity guard was added.
3. **14 coordinator cells hit an expired session** and measured the sign-in screen while reporting
   HTTP 200 with a Rahma title. Found by a route-integrity check the harness did not originally have.
   **All 14 were re-captured**; they added 2,025 defect rows, including the 179.92px header overflow
   at 768 that confirms Cause 2 for the coordinator role. Zero contaminated cells remain
   (`_route-integrity.json`).

**Coverage gaps that remain**

- **`therapist_a` is "Test Therapist", who has zero assigned bookings.** Their list screens render
  empty states. An empty list cannot overflow, so the absence of findings for `therapist_a` on list
  pages is **not** evidence the layout is sound for a therapist with real work.
- **`/admin/bookings/series/[templateId]` was never audited with content** —
  `recurring_booking_templates` has 0 rows, so it renders its not-found state.
- **`/admin/password-reset/[token]`** renders its invalid-token state; no live token exists and
  minting one would be a write.
- **The sign-in screen's own layout was not audited for the four signed-in roles** — requesting
  `/admin/login` while signed in correctly bounces to the dashboard (20 cells).
- **`/admin/staff/[staffId]/performance` was not audited for `therapist_a`** — it redirects to
  `/admin/me` (an access refusal, correct behaviour, 5 cells).
- **`occlusionSweepTotal = 0` on all cells of `services`, `account-password-requests` and
  `password-reset`** (60 cells). Treat that as unmeasured, not as clean.
- **A dark/light discrepancy is unresolved.** The capture requested `prefers-color-scheme: light` but
  the screenshots render the dark admin theme (the app's own stored `theme_preference` wins). No
  finding in this audit depends on colour.

**Verification defects found in the analysts' own output** (recorded, not silently fixed)

- `SR-01` and `SSP-02` list `therapist_a` as affected by the 768px header overflow. That role has
  `counts.outOfBounds = 0` at 768 on all 32 pages — the claim is wrong and carries no number.
- `SR-10`, `SR-02`, `SHELL-04`, `BOOK-01` and `CLIENTS-02` each let a **screenshot** carry a fact,
  which the brief forbids. Most consequentially `CLIENTS-02`, whose alarming conclusion — that the one
  fully readable item in the half-off-screen row menu is "Delete client" — is read off a PNG with no
  per-item rectangle quoted. **Treat that specific claim as unproven.**
- The single largest value in the whole digest (703.66px of bottom clip on
  `div#business-overview-panel`, 657 rows) is a **false positive** — a collapsed accordion
  (`aria-expanded="false"`, clipper height 0), confirmed from `dom.html`.

---

## 8. Where the evidence is

| Path | What it holds |
|---|---|
| `raw/<role>/<page>/<width>/` | `screenshot.png`, `dom.html`, `measure.json` — 640 cells |
| `raw/<role>/<page>/<width>/menu-*.png` / `.html` | menus and panels captured open (widths ≤ 768) |
| `raw/_security/` | the refusal check for `inactive` / `non_staff`, plus the `owner` control |
| `digest/offenders.tsv` | **one row per measured defect** — 89,568 rows, tab separated |
| `digest/by-page/<page>.tsv` | the same, split per page |
| `digest/cell-index.json` | every cell: role, width, page, status, final URL, h1, counts |
| `findings/<area>.md` | the eight area reports |
| `CAPTURE-NOTES.md` | how the capture was made and what was proven about it |
| `_route-integrity.json` | the route-mismatch check for all 640 cells |
| `capture.mjs`, `build-digest.mjs`, `check-route-integrity.mjs` | the harness, re-runnable |
