# C-08 — Email automation expansion — PROGRESS

**Plan:** `redesign/plans/C-phase/C-08-email-automation-expansion-plan.md`
**Brief:** `redesign/briefs/C-08-email-automation-expansion-brief.md`
**Programme:** Band C, C-C implementation — plan **#9 of 22** (§4 order).
**Predecessor closed at:** `f3a0434` (C-11 shipped)
**Model routing:** `sonnet` — §5 routes C-08 to Sonnet, and pre-emptive upgrades are banned. Opus is reserved for the §5 escalation rule (a phase failing verify twice), which is pre-wired into the phase workflows.

> ## ✅ STATUS: SHIPPED 2026-07-31 — C-C plan #9 of 22. All four phases implemented, each independently verified; closeout gate + adversarial whole-plan review PASS.

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
| C | `dc742d0` | Steps 8–12: `resendEmail` action + `dispatchResend` + `ResendButton` + delivery-row wiring + 25 specs + `AUDIT_PHRASING`. H11 scoped-resend preserved; `booking_assignments` scope check added; metadata write deferred. | **PASS first time**, no fix round, no escalation. See §2.6. |
| — | `c531ea6` | **⛔ Zone-2 migration `c08_notification_email_and_metadata`** (Step 13) — remote `20260731192911`. Owner-approved in chat, applied by the orchestrator. | applied + verified (§2.7a) |
| D | `459b9a9` · `4f7e904` · `9e8523f` · `302f90e` | Steps 14–18: deferred metadata write · `resolveBusinessNotificationRecipients` + reroute of the 4 admin_internal sends · `enquiry_logged` template + hook · `/admin/me` Notifications card. Registry now holds **15** templates. | **PASS first time**, no fix round, no escalation. See §2.7. |

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

## 2.6 — Phase C: per-row Resend tooling (`dc742d0`)

Implemented on `sonnet` (§5 routing), verified independently on `sonnet` — **PASS first time**, no fix round, no §5 escalation. Baseline after: **5 failed / 948 passed (953)**, same five inherited names. tsc 0 · lint 59E/7W same six files · build clean.

**Five orchestrator-directed deviations from the plan's own text**, all authorised before dispatch and all confirmed present by the verifier:

1. **The `booking_assignments` scope check the plan omits.** Plan Step 8's sketch gates on `requirePermission(RESEND_BOOKING_EMAILS)` alone — a flat permission bit with no concept of *which* booking, while `resend_booking_emails` is held by Therapist, who has only `view_bookings_assigned`. The implementation mirrors `sendManualBookingReminder`'s existing idiom in the same file (`getStaffProfile` + `canResendBookingEmails` + `canViewAllBookings || canManageAllBookings`, else require a matching `booking_assignments` row, else refuse + `recordOperationalEvent`) rather than the sketch's `requirePermission`/`PermissionError` shape — file style over plan sketch. **This is load-bearing now that `e91c09c` tightened the RLS policy: application-level scoping is the only remaining gate.** Verifier traced the hole end to end and confirmed it is closed.
2. **Null `booking_id` → deny by default.** A scoped actor can never prove ownership of a non-booking-linked event, so the assignment query is skipped and the actor is refused outright rather than falling through.
3. **Coordinator/Therapist Resend visibility PRESERVED** (§0.1). Plan §3.3's "hidden for Coord/Therapist" expectation is wrong; `page.tsx:124`'s `canResend` gate is untouched by the diff — only prop-threading was added.
4. **`metadata` linkage write DEFERRED, not stubbed.** The column ships in Phase D Step 13's unapplied Zone-2 migration. The plan itself sanctions this ("or defer Resend-linkage writes until Step 13 lands"). No placeholder, no TODO, no column probe — a spec explicitly asserts no `metadata` key is present. **The `audit_logs` row (`action_type: 'email_resent'`, `after_state.resent_from`) is the sole linkage record until Phase D lands it.** → **Phase D owes this write.**
5. **Null-safe rate limit.** `.eq(col, null)` compiles to `= NULL` and never matches in Postgres, so both the rate-limit probe and the newest-row lookup branch to `.is("booking_id", null)`. Two dedicated specs prove both branches.

**A sixth, implementer-originated and verifier-confirmed:** the plan's `ResendButton` sketch calls `toast.success`/`toast.error` **synchronously during render**, so it would fire on every re-render. Replaced with the `useTransition` + `ConfirmActionModal` + toast-on-resolution pattern already established in `BookingActionButton.tsx`. The verifier read the cited file and confirmed the pattern is real and genuinely matched.

**`dispatchResend` ships an honest subset, not the sketch's silent `return;` placeholders.** Real resend: `booking_confirmation`, `booking_cancellation_customer`/`_admin`, `booking_reminder`, `staff_assignment`, `staff_booking_change`, `booking_confirmed_client`, `staff_unassignment`. Structured user-visible error: `claim` and `client_assigned_therapist` — verified against the schema that neither event type writes `staffId` on its `sendTrackedEmail` call, so their staff context genuinely is not reconstructable from the delivery row. Every `case` was grounded in the **current** signature in `notifications.ts` (Phases A/B moved that file substantially) and each was re-checked by the verifier.

### 2.6a — Logged, not fixed (rule 6a)

- **Resend of a `booking_confirmation` row also re-sends the admin notification.** `sendBookingCreatedEmails` fires both legs; `sendBookingCancellationEmails` likewise re-notifies all currently-assigned staff. So an Owner resending a confirmation "because the customer never got it" also drops a fresh *New booking request* into the admin inbox, which the confirm-modal copy ("will be sent to {recipientEmail}") does not mention. **This is byte-for-byte the dispatch target the plan's own Step 8 sketch specifies** for these two cases — not introduced here. Worth a copy fix or a per-leg dispatch in a later plan; flagged in the Owner checklist so it is not mistaken for a bug in the field.
- **`EMAIL_EVENT_TYPES` in `src/app/admin/emails/format.ts`** (the Delivery-tab filter dropdown) still lists only the original 9 event types — never updated for Phase A's 4 new ones, `review_request_client` (C-01) or `booking_restored_client` (C-04a). Not on Phase C's files-touched list; pre-existing gap from earlier phases.

### 2.6b — Owner-performed verification (agent cannot authenticate)

Phase C's verify checkpoint is browser + sign-in work. Appended to `OWNER-ACTION-BACKLOG.md`.

1. Owner → `/admin/emails` → Delivery tab → Resend buttons appear on non-skipped rows.
2. Resend a `booking_confirmation` row → modal opens with the "uses current template settings" copy → confirm → success toast + a new delivery row. **Expect a duplicate admin notification too (§2.6a) — that is current behaviour, not a defect.**
3. Re-click within 60 s → rate-limit toast.
4. Coordinator and Therapist → Resend buttons ARE visible (intended, H11 — not a bug); for Therapist they act only on their own assigned bookings.
5. Edit a template's copy, then resend an older event of that type → the new send reflects the edit (proves the Phase B wiring reaches the resend path).
6. Resend a `claim` or `client_assigned_therapist` row if one exists → a clear "isn't supported" error, never a false-success toast.

---

## 2.7 — Phase D: the business-notification bundle

Implemented on `sonnet` across three dispatches (serialized, not parallelised — Step 16 re-entered `notifications.ts` right after Step 15, and concurrent git/vitest on a shared tree was not worth the risk). Verified independently on `sonnet` — **PASS first time**, no fix round, no §5 escalation.

### 2.7a — ⛔ Zone-2 APPLIED: `c08_notification_email_and_metadata` (`c531ea6`, remote `20260731192911`)

Presented in chat with the SQL verbatim; **Owner approved 2026-07-31 ("go ahead and apply it")**; the orchestrator applied it (protocol rule 2 — never a subagent).

**Premises verified read-only BEFORE applying:** all three columns absent · `has_table_privilege('service_role', …, 'UPDATE')` **true** for both `staff_profiles` and `email_delivery_events` (the protocol §3b check that C-04a lost a cycle to — the silent-42501 trap does not apply here) · exactly 2 active Owner rows of 12 staff rows.

**Post-apply verification:** three columns present with expected types/defaults · seeded rows = **2** = active-Owner count, and they are exactly `b0f79294…` (`phase10.owner@example.test`, fixture) and `01582c5d…` (`rahmatherapy@outlook.com`, **the real Owner**) · `notification_email` NULL on all 12 rows · zero `email_delivery_events` rows with non-default `metadata`. No other row touched. The `AND business_notification_prefs IS NULL` clause makes the seed idempotent, so a re-run cannot clobber a preference the Owner later sets in the UI.

### 2.7b — What Phase D delivered

**The `metadata` linkage write deferred from Phase C is now live** (`459b9a9`). The Phase C spec that asserted *no* `metadata` key was written has been **inverted into a positive assertion**, not deleted — the closeout reviewer confirmed it is a genuine assertion.

**`resolveBusinessNotificationRecipients`** (`4f7e904`) implements brief §2.9's contract with three genuinely distinct outcomes — the distinction is the whole point, and conflating any two of them means an actor who opted out still gets emailed:

| Outcome | Behaviour |
|---|---|
| Recipients resolve | one tracked email **and one `email_delivery_events` row per recipient** |
| Nobody anywhere opted in | fall back to `getAdminRecipient(settings)` |
| A non-empty opt-in list emptied by per-type opt-out or skip-self | **no fallback** — a `skipped` row with reason `all_recipients_opted_out` / `actor_excluded` |

It returns `{ recipients, skipReason }` rather than brief §2.9's bare-array sketch, because callers must tell those apart. A shared `sendToBusinessRecipients` helper carries the loop and the skip-row write rather than duplicating it four times.

**The `prefs.types` trap was closed, and closed identically on both sides.** The seed writes `{"enabled": true}` with **no `types` key**, so a missing `types` must mean *all types ON*. Resolver: `row.business_notification_prefs?.types?.[query.type] !== false`. Card: `prefs?.types?.[type] !== false`. **The same predicate** — verified by the verifier and again by the closeout reviewer, both quoting the expressions. Had these diverged, both Owners would have seen "alerts off" in the UI while the resolver kept sending — silent, and invisible to tests.

**Four admin_internal sends rerouted** (Step 15), every target re-located by symbol because the plan's line numbers were stale by two plans:

| Sender | Alert type | Exclusion |
|---|---|---|
| `sendBookingCreatedEmails` (admin leg) | `new_booking_request` | none — customer-initiated |
| `sendBookingCancellationEmails` (admin leg) | `booking_cancelled` | the cancelling staff id, **only** when `initiatedBy: "admin"`; threaded from both `updateBookingManagement` and `quickUpdateBooking` |
| `sendBookingRescheduleRequestEmails` | `reschedule_request` | none |
| `sendClaimNotificationEmail` | `slot_claimed` | the claiming staff — **and the Phase-A interim `getAdminRecipient` call is gone** |

**Phase B's fix survived the reroute.** The closeout reviewer enumerated all 15 `resolveTemplateOverrides` call sites — not sampled — and confirmed every one resolves a real registered `template_id`, including the four senders Phase D rewrote into recipient loops. The single exception is `booking_restored_client`, C-04a's pre-existing unregistered id (§2.4), which C-08 correctly declined to fix.

**`enquiry_logged`** (`9e8523f`) — registered under `admin_internal`, `body_intro` at `maxLength` 500 (inside the live CHECK), `booking_id` NULL throughout. `sendTrackedEmail` / `recordEmailDeliveryEvent` / `sendToBusinessRecipients` had `bookingId` widened to `string | null` to reuse the shared helper; the verifier traced every existing caller and confirmed C-04a's delayed-cancellation queue path still always passes a real id. The `createEnquiry` hook is **catch-and-continue** with a spec proving a failed alert cannot fail the enquiry.

**`/admin/me` Notifications card** (`302f90e`) — `rbac.ts` extended with the two columns following the C-11 `theme_preference` precedent (a narrow, Step-17-authorised exception to §1.7's protected-surface rule; nothing else in that file moved). Self-only write (`.eq("id", profile.id)`), audit row `notification_settings_updated`, CSS variables only (C-11 dark-mode safe), `min-h-11` targets, clean at 375 px.
**One addition beyond the plan's text, and it is load-bearing:** when the master toggle is saved off, the per-type `types` map is **preserved from the prior row** rather than rebuilt from FormData — browsers do not submit disabled checkboxes, so rebuilding from their absence would silently zero every type preference on the next save.

---

## 3 — Closeout (2026-07-31)

**Final gate — all re-run independently at `302f90e`, not taken on the implementers' word:**
- `npx tsc --noEmit` → **0 errors**
- `pnpm lint` → **59 errors / 7 warnings**, in exactly six files: `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` (55) + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}` (4)
- `pnpm vitest run` → **5 failed / 991 passed (996)**, failures EXACTLY: `src/lib/auth/admin-access.test.ts` ×2 ("gives Owner broad access while keeping owner-only role actions permission-gated", "gives Admin broad operational access without role template management") + `src/app/admin/bookings/new/ManualBookingForm.test.tsx` ×3 ("renders step 1 on first load", "moves focus to the first invalid field when continuing with errors", "shows the consent error when trying to create booking without consent"). **`rbac.ts` was edited and `admin-access.test.ts` asserts over that surface, so both verifier and reviewer checked those two failures are unchanged in CHARACTER, not merely still two in number** — both are the pre-existing `accountRequests` page-visibility mismatch, nothing referencing the new columns.
- `pnpm build` → clean

### 3.1 — THIS IS THE INHERITED BASELINE FOR THE NEXT PLAN

**tsc 0 · lint 59E/7W in those six files · vitest 5 failed / 991 passed (996) with exactly those five names · build clean.** Use this, never a plan's hardcoded text (protocol §0 precedence rule).

**Expected shrinkage: none applicable.** C-08 named no baseline entry it expected to fix, and none was fixed. The rise from 948 to 991 passing is +43 new specs across Phases C and D.

### 3.2 — Gate items that could NOT run, and why

- **§3.1 bundle budget — PARTIAL, and the gap is in the gate, not the code.** `scripts/measure-admin-bundles.mjs` measures six routes and **`/admin/emails` is not one of them**, so the plan's "+2 kB on `/admin/emails`" ceiling is not covered by its own gate (the identical blind spot C-04a recorded). `/admin/me` measures **448.31 kB** gzip JS; no pre-C-08 figure is stored for that route, but the sibling `/admin/staff/[staffId]/performance` renders the same `PerformanceSurface` **without** the new card at **447.11 kB** — a **1.20 kB** difference, a fair proxy for the card's cost, well inside the +3 kB ceiling.
- **§3.2 event-type histogram — pre-deploy half captured, post-deploy half deferred by construction.** Live today: 9 active types (`admin_booking_notification` 8, `booking_confirmation` 8, `staff_assignment` 7, `staff_booking_change` 6, `booking_cancellation_admin` 4, `booking_cancellation_customer` 4, `booking_reminder` 4, `booking_reschedule_request_admin` 1, `review_request_client` 1). The plan predicted 7 — it predates C-01. Expect **14** once the five new types flow. This is explicitly a post-deploy delta and stays open until the end-of-programme deploy.
- **§3.3 role × resend sweep · §3.4 trigger-hook end-to-end · §3.5 screenshots — Owner-performed by necessity.** All require admin sign-in, which no agent may perform (password entry is prohibited). Checklists in §2.6b and §3.3 below, indexed in `OWNER-ACTION-BACKLOG.md`. **These are not "pending" in a sense any agent could later discharge.**
- **⚠️ §3.3's own RBAC expectation is WRONG** and must never be "corrected" into the code — see §0.1.

### 3.3 — Owner-performed checklist for Phase D

1. Owner → `/admin/me` → the Notifications card renders below the performance surface; master toggle reflects the seeded `{"enabled": true}` (checked); **all five alert types show checked** (this is the `types`-absent case behaving correctly).
2. Set a notification email, untick "Slot claimed", save → success toast; reload → state persisted.
3. Admin (`test.admin@…`) → card visible, self-only (no path to edit another profile).
4. Coordinator and Therapist → card absent entirely.
5. As Admin, log a test enquiry (`*.example.test` only) → the opted-in Owner receives `enquiry_logged` **at the notification address**; the logging Admin does not (skip-self).
6. As Owner with "Slot claimed" unticked, have a Therapist claim a test slot → no claim email reaches the Owner; delivery row reason `all_recipients_opted_out` if nobody else is opted in.
7. Public booking request on a test fixture → every opted-in Owner/Admin gets `admin_booking_notification`, **one delivery row each**.

### 3.4 — Adversarial whole-plan review (`f3a0434..302f90e`) — REVIEW PASS

All 18 steps present; none silently dropped. All 15 override call sites enumerated and correct. Escaping confirmed `escapeHtml(substituteVars(...))` everywhere — substitute *then* escape, the order that matters. `body_cta_url` scheme guard present at both save time and render time. `resendEmail` traced as an unassigned Therapist: refused, with a logged operational event. `/admin/me` save confirmed self-only. Files outside the plan's §2 list were all traced to the Owner-approved Phase B extension, required test coverage, or protocol §2.8(c) next-plan prep.

**Five non-blocking findings, logged not fixed** (all in `OWNER-ACTION-BACKLOG.md`):
1. **`dispatchResend`'s cancellation case does not thread `actorStaffId`.** Admin A cancels a booking (correctly skip-self'd, no alert), later resends that cancellation's admin-alert row, and now *does* receive a copy of their own alert. **The Phase D verifier and the closeout reviewer reached opposite verdicts here** — the verifier judged it semantically right (resend has a different actor, and the original canceller's identity does not survive to resend time), the reviewer judged it an inconsistency. Left as-is deliberately: it is a design question, not a defect, and "fixing" it means inventing provenance that was never recorded.
2. **Double `resolveTemplateOverrides` fetch** for the six templates whose HTML renderer resolves internally while the plain-text leg resolves again in `notifications.ts`. Inherited verbatim from C-01's `sendReviewRequestEmail`, not introduced here; the eight Phase-B legacy senders use the cleaner resolve-once-pass-to-both shape. Natural fit for **C-15**, which reworks the registry (see `C-15-…-progress.md` §0.1 — this is the same sync/async split that threatens C-15's live draft preview).
3. **Stale admin-facing `trigger` copy** in four `templates-data.ts` entries — `claim` still says Phase D "will" reroute it (it has), and the three `admin_*` entries still say "sent to the owner" though they are now multi-recipient. Cosmetic, visible only to Owner/Admin editing templates. **C-15** owns the registry.
4. **Resend success toast can overstate delivery.** If the recipient named on the original row has since opted out, the resend's `newest` lookup finds nothing yet the toast still says "Resent to {email}". Narrow — requires an opt-in change between original send and resend.
5. **`EMAIL_EVENT_TYPES` dropdown** missing the seven newer event types (already logged in §2.6a).

---

*C-08 SHIPPED 2026-07-31 — plan #9 of 22. Pre-flight `f3a0434`; Zone-2 override deletion + RLS migration `e91c09c`; Phase A `80a8bc2`→`e522bdd`; Phase B `e018d67`+`40a0202`; Phase C `dc742d0`; Zone-2 migration `c531ea6`; Phase D `459b9a9`→`302f90e`. Two Zone-2 migrations and one Zone-2 data deletion, each Owner-approved in chat and each performed by the orchestrator. Next plan: **C-15** — read-ahead pre-flight already captured in `C-15-email-template-studio-progress.md`.*

