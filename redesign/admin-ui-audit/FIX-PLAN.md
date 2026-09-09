# Admin backend — the fix plan

**Source audit:** commit `fdeb273`, captured 2026-09-01 · 640 cells (32 pages × 4 roles × 5 widths) · 89,568 measured defect rows
**Inputs:** `_plan-inputs/causes.json` (23 root causes) · `_plan-inputs/blast-radius.json` · `_plan-inputs/scope-guard.json` · `digest/offenders.tsv`
**Status:** ⛔ **Nothing in this document has been implemented. No application file was changed. This is a plan only.**

Every cause below is a **file and a line number**, not a description. Every line was re-read in the
source before it was quoted here.

---

## A few words explained once

| Word | What it means here |
|---|---|
| **px** | Screen pixels. A cheap phone is 320px wide; a big phone 414px; an iPad in portrait 768px; a laptop 1280px. |
| **Overflow** | Content that is wider or taller than the box it sits in, so part of it sticks out. |
| **`overflow-x: hidden`** | A rule that says "chop off anything that sticks out sideways **and give the user no way to scroll to it**". The chopped-off part is not off-screen — it is gone. |
| **`overflow-x: clip`** | Same visual chop, but it does not turn the box into a scrolling box. It has fewer side effects. |
| **Breakpoint** | A screen width at which the design switches layouts. This codebase uses `sm` = 640px, `md` = 768px, `lg` = 1024px, `xl` = 1280px. |
| **Grid track** | The single invisible column a page's content sits in. If nobody caps it, it grows to fit the widest thing on the page — and then drags everything else out with it. |
| **`minmax(0,1fr)`** | The cap. It tells that column "never grow past the screen". |
| **`position: fixed`** | The element is pinned to the screen and floats over everything, at every scroll position. |
| **`elementFromPoint`** | A browser question: "if I tap exactly here, what do I hit?" Every "covered" finding in this plan was proven with it. z-index was never used to conclude anything. |
| **Digest row** | One measured defect on one element, on one page, at one width, for one role. 89,568 of them exist. |

---

## 1. What this fixes

**Risk scale used throughout:** `LOW = 1`, `MEDIUM = 2`, `HIGH = 4`.
**Score = symptoms fixed ÷ risk number.** Higher is better value for the danger taken.

The arithmetic is shown in full so the order can be checked, not just believed.

| Rank | Cause | File : line | Symptoms | Risk | Risk no. | Score (symptoms ÷ risk) |
|---:|---|---|---:|---|---:|---:|
| 1 | CAUSE-01 | `src/app/admin/components/AdminTopNav.tsx:282` | 9,335 | MEDIUM | 2 | 9335 ÷ 2 = **4,667.5** |
| 2 | CAUSE-02 | `src/app/admin/components/AdminTopNav.tsx:204` | 9,629 | HIGH | 4 | 9629 ÷ 4 = **2,407.3** |
| 3 | CAUSE-04 | `src/app/admin/components/AdminTopNav.tsx:662` | 4,558 | MEDIUM | 2 | 4558 ÷ 2 = **2,279.0** |
| 4 | CAUSE-03 | `src/app/globals.css:42` | 7,718 | HIGH | 4 | 7718 ÷ 4 = **1,929.5** |
| 5 | CAUSE-06 | `src/app/admin/components/notification-bell.tsx:631` | 1,389 | LOW | 1 | 1389 ÷ 1 = **1,389.0** |
| 6 | CAUSE-07 | `src/app/admin/emails/page.tsx:392` | 1,074 | LOW | 1 | 1074 ÷ 1 = **1,074.0** |
| 7 | ⚠️ CAUSE-10 | `src/app/admin/audit/AuditEventCard.tsx:167` | 618 | LOW | 1 | 618 ÷ 1 = **618.0** |
| 8 | CAUSE-05 | `src/app/admin/components/AdminTopNav.tsx:648` | 1,930 | HIGH | 4 | 1930 ÷ 4 = **482.5** |
| 9 | ⛔ CAUSE-12 | `src/app/admin/clients/components/BulkDeleteToolbar.tsx:195` | 476 | LOW | 1 | 476 ÷ 1 = **476.0** |
| 10 | CAUSE-08 | `src/app/admin/enquiries/page.tsx:324` | 819 | MEDIUM | 2 | 819 ÷ 2 = **409.5** |
| 11 | CAUSE-09 | `src/app/admin/clients/page.tsx:641` | 756 | MEDIUM | 2 | 756 ÷ 2 = **378.0** |
| 12 | CAUSE-14 | `src/app/admin/staff/[staffId]/page.tsx:352` | 295 | LOW | 1 | 295 ÷ 1 = **295.0** |
| 13 | CAUSE-11 | `src/app/admin/bookings/BookingsChrome.tsx:337` | 574 | MEDIUM | 2 | 574 ÷ 2 = **287.0** |
| 14 | ⚠️ CAUSE-16 | `src/app/admin/availability/page.tsx:766` | 268 | LOW | 1 | 268 ÷ 1 = **268.0** |
| 15 | CAUSE-17 | `src/app/admin/operations/operations-board.tsx:254` | 226 | LOW | 1 | 226 ÷ 1 = **226.0** |
| 16 | CAUSE-13 | `src/app/admin/components/admin-ui-interactions.tsx:129` | 450 | MEDIUM | 2 | 450 ÷ 2 = **225.0** |
| 17 | CAUSE-18 | `src/app/admin/staff/page.tsx:399` | 212 | LOW | 1 | 212 ÷ 1 = **212.0** |
| 18 | ⛔ CAUSE-15 | `src/app/admin/components/charts/SparklineChart.tsx:34` | 267 | MEDIUM | 2 | 267 ÷ 2 = **133.5** |
| 19 | CAUSE-20 | `src/app/admin/availability/page.tsx:645` | 132 | LOW | 1 | 132 ÷ 1 = **132.0** |
| 20 | CAUSE-21 | `src/app/admin/dashboard/MobileStickyActionBar.tsx:27` | 92 | LOW | 1 | 92 ÷ 1 = **92.0** |
| 21 | CAUSE-19 | `src/app/admin/settings/SettingsForm.tsx:432` | 146 | MEDIUM | 2 | 146 ÷ 2 = **73.0** |
| 22 | CAUSE-22 | `src/app/admin/components/PerformanceSurface.tsx:548` | 54 | LOW | 1 | 54 ÷ 1 = **54.0** |
| 23 | CAUSE-23 | `src/styles/site-parity.css:32` | 0 | MEDIUM | 2 | 0 ÷ 2 = **0.0** |

**Legend**
- ⛔ **CAUSE-12 and CAUSE-15 should not be coded at all.** Both were re-checked and the premise is wrong. They are in section 6.
- ⚠️ **CAUSE-10 and CAUSE-16 are disputed.** The scope guard rules the entire "tap target under 24px" class out of scope (all 7,424 rows). Both fixes are one line and harmless, so they sit in an optional polish bucket, not in the main run. Also in section 6.

**Totals**

| | |
|---|---|
| Root causes analysed | **23** |
| Fixes that change application code | **21** (2 of the 23 are "change nothing") |
| Of those 21, in the **core run** | **19** (CAUSE-10 and CAUSE-16 are optional polish) |
| Distinct digest rows explained by all 23 causes | **26,969** of 89,568 (30.1%) — re-counted by one awk over all 23 conditions, matches `causes.json` exactly |
| Distinct digest rows the **21 code fixes** address | **26,226** |
| Distinct digest rows the **19 core fixes** address | **25,340** |
| Sum of the per-cause counts | 41,018 — deliberately larger, because the three mask causes overlap the layout causes they multiply |

⚠️ **One counting correction, measured.** `causes.json` states CAUSE-14 explains 295 rows, but the
awk command it ships omits the kind `clipped-by-overflow-hidden` and returns **182**. Adding that kind
— which every sibling cause in the same family already includes — returns **295**. The table uses
295 and the discrepancy is recorded here rather than silently smoothed over.

---

## 2. ⛔ The sequence — and what the admin looks like after each stage

### The one thing that must not go wrong

Three separate lines of code currently declare `overflow-x: hidden` on ancestors of every admin page:

| # | Where | Cause |
|---|---|---|
| 1 | `src/app/globals.css:38-42` — `html, body { … overflow-x: hidden }` | CAUSE-03 |
| 2 | `src/styles/site-parity.css:24-33` — `body { … overflow-x: hidden }` | CAUSE-23 |
| 3 | `src/app/admin/components/AdminTopNav.tsx:204` — `div.admin-shell` | CAUSE-02 |

Together they are **the mask**. They do not fix anything. They take everything that sticks out past
the right-hand edge of the screen and **delete it** — no swipe, no scrollbar, no keyboard route
reaches it. They also pin the standard overflow measurement at **0 on all 640 captured cells**, which
is why every automated check on this codebase has been reporting a clean sheet on pages that overflow
by 180px. (Proven in-session, not assumed: a 900px `<div>` injected into a 320px viewport reported
`documentOverflowPx` 0 while `body.scrollWidth` read 900.)

**If the mask comes off first, the admin gets visibly worse on every page at once.** At 768px the
document wants 948.52px inside 768px, so all 32 pages would start sliding ~180px sideways for owner,
admin and coordinator on a single deploy. On phones, `/admin/clients` would show a 531.797px-wide row
inside a 288px box, `/admin/availability` 357px of week strip past the edge, `/admin/emails` a page
shell 125px wider than the screen.

⛔ **So the mask comes off LAST.** Fix what overflows first; take the blindfold off at the end.

### The stages

| Stage | What happens | Ships? |
|---|---|---|
| **0** | Take an honest baseline with the mask temporarily lifted **locally** | No |
| **1** | The shell: CAUSE-01, CAUSE-04, CAUSE-05 | Yes, 3 commits |
| **2** | Everything else, in parallel: CAUSE-06 … CAUSE-22 | Yes, 8 workstreams |
| **3** | Re-measure and hold the gate | No code |
| **4** | CAUSE-02 — the safe half-step on the mask | Yes, 1 commit |
| **5** | CAUSE-03 + CAUSE-23 — the mask comes off | Yes, 1 commit |

---

### Stage 0 — Measure honestly first. Nothing ships.

**What is done.** In a **local, uncommitted, throwaway** build, delete all three `overflow-x: hidden`
declarations and re-run `capture.mjs`. Separately, capture the 12 non-admin routes (11 under
`src/app/(public)/` plus `src/app/booking/manage/page.tsx`) at 320/375/414/768/1280 **with the mask
lifted**, because the audit contains **zero public cells** and nobody knows what that rule is holding
together on the public site.

**Why.** While the three declarations stand, `overflow.documentOverflowPx` reads 0 on all 640 cells
and no automated check can see horizontal overflow at all. Without this step there is no honest
before-number for Stages 1 and 2.

**What the admin looks like after.** In production: **completely unchanged.** In the throwaway local
build: much worse — pages slide sideways everywhere. That build is a measuring instrument. It is
never deployed and never committed.

**Worse before better:** no (nothing ships).

---

### Stage 1 — The shell. Three commits, one file, one person.

CAUSE-01 → CAUSE-04 → CAUSE-05, in that order, all inside
`src/app/admin/components/AdminTopNav.tsx` plus five knock-on files.

**What the admin looks like after Stage 1**

- **At 768px, the navigation comes back.** On all 32 pages, for owner, admin and coordinator, the
  account button, the notification bell and the command search return inside the screen. Measured
  target: `counts.outOfBounds` on `/admin/dashboard` as owner at 768 goes **19 → 0**; the account
  button's right edge goes **940.52 → at or inside 744**.
- **A visible change at 768:** the row of navigation links becomes a strip you can swipe. Roughly 3
  of the 5 links show without swiping. That is deliberate — a strip you can swipe is a route; an
  element under `overflow-x: hidden` is not. `counts.horizontalScrollers` at owner/dashboard/768 will
  rise by exactly 1 (11 → 12). A rise of more than 1 means the edit leaked.
- **On phones, the tab labels get slightly bigger** — 11px to 12px, with real line spacing. Nothing
  moves; the padding is trimmed from 4px to 2px per side to pay for it (projected slack at 320px:
  25.50px, essentially today's measured 24.04px).
- **On phones, the bottom bar stops floating over things.** The Dashboard/Bookings/Clients bar becomes
  part of the page instead of a sheet of glass on top of it, so the 57px band at the bottom is
  reserved. On `/admin/privacy` at 320 the search field and "Apply filters" stop being covered
  (`counts.obscuredInteractive` 2 → 0).
- **1280px is untouched.** All 128 cells at 1280 already read `counts.outOfBounds` 0 and must still
  read 0.
- ⛔ **One thing Stage 1 installs on purpose, which Stage 5 must take back out.** FIX 3 pins
  `[overflow-x:clip]` on `<main id="admin-main">` (`AdminTopNav.tsx:346`) below 768px. The current
  source has **no** `overflow-x` rule there at all, so this token does not exist today — Stage 1
  creates it. It is needed while the mask is still up, because without it the browser turns `main`
  into a sideways scroller and lifts part of the mask early, on a commit nobody could attribute it
  to. But it is a **clip**: left in place it becomes the new nearest clipping ancestor on phones the
  moment Stage 5 removes the other three. **Stage 5 carries a fourth edit that converts it, and the
  two must not be separated.** What is at stake is counted: **1,988** of the 7,718
  `NO scrollable ancestor — unreachable` rows are below 768px (320 = 968, 375 = 516, 414 = 504), and
  **1,280** of those sit inside `main#admin-main`.

**Worse before better:** **no.** Every Stage 1 change is a strict improvement with the mask still on.

---

### Stage 2 — Everything else, all at once. Eight independent workstreams.

Groups 2 to 9 (section 4). They touch completely different files from each other, so they can be done
simultaneously by different people with no merge pain.

**What the admin looks like after Stage 2**

- **Phone pages stop being wider than the phone.** Emails (125px too wide at 320), Enquiries (165px),
  Clients (244px), Staff profile (68px), Operations (61px), Staff directory (32px) all come back
  inside the screen.
- **Menus open where you can tap them.** The service card "…" menu stops opening 30.55px off the
  **left** edge. The booking "More" menu stops being clipped by a 48px strip — 275px of it was laid
  out outside its own clip box, with all 5 items 100% covered at their centre point.
- **Dead buttons come alive.** The therapist dashboard's "Set my availability →" (17,160px² = 100% of
  a 390×44 button, covered at *every* scroll position) becomes tappable. So do "Open enquiries" and
  "Browse claimable" on `/admin/me`.
- **The desktop Settings bug goes.** At 1280 the whole "Contact email" field and its help text
  (46,640px², confirmed by `elementFromPoint`) stop hiding under the Save bar.
- **The week strip is readable.** "This week's capacity" stops hiding Thursday to Sunday behind a
  blind sideways swipe (394px hidden at 320).

**⚠️ Worse before better: YES, in four visible places.** These are honest costs, not regressions, and
someone must accept them before Stage 2 starts:

| Page | What gets worse | Number |
|---|---|---|
| `/admin/clients` at 320 | The client's **name** shrinks to about two characters and an ellipsis, because everything else in the row (44px checkbox, 32px avatar, 68.92px badge, 44px menu button, 4 × 12px gaps) refuses to shrink | name block **270.88px → 27.1px** |
| `/admin/bookings` on phones | The view switcher grows from one 48px strip to three wrapped rows, pushing the booking list down | ~48px → ~150px |
| `/admin/availability` at 320 | The week strip becomes seven stacked rows instead of one wide row | page **4,145px → ~4,575px** tall |
| `/admin/staff` at 320 | The four "team health" chips become a single column instead of a 2×2 grid | section floor **319.922px → ~170px**, ~60px taller |

⛔ On `/admin/clients` in particular, **every counter will report success while a human looking at the
screen will not agree.** Making that row genuinely good needs a second, separate change to the row
layout (`clients/page.tsx:1121` and `:1179`) and must not be smuggled into this one.

---

### Stage 3 — Re-measure and hold the gate. No code.

Re-run the capture at the new commit-of-record and rebuild the digest. Every "from" number in this
plan is anchored to `fdeb273` (`CAPTURE-NOTES.md:3`), so it must be re-baselined here before the mask
is touched.

**Three numbers must be true before Stage 4 is allowed to start:**

1. All 128 cells at 1280 still read `counts.outOfBounds` 0 and `counts.clipped` 0.
2. `counts.outOfBounds` at 768 has fallen from 19 to 0 on owner, admin and coordinator dashboards.
3. The 26,226-row set from section 1 has fallen to the residuals named per fix in section 5.

**What the admin looks like after:** exactly as after Stage 2. Nothing changes.

---

### Stage 4 — CAUSE-02. The safe half-step. One commit, on its own.

Change one word at `src/app/admin/components/AdminTopNav.tsx:204`: `overflow-x-hidden` becomes
`overflow-x-clip`.

**What the admin looks like after: identical. Not one pixel moves, and nothing is revealed.** That is
the whole point of doing it separately — it is the only one of the three mask lines that reveals
nothing.

What changes underneath: `overflow-x: hidden` leaves `overflow-y` at `visible`, and the CSS spec then
forces `overflow-y` to `auto`, which quietly turns this box into a scrollable box. `overflow: clip`
does not. So after this commit:

- The **170–173px one-way sideways drag** stops being possible. Today, at 768px, moving focus onto the
  off-screen account button drags the whole page 170px left, the RAHMA logo ends up at x = −39.88, and
  nothing scrolls it back — closing the menu is the only escape. 2,849 rows measured this.
- The sticky header stops being independently slidable against the fixed bottom bar.

⚠️ **Guard, and read it carefully:** the blast-radius note says `counts.outOfBounds` at
owner/dashboard/768 must stay **19 → 19** on this change alone. That number is written against the
tree *before* CAUSE-01. Once CAUSE-01 has shipped the same guard reads **0 → 0**. Either way, this
commit must not move it.

**Worse before better:** no.

---

### Stage 5 — CAUSE-03 + CAUSE-23. The mask comes off. One commit. Last thing that ships.

**Four coordinated edits in one commit.** Three of them delete the three `overflow-x: hidden`
declarations, and fewer than those three is a no-op, because the three back each other up:

- delete `globals.css:42` alone → `body` still says `overflow-x: hidden` in `site-parity.css:32`, so **nothing happens**;
- delete both CSS lines alone → `div.admin-shell` at `AdminTopNav.tsx:204` still clips admin content inside its own box (9,918 of the 11,542 measured clipped rows name that element), so **nothing happens**;
- delete `AdminTopNav.tsx:204` alone → `body` becomes the nearest scrolling box, with automatic height, so the sticky header stays broken **exactly as before** and the team concludes the fix failed.

⛔ **The fourth edit is the one Stage 1 created, and without it this stage does not do what its own
headline says.** FIX 3 pins `[overflow-x:clip]` on `<main id="admin-main">` (`AdminTopNav.tsx:346`)
below 768px. None of the three edits above touches it, so on a phone it simply **becomes the new
mask** — the nearest clipping ancestor at every width under 768. Stage 5 therefore also changes that
token to `[overflow-x:auto]`, which pairs with the vertical scrolling FIX 3 introduced without the
browser coercing anything, and turns a chop into a real sideways swipe.

⛔ **These are the rows at stake, and they are counted, not estimated: 1,988 of the 7,718
`NO scrollable ancestor — unreachable` rows are below 768px** (320 = 968, 375 = 516, 414 = 504),
**and 1,280 of those 1,988 sit inside `main#admin-main`.** Ship the first three edits without the
fourth and those 1,280 rows stay exactly as unreachable as they are today — on the one commit whose
entire promise is that nothing is unreachable any more.

**What the admin looks like after Stage 5**

- **The admin can scroll sideways for the first time.** If Stages 1 and 2 did their job, nothing
  actually will — `documentOverflowPx` should read 0 because content now fits, not because it is
  being deleted. Anything still spilling becomes **visible and swipeable** instead of gone: past the
  right edge of the document at 768px and above, and inside `main#admin-main` below it. Target: the
  7,718 rows marked `NO scrollable ancestor — unreachable` fall to **0** — the 5,730 at 768px because
  the document itself can now scroll, and the 1,988 below 768px because `main` can. ⛔ **All four
  edits are required for that 0.** Three of them leaves the 1,280 rows inside `main` exactly where
  they are.
- **`htmlOverflowX` goes from `hidden` on 628 of 640 cells to `visible` on all of them.** That single
  number is the proof the mask is off.
- **The sticky top bar starts working.** Today it is measured detached in all 21 cells that were
  captured mid-scroll (header y = −935 at 320, −716 at 375, −674 at 414, −483 at 1280, while its own
  style still reads `position: sticky; top: 0px`).
- **The public site is unchanged.** The recommended edit re-applies the same rule to non-admin
  documents with a negative scope (`html:not(:has(.admin-shell))`), so all 12 public routes and the
  signed-out `/admin/login` and `/admin/password-reset` keep byte-identical behaviour.

**⚠️ Worse before better: YES, in two ways, and both are foreseeable.**

1. **Any page Stage 2 missed goes from "tidy but broken" to "visibly sliding sideways".** That is a
   feature of this stage: it converts hidden damage into visible damage. It is also why Stage 3 is a
   gate and not a formality.
2. **At 1280, the sticky header waking up is a genuine new risk.** All 19 sticky elements in the admin
   start behaving as sticky on the same commit, and the 18 existing `covered-by-fixed-or-sticky` rows
   at 1280 can only grow. 1280 currently carries just 2,136 of 89,568 rows and is the width the
   business must not lose — so this commit needs its own desktop eyes, not just counters.

⛔ **Do not ship the public half unscoped** (i.e. deleting the rule for everyone) without the
before/after public capture from Stage 0 in hand. `globals.css:161` and `:165` hide the scrollbar on
public pages on **both** axes, so a public page that started overflowing would show no scrollbar at
all — just a page that slides under a swipe, with nothing to tell anyone it happened.

---

## 3. ⛔ The 768px navigation gap — its own problem, its own fix

**This is the single worst thing in the audit and it is not a layout blemish. It is a lockout.**

### What is happening

At **exactly 768 pixels** — an iPad held upright, a browser window docked to half a laptop screen —
seven things switch at the same instant inside
`src/app/admin/components/AdminTopNav.tsx`:

| Line | Element | At 768px |
|---|---|---|
| `:282` | desktop navigation links (`hidden … md:flex`) | **switches ON** |
| `:314` | command search (`hidden md:block`) | **switches ON** |
| `:320` | notification bell (`nav-rail-bell hidden md:block`) | **switches ON** |
| `:323` | account menu, which holds **Sign out** (`hidden md:block`) | **switches ON** |
| `:332` | mobile controls (`… md:hidden`) | **switches OFF** |
| `:648` | bottom tab bar (`admin-bottom-tabbar … md:hidden`) | **switches OFF** |
| `:784` / `:795` | mobile "More" sheet (`md:hidden`) | **switches OFF** |

The desktop header then needs **938–941px** of room inside a **768px** screen. The whole right-hand
group is drawn past the edge, and the mask (section 2) makes it unreachable.

### The measurement, on `/admin/dashboard` as owner

| Width | Bottom tab bar rendered | Elements more than 50px past the right edge |
|---|---|---|
| 414 | **1** (present) | 2 |
| **768** | **0** (gone) | **19** |
| 1280 | 0 | **0** |

Per element at 768: the account button lands **170.16–172.52px** out (worst case 180.52px on the
account-menu chevron, coordinator, `/admin/bookings`), the bell **111.75–115.16px** out, the search
trigger **62.16px** out.

### What it means for a person

⛔ **On a 768px screen there is no route to notifications, no route to search, no route to the account
menu, and no route to Sign out — on all 32 admin pages, for owner, admin and coordinator.** The
desktop controls are drawn off a screen that refuses to scroll; the mobile bar that used to carry them
is switched off at the same pixel. No swipe, no scrollbar and no keyboard action reaches any of it.
The only workaround is to resize or rotate the device.

The 19/19 reading holds on **94 of the 128 cells at 768** (owner 31, admin 32, coordinator 31). The
only two non-19 cells are `login`, which was captured mid-redirect.

`therapist_a` is the control that proves the diagnosis: their nav rail is genuinely shorter, their
account button ends at **exactly 744.00** (768 minus the 24px page padding), and they read
`counts.outOfBounds` **0** at 768 on all 32 pages. Content width is the cause, not the breakpoint on
its own.

### The fix — CAUSE-01, and it is one line

`src/app/admin/components/AdminTopNav.tsx:282`. Add three things to the existing class list, in this
order of necessity:

1. **`min-w-0`** — the whole fix for the stated harm. A stretchy element still refuses to shrink below
   its own content unless you tell it it may. With this, the nav gives up the **193.75px** the
   right-hand group is out by, and that group's right edge lands at 744 instead of 937.75. This is
   already the house convention: `min-w-0 flex-1` appears in **7 other files under
   `src/app/admin/components/`** — `ActivityTimeline.tsx`, `admin-ui-interactions.tsx`,
   `admin-ui.tsx`, `AdminCommandSearch.tsx`, `notification-bell.tsx`, `notification-card.tsx` and
   `PerformanceSurface.tsx` (47 files across all of `src/`).
2. **`overflow-x-auto` plus the existing global class `admin-nav-scrollbar`** (`globals.css:238-247`).
   Without it, `min-w-0` shrinks the nav's *box* but its links keep painting past it, straight over
   the theme toggle and the search trigger — the defect changes shape from "off the edge" into
   "painted over", rather than disappearing. No new CSS is written; that class already exists and
   already has one admin-only consumer at `AdminCommandSearch.tsx:153`.
3. **`py-1 -my-1`** — required, not decoration. Setting `overflow-x` to a non-visible value forces
   `overflow-y` to `auto`, and the nav's content box is exactly the 32px height of its links. The
   keyboard focus ring at `:293` is a 2px ring drawn *outside* the element, so it would be clipped on
   all four sides. 4px of padding pulled straight back out by a negative margin gives the ring room
   without moving a single rectangle.

**The honest residual.** After this, the right-hand group is fully on screen, but the nav strip shows
roughly 3 of 5 links without a swipe, because the bottom tab bar at `:648` is still switched off at
768. That is a real improvement (a swipeable strip is a route) but it is not a beautiful one.

**The bigger alternative, recorded so the decision is deliberate.** Move the whole desktop switchover
from `md` (768px) to `lg` (1024px). That restores the bottom tab bar — the route measured to work
(owner/dashboard/414 reads `counts.outOfBounds` 3) — but removes the desktop nav for everyone between
768 and 1023px, and it is **nine coupled lines that must all move together or the shell tears in
half**: `:259`, `:279`, `:282`, `:314`, `:320`, `:323`, `:332`, `:346`, `:648`, plus `:784`/`:795` and
the landscape media query at `:253`.

⛔ **If that alternative is chosen, three other fixes must move with it in the same commit:** CAUSE-05
(every `md:` reset it introduces), CAUSE-19 (`md:static` becomes `lg:static`) and CAUSE-04's
verification baseline.

### One band nobody measured

The audit captured 768 and 1280 and nothing between.

**One derivation of the threshold, used everywhere in this document.** At 768px the header row
(`div.mx-auto.flex.h-14`, itself the full 768px wide) overflows its own box by a measured **170px**
for owner and admin and **172–173px** for coordinator — those are `content-wider-than-box` rows at
width 768 in `offenders.tsv`. So the header needs **768 + 170 = 938px** of screen for owner and
admin, and **768 + 173 = 941px** for coordinator. That matches the right-hand rail's measured right
edge from the other direction: **937.75** for owner and admin, **940.52** on the coordinator's
account button. Taking the worst role: **the header does not fit below ~941px.**

So the band where the desktop layout is switched on but the header still does not fit is
**769–940px**, and there is no artefact to check it against. (Nothing at all between 769 and 1279 was
captured; above ~941px the arithmetic says the header fits.) That is inference, clearly labelled, not
measurement.

---

## 4. Fix groups — who can work at the same time

Groups own files. **No two groups own the same file**, so two groups can never collide in a merge.
Anything sitting in a file shared across the whole admin gets its own group and is marked **SERIAL** —
one person, one commit at a time.

### Group 1 — The shell and the mask · ⛔ SERIAL · spans Stage 1 and Stages 4–5

**Causes:** CAUSE-01, CAUSE-04, CAUSE-05 (Stage 1) → CAUSE-02 (Stage 4) → CAUSE-03 + CAUSE-23 (Stage 5)

**Files owned**
```
src/app/admin/components/AdminTopNav.tsx        (lines 204, 256, 282, 344-346, 648, 662, 682, 696, 719)
src/app/globals.css                             (lines 38-43)
src/styles/site-parity.css                      (lines 24-33)
src/app/admin/dashboard/PullToRefresh.tsx       (75, 86)          — CAUSE-05 knock-on
src/app/admin/bookings/new/ManualBookingForm.tsx (1134, 1141, 2455) — CAUSE-05 knock-on
src/app/admin/clients/new/ClientCreateForm.tsx  (456)             — CAUSE-05 knock-on
src/app/admin/clients/[clientId]/edit/ClientEditForm.tsx (307)    — CAUSE-05 knock-on
```

**Why it cannot be parallelised.** Five causes live in `AdminTopNav.tsx` (`:204`, `:282`, `:648`,
`:662` and the whole 768px breakpoint set); Stage 5's third edit goes back into `:204` again, and its
fourth goes back into `:346` to undo the temporary clip Stage 1 put there. It
is the single highest-value file in the plan — **25,452 rows** across CAUSE-01/02/04/05 — and it is
mounted exactly once, at `src/app/admin/layout.tsx:68`, so it renders on **all 32 admin pages for all
4 roles**. There is no per-page opt-out and no way to stage it. `globals.css` and `site-parity.css`
are in the same group because Stage 5's four edits are one atomic change, and because two of the
four land in `AdminTopNav.tsx` too. **The same person should hold this file from first commit to
last.**

⛔ Two of this group's files — `src/app/globals.css` and `src/styles/site-parity.css` — **also govern
the public website.** See section 5, CAUSE-03 and CAUSE-23.

---

### Group 2 — Bottom bars that swallow the button underneath · ⛔ SERIAL · Stage 2

**Causes:** CAUSE-21, CAUSE-22

**Files owned**
```
src/app/admin/dashboard/MobileStickyActionBar.tsx        (27, 30)
src/app/admin/dashboard/MobileStickyActionBar.test.tsx   (102)  — must change in the same commit
src/app/admin/components/PerformanceSurface.tsx          (548)
```

**Why SERIAL.** `PerformanceSurface.tsx` is a shared admin primitive used by `/admin/me` and
`/admin/staff/[id]/performance`, and the audit's own merge notes flag it as having a blast radius
wider than the pages that happened to be measured. The two fixes are the same one-token fix for the
same defect and should ship together — fixing one alone leaves the identical dead-button symptom on
two other pages for two other roles, which reads as an incomplete fix.

⛔ Re-verify this group **after** Group 1's Stage 1 lands: both offsets are hard-coded against the tab
bar's 56px height at `AdminTopNav.tsx:651`.

---

### Group 3 — The row-action menu primitive · ⛔ SERIAL · Stage 2

**Cause:** CAUSE-13 · **File owned:** `src/app/admin/components/admin-ui-interactions.tsx` (129)

**Why SERIAL.** This file has **33 importers**, every one under `src/app/admin/`. The panel's class
string is hard-coded and cannot be overridden by any caller, so the change reaches all three call
sites at once — and two of them (`/admin/enquiries`) were **never measured with the menu open**.

---

### Group 4 — The notification bell's filter chips · ⛔ SERIAL · Stage 2

**Cause:** CAUSE-06 · **File owned:** `src/app/admin/components/notification-bell.tsx` (630-633)

**Why SERIAL.** The bell is shell chrome. It is reachable from **all 32 pages for all 4 roles**, so
its 1,389 rows are spread across the whole admin even though only one element changes. A cosmetic
mistake here is visible everywhere at once. The file is disjoint from every other group, so this is a
one-person job that can still run at the same time as Groups 5–9.

---

### Group 5 — Page columns that outgrow the phone · PARALLEL · Stage 2

**Causes:** CAUSE-07, CAUSE-08, CAUSE-09, CAUSE-14, CAUSE-17, CAUSE-18

**Files owned**
```
src/app/admin/emails/page.tsx                 (325)
src/app/admin/enquiries/page.tsx              (318)
src/app/admin/clients/page.tsx                (641, 656, 670)
src/app/admin/staff/[staffId]/page.tsx        (352, 406)
src/app/admin/operations/operations-board.tsx (250)
src/app/admin/staff/page.tsx                  (399)
```

**Why parallel.** Six causes, six *different* route files, none imported by anything, no shared CSS
and no shared component. They are the same fix six times over — cap the page's single invisible column
so it can never be pushed wider than the screen. **These six can be split across six people
simultaneously.**

---

### Group 6 — The booking view switcher · PARALLEL · Stage 2

**Cause:** CAUSE-11 · **File owned:** `src/app/admin/bookings/BookingsChrome.tsx` (337, 367, 395)

⛔ Its three edits are **internally atomic** — one commit, or the fix creates a worse defect than the
one it removes.

---

### Group 7 — Availability: the week strip and the roster links · PARALLEL · Stage 2

**Causes:** CAUSE-20, CAUSE-16 · **File owned:** `src/app/admin/availability/page.tsx` (641, 645, 766)

**Why one group.** Both causes live in the same file. They must be one owner even though they are
unrelated defects. (CAUSE-16 is the disputed touch-target item — see section 6; if it is dropped, this
group is CAUSE-20 alone.)

---

### Group 8 — The audit log's family-filter icon · PARALLEL · Stage 2 (optional)

**Cause:** CAUSE-10 · **File owned:** `src/app/admin/audit/AuditEventCard.tsx` (167)

⚠️ Disputed by the scope guard — see section 6.

---

### Group 9 — Save bars that cover the field you are typing in · PARALLEL · Stage 2

**Causes:** CAUSE-19 · **Files owned:**
```
src/app/admin/settings/SettingsForm.tsx                        (195, 432)
src/app/admin/emails/templates/components/TemplateEditor.tsx   (232, 389)
```

⛔ **Breakpoint-coupled to Group 1.** The `md:` switch this fix uses is tuned to the tab bar's
`md:hidden`. If Group 1 takes the `md → lg` alternative for CAUSE-01, this group's `md:static` must
become `lg:static` in lockstep. **Settle Group 1's breakpoint before this group starts.**

### Not a group — two causes with no code change

CAUSE-12 (`BulkDeleteToolbar.tsx:195`) and CAUSE-15 (`SparklineChart.tsx:34`). Both are
re-classifications, not fixes. Section 6.

---

## 5. Every fix in detail

---

### FIX 1 — CAUSE-01 · The 768px navigation lockout

**Cause** · `src/app/admin/components/AdminTopNav.tsx:282`
```
<nav className="hidden flex-1 items-center gap-0.5 text-[var(--admin-nav-text)] md:flex" aria-label="Admin navigation">
```
**CSS responsible:** `flex: 1 1 0%` with the default `min-width: auto` and no `min-w-0`, inside the
non-wrapping header row at `:259`, switched on by `md:flex` at exactly 768px.

**Symptoms resolved** · **9,335 rows** · all 32 pages · 8 of 8 areas · owner, admin, coordinator ·
width 768 only. `therapist_a` contributes 0 — the control that proves the diagnosis.

**The precise change** · Three additions to that one class string, described in full in section 3:
`min-w-0`, then `overflow-x-auto` + the existing global class `admin-nav-scrollbar`, then `py-1 -my-1`
for the focus ring. **Nothing else is touched** — not `:259`, `:263`, `:279`, `:310-338`, `:346`,
`:648`, `:784`, `:795`, and no CSS file.

**Blast radius** · Enumeration **COMPLETE**. 25 usages. One import (`src/app/admin/layout.tsx:5`), one
mount (`:68`), so this one element appears on all 32 pages. Also touched by proximity but not edited:
the brand link `:263` (cannot shrink, measured 24 → 130.13 at 768), the separator `:279` (25px), the
right-hand rail `:310` (measured 623.39 → 937.75, i.e. 193.75px past the inner edge). Six e2e
locators reference this nav by ARIA role and name (`e2e/helpers.ts:113/126/135`,
`e2e/admin-roles.spec.ts:208/233`, `e2e/auth-state.spec.ts:89`,
`e2e/enquiry-lifecycle.spec.ts:693`) — all survive, because both Playwright projects run at 1280×720
and 393×851, neither of which is in the unmeasured 769–1279 band, and a link scrolled inside a scroll
strip still passes `toBeVisible`.

**Risk · MEDIUM (2)** · Not LOW: it is the shell every user navigates by, on all 32 pages for 3 of 4
roles, and it introduces a new scroll container that will clip the keyboard focus ring if the
`py-1 -my-1` part is dropped. Not HIGH: usage is structurally enumerable, only Tailwind utilities on
one element change, no CSS file is edited.
**Does it endanger 1280?** ⛔ **No.** All 128 cells at 1280 already read `counts.outOfBounds` 0. At
1280 the header content measures 913.75px with ~302px of free space, so the nav is being *grown*, not
shrunk, and `min-w-0` is inert. `overflow-x: auto` produces no scrollbar and no clipping when content
fits. **Public site: not affected** (single admin-only import).

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| `/admin/dashboard` · owner · 768 | `counts.outOfBounds` | **19 → 0** |
| `/admin/dashboard` · owner · 768 | `counts.clipped` | 19 → 0 |
| `/admin/dashboard` · owner · 768 | `counts.horizontalScrollers` | 11 → **12** (must rise by exactly 1) |
| `/admin/bookings` · coordinator · 768 | `rectRight` of the account button | **940.52 → ≤744** |
| `/admin/settings` · admin · 768 | `counts.outOfBounds` | 19 → 0 |
| All 32 pages × owner/admin/coordinator · 768 | the cause's own awk over `offenders.tsv` | **9,335 → 0** |
| `/admin/dashboard` · owner · **1280** | `counts.outOfBounds` / `horizontalScrollers` | 0 → 0 · 7 → 7 (**guard**) |
| `/admin/dashboard` · therapist_a · 768 | `counts.outOfBounds` | 0 → 0 (**control**) |
| `/admin/dashboard` · owner · 414 | `counts.outOfBounds` | 3 → 3 (**guard**, edit cannot fire below 768) |
| `/admin/dashboard` · owner · 768 | **manual keyboard check** — Tab to each of the 5 links; the focus ring must be fully drawn on all four sides and focusing the last link must scroll the strip, not the page | catches a dropped `py-1 -my-1` |

**How to undo** · Delete the five added tokens from `:282`. That is the whole revert. ⛔ Leave
`.admin-nav-scrollbar` in `globals.css:238-247` alone — it pre-existed this change.
⛔ **Do not revert this after Stage 5 has shipped**: it would re-create a 913.75px header inside a
now-scrolling page, giving all 32 pages a horizontal scrollbar and a visibly detaching sticky header.

---

### FIX 2 — CAUSE-04 · Phone navigation labels at 11px

**Cause** · `src/app/admin/components/AdminTopNav.tsx:662` (and its byte-identical twin at `:696`)
```
"relative flex flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium …"
```
**CSS responsible:** `font-size: 11px` with `line-height: 11px` (no leading at all) from the
`.admin-tab-label` rule at `:253-257`.

**Symptoms resolved** · **4,558 rows** · all 32 pages · 8 of 8 areas · **all 4 roles** · 320/375/414.

**The precise change** · One file, two class strings, four token swaps. In both `:662` and `:696`:
replace `text-[11px]` with `text-xs` (12px) **and** replace `px-1` with `px-0.5`. Recommended in the
same edit: delete `leading-none` from the label spans at `:682` and `:719` so the label inherits real
line spacing (20px icon + 4px gap + 16px label = 40px inside a 56px bar, so no height change).

⛔ **The padding swap is not cosmetic — it is what makes the font bump safe.** Arithmetic from measured
rectangles on the worst cell (coordinator, `/admin/staff`, 320px): six labels total **247.96px**; plus
6 × 8px padding = 295.96px of a 320px bar, slack **24.04px**. Scale the glyphs by 12/11 and it becomes
270.50 + 48 = **318.50px**, slack **1.50px** — inside its own error bar, on a bar whose overflow the
mask would *delete*, and the casualty would be the "More" tab, which is the only phone route to
Settings, Reports, Audit, notifications and Sign out. Dropping the padding to `px-0.5` recovers 24px:
270.50 + 24 = 294.50px, slack **25.50px** — the same headroom as today.
⛔ Do not add `min-w-0` to the tabs instead: it would ellipsise "Dashboard" at 320px, which is worse
than 11px. Do not touch `:549`, `:712` or `:839` — different elements, different causes.

**Blast radius** · Enumeration **COMPLETE**. 12 usages. `.admin-tab-label` appears exactly 3 times in
all of `src/`, all in this file, and in **no** CSS file. `text-[11px]` appears 31 times in `src/`; only
these two are this cause. `md:hidden` at `:648` bounds the change to widths below 768.
⚠️ **One configuration was never rendered:** a therapist who *does* hold availability access gets a
fifth tab, "My availability" — the longest label in the nav. `Test Therapist` lacks that access, so
that bar appeared in **0 of 640 cells**. Estimated at ~99.5px at 12px, giving ~311.7px for five tabs;
it fits 320px, comfortably with `px-0.5`, **but it is the only projected number in this plan.**

**Risk · MEDIUM (2)** · Not LOW because the fit margin is the problem and the 1.50px figure is a
projection, not a re-measurement. Not HIGH because usage is completely enumerated, no CSS file or
token is touched, and the bar is `display: none` above 767px.
**1280:** ⛔ untouched — the tab bar does not exist there. **Public site:** not affected.

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| whole digest | `text-under-12px` rows matching `admin-tab-label` | **4,558 → 0** |
| whole digest | all `text-under-12px` rows | 19,752 → 15,194 (must fall by exactly 4,558, no more) |
| `/admin/staff` · coordinator · 320 | `counts.smallText` | 14 → 8 |
| `/admin/staff` · coordinator · 320 | max `rectRight` across the six labels — **geometry guard** | 308.06 → **<320** (projected ~304) |
| `/admin/dashboard` · owner · 320 and 414 | `counts.smallText` | 18 → 12 |
| `/admin/dashboard` · therapist_a · 375 | `counts.smallText` | 12 → 8 |
| `/admin/dashboard` · owner · **768** | `counts.smallText` / `counts.outOfBounds` | 12 → 12 · 19 → 19 (**guard**) |
| `/admin/dashboard` · owner · **1280** | `counts.smallText` / `counts.outOfBounds` | 13 → 13 · 0 → 0 (**guard**) |
| new capture required | five-tab therapist bar at 320 | must total <320px including padding |

**How to undo** · Revert exactly four tokens (and re-add `leading-none` if it was removed). Nothing
else. No CSS file, token, breakpoint, migration or build flag is involved.

---

### FIX 3 — CAUSE-05 · The bottom tab bar paints over whatever is under it

**Cause** · `src/app/admin/components/AdminTopNav.tsx:648`
```
className="admin-bottom-tabbar fixed inset-x-0 bottom-0 z-40 border-t … md:hidden"
```
**CSS responsible:** `position: fixed; bottom: 0; z-index: 40` — a 57px opaque band pinned over the
page. ⛔ **Not** the `md:hidden` on the same line, which belongs to CAUSE-01.

**Symptoms resolved** · **1,930 rows** · 30 pages · 8 of 8 areas · **all 4 roles** · 320/375/414.
Split: 1,221 covered-by-fixed-or-sticky, 219 controls painted over at rest, 490 painted over while
scrolled. Every one confirmed with `elementFromPoint` at the control's centre returning a bottom-tab
link.

**The precise change** · A padding-only fix is **not sufficient and must be rejected**: 872 of the
1,930 rows are at scroll position 0 and 490 are mid-document, and a `fixed` bar paints over whatever
occupies the bottom 57px at **any** scroll offset. The band must stop being part of the scrolling area.

Four lines, all in `AdminTopNav.tsx`, all gated below `md` so 768px and above is untouched:

1. `:204` — make the shell a phone-only full-height column: add `flex h-[100dvh] flex-col md:block md:h-auto`. Keep `overflow-x-hidden` exactly as it is (that belongs to CAUSE-02).
2. `:344-346` — make `<main id="admin-main">` the phone scroll container: add `min-h-0 flex-1 overflow-y-auto overscroll-contain md:min-h-0 md:flex-none md:overflow-visible`, and ⛔ **pin `[overflow-x:clip]` explicitly — as a deliberately temporary token that belongs to Stage 5 and must be handed straight to it.** It is load-bearing *while the mask is still up*: `overflow-y: auto` with `overflow-x: visible` forces x to `auto`, which would turn `main` into a horizontal scroller and silently lift part of the mask across every admin page below 768 — out of sequence, on a Stage 1 commit, where nobody could attribute the change to it. `clip` is the one x-value that pairs with `auto` on y without that coercion.
   ⛔ **But it is a clip, and this plan does not get to leave it there.** The current source at `:344-346` carries **no `overflow-x` rule of any kind**, so this token does not exist today — this edit creates it. Once Stage 5 deletes the three original `overflow-x: hidden` declarations, this one would be the last one standing and would become **the new nearest clipping ancestor at every width below 768px**. Counted, not estimated: **1,988** of the 7,718 `NO scrollable ancestor — unreachable` rows are below 768px (320 = 968, 375 = 516, 414 = 504), and **1,280 of those sit inside `main#admin-main`** and would stay exactly as unreachable as they are today. **Stage 5 therefore carries a fourth edit that turns this token into `[overflow-x:auto]` — see FIX 20, Edit 4.** ⛔ **FIX 3 and that fourth edit are one obligation split across two stages. Do not ship FIX 3 without booking it.**
3. `:346` — delete the old end-of-document padding `pb-[calc(3.5rem+1.5rem+env(safe-area-inset-bottom,0px))]`, replace with a plain `pb-6`; also delete the now-dead landscape twin at `:256`.
4. `:648` — replace `fixed inset-x-0 bottom-0 z-40` with `relative z-40 shrink-0`. Keep `md:hidden` untouched (CAUSE-01 owns that string), keep the border and background, keep the inline safe-area padding at `:649`.

⛔ **Five knock-on edits are mandatory in the same commit**, because the change moves the scroll
container out from under running JavaScript, and all five fail **silently**:

| File : line | Today | Must become |
|---|---|---|
| `PullToRefresh.tsx:75` and `:86` | `window.scrollY > 0` | read `#admin-main`'s scroll offset (keep `window.scrollY` as the desktop fallback) — otherwise pull-to-refresh fires mid-list on all three dashboards |
| `ManualBookingForm.tsx:1134`, `:1141`, `:2455` | `window.scrollTo({top:0})` | scroll `#admin-main` — otherwise every step change on `/admin/bookings/new` leaves the user mid-form |
| `ClientCreateForm.tsx:456` | `sticky bottom-14` | `sticky bottom-0` — otherwise its save bar floats in a 56px gap |
| `ClientEditForm.tsx:307` | `sticky bottom-14` | `sticky bottom-0` — same |

**Explicitly NOT part of this change:** `TemplateEditor.tsx:389` and `SettingsForm.tsx:432` stay as they
are (`fixed` still resolves against the screen). `PerformanceSurface.tsx:548` and
`MobileStickyActionBar.tsx:27` are separate causes this change neither fixes nor worsens.

**Blast radius** · Enumeration **COMPLETE**. 31 usages. `admin-bottom-tabbar` appears exactly twice in
`src/`, both in this file. No unit test pins these selectors.
⚠️ **Hazard:** `PerformanceSurface.tsx:130` renders a **second, nested** element with `id="admin-main"`
(and there are two more, at `TherapistDashboard.tsx:381` and `PasswordResetCard.tsx:44`), so any
`getElementById('admin-main')` in the knock-on edits resolves to the **outer** one on `/admin/me` and
`/admin/staff/[id]/performance`. That pair of pages needs its own eyes.

**Risk · HIGH (4)** · Usage *is* fully enumerated, so this is not an unknown-usage HIGH. It is HIGH
because (a) the edited lines are in the single layout wrapping **every** `/admin/*` route with no
per-page opt-out, (b) it moves the scroll container, which CSS review cannot catch and which breaks
five JavaScript call sites silently with no failing test, and (c) the `[overflow-x:clip]` token is one
word between preserving the mask and partially lifting it across the whole mobile admin — **and the
same one word quietly becomes the mask itself if Stage 5 ships without its fourth edit.**
Secondary: `100dvh` is known to jump as the iOS URL bar collapses — new visual behaviour on every
admin page that these artefacts cannot measure.
**1280:** ⛔ **No.** The bar is `display: none` at ≥768px and contributes 0 rows at 768 and 1280. Every
clause is paired with an `md:` reset. ⚠️ **If any single `md:` reset is omitted at implementation
time, 1280 clips the whole page to one screen height** — the verification below catches it.
**Public site:** not affected.

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| `/admin/privacy` · owner · 320 | `counts.obscuredInteractive` | **2 → 0** |
| `/admin/privacy` · owner · 320 | `counts.pinnedOccluding` / `counts.pinned` | 1 → 0 · 2 → 1 |
| `/admin/privacy` · admin · 414 | `counts.obscuredInteractive` | 1 → 0 |
| `/admin/reports` · coordinator · 320 | `counts.obscuredInteractive` (worst overlap, 21,774px² at 414) | 2 → 0 |
| 30 pages × 4 roles × 320/375/414 | the cause's own awk | **1,930 → 0** |
| `/admin/privacy` · owner · 320 | **mask guard** — `counts.horizontalScrollers` | 15 → 15 (a rise means `[overflow-x:clip]` was dropped) — ⛔ **this guard is retired at Stage 5**, where that token deliberately becomes a scroller |
| `/admin/reports` · coordinator · **768** | `counts.outOfBounds` | 19 → 19 (**guard**) |
| `/admin/dashboard` · owner · **1280** | `counts.outOfBounds` | 0 → 0 (**guard**) |

**How to undo** · `git revert` of the single commit. ⛔ **The five knock-on edits must be reverted in
the same operation, never separately** — reverting the shell alone leaves PullToRefresh polling an
element that no longer scrolls and two save bars overlapping the restored fixed bar.
⛔ **And if Stage 5 has already run**, its fourth edit (`[overflow-x:clip]` → `[overflow-x:auto]` on
`:346`) must be reverted in the same operation too — it only makes sense on top of this one.

---

### FIX 4 — CAUSE-06 · The notification bell's hidden filter chips

**Cause** · `src/app/admin/components/notification-bell.tsx:631`
```
"flex gap-1 overflow-x-auto border-b border-[var(--admin-border)] px-5 py-2.5",
```
**CSS responsible:** `overflow-x: auto` with non-wrapping, non-shrinking chips (`shrink-0` at `:645`)
in a 262px box holding 434px of chips — and no fade, arrow, scrollbar or partial-chip peek to say the
row scrolls.

**Symptoms resolved** · **1,389 rows** · all 32 pages · 8 of 8 areas · all 4 roles · 320/375/414.
Measured: 434 vs 262 at 320 (**172px hidden**), 434 vs 317 at 375 (117px), 434 vs 356 at 414 (78px).
"Archived" sits **126.86px** past the panel edge at 320; "Snoozed" 43.5px.

**The precise change** · One class expression, `notification-bell.tsx:630-633`. Split the current
`cn("flex gap-1 overflow-x-auto … px-5 py-2.5", isMobile && "px-4")` into three parts: a base of
`"flex gap-1 border-b … px-5 py-2.5"` (with `overflow-x-auto` **removed** from the base), then
`!isMobile && "overflow-x-auto"`, then `isMobile && "flex-wrap px-4"`. The desktop branch emits
exactly the same utilities as today; the phone branch swaps a silent side-scroller for a wrapping
strip.
**Why wrapping and not a fade/arrow:** an affordance-only fix leaves the chips physically off-screen,
so 382 off-right-edge, 374 clipped and 64 painted-over rows all survive. Only wrapping zeroes all four
kinds. It is also the pattern this very component already uses one element below (`:673` is
`mt-2 flex flex-wrap gap-1.5`). Geometry at 320: content box 230px; line 1 takes All + Unread +
Critical (~205px), line 2 takes Snoozed + Archived (~161px); strip height ~88px inside a sheet already
capped at 85% of the screen.
⛔ **Do not "fix" this by deleting the `overflow-x-hidden` at `admin-ui-interactions.tsx:188`** — that
is the sheet's own clip, and removing it spills the chips onto the backdrop, which is strictly worse.

**Blast radius** · Enumeration **COMPLETE**. 14 usages. One import (`AdminTopNav.tsx:29`), two call
sites (`:321` desktop, `:335` mobile). The change is gated on `isMobile`, which is only ever true from
the mobile button inside `md:hidden` — so widths ≥768 execute an identical string. No CSS rule
anywhere matches this element. Zero test assertions.
⛔ **Do not sweep in `staff/[staffId]/page.tsx:488`** — the only other `flex gap-1 overflow-x-auto` in
`src/`, a different element with its own cause.

**Risk · LOW (1)** · One element, one component, two call sites, one mount, zero CSS selectors, zero
public exposure, zero test assertions. If the wrap is wrong the failure is cosmetic and instantly
visible (a taller strip), not functional.
**1280:** ⛔ No — the mobile branch is structurally unreachable there. ⚠️ **Limit of the evidence,
stated plainly:** the capture recorded **0 open menus at all 128 cells at 1280**, so the 1280 claim
rests on the structural argument plus the 768 desktop measurement, not on a 1280 capture.
**Public site:** not affected.

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| `/admin/dashboard` · owner · 320 | bell menu `counts.outOfBounds` | 5 → 3 |
| `/admin/dashboard` · owner · 320 | bell menu `counts.clipped` | 6 → 4 |
| `/admin/dashboard` · owner · 320 | bell menu `counts.horizontalScrollers` | 12 → 11 (scrollWidth must equal clientWidth, 262) |
| `/admin/dashboard` · owner · 414 | bell menu `counts.obscuredInteractive` — the Archived chip, 100% of its centre covered | 22 → 21 |
| `/admin/settings` · admin · 375 | bell menu `counts.outOfBounds` — cleanest pass/fail | **1 → 0** |
| `/admin/dashboard` · therapist_a · 320 | bell menu `counts.outOfBounds` | 1 → 0 |
| `/admin/dashboard` · owner · **768** | desktop popover strip width 446, `counts.outOfBounds` | 66 → 66 (**guard** — must NOT improve) |
| `/admin/dashboard` · owner · **1280** | `counts.horizontalScrollers` | 0 → 0 (**guard**; ⛔ requires a re-capture that actually opens the bell at 1280) |

**How to undo** · Revert the one class expression. Standalone, no dependants.

---

### FIX 5 — CAUSE-07 · The Email page is 125px wider than a 320px phone

**Cause** · `src/app/admin/emails/page.tsx:392` (the quoted line) — but ⚠️ **the edit belongs at
`:325`**, its page-root container:
```
<div className="grid gap-6 pb-24 sm:pb-0">
```
**CSS responsible:** a grid with no column template, so its single invisible column grows to the
widest child. Measured **412.94px** inside a 288px box at owner/320.

**Symptoms resolved** · **1,074 rows** · `/admin/emails` · 320/375/414 · **all 4 roles** (⚠️ the cause
record lists only three; the digest shows `therapist_a` shares the defect at 320 with 12
out-of-bounds, so the fix changes 4 roles).

**The precise change** · One class, one line: `:325` becomes
`className="grid grid-cols-[minmax(0,1fr)] gap-6 pb-24 sm:pb-0"`, with a short comment in the style of
`clients/page.tsx:331-336`. Leave `:389` and `:392` exactly as written — the scroller is correct and
only ever inherited a blown-out parent.
**Rejected as narrower:** adding `min-w-0` to the nav at `:389` also works *today*, but all 20 captured
cells rendered an **empty** delivery feed, so a populated table is unmeasured and could re-blow the
column. The cap holds whatever turns out to be widest.

**Blast radius** · Enumeration **COMPLETE**. 13 usages. `TabStrip` is file-local and never exported.
`min-w-full` appears twice in all of `src/`. The literal class string `grid gap-6 pb-24` appears in 5
files, but an inline edit here cannot reach the other four. No importers, no CSS, no tests.

**Risk · LOW (1)** · One class literal in a route module with no importers. The identical edit already
ships one directory away at `clients/page.tsx:338` and measures a 288px column at 320 and 0
out-of-bounds at 1280 **in the same audit run**.
**1280:** ⛔ No — `counts.outOfBounds` is already 0 and the cap is arithmetically a no-op there.
**Public site:** not affected.
⚠️ The visual change below 640px is deliberate and large: the shell shrinks 412.94 → 288 and the pill
row becomes a real swipe strip. Any screenshot baseline for `/admin/emails` needs re-approving.

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| `/admin/emails` · owner · 320 | page-root column `rect.width` — **primary, exact** | **412.94 → 288** |
| `/admin/emails` · owner · 320 | `rect.right` of `nav[aria-label="Email sections"]` | 444.94 → 320 |
| `/admin/emails` · owner · 320 | `counts.outOfBounds` | 32 → 6 (survivors must all be tab pills inside the on-screen scroller) |
| `/admin/emails` · owner · 375 and 414 | `counts.outOfBounds` | 13 → 3 |
| `/admin/emails` · admin / coordinator · 320 | `counts.outOfBounds` | 32 → 6 |
| `/admin/emails` · therapist_a · 320 | `counts.outOfBounds`; column 318 → 288 | 12 → 3 |
| `/admin/emails` · therapist_a · **375** | `counts.outOfBounds` | 2 → 2 (**control** — already fits, cap is a no-op) |
| `/admin/emails` · owner · **768** | `counts.outOfBounds` | 19 → 19 (**guard**) |
| `/admin/emails` · owner · **1280** | `counts.outOfBounds` / `horizontalScrollers` | 0 → 0 · 5 → 5 (**guard**) |
| digest-wide | the cause's own awk | 1,074 → **254** (the survivors are tab pills now inside an on-screen swipeable scroller) |

**How to undo** · Delete the one added class. Independent of everything.

---

### FIX 6 — CAUSE-08 · The Enquiries tabs stretch the whole page off the phone

**Cause** · `src/app/admin/enquiries/page.tsx:324` (the quoted line) — ⚠️ **the edit belongs six lines
up, at `:318`**:
```
<main className="min-w-0 grid gap-4 lg:max-w-[64rem]">
```
**CSS responsible:** a grid with no column template. Measured column **448.52px** inside a 288px box.

**Symptoms resolved** · **819 rows** · `/admin/enquiries` · 320/375/414 · owner, admin, coordinator
(`therapist_a` is hard-denied the page).

**The precise change** · ⛔ **DO NOT delete `min-w-max` at `:324` — the cause is mis-attributed and
deleting it makes things worse.** Measured: the tab list is 454.17px while its scroller's content box
is 448.52px, so it overflows its own scroller by just **5.65px**, and the scroller contains it. Its
contribution to the page shell's 165px overflow is exactly **0px**. Removing `min-w-max` would collapse
the list so that it stops scrolling at all, and the five tabs are `whitespace-nowrap` inside items with
min-width 0 and no ellipsis — the labels would squeeze and overlap with no way to reach them.

**The one sufficient edit:** at `:318` add `grid-cols-[minmax(0,1fr)]`. That pins the column to
`main`'s own 288px. The tab strip's scroller then becomes a genuine 288px window holding 454.17px of
tabs — **166px of real, swipeable scroll** — which is exactly what the fade at `:322` was written to
suggest and currently lies about. Leave `:322` and `:324` untouched. This is the identical remedy
already applied and documented in this repo at `clients/page.tsx:331-338`.

**Blast radius** · Enumeration **COMPLETE**. 11 usages. `min-w-max` appears exactly 3 times in `src/`:
here, `staff/[staffId]/availability/page.tsx:378`, and ⛔ `components/reviews/ReviewFilters.tsx:43`
**which is on the public site** — untouched by this edit, but the reason a global remedy must not be
used. Zero tests reference the class.

**Risk · MEDIUM (2)** · The edit itself is LOW. It is MEDIUM for what the cap **exposes**: about 160px
of column width the runaway grid was silently granting to the enquiry cards disappears, and whatever
inside those cards demanded 448.52px must re-flow inside 288px. Part of that is identified —
`EnquiryList.tsx:282` carries 40px of browser-default indent because Tailwind's reset is deliberately
not loaded (`globals.css:6`, rationale at `:11-32`) — but the rest sits inside the card bodies and no
stored measurement can predict a post-relayout geometry. Second reason: the decision-maker must accept
a **relocated** edit, not the one the cause record hands them.
**1280:** ⛔ No — the column already equals the container (`clientWidth` 812 / `scrollWidth` 816, and
the 4px is a negative margin, not the tabs). **Public site:** not affected by this edit; ⛔ a global
remedy **would** cross into it.

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| `/admin/enquiries` · owner · 320 | `main.min-w-0.grid.gap-4` scrollWidth (clientWidth stays 288) | **453 → 288** |
| `/admin/enquiries` · owner · 320 | `main#admin-main` scrollWidth | 469 → 320 |
| `/admin/enquiries` · owner · 320 | the tab nav's clientWidth — 5px of fake scroll becomes 174px of real scroll | 457 → 288 |
| `/admin/enquiries` · owner · 320 | `counts.outOfBounds` | **98 → 7** |
| `/admin/enquiries` · admin · 375 | `counts.outOfBounds` | 74 → 7 |
| `/admin/enquiries` · coordinator · 414 | `counts.outOfBounds` | 71 → 7 |
| digest-wide | the cause's own awk | 819 → **144** (only rows inside the tab nav may survive, and all must read "ancestor CAN scroll to it") |
| `/admin/enquiries` · owner · **768** | `counts.outOfBounds` | 19 → 19 (**guard**) |
| `/admin/enquiries` · owner · **1280** | `counts.outOfBounds` | 0 → 0 (**guard**) |

**How to undo** · Delete the one added class from `:318`.
**Follow-up to queue, not to fold in:** `EnquiryList.tsx:282`'s stray 40px indent. ⛔ Fix it locally on
that element; do **not** restore Tailwind's global reset — `globals.css:11-32` documents that
`site-parity.css` depends on browser defaults surviving, and that change would cross into the public
site.

---

### FIX 7 — CAUSE-09 · The client list is drawn nearly twice the width of the phone

**Cause** · `src/app/admin/clients/page.tsx:641`
```
<div className="grid gap-6">
```
plus the two lists it wraps at `:656` and `:670` (`<ul className="grid list-none gap-1.5 p-0">`).
**CSS responsible:** a grid with no column template. Captured verbatim:
`gridTemplateColumns: 531.797px` (owner and admin) / `475.797px` (coordinator, 56px narrower because
they cannot delete clients) inside a 288px box.

**Symptoms resolved** · **756 rows** · `/admin/clients` · 320/375/414 · owner, admin, coordinator.
Rows land **227.8px** past the viewport at 320, 172.8 at 375, 133.8 at 414.

**The precise change** · Three string edits in one file, copying the pattern the page's own parent at
`:338` already uses (with an explanatory comment already written at `:331-336`):
- `:641` → `className="grid grid-cols-[minmax(0,1fr)] gap-6"`
- `:656` → `className="grid grid-cols-[minmax(0,1fr)] list-none gap-1.5 p-0"`
- `:670` → identical change, for the "last visit" sort branch.

⛔ **State this plainly to whoever signs it off:** the cap fixes the overflow but does **not** make the
row good. Arithmetic from captured rectangles — 288 box − 24 padding − 44 checkbox − 32 avatar − 68.92
badge (which refuses to shrink) − 44 menu button − 48 of gaps leaves **27.1px** for the client's name
at 320px (82.1px at 375, 121.1px at 414). Every counter goes to zero while the name becomes about two
characters and an ellipsis. Making the row genuinely usable needs a **second, separate** change to
`:1121` / `:1179` (wrap the row, or drop the badge and the "new booking" affordance on phones).

**Blast radius** · Enumeration **COMPLETE**. 26 usages, of which 15 are other files that merely share
the same class *string* and cannot be reached by an inline edit. `ClientRow` is file-local, called only
at `:658` and `:672`. The page has zero importers.
⚠️ **`:670` is edited blind.** The default sort is "name" (`clients-list-data.ts:421`), so all 45
captured clients cells took the `:641`/`:656` branch and `:670` has **literally zero measured rows**,
before or after. It is structurally identical, but that is inference.

**Risk · MEDIUM (2)** · Blast radius is small and fully enumerated — that alone would be LOW. It is
MEDIUM for two things the digest cannot see: (1) it introduces a new, real defect no counter tracks
(the 27.1px name), so the page will score perfectly while the primary content of every row becomes
unreadable; (2) `:670` is unmeasured.
**1280:** ⛔ No — 0 out-of-bounds and 0 grid-attributed rows there today, and a capped column and an
uncapped one resolve identically whenever the content fits. **Public site:** not affected.

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| `/admin/clients` · owner · 320 | the cause's own awk for this cell | 84 → 0 |
| `/admin/clients` · owner · 320 | `counts.outOfBounds` | **255 → 0** |
| `/admin/clients` · owner · 320 | captured `gridTemplateColumns` on the list | **531.797 → 288** |
| `/admin/clients` · coordinator · 320 | captured `gridTemplateColumns` (verify separately — theirs is 56px narrower) | 475.797 → 288 |
| `/admin/clients` · admin · 375 / owner · 414 / coordinator · 375 | `counts.outOfBounds` | 255 → 0 · 209 → 0 · 162 → 0 |
| `/admin/clients` · owner · **768** | `counts.outOfBounds` | 19 → 19 (**guard** — all 19 are nav rail, zero are list items) |
| `/admin/clients` · owner · **1280** | `counts.outOfBounds` / `clipped` | 0 → 0 (**guard**) |
| `/admin/clients` · therapist_a · 320 | `counts.outOfBounds`; h1 must stay "You don't have access to this section" | 0 → 0 (**guard**) |
| ⛔ **new measurement required** | re-run the row-menu probe: menu right edge, `pctVisible`, `centreHittable` | 485 → ~312 · 43.1% → 100% · false → true (**predicted, not measured**) |
| ⛔ **new measurement required** | width of the name block at 320 — **the cost, not a success criterion** | 270.88 → **27.1** |

**How to undo** · Revert the three class strings. ⛔ **Never revert this while the mask is lifted** —
it would restore a 531.797px row inside a 288px box with nothing clipping it, giving `/admin/clients` a
live horizontal scrollbar.

---

### FIX 8 — CAUSE-14 · One staff email address widens the whole staff profile

**Cause** · `src/app/admin/staff/[staffId]/page.tsx:352`
```
<div className="grid gap-6 pb-24 lg:pb-0">
```
**CSS responsible:** a grid with no column template. Captured verbatim:
`gridTemplateColumns: 352.375px` inside a 288px box. The driver is the email link that opens at
`:404` — its `href` is on `:405` and its `className` on `:406` — whose
text measured verbatim is `test.therapist@rahmatherapy.example.test` — **40 characters, 290.375px**,
one unbreakable word, with `word-break: normal`.

**Symptoms resolved** · **295 rows** (⚠️ see the counting correction in section 1) · `/admin/staff/[id]`
· 320/375/414 · owner, admin **and therapist_a** (⚠️ the cause record omits therapist_a, who measures
**100** out-of-bounds at 320; coordinator measures 4 at every width because they cannot see contact
fields). Worst single element: the Profile / Availability / Performance tab strip at **52.38px** past
the right edge — so the navigation between a staff member's three screens is the first thing lost.

**The precise change** · Two one-line edits, both in this file. **Both are needed.**
- **Edit A (the load-bearing one), `:406`** — ⛔ that is the link's **`className`** line; the `<a>`
  opens at `:404` and `:405` is its `href`, so `:405` is the wrong line to edit: add
  `min-w-0 break-all` to the email link. This collapses
  a 290.375px unbreakable word down to one character's worth of minimum, removing the floor that sets
  the whole column.
- **Edit B (the structural cap), `:352`:** add `grid-cols-[minmax(0,1fr)]`, matching
  `clients/page.tsx:338` and `BusinessDashboard.tsx:254`.

**Why neither alone:** Edit B alone is **insufficient** — it caps the column, but a grid item still
renders at its own minimum and overflows the column, so the whole header chain (352.38 / 352.38 /
296.38 / 296.38 / 290.38) stays outside; **126 of the 295 rows** are inside that chain, so ~43% would
survive. Edit A alone probably clears it today, but that is a bet on the current data.

⛔ **Do not bundle:** leave `pb-24 lg:pb-0` alone (that is bottom clearance for the tab bar, CAUSE-05's
territory), leave the `-mx-1` at `:488` alone (its 4px shows at every width including 1280 and is not
part of this cause), and do not convert the page to the shared scaffold.

**Blast radius** · Enumeration **COMPLETE**. 18 usages. The class string appears exactly once
repo-wide; only 4 stylesheets exist in `src/` and none can match this element; zero importers; zero
tests coupled to the structure; the 12 e2e specs that visit this route navigate by URL and assert on
text and roles.
⚠️ **Coverage note:** via `|| isOwnProfile` at `:175`, a coordinator viewing **their own** profile takes
the same path as owner/admin. The capture never exercised it — all four roles hit the same non-self
staff id — so the real affected population is all four roles.

**Risk · LOW (1)** · One element plus one link in one admin-only route file. The two working widths are
provably untouched rather than merely observed untouched: a capped and an uncapped column are
identical whenever the content minimum (measured 352.375px) is below the space available (measured
720px at 768, 1216px at 1280). The direction of change is monotonic — capping a column and letting a
string wrap can only reduce out-of-bounds geometry.
⚠️ Cosmetic residual: `break-all` splits the address mid-word on narrow phones.
**1280:** ⛔ No — 0 out-of-bounds and 0 clipped today, and the inner grid at `:516` is already capped at
exactly 1280. **Public site:** not affected.

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| `/admin/staff/[id]` · owner · 320 | `counts.outOfBounds` / `counts.clipped` | **473 → 0** · 475 → 0 |
| `/admin/staff/[id]` · admin · 320 | `counts.outOfBounds` | 151 → 0 |
| `/admin/staff/[id]` · therapist_a · 320 | `counts.outOfBounds` | 100 → 0 |
| `/admin/staff/[id]` · owner · 320 | captured `gridTemplateColumns` — the number that proves the mechanism is gone | **352.375 → 288** |
| `/admin/staff/[id]` · owner · 320 | the page-root grid's measured overflow | 68 → **4** (must land on 4, not 0 — the residual 4 is the `-mx-1` at `:488`, out of scope) |
| `/admin/staff/[id]` · owner · 320 | the tab strip's distance past the right edge | 52.38 → 0 |
| `/admin/staff/[id]` · owner · 320 | width of the email link | 290.38 → ≤232 |
| `/admin/staff/[id]` · coordinator · 320 | `counts.outOfBounds` | 0 → 0 (**control** — no email rendered) |
| `/admin/staff/[id]` · owner · **768** / **1280** | `counts.outOfBounds` | 19 → 19 · 0 → 0 (**guards**) |
| `/admin/staff/[id]/performance` · owner · 768 | `counts.outOfBounds` | 19 → 19 (**control** — identical 19 proves it is the shell, not this page) |

**How to undo** · Restore the two class strings. Nothing else.

---

### FIX 9 — CAUSE-17 · The Operations board is 61px wider than a 320px phone

**Cause** · `src/app/admin/operations/operations-board.tsx:254` (the quoted line) — ⚠️ **the edit
belongs at `:250`**, its parent:
```
<div className="mb-4 xl:hidden">
```
**CSS responsible:** the status tab strip at `:254` is `inline-flex` with `w-full`, an inline box with
a circular percentage width, so it hands its **content** width to the page's column. Measured strip
**348.72px** at 320 (16 → 364.72), which matches the three buttons' 330.72px plus 18px of chrome
exactly.

**Symptoms resolved** · **226 rows** · `/admin/operations` · owner and admin (coordinator and
therapist_a get an access-denied page). ⚠️ The cause record lists coordinator and width 414; its own
awk attributes **0** rows to either. The real split is 113 owner + 113 admin, **210 at 320 and 16 at
375**.

**The precise change** · One Tailwind utility: `:250` becomes `className="mb-4 min-w-0 xl:hidden"`.
That div is the page's grid item; releasing its automatic minimum lets the column clamp to the
available 288px, the strip's `w-full` then resolves against a real 288px, and the `overflow-x-auto`
**already on `:254`** finally becomes a live scroller (today it is inert because the box is not
narrower than its content).
**Why not `:254`:** swapping `w-full` for `min-w-0 max-w-full` also works, but it makes the strip
shrink-to-fit — at 414 it would render 348.72px inside a 382px column instead of full width, a visible
cosmetic regression on a width that currently has zero defects.
**Deliberately out of scope:** the third tab will now need a small sideways swipe at 320 (~43px hidden).
Making the tabs wrap instead changes the control's shape at every width below 1280 and is a design
decision, not the minimum fix.

**Blast radius** · Enumeration **COMPLETE**. 16 usages. One definition, one import, one render site,
one route. `inline-flex w-full` appears at 7 sites; the full class string of `:254` is unique. No
stylesheet targets the element; the component's own test file has zero class or snapshot assertions.

**Risk · LOW (1)** · Bounded and enumerated; the edited subtree is `display: none` at ≥1280; the change
is additive and its effect on column sizing is monotonic (it can only shrink a minimum, never grow
one).
⚠️ Three honest caveats: (a) effectiveness is **predicted** from the measured geometry and the
same-run precedent at `dashboard-filters-client.tsx:342`, not directly observed, because no browser was
run; (b) once the column drops to 288, the "safe context" chips in `event-row.tsx:234` can reach ~306px
— they were never measured because their disclosure was closed in every captured frame, so a small
new ~18px overflow could appear against today's 61px; (c) the cause record overstates its own coverage.
**1280:** ⛔ No — the whole wrapper is `xl:hidden`, so it is not even laid out there.
**Public site:** not affected.

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| `/admin/operations` · owner · 320 | `counts.outOfBounds` / `counts.clipped` | **91 → 0** each |
| `/admin/operations` · owner · 320 | the page column's hidden width (349 vs 288) | 61 → 0 |
| `/admin/operations` · owner · 320 | `main#admin-main` hidden width (365 vs 320) | 45 → 0 |
| `/admin/operations` · owner · 320 | the tab strip's `rect.w` | 348.72 → 288 |
| `/admin/operations` · owner · 320 | ⛔ **positive check** — a NEW scroller entry for the strip, clientWidth 288 / scrollWidth ~331. **If it does not appear, the tabs are still unreachable and the fix has not worked.** | absent → present |
| `/admin/operations` · admin · 320 | `counts.outOfBounds` / `clipped` | 91 → 0 |
| `/admin/operations` · owner + admin · 375 | column hidden width | 6 → 0 |
| digest-wide | the cause's own awk | 226 → 0 |
| `/admin/operations` · owner · **1280** / **768** / **414** | `counts.outOfBounds` | 0 → 0 · 19 → 19 · 0 → 0 (**guards**) |
| `/admin/operations` · coordinator · 320 | `counts.outOfBounds` | 0 → 0 (**guard** — refusal page) |

**How to undo** · Delete the added `min-w-0`.

---

### FIX 10 — CAUSE-18 · The staff directory's health chips are 32px too wide

**Cause** · `src/app/admin/staff/page.tsx:399`
```
<div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 lg:flex lg:flex-wrap lg:items-center">
```
**CSS responsible:** two fixed columns of non-shrinking chips. Captured
`gridTemplateColumns: 143.953px 143.969px`, so the pair floors at **293.92px**; add the card's padding
and border and the section floors at **319.922px** against a 288px box.

**Symptoms resolved** · **212 rows** · `/admin/staff` · **320 only** · owner and admin (the strip is
gated to admin scope at `:376`).

**The precise change** · One line: `:399` becomes
`grid min-w-0 flex-1 grid-cols-1 min-[360px]:grid-cols-2 gap-1.5 lg:flex lg:flex-wrap lg:items-center`.
At 320 the four chips become a single column of 262px each (chip content ~178px, so still one line
apiece), the section floor drops from 319.922px to ~170px, the page column drops from 319.922px to
288px, and all nine dragged siblings come back inside the screen.
⛔ **Do not use `sm:grid-cols-2`** — that breakpoint is 640px, which would also re-stack 375 and 414,
both of which measure 0 out-of-bounds today.
**Alternative if a new arbitrary breakpoint is unwanted:** add `min-w-0` to the chip at `:718`.

**Blast radius** · Enumeration **COMPLETE**. 15 usages. The class string occurs once repo-wide.
`WorkloadSegment` is file-local with four call sites in the same file. Nothing in `src/` imports the
page module. No test or spec asserts on this markup.

**Risk · LOW (1)** · One page, two roles, one width. Confirmed by a clean control: coordinator on the
**same page at the same width**, differing only in that the strip is hidden, reads 0 / 0 / 5 against
owner's 29 / 29 / 9 — so this element is the **sole** intrinsic overflow driver on `/admin/staff` at
320.
⚠️ Two residuals: (a) the post-fix widths cannot be shown directly from any artefact because the mask
pins the overflow number at 0 — the 29 → 0 prediction rests on the coordinator control plus the stretch
analysis; (b) the strip gets ~60px taller at 320, which moves controls below it relative to the bottom
bar, so `counts.obscuredInteractive` may move to a neighbouring control. Do not read that as a
regression from this cause.
**1280:** ⛔ No — the container drops the grid entirely at 1024px, so the edited declaration is not in
effect there. **Public site:** not affected.

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| `/admin/staff` · owner · 320 | `counts.outOfBounds` / `counts.clipped` | **29 → 0** each |
| `/admin/staff` · owner · 320 | `counts.horizontalScrollers` (must land on coordinator's current 5) | 9 → 5 |
| `/admin/staff` · owner · 320 | `main#admin-main` scrollWidth | 336 → 320 |
| `/admin/staff` · owner · 320 | `rect.right` of the "Onboarding incomplete" chip | 322.92 → ≤291 |
| `/admin/staff` · admin · 320 | `counts.outOfBounds` / `clipped` / `horizontalScrollers` | 29 → 0 · 29 → 0 · 9 → 5 |
| digest-wide | the cause's own awk | 212 → 0 |
| `/admin/staff` · owner · **768** / **1280** / **375** / **414** | `counts.outOfBounds` | 19 → 19 · 0 → 0 · 0 → 0 · 0 → 0 (**guards**) |
| `/admin/staff` · coordinator · 320 | `counts.outOfBounds` | 0 → 0 (**control**) |

**How to undo** · Restore the one class string.

---

### FIX 11 — CAUSE-11 · The booking view switcher hides five of its seven views

**Cause** · `src/app/admin/bookings/BookingsChrome.tsx:337`
```
className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
```
**CSS responsible:** `overflow-x: auto` below 640px (which also turns this 48px strip into a scrolling
box) with non-shrinking, non-wrapping pills.

**Symptoms resolved** · **574 rows** · `/admin/bookings` · 320/375/414 · **all 4 roles**. Two failures
from one line:
1. **Silent side-scroller** — 626px of content in a 296px box at 320. "Upcoming" lands 99.75px past the
   edge, "Claimable" 232.05px (fully off screen), "More" **313.95px** (fully off screen), with only
   ~15px of "Upcoming" peeking.
2. **Clipped menu** — because the strip is now a scrolling box, it clips the popover it contains. The
   strip's box is 48px tall while the menu's items lay out 275px below it; **5 of 5 items are 100%
   covered at their centre point.** ⛔ Stacking order is irrelevant here: clipping happens before
   painting, which is why the check returned ordinary static page content that could never legally
   paint over the menu.

**In plain terms:** on a phone the booking list appears to offer only "Needs Attention" and "Today".
Tapping "More" — if you can reach it — appears to do nothing. The five views that exist only in the
overflow (Unassigned, Completed, Cancelled / No-show, All, Series) **cannot be opened at all.**

**The precise change** · ⛔ **Three edits, one commit. Internally atomic.**
- **`:337`** → `"relative flex flex-wrap items-center gap-1.5"`. Removes the scroll box, makes wrapping
  unconditional, drops the `-mx-1 px-1 pb-1` that only existed to serve the scroller (the negative and
  positive 4px cancel, so the first pill stays at x=16 exactly as measured today). Adds `relative` so
  the strip becomes the anchor for edit 3.
- **`:367`** → `"shrink-0 sm:relative"`, so below 640px the menu anchors to the strip, not the button.
- **`:395`** → add `left-0 … sm:left-auto`, so below 640px the menu spans the strip's full width (288px
  at 320, comfortably above its 208px minimum) and at 640px+ it reproduces today's anchoring exactly.

⛔ **Why edit 1 alone is not enough — arithmetic from the measured pill widths** (168.11 / 97.38 /
126.27 / 126.30 / 75.91, 6px gaps, 288px box): the strip wraps to three rows and "More" ends up alone
on row 3 with its right edge at 91.91. With today's anchoring the 208px menu would run from
**x = −116.09** to 91.91 — 116px off the **left** edge, a brand-new defect worse than nothing. At 375
the same strip fits "More" onto row 2 with **2.5px** of slack, so one two-digit count badge tips it
into the same failure.

**Blast radius** · Enumeration **COMPLETE**. 16 usages. One production import, one render site, one
route. `overflow-x-auto` appears 28 times in `src/`; the other 27 are unaffected because a utility is
removed from one element, not redefined. Exactly one test touches the nav
(`bookings-page-param.test.tsx:67`) and it queries by ARIA role and name, so it survives as long as the
menu stays a DOM descendant of the strip — which it does.
⛔ **Two look-alikes in the same file that must NOT be folded in:** `:441` (mobile saved-view strip) and
`:519` (active-filter chip row) share the same recipe. Neither rendered during the capture, so both are
entirely **unmeasured**. File them; do not silently change them on the same pass.

**Risk · MEDIUM (2)** · Not HIGH: one element, one component, one route, one ARIA-based test. Not LOW
because (a) it needs three coordinated edits and the obvious one-line version introduces a measured
116px left-edge overflow; (b) `/admin/bookings` is the busiest operational screen and all four roles
see it; (c) the strip visibly grows from 48px to ~150px at 320, pushing the list down — someone must
accept that; (d) widths 415–639px are entirely unmeasured.
**1280:** ⛔ No — the digest records the strip at 768 already computing as wrapped and non-scrolling, so
making that unconditional produces the identical computed style at 640px and above. **Public site:**
not affected.

**Verification** (all against a re-captured digest)

| Page × role × width | Number | From → to |
|---|---|---|
| `/admin/bookings` · owner · 320 | horizontal-scroller row on the strip (626 vs 296) | 1 → 0 |
| `/admin/bookings` · owner · 320 | base-state off-right-edge rows (all 9 are strip descendants) | 9 → 0 |
| `/admin/bookings` · owner · 320 | base-state clipped rows | 9 → 0 |
| `/admin/bookings` · owner · 320 | **the clipped menu** — rows where a "More" menu item is 100% covered at its centre | **8 → 0** |
| `/admin/bookings` · owner · 320 | ⛔ **new-defect guard** — menu or item rows with a left edge below 0. **Predicted 6 if edit 1 ships without edits 2 and 3.** | 0 → 0 |
| `/admin/bookings` · owner · 375 / 414 | base-state off-right-edge rows | 9 → 0 · 8 → 0 |
| `/admin/bookings` · admin / coordinator · 320 | base-state off-right-edge rows | 9 → 0 |
| `/admin/bookings` · therapist_a · 320 / 414 | base-state off-right-edge rows; strip scroller (452 vs 296) | 6 → 0 · 4 → 0 · 1 → 0 |
| digest-wide | the cause's own awk | **574 → 0** |
| `/admin/bookings` · owner · **768** / **1280** · therapist_a · **768** | `counts.outOfBounds` | 19 → 19 · 0 → 0 · 0 → 0 (**guards**) |
| unit test | `npx vitest run src/app/admin/bookings/__tests__/bookings-page-param.test.tsx` | 11 → 11 links+menu items |

**How to undo** · Revert the three class strings **together**. ⛔ Reverting only `:337` leaves the
anchoring pointing at a scroll box.

---

### FIX 12 — CAUSE-20 · "This week's capacity" hides Thursday to Sunday

**Cause** · `src/app/admin/availability/page.tsx:645`
```
<ul className="grid min-w-[40rem] list-none grid-cols-7 gap-2 pl-0 md:min-w-0 md:max-w-[56rem] md:[grid-template-columns:repeat(7,minmax(0,1fr))]">
```
**CSS responsible:** `min-width: 40rem` (640px) with seven forced columns. The escape hatch only
applies from 768px up, so below that the grid is locked at 640px.

**Symptoms resolved** · **132 rows** by the cause's own awk; ⚠️ **363 rows by selector** — the awk
under-counts because the digest truncates deep selectors, and it simultaneously sweeps in a sibling
scroller that this fix does not touch. `/admin/availability` · 320/375/414 · owner and admin.
Measured at 320: 672px of content in a 278px window, **394px hidden**, grid right edge **357px** past
the screen — the single worst horizontal value in the whole audit.

**In plain terms:** the one panel whose entire job is to show which days are open shows Mon, Tue and a
third of Wed on a 320px phone. Thursday to Sunday, including the "Closed" day, need a blind sideways
swipe with no arrow, fade or scrollbar to say one is possible.

**The precise change** · One class string at `:645`:
`grid list-none grid-cols-1 gap-2 pl-0 md:max-w-[56rem] md:[grid-template-columns:repeat(7,minmax(0,1fr))]`.
Three deletions and one substitution: drop the 640px floor, drop the now-dead escape hatch, and make
the phone layout a single stacked column. Both `md:` utilities are carried over verbatim so 768 and
1280 are untouched.
**Why stacked rather than just deleting the floor:** deleting `min-w-[40rem]` alone leaves seven
columns that are allowed to shrink — at 320 each cell would have about **4px** of usable content box
and the times would spill out of every cell. Measured fit for the stacked version at 320: 220px of
content box against ~79px for "08:00–20:00" and ~180px for the worst two-segment string. Fits with
room.
**Optional companion, `:641`:** once the grid fits, the edge-bleed wrapper has nothing to scroll;
changing `"-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"` to `"overflow-x-auto"` clears the residual 16px
rows. Keep the `role="group"` and `aria-label` exactly as they are.
⛔ **Do not add a fade or arrow instead** — that leaves 394px of content off-screen and merely
advertises it.

**Blast radius** · Enumeration **COMPLETE**. 10 usages. `min-w-[40rem]` appears **once** in the entire
repo. `CapacityPreview` is private with one call site. Nothing imports the page module except its own
unit test, which imports three pure date helpers.
⛔ Not a usage: `calendar/page.tsx:1171` has the same idea with a different value (42rem) at a different
breakpoint, on a different page. It is not fixed by this and is not part of the 363 rows.

**Risk · LOW (1)** · One element, one route, unique class string, no CSS file, no test, no public reach,
and the two `md:` utilities that govern 768 and 1280 are carried over verbatim.
⚠️ The one real side effect is height, and it is bounded: stacking seven ~64px cells adds roughly 430px
at 320, taking the page from 4,145px to about 4,575px. That gives the occlusion sweep one extra step,
so the availability occlusion count may tick up by one — **a re-measure obligation, not a defect this
change creates.**
**1280:** ⛔ No — 0 rows at 1280 today, and the change edits only the un-prefixed utilities.
**Public site:** not affected.

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| `/admin/availability` · owner · 320 / 375 / 414 | `counts.outOfBounds` (every one of today's entries is the strip) | **13 → 0** · 13 → 0 · 10 → 0 |
| `/admin/availability` · admin · 320 / 375 / 414 | `counts.outOfBounds` | 13 → 0 · 13 → 0 · 10 → 0 |
| `/admin/availability` · owner + admin · 320 | scroller row on `aria-label="Weekly working hours preview"` (672 vs 278) | 3 → 0 per role |
| `/admin/availability` · owner · 375 / 414 | same scroller row (672 vs 333 / 672 vs 372) | 3 → 0 each |
| digest-wide | **true** symptom total by selector (owner 181 + admin 182) | **363 → 0** |
| digest-wide | the cause's own awk **as written** | 132 → **78** — ⛔ it will NOT reach 0; the survivors belong to the sibling tabs scroller at `AvailabilityManagersTabs.tsx:68`, a different cause (60 if the `:641` companion is also taken) |
| `/admin/availability` · owner · **768** / **1280** | `counts.outOfBounds` · `counts.clipped` | 19 → 19 · 0 → 0 · 14 → 14 (**guards**) |
| `/admin/availability` · coordinator · 320 | `counts.outOfBounds` | 0 → 0 (**guard** — refusal page) |
| `/admin/availability` · owner · 320 | ⚠️ **watch, expected to move** — occlusion sweep total | 8 → 9 |

**How to undo** · Restore the class string (and `:641` if the companion was taken).

---

### FIX 13 — CAUSE-13 · Service card menus open off the LEFT edge of the phone

**Cause** · `src/app/admin/components/admin-ui-interactions.tsx:129`
```
className="absolute right-0 z-30 mt-1.5 grid min-w-48 gap-0.5 rounded-… bg-[var(--admin-panel)] …"
```
**CSS responsible:** `position: absolute; right: 0; min-width: 12rem (192px)` with no flip, no
viewport-width cap and no collision handling.

**Symptoms resolved** · **384 of the 450 rows** the cause claims (see the correction below) ·
`/admin/services` · 320/375/414 · owner and admin. Measured: the "…" button sits in a **left-aligned**
row inside each card, so its right edge is only 161.45px from the left of the screen; `right: 0` then
places the 192px panel at **x = −30.55**, off the left edge, where the mask kills it. Reproduced on two
independent service rows.

**In plain terms:** tapping "…" on a service card opens a menu that slides half off the left side of
the phone. Icons are chopped in half and the first characters of every option are gone.

**The precise change** · One class string, positioning utilities only. `:129` becomes
`absolute left-0 right-auto sm:left-auto sm:right-0 z-30 mt-1.5 grid min-w-48 max-w-[calc(100vw-1.5rem)] gap-0.5 …`.
Nothing else on the line changes and no other file changes.
**Why this is the minimum:** the panel is only mis-anchored where the card's action row is
left-aligned, and that flips at exactly the `sm` breakpoint (`admin-ui.tsx:1155` is `mt-3 sm:hidden`
vs `:1146` `hidden shrink-0 sm:flex sm:justify-end`). Mirroring the panel's anchor at the **same**
breakpoint is the smallest edit that is correct on both sides. Below 640px the panel's left edge
becomes 161.45 − 44 = **117.45px**, so at 320 the 192px panel ends at 309.45px, **10.55px inside** the
screen. The width cap is inert today and exists only so a future longer label cannot re-create the
overflow on the other side.
**Rejected as larger:** JavaScript collision detection (more code, new failure mode) and CSS anchor
positioning (no Safari).

**Blast radius** · Enumeration **COMPLETE at source level**. 19 usages. 33 importers, all under
`src/app/admin/`. The panel's class is hard-coded and **cannot** be overridden by any caller (the
caller's `className` lands on the anchor at `:107`, not the panel), so no call site can opt out.
Three call sites: `ServiceRowActions.tsx:77` (the only one measured, 384 rows) and
`EnquiryList.tsx:498` and `:528` — ⛔ **never measured at any width or role**, because the capture
harness only ever opened the first three menus it found on a page and those slots were taken.
⛔ **The cause over-claims by 66 rows.** The other 66 belong to `src/app/admin/audit/AuditRowMenu.tsx:51`
— a **different file** that happens to share the class string. Editing `:129` moves **zero** of them.
Worse, `findings/reports-audit-auth.md:168` argues those 66 are a closed-disclosure measurement
artefact (100 instances in the captured DOM, none of them open), so they may not move for any fix.

**Risk · MEDIUM (2)** · Enumeration is complete at source and the change cannot reach the public site or
any width ≥640px. Four things keep it off LOW: (1) the 66-row over-claim above; (2) `/admin/enquiries`
is a second page that changes with **zero measurement** — it can only improve, but that is reasoning,
not evidence; (3) the menu was never opened at 768 or 1280 anywhere, so the no-regression claim there
is structural, not measured; (4) **latent inversion** — after this edit, any *future* caller that puts
a trigger near the right edge on a phone would push the panel off the right instead. All three current
call sites are in left-aligned rows, so none does today.
**1280:** ⛔ No — only `sm:`-prefixed utilities are added, so the computed style at 1280 is identical.
**Public site:** not affected — this is a leaf React component, not a global stylesheet.

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| `/admin/services` · owner · 320 | menu 1 `counts.clipped` | **24 → 0** |
| `/admin/services` · owner · 320 | menu 2 `counts.outOfBounds` | 24 → 0 |
| `/admin/services` · owner · 375 | the panel's left edge | **−30.55 → 117.45** |
| `/admin/services` · owner · 375 | pixels cut off the left of the panel, each of the 4 rows (23.55) and the icon (11.55) | 30.55 → 0 |
| `/admin/services` · owner · 414 · admin · 320/375/414 | menus 1+2 combined | 48 → 0 each |
| digest-wide | rows matching the AdminActionMenu family only (⛔ the 66 AuditRowMenu rows **must remain**) | **384 → 0** |
| `/admin/services` · owner · **768** / **1280** | `counts.outOfBounds` / `clipped` | 19 → 19 · 0 → 0 (**guards**) |
| ⛔ **new coverage required** | open the service menus at 768 and 1280 (`capture.mjs:616` gates menu opening at ≤768; `:418` caps at 3 menus per page) | 0 → 2 menus, both clean |
| ⛔ **new coverage required** | open the enquiry row menus at 320/375/414 for owner, admin **and coordinator** | 0 → 2 menus, no left edge below 0 |

**How to undo** · Revert the one class string.
⛔ **This does not close the cause as written.** Schedule `audit/AuditRowMenu.tsx:51` as a separate
change for the remaining 66 rows — and read `findings/reports-audit-auth.md:168` first.

---

### FIX 14 — CAUSE-19 · The Settings save bar covers the field you are filling in

**Cause** · `src/app/admin/settings/SettingsForm.tsx:432`
```
<div className="fixed inset-x-0 bottom-14 z-40 border-t … md:bottom-0 md:pb-[max(env(safe-area-inset-bottom,0),0.75rem)]">
```
and its byte-identical sibling at `src/app/admin/emails/templates/components/TemplateEditor.tsx:389`.
**CSS responsible:** `position: fixed; bottom: 3.5rem; z-index: 40`. It is correctly offset by one
tab-bar height so it does **not** collide with the tab bar — but it reserves no scrolling band of its
own.

**Symptoms resolved** · **146 rows** · `/admin/settings` (68) and `/admin/emails/templates/[id]` (78) ·
owner and admin · all five widths. **⛔ 22 of those rows are at 1280.**

**⛔ This is the one that breaks the desktop.** Ground truth E says 1280 currently works and must be
protected — but at 1280 the Settings page opens with the **entire** required "Contact email" input and
its help text invisible and unclickable under the save bar: **46,640px²** of overlap on a 1166×40
input, plus 15,321px² on the helper line, both confirmed by `elementFromPoint`. Tapping where the field
should be presses Save or Discard instead. At 375 the same happens to the required "Clinic name" field,
and there the thing on top is the bottom nav — so the tap navigates away from a half-filled form.

**The precise change** · Add `md:static` to both bars, so they leave the floating layer at the same
breakpoint the tab bar already disappears at:
- `SettingsForm.tsx:432` — replace `md:bottom-0` with `md:static` (with `position: static` the
  `inset-x-0` / `bottom-14` / `z-40` values become inert at 768px and above, so `md:bottom-0` is dead
  and should go).
- `TemplateEditor.tsx:389` — the same one-word substitution.

That is the whole functional edit. For visual parity with the pattern the repo already ships and has
**zero** digest rows against (`ClientEditForm.tsx:307`, `ClientCreateForm.tsx:456`), also add
`md:mt-2 md:border-0 md:bg-transparent md:shadow-none` and reduce the now-dead desktop reservation
(`SettingsForm.tsx:195`, `TemplateEditor.tsx:232`) from `md:pb-24` to `md:pb-8`. Those extras are
cosmetic and change no defect count.

**What this does NOT fix, stated plainly:** 86 of the rows are at 320/375/414, where the phone layout
deliberately keeps a permanently visible Save bar. Switching the phone version from `fixed` to `sticky`
would **not** help — a sticky bottom bar still paints over content mid-scroll. The phone band can only
be recovered by giving up the always-visible bar or by shrinking the 190px of permanent chrome (57px
header + 77px save bar + 56px tab bar of a 640px screen), which is CAUSE-05's territory.
⛔ Do not use scroll padding as a substitute — it fixes focus-scrolling only and moves no number at
scroll position 0, so the 46,640px² row at 1280 would survive it.

**Blast radius** · Enumeration **COMPLETE**. 13 usages. `bottom-14` appears exactly 4 times in `src/`:
these two bars and the two client forms that are the correct precedent. One render site each. No shared
class, no CSS custom property, no snapshot; both tests query the Save control by ARIA role and name.
The one e2e spec that visits `/admin/settings` asserts on a heading and never clicks Save.

**Risk · MEDIUM (2)** · Two admin-only files, no shared stylesheet, no public reach, no markup-coupled
test. It is not LOW for one reason: **the edit moves the only Save and Discard controls to about 861px
below the fold at 1280** (the settings document is 1,661px tall against an 800px screen), and
`/admin/settings` is the page holding the customer-intake switch that gates the **live public booking
form**. The failure mode of getting this wrong is an owner who edits settings and never realises they
did not save.
Secondary: putting ~65px back into normal flow changes both pages' height, so the 32 "covered while
scrolled" rows will **re-sample** rather than simply zero out. Expect small unrelated deltas on these
two pages and check the occluder column before calling them regressions.
**Does it endanger 1280?** ⚠️ **POSSIBLY — the only cause in the plan flagged so.** On the audit's own
metric 1280 can only improve (26 rows → 0, and an in-flow element cannot paint over content that
precedes it). The risk is the **affordance** trade-off above, which no counter scores. A reviewer must
accept it explicitly, or take the larger alternative (move Save into the page's sticky header at 768px
and up), which is no longer the smallest change.
**Public site:** no markup or CSS changes. ⚠️ But this page's **data** is publicly load-bearing.

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| `/admin/settings` · owner · **1280** | `counts.obscuredInteractive` (the 46,640px² Contact email input) | **1 → 0** |
| `/admin/settings` · owner · **1280** | `counts.pinnedOccluding` | 1 → 0 |
| `/admin/settings` · admin · **1280** | `counts.obscuredInteractive` | 1 → 0 |
| `/admin/settings` · owner + admin · 768 | `counts.obscuredInteractive` (two switches under the bar) | 2 → 0 |
| `/admin/settings` · owner · 768 / 1280 | digest rows for this bar | 24 → 0 · 4 → 0 |
| `/admin/emails/templates/[id]` · owner · 1280 | `counts.obscuredInteractive` | 1 → 0 |
| `/admin/emails/templates/[id]` · owner · 1280 / 768 | digest rows | 9 → 0 each |
| `/admin/settings` · owner · **768** | `counts.outOfBounds` | 19 → 19 (**guard**) |
| `/admin/settings` · owner · **375** | `counts.obscuredInteractive` | 1 → 1 (**guard** — that one is the tab bar, CAUSE-05, and must not change) |
| `/admin/settings` · coordinator · 1280 · `/admin/emails/templates/[id]` · therapist_a · 375 | `counts.obscuredInteractive` | 0 → 0 · 1 → 1 (**controls** — no save bar in their DOM) |

**How to undo** · Restore the two (or four) class strings. ⛔ **Conditional:** if Group 1 moved the
desktop switch off `md`, reverting this in isolation re-introduces a bar whose hard-coded 56px offset
and `md` gate no longer match the tab bar — revert them together, or revert to the **new** breakpoint.

---

### FIX 15 — CAUSE-21 · The therapist dashboard's main button can never be tapped

**Cause** · `src/app/admin/dashboard/MobileStickyActionBar.tsx:27`
```
className="fixed bottom-0 inset-x-0 z-40 border-t … md:hidden"
```
**CSS responsible:** `position: fixed; bottom: 0; z-index: 40` — byte-for-byte the same edge and
stacking level as the bottom tab bar at `AdminTopNav.tsx:648`, with no offset for the tab bar's 57px.

**Symptoms resolved** · **92 rows** — ⚠️ of which **49 are actually fixed** by this change (see below) ·
4 page keys · therapist_a measured · 320/375/414.

**In plain terms:** two different bars are pinned to the same edge at the same stacking level. When
two things tie, the browser lets document order decide, and the navigation bar is written after the
page — so the navigation **always** wins. The therapist dashboard's one primary button is covered
**100%**: 17,160px² (390×44) at 414, 15,444px² at 375, 13,024px² at 320, at **every** scroll position
sampled. Tapping where it should be activates the "Team" tab instead, so the tap silently takes the
therapist to the wrong screen. This is a permanently dead primary button, not an intermittent one.

**The precise change** · Two edits in one file, plus one test line:
- **`:27`** — replace `bottom-0` with `bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))]`. Nothing
  else on the line changes. ⛔ **Do not raise the stacking level** — putting this bar above the
  navigation swaps one dead control for another. ⛔ Do not touch `AdminTopNav.tsx:648`.
- **`:30`** — change the bar's bottom padding from `max(env(safe-area-inset-bottom), 0.75rem)` to
  `0.75rem`, because the tab bar now sits underneath and already owns that inset at
  `AdminTopNav.tsx:649`; leaving it would double-count.
- **`MobileStickyActionBar.test.tsx:102`** — ⛔ **this test will fail.** It asserts the class contains
  `bottom-0`. It must change in the same commit.

**Why the calculation and not the house `bottom-14`:** the tab bar's real occupied height is 56px
**plus** the phone's bottom inset. A bare `bottom-14` measures from the true screen bottom, so on a
notched iPhone (~34px inset) the bar would still be overlapped by ~34px — enough to eat the padding and
half the 44px button. The test harness runs with a 0px inset, so `bottom-14` would **score a clean pass
while the real device stayed broken.** The calculation is correct in both. The identical shape already
compiles in this repo at `AdminTopNav.tsx:346`.
**No other file needs to change:** the three dashboards already reserve 96px on top of the shell's 80px
= 176px of tail clearance, against the moved bar's 124px reach.

**Blast radius** · Enumeration **COMPLETE**. 30 usages. Three render sites: the therapist dashboard
(measured), and the business and coordinator dashboards, which render the same component **only when
there are unassigned bookings** — a count that was 0 in every captured cell, so those two paths are
**latent, not healthy**.

**Risk · LOW (1)** · One inline class on one node, no shared class, no CSS rule, three render sites all
under `src/app/admin/dashboard/`, zero non-admin importers, zero e2e coverage, exactly one known-breaking
unit assertion. The edited element provably does not exist at 768 or 1280. The space the moved bar needs
is already reserved.
⚠️ **It resolves 49 of the 92 rows.** Of the other 43: **40** are the same button covered by a
deliberately-opened sheet or popover, which will survive the move and **correctly so** — a dialog
covering the page is by design; and **3** are a different element entirely that was mis-attributed to
this cause.
⚠️ The hard-coded 3.5rem over-clears by 12px on landscape phones (a cosmetic gap, never an occlusion),
and no landscape cell was ever captured.
**1280:** ⛔ No — the element is `display: none` at ≥768px; 0 of 62 matching digest rows sit at 768 or
1280. **Public site:** not affected.

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| `/admin/dashboard` · therapist_a · 375 | `counts.obscuredInteractive` (the sole entry is the button) | **1 → 0** |
| `/admin/dashboard` · therapist_a · 414 | `counts.obscuredInteractive` (the 17,160px² worst case) | 1 → 0 |
| `/admin/dashboard` · therapist_a · 320 | `counts.obscuredInteractive` | 4 → **3** — ⛔ must NOT reach 0; the 3 survivors are the date-filter chips, a different cause |
| dashboard / admin-root / login / staff · therapist_a · 320/375/414 | digest rows for the button under the tab bar | 6/5/5, 6/5/5, 4/5/5, 3 → **0** |
| `/admin/dashboard` · therapist_a · **768** | `counts.pinned` | 1 → 1 (**guard**; 2 or 3 means the phone-only gate broke) |
| `/admin/dashboard` · therapist_a · **1280** | `counts.obscuredInteractive` | 0 → 0 (**guard**) |
| unit tests | `npx vitest run src/app/admin/dashboard/MobileStickyActionBar.test.tsx src/app/admin/dashboard/blocks/__tests__/MobileStickyActionBar.test.tsx` | **1 failing → 0** (repo baseline is 0 failed / 2,501) |

**How to undo** · Revert the two class values and the one test line together.

---

### FIX 16 — CAUSE-22 · The same dead button on the profile and performance pages

**Cause** · `src/app/admin/components/PerformanceSurface.tsx:548`
```
className="fixed inset-x-0 bottom-0 z-40 border-t … p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
```
**CSS responsible:** identical geometry and stacking level to FIX 15 and to the tab bar. Note the
**mismatched breakpoints**: this bar disappears at 640px while the tab bar disappears at 768px, so they
collide across 320–639px.

**Symptoms resolved** · **54 rows** — ⚠️ of which **18 are actually fixed** (the other 36 are the two
menu-open states where a full-screen backdrop covers everything, which is correct behaviour) ·
`/admin/me` and `/admin/staff/[id]/performance` · coordinator and therapist_a · 320/375/414. 100% of
the link's centre covered, at every scroll offset sampled (0, 512, 1024, 1536, 2048, 2560, 2629).

**In plain terms:** a Booking Coordinator or a therapist on a phone sees their own profile page's
primary button ("Open enquiries" / "Browse claimable") permanently dead — tapping it navigates to a
navigation tab instead.

**The precise change** · **One token:** `bottom-0` → `bottom-14`. Nothing else. `bottom-14` is 56px,
exactly the tab bar's height at `AdminTopNav.tsx:651`, and byte-identical to the pattern
`SettingsForm.tsx:432` and `TemplateEditor.tsx:389` already use — so **zero new CSS is emitted**.
⛔ Do not add `md:bottom-0` (the bar is already hidden from 640px, so it would be dead code). ⛔ Do not
widen `sm:hidden` to `md:hidden` (that would make the bar **appear** at 640–767px where it does not
exist today — new geometry, new risk, zero measured symptoms). ⛔ Do not touch the padding: the two
nested main elements give 80 + 96 = **176px** of bottom reserve below 640px, comfortably more than the
126px the stacked chrome will occupy.

**Blast radius** · Enumeration **COMPLETE**. 17 usages. A module-private component with one call site
and one real route (`/admin/me`). Owner and admin never get the bar (gated at `:395`), confirmed:
their cells report 2 pinned elements against coordinator's and therapist_a's 3.
⚠️ The 18 rows filed under `staff-id-performance` are actually `/admin/me` — those cells redirected.

**Risk · LOW (1)** · Fully enumerated, no exports, no stylesheet can match it, no test asserts its
position, zero new CSS. The target value is the codebase's own convention and the digest confirms it
works: **no `bottom-14` bar anywhere in all 89,568 rows is covered by the tab bar.**
⚠️ Three caveats: (a) only 18 of 54 rows go away, for the correct reason above; (b) the bar is currently
the **occluder** in 6 base-state rows, so moving it up 56px relocates that band rather than deleting it
— expect ~6 rows to change victim, not vanish; (c) on notched hardware the tab bar is 57px **plus** the
inset while `bottom-14` stays 56px, so the clearance is short by the inset. The two existing `bottom-14`
bars share exactly that limitation, so this is consistent with the codebase rather than worse than it.
**1280:** ⛔ No — the bar is `display: none` from 640px. **Public site:** not affected.

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| `/admin/me` · coordinator · 320 / 375 / 414 | `counts.obscuredInteractive` ("Open enquiries" under the "Clients" tab) | **1 → 0** each |
| `/admin/me` · therapist_a · 320 / 414 | `counts.obscuredInteractive` ("Browse claimable") | 1 → 0 |
| `/admin/me` · therapist_a · 375 | `counts.obscuredInteractive` | 2 → **1** — the survivor is a KPI tile under the tab bar, CAUSE-05's |
| `/admin/staff/[id]/performance` (redirects to `/admin/me`) · therapist_a · 320 / 375 / 414 | `counts.obscuredInteractive` | 1 → 0 · 2 → 1 · 1 → 0 |
| `/admin/me` · coordinator · 320 | occlusion sweep total (7 of 9 items are this bar's link) | 9 → 2 |
| `/admin/me` · therapist_a · 320 | occlusion sweep total (all 8 are this bar's link) | 8 → 0 |
| digest-wide | ⛔ **use the label-based count, not the cause's own awk** — rows where the text is "Open enquiries", "Browse claimable" or "Go to my next visit" and the occluder is the tab bar. The cause's own command greps the literal old class name, which this fix **renames**, so it would read 0 even if nothing were fixed. | **18 → 0** |
| `/admin/me` · coordinator · **1280** / **768** · owner · 320 | pinned / occluding / obscured counts | all unchanged (**guards**; owner must stay at 2 pinned — they never render the bar) |

**How to undo** · Revert the single token.

---

### FIX 17 (optional) — CAUSE-10 · The audit log's 14-pixel filter icon

⚠️ **Disputed.** The scope guard rules the whole "tap target under 24px" class out of scope, and drops
these 618 rows specifically because the same filter is reachable from the full filter control at
`AuditFilterStrip.tsx:141` (and `:241` in the mobile sheet), so the icon fails the "only route to the
function" test. Included because it is a one-line, layout-neutral change with a real desktop benefit.

**Cause** · `src/app/admin/audit/AuditEventCard.tsx:167` — an icon-only link with no padding, no
minimum size, wrapping a 14px icon, so it shrink-wraps to exactly **14×14px**.

**Symptoms resolved** · **618 rows** · `/admin/audit` · owner and admin (the only roles who can see the
page) · **all five widths**, including 1280 — so it is a small target for an imprecise mouse too, not
just a phone problem.

**The precise change** · One class string, `:167` only. ⛔ **Leave `:175` (the non-interactive twin)
untouched.** Replace `mt-1.5` with `mt-[1px] -mx-[5px] -mb-[5px] p-[5px] items-center justify-center`.
14px icon + 5px padding all round = a 24×24 box, which is what the measurement reads, while the equal
negative margins cancel the padding so the outer footprint stays exactly 14×20 and **nothing on the page
moves**.
**Why 24 and not 44, measured:** the icon's centre is at x = 124 (its box runs 117–131 at 320–414). The
next link starts at x = 137 and their vertical bands overlap by 12.75px, so they are separated only
horizontally, by 6px. A 24px box spans 112–136 — **1px of clearance**. A 26px box touches 137. A 44px
box spans 102–146 and lies over the first 9px of the next link, where a tap would be handed to whichever
of two siblings paints last, i.e. it would **steal clicks for a different filter**.
⛔ Do not add the padding without the matching negative margins — plain padding widens the item by 10px
on 94 cards and can re-wrap the header line at 320.

**Blast radius** · Enumeration **COMPLETE**. 13 usages, 2 importers, both admin. 94 instances per page,
counted from the captured DOM (100 cards, 6 with no chip). ⚠️ Every click of "Load more" appends up to
100 more identical 14×14 targets that the capture never saw.

**Risk · LOW (1)** · Layout-neutral by construction. ⚠️ The residual risk is entirely in the
implementation and is bounded: substituting 44px, or adding the padding without the offsetting margins,
crosses x=137 and starts competing for clicks — **that variant would be HIGH.**
**1280:** ⛔ No — it improves there (small targets 391 → 297). **Public site:** not affected.

**Verification** · `counts.smallTargets` on `/admin/audit`: owner and admin at 320/375/414 **191 → 97**,
at 768 and 1280 **391 → 297**. Element-level: the icon's box **14 → 24**, its left edge 117 → 112 and
right edge 131 → **136**, staying 1px clear of 137. Guards: `counts.outOfBounds` 0 → 0 at 1280, 19 → 19
at 768, 4 → 4 at 320; the count of filter links in the DOM stays **94 → 94**. Digest-wide: 618 → 0.

**How to undo** · Restore the one class string.

---

### FIX 18 (optional) — CAUSE-16 · 16-pixel-tall therapist links in the availability roster

⚠️ **Disputed** for the same reason: the scope guard drops "small in one axis only" targets (2,469 rows)
as normal inline text. These links are 76–174px **wide** and 16px tall.

**Cause** · `src/app/admin/availability/page.tsx:766` — a link carrying colour and focus utilities only,
so its hit area is exactly the text run: **16px tall at every width**.

**Symptoms resolved** · **268 rows** · `/admin/availability` · owner and admin · all five widths ·
11 links (e.g. "Minhaj rahman" 102.44×16, "Test Booking Coordinator" 174.13×16).

**The precise change** · Add exactly one utility — `py-1.5` — to the existing class string on `:766`.
16 + 6 + 6 = 28px clears the 24px floor, while the text line itself stays 20px, so **nothing on the page
moves**. Horizontal padding is deliberately **not** added: width was never the failing dimension.
⛔ **Three alternatives explicitly rejected:** (1) `inline-flex items-center min-h-6` — makes the link an
unbreakable block, and the digest proves that breaks at 320, where "Phase10 COORDINATOR" (161.5px) and
"Test Booking Coordinator" (174.13px) currently wrap to two lines; made unbreakable they would overrun
the ~157px title slot and be swallowed by the mask; (2) putting a minimum height on the shared heading at
`admin-ui.tsx:1134` — that drags `EnquiryList.tsx:373` and `services/page.tsx:180` in with it; (3) a
whole-card click overlay — the best answer to the underlying complaint, but it edits shared code and
would swallow clicks on the badges. **The rating flips to HIGH the moment the fix is written as
`inline-flex`, `block`, or a change to the shared heading.**

**Blast radius** · Enumeration **COMPLETE**. 10 usages. The full class literal appears **once** in
`src/`. The component is module-local and not exported; the route file is imported by nothing.

**Risk · LOW (1)** · One static string, one page, two roles, and the CSS mechanism produces **zero**
layout change, so no other counter on the page can move. No test can break.
⚠️ Two residuals: (a) the 6px bleeds into the 4px gap above the meta line, so the real-world gain is a
little smaller than the measured rectangle suggests; (b) a link whose box stopped 1–5px short of the tab
bar could newly clip it — watch for `counts.obscuredInteractive` going 1 → 2 at 320/375/414. That belongs
to CAUSE-05 either way.
**1280:** ⛔ No. **Public site:** not affected.

**Verification** · `counts.smallTargets` on `/admin/availability`: owner and admin, **9 → 1** at 320 and
**11 → 1** at 375/414/768/1280. Digest-wide **268 → 0**. Guards that must not move: at 1280
`counts.outOfBounds` 0, `clipped` 14, `horizontalScrollers` 10; at 768 `counts.outOfBounds` 19,
`clipped` 33; at 320 `counts.obscuredInteractive` **1 → 1**; coordinator and therapist_a
`counts.smallTargets` 1 → 1 (they never render the roster).

**How to undo** · Delete the ` py-1.5` token.

---

### FIX 19 — CAUSE-02 · The admin shell secretly became a scrolling box · Stage 4

**Cause** · `src/app/admin/components/AdminTopNav.tsx:204`
```
<div className="admin-shell min-h-screen overflow-x-hidden bg-[var(--admin-canvas)]">
```
**CSS responsible:** `overflow-x: hidden` with `overflow-y` left at `visible`. The CSS spec then forces
the used `overflow-y` to `auto` — so this box clips on x, clips on y, **and is still programmatically
scrollable**, which is where all three failures come from.

**Symptoms resolved** · **9,629 rows** · all 32 pages · 8 of 8 areas · **all 4 roles** ·
320/375/414/768. Three separate failures from one declaration:

1. **Content is destroyed, not parked.** It is the nearest clipping ancestor of every admin page —
   **8,153 rows** name it, worst **357px** of a row cut off (`/admin/availability` at 320).
2. **A one-way sideways drag.** Because it clips but stays scrollable, moving focus onto the off-screen
   account button drags this box **170–173px** left with no scrollbar to bring it back — **2,849 rows**
   at 768 with a negative left edge, on all 32 pages for owner, admin and coordinator. The main content
   and the sticky header both sit at −170 and the RAHMA logo ends at x = −39.88.
3. **The sticky top bar never sticks.** Its height is automatic, so its scroll position is permanently 0
   while the real scrolling happens on the window. Verified across the whole raw tree: of 622 cells that
   recorded the header's position, **21 were captured already scrolled, and in every one the header sat
   above the top of the screen** (y = −935 at 320, −716 at 375, −674 at 414, −483 at 1280) while its own
   style still read `position: sticky; top: 0px`. Everywhere else the page had not been scrolled, so
   stickiness was never exercised. The failure is structural; the evidence is 21 cells.

**The precise change** · ⛔ **Honest headline: on its own this edit changes almost nothing measurable,
because it is one of three stacked masks and the other two are its ancestors. Do it anyway** — it is the
cheap, admin-only, fully reversible half-step that makes the other two safe to reason about.

Replace the single utility `overflow-x-hidden` with `overflow-x-clip`. Nothing else on that line moves.
**Why that exact utility:** `hidden` is what secretly turns this box into a scroll container, and the
scroll container is what causes failures 2 and 3. `clip` has no such rule and never creates one, so it
kills both mechanisms while keeping the visual chop byte-identical. Tailwind v4 ships the utility, and
`overflow: clip` is supported in Chrome 90+, Firefox 81+, Safari 16+.

⛔ **Do NOT, as part of this cause:** delete the utility outright (that reveals 7,949 rows of destroyed
content with nothing to catch them); touch `globals.css:42` or `site-parity.css:32` (public site,
separate commit); or convert the shell into the real scroller with a full-height scrolling box — that is
the tempting "proper" fix and it **silently breaks** `PullToRefresh.tsx:75/86` (which gates on
`window.scrollY > 0`) plus the three window-scroll calls in `ManualBookingForm.tsx`.

**Blast radius** · Enumeration **COMPLETE**. 19 usages. `admin-shell` appears in exactly **one**
className in all of `src/`. The literal Tailwind class `overflow-x-hidden` appears **twice** in
`src/`: this line and the dialog panel at `admin-ui-interactions.tsx:190`. ⚠️ The blast-radius
record's count of **5** is for a broader pattern (`overflow-x-hidden`, `overflow-x: hidden`,
`overflowX`), which also picks up the two CSS declarations at `globals.css:42` and
`site-parity.css:32` and — the fifth — **a comment, not code**, at
`src/components/home/HomeReviewCarousel.tsx:89`. It governs **19
sticky elements** across the admin, listed individually in the blast-radius record. No test or e2e spec
anywhere references `admin-shell` or `overflow-x-hidden`.

**Risk · HIGH (4)** · Usage **is** fully enumerable, so this is not an unknown-usage HIGH. It is HIGH on
blast radius and on mask semantics: this one declaration is the nearest clipping ancestor of every admin
page, 32 of 32 pages, 4 of 4 roles, 8 of 8 areas, 4 of 5 widths — there is no way to change it for one
page. And any edit that goes one notch further than `hidden → clip` instantly exposes **7,949** rows of
content that is currently silently destroyed (only 204 of the 8,153 clipped rows have an inner scroller
to catch them). The `clip` swap taken strictly in isolation is closer to MEDIUM, but the artefacts
contain **zero** cells captured with `overflow: clip`, so the behaviour after the swap is reasoned from
the spec, not measured. **Default to HIGH.**
**1280:** ⛔ **No.** Not one of the 8,153 clip rows is at 1280 (320 = 1,184, 375 = 740, 414 = 716,
768 = 5,513, 1280 = **absent**). ⚠️ **The one way this becomes "possibly":** if this edit is bundled with
removing the two CSS declarations, stickiness starts working at 1280 for all 19 sticky elements at once
and the 18 existing "covered by fixed or sticky" rows at 1280 can only grow. **Keep the three edits in
separate commits so that regression is attributable.**
**Public site:** not affected — this is a JSX class on a component rendered only from the admin layout.

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| `/admin/availability` · owner · 320 | rows naming this exact element as the clipper (after the swap the selector no longer exists, so attribution must move to `body` or vanish) | 22 → 0 |
| `/admin/dashboard` · owner · 768 | `counts.outOfBounds` — ⛔ **must stay unchanged**, proving the swap is inert on clipping because `body` still clips. (19 → 19 against the pre-CAUSE-01 tree; **0 → 0** once CAUSE-01 has shipped.) | unchanged |
| `/admin/clients` · owner · 768 | rows in the account-menu-open state with a negative left edge — **the one-way drag** | **30 → 0** (if it survives, the drag relocated to `body` and the mask edits must follow) |
| `/admin/dashboard` · owner · **1280** | `counts.clipped` / `outOfBounds` / `pinnedOccluding` all stay 0, **and** the sticky header's y stays at **−483** | ⛔ a change to 0 means stickiness woke up, which must NOT happen from this edit alone — it is the signal that a mask edit was bundled in by mistake |
| `/admin/dashboard` · owner · 1280 | the sticky header's y — the **deferred** check, only after Stage 5 | −483 → 0 |

**How to undo** · Change the single token back. ⛔ **Asymmetric case:** if this landed together with the
Stage 5 edits, reverting this line alone is not enough and is actively misleading — the two body/html
removals must be reverted first, or the admin re-clips at the shell while the public site stays unmasked.

---

### FIX 20 — CAUSE-03 + CAUSE-23 · The mask comes off · Stage 5, one commit, last

**Causes** ·
`src/app/globals.css:42` (last declaration of the `html, body {` rule opened at line 38) — **CAUSE-03**
`src/styles/site-parity.css:32` (last declaration of the `body {` rule opened at line 24) — **CAUSE-23**
plus the third edit at `src/app/admin/components/AdminTopNav.tsx:204`.

**CSS responsible:** overflow set on the root element is **propagated to the viewport**, which is what
forbids all horizontal scrolling in the document.

**Symptoms resolved** · **7,718 rows** (CAUSE-03) + **0 rows today** (CAUSE-23, latent) · all 32 pages ·
8 of 8 areas · all 4 roles · 320/375/414/768. Worst: **227.8px** past the right edge with document-level
horizontal scrolling disabled (owner, `/admin/clients`, 320, a client row); **180.52px** at 768 on the
header rail.

CAUSE-03 does two things. (1) It is the reason 7,718 off-right-edge rows carry
`NO scrollable ancestor — unreachable` — without it, every one would be recoverable by a sideways swipe.
5,730 of the 7,718 are at 768px, i.e. the navigation gap. (2) It is the **measurement mask**: the
standard overflow number reads 0 on all 640 cells even where the header genuinely needs 938px inside
768px.

CAUSE-23 contributes **0 measured rows today** and is a **booby trap**: leave it in place while fixing
CAUSE-02 and `body` inherits the scroll-container role the shell just gave up — with automatic height,
so the sticky header stays broken exactly as it is now and the team concludes the fix did not work.

**The precise change** · **Four coordinated edits, one commit. A one-line edit is impossible** — see
Stage 5 in section 2 for why fewer than the first three is a no-op, and why the fourth is what stops
the mask simply moving to a new home on phones.

- **Edit 1 — `src/app/globals.css:38-43.`** Leave `html, body { margin: 0; padding: 0; }` as it is and
  remove only line 42 from it. Immediately after that rule, add a new rule carrying the same declaration
  under a **negative admin scope**: selector
  `html:not(:has(.admin-shell)), html:not(:has(.admin-shell)) body`, declaration
  `overflow-x: hidden;`, with a comment explaining that this is the measurement mask, lifted for admin
  and kept for public where its original purpose (a public-pages commit dated 2026-04-27 citing
  "responsive overflow") is unrecorded. `:has()` adds no new browser-support surface — `globals.css:161`
  already ships `html:has(.public-main)`. ⛔ **Do not scope positively with `html:has(.public-main)`:**
  that class is produced only at `src/app/(public)/layout.tsx:46`, and `/booking/manage` has no layout of
  its own, so a positive scope would silently un-mask that page too.
- **Edit 2 — `src/styles/site-parity.css:32.`** Delete the declaration and re-add it in the same file,
  immediately after that rule, as `html:not(:has(.admin-shell)) body { overflow-x: hidden; }`.
  **Non-optional** — without it Edit 1 does nothing at all. ⛔ **Do not wrap the rule in a cascade layer
  to scope it:** `src/styles/__tests__/site-parity-anchor-scope.test.ts:76` asserts that file contains
  exactly one such block and would fail.
- **Edit 3 — `src/app/admin/components/AdminTopNav.tsx:204.`** Delete the single token
  `overflow-x-hidden` (or, if Stage 4 already ran, `overflow-x-clip`), leaving
  `className="admin-shell min-h-screen bg-[var(--admin-canvas)]"`. Keep `admin-shell` —
  `globals.css:51` and `:55` both key off it.
- **Edit 4 — `src/app/admin/components/AdminTopNav.tsx:346`.** ⛔ **The edit that stops the mask
  moving house.** Change the token FIX 3 pinned on `<main id="admin-main">` from `[overflow-x:clip]`
  to `[overflow-x:auto]`. Leave every other token on that line exactly as FIX 3 left it, including
  `md:overflow-visible`, so 768px and above is untouched.
  **Why it exists:** `clip` was the right value while the three declarations above it were still
  masking, but `clip` **is** a mask. Do Edits 1–3 without it and the nearest clipping ancestor simply
  drops one level on phones: **1,280** of the 7,718 unreachable rows sit inside `main#admin-main`
  below 768px (of **1,988** below 768px in total — 320 = 968, 375 = 516, 414 = 504) and none of them
  would be reachable, on the commit that claims all 7,718 are.
  **Why `auto` and not simply deleting the token:** `main` scrolls vertically now (FIX 3), and the CSS
  spec coerces `overflow-x: visible` to `auto` whenever `overflow-y` is `auto` — so writing `auto`
  explicitly is the honest version of what the browser will do anyway, and it is the value that gives
  the spill a real sideways swipe instead of a silent chop.
  ⚠️ **Consequence to expect, not a regression:** `counts.horizontalScrollers` **rises by 1** on every
  admin page below 768px, because `main` becomes a genuine scroll container. FIX 3's "mask guard"
  (`/admin/privacy` · owner · 320, 15 → 15) is retired by this edit and must not be re-run against it.

**Touch nothing else.** In particular leave `admin-ui-interactions.tsx:190` alone (that
`overflow-x-hidden` is on a dialog popup, not an ancestor of page content).

**Net effect:** for a signed-in admin document the screen becomes horizontally scrollable and the
overflow number can finally exceed 0 — at 768px and above through the document itself, and below
768px through `main#admin-main`, which Edit 4 turns from a clip into a scroller. Every public
document, and the signed-out `/admin/login` and `/admin/password-reset` (which render outside the
admin shell), keep identical behaviour.

**Blast radius** · ⛔ **Enumeration is PARTIAL for CAUSE-03 — the only incomplete one in the plan.** 24
usages listed. Two irreducible gaps under the read-only rule: (1) **what this rule currently hides on the
12 non-admin routes is unknown** — 640 of 640 captured cells are admin and `CAPTURE-NOTES.md` never
mentions the public site; (2) `react-day-picker/style.css` is imported globally at
`src/app/layout.tsx:3` and is **not present as a `.css` file under `node_modules` on this disk**, so it
could not be ruled out as setting an html/body overflow rule.
CAUSE-23's enumeration **is** complete: only two `overflow-x` declarations exist in all four stylesheets,
and only two `<body>` elements exist in the whole app.
⚠️ **Latent new overflow source, revealed only once the mask lifts:** `PerformanceHeader.tsx:152/153/158`
apply a sliding shimmer animation directly to bars inside a container with no clip, and transformed boxes
**do** contribute to scrollable overflow. Mitigating: that skeleton is a dead export with no render site,
so it is latent, not live.

**Risk · HIGH (4) for CAUSE-03, MEDIUM (2) for CAUSE-23** · Five reasons, in order of weight:
1. **Un-enumerable usage on the public site.** The rule governs 12 non-admin routes the audit never
   measured, and its origin commit is a public-pages commit citing "responsive overflow" — so it is very
   likely load-bearing for something nobody wrote down.
2. **A public regression would be invisible.** `globals.css:161` and `:165` hide the scrollbar on public
   documents on **both** axes, so a public page that started overflowing would show no scrollbar — just a
   page sliding under a swipe.
3. **It is the measurement mask.** Every zero in the overflow number across all 640 cells is produced by
   this rule, so any gate that reads it is currently reading a constant.
4. **Blast radius at 768.** Shipped before the overflow sources are fixed, 32 of 32 admin pages start
   sliding ~180px sideways simultaneously for three roles on one deploy.
5. **One unread dependency** (the day-picker stylesheet above).

**⛔ These are the two causes that affect the PUBLIC SITE.** `src/app/globals.css` and
`src/styles/site-parity.css` are imported once each at the **root** layout (`src/app/layout.tsx:4-5`) and
govern all 12 non-admin routes: the 11 pages under `src/app/(public)/` plus `src/app/booking/manage`. Two
live code paths also read or write these exact properties on public —
`BookingExperience.tsx:325-326` (the scroll lock, whose own comment says "the site has a dual scroll
root") and `PublicScrollbar.tsx:34`. The recommended admin-scoped change leaves the public arm
behaviourally identical; an unscoped removal does not, and would need a full public regression pass with
**no existing artefact to compare against.**

**Does it endanger 1280?** ⛔ **No for the admin-scoped change** — zero elements anywhere in the admin
have a right edge past 1280 in a 1280 viewport across all 128 cells, and removing an overflow declaration
moves no box. ⚠️ **POSSIBLY on the 12 public routes**, where 1280 has never been measured at all. And see
Stage 5: the 18 existing "covered by fixed or sticky" rows at 1280 can grow once stickiness starts
working.

**Verification**

| Page × role × width | Number | From → to |
|---|---|---|
| all 640 cells | cells reporting `htmlOverflowX == "hidden"` — ⛔ **this and its pair below are the primary proof that the mask is off**, because they are the only readings that do not depend on whether Stages 1 and 2 already deleted the overflow | **628 → 0** |
| all 640 cells | cells reporting `bodyOverflowX == "hidden"` — ⛔ the **paired** check; if it still reads 628, one of the two copies was missed | 628 → 0 |
| all 32 pages × 4 roles | rows reading `NO scrollable ancestor — unreachable`. ⛔ **This is the only metric that proves the symptom is resolved** — `counts.outOfBounds` does **not** move on this change alone, because removing an overflow declaration changes no geometry. | **7,718 → 0** |
| widths 320 / 375 / 414 | of that 7,718, the rows **below 768px** — ⛔ **this is the Edit 4 check.** They can only reach 0 if `main#admin-main` became `[overflow-x:auto]`; if Edit 4 was skipped, expect roughly **1,280** survivors, all of them descendants of `main#admin-main`. | **1,988 → 0** (968 · 516 · 504) |
| width 768 | the rest of that 7,718 — these are freed by Edits 1–3, through the document itself | **5,730 → 0** |
| `/admin/dashboard` · owner · 320 | `counts.horizontalScrollers` — ⚠️ **expected to rise by exactly 1**, because Edit 4 makes `main` a real scroll container. A rise of more than 1 means something else changed. | +1 |
| `/admin/dashboard` · owner · 768 | `documentOverflowPx` — ⚠️ **read this against the Stage 3 re-baseline, not against the `fdeb273` numbers this document is anchored to.** With the mask off and nothing else fixed (that is Stage 0's measurement) this cell wants **177.75**. But FIX 1 ships in Stage 1 and deletes exactly that overflow, so by the time Stage 5 runs **0 is the correct answer and is a pass** — section 2, Stage 5 says the same. ⛔ Do **not** read 0 here as a missed declaration; the `htmlOverflowX` / `bodyOverflowX` pair above is what proves the declarations went. | **0 → 0** (177.75 only if FIX 1 was skipped) |
| `/admin/bookings` · coordinator · 768 | `documentOverflowPx` — the worst 768 cell, same caveat: FIX 1 removes this overflow in Stage 1 | 0 → 0 (180.52 only if FIX 1 was skipped) |
| `/admin/clients` · owner · 320 | `documentOverflowPx` — the worst cell overall (a client row driven by the name "Nono Garcia-Lopez y Vega Romero"), same caveat: FIX 7 removes this overflow in Stage 2 | 0 → 0 (227.8 only if FIX 7 was skipped) |
| all 128 cells at **1280** | cells with `counts.outOfBounds > 0` and cells with a non-zero overflow number | 0 → 0 (**guard** — if either becomes non-zero the change altered layout, which it must not; stop and investigate) |
| ⛔ **the 12 non-admin routes** · signed-out · 320/375/414/768/1280 | **NO ARTEFACT EXISTS.** Capture before and after, with the mask temporarily lifted in the BEFORE run so the baseline is honest. Any non-zero value in that BEFORE run is a public overflow source the mask is currently hiding, and must be fixed before an unscoped removal is even considered. | 0 → 0 |

**How to undo** · `git revert` the single commit restores all four edits. ⛔ **One thing must be
reverted alongside:** any verification harness or CI threshold flipped during this work to assert a
non-zero overflow number — reverting re-pins it to 0 on every page, so those assertions would then fail
for the wrong reason. ⚠️ **And a warning:** reverting is safe only in the sense that it restores the old
pixels. It also restores the blindness — 7,718 items go back to being unreachable and every automated
overflow check goes back to reading 0. ⛔ After Stage 5 has shipped, CAUSE-03 and CAUSE-23 revert
**together or neither** — putting CAUSE-23 back alone re-arms the booby trap and the sticky header goes
straight back to never working.

---

## 6. What was deliberately NOT fixed, and why

### 6.1 The scope guard's ruling

Of the 89,568 measured rows, **54,629 were dropped** and **34,939 survive** as things that actually
prevent a person from reading or reaching something. The survival test was: *a row survives only if a
real person is prevented from reading or reaching something.*

⚠️ **The source's own totals do not quite close, and the difference is not smoothed over here.**
`scope-guard.json` states `totalRowsDropped: 54,629`, but its own 15 listed classes sum to **54,623**
— a gap of **6 rows** that belong to no named class. The table below reproduces those 15 classes at
their stated values (the two occlusion classes shown as one merged row), so it totals **54,623**, not
54,629. Those 6 rows have **not** been added to any row to make the column balance.

| Dropped | Rows | Why |
|---|---:|---|
| Occlusion rows where the thing on top **is** the dialog, sheet or popover that the tester deliberately opened | **22,512** (12,046 + 10,466) | A modal covering the page behind it is **correct behaviour**, not a defect. 13,655 of the 13,857 "control painted over" rows and 12,541 of the 13,366 "covered" rows were captured in a menu-open state. ⛔ This, not tiny text, is the single largest source of inflation in the digest. |
| Text at **11px** | **13,682** | 11px sits **at** the accepted mobile-UI floor (Apple's guideline is 11pt, Material's small label is 11sp; WCAG sets no minimum). Treating it as breakage is taste. It is 69% of the text class on its own. |
| Rows from **26 phantom cells** | **3,918** | 20 `login` cells actually resolved to `/admin/dashboard/`, 5 therapist performance cells to `/admin/me/`, and 1 `staff` cell to the dashboard. Every row is a duplicate of a page already measured under its own name. |
| 10px text that is decorative or already spoken aloud elsewhere | **3,064** | Bell badge counts (marked hidden from screen readers, and the count is already in the button's label), avatar initials (the name is in the button's label), keyboard hints. |
| Screen-reader-only 1×1px elements | **2,974** | The digest's own detail column already says "**NOT a real touch target: exclude**". A 1×1 hidden element is never a finding. |
| Targets small in **one axis only** | **2,469** | A 270×20px inline link is trivially tappable. The harness flags them because it tests the *smallest* dimension. |
| Genuine **vertical** clips inside a box that scrolls vertically | **1,601** | The user reaches the content by scrolling. Not breakage. |
| Spill that names a **real scrollable ancestor** | **1,463** | Reachable by a sideways swipe. A missing scroll hint is polish. |
| Checkboxes and radios inside a `<label>` | **983** | The label is the real hit area and it is much bigger. |
| The audit log's 14×14 filter icon | **618** | Not the only route to the function — the same filter exists as a full control at `AuditFilterStrip.tsx:141`. ⚠️ **This is CAUSE-10 / FIX 17.** |
| The entire **horizontal-scroller** class | **559** | Every element in it genuinely scrolls (median 117px hidden, max 394px). A missing fade or arrow is polish, not breakage — and it would be a 9-place affordance job, not a defect fix. |
| The collapsed accordion on the dashboard | **537** | A false positive already named in the audit's own summary: the panel is collapsed with zero height, so the "covered" content was never painted. It also produces the single largest value in the whole digest (703.66px). |
| Parenthetical counts appended to larger headings | **187** | Decorative next to the label they follow. |
| The 20×20 "Remove Luton" chip button | **56** | It already carries its own invisible 8px hit-area expander at `SettingsForm.tsx:757`, giving a 36×36 effective target. The measurement cannot see it. |

⚠️ **A correction that runs the other way, in the owner's favour.** 6,480 clipped rows carry the harness
verdict "ancestor CAN scroll to it" while their right edge is past the screen — the harness answered a
*vertical*-scroll question about a *horizontal* clip. Ground truth A proves no horizontal scroll exists
on any admin ancestor, so those 6,480 are unreachable too. The truly-unreachable clip count is
therefore **2,714 + 6,480 = 9,194**, not the **2,714** the digest admits.

⛔ **Do not confuse that with a different number the source reports for the same class.**
`scope-guard.json` gives `clipped-by-overflow-hidden` a `rowsSurviving` of **8,982** out of 11,542.
That is a *survival* count — what is left after the scope guard also drops 537 collapsed-accordion
false positives and 1,601 genuine vertical clips — and it answers a different question from "how many
are unreachable". ⚠️ The source's own arithmetic for it does not close either way: 11,542 − 537 − 1,601
= **9,404**, and 2,714 + 6,480 = **9,194**, and neither is 8,982. **9,194 is the unreachability figure
this plan stands behind and shows its working for. 8,982 is quoted as the source's survival figure and
is not re-derived here.**

Likewise the summary's claim that "250 of the off-right-edge rows" are unreachable understates the
digest by about **31×** — the measured figure is **7,718**. **No unreachability finding has been
softened.**

### 6.2 ⛔ The claim that was tested and dismissed

**The original claim (finding CLIENTS-02):** in the half-off-screen client row menu, the only fully
readable option is **"Delete client"** — implying a phone user could tap Delete without being able to
read the safer options above it.

**⛔ MEASURED AND FALSE.** It was read off a screenshot with no per-item rectangle quoted.
Evidence: `redesign/admin-ui-audit/_rowmenu-measurement.json`.

All four items share an **identical rectangle**:

| Width | Left | Right | Size | Visible | % on screen | Centre tap works? |
|---|---:|---:|---|---:|---:|---|
| 320 | 195 | 485 | 290×44 | 125px | **43.1%** | **No** — centre falls at x = 340 |
| 375 | 147 | 485 | 338×44 | 228px | 67.5% | Yes (centre at x = 316) |
| 414 | 147 | 485 | 338×44 | 267px | 79.0% | Yes |

"Start new booking", "View client profile", "View audit history" and "Delete client" are **equally**
clipped, to the pixel, at every width. There is no dangerous asymmetry.
⛔ **This claim must not re-enter the plan in any form.**

**✅ The real, measured defect that replaces it — and it is carried forward.** The menu opens **165px
past the right edge** (right = 485 in a 320px screen). Every item is ~57% clipped at 320px, and **each
item's centre point falls at x = 340, outside the screen**, so a tap aimed at the middle of a row lands
on nothing. Only the leftmost ~125px of each row is reachable.

That defect is carried by **FIX 7 (CAUSE-09)**, and it is not a popover bug. The menu's own collision
handling already pulled it 50.8px left and then ran out of room, because the "…" button itself sits at
x 491.8–535.8 — **entirely outside a 320px screen**. Cap the row and the button returns to roughly
x 248–292, at which point the menu should seat itself on screen unaided. ⛔ **Anyone who reworks the
popover first may be solving a problem that FIX 7 deletes.** The prediction (right edge 485 → ~312,
43.1% → 100%, centre tap false → true) is arithmetic and needs the fresh probe listed in FIX 7's
verification.

### 6.3 Two causes where the premise was wrong — change nothing

**CAUSE-12 · `src/app/admin/clients/components/BulkDeleteToolbar.tsx:195` · 476 rows · RECOMMENDATION:
NO CODE CHANGE.**
The cause says a 16×16px checkbox is "the entire tap target … with no enlarged wrapping label". It is
not. Line **189** wraps it in a label that is **44×44px on phones** and 36×36px on desktop, and a
wrapping label natively activates the control inside it — so the operable target is comfortably above
24px at **all five** widths. The audit already says so itself, at `findings/clients.md:116`: *"Effective
target 44 px."* The 476 rows are a measurement artefact: the harness read the input's own rectangle and
never credited the label, and **zero `<label>` elements appear in the small-target list for that cell**
while the flagged input's own selector literally names its label parent.
**Correct action:** reclassify the 476 rows as false positives and fix the harness rule (credit the
nearest ancestor or associated label when the flagged element is an input). ⛔ If a code change is
demanded anyway, the minimum is one token — `size-4` → `size-6` on `:195` — but it would silently close
476 audit rows **without improving anyone's ability to tap anything**.
⛔ **Never fix this with a global `input[type="checkbox"]` rule** — that would reach the **public**
consent panel (`ConsentPreferencesPanel.tsx:110`) and the **public** booking confirm step
(`ConfirmStep.tsx:218/237/257`).
⚠️ **One genuine defect in the same family that this does NOT cover:**
`src/app/admin/staff/[staffId]/availability/StaffBlockedDatesManager.tsx:236` — its label has no minimum
height, giving a ~20px operable target. **That deserves its own one-class fix and should be split out
as its own cause.**

**CAUSE-15 · `src/app/admin/components/charts/SparklineChart.tsx:34` · 267 rows · RECOMMENDATION: NO
CODE CHANGE; fix the harness.**
The cause blames a slot that "reserves height but no width" at `KpiTile.tsx:61`. That is wrong, and the
prescribed fix is a no-op: that slot never appears in the digest at all, and the chart library sizes the
chart correctly from it (347px at 1280, 238px at 320). The 0px box is written **unconditionally one
level deeper** by the charting library itself, and the library's own source comment says the zero-size
box is **required** so the chart can shrink. It is an auto-sizer, not a collapse.
What the 267 rows really are: 5 DOM elements. **170** are sparklines on `/admin/reports` only; **97** are
a completely different, taller chart on `/admin/me` and `/admin/staff/[id]/performance` — **no edit to
`SparklineChart.tsx` can remove those.** Nothing is clipped: at 320 the widest painted edge is 267 inside
a 320px screen. The audit's own area report already records this as *"nothing visibly broken… user
impact is unproven."*
**Correct action:** teach the harness to skip the chart library's own measuring wrapper in
`capture.mjs`. That resolves 267 of 267 rows with **zero** production risk.
⛔ If a code change is insisted on, it means replacing a third-party layout engine inside a component
that also renders on three pages contributing **zero** rows today — that is putting clean pages at risk
to tidy up measurement noise, and it changes the shape of every sparkline at every width including 1280.

### 6.4 Two disputed fixes kept as optional polish

**FIX 17 (CAUSE-10, 618 rows)** and **FIX 18 (CAUSE-16, 268 rows)** are both in the tap-target class the
scope guard rules entirely out of scope. Both are one-line, layout-neutral and cheap; neither is the
owner's complaint. They are ranked in section 1 for completeness but sit **outside the core run**. ⛔ The
disagreement is recorded rather than resolved: the scope guard says these are taste; the blast-radius
analysis says they are cheap wins. **The owner decides.**

### 6.5 Patterns worth knowing about but not scheduled

- **The silent side-scroller** — non-shrinking chips inside a scrolling strip with no fade, arrow,
  scrollbar or partial peek: **610 rows** across all 8 areas and all 32 pages, in exactly **9 distinct
  containers**. Three of them are fixed here (CAUSE-06, CAUSE-11, plus `dashboard-filters-client.tsx:342`
  at 136 rows is **not**). If the owner asks for it separately, it is a 9-place affordance job.
- **Tiny text that survives the scope guard** — 1,844 rows, but they collapse to **8 component sites**,
  all located except one: `notification-card.tsx:215-219` (855 rows), `notification-bell.tsx:744` (615),
  `dashboard-cards.tsx:1231` (102) and `:1395` (68), `dashboard-filters-client.tsx:336` (102), and one
  10px "New" chip (102 rows) that could **not** be pinned to a single line — it is one of
  `dashboard-cards.tsx:642`, `dashboard-cards.tsx:883` or `RecentClientsStrip.tsx:84`. Fix these as one
  small change, not as 1,844 items. LOW priority.
- **Rejected as false positives, each verified from the artefacts rather than assumed:** 717 rows clipped
  by a collapsed accordion; two findings that both resolve to a closed disclosure element at
  `BusinessDashboard.tsx:345` whose captured HTML shows no `open` attribute, so the "covered" content was
  never painted; and 261 rows inside the mobile More sheet, where the harness stopped at the first
  hidden-overflow ancestor and never inspected the real scrolling box sitting between at
  `AdminTopNav.tsx:825`.
- **Located but with zero measured symptoms, and therefore not scheduled:**
  `src/app/admin/components/admin-ui.tsx:982` (the mobile action bar holding the manual booking form's
  Continue/Submit) geometrically collides with the tab bar across 320–767px, but the only sample was at
  scroll position 0 where the bar sits below the fold. ⛔ **Default to HIGH RISK**: usage cannot be
  enumerated from one scroll sample, and the geometry is the same collision proven dead in FIX 15 and
  FIX 16.

---

## 7. What this plan cannot promise

### 7.1 ⛔ The therapist role is under-measured. Do not read a low count as a clean bill of health.

`therapist_a` is **"Test Therapist"** (`884311b1-…`), an account with **zero assigned bookings**. Their
list screens render **empty states**, and **an empty list cannot overflow**.

**The proof is in the data, and it names itself.** Compare `therapist_a` to `owner`:

| Defect class | Driven by | therapist_a | owner | Ratio |
|---|---|---:|---:|---|
| off-right-edge | **row content** | 188 | 3,175 | **16.9× fewer** |
| clipped-by-overflow-hidden | **row content** | 607 | 4,039 | 6.7× fewer |
| content-wider-than-box | **row content** | 1,163 | 4,186 | 3.6× fewer |
| covered-by-fixed-or-sticky | **chrome** | **3,568** | 3,192 | **HIGHER** |

Every content-driven class collapses; the one chrome-driven class is **higher for the therapist than for
the owner**. Chrome stays flat while content vanishes. ⛔ That is proof the collapse is the empty
account, not a sounder layout. Overall, `therapist_a` carries 11,760 of 89,568 rows against owner 28,084,
admin 27,319 and coordinator 22,405 — the lowest of the four, for a role captured across all 32 pages at
all 5 widths.

**Fixes that would very likely show MORE symptoms with a real therapist's data**

| Fix | Cause | Why the measured number is a floor, not a reading |
|---|---|---|
| FIX 3 | CAUSE-05 | The tab bar covers whatever occupies the bottom 57px, so the hit rate scales directly with how many controls the page renders. therapist_a contributes 256 of 1,930 rows against owner's 723 — but `therapist_a/privacy/320` has 0 obscured controls, 1 small target and 1 scroller against owner's 2 / 8 / 15 **on the same page**. That is an emptier page, not a safer one. 490 of the 1,930 rows are "covered while scrolled" — a kind that only exists when there is enough content to scroll. |
| FIX 5 | CAUSE-07 | ⛔ **`/admin/emails` is not covered by the permission-refusal carve-out below — therapist_a really does render this page**, measuring `counts.outOfBounds` **12** at 320 and **2** at 375. The tab strip itself is honestly measured, because its width comes from the labels and the role gating rather than from rows: owner, admin and coordinator get 4 tabs (strip 444.94, column 412.94) and therapist_a gets 3 (strip 350, column 318). But the **page around it** is under-measured for every role: all 20 captured cells rendered an **empty** delivery feed, and the Reminders and Reviews tabs were never the active tab in any capture. Real traffic fills that feed with real email addresses; a therapist with bookings fills the Reminders tab. That is exactly why the fix caps the column rather than only shrinking the nav — the cap holds whichever child turns out to be widest. |
| FIX 4 | CAUSE-06 | All 91 of therapist_a's rows are at 320 and none at 375/414, because an account with no notifications renders no count badges and the chip strip measures 314px instead of 434px. **314 clears 375's 317px window by three pixels.** One unread notification adds ~22px to a chip — enough to push 375 into overflow; two or three push 414 over. |
| FIX 11 | CAUSE-11 | therapist_a's shorter strip is **still** 452px in a 296px box, with "More" 139.84px out and flagged fully off screen — and every count badge widens as real bookings appear. In the captured menu all five overflow items are a uniform 194×44 with a trailing count that grows. **At 375, the owner strip has 2.5px of slack; one two-digit badge consumes it.** |
| FIX 8 | CAUSE-14 | therapist_a is **not** healthy here — 100 out-of-bounds at 320 with an empty page behind it, because a therapist viewing their own profile sees their own email. The captured "Assigned bookings 0 upcoming · 0 past" panel contributes almost nothing today; fill it with real client names, service titles and dates and those become **new** width drivers inside the same uncapped column chain (the nested grids at `:516` and `:518` are uncapped below 1280 too). A real therapist would score **higher**, not lower. |
| FIX 15 | CAUSE-21 | ⛔ **The measured symptom is the mildest one this bug can produce.** With no bookings the therapist falls through to the fallback action, "Set my availability →". A therapist with real work gets the **first** rung instead — "Open in Maps" and "Call client" — in the **same** bar at the **same** coordinates. What goes dead becomes tap-to-navigate to the client's address and tap-to-call, on the way to a visit. Same 100% coverage, much higher stakes. The bar also gets **taller** with real data (two buttons instead of one), so more of it sits in the dead band. |
| FIX 16 | CAUSE-22 | The row count will not grow, but the **label changes**: "Browse claimable" only appears because the upcoming-work list is empty. A therapist with an assignment gets "Go to my next visit". ⛔ Any post-fix check must match all three labels. |
| FIX 19, FIX 20 | CAUSE-02, CAUSE-03 | therapist_a contributes just **156 of 8,153** clip rows (1.9%) and **74 of 7,718** masked rows — all 74 at 320px on three pages. They contribute **zero** on clients, bookings, enquiries and calendar, the four pages carrying the other roles' worst rows. A therapist with a real caseload should be expected to land in the same **2,300–2,800** row band as coordinator, not at 156. ⛔ **Do not sign these fixes off against therapist_a cells** — re-measure with a seeded therapist who owns bookings. |
| FIX 1 | CAUSE-01 | The 768 zero is **real for the rail** (a therapist's nav is genuinely shorter) but it is a **hairline, not headroom**: their account button ends at exactly 744.00 against the 744px inner edge — about **12px** of spare. A 9- or 10-character real first name adds roughly 35–45px. And a therapist whose availability permission is set to "all" gains a fourth nav item, "My availability", the longest label in the nav — about 125px of new content, putting them roughly **113px past the edge**, i.e. straight into the same failure. |

**Where the therapist gap does NOT apply, checked rather than assumed.** On `/admin/clients`,
`/admin/enquiries`, `/admin/audit`, `/admin/services`, `/admin/operations`, `/admin/availability`,
`/admin/staff` and `/admin/settings`, therapist_a's zeros are **permission refusals**, not empty lists —
their captured pages read "You don't have access to this section", "Services access limited",
"Operational events access limited" and so on. No volume of real data changes that. ⛔ **`/admin/emails`
is deliberately absent from that list** — therapist_a renders it for real (12 out-of-bounds at 320, 2 at
375), so FIX 5 is covered by the gap, not by this carve-out. And on FIX 2
(CAUSE-04) the tab labels are hard-coded strings, so a therapist with 200 bookings renders byte-identical
text — therapist_a already carries 1,090 of that cause's 4,558 rows, more than owner's 996.

**⛔ Standing instruction:** re-capture with a therapist who owns real bookings before signing off FIX 3,
FIX 4, **FIX 5**, FIX 8, FIX 11, FIX 15, FIX 16, FIX 19 and FIX 20.
⛔ **FIX 5 needs one extra ingredient the others do not:** a **populated delivery feed** as well as a
booked therapist. All 20 captured `/admin/emails` cells rendered an empty feed, so the page's real
width drivers have never been on screen for any role.

### 7.2 Blast radius that could not be fully enumerated

**One cause is formally incomplete:**

- **CAUSE-03 (`src/app/globals.css:42`)** — `usageEnumerationComplete: false`. Two irreducible gaps:
  (1) **what the rule currently hides on the 12 non-admin routes is unknown** — 640 of 640 captured cells
  are admin and the capture notes never mention the public site; (2) `react-day-picker/style.css` is
  imported globally at `src/app/layout.tsx:3` and **is not present as a `.css` file under `node_modules`
  on this disk**, so it could not be ruled out as setting an html/body overflow rule of its own.

**Six coverage gaps where the source was fully enumerated but the runtime was not:**

- **CAUSE-13** — the two `/admin/enquiries` call sites (`EnquiryList.tsx:498` and `:528`) were **never
  measured at any width or role**, and the menu was **never opened at 768 or 1280 anywhere**, because the
  harness gates menu opening at ≤768px and caps at the first 3 menus per page. The no-regression claim at
  those widths is structural, not measured.
- **CAUSE-06** — the capture recorded **0 open menus across all 128 cells at 1280**, so the 1280 claim
  rests on structure plus a 768 measurement.
- **CAUSE-09** — line `:670` (the "last visit" sort branch) has **literally zero** measured rows, because
  "name" is the default sort. It is edited blind. `clients/loading.tsx:11` carries the same class string
  and was never captured at all — ruled out by arithmetic, not evidence.
- **CAUSE-07** — all 20 captured cells of `/admin/emails` rendered an **empty** delivery feed, and the
  Reminders and Reviews tabs were never the active tab in any capture.
- **CAUSE-11** — the two look-alike strips in the same file (`:441` saved views, `:519` active filters)
  **never rendered** during the capture and are entirely unmeasured.
- **CAUSE-04** — a therapist with availability access renders a **fifth** tab, "My availability", in
  **0 of 640 cells**. Its width is the only projected number in this plan.

### 7.3 Things the audit could not locate at all

- **Why the owner and admin dashboard cells were already scrolled at measurement time** (scroll 936 / 717
  / 675 / 484). Grepping the dashboard tree and the nav for auto-scroll calls found only focus handlers
  that do not run on load. It does not weaken CAUSE-02 — it is only what exposed it.
- **The 769–940px band.** By the derivation in section 3 the header needs 938–941px of screen
  (768px plus the 170–173px it is measured overflowing its own row by), so it cannot fit below
  **~941px** while the desktop layout is active — but only 768 was captured. Everything from 769 to
  1279 is **inference**.
- **Landscape phones.** `AdminTopNav.tsx:253-257` shortens the tab bar and hides its labels in landscape.
  **All 640 captures are portrait**, and it is the same bottom-space arithmetic FIX 15 depends on.
- **Desktop menus at 1280 were never opened** (`CAPTURE-NOTES.md §6`). ⛔ Absence of findings for the
  desktop account menu, search dialog and notification panel at 1280 **means nothing**.
- **The recurring-series screen has no auditable layout at all** (0 rows in the underlying table), and
  `/admin/calendar` rendered its empty state in all 20 cells — **the calendar grid that area exists to
  check was never measured.**
- **`occlusionSweepTotal = 0` on all 60 cells of `services`, `account-password-requests` and
  `password-reset`.** ⛔ Treat that as **unmeasured, not clean**.
- **858 "covered" rows whose occluder is recorded only as a bare `div`.** They could not be attributed, so
  per the high-risk default they survive and **should be triaged before anyone sizes the remaining work.**

### 7.4 Three numbers this plan is honest about not knowing

1. **What `/admin/clients` looks like after FIX 7.** Every counter goes to zero; the client's name goes to
   27.1px. The counters will report success that a human will not agree with.
2. **What the public site does after FIX 20.** Zero public cells were ever captured. The recommended
   admin-scoped change should make it a no-op, but "should" is doing work in that sentence.
3. **Whether 769–940px is fixed.** Nobody measured it. The arithmetic in section 3 says the header stops
   fitting below **~941px**, so that band changes — but there is no artefact to check it against, and
   nothing between 769 and 1279 was captured at all.

---

*Written against the artefacts in `redesign/admin-ui-audit/`. Every file:line quoted above was re-read in
`src/` before it was cited. No application file was modified.*
