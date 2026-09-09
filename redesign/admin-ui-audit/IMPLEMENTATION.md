# Admin responsive fixes — what was done, and what proves it

**Branch** `master` · **from** `fdeb273` · **21 commits** · ⛔ **NOT PUSHED**
**Database** `BASELINE EXACT` before and after — nothing written.

---

## 1. The result

Measured across **640 cells** (32 pages × 4 roles × 5 widths), before and after.

| Width | Pushed off the right edge | Cut off | **Unreachable** |
|---|---|---|---|
| 320 | 2,230 → **336** | 2,361 → **145** | 1,306 → **2** |
| 375 | 1,024 → **222** | 1,151 → **132** | 598 → **0** |
| 414 | 910 → **213** | 1,027 → **141** | 591 → **0** |
| **768** | 1,786 → **0** | 1,967 → **233** | 1,786 → **0** |
| 1280 | 0 → 0 | 181 → 242 ¹ | 0 → 0 |
| **TOTAL** | **5,950 → 771** (−87%) | **6,687 → 893** (−87%) | **4,281 → 2** (−100%) |

¹ 63 of that 68-row rise is stub renders (a redirect caught mid-render, not comparable).
The remaining 5 are vertical clips inside a vertically-scrollable preview pane on
`/admin/emails/templates/[id]` for the `admin` role only — reachable by scrolling,
absent for `owner` in all three states, and not caused by any fix (proven by A/B).

⛔ **The row that matters is the last one.** "Unreachable" counts content past the
right edge with no scrollable ancestor — content that could not be reached by any
gesture. It went from **4,281 instances to 2**.

### The headline defect, closed

At 768px (an iPad upright, or a half-screen window) staff had **no route to
notifications, search, the account menu or Sign out**, on all 32 pages. The desktop
header needed ~940px in a 768px viewport, so the right-hand rail was drawn off a page
that could not scroll; the mobile bar that carried those controls switched off at the
same pixel.

`/admin/bookings`, owner, 768px: elements past the right edge **19 → 0**; the account
button's right edge **938px → within the 768px viewport**.

---

## 2. Every fix, and its verdict

⛔ Rule applied throughout: **a fix whose measurement did not move is not a fix.**

| Fix | What a user gets | Verdict | Evidence |
|---|---|---|---|
| FIX 1 | Search / notifications / account reachable at 768px | ✅ | 19 → 0 on 4 pages, 3 roles |
| FIX 2 | Phone tab labels readable (11px → 12px) | ✅ | small-text 14 → 8, 18 → 12, 8 → 4 |
| FIX 3 | Bottom tab bar stops covering controls | ✅ | 11 cells better, 0 genuinely worse ² |
| FIX 4 | Notification filter chips wrap instead of hiding | ✅ | 31 cells better, 0 worse ³ |
| FIX 5 | Email page fits a 320px phone | ✅ | 32 → 6, 13 → 3 |
| FIX 6 | Enquiries tabs swipe instead of stretching the page | ✅ | 98 → 84, 74 → 61 |
| FIX 7 | Client list stops being twice the phone's width | ✅ | 255 → 0, three roles |
| FIX 8 | One staff email stops widening the profile | ✅ | 473 → 10 |
| FIX 9 | Operations board fits the phone | ✅ | 91 → 2 |
| ~~FIX 10~~ | staff cards | ⛔ **REVERTED** | number never moved (29 → 31) |
| FIX 10r | staff directory fits the phone (replacement) | ✅ | **29 → 0** off-edge, 29 → 0 clipped |
| FIX 11 | All seven booking views reachable | ✅ | 9 → 0 |
| FIX 12 | All seven days of week capacity visible | ✅ | 13 → 0 |
| FIX 13 | Service row menus stop opening off the left edge | ✅ | clipped 24 → 0 ³ |
| FIX 14 | Save bar stops covering the field you are typing in | ✅ | A/B: helps 3 cells, hurts 0 ⁴ |
| FIX 15 | Therapist dashboard's main button tappable again | ✅ | 1 → 0 at 375 and 414 |
| FIX 16 | Same dead button on profile / performance pages | ✅ | 1 → 0 |
| FIX 19 | Admin shell stops being a hidden scrolling box | ✅ | enables FIX 20; no change alone (as planned) |
| FIX 20 | **The mask, scoped** — spill becomes reachable | ✅ | unreachable 4,281 → 2 |

² FIX 3's six "worse" cells all had a **before**-capture taken while scrolled
(header at y −935/−716/−674), so they examined different content. Not comparable.

³ FIX 4 and FIX 13 live **inside pop-up menus**. Judged against base-page counts they
read "no change" — the wrong instrument. Measured inside the menus, both are clear wins.

⁴ FIX 14 had never had a valid measurement: both its earlier "wins" came from the
occlusion sweep, which was later found broken. Settled with a clean A/B (build with,
build without, same repaired instrument): helps 3 cells, hurts 0, strongest at 1280.

---

## 3. ⛔ The mask was SCOPED, not removed

`overflow-x: hidden` on `html, body` was what turned every horizontal overflow into
permanently deleted content. It is now:

```css
html:not(:has(.admin-shell)),
html:not(:has(.admin-shell)) body { overflow-x: hidden; }
```

**The admin is released; the customer-facing site keeps it.** This matters because
`src/app/layout.tsx:4-5` imports both stylesheets and is the parent of the public
layout as well as the admin one — and `/home` alone has **645 elements past the right
edge at 320px** that the rule is currently hiding. Removing it globally would have
exposed an unaudited public site.

Scoped **negatively** on purpose: `html:has(.public-main)` would look equivalent, but
`.public-main` exists only in `(public)/layout.tsx` and `/booking/manage` has no layout
of its own — a positive scope would have silently un-masked that page.

**Public canary: all 28 cells unchanged**, including `/booking/manage`.

---

## 4. Gates

| | Before | After |
|---|---|---|
| TypeScript | 0 errors | **0 errors** |
| Tests | 3,149 / 262 files | **3,149 / 262** |
| Production build | clean | **clean** |
| Database | BASELINE EXACT | **BASELINE EXACT** |
| Public site | — | **28/28 cells identical** |
| 1280px regressions | — | **0 unexplained** |

---

## 5. ⚠️ Known trade-offs and open items

- **At 768px, 2 of 5 nav links now need a sideways swipe.** The nav is a scroller
  (scrollWidth 470 in a 263px box). Before, those controls were completely
  unreachable — this is much better, but not free. ⛔ **The scrollbar is hidden
  (`scrollbar-width: none`), so there is no visual cue that it scrolls.** A fade or
  peeking next item is approved and not yet built.
- **The proper cure is to move the desktop switch from 768px to 1024px.** The desktop
  header genuinely needs ~940px. The plan records this as touching nine coupled
  places — its own piece of work.
- **The therapist role is under-measured.** The test therapist has zero bookings, so
  those screens render empty states, and an empty list cannot overflow. Real
  therapist data will very likely show more.
- **A sticky header that now works can cover content beneath it.** Four pages at
  1280 show controls under the header when scrolled. That is the ordinary cost of a
  working sticky header — it never stuck before.

---

## 6. ⚠️ Instrument failures found during this run — read before trusting old numbers

1. **A 13-minute Supabase DNS outage** (`ENOTFOUND`, 2026-09-01 20:39Z) made the app
   redirect everything to the sign-in page. **70 cells filed a sign-in screen as if it
   were one of 29 different admin pages** — HTTP 200, correct page title, so both
   existing guards passed. A route-integrity guard now aborts the run instead.
2. **The occlusion sweep scrolled the wrong element.** FIX 3 made `#admin-main` the
   scroller below md; the sweep kept calling `window.scrollTo`, which no longer moves.
   It **double-counted position 0 and never visited the rest of the page** —
   overcounting and undercounting at once. Repaired to scroll the real scroller and
   refuse duplicate positions. ⛔ **Occlusion-sweep numbers from `raw-after` are not
   comparable with `raw-final`.**
3. **The "worst overflow" on `/admin/staff` was the screen-reader skip link** (a 1×1
   visually-hidden element reporting as a 164px scroller). It caused a wrong verdict
   on FIX 10 until the real 32px overflow was identified.
4. **Base-page counts cannot see inside menus.** Two working fixes were nearly
   reverted for this.

---

## 7. Where the evidence is

| Path | What |
|---|---|
| `raw/` | 640 cells, before any fix |
| `raw-final/` | 640 cells, after everything, repaired instrument |
| `raw-nofix14/` | the FIX 14 A/B control build |
| `canary/before/`, `canary/after/` | 28 public-site cells each |
| `_compare.json`, `_fix-verdicts.json` | machine-readable comparisons |
| `FIX-PLAN.md` | the plan these fixes came from |
| `SUMMARY.md` | the original audit |
