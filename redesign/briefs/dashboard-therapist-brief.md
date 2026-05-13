# Brief: dashboard-therapist

## 1. Feature Summary

`/admin/dashboard` for the Therapist role — the "therapist" variant, rendered by the dedicated `TherapistDashboard.tsx` component (a separate component from the business / coordinator branch). Where the Owner/Admin variant is a business surface and the Coordinator variant is a triage surface, the Therapist variant is a **worker tool**. The component's source comment already names the framing: *"A therapist's day revolves around three questions: What's next? · What do I have today? · Is there work I can claim?"* This brief commits the UI to those three questions in that order, mobile-first throughout (per PRODUCT.md and BASELINE-CRITIQUE: Casey is the therapist persona, on the road between visits, on a 375px iPhone screen). Direct fix included for **BASELINE-CRITIQUE Casey #4** (the current "All caught up" empty state takes 25% of the phone screen with no actionable link, this brief replaces it with a CTA that routes to claimable work). The dashboard chrome diverges from Owner/Admin and Coordinator: no Tier-2 disclosure, no business-overview tiles, no Cormorant marquee numerals, no full filter strip. This is a *queue*, not a *dashboard*. The shared admin top nav remains identical so a Therapist promoted to Coordinator later doesn't have to re-learn the chrome.

## 2. Primary User Action

**See the next visit (when, where, who, what service, any gender-match note), tap to open the booking detail, drive there. Everything else on the page is secondary.**

## 3. Design Direction

**Colour strategy:** Restrained. The Therapist surface is a worker tool, not a status board. Status families still carry the visit cards (Confirmed for booked-and-confirmed; Pending for unconfirmed; Attention for claimable). But there are **no marquee numerals**, **no business-overview tints**, **no gold**, **no celebration accents**. The palette narrows to: warm ivory canvas + Practice Charcoal text + Clinic Green CTAs + four status families on chip pills. This is the most restrained variant of the three, Linear restraint via Rahma palette, exactly what PRODUCT.md's "disciplined warmth" intersection asks for, applied to a single role's worker tool.

**Theme scene sentence:** *"Fatimah's husband, a Therapist, is between two visits at 11:45am, sitting in his car outside a client's house in Luton, glancing at his phone to confirm the postcode for the next visit and check whether his 2pm appointment has been cancelled yet."* Forces light mode (a phone in daylight in a car), forces mobile-first (375px is the primary canvas, not desktop), forces a layout that puts *the next visit* at the very top, because that's what he opened the phone to see.

**Anchor references:**
- **Uber Driver app's "Next trip" card** — the single most prominent element is what you do *next*, with everything you need (address, ETA, contact) inside it
- **Calendly's "Today's events" mobile view** — list rows that prioritise *when* and *who*, with the venue/details one tap away
- **Airbnb host inbox on mobile** — one prominent next-action card with secondary work stacked below; not a dashboard, an actionable queue

Anti-anchor: the Owner/Admin dashboard's six-tile density. The Therapist surface looks nothing like an admin home page; it looks like a worker app.

## 4. Scope

Production-ready spec for Phase 6. Therapist variant only. (Owner/Admin = Brief 06; Coordinator = Brief 07.) Includes: complete rework of `TherapistDashboard.tsx`'s visual layout (the data contract and props interface stay unchanged, those are server contracts), new **Next Visit hero panel**, today's visits list with full visit-context cards (address, gender-match note, customer notes if any), claimable-work compact strip (BASELINE-CRITIQUE Casey #4 fix), a quiet weekly summary tile, and the existing personal greeting / date label preserved verbatim. Filter strip narrows to a date-range chip group only (the Therapist scope is so tight that the other seven filters are noise for this role).

**Out of scope:** the `TherapistDashboardProps` shape (server contract from `dashboard-data.ts`), all RBAC, all data-fetching, the shared admin top nav (handled by `00-shared-components-brief.md`). Also out of scope: any "claim" mutation; the claimable strip links to `/admin/bookings?view=claimable` where the claim action lives (this brief routes the click; Brief 04 / bookings owns the action).

## 5. Layout Strategy

**Page rhythm (mobile-first, 375px, top to bottom, this is the primary canvas for this brief, not desktop):**

1. **`AdminPageHeader`, Therapist tone.** H1 reads *"Good morning, Fatimah."* (or afternoon/evening per `getGreeting()`; greeting + first name already exists in `TherapistDashboard.tsx:39–54`). Urbanist 600 display step, Chronicle. Subtitle: live date label only, no locality (Therapist already knows where they are). No right-rail role pill on this variant (the role is implicit from the personal greeting; adding a "Therapist" pill would feel patronising; Casey is the user, not a third party reading over her shoulder). `NotificationBell` and cmd-K hint remain in the global `AdminTopNav`, not duplicated in the page header.

2. **Next Visit hero panel**, a single full-width `AdminPanel` at `surface-card` over canvas. **Substantially taller and more decorated than any other panel on the page** (this is intentional; it is the *one thing* this page exists for). Padding `xl` (32px). Layout:
   - Eyebrow label: "Next visit" in Work Sans 500 label step, Soft Slate, leading `arrow-right` 16px Lucide.
   - Primary line: client first name + service name (Urbanist 600, **title step 1.333rem on mobile, heading step 1.778rem at ≥768px**). Chronicle.
   - Time + duration line: Cormorant Garamond 700 1.778rem (**the only place Cormorant appears on this variant**, and it sits on time, not on a stat count, because *time* is the most important data for a therapist). Format: "11:45 · 60 min". Chronicle.
   - Address block: full address + postcode + city (Work Sans 400 body, Practice Charcoal), each line on its own row, with a leading `map-pin` 16px. Below address: two side-by-side Ghost buttons, **44px touch target each**:
     - "Open in Maps" (`map-pin`, links to the existing Google Maps deep-link per RECON §6.5)
     - "Call client" (`phone`, `tel:<phone>` deep-link with the client's phone; direct call, not a separate detail-page round-trip)
   - Gender-match chip (when `required_gender` is set on the booking): Restricted family pill reading "Same-gender required"; clinical legibility per DESIGN.md §5.
   - Customer notes block (when present): Work Sans 400 body, **never collapsed under a "Show notes" toggle**; Therapist needs this *before they arrive*, not after they tap. Max-height 8em with a "Show full notes" Ghost link only if it overflows. Wrapped in `<details open>` so it's keyboard-toggleable but visible by default.
   - Trailing: full-width Primary "Open booking" button (44px height) → `/admin/bookings/<id>`.
   - **Empty state for the hero panel** (no upcoming visits at all): an `EmptyState` component at full panel width with a calendar illustration, heading "Nothing scheduled", body "Your day is clear. Anything to claim?", **Primary CTA "Browse claimable work" → `/admin/bookings?view=claimable`**. This *replaces* the current dashed-border 25%-of-screen empty state per BASELINE-CRITIQUE Casey #4. The CTA is the fix.

3. **Today's visits list**, between the Next Visit hero and the claimable strip. Heading H2 "Today's visits (N)" with a small Confirmed family count badge. Compact `BookingListCard` rows; the same component the Bookings list uses, set to a **compressed mobile variant**. Each row: avatar (32px, the *client's* avatar or initials, since the Therapist already knows their own face) + client first name + service short name + start time + status pill. Tapping the row → booking detail. No quick-action buttons inline on this surface (Therapist's primary actions are claim and update-own-assignment-status; the latter lives on the booking detail page). When there are zero visits today: an inline message under the heading, "No visits today after this one." (singular; no separate empty-state component for an already-empty subset, that would feel redundant after the Next Visit hero might have already shown its own empty state). When the Next Visit is itself the only visit of the day: this section is hidden entirely.

4. **Claimable work strip**, separate `AdminPanel` with **Attention family background tint** (`status-attention-bg`) and a 1px Attention text border. Header: "Open to claim (N)" Urbanist 600 title step + count chip. Body: horizontal scroll strip on mobile with up to 5 compact claim cards, each ~280px wide, snap-scrolling. Each card: client first name + service + start time + date label + Attention family chip "Available" + full-width Ghost "View" button. Tapping "View" → `/admin/bookings/<id>` where the claim button is the primary action (Brief 09 owns that surface). Desktop (≥1024px): the horizontal scroll converts to a grid of 3 cards visible at once. Empty state: a single line "Nothing open right now" in Soft Slate inside the panel, no illustration, no CTA (the panel is already secondary; an illustrated empty state would visually elevate it inappropriately).

5. **Quiet weekly summary tile**, a single small `AdminPanel` at the bottom. Two stats only, in a `<dl>` description-list pattern (already documented in DESIGN.md §1):
   - "This week (N visits)", completed-this-week count
   - "About Nh worked", minutes-this-week formatted via `formatHours()` (existing helper, line 56)
   No Cormorant numerals here, Work Sans 500 title step is plenty. Restrained on purpose; this is not a stat card, it is a quiet reassurance for the Therapist that their work is being counted. Tapping the panel → `/admin/staff/<staffId>` (their own profile) if `availability_mode` access is granted to them, else no-op.

**Desktop rhythm (≥1024px):** Same content order, single-column at max-width ~640px, centred. The Therapist dashboard is **not a multi-column desktop layout**, that would re-introduce business-dashboard chrome on a worker surface. Desktop is just "phone layout, more comfortable line height". The Next Visit hero gains the larger H1 step (1.778rem) for the primary line and a larger Cormorant time (2.369rem). Everything else stays single-column.

**Filter strip:** Narrows to **date-range chips only** (Today · Tomorrow · This week · Custom). No "More filters" overflow. The Therapist's auto-scoped data is all they need; cluttering the surface with seven other filters they cannot meaningfully use is contrary to PRODUCT.md "trim the highest-privilege surface so power does not equal clutter" applied inversely (here, lowest-privilege: trim it to the bone). The chip group sits below the page header, above the Next Visit hero, **only on screens ≥768px**; on mobile the page omits the chip strip entirely and defaults to "Today + Tomorrow upcoming". A Therapist who wants a different range opens `/admin/bookings?view=upcoming` instead.

## 6. Key States

| State | What the user sees |
|---|---|
| Therapist, first paint, has next visit | Greeting H1 + Next Visit hero (full content: client, time, address, Maps + Call buttons, gender chip if applicable, customer notes if any, Primary "Open booking") + Today's visits list with remaining today visits + Claimable strip + Weekly summary. |
| Therapist, has visits today but Next Visit is the only one | Greeting + Next Visit hero + (Today's visits list section hidden) + Claimable strip + Weekly summary. |
| Therapist, has zero visits today | Greeting + Next Visit hero in **empty state** ("Nothing scheduled. Your day is clear. Anything to claim?" + Primary "Browse claimable work" CTA → `/admin/bookings?view=claimable`) + (Today's visits list hidden) + Claimable strip + Weekly summary. **This is the BASELINE-CRITIQUE Casey #4 fix.** |
| Therapist, mid-day, has next visit later today | Same as default. The Next Visit is whichever booking is "next in time after now". |
| Therapist, evening, all today's visits done | Greeting H1 ("Good evening, Fatimah."), Next Visit hero shows **tomorrow's first visit** with "Tomorrow's first visit" eyebrow label (instead of "Next visit"). If no tomorrow visit: empty state with the same Browse-claimable CTA. |
| Therapist, has gender-required visit | Hero gender-match chip visible. Visible at every breakpoint. |
| Therapist, claimable strip empty | "Nothing open right now" line inside the Attention-tinted panel; no illustration. |
| Therapist, claimable strip overflowing | Mobile: horizontal snap-scroll, trailing chevron indicator hinting more content. Desktop ≥1024px: max 3 visible + "See all N →" Ghost link below the grid. |
| Loading | `AdminSkeleton` per section. Next Visit hero gets a tall skeleton block (~280px) so the page doesn't reflow when data lands. |
| Error in any section | Inline Cancelled family region with `role="alert" aria-live="polite"`, "Couldn't load this section. Try refreshing." Other sections render normally. |
| Therapist, accessing while inactive | Middleware blocks at `/admin/login?reason=inactive`; this surface never renders. |
| Therapist, the `staffName` prop somehow empty | Greeting falls back to a non-personalised "Good morning." (graceful, but flag in implementation; should not happen given `TherapistDashboardProps.staffName` is required). |

## 7. Interaction Model

- **Next Visit hero "Open booking" button** → `/admin/bookings/<id>`. Primary action.
- **Next Visit hero "Open in Maps" Ghost** → Google Maps deep-link per RECON §6.5; `target="_blank"`, opens new tab/app. Identical contract to the existing bookings-list link.
- **Next Visit hero "Call client" Ghost** → `tel:<phone>` link. Native iOS/Android handler. On desktop (no tel handler) the click falls back to a tooltip "Phone: <number>"; no error, just graceful degradation.
- **Today's visit row click** → `/admin/bookings/<id>`.
- **Claimable card "View" click** → `/admin/bookings/<id>`. The claim mutation itself is on the booking detail page.
- **Weekly summary tile click** → `/admin/staff/<staffId>` (the Therapist's own profile). If RBAC denies (e.g. the role lost `availability_mode` access), the tile renders as non-interactive; no broken link.
- **Date-range chip strip (≥768px only)** → submits a GET form with `range=` param, identical to the Owner/Admin filter strip but with only 4 presets (Today · Tomorrow · This week · Custom).
- **`@media (prefers-reduced-motion: reduce)`** honoured throughout; claimable horizontal scroll snap remains (it's not motion, it's layout); no transitions on hover or focus when reduced.
- **Keyboard order:** H1 → date-range chips (if present) → Next Visit hero (eyebrow → primary line → time → address → Maps button → Call button → gender chip → notes "Show full" if present → "Open booking") → Today's visits rows in date order → Claimable strip cards → Weekly summary tile.

## 8. Content Requirements

**Headings.**
- H1: "Good morning, Fatimah." / "Good afternoon, Fatimah." / "Good evening, Fatimah." (time-of-day from existing `getGreeting()`).
- Subtitle (no heading level): long-date format, e.g. "Tuesday 12 May".
- Next Visit hero eyebrow: "Next visit" (or "Tomorrow's first visit" when today is done, or "First visit back" on Monday if last visit was Friday).
- Today's visits list H2: "Today's visits ({N})".
- Claimable panel H2: "Open to claim ({N})".
- Weekly summary H2 (small): "This week".

**Empty-state copy.**

| Section | Heading | Body | CTA |
|---|---|---|---|
| Next Visit hero, no upcoming today | "Nothing scheduled" | "Your day is clear. Anything to claim?" | "Browse claimable work" → `/admin/bookings?view=claimable` |
| Next Visit hero, no upcoming today and no claimable either | "Nothing scheduled" | "Quiet day. Take care of yourself." | (no CTA) |
| Today's visits list, only the Next Visit exists | (section hidden) | | |
| Claimable strip, nothing available | "Nothing open right now" (single line, inside the panel, no illustration) | | |
| Weekly summary, no completed visits yet (Monday morning) | "Week starting" | "0 visits · 0h" | (rendered, not hidden; the absence is informative) |

**Microcopy.**
- Hero eyebrow: "Next visit" / "Tomorrow's first visit" / "First visit back" (Mondays only)
- Hero time format: "11:45 · 60 min"
- Hero address: full address with postcode + city, each segment on its own line
- Hero gender chip: "Same-gender required" (Restricted family); never colour-only
- Hero customer notes max-height: 8em mobile / 12em desktop with "Show full notes" Ghost link only if it overflows
- Hero buttons: "Open in Maps" · "Call client" · "Open booking"
- Today's visits row: client first name only (the Therapist already opened a relationship by being assigned) + service short name + start time
- Claimable card chip: "Available" (Attention family); never just an alert icon
- Weekly summary: "{N} visits · {about Nh} worked"; "about" softens the precision (Therapist isn't punching a time clock)

**Voice anchors hit.** Personal pronouns where natural ("Your day is clear", direct address to the Therapist). Verbs over nouns ("Browse claimable work", "Open in Maps", "Call client"). Real numbers ("0 visits · 0h" on a quiet Monday, not "—"). Empty states encourage without preaching ("Take care of yourself" on a fully-quiet day; Rahma is a wellness clinic; this voice is consistent with the brand). State-word discipline on chips.

## 9. Recommended References

- **`reference/spatial-design.md`** — for the single-column mobile rhythm and the deliberately-larger Next Visit hero proportions.
- **`reference/interaction-design.md`** — for the `tel:` and Google Maps deep-link contracts and the keyboard tab order on the hero panel.
- **`reference/copywriting.md`** — for the time-of-day greeting and the worker-tool voice that diverges from the admin-tool voice on the other two variants.
- **`reference/adapt.md`** — for the mobile-first → desktop-comfortable upgrade path that does not introduce multi-column chrome.

## 10. Open Questions

1. **Tomorrow's first visit eyebrow.** When all of today's visits are complete and the user opens the dashboard in the evening, the hero should pivot to tomorrow. The data layer (`TherapistDashboardProps.nextAppointment`) needs to either (a) already include tomorrow's first visit in this case, or (b) accept a fallback prop for it. Flag for Phase 6 implementer; if the data layer doesn't support it, the hero falls back to the "Nothing scheduled" empty state with the Browse-claimable CTA, which is still better than the current dashed-border placeholder.
2. **The `tel:` link on the hero.** PRODUCT.md doesn't explicitly call this out, but the Therapist persona (Casey, on the road) almost certainly wants to call the client directly from this screen rather than navigating to the detail page first. Implementing `tel:` is trivial; the question is whether the *client's phone number* is part of the `nextAppointment` payload from `dashboard-data.ts`. If not, this brief opens that as an extension, but absent that, the button degrades to "Open booking" routing only (no separate Call action).
3. **Cormorant Garamond on the hero time.** This is the only place Cormorant appears on this variant. The earlier Owner/Admin brief committed gold to marquee numerals on the dashboard; this brief commits Cormorant (in Chronicle, not gold) to the hero time. Risk: the time at 1.778rem in Cormorant on mobile may feel a touch precious in the context of a worker tool. **Current call:** keep it; Cormorant honouring the brand identity per RECON §7.2 + PRODUCT.md, and *time* is the single most important data here. If Phase 7 testing shows it reads as decorative rather than useful, fall back to Urbanist 600 1.778rem.
4. **Should the Weekly summary tile be linkable?** Linking to `/admin/staff/<staffId>` exposes the Therapist's own profile editor, which is appropriate for them (own-profile self-edit is RBAC-permitted) but the dashboard isn't an obvious entry point to that surface. Counter-argument: it's the only place on the Therapist dashboard that opens a deeper personal space, and the weekly counts naturally invite "show me more". **Current call:** linked, but secondary visually (no chevron, just hover state). Revisit if Phase 7 shows confusion.

---

**Carry-forwards this brief logs for Phase 6 implementation:**
- BASELINE-CRITIQUE Casey #4 fix: replace the dashed-border 25%-of-screen empty state with the `EmptyState` component carrying a "Browse claimable work" CTA → `/admin/bookings?view=claimable`. **This is the Therapist-variant's headline a11y/UX fix.**
- New for this variant: Next Visit hero with `tel:` + Google Maps deep-link, gender-match chip, customer notes block (open by default).
- New for this variant: Claimable horizontal-scroll strip (mobile) / 3-card grid (desktop) on the Attention-tinted panel.
- No `border-l-4`, no `bg-black`, no Recharts, no hardcoded avatar tints touched here (this variant doesn't render `dashboard-cards.tsx` directly; those carry-forwards are owned by Brief 06 and land once for all variants).

---

## Recipe Context

### Files to edit

| File | What changes |
|---|---|
| `src/app/admin/dashboard/TherapistDashboard.tsx` | Complete visual rework of the component body. Preserve the existing props interface (`TherapistDashboardProps`), the `getGreeting()` / `getFirstName()` / `formatHours()` helpers, and the date formatters. Replace the existing layout (header + KPI tiles + appointment list + claimable list + "All caught up" empty state) with: greeting H1, optional date-range chip strip at ≥768px, Next Visit hero panel, Today's visits list, Claimable horizontal-scroll strip, Quiet Weekly summary tile. Wire the empty-state CTA "Browse claimable work" → `/admin/bookings?view=claimable` (BASELINE-CRITIQUE Casey #4 fix). |
| `src/app/admin/dashboard/page.tsx` | The therapist branch (line 448 region) already routes to `TherapistDashboard`; preserve the routing. If new props are needed (e.g. `tomorrowFirstAppointment`, `nextAppointmentPhone`), they are added to the props interface here and threaded from `dashboard-data.ts` if and only if the implementer confirms with the data-layer owner. Default behaviour: no new props; missing data falls back to the documented empty state. |
| `src/app/admin/components/EmptyState.tsx` | No structural change; this brief uses the existing component for the hero empty state. Confirm a calendar illustration variant exists per DESIGN.md §5 EmptyState taxonomy ("no bookings → calendar with check mark"). If not, Phase 6 implementer adds the illustration asset to `public/images/admin/empty-states/` (anticipated per `redesign/IMAGES-NEEDED.md`). |

### Files to NEVER touch

- `src/app/admin/dashboard/dashboard-data.ts` — server-side aggregation, including the `assignedOnly` therapist filter at line 487. Any net-new prop (e.g. tomorrow's first visit, client phone on `nextAppointment`) is flagged as an Open Question, not silently added.
- `src/app/admin/dashboard/dashboard-helpers.ts`
- `src/app/admin/dashboard/dashboard-data.test.ts`, `dashboard-helpers.test.ts`
- `src/app/admin/bookings/actions.ts` — claim and update-own-assignment-status mutations; the dashboard only routes to the booking detail page where these are invoked.
- `src/app/admin/shell-variant.ts`, `src/app/admin/access.ts`
- `src/lib/auth/**`, `src/lib/supabase/**`, `src/middleware.ts`
- `supabase/migrations/**`
- All build/config files

### Feature Preservation Manifest

**Props contract that must not change (server contract from `dashboard-data.ts`):**
`staffName: string`, `today: string`, `data: ReportData`, `weekCount: number`, `todayAppointments: ReportData["bookings"]`, `nextAppointment: ReportData["bookings"][number] | null`.

**Helpers to preserve verbatim (`TherapistDashboard.tsx`):**
- `getGreeting()` (line 39), `getFirstName()` (line 52), `formatHours()` (line 56), `FORMATTERS` (lines 26–37). The brief intentionally re-uses these; no replacement helpers.

**Permission gates that must keep applying (RECON §2):**
- `getAdminPageAccess("dashboard")` ≠ none, Therapist has dashboard access via `manage_bookings_assigned` + `manage_availability_own`.
- `view_reports_revenue` must remain false (no revenue numbers visible on this variant).
- Therapist has `manage_availability_own` and self-edit on own staff profile, both required for the Weekly summary tile link to `/admin/staff/<staffId>`.
- Middleware blocks at `/admin/login?reason=inactive` for inactive accounts; this surface never renders for them.

**JS hooks / IDs to preserve (RECON §6.4):**
- `id="admin-main"` + skip-link
- `id="admin-command-search"` (in the global `AdminTopNav`, not duplicated here)
- No dashboard-specific IDs on the Therapist variant (the `attention-dialog-title` is owned by the Owner/Admin and Coordinator variants).

**Server actions:** none from this page directly (the dashboard is read-only; all mutations are reached via deep-links to `/admin/bookings/<id>`).

**Audit log writes:** none from this page directly.

**External / deep links to preserve (RECON §6.5):**
- POST `/admin/signout` (never a GET; in the global top nav)
- Google Maps deep-link per booking: `https://www.google.com/maps/search/?api=1&query=${address}`, `target="_blank"`; the Next Visit hero "Open in Maps" Ghost uses the same contract as the Bookings list link
- `tel:<phone>` (new on this surface; degrades gracefully on desktop where there's no tel handler)
- `/admin/bookings/<id>` (Today rows, Claimable cards, hero "Open booking" button)
- `/admin/bookings?view=claimable` (empty-state CTA, BASELINE-CRITIQUE Casey #4 fix)
- `/admin/bookings?view=upcoming` (date-range "Custom" fallback hint when chip strip is not present)
- `/admin/staff/<staffId>` (Weekly summary tile, self-link, RBAC-gated)

### Information hierarchy (top to bottom)

1. Personal greeting + date (H1 + subtitle, anchors the worker tool tone)
2. Date-range chip strip (≥768px only; mobile omits)
3. Next Visit hero (the *one thing* the page exists for; tallest panel, richest content)
4. Today's visits list (secondary; everything else due today after the Next Visit)
5. Claimable work strip (peer-to-peer opportunity; Attention-tinted to invite the eye but not dominate)
6. Quiet Weekly summary (reassurance, not a stat card; the smallest visual element on the page)

### Design direction, tokens and components

- **H1 greeting:** Urbanist 600 display step (`clamp(1.778rem, 3vw, 2.369rem)`), Chronicle (`oklch(11% 0.014 155)`).
- **Subtitle:** Work Sans 400 label step, Soft Slate (`oklch(42% 0.008 143)`).
- **Date-range chips (≥768px):** identical token set to Brief 06 active/inactive pills; 4 presets only.
- **Next Visit hero panel:** `AdminPanel` at `surface-card` (`oklch(99.2% 0.004 88)`) over `surface-page` canvas; 8px radius; padding `xl` (32px); 1px `border-subtle`; no shadow at rest; `card-hover` shadow when the entire panel is interactive on hover (linking to `/admin/bookings/<id>` makes it interactive).
- **Hero eyebrow:** Work Sans 500 label step (0.75rem), Soft Slate, leading `arrow-right` 16px Lucide (`aria-hidden="true"`).
- **Hero primary line:** Urbanist 600, title step on mobile (1.333rem), heading step at ≥768px (1.778rem); Chronicle.
- **Hero time + duration:** Cormorant Garamond 700, 1.778rem mobile / 2.369rem desktop, Chronicle. **The only Cormorant on this variant.** Format "11:45 · 60 min".
- **Hero address block:** Work Sans 400 body, Practice Charcoal; each line on its own row; leading `map-pin` 16px.
- **Hero buttons:** Ghost style at 44px height (touch target); side-by-side at mobile; full-width Primary "Open booking" trailing.
- **Hero gender chip:** Restricted family pair (`status-restricted-bg` / `status-restricted-text`); pill shape (9999px radius); leading `lock` 16px `aria-hidden="true"`.
- **Hero customer notes:** Work Sans 400 body; max-height 8em mobile / 12em desktop; wrapped in `<details open>`; overflow indicator with "Show full notes" Ghost link.
- **Hero empty state:** `EmptyState` component (DESIGN.md §5); 80–120px calendar illustration; Urbanist 600 title step heading; Soft Slate body; Primary CTA button.
- **Today's visits list:** compressed `BookingListCard` variant; 32px client avatar; no inline quick-actions on this variant; status pill follows DESIGN.md §5 spec.
- **Claimable strip panel:** `AdminPanel` with Attention family background tint (`status-attention-bg`) + 1px `status-attention-text` border. **NEVER `border-l-4`.**
- **Claimable card:** ~280px wide on mobile (snap-scroll), grid item at ≥1024px (3 visible). `surface-card` background; full-width Ghost "View" button.
- **Claimable card "Available" chip:** Attention family pair; leading `clock` 16px `aria-hidden="true"`; never colour-only.
- **Weekly summary tile:** small `AdminPanel`; `<dl>` description-list pattern; Work Sans 500 title step (no Cormorant); no Pending/Confirmed/Attention tint (it's neutral; this is reassurance, not status).
- **Focus ring:** 3px Focus Azure (`oklch(47% 0.095 230)`) with 2px offset on every interactive element.
- **Reduced-motion contract:** no transitions on hover/focus; snap-scroll layout preserved (not motion).
- **Skeleton:** `AdminSkeleton` per section; the hero skeleton is taller (~280px) so the layout doesn't reflow when data lands.

---

## Implementation Notes

Per-state intent lives in §6 Key States (above). Per-viewport intent lives in §5 Layout Strategy (above); mobile <768px is the primary canvas, desktop ≥1024px is documented as a single-column-comfortable upgrade.

**Verification steps (for Phase 6 Step 6 verify):** Playwright + DevTools + `/impeccable audit` + `/impeccable critique`.

---

## Copy

### Form labels

Read-only surface. The only labelled control is the optional date-range chip strip (≥768px):
- Date-range — group label `Date range` (sr-only). Chips: `Today`, `Tomorrow`, `This week`, `Custom`. Custom reveals `From` / `To`.

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Hero "Open booking" | `Open booking` | Primary |
| Hero "Open in Maps" | `Open in Maps` | Ghost |
| Hero "Call client" | `Call client` | Ghost |
| Hero "Show full notes" (when overflowing) | `Show full notes` | Ghost |
| Empty hero CTA | `Browse claimable work` | Primary |
| Claimable card | `View` | Ghost |
| Claimable strip overflow (desktop) | `See all {N} →` | Ghost |
| Date-range chips | `Today` / `Tomorrow` / `This week` / `Custom` | Pill |

### Error messages

- `tel:` link fails (desktop without handler): falls back to inline phone number — no error toast.
- Maps link fails (no GPS / no internet): native browser handles; no specific copy.
- Hero data load failure: `Couldn't load the next visit. Try refreshing.` (inline Cancelled banner inside the hero).
- Claimable strip load failure: `Couldn't load claimable work.` (inline, with `Try again` Ghost).
- Weekly summary load failure: silent (tile hides; no broken state shown to a worker on the go).
- Permission revoked mid-session: `Your access has changed. Refresh to continue.` (persistent toast, brought down from `00-shared-components`).

### Empty-state text

| Section | Heading | Body | CTA |
|---|---|---|---|
| Hero, no upcoming today | `Nothing scheduled` | `Your day is clear. Anything to claim?` | `Browse claimable work` |
| Hero, no upcoming and no claimable | `Nothing scheduled` | `Quiet day. Take care of yourself.` | — |
| Hero (evening, today done, tomorrow has visits) | (uses eyebrow `Tomorrow's first visit`, hero filled) | — | — |
| Hero (Monday morning, last visit was Friday) | (uses eyebrow `First visit back`, hero filled) | — | — |
| Today's visits list, only the Next Visit | (section hidden entirely) | — | — |
| Today's visits list, all done after Next | `No more visits today` (inline under heading) | `That's all for today.` | — |
| Claimable strip, empty | `Nothing open right now` (inline, no illustration) | — | — |
| Weekly summary, fresh week (0 visits) | `Week starting` | `0 visits · 0h` | — |

### Tooltip text

- Hero eyebrow icon: `Next visit` (or variant) — same as the visible label, paired for screen readers.
- Hero time Cormorant: native `title` shows full start–end, e.g. `11:45 – 12:45 BST`. (Enhancement only; not visible on mobile. The start time is the primary signal; end time is the added value here.)
- Hero address: no tooltip — the "Open in Maps" button directly below is self-explanatory.
- Hero gender chip: `This client asked for a same-gender therapist`.
- Hero customer notes "Show full notes": `Expand to read the full notes`.
- "Open in Maps" Ghost: `Open this address in Google Maps`.
- "Call client" Ghost: `Call {client name}` (e.g. `Call Sara`).
- Today's-visits status pill on a row: `{status}: select to open`.
- Claimable card "Available" chip: `This booking is open for claiming.`
- Weekly summary tile: `Open your staff profile`.

### Confirmation dialog text

This page mutates nothing. The Claim action lives on the booking detail page (Brief 05). No `ConfirmActionModal` instances here.

**Toasts**
- No toasts trigger from this page directly. (Sonner toasts confirming claim, status updates, etc. fire on the booking detail page that this dashboard routes to.)
