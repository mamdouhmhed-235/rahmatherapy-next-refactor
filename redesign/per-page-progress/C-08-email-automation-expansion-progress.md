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
| B (extended) | `e018d67` · `40a0202` | `staff_assignment` audit (done read-only, §1) **+ Owner-approved override wiring across the 8 legacy senders** + `body_cta_url` scheme guard + dead subject-helper-text fix. 8 new spec files, 37 new tests. | **PASS first time**, no fix round, no escalation. See §2.3. |
| — | `e91c09c` | **⛔ Zone-2 migration `c08_tighten_email_delivery_events_rls`** — security remediation from the Phase-B-gate review (§2.5) | applied + verified |
| C | — | Resend tooling — **must preserve the existing H11 scoped-resend behaviour for Coord/Therapist** (§0.1) **and MUST add the `booking_assignments` scope check the plan's sketch omits** (§2.5) | **NOT STARTED — resume here** |
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

### 2.3 — Phase B: the template editor now actually works

**`resolveTemplateOverrides` call sites in `notifications.ts`: 5 → 14.** Every sender now resolves. Baseline after: **5 failed / 923 passed**, same five inherited names.

**The catch that mattered most: `eventType` is NOT `template_id`.** The implementer refused to derive template ids from event-type strings and instead read `renderForTemplate`'s switch in `admin/email-templates/actions.ts` as ground truth — the same mapping the "Send test" path uses. That caught a real divergence: eventType `booking_cancellation_customer` maps to template_id **`booking_cancellation_client`**. Guessing from the event type would have resolved a non-existent id, silently applying `{}` forever and reproducing the very bug being fixed — while every test still passed.

**Sender → template_id → override keys** (verified per renderer, not assumed):

| Sender | template_id | keys read |
|---|---|---|
| `sendBookingCreatedEmails` (customer leg) | `booking_confirmation` | `greeting_intro`, `group_copy`, `footer_contact` |
| `sendBookingCreatedEmails` (admin leg) | `admin_booking_notification` | `footer_contact` |
| `sendBookingCancellationEmails` (customer) | `booking_cancellation_client` | `greeting_intro`, `footer_contact` |
| `sendBookingCancellationEmails` (admin) | `admin_booking_cancellation` | `footer_contact` |
| `sendBookingRestoredClientEmail` | `booking_restored_client` | `greeting_intro`, `footer_contact` — **⚠️ id NOT registered, see below** |
| `sendBookingRescheduleRequestEmails` | `admin_reschedule_request` | `footer_contact` |
| `sendStaffAssignmentEmail` | `staff_assignment` | `intro`, `footer_contact` |
| `sendAssignedStaffBookingChangeEmails` | `staff_booking_change` | `wrapper_change_summary`, `footer_contact` |
| `sendBookingReminderEmail` | `booking_reminder` | `intro`, `footer_contact` |

`sendBookingCancellationEmail` (singular) needed **no change** — it is a pure delegate to the plural and inherits the fix. Left untouched rather than given a no-op edit.

**C-04a's queued path resolved correctly.** Rendering happens **synchronously at queue time** (the HTML/text are built as part of the `sendTrackedEmail` argument regardless of `delaySeconds`); the cron only flips `delivery_status` on the *same* row and never re-renders. So overrides are resolved at queue time, matching render timing exactly. Proven by a test passing `delaySeconds: 5` and asserting the **queued row's `html_payload` already contains the override text** — if resolution had been placed on the drain side it would have been a silent no-op.

**Byte-identical property used as designed:** with `email_template_overrides` empty, each of the 7 new sender specs asserts the exact literal default strings from `templates.ts`, plus a matching override-application test proving the wiring genuinely works. Both halves — no regression, and not a no-op.

**Security guards shipped:** `body_cta_url` scheme validated at save time in `saveTemplateOverride` **and** a render-time fallback so a pre-existing bad row cannot emit an unsafe `href`. The subject-line helper text corrected to stop claiming "Shown in the recipient's inbox"; **the override was deliberately NOT wired into the real subject** — header injection is currently unreachable precisely because subjects are hardcoded literals and Resend is a JSON API, so wiring it would open that surface for no benefit.

### 2.4 — Logged, not fixed: one email has no registry entry

`sendBookingRestoredClientEmail` resolves `booking_restored_client`, but that id is **not among the 14 registered templates** (`booking_confirmation`, `booking_cancellation_client`, `booking_reminder`, `booking_plain_text`, `staff_assignment`, `staff_booking_change`, `admin_booking_notification`, `admin_booking_cancellation`, `admin_reschedule_request`, `review_request_client`, `booking_confirmed_client`, `staff_unassignment`, `claim`, `client_assigned_therapist`). C-04a added the restore email without registering it, so its copy is not admin-editable and `resolveTemplateOverrides` will always return `{}` for it. **Harmless today** — the wiring is correct and simply has nothing to find — but it is the one customer-facing email the Templates tab cannot reach. **Natural fit for C-15 (email template studio)**, which owns the registry; logged rather than fixed here (rule 6a).

---

## 2.5 — Security review at the Phase-B gate (4 parallel read-only analysts, 2026-07-31)

Run deliberately **before** Phase B, because Phase B made admin-editable text reach real customer emails for the first time — auditing afterwards would have meant auditing an already-exposed surface.

**Sound, with evidence:** escaping is correct everywhere — every renderer uses `escapeHtml(substituteVars(...))`, i.e. substitute *then* escape, which is the right order (reversed, an interpolated variable containing `<script>` would re-open the hole after the override was already made safe). No override value reaches an unquoted attribute. **Header injection is unreachable** — subjects are hardcoded literals and Resend is a JSON API, not raw SMTP. Both facts are load-bearing for the decision in §2.3 not to wire the subject override through.

**Fixed in Phase B:** `body_cta_url` scheme validation (save-time + render-time), dead subject helper text.

### 2.5a — ⛔ Zone-2 APPLIED: `c08_tighten_email_delivery_events_rls` (`e91c09c`, remote `20260731161346`)

**The finding.** The RLS SELECT policy on `email_delivery_events` admitted `view_email_logs OR resend_booking_emails OR manage_email_settings`. In production `resend_booking_emails` is held by Owner, Admin, Coordinator **and Therapist**; `view_email_logs` is not held by Therapist. `authenticated` holds a table-level `SELECT` grant, so **the policy was the only gate** — a Therapist's own session token could read the whole table directly via PostgREST, bypassing the app. Since C-04a that table stores `to_email`, `subject`, `html_payload`, `text_payload` — the full rendered body of every email, with customer names, addresses and appointment details.

**Why it was safe to tighten — audited call site by call site, not assumed.** All 12 read/write paths use `createSupabaseAdminClient()` (service role), which bypasses RLS: `bookings/actions.ts:477`/`:1017`, `nav-notifications.ts:156`/`:346`, `dashboard-data.ts:465`, `emails/page.tsx:149`, `reports/reporting.ts:321`, the three cron routes, `notifications.ts:262`/`:331`. **No authenticated-role read of this table exists anywhere in the codebase.** Decisively, `sendManualBookingReminder` — the only feature that exists *because* of `resend_booking_emails` — does its own `booking_assignments` scoping in application code and reads through the admin client. It never relied on this policy; the clause was pure incidental over-grant.

Owner approved in chat with the SQL verbatim. Post-apply verification: policy now reads `view_email_logs OR manage_email_settings` only. Owner/Admin/Coordinator lose nothing (`/admin/emails` was already gated on `canViewEmailLogs`). Rollback SQL is in the migration file's header comment.

### 2.5b — Decided: NO code change for the frozen `bookings.contact_email`

`contact_email` is snapshotted at creation, never writable again (no UI field), and every send resolves `booking.contact_email || booking.clients?.email` — so correcting a client's email does **not** fix their existing bookings.

**Measured before deciding: 15 bookings have a linked client; `0` have a `contact_email` differing from that client's email; `0` upcoming.** Nothing is misdirected today — this is entirely preventive.

**Recommendation (Owner-endorsed): do NOT flip the resolution order.** It would change recipient resolution for every booking at once to fix a problem nobody currently has, and phone-only walk-in bookings can legitimately have a NULL client email — the "fix" could stop mail reaching people it currently reaches. **The right fix is additive: make `contact_email` editable on the booking management form + its server action**, which changes no existing behaviour and supplies the missing control. C-08's files-touched list does not include `BookingManagementForm.tsx`, so this is logged for a plan that already touches booking management rather than smuggled in. Recorded in `OWNER-ACTION-BACKLOG.md`.

### 2.5c — Logged, not fixed
- **`html_payload`/`text_payload` are never nulled after send.** They are written only on C-04a's delayed-cancellation path, and the drain cron flips `delivery_status` on the same row without clearing the body — so those rows retain the full email indefinitely. This is *why* the RLS gap had teeth. A retention/cleanup decision is worth making; not urgent now the read path is closed.
- **`booking_restored_client` has no registry entry** (§2.4) — the one customer-facing email the Templates tab cannot reach. Natural fit for C-15.
- Plan §3.3's expectation that Coordinator/Therapist see no Resend button is **wrong** and must not be "corrected" into the code (§0.1).

---

## 3 — ▶ RESUME HERE (interrupt checkpoint, protocol §3)

**Plan:** C-08, plan **#9 of 22**. **Phase A ✅ · Phase B ✅ · Phase C NOT STARTED · Phase D NOT STARTED.**
**Last-good commit:** `e91c09c` (`chore(supabase): C-08 migration applied c08_tighten_email_delivery_events_rls`). Working tree clean except the standing deliberate `src/lib/maintenance.ts`.

**Inherited baseline — independently re-measured at `e91c09c`, use THIS not the plan's text:**
- `npx tsc --noEmit` → **0 errors**
- `pnpm lint` → **59 errors / 7 warnings** (55 in untracked `design_handoff_area_pages/prototype/*.jsx`, 4 in `src/features/booking/`)
- `pnpm vitest run` → **5 failed / 923 passed (928)**, failures EXACTLY: `src/lib/auth/admin-access.test.ts` ×2 ("gives Owner broad access while keeping owner-only role actions permission-gated", "gives Admin broad operational access without role template management") + `src/app/admin/bookings/new/ManualBookingForm.test.tsx` ×3 ("renders step 1 on first load", "moves focus to the first invalid field when continuing with errors", "shows the consent error when trying to create booking without consent")
- `pnpm build` → clean

**Exact next action:** C-08 **Phase C, Step 8** — build the `resendEmail` server action in `src/app/admin/emails/actions.ts`, then Steps 9–12 (`ResendButton.tsx`, page wiring, spec, `AUDIT_PHRASING`). Model **`sonnet`** (§5 routes C-08 to Sonnet; pre-emptive upgrades are banned — Opus only via the §5 twice-failed escalation).

**Three things Phase C MUST carry, none of which are in the plan's own text:**
1. **The `booking_assignments` scope check.** Plan Step 8's sketch calls `requirePermission(RESEND_BOOKING_EMAILS)` and nothing else. `requirePermission` (`rbac.ts:386-401`) is a flat permission-bit check with no concept of *which booking*. `resend_booking_emails` is held by Therapist, who has only `view_bookings_assigned`. **Copy the pattern from `sendManualBookingReminder` (`admin/emails/actions.ts:21-57`)**, which handles this exact case: if `!canViewAllBookings(profile) && !canManageAllBookings(profile)`, require a `booking_assignments` row matching `profile.id`, else refuse and `recordOperationalEvent`. Without it a Therapist holding a delivery-event id could resend mail for a booking they cannot see. **This matters more now that RLS is tightened — application-level scoping is the only remaining gate.**
2. **Do NOT hide the Resend button from Coordinator/Therapist.** Plan §3.3 says to; production grants say otherwise and `emails/page.tsx:158-175` already implements the intended scoped behaviour (§0.1).
3. **Rate limit on a nullable `booking_id`.** `enquiry_logged` (Phase D) has no booking, and the plan's rate-limit query filters on `booking_id` — `.eq("booking_id", null)` does not behave as the sketch assumes. Verify before relying on it.

**Then Phase D**, which opens with ⛔ Zone-2 migration Step 13 (`staff_profiles.notification_email` + `business_notification_prefs` + Owner seed + `email_delivery_events.metadata`). Premises verified: all three columns absent; `service_role` holds UPDATE on both tables; the seed targets **2 active Owner rows**, one of which is the real `rahmatherapy@outlook.com`. **Present the SQL verbatim and wait — approval never carries forward.**
Phase D's resolver has one trap worth pre-empting: the seed writes `{"enabled": true}` with **no `types` key**, so `prefs.types[type] === false` must not evaluate to "all types off" — getting that inverted silently disables every alert for the only opted-in user.

---

*C-08 in progress. Pre-flight `f3a0434`; Zone-2 override deletion + RLS migration 2026-07-31; Phase A `80a8bc2`→`e522bdd`; Phase B `e018d67`+`40a0202`; RLS `e91c09c`. **Resume at Phase C Step 8 — see §3.***
