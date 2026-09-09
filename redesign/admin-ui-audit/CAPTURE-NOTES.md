# Capture notes — admin responsive & visual audit

**Captured:** 2026-09-01 · **Commit:** `fdeb273` (master, clean tree)
**Build:** `corepack pnpm build`, served by `next start` (the `rahma-prod-audit` entry
in `.claude/launch.json`) on `http://localhost:3001`.
**Database:** production, **read-only**. `verify-baseline.mjs` → `BASELINE EXACT`
immediately before the run.

---

## 1. ⛔ The headline number you would normally use is USELESS on this codebase

`src/app/globals.css` lines 38–42:

```css
html,
body {
  margin: 0;
  padding: 0;
  overflow-x: hidden;
}
```

and `src/styles/site-parity.css` line 32 repeats `overflow-x: hidden` on `body`.

**Consequence:** `document.documentElement.scrollWidth` can never exceed
`clientWidth`, so `overflow.documentOverflowPx` reads **0 on every page at every
width**, including pages that overflow badly.

**Proven, not assumed.** A 900px-wide `<div>` was injected into a 320px viewport:

| measurement | value |
|---|---|
| `documentElement.scrollWidth` / `clientWidth` | 375 / 375 |
| `body.scrollWidth` / `body.clientWidth` | **900** / 375 |
| elements detected past the right edge | 2 |

**Use instead:** `overflow.bodyOverflowPx`, and the per-element
`outOfBounds[].overflowRightPx`.

⚠️ **And the user-facing consequence is worse than a scrollbar.** Because
`overflow-x` is `hidden` rather than `auto`, content past the right edge cannot be
scrolled to. It is **cut off and unreachable**. In `offenders.tsv` the
`containerOrOccluder` column says which case applies:
`scrollable ancestor …` (user can swipe to it) vs
`NO scrollable ancestor — unreachable` (it is simply gone).

---

## 2. What was captured

- **32 admin pages** (every `page.tsx` under `src/app/admin`).
- **4 roles**: `owner`, `admin`, `coordinator`, `therapist_a`.
- **5 widths**: 320, 375, 414, 768, 1280.
- **640 cells**, each with `screenshot.png`, `dom.html`, `measure.json`.
- Menus and panels were opened at widths ≤ 768 and measured separately
  (`menu-*.png` / `.html`, and `menus[].measure` in `measure.json`).

**Emulation:** 320/375/414 used mobile emulation (`isMobile`, touch, iPhone UA,
DPR 2). 768 has touch but is not mobile. 1280 is plain desktop. Locale `en-GB`,
timezone `Europe/London`, `prefers-reduced-motion: reduce`, light colour scheme.

**Sessions were re-minted immediately before each role** (they expire in ~1 hour):
owner 08:34, admin 09:07, coordinator and therapist_a as logged in the run output.

---

## 3. Control check — the four roles really are four different sessions

Comparing `owner` and `admin` at 320px across all 32 pages, 4 pages differ:

| page | owner | admin |
|---|---|---|
| `me` | h1 "Good morning, Phase10." | h1 "Good morning, Test." |
| `roles` | "Roles and permissions", 990 chars | **"Roles access limited", 248 chars** |
| `roles-id` | "Owner / Main Admin", 4,770 chars | **"Roles access limited", 248 chars** |
| `staff-id` | 8,241 chars | 1,860 chars |

⛔ So a short page is not automatically a broken page — check `h1` and
`bodyTextHead` in `cell-index.json` before calling a refusal a layout defect.

---

## 4. ⛔ Limits on what an ABSENCE of findings can mean

- **`therapist_a` is "Test Therapist"** (`884311b1-…`), who has **zero assigned
  bookings** in this database. Their list screens render **empty states**. An empty
  list cannot overflow, so "no findings for therapist_a on a list page" is **not**
  evidence that the layout is sound for a therapist with real work.
- **`bookings-series-id`**: `recurring_booking_templates` has **0 rows**, so the page
  renders its not-found state. No real recurring-series layout was auditable.
- **`password-reset-token`**: no live token exists (minting one would be a write), so
  the page renders its invalid-token state.

---

## 5. Real ids used (resolved read-only from the production database)

| param | value | why |
|---|---|---|
| `[bookingId]` | `09a39848-857e-48f7-b637-cf0adf0d4756` | pending, has an assignment |
| `[clientId]` | `5d5d7a36-7209-4d07-a673-fc46222cd5c7` | the client with the most bookings (2) |
| `[staffId]` | `884311b1-e9d0-44b9-91f3-14188a3baf59` | "Test Therapist" — also `therapist_a`, so all four roles render content |
| `[roleId]` | `2d5295c3-5d45-4c96-ab49-d5f87e0464b5` | Owner role — the densest permission matrix |
| `[templateId]` (email) | `booking_confirmation` | a real, content-rich template |
| `[templateId]` (series) | none exist | see §4 |

---

## 6. Safety invariants observed

- Navigation and opening menus only. **Nothing was clicked** whose name matched
  delete / remove / cancel / send / confirm / submit / save / export / download /
  sign out / resend / pay / refund / archive / approve / reject / block / assign /
  create / add / update / edit / reset / revoke / generate / import / clear / mark.
- Menu openers were re-found and re-validated **inside the page immediately before
  each click**, so a shifted layout could never send a click to a different control.
- `/admin/reports/export` and the GDPR export were blocked **at the network layer**
  — they write an `audit_logs` row on a GET (GOTCHAS G21/G31).
- Nothing was written to the database. `verify-baseline.mjs` was run before the run.

---

## 7. ⚠️ How an earlier attempt at this run failed, so it is not repeated

A first capture pass produced **640 files and looked complete**. The dev server had
died partway through, and **498 of the 640 cells contained `status: null` and no
measurement**. They were discarded, not analysed.

The harness now **aborts after three consecutive cells with no measurement** rather
than filling the tree with files that look like work. If you find a cell with
`httpStatus` other than 200 or with no `measure` object, it is **not** a finding of
"empty page" — it is a cell that failed to capture. `cell-index.json` marks these
with `usable: false`.
