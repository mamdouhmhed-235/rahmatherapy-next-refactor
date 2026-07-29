# C-FIELDWORK-EXPERIENCE — Capability-keyed fieldwork ergonomics — PROGRESS

**Plan:** `redesign/plans/C-phase/C-FIELDWORK-EXPERIENCE-plan.md`
**Brief:** `redesign/briefs/C-FIELDWORK-EXPERIENCE-brief.md`
**Programme:** Band C, C-C implementation — plan **#7 of 22** (§4 order).
**Predecessor closed at:** `9ce16e0` (C-01 Owner-backlog update)

> ## ✅ STATUS: SHIPPED — all 4 phases implemented + independently verified (one fix round in Phase D), whole-plan closeout review passed, master-plan checklist flipped.
> **Final commit:** `6314718` · bookkeeping in this file's commit + the checklist-flip commit.
>
> **Pure code plan — no migration, no Zone-2 actions triggered anywhere.** Both ⛔ capability-flip blocks (plan §3.2, §6) were pre-flight-determined unnecessary: the real Owner account and `test.admin@rahmatherapy.example.test` already had `can_take_bookings=true`. Confirmed by closeout grep: zero `staff_profiles` writes anywhere in the diff.
>
> **§3.2 (Playwright role sweep) and §3.4 (screenshots) NOT RUN — Owner-performed by necessity**, same standing policy as every prior plan. No safe existing test fixture is currently assigned to any test staff account or the Owner-as-practitioner (checked at pre-flight — the one live match was a real customer's own booking, correctly left untouched), so live E2E for this plan needs Owner-created fixtures via the admin UI. Checklist in §4 below.

---

## 0 — Pre-flight (2026-07-29)

Run read-only against HEAD `9ce16e0`.

- Branch `master`; `git merge-base --is-ancestor 7fe8b4f HEAD` → OK.
- Path-scoped tree clean: `git status --porcelain -- src/app/admin/dashboard/ "src/app/admin/bookings/[bookingId]/"` → empty.
- Code-surface anchors re-verified fresh (all matched the plan's citations exactly, no drift): `BookingDetailSidebar.tsx:142` (`tel:` pattern), `:239` (maps URL), `TherapistDashboard.tsx:89/119/130/1361` (helpers + existing re-export).
- DB: `staff_profiles.can_take_bookings` already `true` on **both** `rahmatherapy@outlook.com` (real Owner) and `test.admin@rahmatherapy.example.test` — the plan's own capability-flip HARD-STOP is moot, nothing needed changing.
- Test fixture inventory: the only production booking currently assigned to any `*.example.test`/Owner staff account is a real customer's own booking (Mamdouh, `mamdouh9001@gmail.com`) — **not a safe test fixture**, correctly left untouched throughout. No safe practitioner-assigned test booking exists for live E2E; noted as an Owner-action gap, not fabricated via SQL INSERT (heavier Zone-2 action than this plan's scope warrants).

**Baseline identity (inherited from C-01, supersedes the plan's stale "485/491" text):** tsc **0** · lint **59 errors / 7 warnings**, same six files · vitest **5 failed** (`admin-access.test.ts` ×2, `ManualBookingForm.test.tsx` ×3) among 792 total at plan start, growing only via new passing specs through each phase.

---

## 1 — Phase ledger

| Phase | Commit(s) | What | Verify result |
|---|---|---|---|
| A | `5127f62` | New `shared-helpers.ts` — lifts `getGreeting`/`getFirstName`/`formatHours`/`buildAddressLines`/`buildMapsHref`/`FORMATTERS` verbatim from `TherapistDashboard.tsx` + new `isViewerAssignedPractitioner` predicate (deliberately inclusive of `completed`/`no_show` assignment statuses — plan overrides brief §9.2's "exclude completed"). `TherapistDashboard.tsx` re-exports for backward compat. | PASS — 7-case predicate matrix + verbatim-lift diff confirmed |
| B | `29ab66e` | Booking-detail dual-view: `viewerIsPractitioner` derivation + order-class reorder on the parent grid (main-content div extended, sidebar wrapped in a new div — `BookingDetailSidebar`'s own interface untouched) | PASS — CSS logic traced correct in both directions, desktop identical regardless |
| C | `a2c19f5` | New `PractitionerTodaySection.tsx` + `RelativeTimeDisplay.tsx` — real hero/list/empty-state JSX lifted from `TherapistDashboard.tsx` (not the plan's broken pseudocode, which assumed a `clients`/`participants` relation `ReportBooking` doesn't have); `buildServiceLookup`/`ServiceMeta`/`formatHeroTime` added to `shared-helpers.ts`; genuinely new Mark-complete button (no prior lift target existed) wired via 2 new optional props | PASS — JSX-lift fidelity confirmed byte-for-byte where it should carry over |
| D | `bd58145` + fix `6314718` | Mount in dashboard variants: `TherapistDashboard.tsx` refactored to consume `PractitionerTodaySection`; one shared Business+Coordinator mount point (they share one render path, not two); `getScopedBookingIds` exported from `bookings/page.tsx` for gender-matched `claimableCount` (brief §9.4's named mechanism) | **FAIL → FIXED → PASS** (see §2) |

**Closeout gate (2026-07-29):** independent whole-plan diff review (`9ce16e0..6314718`) — PASS, zero blocking findings. The one file touched outside the plan's original list (`bookings/page.tsx`'s `export` keyword) confirmed justified — brief §9.4 explicitly names this exact mechanism. All 12 plan steps + the fix round confirmed present. All 11 of brief §10's acceptance criteria confirmed MET (2 and 11 — mobile reorder, Playwright sweep — met by code-trace/deferred-to-Owner respectively, honestly noted, not silently skipped).

---

## 2 — The one fix round: Phase D's dual-claimable-UI bug

Independent Phase D verification found a real, reachable bug. `TherapistDashboard.tsx` was refactored to mount `<PractitionerTodaySection>` but the mount **omitted `claimableCount` entirely** (silently defaulting to `0`), specifically to avoid duplicating the file's own separate, richer `ClaimableStrip` (real per-card claim buttons). But `PractitionerTodaySection`'s empty-state branch (`if (!hasAnyAppt && claimableCount === 0) return <EmptyDayCard/>`) then had no way to know real claimable work existed: **a Therapist with no today/next appointment but real claimable work saw "Nothing scheduled today. Quiet day. Take care of yourself." rendered directly next to their own real, clickable claimable-work strip** — a genuine, contradictory UX regression versus the pre-refactor `HeroEmptyState({ hasClaimable })`, which correctly suppressed that copy whenever claimable work existed. Confirmed reachable (this is exactly `claimablePromoted`'s trigger condition, an ordinary business state) and confirmed a real regression (not a pre-existing gap) by diffing the removed code.

**Fixed in `6314718`:** added `showClaimableStrip?: boolean` (default `true`) to `PractitionerTodaySectionProps`, gating ONLY the component's own internal simple claimable-strip render — the `EmptyDayCard`/`hasAnyAppt` branching logic was left completely untouched (it was already correct once given a real count). `TherapistDashboard.tsx` now passes the real `claimable.length` + `showClaimableStrip={false}`: the empty-state correctly recognizes claimable work exists and skips the misleading copy, while the internal strip stays suppressed since the file's own richer strip already covers it. Net result in the "no appointments, claimable exists" state: `PractitionerTodaySection` renders nothing extra, leaving the file's own real strip as the sole claimable UI — no contradiction, no duplication.

**Specifically investigated and ruled out at closeout:** whether the SAME bug class could exist on the Business/Coordinator mount (`dashboard/page.tsx`), since that mount also uses `PractitionerTodaySection`. Traced structurally: that mount has passed the real `myClaimableCount` since its original Phase D commit (never hardcoded to 0), and its outer render condition (`can_take_bookings && (today>0 || next || claimableCount>0)`) is a logical superset of the component's own empty-state trigger — so `EmptyDayCard` is structurally unreachable there whenever the section is mounted at all. No analogous bug exists on that path.

---

## 3 — Documented trade-offs (Owner-visible, not silent)

The `TherapistDashboard.tsx` refactor (Phase D) is **not fully behavior-preserving** for the Therapist variant — this was a genuine trade-off, not an oversight, documented in a code comment at the mount site and confirmed by the closeout reviewer as clearly logged, not hidden:

- **Lost:** the dynamic hero eyebrow ("Tomorrow's first visit" / "First visit back" — computed from day-of-week + last-visit context) is now a static "Next visit" label. `PractitionerTodaySection`'s interface has no prop for this framing.
- **Lost:** the "Then [next visit after this one]" preview line under the hero card.
- **Gained:** the Mark-complete inline button on the hero (genuinely new — the pre-C-FIELDWORK hero had no completion affordance at all).

The implementer considered rendering the eyebrow/then-preview as sibling elements around the shared component but rejected it — those elements are positioned *inside* the component's own card (top badge, bottom border), so external siblings would look visually broken/duplicated rather than preserved. Judged consuming the shared component as designed, with the loss documented, as the better trade-off. **Flag for whoever next touches `PractitionerTodaySection.tsx`** (C-11, which is documented to consume this component during its dashboard-variant extraction): if this framing is wanted back, it needs new optional props (`eyebrow?: string`, `thenVisit?: {...}`), not a workaround.

## 4 — §3.2 / §3.4 Owner-performed checklist (handed over, not run by any agent)

No safe test fixture currently exists for a full live-authenticated sweep (see §0). Recommended path: create a fresh test booking assigned to `test.therapist@rahmatherapy.example.test` (or flip a Phase10/Audit Test client's booking to that staff member) via the admin UI, then:

1. **Booking detail dual-view.** Sign in as the assigned Therapist → navigate to that booking → verify sidebar (phone/address/maps) appears ABOVE the main panels at 375px. Sign in as Owner/Admin/Coord NOT assigned to that booking → verify main panels appear first (admin-curator view, unchanged). At 1280px, verify both views are identical (sidebar in column 2).
2. **PractitionerTodaySection on dashboards.** Sign in as the Therapist → verify the section renders on `/admin/dashboard` with hero (time/service/client/phone/address/maps/Mark-complete) + today list if applicable. Sign in as Owner (`can_take_bookings=true` already) → if Owner has an active assignment, verify the section mounts in the Business variant too, positioned near "Recent Activity". Sign in as Coordinator (`can_take_bookings=false` by default) → verify section does NOT render.
3. **Mark-complete temporal guard.** On a test booking whose start time is in the future, verify the button reads "Mark complete" but is disabled. Back-date via SQL to the past (Zone-2, ask first) or wait for the real time to pass, verify it becomes clickable and fires the real completion action.
4. **The exact bug this plan's fix round closed.** As the Therapist test account, ensure NO today/next assignment but SOME claimable work exists (unassign a gender-matched booking via SQL if needed). Verify the dashboard shows the real claimable strip and does NOT ALSO show "Nothing scheduled — Quiet day".
5. Screenshots per plan §3.4, stored in `redesign/evidence/C-FIELDWORK-EXPERIENCE/`.

**Safe fixtures:** `test.therapist@rahmatherapy.example.test`, `test.therapist.fresh@rahmatherapy.example.test`, any `Phase10*`/`Audit Test*` client. **Never** touch Mamdouh's real booking or Badar's `9d55ce2a`.

## 5 — Log-only (noticed, not this plan's to fix)

- Brief §4.2's second mockup shows a combined "empty day + claimable available" single card. No mount achieves this exactly — when only claimable work exists, the strip renders alone with no "nothing scheduled" framing alongside it. Not a contradiction (confirmed at closeout), just a mockup-fidelity gap versus a literal reading of the brief. Not fixed — the plan's own locked Step 7 pseudocode is what actually shipped, and it's the plan, not the brief, that's authoritative per this programme's established precedence rule.
- `scripts/measure-admin-bundles.mjs`'s route coverage gap (doesn't measure `/admin/bookings/[bookingId]` or the specific dashboard bundle delta) — same pre-existing tooling gap already logged against C-04a's and C-05's closeouts, not new, not fixed here.

## 6 — Baseline identity AFTER (final, independently re-run at HEAD `6314718`)

`npx tsc --noEmit` → 0 errors. `pnpm lint` → 59E/7W, same six files. `pnpm vitest run` → 5 failed / 826 passed, the five inherited names unchanged (admin-access ×2, ManualBookingForm ×3). `pnpm build` → clean. **This is the baseline plan #8 (C-11) inherits.**

---

*C-FIELDWORK shipped. Next in §4 order: C-11 (dashboard variants design system) — its own pre-flight hard-stops until this plan's `PractitionerTodaySection.tsx` + `shared-helpers.ts` exist, which they now do.*
