# Brief: availability

## 1. Feature Summary

The global availability page is the clinic's scheduling backbone — where the Owner or Admin sets the recurring weekly working hours, marks specific closed dates, and creates date-specific hour adjustments. A read-only capacity preview sits above the three management sections and shows the live result of the rules: which days are open, what hours, and how many male/female therapists are configured. On desktop, all three managers stack below the preview; on mobile, they become a tab strip while the preview remains pinned above. The page is gated to `manage_availability_global` (Owner and Admin/PM only).

## 2. Primary User Action

**Understand the clinic's current working hours at a glance and confidently adjust any rule — recurring schedule, a specific closed day, or a one-off hour change — without needing to cross-reference multiple screens.**

## 3. Design Direction

**Colour strategy:** Restrained. This is a settings configuration page — the working-hours grid uses Confirmed family tint for open days and Restricted family tint for closed days, but everything else stays on the warm ivory canvas with minimal accent. Data should be scannable, not decorated.

**Theme scene sentence:** *"The Owner on her desktop on a Sunday evening, blocking off the bank holiday Monday and checking that next week's working hours still look right before the week starts."* The scene forces light mode (locked), desktop-primary, deliberate task mode — not triage speed.

**Anchor references:**
- **Google Calendar's settings panel** — structured, scannable weekly grid, consistent row height, clear open/closed visual distinction without noise
- **Linear's team settings page** — form sections stacked with clear headings, no decorative chrome competing with the controls
- **Calendly availability editor** — 7-day grid with per-day on/off toggle and time ranges is the closest interaction model reference

## 4. Scope

Production-ready. Capacity preview redesigned as an `AdminPanel` summary with 7-day strip and `AdminEntityRow` staff list; three managers restyled to DESIGN.md token system; responsive tab/stack pattern (tabbed on mobile, stacked on desktop). Phase 6 implements.

## 5. Layout Strategy

**Capacity preview (`AdminPanel`, always visible on both mobile and desktop):**

Section H2: "This week's capacity". Right side of panel header: two `AdminStatusBadge`-style pills (Confirmed family) — "Male: {n}" and "Female: {n}". If any blocked date or override falls within the current calendar week, a Pending-family chip "1 closure this week" (or "{n} adjustments this week") appears in the header row as a non-interactive metadata signal.

Two rows below the header:

- **7-day working-hours strip:** horizontal row of seven equal-width columns (Mon–Sun). Each column: day name (Work Sans 500, label step, Soft Slate) + hours range (IBM Plex Mono, label step, Practice Charcoal) on `surface-selected` Clinic Green tint for working days, or "Closed" (Work Sans 400, label step, `status-restricted-text`) on `status-restricted-bg` tint for closed days. On mobile: horizontally scrollable strip with momentum scroll.

- **Staff configuration list:** `AdminEntityRow` rows — avatar/initials (32px, deterministic tint) + staff name (Urbanist 600, title step) + availability-mode badge (Pending family for "custom", Confirmed family for "global") + config-status chips ("custom rules" / "blocked dates" / "overrides" — Restricted family pills, only shown when that staff member has custom config set). Replaces the current `md:grid-cols-2 xl:grid-cols-3` card grid.

**Three managers:**

Desktop (≥768px): all three stack as `AdminPanel` sections with H2 headings — "Working hours" / "Closed dates" / "Hour adjustments" — with `lg` (24px) gap between them.

Mobile (<768px): a three-tab pill strip ("Hours" / "Closed dates" / "Adjustments") sits below the capacity preview. One client component wraps the strip and the three manager containers; `activeTab` state controls visibility. Inactive sections are `hidden`. Default active tab: "Hours".

**Within each manager:**

- **Working hours:** Seven rows, one per day. Each row: day name (Work Sans 500, body step) + shadcn `Switch` (Clinic Green when on) + `start_time` / `end_time` inputs visible only when toggled on (160ms ease-gentle reveal). Row height 44px minimum. "Save hours" Primary button at the bottom of the panel submits all seven rows together.

- **Closed dates:** Inline add-form above the list (`blocked_date` date picker + `reason` text input + Primary "Add"). Existing entries as `AdminEntityRow` rows: date (IBM Plex Mono) + reason + trailing Ghost `trash-2` delete (triggers `ConfirmActionModal`). Empty state: `EmptyState` component.

- **Hour adjustments:** Same pattern — `override_date` + `start_time` + `end_time` + `reason` add-form above the list. Existing entries as rows with delete. Empty state: `EmptyState` component.

## 6. Key States

| State | What the user sees |
|---|---|
| Default (desktop) | Capacity preview + three stacked manager panels |
| Default (mobile) | Capacity preview + tab strip, "Hours" tab active |
| This-week closure/override present | Pending-family chip in capacity preview header |
| Working-hours day toggled off | Time inputs disappear (160ms); row dims to Restricted tint |
| Working-hours day toggled on | Time inputs appear (160ms); row gains Confirmed tint |
| Working-hours saving | "Save hours": 16px spinner, `aria-busy="true"` |
| Working-hours saved | Toast "Working hours saved." (Confirmed, 4s); capacity preview refreshes |
| Add blocked date / override: submit | Row appears in list; inline form resets to empty |
| Add form validation error | `role="alert"` below the errored input |
| Delete: confirm modal | "Remove this closed date?" / "Remove" (Destructive) + "Keep it" |
| No active staff | Capacity preview staff list shows `EmptyState` "No active staff" |
| Permission denied | `AdminAccessDenied` (role-specific copy per Role variants) |

## 7. Interaction Model

**Mobile tab strip:** clicking a tab sets `activeTab` (presentation-only state, no URL change). Default: "Hours". Tabs do not validate unsaved changes on switch — the user can freely navigate between tabs.

**Working-hours toggles:** toggling off hides time inputs with 160ms ease-gentle; toggling on reveals them. Unsaved state is signalled by the "Save hours" button becoming active (no disabled state at rest — it is always enabled so the user can save the current state without needing to make a change first). One "Save hours" submits all seven rows together in a single form POST.

**Inline add-forms:** above the respective list, always visible (no "Add" disclosure button to tap). Submit resets the form and appends the new row to the list. If the date already exists (duplicate blocked date), a server-side validation error returns an `role="alert"` inline message.

**Delete:** trailing `trash-2` Ghost button visible at rest on every list row (never hover-reveal — mobile-first). Triggers `ConfirmActionModal` with context-aware copy.

**Capacity preview refresh:** page uses `revalidatePath` after every server action, so the Server Component capacity preview reflects the latest rules automatically after any save/delete.

## 8. Content Requirements

**Page H1:** "Availability"

**Section H2s:** "This week's capacity" / "Working hours" / "Closed dates" / "Hour adjustments"

**Mobile tab labels:** "Hours" / "Closed dates" / "Adjustments"

**Capacity header pills:** "Male: {n}" / "Female: {n}" (Confirmed family)

**This-week signal chips:** "1 closure this week" / "{n} closures this week" / "1 adjustment this week" / "{n} adjustments this week" (Pending family)

**Working-hours day labels:** Monday / Tuesday / Wednesday / Thursday / Friday / Saturday / Sunday

**Availability-mode badge labels:** "Global schedule" (Confirmed family) / "Custom schedule" (Pending family)

**Config-status chip labels:** "custom rules" / "blocked dates" / "overrides" (Restricted family, only when present)

**Add-form button:** "Add" (Primary, inline)

**Save-hours button:** "Save hours" (Primary)

**Delete confirmation copy:**
- Closed date: "Remove this closed date?" / "The clinic will show as available on this day." / "Remove" (Destructive) + "Keep it"
- Override: "Remove this hour adjustment?" / "The clinic will revert to its standard hours on this day." / "Remove" (Destructive) + "Keep it"

**Empty state copy:**

| Context | Heading | Body |
|---|---|---|
| No closed dates | No closed dates | Add a date when the whole clinic is unavailable. |
| No overrides | No hour adjustments | Add a date when the clinic runs different hours. |
| No active staff | No active staff | Add staff members to see capacity here. |

## 9. Recommended References

- `reference/interaction-design.md` — toggle show/hide transitions, `ConfirmActionModal` for destructive deletes, mobile tab strip state, inline add-form pattern
- `reference/spatial-design.md` — 7-day horizontal strip, `AdminEntityRow` staff list, stacked panels
- `reference/motion-design.md` — 160ms ease-gentle toggle content reveal

## 10. Open Questions

1. **7-day strip start day.** Confirm the `day_of_week` integer convention (0 = Sunday or 0 = Monday) in the existing `availability_rules` data before Phase 6 renders the Mon–Sun visual order.
2. **Capacity preview — recurring vs. this-week.** Brief specifies: show the recurring rule template always, plus a Pending-family chip if any blocked date or override falls within the current calendar week. Confirm this matches what the Owner finds useful vs. a fully date-resolved view.

---

## Role variants

### Owner

**Visible:** Full page — capacity preview (all staff rows, all chips), all three manager panels, all add-forms, all delete actions, "Save hours" button.

**Hidden:** Nothing.

**Role-specific notes:** Owner is the primary user of this page. Weekly configuration task, not daily operational. Desktop-primary usage.

---

### Admin (Practice Manager)

**Visible:** Identical to Owner — full capacity preview, all three managers, all edit affordances.

**Hidden:** Nothing.

**Role-specific notes:** Admin/PM holds `manage_availability_global` fully. No UI differences from Owner on this page.

---

### Booking Coordinator

**Visible:** `AdminAccessDenied` only.

**Hidden:** Capacity preview, all managers, all forms.

**Role-specific copy:** "You don't have access to availability settings. Contact the owner if you think this is a mistake." Secondary "Back to dashboard" → `/admin/dashboard`.

**Why denied:** Coordinators manage bookings and clients but do not hold `manage_availability_global`.

---

### Therapist

**Visible:** `AdminAccessDenied` only.

**Hidden:** Everything.

**Role-specific copy:** "Global availability settings are managed by the owner or practice manager. To update your personal availability, visit your profile." Secondary "My availability" → `/admin/staff/{ownStaffId}/availability`.

**Why denied:** Therapists manage their own availability via `/admin/staff/{id}/availability`. The denied copy is more specific than the generic version — it tells them exactly where to go instead.

---

### Denied state

Rendered for: Booking Coordinator, Therapist, Inactive accounts, and any custom role without `manage_availability_global`.

**What renders:** `AdminAccessDenied` with role-specific copy per above. No capacity preview, no managers, no forms.

---

## Recipe Context

### Files to edit

| File | What changes |
|---|---|
| `src/app/admin/availability/page.tsx` | Restructure capacity preview: replace inline card grid with `AdminPanel` + 7-day strip + `AdminEntityRow` staff list + this-week chips; add responsive tab/stack client wrapper around the three managers |
| `src/app/admin/availability/AvailabilityRulesManager.tsx` | Restyle to DESIGN.md tokens: 7-row day grid, shadcn `Switch` per row, time inputs with 160ms ease-gentle reveal, "Save hours" Primary button at bottom |
| `src/app/admin/availability/BlockedDatesManager.tsx` | Restyle: inline add-form above list, `AdminEntityRow` rows, Ghost `trash-2` + `ConfirmActionModal`, `EmptyState` component |
| `src/app/admin/availability/AvailabilityOverridesManager.tsx` | Same restyle as `BlockedDatesManager` plus `start_time` / `end_time` fields in the add-form |

### Files to NEVER touch

- `src/app/admin/availability/actions.ts` — `saveAvailabilityRule`, `deleteAvailabilityRule`, `createBlockedDate`, `deleteBlockedDate`, `createAvailabilityOverride`, `deleteAvailabilityOverride`
- `src/lib/auth/**`, `src/lib/supabase/**`, `src/middleware.ts` — standard untouchables (RECON §5)
- `supabase/migrations/**`
- All build/config files

### Feature Preservation Manifest

**Form field `name` attributes that must not change (RECON §2):**

Rules: `rule_id` (hidden), `day_of_week`, `start_time`, `end_time`, `is_working_day`

Blocked dates: `blocked_date`, `reason`

Overrides: `override_date`, `start_time`, `end_time`, `reason`

**Server action wire-ups:**
- `saveAvailabilityRule` — `AvailabilityRulesManager` "Save hours"
- `deleteAvailabilityRule` — rule row delete
- `createBlockedDate` — `BlockedDatesManager` add-form
- `deleteBlockedDate` — blocked-date row delete
- `createAvailabilityOverride` — `AvailabilityOverridesManager` add-form
- `deleteAvailabilityOverride` — override row delete

**Audit writes that must keep firing (RECON §6.2):**
`availability_rule_created`, `availability_rule_updated`, `availability_rule_deleted`, `blocked_date_created`, `blocked_date_deleted`, `availability_override_upserted`, `availability_override_deleted`

**`revalidatePath` requirement:** capacity preview is a Server Component — confirm `revalidatePath('/admin/availability')` is called in every action in `actions.ts` so the preview refreshes after each mutation.

### Information hierarchy (top to bottom)

1. Capacity preview (`AdminPanel`) — the result of the rules (read-only, always visible)
2. Working-hours manager — recurring schedule (the foundation)
3. Closed-dates manager — specific closed days (overrides schedule)
4. Hour-adjustments manager — specific days with different hours (most specific, least frequent)

### Design direction — tokens and components

- **Capacity preview panel:** `AdminPanel` — `surface-card`, 8px radius, 1px `border-subtle`, no shadow at rest
- **Capacity pills:** Confirmed family + Lucide `users` icon (16px, `aria-hidden`)
- **This-week chips:** Pending family — non-interactive metadata signal
- **7-day strip open day:** `surface-selected` background, IBM Plex Mono hours, Practice Charcoal
- **7-day strip closed day:** `status-restricted-bg` background, Work Sans 400 "Closed", `status-restricted-text`
- **Staff list rows:** `AdminEntityRow` — `surface-page`, `border-bottom: 1px border-subtle`, 44px min-height, 32px avatar
- **Mode badges:** Confirmed family "Global schedule" / Pending family "Custom schedule"
- **Config chips:** Restricted family pill — shown only when present
- **Working-hours toggle:** shadcn `Switch`, Clinic Green active; time inputs `surface-input` + `border-default`
- **Save-hours button:** Primary full-width within Working hours panel
- **Add-form button:** Primary "Add" right-aligned (desktop) / full-width (mobile)
- **List-row delete:** trailing Ghost `trash-2` (16px), visible at rest, triggers `ConfirmActionModal`
- **Mobile tab strip:** pill tabs matching DESIGN.md Admin-Specific Patterns View Tabs — `action-primary` fill active, transparent inactive

---

## Implementation Notes

### Per-state intent

**Default (desktop)**
- Capacity preview + three stacked manager panels
- Working-hours rows show toggles and time inputs for working days; closed days show toggle off with no inputs

**Default (mobile)**
- Capacity preview full-width above tab strip
- "Hours" tab active; other sections `hidden`
- 7-day strip is a horizontally scrollable momentum strip

**This-week closure/adjustment**
- Pending-family chip in capacity preview panel header
- Recurring rules still shown as the baseline in the 7-day strip

**Day toggled off → on**
- Toggle animates; time inputs appear (160ms ease-gentle); row background shifts to `surface-selected`

**Day toggled on → off**
- Toggle animates; time inputs collapse (160ms); row background shifts to `status-restricted-bg`

**Saving working hours**
- "Save hours": 16px spinner, `aria-busy="true"`, text unchanged; inputs remain enabled

**Saved**
- Sonner toast "Working hours saved." (Confirmed, 4s); page revalidates; capacity preview 7-day strip updates

**Add-form error**
- `<div role="alert" aria-live="polite" aria-atomic="true">` below errored input; "Add" re-enables; values retained

**Delete confirm**
- `ConfirmActionModal` with context-specific copy; on confirm: row removed, page revalidates

**Permission denied**
- Coordinator: standard `AdminAccessDenied`
- Therapist: specific copy with "My availability" Secondary link → `/admin/staff/{ownStaffId}/availability`

### Per-viewport intent

**Mobile (375px)**
- Capacity preview: full-width, `lg` padding; 7-day strip `overflow-x: auto` momentum scroll; staff rows full-width
- Tab strip: three pill tabs below preview, 44px touch target height; `action-primary` active fill
- Active manager: full-width, `md` padding; add-form fields stack vertically; "Save hours" and "Add" buttons full-width
- Delete button: trailing `trash-2`, 44px touch target

**Tablet (768px)**
- Tab strip hidden; all three managers stack (desktop layout from ≥768px)
- 7-day strip no longer scrollable — all 7 columns fit at this width

**Desktop (1440px)**
- Content max-width: `--content-width-lg`
- Three managers stacked with `lg` (24px) gap
- "Save hours" Primary right-aligned in Working hours panel footer, max-width 200px
- "Add" Primary right-aligned in each add-form row

### Verification steps

**Playwright (automated):**
- Toggle a working day off: time inputs disappear (160ms); "Save hours" fires `saveAvailabilityRule`; toast appears; 7-day strip in capacity preview updates
- Add a blocked date: fill form, click "Add"; row appears in list; form resets; this-week chip appears if date is in current week
- Delete a blocked date: click `trash-2`; `ConfirmActionModal` opens with correct copy; confirm; row gone; page revalidates
- Mobile tab strip (375px): "Closed dates" tab shows closed-dates manager only; "Hours" tab restores working-hours manager
- Therapist denied: `/admin/availability` as Therapist → `AdminAccessDenied` with "My availability" link to own staff availability page

**DevTools:**
- `revalidatePath` fires after every action (confirmed by capacity preview reflecting changes without manual reload)
- `Switch` toggles have accessible labels (associated with day name)
- Zero console errors on any state or viewport

**`/impeccable audit`:**
- Zero `border-l-4` on any row (working-hours, closed-date, or override rows)
- 7-day open-day cells use full tint background, not a side stripe
- All badges and chips have text labels (not colour-only)

**`/impeccable critique`:**
- H1 "Availability" → H2 per panel — no heading skips
- Every form input has an associated `<label>`
- `Switch` toggles have descriptive accessible names ("Monday working day")
- All error regions use `role="alert" aria-live="polite" aria-atomic="true"`
- Required date fields marked with `<span aria-hidden="true">*</span>`

---

## Copy

Voice: calm, plain, direct, kind. Verbs over nouns. Policy fields paired with plain-English consequence helpers. Encouraging empty states; specific errors; no raw permission names or raw DB column names in user copy.

### Form labels

**Working hours (per row, 7 rows):**
- Day toggle (shadcn Switch) — accessible label `{Day}, open` (e.g. `Monday, open`).
- Start time — `Opens` (input type `time`, `name="start_time"`).
- End time — `Closes` (input type `time`, `name="end_time"`).

**Closed dates add-form:**
- Date picker — `Date` (required `*`, `name="blocked_date"`). Placeholder `Pick a date`.
- Reason — `Reason (optional)` (`name="reason"`). Placeholder `e.g. Eid al-Fitr, staff training day`.

**Hour adjustments add-form:**
- Date picker — `Date` (required `*`, `name="override_date"`). Placeholder `Pick a date`.
- Start time — `Opens` (required `*`, `name="start_time"`).
- End time — `Closes` (required `*`, `name="end_time"`).
- Reason — `Reason (optional)` (`name="reason"`). Placeholder `e.g. Late start for staff meeting`.

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Save weekly working hours | `Save hours` | Primary |
| Add a closed date | `Add closed date` | Primary |
| Add an hour adjustment | `Add adjustment` | Primary |
| Delete row (closed date / override) | (icon-only `trash-2`) | Ghost — tooltip below |
| Confirm modal — destructive | `Remove` | Destructive |
| Confirm modal — cancel | `Keep it` | Secondary |
| Mobile tab pills | `Hours` / `Closed dates` / `Adjustments` | Tab-pill |

### Error messages

- Working day with end before start: `End time has to be after start time.`
- Working day toggled on with no times: `Set opening and closing times, or toggle the day off.`
- Closed date duplicate: `That date is already closed. Edit or delete the existing entry.`
- Override conflicts with existing override: `That date already has an adjustment. Delete the existing one first.`
- Override on a non-working day: `That day is closed in the weekly schedule. Open it in Working hours before adding an adjustment.`
- Date in the past: `Pick a date from today onwards.`
- Save-hours network failure: `Couldn't save the hours. Try again.`
- Add-form network failure: `Couldn't add the entry. Try again.`
- Delete network failure: `Couldn't remove the entry. Try again.`

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| No closed dates | `No closed dates` | `Add a date when the whole clinic is unavailable.` | — (inline add-form sits above) |
| No hour adjustments | `No hour adjustments` | `Add a date when the clinic runs different hours from the weekly schedule.` | — |
| No active staff (capacity preview) | `No active staff yet` | `Add a therapist to see capacity here.` | `Add staff` → `/admin/staff` |
| Denied — Coordinator | `You don't have access to this section` | `Availability settings are managed by the owner or practice manager.` | `Back to dashboard` |
| Denied — Therapist | `This section is for the practice owner` | `Your working hours are on your availability page.` | `My availability` → `/admin/staff/{ownStaffId}/availability` |

### Tooltip text

- Row `trash-2` Ghost button (closed date): `Remove this closed date`.
- Row `trash-2` Ghost button (override): `Remove this hour adjustment`.
- Capacity-preview "Male: N" / "Female: N" pills: `{N} active male therapists` / `{N} active female therapists` (native `title`).
- This-week chip ("1 closure this week"): native `title` lists the dates, e.g. `Closed: Mon 26 May (Bank Holiday)`.
- 7-day strip closed cell: `Closed every {Day}` (native `title`).
- Availability-mode badge on staff row: `Global schedule` → `Uses the clinic's weekly hours`. `Custom schedule` → `Has their own working hours set`.

### Confirmation dialog text

**Remove closed date**
- Heading: `Remove this closed date?`
- Body: `The clinic will show as available on {date}. Existing bookings on that day stay put.`
- Destructive: `Remove`
- Secondary: `Keep it`

**Remove hour adjustment**
- Heading: `Remove this hour adjustment?`
- Body: `The clinic will use its standard hours on {date} again.`
- Destructive: `Remove`
- Secondary: `Keep it`

**Toasts**
- Save working hours success: `Working hours saved.`
- Add closed date success: `Closed date added.`
- Add adjustment success: `Hour adjustment added.`
- Remove success: `Removed.`
- Any failure: persistent Cancelled toast `Something didn't save. Try again.` with Retry Ghost.
