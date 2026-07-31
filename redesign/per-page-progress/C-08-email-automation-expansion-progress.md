# C-08 — Email automation expansion — PROGRESS

**Plan:** `redesign/plans/C-phase/C-08-email-automation-expansion-plan.md`
**Brief:** `redesign/briefs/C-08-email-automation-expansion-brief.md`
**Programme:** Band C, C-C implementation — plan **#9 of 22** (§4 order).
**Predecessor closed at:** `f3a0434` (C-11 shipped)
**Model routing:** `sonnet` — §5 routes C-08 to Sonnet, and pre-emptive upgrades are banned. Opus is reserved for the §5 escalation rule (a phase failing verify twice), which is pre-wired into the phase workflows.

> ## ⏳ STATUS: IN PROGRESS — Phase A running.

---

## 0 — Pre-flight (2026-07-31, HEAD `f3a0434`) — **GO-WITH-CAVEATS**

| # | Check | Result |
|---|---|---|
| 1 | Branch + path-scoped tree | **PASS** — `master`; ancestor check exit 0; path-scoped status empty |
| 2 | Dev server | **PASS** — 200 |
| 3+4 | Baselines | **PASS** — identity match. tsc 0; lint 59E/7W; vitest **5 failed / 881 passed (886)**. The plan's own "485/491" text is a stale snapshot, superseded per protocol §0 precedence. |
| 5 | `email_delivery_events` | **PASS** — only a `delivery_status` CHECK, `event_type` unconstrained; `metadata` + `resent_from_event_id` **both ABSENT** (migration needed, as planned) |
| 6 | Template inventory | **CAVEAT** — **10** templates registered, not 9; `staff_assignment` at line **287**, not the plan's "~115". File-header comment saying "9" is pre-existing stale (C-01's `89f997b` added the 10th without updating it) — left alone per rule 6a |
| 7 | `getAdminRecipient` | **PASS** — `notifications.ts:228` |
| 8 | RBAC permissions | **CONTRADICTION** — see §0.1 |
| 9 | Fixtures | **CAVEAT** — 7 pending bookings ✅, 8 `@example.test` clients ✅, but **no booking has 2+ assignments** (max 1 across all 10 rows). The `staff_unassignment` test must construct its own fixture; it cannot assume one exists |
| 11 | Notification infra | **PASS** — `notification_email` + `business_notification_prefs` both absent (greenfield); **`email_delivery_events.booking_id` is already nullable**, so the plan's §0.11(b) fallback branch never applies; Owner role id `2d5295c3…`, Admin `9f746458…` |
| 12 | Enquiry hook point | **PASS** — `createEnquiry` at `enquiries/actions.ts:49`, inserts + one audit row + `updateTag`, no email send present. Clean hook point |

**Migration premises (SELECT-only):** all three target columns absent ✅. **`has_table_privilege('service_role', …, 'UPDATE')` → TRUE for BOTH `staff_profiles` and `email_delivery_events`** — the C-04a silent-42501 trap does **not** apply here (protocol §3b check performed before any write, as required). Owner seed targets **2 active Owner rows**: `phase10.owner@example.test` (fixture) and `rahmatherapy@outlook.com` (**the real Owner** — the one live production row in scope; schema seeding, not an email path, so not a DO-NOT-TOUCH violation, but noted).

**Shared-surface drift (rule 9), re-located by symbol:** `sendBookingCreatedEmails` 416 · `sendBookingCancellationEmails` **467** (C-04a's region) · `sendBookingRestoredClientEmail` 526 · `sendBookingCancellationEmail` 548 (singular legacy, distinct) · `sendBookingRescheduleRequestEmails` 557 · `sendStaffAssignmentEmail` **588** · `sendAssignedStaffBookingChangeEmails` 608 · `sendBookingReminderEmail` **637** · `sendReviewRequestEmail` **679** (C-01's). `bookings/page.tsx`'s `getScopedBookingIds` exported at 124. **`admin/emails/**` and `email-templates/**` confirmed untouched by C-11.**

### 0.1 — The plan's RBAC expectation is wrong, and the code already knows it

Plan §0.8 expects "Owner + Admin have both. Coord + Therapist don't." Production says:
- `manage_email_templates` → **Owner, Admin** ✅ as expected
- `resend_booking_emails` → **Owner, Admin, Booking Coordinator, Therapist** ❌ contradicts the plan

**This is settled prior design, not drift to reconcile.** `src/app/admin/emails/page.tsx:158-175` carries a dated "H11 middle path" design comment describing exactly this grant, plus implemented scoping (`canResend && !canSeeAllBookings`) that limits a Therapist's resend to their own assignments. Permission strings match exactly between `rbac.ts:35,37` and the DB — no spelling mismatch.

**Consequence for Phase C:** plan §3.3's verification step ("Coord / Therapist: hidden") is the error. **Phase C must preserve the existing scoped behaviour.** An implementer "correcting" reality to match the plan would break intentional work. Raised in chat; Owner may still choose to restrict, but the default is to follow the code.

---

## 1 — ⚠️ The headline finding: the template editor does not affect real emails

Surfaced by the Phase B audit (run read-only in parallel with Phase A) and **independently confirmed by the orchestrator** against baseline `f3a0434`.

**`resolveTemplateOverrides` is called exactly ONCE in `notifications.ts`** — line 720, inside C-01's `sendReviewRequestEmail` — out of **9 exported `send*` functions**. Inside `templates.ts` it is likewise called only once (line 609, `renderReviewRequestEmail`). Every other renderer (`:194`–`:404`) is **synchronous** and takes `overrides` as a parameter defaulting to `{}` — so a caller that passes nothing gets hardcoded defaults.

Meanwhile `sendTemplateManually` — the admin **"Send test"** path — **does** resolve overrides (`email-templates/actions.ts:303`).

**Net effect:** an admin edits a template → clicks Send test → **sees the edit applied** → reasonably concludes the feature works. Every genuine customer email then renders the original hardcoded copy. This affects 9 of the 10 registered templates, including `booking_confirmation`, `booking_cancellation_client` and `booking_reminder`.

**Not introduced by C-08**, and not in Phase A's path — the four new Phase A templates resolve overrides internally, following C-01's correct pattern. Without a fix, C-08 would end with 5 templates honouring admin edits and 9 ignoring them.

**✅ OWNER DECISION 2026-07-31: fix it in C-08 as an EXTENDED PHASE B.** Thread `resolveTemplateOverrides` through the 8 legacy send functions (~4 lines each), mirroring `sendReviewRequestEmail`. Alternatives declined: defer to C-15 (which owns the template studio), or log only. **This widens Phase B beyond its own "no code change beyond templates-data.ts field-list additions" text — recorded as an Owner-approved scope change.**

**Phase B's original audit result, for the record:** `staff_assignment`'s registration is **clean** on the axis the plan asked about — the renderer reads exactly `intro` + `footer_contact`, and the entry exposes exactly `STAFF_INTRO` + `FOOTER_CONTACT`, both `maxLength` 200 (inside D13's ≤500 CHECK). No invisible capability, no dead UI field. The defect is one layer removed: registration is right, the caller never wires it in.
**Step 6 verdict: capability-keyed, confirmed.** `sendStaffAssignmentEmail` takes the recipient as a parameter; both call sites resolve it from the assignment's own `assigned_staff_id` (`bookings/actions.ts:671` claim flow, `:1146-1160` assign/reassign flow) with no role filter — so any `can_take_bookings` staffer who holds the assignment gets the email, exactly as the plan expected.

### 1.1 — ⛔ Zone-2 action performed: stale test override deleted (Owner-approved 2026-07-31)

The wiring fix would have **armed** a dormant landmine rather than defusing one. `email_template_overrides` contained exactly one row:

| id | template | field | value | updated_by | updated_at |
|---|---|---|---|---|---|
| `2a15d56f-6da6-4beb-8cdf-e0e48dac8be7` | `booking_confirmation` | `greeting_intro` | `Hi big boy {client name}` | `01582c5d…` (Owner) | 2026-05-26 12:10:55 UTC |

A test edit left in place fifteen months ago. **The broken wiring is the only reason it has not been going out on every booking confirmation since** — and `booking_confirmation` is the highest-traffic template in the live histogram (8 sends). It would not even have interpolated: the placeholder is `{client name}` with a space, not the `{clientName}` the substituter expects, so customers would have received it literally.

Presented in chat with the exact SQL and the `UPDATE`-instead alternative; **Owner approved the DELETE**. Orchestrator executed it (protocol rule 2 — never a subagent):
```sql
DELETE FROM email_template_overrides
WHERE id = '2a15d56f-6da6-4beb-8cdf-e0e48dac8be7';
```
**Post-action verification: `SELECT COUNT(*) FROM email_template_overrides` → 0.** `booking_confirmation`'s greeting reverts to the hardcoded default — i.e. exactly what customers have actually been receiving all along, so live behaviour is unchanged. Sequencing was deliberate: the row is gone **before** the Phase B wiring goes live.

---

## 2 — Phase ledger

| Phase | Commit(s) | What | Verify result |
|---|---|---|---|
| A | `80a8bc2` · `547c018` · `9f200ba` · `e522bdd` | 4 new templates, one commit each: `booking_confirmed_client`, `staff_unassignment`, `claim`, `client_assigned_therapist`. Registry now holds **14** templates. | **PASS / PASS** — both batches first time, no fix round, no §5 escalation. See §2.1. |
| B (extended) | — | `staff_assignment` audit (done, §1) **+ Owner-approved override-wiring fix across the 8 legacy senders** | not started |
| C | — | Resend tooling — **must preserve the existing H11 scoped-resend behaviour for Coord/Therapist** (§0.1) | not started |
| D | — | Business-notification bundle — ⛔ Zone-2 migration at Step 13 | not started |

---

### 2.1 — Phase A notes

**The implementer rejected the plan's own sample code, correctly.** Plan §1 Sub-step 1's literal plain-text sample hardcodes `body_intro`/`body_cta_label`/`body_signoff` as string literals, ignoring `resolveTemplateOverrides` entirely — **the exact C-01 anti-pattern this plan was warned about**. It built shared `resolveBookingConfirmedClientFields()` / `resolveStaffUnassignmentFields()` resolvers instead (mirroring C-01's fix), so HTML and plain-text legs read one source of truth. Had it followed the plan literally, C-08 would have reproduced the defect four more times.

**`SafeFieldKind` was NOT extended** — the coordination note said to grep first, and C-01 had already added `body_intro`/`body_cta_label`/`body_signoff` for `review_request_client`. Reused as-is with template-specific `SafeField` consts, avoiding a second incompatible union.

**One real correctness catch:** `sendStaffUnassignmentEmail` passes `requireCustomerEmail: false`. `contact_email` has been nullable since C-06, so on a phone-only admin booking the plan's shape would have thrown and silently failed to notify the unassigned therapist — who has nothing to do with the customer's email.

**One pre-existing test repaired (required, not scope creep):** `quickUpdateBookingNoShow.test.ts` mocks `@/lib/email/notifications`; adding an export broke its mock. Its comment ("the client does not hear about it") became factually wrong as a direct result of the change, so both were corrected and an assertion added for the new `pending→confirmed` send.

**Deliberately left alone:** the new templates are not wired into `renderForTemplate()`'s manual-send switch — `review_request_client` isn't either, so this matches existing precedent rather than inventing a new gap. `templates-data.ts`'s header comment still says "9 templates" (now 14); pre-existing stale text, rule 6a.

**Baseline after Phase A: 5 failed / 888 passed (893)** — the same five inherited failures, +7 new specs.

### 2.2 — Sequencing decision: extended Phase B waits on the security review

Phase B threads `resolveTemplateOverrides` through the 8 legacy senders, which makes admin-editable text reach real customer emails **for the first time**. A security review of exactly those paths (template injection, escaping, CRLF-to-header, `href` schemes) is in flight. **Running Phase B before those findings land would ship the wiring and then audit the surface it exposed** — the wrong order. Phase B starts once the review returns, folding in any escaping fix so the two land together.

Verified state after Phase A: **5 of 13 senders resolve overrides** (`booking_confirmed_client` :683, `staff_unassignment` :727, `claim` :772, `client_assigned_therapist` :812, `review_request_client` :887). The 8 legacy senders are Phase B's target.

---

*C-08 in progress. Pre-flight `f3a0434`; Zone-2 override deletion performed 2026-07-31; Phase A shipped `80a8bc2`→`e522bdd`.*
