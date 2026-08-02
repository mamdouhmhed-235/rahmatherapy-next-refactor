# C-13 — Group bookings + gender clarity — PROGRESS

**Plan:** `redesign/plans/C-phase/C-13-group-bookings-and-gender-clarity-plan.md`
**Brief:** `redesign/briefs/C-13-group-bookings-and-gender-clarity-brief.md`
**Programme:** Band C, C-C implementation — plan **#11 of 22** (§4 order).
**Predecessor closed at:** `0bb356d` (C-15 shipped)
**Model routing:** `sonnet` — §5 routes C-13 to Sonnet. Opus only via the §5 twice-failed-phase escalation.

> ## 🟡 STATUS: Phase A shipped. **Phase G (email templates) is BLOCKED on an Owner decision — see §0.3.**

---

## 0 — Pre-flight (2026-08-01, HEAD `0bb356d`) — **GO-WITH-CAVEATS**

| # | Check | Result |
|---|---|---|
| 1 | Branch + path-scoped tree | **PASS** — `master`; ancestor of `ea97932`; path-scoped status empty across `bookings/`, `dashboard/`, `calendar/`, `lib/email/` |
| 2 | Dev server | **PASS** — was down at first check (connection refused); Owner restarted it, `/admin/login/` → 200 |
| 3/4 | Baselines | **PASS** — inherited from C-15 by identity (§0.4) |
| 5 | Dependency plans | **PASS** — C-04a, C-05, C-08, C-11, C-15, C-16, C-FIELDWORK all shipped. `_helpers.ts` exists with the exact shape the plan assumes |
| 6 | Codebase greps | **PASS** — all four anchors resolve, though every line number has drifted (§0.1) |
| 7 | Schema | **PASS** — 4/4 expected `booking_participants` columns present |
| 8 | Fixtures | ⛔ **FAIL — see §0.2.** Zero group bookings exist anywhere |
| — | Migration/permission/action claim | **PASS, verified** — DDL-keyword scan of the full plan text returns zero hits beyond the plan's own "no migration" statements. C-13 is genuinely pure render-layer work |
| — | ⛔/⏸ markers | **1 ⛔** (pre-flight fixture creation, plan line 70) · **0 ⏸** |

### 0.1 — Every line number in the plan and brief is stale

Ten plans shipped between plan-writing (2026-05-26 / refined 2026-07-26) and now. Re-locate by symbol, always.

| Symbol | Plan says | Actually at |
|---|---|---|
| `requiresGenderMatch` derivation | `page.tsx:837-843` | **`:820-822`** (derive) / **`:886-893`** (render) |
| `clientName` derivation | `page.tsx:763-764` | **`:809-810`** |
| `isGroup`/`participantCount` | `page.tsx:774-781` | **`:823-827`** |
| booking card `<article>` | `page.tsx:804-927` | **`:850-981`** |
| `ParticipantRow` | `[bookingId]/page.tsx:629-674` | **`:800-885`** |
| `sameGenderRequired` (participant) | `:639-640` | **`:814-815`** |
| `SnapshotListRow` derivation | `dashboard-cards.tsx:583-590` | **`:594-604`** |
| dashboard `requiredGender` derivation | plan: `dashboard-data.ts`; correction C13-02: `dashboard/page.tsx:812-822` | **neither — now `CoordinatorDashboard.tsx:259-266`.** C-11 Phase C split `page.tsx`; `grep requiredGender dashboard/page.tsx` → **0 hits**. Third location for one anchor; the plan's own correction is itself stale |
| `templates-data.ts` | plan assumes `src/lib/email/` | **`src/app/admin/emails/components/`** — never existed at the assumed path |

**Two structural facts the plan gets wrong, both in our favour:** the brief describes "~120 lines of JSX inside `BookingsListSection`", but it is **already a named component, `BookingListCard` (`page.tsx:786-982`)** — extraction is easier than assumed. And its call site (`:617`) passes only `booking profile canViewAll today animationDelay`; `role`, `ownBooking`, `claimableAssignment`, `showSensitiveDetails` are derived *inside* the card, so the plan's `BookingCardProps` shape is aspirational, not descriptive.

**A path in the plan that will not compile:** `AdminStatusBadge` is cited at `@/app/admin/components/admin-status-badge`. **That path has never existed** (zero git-history hits). The real export is in `src/app/admin/components/admin-ui.tsx`.

### 0.2 — ⛔ HARD-STOP raised in chat: no group booking exists anywhere

Live SELECT-only queries confirm **zero bookings with more than one participant exist in the entire production database** — not in the `Phase10*`/`Audit Test*` test set, not in real data. No same-gender group, no mixed-gender group, no fully-assigned group, no unassigned group.

C-13 is *entirely* about group-booking rendering, so **every visual/functional check of its headline feature needs fixtures that do not exist**, and only the Owner can create them (via `/admin/bookings/new` — no agent may authenticate). The plan's single ⛔ HARD-STOP is therefore not a contingency branch; it is the only path to any group fixture existing at all.

**✅ RESOLVED 2026-08-01 — Owner: "if we are in its plan implementation, then go ahead and implement it."** C-13 *is* the plan that needs these fixtures; no other plan creates them. But the creation step remains **Owner-performed by necessity, not by choice**: doing it properly means going through `/admin/bookings/new` so the real RPC writes participants, assignments and snapshots consistently, and no agent may authenticate. Raw-SQL inserts were considered and rejected — they would be a Zone-2 write that bypasses the RPC and risks inconsistent rows.

**Therefore: implementation proceeds in full, verified by unit specs against synthetic multi-participant data; the group-rendering browser checks are handed to the Owner as a checklist** (§3), exactly as C-06, C-04a, C-05, C-FIELDWORK and C-11 did. The answer changed *when* the browser checks happen, not what code is written.

### 0.3 — ⏸ Plan-vs-reality contradiction blocking Phase G

The brief wants group context added to three email templates, one of them a **staff-facing claim notification** that "helps assigned practitioners track when colleagues join".

**No such email exists.** The real template is `claim` (`renderClaimNotificationEmail`), registered `audience: "admin_internal"`, trigger *"sent to the admin recipient when a practitioner claims an unassigned slot"*. It has no `PARTICIPANT_DETAILS_FIXED_PART` and no `renderParticipants()` call. The recipient the brief describes does not exist for this template.

**✅ RESOLVED 2026-08-01 — Owner chose option (a): extend the admin-internal `claim` email.** Rationale, recorded so a later reader does not re-open it: what the plan *intends* is that whoever receives a claim notification can see the booking is a group and how much of it is now covered. That intent holds for the actual recipient; only the brief's description of *who* receives it is wrong. And the practitioner-facing need the brief describes is already met by target #1 — `staff_assignment` goes to the practitioner and already renders per-participant detail. Dropping the target would have lost real value on the one claim email that exists, over a recipient error rather than a design error. **Phase G proceeds against `claim` (`renderClaimNotificationEmail`, `audience: admin_internal`).**

Two related corrections the orchestrator has already ruled on, no Owner input needed:
- Plan Step 17's code names `renderBookingConfirmationEmail`, but the prose and brief §2.7 both mean **`renderBookingConfirmedClientEmail`** — a different template. Prose wins; following Step 17 literally would patch the wrong email.
- `staff_assignment` **already** renders a full per-participant block via `renderParticipants()`, including assignment state. Step 16's new block must **extend** that, not add a second participant list to the same email.

### 0.4 — Inherited baseline (identity, not counts)

From C-15's closeout at `8851e8c`: **tsc 0 · lint 59E/7W in exactly six files · vitest 5 failed / 1107 passed (1112) · build clean.** Failures exactly: `admin-access.test.ts` ×2 ("gives Owner broad access while keeping owner-only role actions permission-gated", "gives Admin broad operational access without role template management") + `ManualBookingForm.test.tsx` ×3 ("renders step 1 on first load", "moves focus to the first invalid field when continuing with errors", "shows the consent error when trying to create booking without consent").

⚠️ C-15 left a **render-parity spec** (`src/lib/email/__tests__/registry-defaults.test.ts`) freezing every email template's zero-override output byte-for-byte. C-13's Phase G will touch that surface. Its fixture must **never** be edited to make a test pass.

---

## 1 — Phase ledger

| Phase | Commit | What | Verify |
|---|---|---|---|
| A | `af273e8` | Gender-clarity chip helper — `composeGenderRequirementChip` in `_helpers.ts`, wired into the bookings list row, `ParticipantRow`, and the dashboard snapshot row. 10 new specs. | **PASS**, 1 non-blocking (§1.2) |
| B | `4218bd5` | `BookingCard.tsx` extracted from `page.tsx` + nested `GroupBookingCard` variant. 14 specs. | **PASS** (§1.3) |
| C | `b418aa0` | `composeBookingIdentity` helper — composite identity on the group card headline and the detail page's header description. 10 specs. | **PASS** (§1.4) |
| D | `a516bd1` | Verification-only — Phase B already shipped the fraction badge; added the missing tone assertions. **No production code changed.** | **PASS** (§1.4) |
| E | `dbe0208` | Calendar group surface — Users icon + composite identity + `Group · N` across 3 tile sites; one bounded local participants query. | **PASS** (§1.5) |
| F | `2fdcadc` + fix `c64e6ad` | Booking-detail refinement; both group badges resolved; new `generateMetadata`. | **FAIL → fixed → re-verified PASS** (§1.6) |
| G, H | — | not started — G unblocked 2026-08-01, target settled (§0.3) | — |

### 1.1 — Phase A notes

Replaces the generic `"Same-gender required"` chip with per-participant phrasing: single → `"Needs female therapist"`; same-gender group → `"Needs 2 female therapists"` (pluralised); mixed group → `"Needs 2 female + 1 male"`; `fully_assigned` → hidden. Pure function, no DB or React dependency, unit-tested with **synthetic** multi-participant arrays since no group fixture exists.

**One necessary adaptation, not a scope change:** the plan's `dashboard-cards.tsx` snippet drops `sameGenderRequired` entirely, but that boolean is also consumed downstream by `AssignmentChip`'s `sameGenderRequired` prop (which drives its tooltip) — a component outside Phase A's file scope. It was kept as `Boolean(requiredGender)` alongside the new string, leaving `AssignmentChip` unchanged.

**Logged, not fixed — a data-model fact the plan does not know:** `booking_participants.required_therapist_gender` and `booking_assignments.required_therapist_gender` are both **NOT NULL** enums (`staff_gender_type`, values `male`/`female` only — no null or "any" sentinel), and all 15 current participant rows have `required_therapist_gender = participant_gender`. So the helper's "no requirement → hide" branch is **unreachable at runtime under today's schema**. The pre-C-13 `Boolean(...)` derivation had the same property, so this is a pre-existing characteristic rather than a Phase A defect — but it means the chip is always shown, and any plan text implying an "any therapist" state is describing something the schema cannot currently express. Changing that would need a migration and is out of C-13's scope.

---

### 1.2 — Phase A verify: PASS

Independent verifier confirmed all five touched files are on the §2 list; `src/lib/email/**`, `reporting.ts` and `dashboard-helpers.ts` genuinely untouched (empty diff). Helper is byte-for-byte the plan's snippet, pure, no React or DB dependency, correctly colocated with `_helpers.ts`'s other predicates. The 10 specs assert real output against hand-built participant arrays — not mocks echoed back. Gate: tsc 0 · vitest **5 failed / 1117 passed (1122)**, the five inherited by identity · lint 59E/7W same six files · build clean · email render-parity spec 13/13 green with its fixture untouched. Zero new `eslint-disable`, zero hex, zero raw Tailwind palette colours — the chip styling uses `var(--admin-restricted-*)` tokens.

**The verifier independently confirmed the schema finding** via its own introspection: `required_therapist_gender` is `is_nullable: NO`, enum `staff_gender_type` with exactly two labels, and `types.ts:32,52` types it as the non-nullable union `"male" | "female"`. Its ruling on the unreachable hide-branch: **acceptable defensive code, not dead code to log** — the `string | null` parameter type is lifted verbatim from brief §2.1's own signature, it is directly exercised by 2 of the 10 specs, and it guards a generic reusable helper against looser future callers. Accepted.

**Finding (non-blocking) — `AssignmentChip`'s tooltip is now stale.** `dashboard-cards.tsx:709` still reads the generic *"Needs a same-gender therapist"* while the visible label built two lines above in the same call site now reads the specific gender (*"Unassigned · Needs female therapist"*). Keeping `sameGenderRequired` was the right call — `AssignmentChip` has a fixed boolean prop contract and sits outside Phase A's render-site list, so dropping it would not have compiled — but the label and its own tooltip now disagree. One-line follow-up (`title={requiredGender ? \`Needs a ${requiredGender} therapist\` : …}`); logged rather than fixed because the component is out of Phase A scope.

---

### 1.3 — Phase B: card extraction + nested group layout (`4218bd5`)

Verified **PASS**. `BookingListCard` — already a named component at `page.tsx:786-982`, contrary to the brief's "~120 lines of inline JSX" — moved wholesale into `src/app/admin/bookings/BookingCard.tsx`, keeping the real call-site prop shape (`booking, profile, canViewAll, today, animationDelay`) rather than the plan's aspirational `BookingCardProps` sketch. Group branch adds a Users-icon headline, an `--admin-panel-muted` tint, a "N of M therapists assigned" fraction badge (warning until fully crewed, then success — Q9.1), and an inner `<ul>` of participant sub-rows ordered **main-contact-first** via a stable sort on `is_main_contact`.

**The single-booking render is byte-identical, proved by diff rather than by assertion.** The verifier compared the pre-extraction return block against the new one line by line: the only difference is the removed `Group · N` chip.

**That chip removal was challenged and cleared.** Removing it looked risky because brief §5.7 documents a `group_booking = true`-with-one-participant anomaly that could have made it live. The verifier read the pre-commit source: `isGroup` was **always** `participantCount > 1` and never consulted the flag — with an in-code comment saying exactly why. So the chip was genuinely unreachable in the single branch. Production confirms **0 of 15** bookings carry the flag. Group-ness is now signalled structurally (icon + sub-rows + fraction badge) rather than by a duplicate chip, which the plan's own risk table prefers.

`profile` was retyped from the inline `NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>` to `StaffProfile` — verified the identical type, erased at compile time.

### 1.4 — Phases C + D: composite identity, and an honest no-op (`b418aa0`, `a516bd1`)

Verified **PASS**. `composeBookingIdentity` returns `{ primary, participantCount }`: 1 → `"Aisha Khan"` · 2 → `"+ 1 other"` · 3 → `"+ 2 others"` · 5 → `"+ 4 others"`. A flagged main contact with a blank `display_name` falls back to `contact_full_name`. Applied **only on the group path** in both the card and the detail page — single bookings keep today's `clientName` lookup order byte-for-byte (brief §1.3).

**Inherited anomaly, logged not fixed:** with **no** participant flagged `is_main_contact`, `otherCount` counts *every* participant, so a 3-participant booking would read "+ 3 others" — four people implied for three. The formula is specified verbatim in both plan (line 483) and brief (line 225), and brief Q9.9 pre-authorises documenting rather than fixing this class of anomaly. Currently unreachable: all 15 live participant rows have `is_main_contact = true`. Carried here so it survives beyond the code comment.

**Phase D changed no production code, and that is the correct outcome.** The plan's own Phase D text says "no standalone phase — verified in Phase B", and the verifier confirmed Phase B's fraction badge already matches brief §2.4 byte-for-byte. Rather than manufacture duplicate UI to make a step look done, the implementer closed the one real gap: Phase B pinned the badge's *text* but never its *tone*, so a warning/success mapping regression would have passed silently. Two tests now assert the actual token classes.

**Browser title correctly deferred** — plan Step 13 sits under Phase F, no `generateMetadata` exists yet, and the visible title is still `shortRef(booking.id)`.

---

### 1.5 — Phase E: calendar (`dbe0208`)

Verified **PASS**. Users icon + composite-identity headline + `Group · N` pill on the main day/week/range row; icon-only prefix on the month-grid pill (too narrow for a label) with full identity in the tooltip; composite name + count pill on the Unassigned/Claimable sidebar rows. Single bookings unchanged at all three sites; tile backgrounds untouched (Q9.4).

**The plan's Step 12 said "extend the query". There was no query to extend** — `calendar/page.tsx`'s only booking source is `getReportData()` from `reporting.ts`, which is a RECON §5 untouchable *and* on C-13's own do-not-touch list, and whose types carry no `booking_participants` join. Following Step 12 literally would have been a rule-7 violation. Instead: **one bounded local SELECT** in `calendar/page.tsx` over `booking_participants`, `.in("booking_id", calendarBookingIds)` where those ids come straight from the already role-scoped `getReportData` output — so it can only ever touch bookings the viewer already sees. Guarded to skip entirely on an empty id list, selecting exactly the four fields `composeBookingIdentity` needs. Not N+1. `reporting.ts` confirmed byte-untouched.

### 1.6 — Phase F: booking detail — FAILED verification on a real PII leak, then fixed (`2fdcadc` + `c64e6ad`)

**Both group badges resolved, not just the one the plan knew about.** The plan's Step 14 removes the header badge; a second lived unmentioned in the Participants-panel header, and **both were gated on the unreliable `group_booking` flag**. The header badge was removed (composite identity already signals group-ness there via Phase C); the panel badge was **kept but re-gated to `participantCount > 1`**. Net result: zero flag-gated group indicators remain on the page, and the codebase-wide `isGroup` invariant now holds uniformly.

**⚠️ The verifier caught a genuine PII exposure — this is the most important thing in C-13 so far.**

Phase F added a new `generateMetadata` export (there was none; the plan's Step 13 assumed one existed to patch). It replicated the page's first two gates and `getScopedBookingRelation`, gating on `canOpen` — **but never checked `scopedRelation.claimableOnly`**, which is the page's entire redaction mechanism. When `claimableOnly` is true the page body deliberately selects a reduced column set, runs `normalizeClaimableBooking` to overwrite `contact_full_name` with `"Claimable booking"`, and hides `ClientCard`/`AddressCard`/`SafetyAndConsent`/`CustomerRequests`.

`generateMetadata` skipped all of it and ran the **full** identity select, putting the real customer's name into `<title>` — server-rendered into the initial HTML.

**No edge case required.** An active Therapist with `MANAGE_BOOKINGS_ASSIGNED` + `CLAIM_ASSIGNMENTS`, not assigned to the booking, opens a claimable slot — including through the "Claimable today" / "Unassigned" Calendar links **Phase E had just added** — and sees "Claimable booking" in the body while the browser tab shows the real client's name.

**Fixed in `c64e6ad` as deny-before-fetch**, not fetch-then-discard: `claimableOnly` now short-circuits to the neutral title *before* the identity SELECT is issued, so the PII never enters the process. Re-verified: the re-verifier traced all four `getScopedBookingRelation` branches and confirmed no path remains where `canOpen && claimableOnly` reaches a name, and confirmed `normalizeClaimableBooking`, both column sets, `getScopedBookingRelation` and the page body's card-hiding are **byte-identical** — nothing was weakened to make it pass.

**The spec that would have caught it now exists** and is a real guard, not a title check: it counts `bookings` select calls and asserts **zero** for a claimable-only viewer, so removing the fix fails it. Seven specs total; only `getStaffProfile` is mocked, with the RBAC helpers running for real.

**Logged, non-blocking:** `generateMetadata` doesn't call `canOpenBookingRecord`, which the page body applies after its fetch. Provably safe today (every role with `view_bookings_all` also has `manage_bookings_all`, and the claimable path now denies outright), but it is an architectural asymmetry — if the two gates ever diverge, metadata is the one that won't notice.

**The zero-new-specs judgement that produced this catch is worth keeping:** the verifier accepted the calendar's untested aggregation as low-risk but refused to accept an untested 40-line authorisation branch, and it was exactly right.

---

## 2 — ⛔ Programme-level blocker raised during C-13 (not C-13's own defect)

Drift checkpoint #2 (protocol §2.6, run after plan #10) returned **FAIL** with a customer-facing product bug that no remaining plan owns — see `redesign/plans/C-phase/DRIFT-CHECKPOINTS.md` F-2. In short: `ensureBookingManageUrl` overwrites the single `manage_token_hash` on every call, and C-08 Phase A took the manage-URL send sites from **1 to 3**, so every already-delivered "Manage this booking" link dies as soon as a newer email goes out. Independently re-counted and confirmed by the orchestrator.

The fix touches `manage-token.ts` and `notifications.ts` — outside C-13's files-touched list, so protocol rule 6b makes it a blocking chat ask rather than something to fold in. **Raised with the Owner 2026-08-01, awaiting direction.** C-13's own phases are unaffected and continue.

---

---

## 3 — ▶ RESUME HERE (interrupt checkpoint, protocol §3)

**Plan:** C-13, plan **#11 of 22**. **Phases A ✅ B ✅ C ✅ D ✅ E ✅ F ✅ (all independently verified) · Phase G NOT STARTED · Phase H NOT STARTED · closeout not run.**

**Last-good commit:** `c64e6ad` (`fix(redesign): C-13 Phase F — generateMetadata must honour claimableOnly redaction`). Nothing mid-flight; every phase is committed and verified. Working tree clean except the standing deliberate `src/lib/maintenance.ts`.

**Inherited baseline — measured at `c64e6ad`, use THIS not the plan's text:**
- `npx tsc --noEmit` → **0 errors**
- `pnpm lint` → **59 errors / 7 warnings**, in exactly six files: `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`
- `pnpm vitest run` → **5 failed / 1155 passed (1160)**, failures EXACTLY: `admin-access.test.ts` ×2 ("gives Owner broad access while keeping owner-only role actions permission-gated", "gives Admin broad operational access without role template management") + `ManualBookingForm.test.tsx` ×3 ("renders step 1 on first load", "moves focus to the first invalid field when continuing with errors", "shows the consent error when trying to create booking without consent")
- `pnpm build` → clean

**Exact next action: C-13 Phase G**, model `sonnet`. Target settled by the Owner (§0.3): extend the **admin-internal `claim`** template (`renderClaimNotificationEmail`), plus `staff_assignment` and `booking_confirmed_client`.

**Five things Phase G MUST carry:**
1. **The plan's Step 17 names the wrong renderer.** It says `renderBookingConfirmationEmail`; the prose and brief §2.7 mean **`renderBookingConfirmedClientEmail`** — a different template (`booking_confirmation` is the initial "request received" email). Following Step 17 literally patches the wrong email.
2. **`staff_assignment` already renders a full per-participant block** via `renderParticipants()`, including assignment state, and already carries `PARTICIPANT_DETAILS_FIXED_PART`. Step 16's block must **extend** that, not add a second participant list to the same email. The genuinely missing piece there is the "X of Y assigned" summary sentence.
3. **The render-parity gate is absolute.** `src/lib/email/__tests__/registry-defaults.test.ts` freezes every template's zero-override output byte-for-byte, and its fixture has exactly one commit in its history — **never edit it**. A group block gated on `participantCount > 1` returns `""` for all parity fixtures (verified: `BASE_INPUT` has exactly 1 participant), so the gate stays green if the guard is respected. If it goes red, STOP.
4. Register the new block as a **`FixedPart`** legend entry, not an editable `SafeField` — `PARTICIPANT_DETAILS_FIXED_PART` is the existing precedent.
5. **`SafeFieldKind` is no longer a closed union** — C-15 Phase A widened it to `string`. The plan's coordination note saying otherwise is stale.

**Then Phase H** (integration polish + dashboard data layer, §5.11). Note its dashboard anchor is at **`CoordinatorDashboard.tsx:259-266`**, not `dashboard/page.tsx` — C-11 Phase C split that file *after* the plan's own C13-02 correction was written, making this the third recorded location for one anchor. `grep requiredGender dashboard/page.tsx` → 0 hits.

**Then C-13 closeout:** §3 gate, adversarial whole-plan review over `0bb356d..HEAD`, progress + checklist, and append the Owner group-fixture checklist to `OWNER-ACTION-BACKLOG.md`.

**Standing constraint for every remaining C-13 dispatch:** no group booking exists anywhere in the database (0 of 15 have >1 participant or the flag), so all group paths are fixture-free — unit tests use synthetic data, and creating a fixture is Owner-only.

---

*C-13 in progress — Phases A–F shipped and verified, Phase F via one fix round. Pre-flight `0bb356d`; A `af273e8`; B `4218bd5`; C `b418aa0`; D `a516bd1`; E `dbe0208`; F `2fdcadc` + `c64e6ad`. **Resume at Phase G — see §3.***
