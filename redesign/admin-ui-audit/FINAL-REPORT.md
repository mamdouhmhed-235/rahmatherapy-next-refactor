# Admin responsive & visual repair — final report

**Branch** `master` · **from** `fdeb273` · **47 commits** · ⛔ **NOT PUSHED**
**Database** `BASELINE EXACT` throughout — nothing written.

---

## 1. What a person gets

Measured across **640 cells** (32 pages × 4 roles × 5 widths), before and after.

| Width | Pushed off the right edge | Cut off | **Unreachable** |
|---|---|---|---|
| 320 | 2,230 → **73** | 2,361 → **149** | 1,306 → **2** |
| 375 | 1,024 → **52** | 1,151 → **135** | 598 → **0** |
| 414 | 910 → **47** | 1,027 → **136** | 591 → **0** |
| 768 | 1,786 → **84** | 1,967 → **181** | 1,786 → **0** |
| 1280 | 0 → 0 | 181 → 240 ¹ | 0 → 0 |
| **TOTAL** | **5,950 → 256** (−96%) | **6,687 → 841** (−87%) | **4,281 → 2** (−100%) |

¹ Entirely one page whose "before" capture caught a redirect mid-render at 150
characters — a stub compared against a real page. **Zero real regressions at 1280.**

⛔ **The row that matters is the last one.** "Unreachable" counts content past the
right edge with no scrollable ancestor — content no gesture could reach.

**The headline defect is closed.** At 768px staff had no route to notifications,
search, the account menu or Sign out, on all 32 pages. Now: **19 → 0**.

---

## 2. How it was done

| Stage | What |
|---|---|
| Audit | 640 cells captured, 89,568 measured defects, 8 analysts, 8 verifiers, 1 critic |
| Plan | 23 root causes traced to file:line, blast radius per cause |
| Fixes | 6 waves, ~50 agents, every fix its own commit |
| Verify | 3 full 640-cell re-measures · 4-role visual review · 4-role visual re-check |
| Public canary | 28 cells, before and after, every round |

**Public website: 28 of 28 cells identical across all 47 commits.** Not one value moved.

---

## 3. ⛔ Four things were reverted

A fix that did not move its number, or made something worse, went back out.

| Reverted | Why |
|---|---|
| Staff-card fix (`f4d5ff6`) | Number never moved (29 → 31). Replacement works: **29 → 0** |
| **Global button border reset** (`a307cad`) | **Made things worse.** Left **193 of 240 buttons as bare text** — "Confirm booking", "Mark paid", "Edit". That border was their only boundary. Reverted → back to 6 |
| A JSX comment | Broke the build; repaired in its own commit so the breakage stays visible |
| — | Plus **20 findings refused by agents** with evidence rather than guessed at |

---

## 4. Root causes, not symptoms

Three single causes explained ~27 of the 76 visual findings:

- **The admin had no CSS reset.** Tailwind's preflight is deliberately not imported
  (the public site's stylesheet depends on browser defaults) and only one symptom had
  ever been patched. That gap produced the stray bullets, the `1. / 3.` breadcrumb
  numbering and the white fieldset boxes. Fixed **scoped to `.admin-shell`**.
- **`#admin-main` was not a containing block.** Once it became the scroller,
  `position: absolute` screen-reader spans escaped it and stretched the document to
  1,645px against a 640px shell — **1,005px of bare cream public-site background**
  below a dark admin. One word (`relative`) fixed it, verified 0px across 108 checks.
- **`overflow-x: hidden` on `html, body`** turned every horizontal overflow into
  permanently deleted content. Scoped so the admin is released and the customer site
  keeps it.

---

## 5. ⚠️ Still open, and deliberately so

| Item | Why it stands |
|---|---|
| **768px nav scrolls** (~3 of 5 links) | Fitting five needs 207px that do not exist. The scroller is what stopped the account menu going off-screen. A scroll-aware edge fade now signals it |
| **Sticky header covers content when scrolled** | That is a working sticky header. It never stuck before |
| **Tab labels nearly touch at 320** | Six tabs into 320px is 53px each; "Dashboard" needs 54px. Fewer tabs or smaller type — your call, not a repair |
| **"Templates" tab off-screen on Emails at 320** | Still 161px past the edge. Reachable by swiping, not discoverable. Not fixed |
| **Two row-menu shapes on phones** | Services/Bookings became bottom sheets; Clients stayed an anchored popover because its library positions with a transform. Consistent-looking would be a redesign |
| **Client-edit / Emails controls under sticky bars at 320×640** | Proven **not** regressions — the pre-fix capture shows the same, and both self-resolve on scroll |

---

## 6. ⚠️ What this cannot promise

- **The therapist role is under-measured.** That test account has zero bookings, so
  its lists render empty and an empty list cannot overflow. Real therapist data will
  very likely surface more.
  ➜ **Planned:** `PLAN-therapist-data-and-audit.md` — seed marked test data through
  the Supabase MCP, re-capture all 160 therapist cells, tear the data down. Awaiting
  the Owner's go-ahead; nothing written yet.
- **The public website was never audited.** It is protected, not verified — `/home`
  alone has **645 elements past the right edge at 320px** that the mask still hides.
- **Nothing was tested on real hardware.** All measurement is emulated Chromium.

---

## 7. ⚠️ Instrument failures found along the way

Each of these reached real data before being caught, and each now has a guard:

1. **A dead server wrote 498 void cells** that looked like completed work.
2. **An unrelated project seized the port** and answered requests as if it were this app.
3. **A 13-minute database DNS outage** filed **70 sign-in screens** as 29 different
   admin pages — HTTP 200, correct page title, so both guards passed.
4. **The occlusion sweep scrolled the wrong element** after a fix moved the scroller,
   double-counting one position and never visiting the rest of the page.
5. **Base-page counts cannot see inside menus** — two working fixes were nearly reverted.
6. **A page can score a perfect 0/0/0 while unusable** — `/admin/clients` at 320 did,
   with every client name truncated to one letter. CSS ellipsis is invisible to geometry.

⛔ **Point 6 is the lesson of this whole job.** The numbers said that page was clean.
It took four people looking at pictures to find that it was not.

---

## 8. Gates

| | Before | After |
|---|---|---|
| TypeScript | 0 errors | **0 errors** |
| Tests | 3,149 / 262 files | **3,149 / 262** |
| Production build | clean | **clean** |
| Database | BASELINE EXACT | **BASELINE EXACT** |
| Public site | — | **28/28 identical** |
| 1280px | works | **0 real regressions** |
| Working tree | clean | **clean** · **0 pushed** |
