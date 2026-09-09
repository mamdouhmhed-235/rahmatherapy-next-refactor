# THERAPIST VISUAL AUDIT — findings

**Run** 2026-09-03 · HEAD `bc6e5e8` · 160 cells (32 pages × 5 widths), all HTTP 200
**Method** 8 reviewers reading screenshots + DOM + measurements, then **every finding
re-checked by an independent agent told to refute it by default**.

| | |
|---|---|
| raised | 84 |
| **confirmed** | **62** |
| refused on evidence | 22 |

---

## 1. Why this run exists, and what it proves

The therapist role scored almost clean in the original audit. That score was an
artefact: the account had **zero bookings**, so every list rendered empty, and an
empty list cannot overflow. Real data was seeded and the same 32 pages re-captured
against the **same commit**. Only the data changed:

| metric | empty account | with real work |
|---|---|---|
| elements past the right edge | 5 | **142** |
| clipped elements | 111 | **350** |
| unreachable controls | 15 | **35** |
| small-text instances | 435 | **998** |

**37 of 160 cells moved.** The original therapist result was not a clean bill of
health; it was an untested one.

---

## 2. ⛔ The single most important finding: `truncate` is broken on every `<p>`

Four separate reviewers hit variations of the same symptom — a client name sliced
mid-word with no "…" — before the cause was found. It is one CSS cascade bug.

**Measured proof, same page, same class, same capture:**

| element | computed `white-space` | result |
|---|---|---|
| `p.truncate` | **`normal`** | wraps, then gets sliced — no ellipsis |
| `span.truncate` | `nowrap` | truncates correctly |

**The cause** — [site-parity.css:76-81](src/styles/site-parity.css:76):

```css
p, h1, h2, h3 { margin: 0; text-wrap: balance; }
```

That file is imported **bare** at [layout.tsx:4](src/app/layout.tsx:4), so the rule is
**unlayered**. Tailwind's `.truncate` lives in `@layer utilities`
([globals.css:6](src/app/globals.css:6)). **Unlayered rules beat layered rules
regardless of specificity**, and `text-wrap: balance` sets the same longhand
(`text-wrap-mode`) that `white-space: nowrap` sets. So the nowrap half of `truncate`
is overwritten on every `<p>` in the app.

The `overflow: hidden` half survives — which is exactly why text is **cut but never
ellipsised**. `<span>` is untouched, which is why some truncation on the same screen
works and some does not.

**Blast radius:** 31 `<p class="truncate">` across 14 files, plus 2 headings.
✅ All of them are in `/admin` — **no public page uses the pattern**, so a fix is
admin-scoped and low risk.

**The surgical fix** keeps the public site byte-identical:

```css
p, h1, h2, h3 { margin: 0; }
html:not(:has(.admin-shell)) :is(p, h1, h2, h3) { text-wrap: balance; }
```

⚠️ Splitting the rule matters — scoping the whole block would also strip `margin: 0`
from admin paragraphs and move spacing everywhere.

This is the same class of bug as the `overflow-x: hidden` mask the earlier audit
found: a global rule in a file written for the customer site quietly breaking the
admin built on top of it.

---

## 3. What the numbers could not see

Three of the four **blocking** findings are text being destroyed, not geometry:

- The dashboard gives a client name a **34px column** at 320 — narrower than one
  word. "Abdurrahman" renders as a five-line ragged stack, sliced mid-word.
- Calendar cards give the name **68px**, producing a 404px-tall card.
- The client-detail booking row collapses its text column to **47.75px**.

⛔ This is the lesson the earlier audit already recorded, now with a second proof:
**a page can measure perfectly and still be unreadable.**

---

## 4. ⚠️ Instrument limitations the reviewers exposed

The agents disproved several claims in my own briefing. These are corrections to the
*instrument*, and they matter for how every number in this audit should be read:

1. **`obscuredInteractive` has false positives.** Elements merely **below the fold**
   were counted as occluded. Both the calendar and emails "unreachable control"
   claims in my brief dissolved under checking.
2. **A raw count is not a count of problems.** The dashboard's "19 elements past the
   right edge" is **one** problem — a single claimable card plus its 18 descendants.
3. **`staff-id-availability`'s 13–14 clipped elements are correct behaviour** — a
   deliberately collapsed Sunday row. I had flagged it as the biggest change to
   investigate; it is a non-event.
4. **The `bookings-id` empty baseline was itself a refusal screen** (it pointed at a
   different booking the therapist could not open), so seeded-vs-empty deltas on that
   page compare two unlike things.
5. **Arabic renders in the correct order.** The bidi algorithm handles it. The real
   Arabic defect is font fallback and optical size, not direction.

---

## 5. Recurring causes behind many findings

| Cause | Findings it explains |
|---|---|
| The unlayered `text-wrap: balance` (§2) | every mid-word slice with no ellipsis |
| **Undefined `--status-*` tokens** | status chips drawn with bare white borders and no fill |
| **Tap targets of 16–28px** | "Show all 61", Add links, day switches, back links |
| **Names split on the first whitespace** | reduces the Arabic client to "عبد", drops the Chinese name |
| **Raw ISO timestamps in notification sheets** | machine dates beside human dates on the same screen |

---

## BLOCKING — 4

### B1. Client names in "Today's visits" wrap instead of truncating -- the name is crushed into a 34px column and cut mid-word with no ellipsis

- **Page:** dashboard / admin-root / login -- all three land on /admin/dashboard/
- **Widths:** 320,375
- **Exposed by the new data:** yes
- **Evidence:** 320/measure.json horizontalScrollers[3], selector `... > section.flex.flex-col.gap-3:nth-of-type(4) > ul.m-0.flex.list-none > li:nth-of-type(1) > a.flex.items-center.gap-3 > div.min-w-0.flex-1 > p.truncate.text-sm.font-semibold`, text "Abdurrahman . 1-Hour Massage Therapy": clientWidth 34, scrollWidth 94, hiddenPx 60, rect.h 100, style.whiteSpace "normal", style.overflowX "hidden". A 100px-tall single-line <p> is five wrapped lines. Same element on the other rows: "عبد . Supreme Combo Package" cw 34 / sw 62 / h 80; "Zhang . 30-Min Massage Therapy" cw 50 / sw 59 / h 100; "Fatima . Fire Package" cw 34 / sw 57 / h 60. At 375 "Abdurrahman..." is still cw 89 / sw 94 / h 80. Row height blows out with it: 320/measure.json occlusionSweep reports the Zhang row `a` at 246x142 and 375 at 301x102, against 598x62 for the same row at 768. The element carries class `truncate` but computes whiteSpace:no
- **Why it matters:** On a phone the therapist cannot read who any of today's six visits are with. The name column is 34 CSS px -- narrower than one word -- so "Abdurrahman" renders as a five-line ragged stack with its longest word sliced through the middle and no "..." to signal that anything was cut. The 08:00, 10:30, 13:00, 16:30 and 18:30 rows are all affected. This is exactly the /admin/clients "N..." failure the earlier audit called its most important lesson, except here geometry does see it and it was still missed because the empty account had no rows to break.
- **Likely cause:** src/styles/site-parity.css:76-81 declares `p, h1, h2, h3 { margin: 0; text-wrap: balance; }`. site-parity.css is imported bare in src/app/layout.tsx:4, so that rule is UNLAYERED, while Tailwind's `.truncate` lives in `@layer utilities` (src/app/globals.css:6). Unlayered rules beat layered ones regardless of specificity, so `text-wrap: balance` overwrites the `white-space: nowrap` half of `.truncate` on every <p> in the app -- the `overflow:hidden` half survives, which is why text is clipped but never ellipsised. <span class="truncate"> is untouched, which is why some truncation on this page works and some does not. Fix the cascade (scope the site-parity `p` rule, or move it into @layer base)

### B2. The whole `--status-*` colour family is undefined, so "Open to claim" is drawn with a stark white border and no fill, and Confirmed / Pending / Done are visually identical

- **Page:** dashboard / admin-root / login -- /admin/dashboard/
- **Widths:** all
- **Exposed by the new data:** yes
- **Evidence:** 768/dom.html: `<section aria-labelledby="claimable-heading" ... style="background-color: var(--status-attention-bg); border-color: var(--status-attention-text);">`, and every row pill/avatar `style="background-color: var(--status-confirmed-bg); color: var(--status-confirmed-text);"` / `var(--status-pending-bg)`. `grep -rn -- "--status-[a-z]*-bg *:" src/` returns NOTHING -- these custom properties are never defined; only the `--admin-status-*` family exists (src/styles/tokens.css:152, 551, 792, 1018). Undefined var() with no fallback makes the declaration invalid at computed-value time, so background-color falls back to transparent and border-color falls back to currentColor. Pixel proof in 768/screenshot.png: the "Open to claim" left border at (64,1250) is rgb(244,242,234) and its interior at (65,1250) is rgb(17,15,11) = bare page canvas, while every other card's border at (64,900) is rg
- **Why it matters:** Two things at once. (a) The single most important card on the therapist's dashboard -- the claimable-work CTA, meant to be an amber attention panel -- is instead the only element on the page outlined in glaring near-white, so the page's visual hierarchy points at the wrong thing and looks broken. (b) A therapist scanning today's list cannot tell a Pending visit from a Confirmed or a Done one by colour; all five pills are the same colourless text on the same background, distinguishable only by reading a 12px word and a 12px icon. Status colour is the whole point of a status pill.
- **Likely cause:** src/app/admin/dashboard/PractitionerTodaySection.tsx:157, 412, 467, 522, RecentClientsStrip.tsx:74 and TherapistDashboard.tsx:559, 951 all reference `var(--status-*-bg)` / `var(--status-*-text)`. They should reference the defined admin family `var(--admin-status-*-bg)` / `var(--admin-status-*-text)`, as the count badges in the same file already do. Note PractitionerTodaySection.tsx:412 also hardcodes the CONFIRMED token for every avatar regardless of the booking's real status, so the Pending 13:00 row's avatar is styled confirmed -- currently invisible, but it will be wrong the moment the tokens are fixed.

### B3. Calendar booking cards give the client name a 68px column at 320 — one word per line, 404px tall

- **Page:** calendar (/admin/calendar/)
- **Widths:** 320
- **Exposed by the new data:** yes
- **Evidence:** calendar/320/measure.json: article.grid.grid-cols-[4.25rem_minmax(0,1fr)] computes gridTemplateColumns: "68px 68px" inside a card only 182px wide. Its content column div.min-w-0 for the 08:00 booking measures rect w=68, h=404, scrollWidth=98, clientWidth=68, hiddenPx=30, scrollable=false. Same 68px column for every card: Arabic row h=244, CJK row h=240, Sana Iqbal h=216, Fatima Noor group h=361. The badge row div.mt-2.flex.flex-wrap "confirmedGroup · 3Partially assigned" is w=68 sw=98 h=97. Space is consumed by the 56px hour ruler (div.relative.w-14.shrink-0) + 12px pl-3 + 32px card padding + a fixed 4.25rem time column, leaving 68px of 320.
- **Why it matters:** On a 320px phone the therapist cannot read who a booking is with. "Abdurrahman Muhammad Al-Hassan Fitzgerald-Montgomery" renders one word per line down 404px, so a single booking that is 60px tall on a tablet becomes a 438px card, and the whole day (5 bookings) becomes a 1683px scroll. Because overflow is visible and scrollable=false, the status pills sit 30px wider than their column and spill roughly 13px past the card's rounded right border.
- **Likely cause:** The card grid keeps a fixed 4.25rem first column (grid-cols-[4.25rem_minmax(0,1fr)]) at every width, and the 56px hour ruler is never dropped on narrow screens, so the flexible name column is starved. It needs a stacked single-column card below ~380px, and the decorative hour gutter hidden.

### B4. Client detail booking-history row collapses its text column to 47.75px at 320

- **Page:** clients-id (/admin/clients/c1111111-…-000000000001/)
- **Widths:** 320
- **Exposed by the new data:** yes
- **Evidence:** clients-id/320/measure.json, selector "… > a.block.rounded-[var(--admin-radius-card)].border > div.flex.flex-wrap.items-start > div.min-w-0.flex-1": rect w=47.75, h=288, scrollWidth=58, clientWidth=48, hiddenPx=10, scrollable=false. Its children measure: date p h=100 (5 lines for "3 Sept 2026 · 08:00"), p.mt-1.text-sm "1-Hour Massage Therapy" h=60 (3 lines), p.mt-1.truncate.text-xs address h=128 (8 lines). The row has 216px of card interior; the sibling price/status column is shrink-0 and takes 152px of it.
- **Why it matters:** The one list a therapist actually opens a client record for — their visits — becomes an unreadable 48px-wide ribbon of single words, 288px tall per booking, while the price and two status pills keep 152px. Date, service and address all become effectively unreadable on the smallest phone.
- **Likely cause:** div.flex.shrink-0.flex-col.items-end (price + "confirmed" + "paid" pills) is shrink-0, so its max-content width (~152px, the two pills refusing to wrap) wins over the flex-1 text column. The pill row needs to be allowed to wrap, or the whole row stacked below sm.

## MAJOR — 23

### M1. "NEXT VISIT: Nothing scheduled" sits on the same screen as "5 visits today" and a list of five future visits

- **Page:** dashboard / admin-root / login -- /admin/dashboard/
- **Widths:** all
- **Exposed by the new data:** yes
- **Evidence:** 768/dom.html main text, in document order: "Thursday 3 September . 08:00-19:30 . 5 visits today" ... "Next visit | Nothing scheduled" ... "Today's visits | 5 | AM | Abdurrahman . 1-Hour Massage Therapy | 08:00 | Confirmed | ... | ZW | Zhang . 30-Min Massage Therapy | 13:00 | Pending | FN | Fatima . Fire Package | 16:30 | Confirmed" ... "My week | 1 done . about 1h worked . 6 ahead". measure.json capturedAt is 2026-09-02T23:57:38Z = 00:57 local on Thursday 3 September, so all five of today's visits were still in the future when the page rendered. Visible without scrolling at 414: 414/screenshot.png shows "5 visits today" and the "NEXT VISIT / Nothing scheduled" tile in one frame. The EMPTY capture (raw-final/.../768) said "Nothing scheduled" alongside "Visits 0", which was correct -- the tile only became a lie once there were bookings.
- **Why it matters:** The tile a therapist checks first, to know where to be next, says there is nothing on. Four of the five listed visits had not happened yet. If they trust the tile they miss the 08:00.
- **Likely cause:** src/app/admin/dashboard/dashboard-helpers-b5.ts:176 builds the tile as `formatNextVisitLabel(context.nextAppointment)`; `context.nextAppointment` is empty even though PractitionerTodaySection is rendering five assignments for the same day and the weekly panel independently counts "6 ahead". The stripe is reading a different (or unfilled) source from the list beside it.

### M2. At 320 no claimable card ever fits: a 280px min-width card in a 246px scroll slot, with the second card 293px off the right edge and no scroll cue

- **Page:** dashboard / admin-root / login -- /admin/dashboard/
- **Widths:** 320,375,414
- **Exposed by the new data:** yes
- **Evidence:** All 19 entries of 320/measure.json outOfBounds are the second claim card and its descendants. Top entry: `... > section.flex.flex-col.gap-4:nth-of-type(5) > ul.m-0.flex.list-none > li.min-w-[280px].shrink-0.lg:min-w-0:nth-of-type(2)`, text "Claimable . Visit Saturday . 10:00 Available View Claim this booking", rect.w 280.86, overflowRightPx 293.52, fullyOffscreenRight true, scrollContainer {tag ul, scrollWidth 577, clientWidth 246}. Because the li min-width (280) exceeds the container clientWidth (246), even the FIRST card is 35px wider than the slot -- its "Claim this booking" button (measured 157.34 wide) is clipped at its right edge. Same fault at 375 (overflowRightPx 238.52, cw 301) and 414 (199.52, cw 340). EMPTY captures have outOfBounds 0 at every width. There is no fade or arrow affordance: the only fade-named class on the page, `therapist-dashboard-fade`, is an entrance animatio
- **Why it matters:** "Claim this booking" is the one action this dashboard exists to drive, and on a 320px phone the therapist sees one card with its claim button sliced off and gets no hint that a second claimable job exists to the right. This is not the accepted 768px nav strip -- that one at least has an edge fade; this has nothing.
- **Likely cause:** src/app/admin/dashboard/PractitionerTodaySection.tsx renders `<li class="min-w-[280px] shrink-0 lg:min-w-0">` inside `<ul class="... gap-3 overflow-x-auto ...">`. 280px is wider than the content column at every phone width (246 / 301 / 340). Either drop the min-width below the narrowest slot, stack the cards vertically under `sm`, or add a peek + edge fade so the scroller reads as a scroller.

### M3. Today's list runs backwards — the therapist's first session of the day is the last card, ~1,890px down on a phone

- **Page:** bookings (/admin/bookings/?view=today)
- **Widths:** all
- **Exposed by the new data:** yes
- **Evidence:** DOM order of `main#admin-main ... section.grid.gap-3 > div.grid.gap-3 > article` at every width is 18:30 (Sana Iqbal, completed) → 16:30 (Fatima Noor + 2 others) → 15:00 (Claimable) → 13:00 (Zhang Wei-Ming 张伟明) → 10:30 (عبد الرحمن...) → 08:00 (Abdurrahman Muhammad Al-Hassan Fitzgerald-Montgomery) — strictly descending by start time. Visible end-to-end in 768/screenshot.png and 1280/screenshot.png. Position on a phone, from 320/measure.json: the `article:nth-of-type(6) > ... span.sr-only` entry has rect.y 2051.5 and style.inset top "161px", so that card's top is ~1,890px; the pinned header is 57px tall and the bottom tab bar 56px, leaving a 527px usable viewport at 320x640.
- **Why it matters:** A therapist opening "Today" on her phone before her first appointment sees the 18:30 session she has already completed. To find the 08:00 one she is about to travel to, she scrolls roughly three and a half screens to the very bottom. The tab is called Today, not Recent — a day list that reads newest-first inverts the only ordering that is useful to the person doing the work.
- **Likely cause:** The therapist "Today" view appears to inherit the admin bookings list's default newest-first sort instead of ordering ascending by start time within the day.

### M4. Group participant rows lose their name↔status pairing when they wrap on a phone

- **Page:** bookings (/admin/bookings/?view=today), the 16:30 "Fatima Noor + 2 others" card
- **Widths:** 320,375,414
- **Exposed by the new data:** yes
- **Evidence:** `ul.grid.gap-1.5 > li.flex.flex-wrap.items-center.justify-between.gap-2.py-0.5.text-sm`, with the status as a sibling `span.shrink-0.text-xs`. Confirmed by magnifying 414/screenshot.png at the participant panel: "Fatima Noor (main) ♀" keeps "Assigned to Test Therapist" right-aligned on the same line; "Khadijah Suleiman-Abubakar ♀" fills the line, so its amber "Open — needs female therapist" drops to a second, LEFT-aligned line of its own; "Maryam Noor ♀" then fits again and its status returns to the right. The `<li>` separation is gap-1.5 (6px) while the two lines inside one wrapped `<li>` are a 20px line-height apart, and there is no divider, indent or background between participants.
- **Why it matters:** The standalone amber line sits between two names with nothing to say which one it belongs to — and it is physically closer to the name below it than the gap between participants suggests. A therapist deciding whether to claim this group booking has to work out which of three women still has no female therapist. Getting that wrong is a safeguarding error, not a cosmetic one.
- **Likely cause:** `flex-wrap` + `justify-between` on the `<li>`: the status is right-aligned while it fits on the line and left-aligned the moment it wraps. A two-column grid, or moving the status under the name as an indented sub-line with a real gap between participants, would hold the pairing at every width.

### M5. Opening Refine duplicates five input ids, so all five field labels in the phone sheet are dead

- **Page:** bookings — Refine bottom sheet (menu-2-Refine_Refine)
- **Widths:** 320,375,414
- **Exposed by the new data:** no
- **Evidence:** In 320/menu-2-Refine_Refine.html, `grep -o 'id="bookings-filter-search"'` returns 2 (same for -from, -to, -status, -assignment_status). The first occurrence is at offset 36637 inside `<div class="hidden md:block">` — display:none below 768px. The second is at offset 134786, inside the base-ui portal, and is the input the user can actually see. The base page with the sheet closed (320/dom.html) has exactly 1. Same 2x count at 375 and 414.
- **Why it matters:** `label[for]` resolves to the first element in tree order with that id, which here is the hidden desktop input. Tapping "Search", "From", "To", "Status" or "Assignment" in the sheet focuses a display:none field and nothing happens on screen — the label looks tappable and silently isn't. Screen readers pair the visible controls with the wrong elements too, and the document is invalid HTML while the sheet is open.
- **Likely cause:** The mobile sheet re-renders the same filter form component as the hidden desktop form instead of suppressing one copy or namespacing the ids per instance.

### M6. The booking reference in the page title renders as Roman numerals, not digits

- **Page:** bookings-id -> /admin/bookings/b1111111-0000-4000-8000-000000000001/
- **Widths:** all
- **Exposed by the new data:** yes
- **Evidence:** measure.json says h1 = ["#B1111111"], but the h1 is forced into the serif: <h1 ... style="font-family: var(--font-admin-serif), Georgia, serif;">#B1111111</h1> (1280/dom.html). The loaded serif is Cormorant Garamond (html carries cormorant_garamond_f0141b80-module__aFfjoq__variable), which uses old-style figures by default and no font-variant-numeric/lining-nums is set on the h1. In every screenshot (320, 375, 414, 768, 1280) the seven 1s render as identical short serifed I glyphs, so the heading reads "#BIIIIIII". The very same reference sits ~40px below it inside the summary card in the sans face as a clearly readable "#B1111111", and in the breadcrumb in monospace (font-feature-settings 'tnum' is used for the postcode elsewhere, so the codebase already knows about numeral features).
- **Why it matters:** The booking reference is what a therapist reads out on the phone, writes on paper, or matches against a list. As rendered they cannot tell a 1 from an I, and the same code shown twice on one screen looks like two different codes.
- **Likely cause:** The h1 inherits --font-admin-serif with no font-variant-numeric: lining-nums tabular-nums, so Cormorant Garamond's default old-style figures apply to a machine identifier.

### M7. The client's gender chip is dressed as a "pending" status, with a clock icon

- **Page:** bookings-id -> /admin/bookings/b1111111-0000-4000-8000-000000000001/
- **Widths:** all
- **Exposed by the new data:** yes
- **Evidence:** 320/dom.html: <span class="... text-[0.6875rem] px-2 py-0.5 bg-[var(--admin-status-pending-bg)] text-[var(--admin-status-pending-text)]"><svg class="lucide lucide-clock size-3 shrink-0">...</svg><span>female</span></span>. It renders (1280 screenshot, participant card) as an amber pill with a clock face reading "female", sitting directly beside the green "Confirmed" badge and the blue-grey lock chip "Needs female therapist". Measured at 320: span.inline-flex.shrink-0.items-center:nth-of-type(1) 69x20 at y=1162.
- **Why it matters:** Amber + clock is this admin's own visual language for "pending / waiting". A therapist glancing at a Confirmed booking sees a warning-coloured clock chip and will read it as something still outstanding, when it only states the client is female.
- **Likely cause:** The participant chip reuses the status-badge component and is passed the pending tone plus a clock icon, instead of a neutral tone with no status icon.

### M8. The two visit-outcome buttons are 32px tall, and the destructive one sits 8px from the benign one

- **Page:** bookings-id -> /admin/bookings/b1111111-0000-4000-8000-000000000001/
- **Widths:** 320,375,414
- **Exposed by the new data:** yes
- **Evidence:** Measured geometry (320/measure.json, menus[0].measure.clipped): "Mark complete" 112x32 at y=1636 and "Mark as no-show" 125x32 at y=1676; at 375 and 414 both are 32 tall and share one 32px row (div.mt-3.flex.flex-wrap w=267 / w=306, gap-2 = 8px). DOM class on both buttons: "... min-h-8 px-3 text-xs ...". On the same page and same widths, Save notes measures 110x44 and View on Maps 246x44 (h-11).
- **Why it matters:** These are the only two actions a therapist performs on this page all day, and they are the smallest buttons on it. At 375 and 414 an 8px gap separates "Mark complete" from "Mark as no-show" - a fat-finger miss marks a client who attended as a no-show.
- **Likely cause:** The assignment actions use the small button size (min-h-8, text-xs) that is fine on desktop but is never bumped to the 44px touch size at mobile widths, unlike h-11 sm:h-10 used by View on Maps.

### M9. At 320 the price breaks away from its own separator: "·" on one line, "£60.00" on the next

- **Page:** bookings-id -> /admin/bookings/b1111111-0000-4000-8000-000000000001/
- **Widths:** 320
- **Exposed by the new data:** yes
- **Evidence:** 320 (menus[0].measure.clipped): li.flex.items-baseline.gap-2 is 212x40 at y=1221; inside it span.text-[var(--admin-body)] ("1-Hour Massage Therapy") is 154x40 and span:nth-of-type(2) ("· £60.00") is 50x40 at left=216. Height 40 = two line boxes for BOTH spans, and the price span has been squeezed to 50px wide. At 375 and 414 the identical row measures h=20 with the price span 54px wide on a single line. 154 + 8 gap + 54 natural = 216 > the 212px available, so both flex children shrink and wrap.
- **Why it matters:** On the narrowest phone the money for the visit renders as a stray middot on one line with the amount beneath it, next to a service name broken in half - the one number a therapist checks before taking payment is the one that comes out mangled.
- **Likely cause:** A flex row with items-baseline and gap-2 lets both children shrink and wrap; the price span needs shrink-0 / whitespace-nowrap, or the row needs to wrap as a whole.

### M10. At 320 the three insight banners give the message only ~116px of a 320px screen, so two short sentences run to 4 and 6 lines and fill the whole first screen

- **Page:** reports — /admin/reports/
- **Widths:** 320
- **Exposed by the new data:** yes
- **Evidence:** dom.html: div.flex.items-center.gap-3.rounded-md.border.px-4.py-3 lays out [icon size-4] + p.min-w-0.flex-1 + a "View →" + button.size-7 on ONE row with no flex-wrap and no breakpoint. measure.json gives the siblings' geometry at 320: a "View →" rect left=187.72 w=61.31; button[aria-label="Dismiss insight: …"] rect left=261.03 w=28; content column main#admin-main > div.mx-auto.w-full.min-w-0 rect left=16 w=288. Card inner width = 288 − 32 (px-4) = 256; minus icon 16 + three gap-3 (36) + View 61.3 + dismiss 28 leaves ≈116px for the text. screenshot.png confirms: "Net collection rate fell to 36% — below the 95% benchmark." renders as 4 lines and "Outstanding revenue grew £360 vs last month — review unpaid bookings." as 6 lines, and the third banner is already cut by the fold.
- **Why it matters:** A therapist opening My report on a small phone sees the page title, a scope chip, and two alert paragraphs — and nothing else. Every number the page exists to show (bookings, new clients, utilisation, no-show rate) is pushed off the first screen by two sentences that would fit on one line each if they were allowed the full card width.
- **Likely cause:** The banner row never wraps: p.min-w-0.flex-1 competes with a fixed-width action link and dismiss button on the same flex line at every width. It needs flex-wrap (or a sm: breakpoint that drops the actions onto their own row) below ~400px.

### M11. Assigned bookings are not in date order — the last upcoming row jumps backwards from Tue 8 Sept to today

- **Page:** staff-id — /admin/staff/884311b1-e9d0-44b9-91f3-14188a3baf59/
- **Widths:** 375, 414, 768, 1280 (all widths where the data rendered)
- **Exposed by the new data:** yes
- **Evidence:** dom.html booking rows in DOM order: Thu 3 Sept 08:00, Thu 3 Sept 10:30, Thu 3 Sept 13:00, Fri 4 Sept 09:30, Sat 5 Sept 15:00, Tue 8 Sept 12:00, then Thu 3 Sept 16:30. Identical order at 375, 414 and 1280; visible in the 768 and 1280 screenshots as the final card under "7 upcoming · 5 past visible." reading "Fatima Noor / Thu 3 Sept · 16:30 / Luton" directly below "Fatima Noor / Tue 8 Sept · 12:00". The offending row is href="/admin/bookings/b1111111-0000-4000-8000-000000000014/", which seed/01-seed.sql line 42 confirms is the group booking, and seed/04-redate.sql line 21 re-dates to today.
- **Why it matters:** A therapist scanning her own profile for what is next reads the list top to bottom and stops at the first future date. A session at 16:30 TODAY sits below one on 8 September, five entries past where she would look — she can miss today's last appointment entirely.
- **Likely cause:** The upcoming list is not sorted by the booking date it displays. The one row out of place is the only one whose date was rewritten by 04-redate.sql, which suggests the ORDER BY is on a different column (created_at / id / a pre-redate date field) than the one rendered in the row.

### M12. Opening the "Availability mode" help on a phone squeezes the heading into a two-line stub and pushes the mode switch it explains off the bottom of the screen

- **Page:** staff-id-availability — /admin/staff/884311b1-e9d0-44b9-91f3-14188a3baf59/availability/
- **Widths:** 320, 375, 414
- **Exposed by the new data:** no
- **Evidence:** menu-1-When_should_I_use_custom_vs_global_hours_.png at 320, 375 and 414. dom.html shows why: `<div class="flex items-center gap-1.5">` holds the `<h2 id="availability-mode-heading">` and, as a sibling flex item, `<details class="group inline-block align-middle text-left">` whose open panel is `<p class="mt-2 max-w-prose rounded-[var(--admin-radius-control)] px-3 py-2 text-xs">`. Nothing positions the panel absolutely, so when it opens it competes with the heading for the row's width. At 320 the panel renders roughly 165 CSS px wide over 14 lines ("'Global hours' uses the / clinic-wide working / pattern from Settings." — three to four words a line), "Availability mode" is forced to wrap onto two lines beside it, and the `?` summary is left orphaned above the panel. The panel's last line sits at the very bottom of the 640px viewport, so the "Custom hours" pill and the Use-global-hours / C
- **Why it matters:** The one control this help text exists to explain disappears the moment you read the help. On a 320px phone the therapist reads a 14-line ribbon of three-word lines, then has to scroll to find the switch again.
- **Likely cause:** The open `<details>` panel is an in-flow sibling of the `<h2>` inside `flex items-center gap-1.5`. It needs to break out of that row — render the panel as a block under the whole heading row (move the `<p>` outside the flex container, or make the details `static` with an absolutely positioned panel).

### M13. The `truncate` class is inert on the booking address — text wraps and is then cut mid-word with no ellipsis

- **Page:** clients-id (/admin/clients/c1111111-…-000000000001/)
- **Widths:** 320
- **Exposed by the new data:** yes
- **Evidence:** clients-id/320/measure.json, p.mt-1.truncate.text-xs.text-[var(--admin-text-muted)] ("118 Kingsway Court, Flat 12B, Luton, LU4 8AB"): computed style whiteSpace = "normal" (truncate should force nowrap), overflowX = "hidden", scrollWidth=53, clientWidth=48, hiddenPx=5, scrollable=false, rect h=128. For contrast, calendar/320 span.min-w-0.truncate.text-xs computes whiteSpace = "nowrap" correctly from the same stylesheet chunks (both pages load /_next/static/chunks/0lup401wpur_5.css and 007_hdfr93q~f.css).
- **Why it matters:** The element is styled to truncate but does not: it wraps to 8 lines and then has its widest word ("Kingsway", 53px) sliced at 48px by overflow:hidden with no ellipsis and no way to scroll. The reader sees a chopped word rather than a clean "118 Kingsway Court…", so the address is both unreadable and silently incomplete.
- **Likely cause:** A rule later in the cascade is resetting white-space on this paragraph (it keeps truncate's overflow:hidden but loses its nowrap). Worth checking any admin print/typography rule that sets white-space on p.

### M14. Therapist attribution truncated to 38% of its width on every calendar card at 320

- **Page:** calendar (/admin/calendar/)
- **Widths:** 320
- **Exposed by the new data:** yes
- **Evidence:** calendar/320/measure.json horizontalScrollers: five identical entries for span.min-w-0.truncate.text-xs.text-[var(--admin-body)] "Test Therapist" — whiteSpace=nowrap, overflowX=hidden, rect w=32, scrollWidth=83, clientWidth=32, hiddenPx=51 (one per booking, at y=1067, 1357, 1643, 1977, 2312).
- **Why it matters:** 51 of the 83px needed are cut, so the name beside the avatar renders as roughly "Te…" on all five bookings. On a shared calendar the therapist cannot tell from the card who a visit is assigned to without opening it.
- **Likely cause:** Same 68px content column as the first finding — the avatar chip plus gap leaves 32px for the name. Hide the redundant name (the avatar already carries a title) below sm, or stack the card.

### M15. "Claimable today" count badge is unreadable in dark mode — 1.3:1 contrast

- **Page:** calendar (/admin/calendar/)
- **Widths:** 320,375,414,768
- **Exposed by the new data:** yes
- **Evidence:** Pixels sampled from calendar/768/screenshot.png (badge box x185-203, y376-393) and calendar/375/screenshot.png (x352-390, y1072-1106): pill background rgb(198,190,182), digit rgb(251,214,174) → contrast ratio ≈1.33:1 (WCAG AA text minimum is 4.5:1). Markup in calendar/*/dom.html: <span class="inline-flex items-center justify-center rounded-full bg-white/70 px-1.5 text-[0.6875rem] font-semibold tabular-nums">1</span> inside summary.flex.cursor-pointer — it inherits the amber --admin-status-attention-text from the summary. The desktop rail badge at 1280 uses a different, legible pair (bg rgb(65,39,12)).
- **Why it matters:** When the panel is collapsed — which is its default state on every phone and tablet capture — that digit is the only place the number of claimable visits is shown. At 1.3:1 it reads as an empty grey dot, so the therapist sees "Claimable today" with no count and has no reason to tap.
- **Likely cause:** bg-white/70 sets a light pill but no text colour, so the badge inherits the amber attention colour meant for the dark brown bar behind it. It needs an explicit dark foreground on the light pill (the same fix already applied to the 1280 rail badge).

### M16. Calendar hour ruler is hard-coded to 828px and stops lining up with the bookings

- **Page:** calendar (/admin/calendar/)
- **Widths:** 320,375,414
- **Exposed by the new data:** yes
- **Evidence:** calendar/*/dom.html at all five widths: <div aria-hidden="true" class="relative w-14 shrink-0 …" style="height: 828px;"> with absolutely positioned hour labels every 56px (07:00 at top:0px … 20:00 at top:728px). calendar/320/measure.json: the card column beside it, div.min-w-0.flex-1.pl-3, measures h=1683 — 2.03× the ruler. Visible directly in calendar/414/screenshot.png: the 08:00–09:00 card spans from beside the "07:00" label down past "10:00".
- **Why it matters:** The ruler promises that a card sits beside its hour. At 320 the last label (20:00) lands beside the third of five bookings, so an 18:30 visit appears in blank space with no time marker at all. A therapist scanning the day for a gap reads the wrong hour.
- **Likely cause:** The gutter height is a fixed pixel value (56px per hour) while the card list grows with its content, so any card taller than its slot desynchronises the two. Either size the ruler from the rendered list height or drop the ruler on narrow widths where cards can never match their slots.

### M17. Sticky date-range filter occupies 54% of the usable screen at 320

- **Page:** calendar (/admin/calendar/)
- **Widths:** 320
- **Exposed by the new data:** no
- **Evidence:** calendar/320/measure.json pinned: form.sticky.top-0.z-20 rect w=292 h=286 (vs h=234 at 375/414, h=126 at 768, h=74 at 1280). Usable scroller height at 320 = 640 viewport − 57 sticky header − 56 bottom tab bar = 527px, so the pinned form holds 286/527 = 54%. The 320 screenshot confirms the form stacks to five rows, with "Apply" alone on its own line.
- **Why it matters:** Once the therapist scrolls, a permanently pinned filter leaves about 241px — less than one booking card — for the calendar itself. Note this is NOT data-exposed: the EMPTY capture measures the identical h=286, so it is pre-existing code; it only became painful now that there is a day worth scrolling.
- **Likely cause:** The filter form is sticky at every breakpoint even though it only fits in one or two rows above 768. It should stop being sticky (or collapse behind a "Filters" disclosure) below ~640px.

### M18. At 768 the read-only form is squeezed to 2/5 width and three more fields truncate mid-word

- **Page:** emails-template-id, /admin/emails/templates/booking_confirmation/
- **Widths:** 768
- **Exposed by the new data:** no
- **Evidence:** dom.html: `<div class="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start">` — the form gets 2fr, the preview 3fr, so the form column is about 283px at 768. Screenshot shows Subject line as "{companyName} booking request receive" (the "d" is gone), Group-copy sentence as "This booking is for {participantCount} part", Footer contact line as "Questions? Reply to this email or call {co". All three are `readonly` inputs whose text is in `placeholder` with `value=""`, so none of them can be scrolled or caret-navigated to reveal the rest.
- **Why it matters:** 768 is the worst width on this page — worse than a 320 phone. A therapist on a tablet sees four fields and can read none of them to the end, so they cannot tell what subject line clients receive or what phone number the footer quotes.
- **Likely cause:** The 2fr/3fr split gives the preview more room than the form it is previewing; single-line inputs then clip placeholder text that cannot be scrolled.

### M19. The recipient email address is truncated at every width, including 1280, with no way to read it

- **Page:** emails, /admin/emails/
- **Widths:** all
- **Exposed by the new data:** yes
- **Evidence:** measure.horizontalScrollers: `... > li:nth-of-type(1) > article ... > p.mt-0.5.flex.flex-wrap:nth-of-type(2) > span.min-w-0.truncate`, text "abdurrahman.muhammad.al-hassan.fitzgerald-montgomery@averylongdomainname.example.test", scrollWidth 572 against clientWidth 202 (320, 370px hidden), 257 (375, 315px), 296 (414, 276px), 464 (768 and 1280, 108px hidden), with "scrollable": false and overflowX "hidden". The 320 screenshot renders "abdurrahman.muhammad.al-ha…"; 1280 renders "...@averylongdoma…". dom.html shows the span carries no title attribute.
- **Why it matters:** A therapist about to press "Send reminder" cannot see who it is going to. The address is the only disambiguator when two rows share a display name, and on a phone there is no hover tooltip to fall back on.
- **Likely cause:** `truncate` (overflow hidden + nowrap) on a one-line span with no title attribute and no wrap/break fallback for long unbroken addresses.

### M20. Every client-name link in the reminder list is a 20px-tall tap target

- **Page:** emails, /admin/emails/
- **Widths:** all
- **Exposed by the new data:** yes
- **Evidence:** measure.smallTargets, 6 anchors at every width: "عبد الرحمن بن محمد الحسني العبدلي" 184.05x20, "Zhang Wei-Ming 张伟明" 157.45x20 (twice), "Fatima Noor" 83.94x20 (twice), "Sana Iqbal" 72.05x20, plus "Abdurrahman Muhammad Al-Hassan Fitzgerald-Montgomery" 420.22x20 at 768/1280. The EMPTY capture (raw-final) has smallTargets length 1 at every width — the 1x1 skip link only.
- **Why it matters:** The client name is the only route from a reminder row to its booking. A 20px-high target on a touch screen is roughly half the 44px comfortable minimum, so a therapist checking a visit before reminding will regularly miss and hit the card instead.
- **Likely cause:** The anchor is an inline text run inside `div.flex.flex-wrap.items-center.gap-2` with no min-height or padding, so its hit area is exactly the 20px line box.

### M21. A therapist has no navigation link to /admin/emails at any width

- **Page:** emails, /admin/emails/
- **Widths:** all
- **Exposed by the new data:** no
- **Evidence:** Enumerating hrefs in the shell chrome of dom.html (from `<header` to `id="admin-main"`) gives exactly /admin/dashboard/, /admin/dashboard/, /admin/bookings/, /admin/staff/ at both 768 and 1280, and the same four in `nav.admin-bottom-tabbar` at 320. The mobile More sheet (menu-1-More_navigation_and_account_menu) contains only /admin/me/ and /admin/staff/884311b1-.../ plus Sign out; the 768 account menu screenshot shows only My Performance, Your profile, Sign out. Meanwhile the RSC payload in the same file grants `"emails":{"access":true,"dataScope":"operational"}`.
- **Why it matters:** The page renders 7 pending reminders and 5 review requests the therapist is allowed to act on, but there is no way to get to it except typing the URL. Effectively the work never gets done.
- **Likely cause:** The therapist nav variant lists My day / My bookings / Team only; the emails entry is granted in pageAccess but never rendered as a nav item or a More-sheet row.

### M22. At 320 the only button on the password-reset-token screen is entirely below the fold, and the email field is cut in half by the bottom tab bar

- **Page:** password-reset-token, which lands on /admin/password-reset/audit-no-such-token/
- **Widths:** 320
- **Exposed by the new data:** no
- **Evidence:** measure.json `obscuredInteractive` has exactly 1 entry: tag "button", text "Submit request", rect {top: 613.41, bottom: 661.41, x: 65, w: 190}, obscuredBy selector `... > nav.admin-bottom-tabbar.relative.z-40 > div.flex.h-14.items-stretch > a.relative.flex.flex-1:nth-of-type(3)`. The viewport is 320x640 (screenshot.png is 640x1280 at DPR 2; the sr-only element records inset "0px 321px 641px 0px"), and `pinned[0]` gives the sticky header as {y:0, h:57}. So the button's top edge (613.41) is already inside the 57px tab-bar band and its bottom edge (661.41) is 21px past the bottom of the viewport. The screenshot confirms it: the last thing visible is the `you@example.com` input sliced horizontally by the tab bar, with no scroll cue.
- **Why it matters:** This is the screen a therapist who is locked out of their account lands on. It reads as a dead end: a red "Not approved" badge, a half-drawn text box, and no visible way to submit a new request. The content is reachable (the shell's main is `overflow-y-auto`), but nothing on screen says so, and the tab bar looks like the bottom of the page.
- **Likely cause:** The standalone auth layout is rendered nested inside the admin shell. dom.html shows `<main class="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--admin-canvas)] px-6 py-12">` sitting inside `<main id="admin-main" ... class="... px-4 pb-6 pt-5 ...">`. The inner `py-12` stacks on the shell's `pt-5`, pushing the card 68px down (measured: card top edge at y=126 in the screenshot, header ends at 57) — which is roughly the amount by which the button misses the fold.

### M23. Both password-reset pages render a whole second full-page layout inside the admin shell: duplicate id="admin-main", two nested <main> landmarks, and a form squeezed to a 190px column

- **Page:** password-reset (/admin/password-reset/) and password-reset-token (/admin/password-reset/audit-no-such-token/)
- **Widths:** all
- **Exposed by the new data:** no
- **Evidence:** dom.html for these two keys contains `id="admin-main"` twice and `<main` twice at every width — outer `<main id="admin-main" tabindex="-1" class="relative min-h-0 min-w-0 flex-1 overflow-y-auto ... px-4 pb-6 pt-5 ...">` and, two levels in, `<main class="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--admin-canvas)] px-6 py-12" id="admin-main">`. All 11 refusal pages have exactly one `<main>` and one `id="admin-main"` (verified by count across all 65 cells). The width cost is measured: measure.json password-reset-token/320 records the `w-full` submit button at rect {x: 65, w: 190, right: 255} in a 320px viewport — 65px of empty gutter on each side, because three paddings stack (shell `px-4` = 16, nested main `px-6` = 24, article `p-6` = 24). The 11 refusal cards stack only `px-4` + `p-5`, giving a 248px content column.
- **Why it matters:** A therapist using the keyboard or a screen reader gets two landmarks both called "main" and an ambiguous `#admin-main` target for the "Skip to main content" link — on the one page they need when they cannot sign in. And on the narrowest phone the email field they have to type into is 190px wide, 23% narrower than every other card in the admin, with 41% of the screen given over to padding. That wasted width is the same defect that pushes the button off-screen in the finding above.
- **Likely cause:** The `/admin/password-reset` route ships its own standalone page shell (the version used when signed out) but is still wrapped by the admin layout when a signed-in user visits it. The inner shell should be dropped — or the route excluded from the admin layout — when the admin shell is already present.

## MINOR — 35

### M1. Client names are cut at the first space, which reduces the Arabic client to the fragment "عبد" and drops the Chinese name entirely

- **Page:** dashboard / admin-root / login -- /admin/dashboard/
- **Widths:** all
- **Exposed by the new data:** yes
- **Evidence:** Rendered text in 768/dom.html and visible in 768/screenshot.png: row 2 reads "عبد . Supreme Combo Package" for the seeded client `عبد الرحمن بن محمد الحسني العبدلي`, and row 3 reads "Zhang . 30-Min Massage Therapy" for `Zhang Wei-Ming 张伟明`. The characters 张伟明 appear nowhere in the page's main text. src/app/admin/dashboard/shared-helpers.ts:35-37: `export function getFirstName(name: string): string { return name.trim().split(/\s+/)[0] ?? name; }`. Applied at PractitionerTodaySection.tsx and RecentClientsStrip ("Sana" in the Recent clients card vs "Sana Iqbal" inside the weekly panel).
- **Why it matters:** "عبد" on its own is not a name -- it is the word "servant of", the first half of a compound given name, and it identifies nobody. "Zhang" is a surname shared by roughly 100 million people and the client's actual given name is discarded. A therapist about to knock on a door has no way to confirm they have the right client, and reading the name back to them would be wrong. Splitting on whitespace is a Western-name assumption; it fails on exactly the two names in the seed set that were chosen to test it.
- **Likely cause:** shared-helpers.ts:35 getFirstName. Prefer showing the full name and letting the (fixed) truncation handle overflow, or use a short display name captured on the client record rather than deriving one by splitting.

### M2. Arabic text falls back to a substitute face and renders about half the size of the Latin beside it; the Arabic avatar initials are an illegible smudge

- **Page:** dashboard / admin-root / login -- /admin/dashboard/
- **Widths:** all
- **Exposed by the new data:** yes
- **Evidence:** 768/screenshot.png, region x 95-395 / y 840-888 enlarged 7x: on the single line "عبد . Supreme Combo Package" the Arabic cluster is roughly half the cap height of the Latin words next to it and sits on a visibly different optical baseline. The avatar for the same row (initials "عا", from dom.html) renders as one unreadable joined stroke at size-8, where the neighbouring rows show crisp "AM", "ZW", "FN", "SI". The page's font stack is Latin-only -- the section heading declares `font-family: var(--font-urbanist), var(--font-work-sans), Arial, sans-serif` and the row <p> inherits the same body stack -- so the browser substitutes an unrelated system face with a different em size for the Arabic run.
- **Why it matters:** The one Arabic-named client on the list is the hardest row to read on the page, and their avatar carries no information at all. For a therapy service with Arabic-speaking clients this is the name most likely to be mis-read at the door.
- **Likely cause:** No Arabic-capable family in the font stack, so per-run fallback picks whatever the OS offers at a mismatched optical size. Add an Arabic face (e.g. Noto Sans Arabic) to the admin stack, and consider `dir="auto"` on the name element so the run's direction is honoured rather than inferred from the surrounding LTR paragraph.

### M3. Two panels on the same screen report different numbers for the same week -- 9 visits / 5.3h against 1 done + 6 ahead / about 1h

- **Page:** dashboard / admin-root / login -- /admin/dashboard/
- **Widths:** all
- **Exposed by the new data:** yes
- **Evidence:** 768/dom.html main text: "My contribution . This week ... Visits | 9 | Hours | 5.3h | Clients | 6" and, further down, "My week | 1 done . about 1h worked . 6 ahead" whose expanded panel repeats "This week | Visits done | 1 | Worked | about 1h | Ahead | 6 visits | Completion | 100%". 1 + 6 = 7, not 9. 1h is not 5.3h. Both blocks are labelled for the same period. Separately, "Clients | 6" sits above a "Recent clients -- Last 30 days" card that lists exactly one client (Sana). All of these read 0 / 0h / 0 consistently in the EMPTY capture, so the disagreement only appears once there is data.
- **Why it matters:** The therapist cannot tell which figure is their real workload, and "Completion 100%" is computed against the smaller denominator, so it reads as a perfect week while two of the nine visits are unaccounted for anywhere on the page.
- **Likely cause:** The stripe counts all assignments in the period (dashboard-helpers-b5.ts:189-190 `scorecard.clinical.assignmentsTotal`) and reports scheduled hours, while the weekly panel counts completed + upcoming and reports worked minutes. Two different definitions under near-identical labels. Either reconcile them or label them distinctly ("scheduled" vs "worked").

### M4. "Recent clients" appears twice on one page, showing the same client under two different names and two different dates

- **Page:** dashboard / admin-root / login -- /admin/dashboard/
- **Widths:** 320,375,414 (and any width where "My week" is expanded)
- **Exposed by the new data:** yes
- **Evidence:** 320/dom.html, which has the panel open (aria-expanded="true"), contains in document order: `Recent clients | Last 30 days | SI | Sana | Hijama Package | today`, then `<div id="business-overview-panel">` containing a second `Recent clients | SI | Sana Iqbal | Thursday`. Same person, same visit -- today IS Thursday 3 September per the h1 -- rendered as "Sana / today" in one card and "Sana Iqbal / Thursday" in the other. Both headings use the same h2 styling (`h2#recent-clients-heading` is the inner one). Neither card exists in the EMPTY capture.
- **Why it matters:** Scrolling the dashboard on a phone the therapist meets the same heading twice with contradictory-looking rows, and has to work out whether these are two clients or one. It also makes the page look unfinished.
- **Likely cause:** RecentClientsStrip is rendered both standalone and again inside the business-overview panel, with different name and date formatters. Drop one, or retitle the panel copy.

### M5. At 1280 the claimable list is forced into 3 columns for 2 cards, shrinking each card to ~189px so "Claim this booking" wraps to two lines

- **Page:** dashboard / admin-root / login -- /admin/dashboard/
- **Widths:** 1280
- **Exposed by the new data:** yes
- **Evidence:** 1280/dom.html: `<ul class="m-0 flex list-none gap-3 overflow-x-auto p-0 lg:grid lg:grid-cols-3 lg:overflow-visible">` with only two <li>. The page column is `max-w-[640px]` and the section is `p-5 sm:p-6`, so each of the three tracks is (640 - 48 - 2x12) / 3 = 189px -- narrower than the ~270px the same cards get at 768, i.e. a wider viewport produces smaller cards. Measured off 1280/screenshot.png: card 1 spans x 347-533 (186px) against card widths of about 270px in 768/screenshot.png. Consequence visible in the crop of 1280/screenshot.png at (315,1150)-(715,1450): both "Claim this booking" labels break onto two lines inside their h-11 button, the label block is no longer centred against its icon and the descender of "booking" reaches the button's bottom edge; card 1's title also wraps to two lines while card 2's does not, so the two "Available" pills and the two button stacks sit at dif
- **Why it matters:** The primary claim action looks squashed and misaligned on the widest screen, in a card that has 200px of empty space beside it. A two-line label in a fixed-height button is the classic sign of a layout fighting itself.
- **Likely cause:** `lg:grid-cols-3` is hardcoded regardless of item count. Use an auto-fit track (`grid-cols-[repeat(auto-fit,minmax(220px,1fr))]`) or cap the column count at the number of cards.

### M6. Notification sheet shows a raw machine date, then the same date again in a second format

- **Page:** dashboard -- /admin/dashboard/, notification popover (menu-*.png in the 320/375/414/768 cells)
- **Widths:** 320,375,414,768
- **Exposed by the new data:** yes
- **Evidence:** 320/menu-0-3_need_attention_3.html and 768/menu-1-3_need_attention_3.html both contain, on consecutive lines inside one notification: `2026-09-03 at 15:00` then `2026-09-03 . Today`. Visible in 320/menu-0-3_need_attention_3.png and 768/menu-1-3_need_attention_3.png. The empty account had no notifications, so this text never rendered before.
- **Why it matters:** Every other date on this dashboard is written as "Thursday 3 September" or "Saturday . 10:00"; this one is ISO. Printing the same date twice in two formats inside one card reads as a bug rather than as detail. Minor, and it may be shell-level -- the bell is on every admin page, so another reviewer may see it too; dedupe before acting.
- **Likely cause:** The notification body renders a raw timestamp while the meta line separately renders a relative label. Pick one and use the site's existing date formatter.

### M7. Refine sheet's search placeholder is sliced mid-letter at 320 — "booking IC"

- **Page:** bookings — Refine bottom sheet (menu-2-Refine_Refine)
- **Widths:** 320
- **Exposed by the new data:** no
- **Evidence:** `input#bookings-filter-search` with `placeholder="Client name, phone, or booking ID"` and `class="h-10 ... px-3 text-sm ..."`. Magnifying 320/menu-2-Refine_Refine.png at the field shows the final D cut vertically in half by the input's padding edge, so it reads "booking IC". The same crop of 375/menu-2-Refine_Refine.png shows the full string with room to spare, so this is 320-only.
- **Why it matters:** The placeholder is the only place the therapist is told she can search by booking ID at all. At 320 that capability is invisible — and a half-drawn letter reads as a rendering fault rather than as text that ran out of room.
- **Likely cause:** Fixed placeholder string against a field that is 264px wide inside the 304px sheet at 320. A shorter placeholder below a breakpoint, or hint text under the field, avoids it.

### M8. On a 320 phone, 57% of the screen is chrome before the first booking appears

- **Page:** bookings (/admin/bookings/?view=today)
- **Widths:** 320
- **Exposed by the new data:** no
- **Evidence:** From 320/measure.json: the first card's `article:nth-of-type(1) > ... span.sr-only` sits at rect.y 502.5 with style.inset top "137px", putting the first `<article>` top at ~365.5px. The pinned header (`header.sticky.top-0.z-40`) measures h 57, and the bottom tab bar (`nav.admin-bottom-tabbar > div.flex.h-14`) is 56px — the smallText "TT" entry inside it sits at y 590 in a 640px viewport. Usable list area is therefore 57→584 = 527px, of which the first booking gets the last 218px. Confirmed in 320/screenshot.png: the H1, the two-line description, a two-row wrapped tab strip and a separate Refine button fill everything above y≈366.
- **Why it matters:** No booking is fully readable on first paint at 320. The therapist must scroll before she can see a single complete session, and the page spends more than half the screen on a title and a strapline she already knows.
- **Likely cause:** H1 + description + wrapped tab row + a standalone Refine row are each on their own line at 320. Putting Refine on the tab row, or dropping the strapline below the sm breakpoint, would recover ~100px.

### M9. Notification sheet shows raw ISO timestamps where every booking card shows friendly dates

- **Page:** bookings — notification sheet (menu-0-3_need_attention_3)
- **Widths:** 320,375,414
- **Exposed by the new data:** yes
- **Evidence:** 320/menu-0-3_need_attention_3.png renders the claimable-booking notification as "2026-09-03 at 15:00" and, beneath it, "2026-09-03 · TODAY". The card for the same booking in 320/dom.html reads "3 Sept 2026 · 15:00 – 16:00". Two date formats for one booking, two taps apart.
- **Why it matters:** ISO dates read as debug output, and it undercuts trust in the notification the moment a therapist compares it with the list behind it. It also stacks badly: the "3" count badge drops onto its own line under the title and the "…" overflow button lands alone on a third line.
- **Likely cause:** The notification payload's timestamp is printed verbatim instead of going through the same date formatter the booking rows use. This is shared header chrome rather than the bookings list itself, so it may also belong to whoever reviews notifications — the content, though, is this page's data.

### M10. The email icon collapses to a 4px smudge floating beside the address

- **Page:** bookings-id -> /admin/bookings/b1111111-0000-4000-8000-000000000001/
- **Widths:** all
- **Exposed by the new data:** yes
- **Evidence:** 320 (menus[0].measure.clipped): svg.lucide.lucide-mail.size-3.5 measures w=4 h=14 - the class asks for 14x14 - and its child <rect> is 3x3. DOM (1280): <a href="mailto:..." class="-mx-2 inline-flex min-h-11 ... gap-2 break-all ..."><svg class="lucide lucide-mail size-3.5 ..."> with no shrink-0, while the sibling phone row uses the same pattern but a short value. Visible in the 375, 414, 768 and 1280 screenshots as a tiny square mark left of the email, vertically centred against a 3-4 line block so it sits opposite the middle line, not the first.
- **Why it matters:** The email row loses its label. Next to a proper phone glyph, the address reads as an unlabelled wall of text with a speck beside it, and the misaligned mark looks like a rendering glitch.
- **Likely cause:** The lucide-mail svg has no shrink-0, so with break-all text 85 characters long the flex item squeezes the icon to almost nothing; it also needs self-start rather than the row's default centre alignment.

### M11. On a phone the sidebar renders first, pushing the day's actions three-quarters of the way down a 2216px page

- **Page:** bookings-id -> /admin/bookings/b1111111-0000-4000-8000-000000000001/
- **Widths:** 320,375,414
- **Exposed by the new data:** yes
- **Evidence:** At 320 (menus[0].measure.clipped) the whole content column div.grid.min-w-0.gap-6 is 2216px tall in a 640px viewport. The sidebar wrapper div.order-1.md:order-2 (summary + client + visit location) occupies y=320-980; the main column div.grid.min-w-0.gap-6:nth-of-type(1) only starts at y=1004; the Assignment card starts at y=1447 and its two buttons at y=1636 - 74% down the page, 2.6 screens of scrolling. Same pattern at 375 (buttons at y=1480 of a 812 viewport) and 414 (y=1432 of 896). At 1280 they are on the first screen (y=673 of 800).
- **Why it matters:** Finishing a visit is the therapist's most frequent action of the day and on a phone it takes three swipes to reach, behind information they have already read on the way to the address.
- **Likely cause:** The mobile order (order-1 for the aside) puts summary/client/location above the main column; the outcome buttons live at the bottom of that main column with no sticky or top-of-page action affordance on mobile.

### M12. The reference and status are printed twice, and the 52-character client name four times, on one page

- **Page:** bookings-id -> /admin/bookings/b1111111-0000-4000-8000-000000000001/
- **Widths:** 320,375,414
- **Exposed by the new data:** yes
- **Evidence:** Page text (320 measure.json bodyTextHead plus the full text recovered from 320/menu-0-3_need_attention_3.html): "... #B1111111 Confirmed Abdurrahman Muhammad Al-Hassan Fitzgerald-Montgomery ... Participants Abdurrahman Muhammad Al-Hassan Fitzgerald-Montgomery main contact ... Assignment TT For Abdurrahman Muhammad Al-Hassan Fitzgerald-Montgomery Test Therapist ... AF Abdurrahman Muhammad Al-Hassan Fitzgerald-Montgomery". The 320 screenshot shows "#BIIIIIII Confirmed" in the header and "#B1111111 Confirmed" again in the card immediately below it, both in the first screenful. Cost in height at 320: the name renders as 3 lines in the h1 subtitle, 3 lines in the participant card (p 212x72 at y=1082), 3 lines at 12px muted in the assignment card (p 164x48 at y=1525) and 2 lines in the client card (div.min-w-0.flex-1 194 wide at y=480).
- **Why it matters:** Roughly a fifth of the 2216px phone page is the same name and the same reference repeated, which is exactly what pushes the buttons in the previous finding off-screen.
- **Likely cause:** The page header, the summary card, the participant list, the assignment row and the client card each independently print the identity, with no de-duplication at mobile widths.

### M13. On the refusal screen the icon's 48px circle is invisible - it is painted the same colour as the card

- **Page:** bookings-series-id -> /admin/bookings/series/00000000-0000-4000-8000-000000000000/
- **Widths:** all
- **Exposed by the new data:** no
- **Evidence:** 1280/dom.html: <section class="... bg-[var(--admin-status-restricted-bg)]"> contains <span class="inline-flex size-12 items-center justify-center rounded-full bg-[var(--admin-status-restricted-bg)]"> - the identical token for the chip and its own background. The 320, 768 and 1280 screenshots show a bare shield outline with no circle behind it. Everything else on this screen is sound: outOfBounds 0, clipped 0, obscuredInteractive 0 at all five widths, the card is centred, and both buttons are 40px tall and fully reachable.
- **Why it matters:** The intended icon medallion never appears, so the refusal reads as an unfinished panel rather than a designed empty state. Cosmetic only - the refusal itself behaves correctly.
- **Likely cause:** The circle uses the same --admin-status-restricted-bg variable as the section it sits in; it needs a distinct surface token.

### M14. At 768 the top nav labels wrap inside their pills ("My / day", "My / bookings")

- **Page:** bookings-id and bookings-series-id -> both admin routes, top chrome
- **Widths:** 768
- **Exposed by the new data:** no
- **Evidence:** The 768 screenshots for both of my page keys show the header pills with two-line labels: "My" over "day" and "My" over "bookings", while "Team" stays on one line; the active My bookings pill is visibly taller than its neighbours inside the 56px header (div.mx-auto.flex.h-14). Identical in the empty capture, so this is not data-related, and it is chrome shared by all 32 pages.
- **Why it matters:** The tablet header looks broken and the active tab bulges out of the bar. Flagged in case it is a different symptom from the accepted "768 nav strip scrolls" note - here, with only three therapist links, the strip does not scroll, it wraps.
- **Likely cause:** Nav pill labels have no whitespace-nowrap and the 768 header has no room for three padded pills plus the theme select, search, bell and account chip.

### M15. The long client name wraps to three lines instead of ellipsing, so one row is 125px tall against 84px for every other row

- **Page:** me (and staff-id-performance) — /admin/me/
- **Widths:** 320, 375, 414
- **Exposed by the new data:** yes
- **Evidence:** dom.html renders the name as <p class="truncate text-sm font-medium text-[var(--admin-body)]">Abdurrahman Muhammad Al-Hassan Fitzgerald-Montgomery</p> — markup that asks for one clipped line. measure.json horizontalScrollers gives the five li.py-3 heights: 320 → 125, 85, 85, 85, 84; 375 and 414 → 105, 85, 85, 69, 84; 768 and 1280 → 69, 69, 69, 69, 68. 125 − 69 = 56 decomposes only as 2×20 (an extra text-sm line, line-height 1.25rem) + 16 (an extra text-xs line); 105 − 69 = 36 = 20 + 16. Meta-line wrapping alone can only add multiples of 16, so 105 is unreachable without an extra name line. Independently, that <p> never appears in horizontalScrollers at any width even though 1×1 sr-only spans with 15px of overflow do — so it is not overflowing its 214px box, i.e. it is wrapping, not clipping.
- **Why it matters:** The therapist's next-visit list goes ragged: one client's row is half again as tall as the rest at 375/414 and nearly 50% taller at 320, which breaks the scanning rhythm of a list whose whole job is a quick glance at who is next. It also means the component's own guard against long names is silently doing nothing, so a longer name will keep growing the row rather than being cut off.
- **Likely cause:** The truncate utility is not taking effect on this <p> — white-space:nowrap is evidently not applied, though it IS applied to span.truncate elsewhere (measure.json @320 on /admin/reports records span.truncate with whiteSpace "nowrap", overflowX "hidden"). Worth checking the cascade for p inside the admin shell (globals.css deliberately omits Tailwind preflight and patches only button, ul/ol, fieldset, legend).

### M16. The filter caption contradicts the dates printed directly beneath it

- **Page:** reports — /admin/reports/
- **Widths:** 768, 1280 (inline form); 320, 375, 414 inside the Filters sheet
- **Exposed by the new data:** no
- **Evidence:** reports/768/dom.html: <p … role="status">This month: 1 September to 30 September</p> is immediately followed by input[name="from"] value="2026-09-01" and input[name="to"] value="2026-10-03". The same pair is visible in reports/768/screenshot.png and reports/1280/screenshot.png, and in reports/320/menu-1-Filters_Monthly.png the caption sits two rows above a To field reading 03/10/2026. Cross-page: me/414/dom.html labels the same "This month" preset <span class="ml-2 text-xs …">1 Sept – 3 Oct 2026</span>.
- **Why it matters:** The therapist is told the report covers September while the controls say it covers 1 Sept to 3 Oct, and the dashboard for the same preset says 1 Sept – 3 Oct. Every number on the page (10 bookings, £485 attributed, 1% utilisation) is being read against a window the caption misstates by three days.
- **Likely cause:** The caption is generated from the calendar month while the from/to values come from the range resolver, which evidently returns today+30 for the month preset (it read 1 Sept – 2 Oct in the EMPTY capture taken a day earlier).

### M17. The donut's centre figure "10" reads as "IO" in the serif display face

- **Page:** reports — /admin/reports/
- **Widths:** 320, 375, 414, 768, 1280
- **Exposed by the new data:** yes
- **Evidence:** reports/1280/dom.html: <p class="font-[var(--font-admin-serif),Georgia,serif] text-[1.778rem] font-bold leading-none …" style="font-family:var(--font-admin-serif), Georgia, serif">10</p>. reports/768/screenshot.png and reports/1280/screenshot.png both render it as what reads "IO BOOKINGS" at the donut centre — the Cormorant Garamond "1" is a plain serifed vertical stroke with no flag, so beside a lining "0" it reads as a capital I.
- **Why it matters:** The single headline number of the Bookings-by-status chart is ambiguous at a glance. The EMPTY capture showed "0", which has no such twin, so this only appears once there is real data — and it will recur for any count containing a 1 (1, 10–19, 21…).
- **Likely cause:** The serif display face is used for a digit-only value; either switch this one label to the sans/tabular face or enable lining figures for it.

### M18. Each KPI card ends with a permanently empty 44px reservation, so a phone shows barely two numbers per screen

- **Page:** me (and staff-id-performance) — /admin/me/
- **Widths:** 320, 375, 414
- **Exposed by the new data:** no
- **Evidence:** dom.html on me/320, me/414 and me/1280 each contain 4 instances of the empty element <div class="mt-3 min-h-[32px]"></div> (32px box + mt-3 12px = 44px) and 3 filled ones. Measured card heights from measure.json: the "Revenue attributed" card is 256×178 @320, 311×166 @375 and 350×166 @414. me/375/screenshot.png shows the whole 812px viewport containing only the greeting card plus "COMPLETED SESSIONS 3" and "HOURS WORKED 3.5h", each with roughly 90px of blank card beneath the number.
- **Why it matters:** The grid is one column below ~440px, so the reservation buys no cross-column alignment there — it just adds about 176px of guaranteed blank scrolling across the four cards that have no sub-line. With eight KPI cards at 166–178px each, the therapist scrolls roughly two full screens of mostly empty card before reaching the chart, the activity feed, or their next visit.
- **Likely cause:** min-h-[32px] on the optional sub-line slot is applied unconditionally; it should be dropped (or the slot omitted) at the single-column breakpoint.

### M19. "Show all 61" — the only route to the full activity feed — is a 20px-tall target at every width

- **Page:** me (and staff-id-performance) — /admin/me/
- **Widths:** all
- **Exposed by the new data:** no
- **Evidence:** measure.json smallTargets at 320, 375, 414, 768 and 1280 all list a "Show all 61" rect 97×20 (selector: div.mt-4.border-t… > div.flex.flex-wrap.items-center > a.inline-flex.items-center.gap-1), smallestDimensionPx 20. dom.html shows a bare a.inline-flex.items-center.gap-1.text-sm with no height or padding utility, unlike the Quick-links anchors on the same page which carry min-h-11.
- **Why it matters:** 20px is below the 24px WCAG 2.2 minimum and less than half the 44px a thumb needs, and it is the sole way out of the six-item activity preview into the other 55 entries. The Quick-links list two panels below already solves this with min-h-11, so the page is inconsistent with itself.
- **Likely cause:** No min-height / vertical padding on the panel-footer link, unlike the min-h-11 sm:min-h-9 pattern used for the Quick links.

### M20. Every day on/off switch in the weekly editor is 24px tall — the page's primary control is barely half the minimum touch target

- **Page:** staff-id-availability — /admin/staff/884311b1-e9d0-44b9-91f3-14188a3baf59/availability/
- **Widths:** all (320, 375, 414, 768, 1280)
- **Exposed by the new data:** yes
- **Evidence:** measure.json horizontalScrollers lists all six enabled switches with rect w=44 h=24 — e.g. at 320 `button[aria-label="Monday, working day"].relative.inline-flex.h-6.w-11` 44x24 @54,754, Tuesday @54,1035, Wednesday @54,1316, Thursday @54,1597, Friday @54,1878, Saturday @54,2159. Same 44x24 at 375, 414, 768 and 1280. They do not appear in `smallTargets` only because capture.mjs line 304 uses a 24px threshold (`r.width < 24 || r.height < 24`), which 24 exactly clears.
- **Why it matters:** Turning a working day on or off is the single most consequential action on this page — it decides whether the booking engine offers that day at all. On a phone a 24px-tall switch stacked in a scrolling list is easy to miss and easy to hit by accident while scrolling.
- **Likely cause:** `h-6 w-11` (24x44) on the switch with no padded hit area. The seven-day editor only renders now that custom rules exist — the empty capture showed the global-hours explainer instead (elementCount 272 vs 435), so these seven switches did not exist to be measured before.

### M21. At 768 the "All day" checkbox is drawn on top of the Date field's right-hand border

- **Page:** staff-id-availability — /admin/staff/884311b1-e9d0-44b9-91f3-14188a3baf59/availability/
- **Widths:** 768
- **Exposed by the new data:** no
- **Evidence:** 768/screenshot.png, Blocked dates form. On a 10x crop of the region x 170–280, y 1915–1980 the blue checkbox occupies roughly x 208–224.5 while the date input's rounded right border sits at about x 217 — the checkbox overlaps it by around 9px. The same region at 1280 (3x crop, x 60–480, y 1850–1960) is clean with a clear gap. dom.html: `<form data-redesign-fake="staff-blocked-dates-actions" class="grid gap-3 … sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,2fr)_auto] sm:items-end">` — the date column is `minmax(0,1fr)` and the `<input type="date" class="flex h-10 w-full …">` inside it keeps a UA intrinsic minimum width, so at 768 it overruns its track into the `auto` column that holds the checkbox.
- **Why it matters:** Two adjacent controls visibly collide on a tablet, which reads as a broken form on the one screen where a therapist blocks out a holiday.
- **Likely cause:** The `minmax(0,1fr)` date track shrinks below the native date input's minimum width at 768; the input overflows right, under the next grid item. Only bites between the sm breakpoint (640) and roughly 900px — below 640 the form stacks and at 1280 the tracks are wide enough.

### M22. Staff search placeholder is chopped mid-word to "Search by name or em", and the Apply button is wider than the field it submits

- **Page:** staff — /admin/staff/
- **Widths:** 768
- **Exposed by the new data:** no
- **Evidence:** 768/screenshot.png, 3x crop of x 30–450, y 230–290: the field reads "Search by name or em" with no ellipsis; dom.html gives the full placeholder as "Search by name or email". The input measures about 178px wide, the "Apply filters" button beside it about 205px, inside a 690px card whose right half is empty. Cause in dom.html: `<form method="get" action="/admin/staff" class="grid w-full min-w-0 gap-3 sm:grid-cols-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">` — a five-track template with only two children, so the search input is pinned to the 1.4fr track while 1.6fr + 1fr + 1fr stay empty. At 1280 the same template is wide enough that the placeholder fits, but the button balloons to about 360px.
- **Why it matters:** The hint telling the therapist she can search by email is cut off at exactly the width where the field got narrow, and the empty three-quarters of the filter card makes the page look unfinished.
- **Likely cause:** A five-column filter-bar grid template left in place on a page that only renders two controls. Give this form its own two-track template.

### M23. The same badge word renders in two different colours — "assigned" is green on six rows and amber on one

- **Page:** staff-id — /admin/staff/884311b1-e9d0-44b9-91f3-14188a3baf59/
- **Widths:** 375, 414, 768, 1280
- **Exposed by the new data:** yes
- **Evidence:** dom.html: six upcoming rows use `bg-[var(--admin-status-confirmed-bg)] text-[var(--admin-status-confirmed-text)]` around `<span>assigned</span>`; the Thu 3 Sept 13:00 row (Zhang Wei-Ming 张伟明) uses `bg-[var(--admin-status-attention-bg)]` around the identical word `<span>assigned</span>`. All five past rows use that same attention amber around `<span>completed</span>`. Visible in the 768 and 1280 screenshots as one orange pill in a column of green ones.
- **Why it matters:** Colour is doing work the label does not explain. A therapist sees an amber "assigned" among green "assigned" badges and cannot tell what is different about that appointment — and the same amber then means "completed", which should read as settled, not as needing attention.
- **Likely cause:** The badge tone is driven by the booking's status while the badge text is driven by the assignment status; the two are chosen independently, so identical text can carry either tone.

### M24. Five "Add" links in Profile completion are 16px tall

- **Page:** staff-id — /admin/staff/884311b1-e9d0-44b9-91f3-14188a3baf59/
- **Widths:** 320, 375, 414
- **Exposed by the new data:** no
- **Evidence:** measure.json `smallTargets`: five entries `a.inline-flex.items-center.gap-1.text-xs.font-semibold` text "Add", rect 38.95x16, stacked 26px apart — at 375 @303.05,2588 / 2614 / 2640 / 2666 / 2692. Alongside them `a "Open availability"` and `a "Open performance"` at 309x20 and, at 375/414, `summary "Past assignments (5)"` at 275x22 and `a "Show all assignments"` at 169.67x20.
- **Why it matters:** Five 16px-tall links stacked 26px apart on a phone means the wrong row gets tapped; the therapist lands on the wrong field of her own profile.
- **Likely cause:** Bare `text-xs` inline links with no vertical padding. The "Past assignments (5)" summary and "Show all assignments" link are the two that are new with data — the empty capture had 9 small targets at 375, the seeded one has 11.

### M25. Refusal cards are off-palette in dark mode — cool slate on a warm-black UI

- **Page:** clients, clients-id-edit, clients-new (all three refusal routes)
- **Widths:** all
- **Exposed by the new data:** no
- **Evidence:** Sampled backgrounds: refusal card rgb(42,43,48) in clients/320/screenshot.png (x80-560,y200-290) and clients-new/1280/screenshot.png (x500-800,y300-360); every other admin panel is rgb(28,26,22) (clients-id/768/screenshot.png) on a page ground of rgb(17,15,11). Markup: section … border-[var(--admin-status-restricted-border)] bg-[var(--admin-status-restricted-bg)]. The shield chip above the heading uses the same variable — bg-[var(--admin-status-restricted-bg)] — as the card it sits on.
- **Why it matters:** The card reads as if it came from a different product: a blue-grey panel dropped into an otherwise warm near-black admin. And the circular chip behind the shield icon is the exact colour of the card behind it, so the intended chip is invisible.
- **Likely cause:** --admin-status-restricted-bg was picked for a light theme and never re-toned for dark. The chip additionally needs a different token from its own card.

### M26. The visit sparkline reads as a stray horizontal rule

- **Page:** clients-id (/admin/clients/c1111111-…-000000000001/)
- **Widths:** 320,375,414,768,1280
- **Exposed by the new data:** yes
- **Evidence:** clients-id/*/dom.html: <div role="img" aria-label="12-month visit trend for this client"><svg viewBox="0 0 100 32" width="100%" height="32" preserveAspectRatio="none"> with a path whose first 11 points are all at y=30.00 and only the last at y=2.00. Stretched to the full column width this draws a flat line across the whole card plus a short diagonal at the right end. Visible in clients-id/414/screenshot.png at y≈1400-1440 and clients-id/768/screenshot.png at y≈535-550, sitting ~30px above the section's real border-b rule.
- **Why it matters:** With no axis, no caption and no visible label, the flat line lands directly above a genuine divider — two near-identical horizontal lines in a row. A therapist reads it as a rendering glitch or a duplicated rule rather than as this client's visit trend.
- **Likely cause:** A near-empty series (11 zeros, one spike) plus preserveAspectRatio="none" over a 32px-tall band flattens the chart into a rule. Either suppress the sparkline when there is under-one-year of data, or give it a visible caption and a baseline that cannot be mistaken for a divider.

### M27. At 1280 the reminder list is centred while the heading and tabs are left-aligned, leaving a 248px empty gutter

- **Page:** emails, /admin/emails/
- **Widths:** 1280
- **Exposed by the new data:** yes
- **Evidence:** dom.html: `<section class="mx-auto grid w-full max-w-[720px] gap-4 text-left">` sits as a sibling of a full-width `<header>` and `<nav aria-label="Email sections">` inside `div.mx-auto.w-full.min-w-0.max-w-[100rem]`. Measured: the client-name anchors have rect.x 93 at 768 and 349 at 1280, while `main` padding only grows from 24px (sm:px-6) to 32px (lg:px-8) — a 256px content shift from an 8px padding change, i.e. 248px of pure centring gutter. The 1280 screenshot shows "Email" and the Reminders/Review requests/Templates pills starting at x=32 with the cards starting at x=280.
- **Why it matters:** The page reads as two unrelated columns: a heading and tab bar on the left, and a list floating in the middle under nothing. The eye has to jump 250px sideways to get from the tab you clicked to the rows it filtered.
- **Likely cause:** `max-w-[720px] mx-auto` applied to the list section only, not to the header/nav above it.

### M28. "Insert names and dates with the buttons above" points at buttons that do not exist

- **Page:** emails-template-id, /admin/emails/templates/booking_confirmation/
- **Widths:** all
- **Exposed by the new data:** no
- **Evidence:** dom.html, the hint under the greeting field: `<div id="_r_4_" ...><span class="text-[var(--admin-text-muted)]">Insert names and dates with the buttons above.</span></div>`. The row above the textarea is `<div class="flex items-center justify-between gap-2"><label for="_r_3_">Greeting intro sentence</label></div>` — a label and nothing else. The page banner two blocks up says "You can view but not edit this template."
- **Why it matters:** A therapist reads an instruction, looks up for the buttons, and finds none. It reads as a broken page rather than a read-only one, on the same screen that already told them they cannot edit.
- **Likely cause:** The token-insert toolbar is hidden for read-only viewers but its describedby hint text is rendered unconditionally.

### M29. Send-reminder button names the client by the first whitespace token, which mangles the Arabic name

- **Page:** emails, /admin/emails/
- **Widths:** all
- **Exposed by the new data:** yes
- **Evidence:** dom.html: `<button type="submit" aria-label="Send reminder to عبد" title="Send the reminder template to عبد">` for the client `عبد الرحمن بن محمد الحسني العبدلي`. Same pattern gives "Send reminder to Zhang" for `Zhang Wei-Ming 张伟明` and "Send reminder to Abdurrahman" for the long English name. The avatar monogram for the Arabic client renders as "عا" — first letter of the first word plus the alif of the definite article in "العبدلي".
- **Why it matters:** "عبد" on its own is half a compound given name (it means "servant of"), so the tooltip and the screen-reader label both address the client by a fragment. For the CJK name it picks the family name. A therapist hovering to confirm who they are about to email gets the wrong answer.
- **Likely cause:** First-token split on the display name for the short form, and an initials function that assumes Latin given-name/surname order.

### M30. Notifications sheet shows raw ISO dates while the page underneath shows human dates

- **Page:** emails, /admin/emails/ (notifications sheet, menu-0-3_need_attention_3)
- **Widths:** 320,375,414,768
- **Exposed by the new data:** yes
- **Evidence:** menu-0 html: `<p class="mt-1 break-words text-xs leading-5 ...">2026-09-03 at 15:00</p>` and `<p class="mt-1.5 text-[11px] font-medium uppercase ...">2026-09-03 · Today</p>`; the RSC payload carries `"detail":"2026-09-03 at 15:00","timestamp":"2026-09-03"`. The list behind the sheet formats the same bookings as "Thursday 3 September at 15:00" (`p.mt-0.5.text-sm...[font-variant-numeric:tabular-nums]`).
- **Why it matters:** Two date formats on one screen, one of them machine-shaped. A therapist scanning "which visit is this" has to translate 2026-09-03 back into a weekday while the card two inches below already says Thursday.
- **Likely cause:** Notification detail/timestamp strings are passed through unformatted from the server payload rather than going through the same date formatter as the booking rows. Shell-wide, so it will appear on other pages too.

### M31. At 320 the "3 similar" count badge in a notification wraps onto its own line

- **Page:** emails, /admin/emails/ (notifications sheet, menu-0-3_need_attention_3)
- **Widths:** 320
- **Exposed by the new data:** yes
- **Evidence:** menu-0 html: `<div class="flex flex-wrap items-center gap-1.5"><p class="text-sm leading-snug font-semibold ...">Visit open to claim</p><span class="inline-flex items-center rounded-full ... text-[10px]" aria-label="3 similar notifications">3</span></div>` — the title is a block-level `p` flex item, so at 320 the badge is pushed to a second line. The 320 screenshot shows "Visit open to claim" with an "info" pill beside it and a lone "3" chip on the line below.
- **Why it matters:** The orphaned "3" reads as a stray number rather than "3 of these", and it pushes the "Expand 3 similar" / "View booking" / "…" row down into a third wrapped row.
- **Likely cause:** Title and count share a `flex-wrap` row with no min-width budget for the badge at 320.

### M32. Back link and the "Filled automatically" disclosure are 20px-tall tap targets

- **Page:** emails-template-id, /admin/emails/templates/booking_confirmation/
- **Widths:** all
- **Exposed by the new data:** no
- **Evidence:** measure.smallTargets at every width: `a` "Templates" 92.91x20 and `summary` "Filled automatically (2)" 262x20 at 320 (317x20 at 375, 356x20 at 414, 255.59x20 at 768, 454x20 at 1280). dom.html shows the summary as `<summary class="flex cursor-pointer list-none items-center gap-1.5 text-sm ...">` with no min-height.
- **Why it matters:** The back link is the only way off this page other than the browser control, and it is a 20px strip at the very top of a phone screen. Same for the disclosure that hides the two auto-filled sections.
- **Likely cause:** Both are bare inline/flex text rows with no min-height or vertical padding.

### M33. Both password-reset pages scroll 109px at 768 and 1280 with nothing below the fold but empty canvas

- **Page:** password-reset (/admin/password-reset/) and password-reset-token (/admin/password-reset/audit-no-such-token/)
- **Widths:** 768,1280
- **Exposed by the new data:** no
- **Evidence:** Full-page screenshot heights: password-reset and password-reset-token are 768x1133 at the 768 viewport (1024 tall) and 1280x909 at the 1280 viewport (800 tall). Every one of the 11 refusal pages at the same widths is exactly 768x1024 and 1280x800. The overflow is 109px at both widths, which is exactly header 57 + main `pt-5` 20 + main `md:pb-8` 32 — the distance by which the nested `min-h-[100dvh]` main is pushed below the top of the document.
- **Why it matters:** A one-field form that fits comfortably on a laptop gains a scrollbar, and scrolling reveals only blank background. It makes the page feel broken and invites the user to scroll looking for content that does not exist.
- **Likely cause:** Same root cause as the nesting finding: `min-h-[100dvh]` on the inner main measures the full viewport, but the element starts 57px down and sits in a main with 20px top and 32px bottom padding, so the document always ends up 109px taller than the viewport.

### M34. The shield badge on every refusal card is invisible — the circle and the card use the identical background token

- **Page:** all 11 refusal keys (account-password-requests, audit, availability, bookings-new, enquiries, operations, privacy, roles, roles-id, services, settings)
- **Widths:** all
- **Exposed by the new data:** no
- **Evidence:** dom.html: the card is `<section class="rounded-[var(--admin-radius-card)] border p-5 sm:p-6 border-[var(--admin-status-restricted-border)] bg-[var(--admin-status-restricted-bg)]">` and the icon wrapper inside it is `<span class="inline-flex size-12 items-center justify-center rounded-full bg-[var(--admin-status-restricted-bg)]">`. Same CSS variable on parent and child, so the 48px circle has zero contrast against the card. Confirmed in every screenshot at every width: a bare 24px shield glyph floats with no badge behind it.
- **Why it matters:** The 48px badge is the visual anchor that says "this is a permission stop, not an error and not an empty list". Without it the screen reads as an unfinished empty state, and the therapist gets no at-a-glance signal about what kind of screen they are on.
- **Likely cause:** The badge was probably meant to carry a stronger token (the icon itself already uses `text-[var(--admin-status-restricted-text)]`); it inherited the card's own surface token instead.

### M35. The single escape link is labelled "Back to dashboard" on 9 of 11 refusals, but the therapist's navigation has no "dashboard" anywhere

- **Page:** 9 of 11 refusal keys — account-password-requests, audit, enquiries, operations, privacy, roles, roles-id, services, settings (all /admin/<section>/)
- **Widths:** all
- **Exposed by the new data:** no
- **Evidence:** dom.html: those 9 pages render `<a ... href="/admin/dashboard/">Back to dashboard</a>`. availability and bookings-new render the *same* href as `<a ... href="/admin/dashboard/">Back to My day</a>`. Meanwhile the bottom tab bar and the desktop nav both label that same destination "My day" — the extracted menu text reads `|My day|My bookings|Team|`, and the tab bar in every 320/375/414 screenshot reads "My day".
- **Why it matters:** The refusal screen's whole job is to give one clear way onward. It sends the therapist to a place called "dashboard" that appears under a different name in their tab bar and nav, and two of the eleven screens already use the correct word — so the same button teaches two different names for one destination.
- **Likely cause:** The shared AdminAccessDenied component takes the label as a prop; most callers were left on the generic default while availability and bookings-new were updated to the role-facing name.

---

## Refused by the adversarial pass — 22

Each of these was raised by a reviewer and then knocked down by an independent
checker reading the same artefacts. They are listed so the reasoning is not lost.

1. **The collapsed "My week" panel is not actually hidden -- its content stays in the layout and the tab order and overlays the "Need h** — REFUTED as written. The claim is a compound: its true half (the `hidden` attribute does not apply) is real, but its headline assertion, its severity, and both of its cited rects are wrong.  WHAT CHECKS OUT - 768/dom.html contains the tag verbatim: `<div id="business-overview-panel" role="region" aria-labelledby="business-overview-heading"
2. **Phone bottom chrome is 125px but the page only reserves 96px, so the last 29px of content is permanently under the fixed bars** — The "125px of permanently-occupied viewport" double-counts the bottom tab bar, which is not a fixed overlay, and the "96px reserved" undercounts the actual bottom padding. The sweep's own data also shows the content does scroll clear.  1) THE TAB BAR IS NOT FIXED. In `dashboard/320/dom.html` the bar is `<nav aria-label="Admin navigation" 
3. **The female-therapist requirement is rendered at 11px — the smallest text on the card, and quieter than "pending"** — The half of the claim I could verify is real, but the half that turns it into a "hierarchy inversion" is contradicted by the very file the claim cites.  WHAT CHECKS OUT - The two strings and the selector are genuinely in `measure.json` -> `measure.smallText` at 320, 375, 414, 768 and 1280: `"Needs 3 female therapists"` and `"Needs female 
4. **The Arabic client's name renders visually smaller than the date line beneath it** — The selector and the raw row counts are real, but the metric behind the claim is broken, and the conclusion it draws is the opposite of what the screenshot shows.  WHAT IS TRUE - `raw-therapist-seeded/therapist_a/bookings/1280/dom.html` does contain six `p.min-w-0.font-display.text-base.font-semibold.tracking-[-0.01em].text-[var(--admin-h
5. **No dir attribute anywhere on the page, so any mixed-script name is one step from reordering** — REFUTED — the greps are honest, but this is not a defect found in this audit.  What checks out. I re-ran both greps myself on `raw-therapist-seeded/therapist_a/bookings/{320,375,414,768,1280}/dom.html`: `dir="` matches 0 and `isolate` matches 0 at every width (also `unicode-bidi` 0, `text-right` 0). The capture is the full document — it s
6. **On a phone the only action on a booking row is a bare, unlabelled map-pin glyph on its own line** — The DOM detail is real but the defect argument is not. Three independent grounds:  1. **The load-bearing rationale is factually false.** The claim's severity rests on "It is the only tappable control on an assigned booking on a phone". It is not. In `bookings/375/dom.html` there are 6 `<article>` rows and 6 row-title anchors (`href="/admi
7. **At 768, on a touch device, the only in-page way back to the list is a 16px-tall text link** — The raw measurement is genuine, but the finding's central assertion is false.  WHAT CHECKS OUT - measure.json at 768 and 1280 does contain exactly the cited entry: selector `main#admin-main > div.mx-auto.w-full.min-w-0 > div.grid.min-w-0.gap-6 > nav.mb-2 > ol.hidden.flex-wrap.items-center > li:nth-of-type(1) > a.rounded-sm.font-medium.out
8. **A control sits under the fixed bottom tab bar at the page's opening scroll position** — REFUTED — the cited numbers are real, but the mechanism, the visual claim and the "defect" status are all wrong.  1. THE BAR IS NOT FIXED AND COVERS NOTHING. From 320/dom.html: `<nav aria-label="Admin navigation" class="admin-bottom-tabbar relative z-40 shrink-0 border-t ... md:hidden">` — position `relative`, `shrink-0`, an in-flow flex 
9. **The banner's "View →" link and "✕" dismiss are 28px controls, and at rest the ✕ sits under the bottom tab bar** — The quoted selectors and numbers are all genuinely present, but the claim's central assertion — that the ✕ "sits under the bottom tab bar" at rest — is a misreading of a below-the-fold artefact, and two supporting details are factually wrong.  1) THE TAB BAR DOES NOT OVERLAY ANYTHING. In dom.html the shell is `div.admin-shell.flex.h-[100d
10. **Every row of "My upcoming work" overflows its own list item by 8px, clipping the right edge of the hover and focus ring** — The cited numbers and selector are genuine, but the claimed harm is invented — nothing is clipped, and the 8px is the deliberate, fully-absorbed Tailwind "-mx-2 px-2" idiom.  What checks out: - `raw-therapist-seeded/therapist_a/me/<w>/measure.json` -> `measure.horizontalScrollers` really does contain `main#admin-main > section.rounded-[va
11. **The report's charts label themselves at 10–11px, below the 12px floor the rest of the page uses** — The raw numbers in the claim are real, but the defect it describes is not — the claim's central premise ("below the 12px floor the rest of the page uses") is disproved by the audit's own EMPTY baseline, part of its cited evidence is misattributed to the seed, and its stated aggravator (faint muted grey on near-black) is measurably wrong. 
12. **The "Sessions per week" chart plots a different window from the range the page says is selected** — The claim misreads weekly bucket labels as calendar dates.  The chart's actual source data is present in the RSC payload of dom.html at ALL five widths (320/375/414/768/1280), identically: "data":[{"week":"31 Aug","sessions":3},{"week":"07 Sept","sessions":0},{"week":"14 Sept","sessions":0},{"week":"21 Sept","sessions":0},{"week":"28 Sept
13. **The 320px capture of /admin/staff and /admin/staff/[id] is void — both were photographed with zero bookings, so the phone width th** — The claim's raw numbers check out, but its scope, its stated cause, its uniqueness assertion and its severity are all wrong. Half the claimed page scope does not exist at all.  WHAT IS TRUE (verified verbatim on disk) - `staff-id/320/measure.json`: elementCount 348, bodyTextLength 1092. All other widths: 627. Exact. - `staff-id/320/dom.ht
14. **The "All day" checkbox on the Blocked dates form is a 16x16px target** — The cited measurements are genuine, but the defect as described is not. Every literal number checks out: measure.json for staff-id-availability at 320/375/414 contains input#_r_13_ (id _R_elubsnpfibtbH2_ at 414), class "size-4 rounded border-[var(--admin-border-form)] text-[var(--admin-primary)]...", type "checkbox", rect 16x16 at @58,288
15. **Small 11px badge text multiplies fivefold once bookings exist** — The cited numbers are all real and verify exactly, but the claim is not a defect and the screenshot does not show what it describes.  VERIFIED AS STATED: raw-final/therapist_a/staff-id/1280/measure.json `smallText` length = 4; raw-therapist-seeded/.../1280/measure.json `smallText` length = 22. The 18 new entries are exactly as cited: span
16. **The "Client creation limited" refusal sends the therapist to a second refusal** — The claim's individual citations are real, but its conclusion is contradicted by the very same DOM file, and the underlying issue is a permitted refusal chain rather than a layout defect.  1. THE CLAIM'S CENTRAL ASSERTION IS FALSE. It says "The only offered alternative to the wall is another wall... with no path back to anything useful." 
17. **Refusal screens' secondary link has no link affordance at rest** — The selector is real, but the claim's load-bearing assertion — "no underline, no accent colour, no border — the only cue is hover" — is contradicted by the very class string it quotes, and by the tokens those classes resolve to.  WHAT CHECKS OUT - The anchor is present verbatim in both `redesign/admin-ui-audit/raw-therapist-seeded/therapi
18. **"Total paid £105.00" overflows its Client summary tile at 320** — The cited selector and numbers DO exist — measure.json horizontalScrollers[9] at clients-id/320 is exactly "dd.mt-1.text-sm.font-semibold" containing "£105.00" with rect w=51, scrollWidth=53, clientWidth=51, hiddenPx=2, overflowX="visible", scrollable=false. So the evidence is not fabricated. The claim is refuted on what that evidence mea
19. **Half the greeting sentence is unreadable at every width, and no scroll can reveal it** — The claim's DOM citation is accurate, and its screenshot observations of the textarea are accurate. But its central factual assertion is false, and that collapses the severity.  WHAT IS TRUE - `dom.html` at all five widths contains exactly the cited element: `<textarea id="_r_3_" name="field:greeting_intro" rows="3" placeholder="Hi {clien
20. **Footer contact line is cut mid-token at 375 and 320** — The truncation is real at 375, but the claim as written fails on severity, on its stated harm, and on half its evidence.  1) SEVERITY PLAINLY OVERSTATED (major -> cosmetic/minor). Exactly three characters are lost: "e}." out of "Questions? Reply to this email or call {contactPhone}." The sentence reads in full, the token is identifiable a
21. **The Templates tab is now cut off at 375 and 414 as well, because the new count badges widened the strip** — Every number in the claim is real and I confirmed each one — but the fault it describes is the already-accepted item, at a state that is strictly BETTER than the accepted one, and the stated rationale is contradicted by the artefacts.  WHAT VERIFIES (credit where due) In redesign/admin-ui-audit/raw-therapist-seeded/therapist_a/emails/{375
22. **The only control on every refusal screen is 42px tall, marginally under the 44px touch minimum** — The cited number is not in the artefacts, and the opposite number is. In redesign/admin-ui-audit/raw-therapist-seeded/therapist_a/roles/320/measure.json the "Back to dashboard" anchor records rect {"x":78.53,"y":358,"w":162.92,"h":44,"top":358,"bottom":402} — height 44, exactly meeting the touch minimum, not 42. I checked all 11 refusal k

---

## Corrections the reviewers made to my briefing

These matter more than they look: each is a claim I put in front of eight agents
that turned out to be wrong. Refusing with evidence is the good outcome.

**dashboard** — Three corrections / caveats.  1. THE BRIEF SAYS "19 off-edge elements at 320" AS IF THEY WERE 19 PROBLEMS. They are one problem. All 19 entries in dashboard/320/measure.json outOfBounds share the same ancestor -- `ul.m-0.flex.list-none > li.min-w-[280px].shrink-0.lg:min-w-0:nth-of-type(2)` -- i.e. the second "Open to claim" card and its 18 descendants (its header, its two <p>s, the Available pill, View, Claim this booking, and 8 SVG paths). Counting an <svg> `<path>` as an off-edge element inflates one card into nineteen faults. The real fault is reported below as "Claimable card is 280px wide in a 246px slot".  2. THE MOBILE SCREENSHOTS ARE VIEWPORT-ONLY, NOT FULL-PAGE. 320/375/414 screenshot.png are 640x1280, 750x1624, 828x1792 = the visible viewport at DPR 2. The page is ~2600 CSS px tall at 320, so roughly the top 25% is all that was captured. 768 and 1280 are full-page at DPR 1. Everything I report below the fold at phone widths is therefore evidenced from measure.json geometry and dom.html, not from a picture. If you want screenshots of "Today's visits" at 320 they do not exist yet.  3. THE `login` CELL AT 414/768/1280 CAPTURED A MID-HYDRATION SNAPSHOT. measure.json there reports elementCount 183, bodyTextLength 118 and h1 [] -- an empty admin shell -- while the screenshot in the same folder shows the fully rendered dashboard. dom.html and measure.json were serialised bef

**bookings-list** — Four corrections / caveats.  1. The brief tells me to look hard at "the Arabic name's right-to-left rendering". Its glyph ORDER is correct. I magnified 1280/screenshot.png 4x and the short word عبد sits at the right-hand end and the long word العبدلي at the left — that is proper RTL. The Unicode bidi algorithm handles the pure-Arabic string without help. The real Arabic defect is optical SIZE (finding 5), not direction. I have reported the missing dir attribute separately as a latent risk, not as an observed reordering.  2. The brief warns about "client names being truncated or overflowing". On THIS page they are not, and I want that on the record because it is the opposite of the /admin/clients lesson. The name element is `p.min-w-0.font-display.text-base.font-semibold...break-words.sm:text-lg` — `break-words`, no `truncate`, no `line-clamp`. `grep -o 'truncate' 320/dom.html` returns 4 hits and all 4 are shell chrome (the header account name and three bottom-tab labels); none is in a booking row. `grep -o 'line-clamp-[0-9]'` returns zero. measure.json reports outOfBounds 0 and clipped 0 at all five widths. "Abdurrahman Muhammad Al-Hassan Fitzgerald-Montgomery" wraps to two lines and every character survives.  3. The claimable masking the brief describes as privacy-by-design is genuinely working. The claimable article's full text is "Claimable booking ~ 3 Sept 2026 ~ · ~ 15:00 

**booking-detail** — Four corrections, one of which changes how the headline numbers should be read.  1. The EMPTY baseline for bookings-id was itself a refusal screen. raw-final/.../bookings-id/320/measure.json has h1 ["You don't have access to this booking"], elementCount 138, and requests a different booking id (09a39848-...). So this page had never once been rendered with data. Every seeded-vs-empty delta on this key is 0 to N, not a regression - the brief's framing is right, but nothing here can be called "worse than before".  2. horizontalScrollers is a false positive on this page and I did not report it. All 8 entries at 320 have computed overflow-x: visible, and each overflows by exactly the negative margin that created it: the contact links carry -mx-2 (8px, so div.mt-2.grid.gap-1 reads scrollWidth 202 / clientWidth 194) and the notification badge carries -right-1 (so the bell reads 47/44). documentOverflowPx and bodyOverflowPx are 0 at every width and hasHorizontalScrollbar is false. Nothing scrolls sideways; these are intentional bleed hit-areas. If the audit's totals count these, the 1 to 8 jump on this key is noise.  3. Menu captures inflate clipped and obscuredInteractive and should not be read as page faults. bookings-id/320/menu-0 reports clipped 99 and obscuredInteractive 10, but every obscured entry names obscuredBy div.fixed.inset-0.z-50 or the dialog panel itself - it is the pag

**me-and-reports** — Four things in the brief did not hold up.  1. "Look hard at every place a client name is rendered" — on my two pages there is exactly ONE such place: the five-row "My upcoming work" list on /admin/me. /admin/reports renders no client names at all (its lists are services: "Hijama Package", "Fire Package", …), and the long email address appears on neither page. So the Arabic/CJK/long-name stress only reaches one component here.  2. The Arabic and CJK names did NOT break anything. At 320 the rows holding "عبد الرحمن بن محمد الحسني العبدلي" and "Zhang Wei-Ming 张伟明" measure 85px and 85px — identical to the plain-English "Fatima Noor" row (85px). Both fit on one line in the 214px name box. Only the 51-character Latin name misbehaves (finding 3). I am reporting no RTL or CJK defect because there is none to report.  3. staff-id-performance at 414 and 768 has a measure.json captured mid-load: elementCount 182, bodyTextLength 118, h1 [], clipped 2, smallTargets 11 — while the screenshot.png for the SAME cell shows the page fully rendered. It is a capture race, not a page fault; the identical thing happens at 320 and 1280 in the EMPTY run. Do not read those two cells as "clean" or as a defect.  4. Measurement noise inflates the seeded totals on these pages. Every chart wraps its SVG in div.recharts-responsive-container > div with style "width:0;overflow-x:visible", which reports clientWid

**staff-and-availability** — TWO CLAIMS IN THE BRIEF ARE WRONG. I checked both hard before saying so.  (1) "staff-id-availability gained 13-14 clipped elements at every width — the biggest data-exposed change; look at it very closely." I did, and all 13/14 are ONE thing that is working correctly: the collapsed SUNDAY row. Every entry in measure.json `clipped` is a descendant of `...div.grid.min-h-[3.5rem].gap-3:nth-of-type(7) > div.grid.transition-[grid-template-rows,opacity]:nth-of-type(2) > div.min-h-0.overflow-hidden`, and that wrapper has `rect.h = 0` for all 13/14. In dom.html that wrapper reads `class="grid transition-[grid-template-rows,opacity] ... pointer-events-none [grid-template-rows:0fr] select-none opacity-0" aria-hidden="true"`, the Sunday switch is `aria-checked="false"`, and every control inside carries `disabled=""`. That is a textbook collapsed disclosure for a non-working day — pointer-events off, aria-hidden, disabled, zero height. The measure tool counts the inner content's stale layout box as "cut off". It is a false positive, not a defect. 13 at 320/375/414 vs 14 at 768/1280 only because the `–` separator `span.hidden ... sm:block` becomes visible at the sm breakpoint. The real headline change on this page is different and benign: with 6 rules the page switches from the "global hours" explainer (elementCount 272) to the full 7-day editor (435) and it lays out correctly at all five w

**clients-and-calendar** — Two claims in the brief did not survive checking.  1. "calendar gained unreachable controls at 375/414/768" — I could not confirm a single one. All 8 obscuredInteractive entries across calendar/320, /375, /414 and /768 are measurement artefacts:    (a) calendar/320 summary "Claimable today" (rect y=574–618) and calendar/375 a.group 08:00 card (rect y=648–930) are simply BELOW THE FOLD of the main#admin-main scroller. Usable scroller height is 640−57−56 = 527px at 320 and 812−57−56 = 699px at 375, so elementFromPoint at each element's centre lands on the bottom tab bar (obscuredBy = nav.admin-bottom-tabbar > a:nth-of-type(3), background rgba(0,0,0,0) — i.e. not painting over anything). Scrolling reaches both controls normally.    (b) calendar/375, /414 and /768 a "Fatima Noor + 2 others" and a "Browse all claimable →" are the CONTENTS OF A CLOSED <details>. calendar/*/dom.html shows <details class="group rounded-… xl:hidden"> with no `open` attribute. The subtree keeps phantom rects that happen to overlap the day card below (obscuredBy = the day section's div.mb-4 header, and article.grid.grid-cols-[4.25rem…]), but it is neither painted nor clickable: calendar/375/screenshot.png shows the bar collapsed with the day card rendering cleanly through that region, and calendar/375/menu-1-Claimable_today…png shows the expanded panel laying out correctly with both links intact.    The r

**emails** — The brief says "emails gained an unreachable control at 375 and 414". I could not confirm that and I believe it is a false positive of the occlusion detector. At 320/375/414 measure.obscuredInteractive has exactly 1 entry, and occlusionSweep shows the flagged element changes with every scroll offset sampled (375: "Send reminder"@top=773.5 at scroll 0, "Fatima Noor"@top=779.5 at scroll 558, "Fatima Noor"@top=31.5 at scroll 832; 414: "Fatima Noor"@top=863.5 at scroll 0, "Send reminder"@top=-9.5 at scroll 625). innerHeight is 812/896, so every hit is simply an element sitting outside main's scroll viewport at that instant, and elementFromPoint then returns whatever shell chrome occupies that viewport point. The shell cannot overlay content: the tab bar is `nav.admin-bottom-tabbar.relative.z-40.shrink-0` (in flow, not fixed) and `main#admin-main` is its flex sibling with `overflow-y-auto`; measure.pinned lists only the sticky header, with "covers": [], "coversCount": 0, "occludesSomething": false. The list container carries `pb-24` (96px) against a 56px (h-14) tab bar, so the last card clears it at maximum scroll. Every "Send reminder" button and every client link can be scrolled into the clear band (699px tall at 375). I do not think there is an unreachable control on /admin/emails at any width. Separately: the accepted "Templates tab off-screen at 320" exception no longer covers 

**refusal-screens** — Four corrections, all evidenced.  1. NONE of the seeded stress data reaches any of my 65 cells, so the brief's instruction to "look hard at every place a client name is rendered" does not apply to this area. I grepped all 65 dom.html files for `Abdurrahman`, `Fitzgerald`, the Arabic string, `张伟明`, `Zhang` and `averylongdomainname`: zero hits, at every width. A refusal renders before any record is fetched, so no client name, no RTL text, no CJK, no long email, no time and no price can appear. The only seeded content that reaches these pages is shell chrome: the bell badge "3" and one notification in the bell sheet ("Visit open to claim · 2026-09-03 at 15:00" / "Expand 3 similar"), which lays out correctly at 320 (bottom sheet) and 768 (anchored popover).  2. This area contributed NOTHING to the regression the brief is chasing. Across all 65 cells the seeded run records `outOfBounds` = 0 and `clipped` = 0 everywhere, and `obscuredInteractive` = 1 in exactly one cell (password-reset-token at 320) — which is ALSO 1 in the EMPTY capture at the same cell. The 142 out-of-bounds / 350 clipped / 35 unreachable totals come entirely from other areas. Every fault I found is a code fault present identically in `raw-final` (EMPTY); `exposedByData` is false on all six.  3. `password-reset-token` is listed under "almost all of these are ACCESS-REFUSED screens" and only `password-reset` is call

