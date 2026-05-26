# Deferrals — dashboard-therapist

## Gender-match chip on Next Visit hero
- **Source:** brief §5 point 2 + §8 (Hero gender chip "Same-gender required" Restricted family)
- **Verbatim:** "Gender-match chip (when `required_gender` is set on the booking): Restricted family pill reading 'Same-gender required'; clinical legibility per DESIGN.md §5."
- **Defer to:** Phase 7
- **Why deferred:** `required_gender` is not on the `TherapistDashboardProps.nextAppointment` payload (Open Question 2 in brief). Extending `dashboard-data.ts` is untouchable per recipe Hard Rule §3. Awaiting Phase 7 gauntlet to coordinate the data-layer extension across all variants.
- **Provisional Phase 6 answer used to continue this session:** Chip omitted; hero renders without gender annotation. Tests of an existing booking with same-gender requirement will not surface the chip until the prop lands.

## Customer notes block on Next Visit hero
- **Source:** brief §5 point 2 (open-by-default `<details>` notes block) + §8 ("Hero customer notes max-height 8em mobile / 12em desktop")
- **Verbatim:** "Customer notes block (when present): Work Sans 400 body, never collapsed under a 'Show notes' toggle; Therapist needs this *before they arrive*, not after they tap. Max-height 8em with a 'Show full notes' Ghost link only if it overflows. Wrapped in `<details open>` so it's keyboard-toggleable but visible by default."
- **Defer to:** Phase 7
- **Why deferred:** Customer-notes field is not on `TherapistDashboardProps.nextAppointment` payload (related to Open Question 2). `dashboard-data.ts` is untouchable per recipe.
- **Provisional Phase 6 answer used to continue this session:** Customer notes section omitted. Therapist still has Open booking → detail page where notes are surfaced.

## Tomorrow's-first-visit eyebrow data fallback
- **Source:** brief §6 (Therapist, evening, all today's visits done) + Open Question 1
- **Verbatim:** "When all of today's visits are complete and the user opens the dashboard in the evening, the hero should pivot to tomorrow."
- **Defer to:** Phase 7
- **Why deferred:** `nextAppointment` may already point to tomorrow's first visit; the data-layer behaviour for "after today's last visit completes, return tomorrow's first" is not verifiable without `dashboard-data.ts` inspection (untouchable per recipe).
- **Provisional Phase 6 answer used to continue this session:** Eyebrow logic checks `appointment.booking_date === today` and labels accordingly ("Next visit" today / "Tomorrow's first visit" otherwise). Monday-after-Friday "First visit back" case unimplemented.

## Date-range chips active-state `aria-current`
- **Source:** Step 12a P2 finding
- **Verbatim:** "Date-range chips render as Link GET with no `aria-current` on the active range."
- **Defer to:** Phase 7
- **Why deferred:** Active-chip detection requires reading the current `range` GET param via `useSearchParams` or props — page is a server component; threading the active value through is a small but cross-cutting change touched on by Phase 7 gauntlet's a11y sweep (Sam #3 carry-forward).
- **Provisional Phase 6 answer used to continue this session:** Chips are decorative pass-through links without active-state styling.

## Weekly summary tile self-link
- **Source:** brief §7 + Step 12a P2 finding
- **Verbatim:** "Weekly summary tile click → `/admin/staff/<staffId>` (the Therapist's own profile). If RBAC denies, the tile renders as non-interactive."
- **Defer to:** Phase 7
- **Why deferred:** `staffId` is not on `TherapistDashboardProps` and would require an additive prop. Recipe directs missing props to be flagged, not silently added.
- **Provisional Phase 6 answer used to continue this session:** Weekly summary tile renders as non-interactive panel.

## Claimable strip mobile cap (5 vs 9)
- **Source:** brief §5 point 4
- **Verbatim:** "horizontal scroll strip on mobile with up to 5 compact claim cards"
- **Defer to:** Phase 7
- **Why deferred:** Trivial slice-cap change; deferred only to bundle with Phase 7 gauntlet's per-page cap pass.
- **Provisional Phase 6 answer used to continue this session:** Strip caps at 9 cards.
