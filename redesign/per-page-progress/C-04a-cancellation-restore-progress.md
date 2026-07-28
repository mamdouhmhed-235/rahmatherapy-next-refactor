# C-04a — Cancellation restore + delayed-email infra — PROGRESS

**Plan:** `redesign/plans/C-phase/C-04a-cancellation-restore-plan.md`
**Brief:** `redesign/briefs/C-04a-cancellation-restore-brief.md`
**Programme:** Band C, C-C implementation — plan **#4 of 22** (§4 order).
**Predecessor closed at:** `e0d4b19` (C-06)

> ## ⏸ STATUS: Phases A–F of 8 landed. A–E independently verified (PASS). F verified FAIL → fix round `502824a` → re-verified across 3 lenses → **second blocker found (missing GRANT), grant migration applied**; F's code fix round #2 outstanding. Phases G, H outstanding.
> **Last good commit:** `502824a` · **Next action:** Phase F fix round #2 (error handling). The ⛔ **Cloudflare deploy is still outstanding** — the cron is inert until it happens.

---

## 0f — ⛔ SECOND MIGRATION APPLIED (2026-07-28): the GRANT that makes Phase F work at all

**`service_role` had no UPDATE privilege on `email_delivery_events`.** Found by the Phase F fix round's independent race-lens verifier; confirmed by the orchestrator directly against production before any action.

```
grants before: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE   ← no UPDATE
rolbypassrls = true                                                    ← RLS was never the gate
```

This project grants **explicitly per table** (`20260503094000_phase16_service_role_grants.sql`); the Supabase blanket `grant all` default is demonstrably not in effect. The ledger for this table was: Phase 4 → `select, insert`; Phase 10 → `delete`; `20260728073903_c04a_scheduled_emails.sql` → columns + CHECK, **no grant**.

**C-04a introduced the first three UPDATEs this table has ever had, and all three were 42501s** — the cron's conditional claim, the cron's corrective flip to `failed`, and `restoreBooking`'s sweep to `cancelled_by_restore`. Each discards its error, so the failure was **silent**: the cron would return `200 {sent:0, skipped:N, failures:[]}` — indistinguishable from healthy — while the customer's cancellation email was never sent, forever. Nothing would reach Sentry, `/admin/emails`, `/admin/operations` or the nav counter.

**Corroborating evidence:** all 42 rows are `accepted`. No row has ever changed `delivery_status` — consistent with UPDATE never once having succeeded.

**Direction-of-travel note (the verifier's sharpest point):** before fix round #1 the cron sent *then* updated, so under the same missing grant the customer received the cancellation (and a duplicate every minute thereafter). Fix round #1 converted a loud failure into a silent total loss. The claim-before-send design is right; it is the grant that makes either version correct.

### Migration
`supabase/migrations/20260728132043_c04a_grant_update_email_delivery_events.sql` — one statement:
`grant update on public.email_delivery_events to service_role;`
Applied by the orchestrator under Owner approval in chat (Zone-2, never a subagent). Additive, idempotent, no data touched, no schema change. **Rollback:** `revoke update on public.email_delivery_events from service_role;` returns the database to exactly its pre-migration state.

### Post-apply verification — live proof, not just a flag
Ran the UPDATE **as `service_role`** inside a `DO` block against `id = '00000000-…-000000000000'`, a row that cannot exist. Postgres checks privilege independently of row matching, so a 0-row UPDATE proves the grant while mutating nothing. The block completed without raising.

| Check | Result |
|---|---|
| `has_table_privilege(service_role, …, UPDATE)` | **true** |
| grants | `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, **UPDATE**` |
| row count | 42, unchanged |
| status mix | `accepted=42`, unchanged |
| `staff_permission_overrides` UPDATE | still **false** — correctly out of scope |

### FINDING LOGGED, NOT FIXED (§1.6(a)) — a second, pre-existing breakage
The same privilege sweep found **eight** tables without UPDATE for `service_role`. Two are correct by design (`audit_logs` append-only, `permissions` read-only reference). Of the rest, only one is actually written by the app: `src/app/admin/staff/actions.ts:613` upserts `staff_permission_overrides` with `onConflict: "staff_id,permission_id"`. **Postgres requires UPDATE privilege for `ON CONFLICT DO UPDATE` whether or not a conflict occurs**, so every per-staff permission override save fails 42501. The table has **0 rows**, consistent with the feature never once having worked. It fails *loudly* ("Failed to save permission override."), unlike the email case. Owner explicitly scoped the grant to `email_delivery_events` only; this is recorded for a later plan, not fixed here.

**Carry-forward for every remaining plan:** when a plan adds the *first* UPDATE/DELETE/upsert against a table, check `has_table_privilege('service_role', …)` in pre-flight. tsc, lint and vitest are all blind to a missing GRANT, and the app's own error-discarding makes it silent at runtime.

---

## 0e — ⛔ MIGRATION APPLIED (2026-07-28) — Owner-approved in chat

Applied to production `twzutkfgqclqurvkmvqz` via `mcp__supabase__apply_migration` by the orchestrator (never a subagent — protocol §1.2). File: `supabase/migrations/20260728073903_c04a_scheduled_emails.sql`.

**Rollback artefact captured first:** `redesign/evidence/C-04a/delivery_status_check-BEFORE.sql` — the live `pg_get_constraintdef` verbatim, plus the exact restore SQL and its precondition (`SELECT DISTINCT delivery_status` must return only accepted/failed/skipped, or the re-ADD fails). That bounds the one destructive statement.

### Post-apply verification — all pass
| Check | Result |
|---|---|
| 5 new `email_delivery_events` columns | **5** |
| `idx_email_delivery_events_scheduled_pending` | present |
| CHECK definition | `accepted, failed, skipped, **queued, sent, cancelled_by_restore, cancelled_manual**` |
| `bookings.cancelled_at` | exists |
| Backfill | **stamped 1 / unstamped 1** — exactly as projected |
| **Badar `9d55ce2a`** | **`cancelled_at IS NULL` — untouched, §1.7 held** |
| Fixture `eaafbb1a` | stamped `2026-05-20 19:24:17+00` |
| Existing rows | 42, unaffected |

**The `unstamped = 1` is Badar's excluded row, not a backfill miss** — projected before applying, confirmed after.

### Corrections carried into the applied SQL
- **Backfill 2's action types** (Owner decision 2): `booking_quick_cancel` and `customer_booking_cancelled` added alongside the plan's `booking_management_updated`. As the plan wrote it, it would have stamped **0 of 2** — both live cancelled bookings were cancelled via the quick action.
- **Idempotency** (orchestrator decision 5): `IF NOT EXISTS` throughout, `DROP CONSTRAINT IF EXISTS` before the re-add, both backfills guarded on `cancelled_at IS NULL`. The plan's bare `ADD COLUMN` would not have survived a re-apply.
- **DO-NOT-TOUCH exclusion** on **both** backfills, with the §1.7 rationale written into the file. Backfill 1 stamps 0 rows today, but the zero is a property of current data, not of the statement — carrying the clause makes "this migration never writes to `9d55ce2a`" a property of the file.

### Still outstanding after this migration
- **⛔ The Cloudflare deploy has NOT happened.** `wrangler.jsonc` carries `"* * * * *"` but the cron is **inert** until deployed; queued rows must be drained by manual curl in the interim. **That deploy will also silently apply C-22's `RateLimiter` Durable Object migration** — its approval text must say so.
- **F-1 is NOT resolved.** Both cancelled bookings remain S6-past and S7-expired, so **no production booking shows a Restore button** even now. Do not expect one at the closeout sweep.
- Phase F code found that the plan's cron route imports `{ resend, senderAddress } from "@/lib/email/resend"` — **a module that does not exist**. The repo's wrapper is `sendEmail` from `@/lib/email/client`. The plan's code would not have compiled.
- The cron marks a row `failed` **terminally** on any send throw, including `EmailConfigurationError` or a transient Resend 429/5xx — up to 50 queued cancellation emails burned with no retry. Plan-specified and matching `booking-reminders`' existing shape, so pattern-level rather than new. Cron-sent rows also record no `provider_message_id`, and failures no `error_message` and no `recordOperationalEvent`, so a failed scheduled send is invisible on `/admin/operations`.
- `tsconfig.json` **excludes `worker-entrypoint.ts`**, so the plan's Step 12 claim that it is covered by the tsc pass is false. eslint does cover it.
>
> **Baseline: 5 failed / 706 passed / 711** — the five inherited (admin-access ×2, ManualBookingForm ×3); tsc 0; lint 59E/7W identity.
>
> ### Phase E (`065d522`) — verified PASS
> Dead `refunded`/`waived` filters removed (12 sites, 4 files — including **four the plan's list omits**, found by the grep Step 8 mandates); `reporting.ts:438` `||` → `??`; Step 9 specs.
>
> **`reporting.ts` diff is exactly one line — `--numstat` reads `1 1`** — the two-character operator, no comment, no reformat. `:1334`'s byte-identical `||` inside the AUDIT-2026-05-22 Q2-locked `getAvgBookingValue` is **untouched**, as pre-flight contradiction D requires.
>
> **⚠️ REVENUE IMPACT — the accurate account.** An earlier report to the Owner overstated this and was corrected. `summary.completedRevenue` has **exactly one runtime consumer**: `src/app/admin/reports/export/route.ts:84`, the `completed_revenue` row of the "Revenue summary" CSV. It is **not** read by the dashboard (`outstandingRevenue`, `repeatClients`, `newClients` only), the report tiles (`collectedRevenue`/`outstandingRevenue`), `report-insights` (`bookingCount`/`outstandingRevenue`) or `PerformanceSurface`. Verified exhaustively, including a check for `...summary` spreads and `Object.keys(summary)` iteration.
> **Delta £110.00 → £55.00 (−50%)**, from one completed booking (`ae9bb5bd…`, 2026-05-15) with `amount_paid = 0, total_price = 55`, `payment_status = 'unpaid'` — never paid, not refunded. **Invisible on the default view**: default range is the current month and both completed bookings are May 2026, so the default export reads £0 → £0. The change surfaces only on `lifetime`, `year`, Q2 or a custom range covering May 2026.
> Brief §2.6's *"In production today: 0 such rows visible"* is **false** — pre-flight contradiction E, confirmed twice.
>
> **The dead filters were provably dead, not presumed.** Production `payment_status` is only `unpaid` (13) and `paid` (2); **zero** `refunded`/`waived` mentions anywhere in `audit_logs` history, so no booking ever transitioned through them; and `PAYMENT_STATUSES = ["paid","unpaid"]` is enforced server-side, so they could never have been written.
>
> **Two-axis canary, isolation confirmed:** reverting `??`→`||` fails only the `amount_paid: 0` spec; dropping the fallback entirely fails only the `amount_paid: null` spec. Each mutation caught by exactly one spec. Note `completedRevenue` had **zero** spec coverage before this commit.
>
> **Log-only from Phase E:** `reporting.ts:1327-1328`'s comment now states something false — it claims `getAvgBookingValue` "matches `summarizeReports`' existing `completedRevenue` accumulator", but the two now diverge (`??` vs `||`). Correctly not fixed (only `:438` authorised); `getAvgBookingValue` has **no production consumer**, so the inconsistency is latent. Whoever unblocks `:1334` must update that comment in the same change. Also: `paymentStatusTone`'s `"partial"`/`"outstanding"`/`"due"` cases remain dead but unauthorised to remove (behaviour-neutral whenever someone is); a stale `?payment=refund_issued` bookmark now renders unfiltered instead of permanently empty (strictly better, and anticipated by the plan's own risk table); and the Step 7 spec kept the file's existing `.slice(1)` idiom rather than the plan's literal form — equivalent-or-stronger coverage, recorded as a documented deviation.
>
> ### Phase D verification outcome + fix round (`81f0c00`)
> - **Owner decision:** auto-promote now requires all assignments terminal **AND at least one `completed`**. Previously an all-no-show booking promoted to `completed` — recording a visit nobody attended, and the only path writing `completed` without a human choosing that word. Plan Step 6 permitted it; **brief §2.4 did not** ("ALL assignments have status='completed'"), and Step 6d sanctions only a *mix*. The mixed case still promotes. The spec that enshrined the old behaviour was reversed in place.
>   - Audit `trigger` deliberately **kept** as `all_assignments_terminal` — the condition is now "all terminal AND ≥1 completed", so `all_assignments_completed` would be *less* accurate.
> - **Race path no longer logs a false error.** `.single()` on a 0-row UPDATE returns `PGRST116`, so the correctly-handled concurrent-promote path emitted `console.error("Auto-promote failed.")` — Sentry noise contradicting brief §5.4. Now `maybeSingle()`, with the error and no-row branches split so a genuine failure still surfaces. Both directions spec'd and demonstrated.
> - **`TERMINAL_BOOKING_STATUSES` is now `as const satisfies readonly BookingStatus[]`** — a typo is a tsc error rather than a silently-empty exclusion list. Proven: `"no-show"` produces TS2820.
> - **F-3 declined with reasons, logged in a 10-line comment at `actions.ts:241-250`.** The audit `before_state.status` can be stale if a concurrent write lands between the pre-read and the UPDATE. Both obvious fixes are worse: PostgREST's `.select()` on a PATCH returns the **new** representation (no `RETURNING OLD`, so capturing the prior status needs a DB function → Zone-2), and adding `.eq("status", …)` as optimistic concurrency would trade the stale field for a **lost promotion** — 0 rows matched, booking left un-promoted with all assignments closed and nothing to re-trigger it. Residual harm is one audit row with a wrong prior status in a one-round-trip window; the concurrent writer's own row carries the true transition with an earlier timestamp, so the log stays reconstructable.
>
> **Verifier's independent closure re-proof:** it probed production PostgREST with a malformed control (`not.in.[…]` → `PGRST100` parse error) to confirm the derived filter string genuinely parses rather than silently matching nothing, and re-enumerated all 13 `bookings` UPDATE sites plus DB triggers, functions across every non-system schema, rules, scheduled jobs, edge functions and table grants. **Exactly three paths write `completed`/`no_show`; all three guarded. `authenticated` holds SELECT only, so no browser-side PATCH can write status at all.**
>
> **⚠️ Unrun and NOT marked done (§1.12):** Phase D's Playwright checkpoint (therapist completes the last assignment → booking flips → audit row → banner). It needs a production booking write plus a real staff email — a §1.2 trigger, orchestrator-owned. Carry to the closeout sweep alongside Phase A's F-1.

---

## 0d — Phase D (`ba9afe3`) + two temporal guards (`1a71433`, `b5a052a`)

Auto-promote on all-assignments-terminal, its hook in `updateOwnAssignmentStatus`, and the "Auto-completed" banner.

**D-1 was fixed structurally, not patched.** `TERMINAL_BOOKING_STATUSES` in `_helpers.ts` now derives **both** the predicate and the `.not("status","in", …)` filter, so plan `:661` and `:670` are incapable of disagreeing. The implementer deliberately did **not** fold `quickUpdateBooking`'s four guards into it — they are not set-membership tests; each names its own source status so the refusal copy points at the right way back, and `cancelled` is closed there only against `completed`, leaving `cancelled → confirmed` for C-05. A doc comment records this so nobody "unifies" them later.

### The temporal-guard sweep — now closed across all three write paths
Two further instances surfaced, each found by the agent working on the previous fix:

| # | Path | Hole | Fixed |
|---|---|---|---|
| 5 | `autoPromoteBookingFromAssignments` | No date guard. `updateOwnAssignmentStatus` is gated on `isOwn` (assignment ownership only, never the booking's status or date), so a therapist could mark their assignment complete on a **next-week** booking and auto-promote it to `completed` — the exact write the admin chip refuses. | `1a71433` |
| 6 | `updateBookingManagement` (Status form) | No date guard; the `<Select>` offers `completed`/`no_show` unconditionally. An admin could set next week's booking to completed — the same write refused ~200 lines away in the same file. | `b5a052a` |

All three now share `isBookingDateFutureLondon` and the identical W03-E-2 copy.

**Closure verified, not asserted.** Exactly three paths can write `completed`/`no_show` and all three are guarded. `restoreBooking` targets only `confirmed`/`pending`; the customer-manage flow and the client-delete cascade write only `cancelled`; every other `bookings` UPDATE touches `assignment_status`, `reschedule_status` or manage-token columns. Checked outside the app too: the only trigger on `bookings` is `bookings_updated_at`, the only function is `create_booking_request`, and the reminders cron writes no status.

**Guard-width proven on both axes** (this is what makes the specs worth having): dropping the target check breaks *cancelling a future booking*; dropping the date check breaks *completing a past one*. Both canaries exist and both were demonstrated failing.

**Declared edge, verified unreachable:** the Status-form guard keys on the status being written, so a Notes save would be refused on a future-dated booking already sitting at `completed`/`no_show`. Production has zero such rows, nothing creates a booking in those statuses, and no path rewrites `booking_date` after creation. Recorded in a code comment.

### Outstanding from Phase D
- **UI-only remnant, Phase G's:** `BookingRowActions.tsx:201-204` still shows "Mark complete" on any `confirmed` + `fully_assigned` row including future-dated ones. The server refuses with W03-E-2, so no write escapes — but the row offers a button the server declines. `_helpers.ts` already names the row menu as Phase G work.
- **`isOwn` ignores booking status entirely**, so the therapist's "Mark complete"/"Mark as no-show" stay live on cancelled, completed and no-show bookings. Phase D correctly refuses to *promote*, but the assignment write still lands and renders **"Visit completed"** in a cancelled booking's activity timeline. Record integrity only. Owner scoped the UI half to **C-05**.
- **Banner visibility:** `auditLogs` is `[]` unless `fullScope`, so the "Auto-completed" notice shows to Owner/Admin/Coord but **not** to the therapist who triggered it — though brief §4.4 frames it around the practitioner. Needs a second audit query for non-fullScope actors; look at it in Phase G.
- **Change 7 audit phrasing now has three action types outstanding:** `booking_restored` (Phase A), `booking_quick_no_show` (Phase C, detail page only), and `booking_auto_promoted_completed` (Phase D, neither map). Whichever phase claims Change 7 must do all three in both `[bookingId]/page.tsx`'s `ACTIVITY_ACTION_LABELS` and `clients/[clientId]/page.tsx`'s `AUDIT_PHRASING`.
>
> **Commits so far:** `3bddb39` A · `057b974` A verified · `49da51e` B · `e83187e` B fix (B-1) · `68fc49a` C · `6aaf540` terminal guards 1–2 · `56cba4d` terminal guard 3 · `f24bc42` terminal guard 4.
> **Baseline now: 5 failed / 680 passed / 685** — the five inherited (admin-access ×2, ManualBookingForm ×3); tsc 0; lint 59E/7W identity.

---

## 0b — Phase B (`49da51e` + `e83187e`) — verified PASS

Completed-reversal guard on `updateBookingManagement` + the Status-form confirm modal.

**A first dispatch HALTED before writing code** under rule 6(b) and was right to: the plan's §2 attributes the modal to `[bookingId]/page.tsx`, which has **zero** `updateBookingManagement` consumers — all three live in `BookingManagementForm.tsx`. **Owner extended the files-touched list** to that file. It also refused to ship the server guard alone, because that would reject every `completed → *` transition while its error copy pointed at a modal that did not exist.

**Fix round (B-1):** the too-short-reason path was a dead end — `ConfirmActionModal` closes on the next microtask, before the server answers, so `fieldErrors.completed_reversal_reason` had **no render site** and the admin got an `Infinity`-duration "Retry" toast that could never succeed. Closed at the submit boundary (the primitive exposes no way to disable its confirm button, and editing a shared primitive was forbidden), plus a render site for the server's message.
**Logged for the Owner:** a one-line `confirmDisabled?: boolean` on `ConfirmActionModal` would let this be enforced at the control instead.

**C-1 (carry to Phase G):** the completed-reversal rule now exists twice — `restoreBooking` keeps its own inline predicate, its own hardcoded `5` and its own copy, while Phase B reads `COMPLETED_REVERSAL_MIN_REASON_LENGTH` from `_helpers.ts`. Editing the constant would silently leave restore behind.

---

## 0c — Phase C (`68fc49a`) + four terminal-state guards (`6aaf540`, `56cba4d`, `f24bc42`)

No-show quick action + Mark no-show button. `completed → no_show` deliberately unreachable through it.

**Then four live one-click holes were found and closed, all Owner-approved as deviations from plan §2's UNCHANGED list**, which freezes `confirm`/`cancel`/`complete`/`mark_paid`:

| # | Hole | Severity |
|---|---|---|
| 1 | `cancel` chip live on a **completed** booking → **fires a real customer cancellation email** | high |
| 2 | `complete` chip live on a **cancelled** booking → `cancelled → completed`, bypassing Phase B | high |
| 3 | `cancel` + `complete` chips live on a **no_show** booking → cancel **fires a real customer email** | high |
| 4 | `confirm` chip live on a **no_show** booking → silently un-does it, **bypassing `restoreBooking` entirely** — no S6 past-moment guard, no `booking_restored` audit action, no "booking is back on" client email | medium |

The final guard **simplified** to `beforeState.status === "no_show" && nextStatus !== "no_show"`, structurally identical to `isCompletedReversal`. All guards read the computed payload's target status, not the action name, so `mark_paid` self-excludes without special-casing.

**Sweep completed:** every caller of `quickUpdateBooking` and every importer of those components was enumerated and each affordance's render condition cross-checked against the server's refusal set. **No live control renders on a completed, cancelled or no-show booking for any status-writing action.**

**Also resolved:** plan Step 5 guards `complete` against future dates while §2's UNCHANGED list freezes it. **Owner: Step 5 wins** — §2's line is stale (it also claims only `no_show` is added to that switch, when Phase G adds `restore`). The implementer also replaced the plan's `new Date().toISOString().slice(0,10)` with `getBusinessDate()`, fixing a real BST false-negative where between 00:00 and 01:00 London a same-day booking read as future-dated.

### Left for C-05 (no live affordance — hand-crafted POST only)
`cancelled → confirmed`, `cancelled → no_show`, and the `X → X` no-ops remain permitted server-side. C-05's remit is exactly this, with a shared helper across all seven edit points.

### Left for C-06's record
`deleteClient`'s cascade filter is `.not("status","in","(cancelled,completed)")`, which **includes `no_show`** — deleting a client silently reclassifies a no-show booking as cancelled. Record-integrity only; no email fires.

### 🔴 D-1 — PHASE D'S PLAN WILL OPEN A FIFTH HOLE. READ BEFORE IMPLEMENTING STEP 6.

Found by the Phase C verifier, before Phase D was written. Same damage as hole #4, reached through a door the four guards cannot watch — because they all live inside `quickUpdateBooking`.

**The chain:**
1. `SessionNotePromptSheet.tsx:61` and `[bookingId]/page.tsx:941,950` dispatch `assignment_completed` / `assignment_no_show` → **`updateOwnAssignmentStatus`**, not `quickUpdateBooking`. Today they write only assignment state, so they are correctly outside the four guards.
2. Their gate is `isOwn = isAssignedToActor && assignment.status === "assigned"` (`page.tsx:870`) — **it never checks the booking's status.**
3. **Nothing cascades a cancel or no-show to `booking_assignments`.** All four `.from("booking_assignments").update(...)` sites were checked; none is reached from `quickUpdateBooking` or `updateBookingManagement`. So a no-show booking keeps its assignments at `"assigned"` and the therapist's "Mark complete" stays **live** on it.
4. Plan Step 6 hooks `autoPromoteBookingFromAssignments` into `updateOwnAssignmentStatus` (Step 6b, plan `:713`). The helper's terminal bail-out is `if (bookingNow.status === "completed" || bookingNow.status === "cancelled")` (plan `:661`) plus `.not("status","in",'("completed","cancelled")')` (plan `:670`). **`no_show` is in neither.**

**Result the moment Phase D lands:** therapist opens a **no-show** booking → marks their own assignment complete → all assignments terminal → booking status `no_show` passes both exclusions → **booking auto-promoted to `completed`**, with an audit row and a staff email. A no-show silently un-done, bypassing `restoreBooking`, its S6 past-moment guard, its `booking_restored` audit action and its client email — exactly hole #4.

Plan Step 6d's three listed cases cover booking-`completed` and booking-`cancelled` but **not** booking-`no_show`. Brief §3:659 independently confirms the trigger.

**Required at Phase D:** add `no_show` to the predicate at plan `:661` **and** the `.not("status","in", …)` list at `:670`, and add a Step 6d case "all assignments terminal, booking no_show → no-op". **Better:** move the terminal-status rule into `_helpers.ts` so `quickUpdateBooking` and the auto-promoter cannot drift — the same drift C-1 already flags for `restoreBooking`.

### C-1 (material, for Phase G) — the strip now asserts things that are false
`isDone` means "don't offer", but the branch it drives renders a **✓ checkmark plus `doneLabel`**. On a **no-show** booking the panel shows `✓ Confirmed · Mark paid · ✓ Completed · ✓ Cancelled` — three false claims, and none says "no-show". On a cancelled booking, two are false.

The pattern **pre-dates this work** (`confirm.isDone` already covered `completed || cancelled`), so extending it matched the file's existing style per §1.11 — but it is now three-wide on the most confusing status. The correct shape is a separate `isUnavailable` predicate rendering nothing, or a muted "Not available". **Phase G rewrites exactly this surface** (status-aware menu, Step 13c) — fix it there. The current specs cannot catch it: they use `queryByRole("button", …)`, which passes while a `<span>` renders.

### Spec gaps closed (`7e368e0`)
- **F-1:** the BST fix was unpinned — fixtures derived from the implementation's own clock, so reverting it left the suite green for 23 hours a day. `isBookingDateFutureLondon` now takes a defaulted `now`, and a spec injects `2026-07-27T23:30:00Z` (00:30 London, BST). Proven to redden against **both** plausible revert shapes.
- **F-2:** no spec asserted a legal `pending → confirmed` or `confirmed → completed` succeeded — every `confirm` spec in the file asserted a *refusal*. Dropping guard 2's second conjunct would have broken **every** quick "Mark complete" with the suite green. Both canaries added and proven to be the only genuine detectors.

### Log-only from the Phase C verification
- `complete` is **not** date-gated in either `BookingRowActions.tsx:201` or the `complete` chip, so on a future-dated confirmed booking both render live and the server now refuses them with the W03-E-2 message. Plan-sanctioned (brief §2.3 says it "surfaces as" an error), but it contradicts the invariant the new no-show button holds to — a button should not offer what the action refuses.
- `BookingRowActions.tsx:22` gained `no_show` in the union but no menu item dispatches it — dead until Phase G. Intentional groundwork.
- `complete` from `completed` (and `no_show → no_show`) still writes a spurious audit row; crafted-POST only, pre-existing.
- `_helpers.ts` `booking_date: string | null` → `String(null ?? "")` fails **open**. Unreachable per schema; the optional type invites it.

### Still outstanding from Phase C
Change 7's audit phrasing: `booking_quick_no_show` was added to the detail page's `ACTIVITY_ACTION_LABELS`, but neither it nor Phase A's `booking_restored` is in `clients/[clientId]/page.tsx`'s `AUDIT_PHRASING`. Whichever phase claims Change 7 must do both.
> **The drift checkpoint for plans #1–#5 falls due after this plan** (protocol §2.6).

---

## 0a — Phase A (`3bddb39`) — verified PASS

`restoreBooking` with the S6 past-datetime and S7 28-day guards, the Restore next-action button, the restore email + template, the S3 prior-reason modal, and the shared `_helpers.ts`. 30 new specs; baseline **5 failed / 642 passed / 647**, identity intact.

**Both pre-flight fixes landed and were proven, not asserted:**
- `.select("*, clients(deleted_at)")` — the verifier re-derived the mutation proof from the stub source and confirmed the stub models PostgREST correctly (it returns `clients` **only** when the select names it), so the guard spec is genuinely non-vacuous. Reverting to `.select("*")` fails exactly 2 specs.
- Refusal copy is now *"This booking's client has been deleted, so it can no longer be restored."* — no instruction to un-delete.

**All five adaptations ruled justified.** The strongest: adding `booking_quick_cancel` to the S3 audit lookup. Production has **zero** `booking_management_updated` cancel rows — both live cancelled bookings carry exactly one `booking_quick_cancel` audit row each — so the plan's single-action-type version would have returned no context for **100%** of real admin cancellations. Consistent with Owner decision 2.

Guards all run before any write (first UPDATE at `actions.ts:584`); S7 fail-closes on an unknown **or unparseable** cancellation moment, which is hardening beyond the plan in the safe direction.

### ⚠️ F-1 — MATERIAL: Phase A's verify checkpoint is unsatisfiable today, and it changes Owner decision 1

Plan `:509` wants: navigate to a cancelled booking → Restore button visible → status flips. **No booking in production can currently show that button:**
- Both live cancelled bookings are dated 2026-05-20, so **S6** hides it (the strip reads "The appointment time has already passed…").
- A **new** future-dated fixture cancelled through the **admin UI** stamps no cancellation moment at all — `cancelled_at` does not exist until Phase F, and the only writer of `customer_cancelled_at` in the codebase is the **customer-facing** `/booking/manage` path (`booking/manage/actions.ts:143-144`). So `isRestoreWindowExpired` fail-closes → button hidden → "The 28-day restore window has passed."

So Phase A ships a correct restore primitive with **no visible affordance anywhere** until Phase F's migration + backfill. Designed fail-closed behaviour plus plan sequencing — not a defect — but §1.12 forbids marking the checkpoint done.

**This supersedes Owner decision 1's "create it via the admin UI".** Cancelling via the admin UI produces a fixture that still cannot demonstrate restore. Two viable routes:
- **(a)** cancel the fixture through the **customer manage link**, which stamps `customer_cancelled_at` → the button renders → the checkpoint is satisfiable now; or
- **(b)** defer the Phase A runtime checkpoint to the Phase F/G closeout, recorded as deferred.
**Owner input required before the fixture is created.**

### Log-only findings
- **F-2:** the London zoning is correct (it delegates to `toBusinessDateTime`, no duplicated BST maths) but **unpinned** — both S6 boundary specs give the same verdict under naive UTC parsing, so a future "simplification" would stay green. One spec at 10:30-vs-11:00 London would close it.
- **F-3:** `notifications.ts:465-467`'s `if (!customerEmail) throw` is unreachable — `getBookingTemplateInput` defaults to `requireCustomerEmail = true` and throws first. Harmless, plan-specified, matches the sibling.
- **F-4:** contradiction **H** confirmed still open — `booking_restored_client` is registered in neither `templates-data.ts` nor the preview route, so the template's `overrides` parameter is dead until someone registers it.
- Tighten `isRestoreWindowExpired`'s `customer_cancelled_at` from optional to required when Phase G lands — optional is gratuitous there and is exactly the shape that lets the §2 C-bis silent-`undefined` trap type-check.

---

## 0 — Pre-flight: PASS, with eight contradictions found

Run read-only 2026-07-27 against HEAD `e0d4b19`.

**Standard checks all PASS:** branch `master`; HEAD ⊇ `ea97932` and `7fe8b4f`; path-scoped tree clean; dependency check satisfied (C-04a has no hard dependency; C-06 shipped in 6 `feat(redesign): C-06 Phase …` commits). Dev server 200.

**Baseline identity (inherited from C-06, supersedes the plan's frozen 485/491 snapshot):**
tsc **0** · lint **59 errors / 7 warnings** in exactly `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience,BookingExperienceLoader}.tsx` + `utils/returning-customer.ts` · vitest **5 failed / 612 passed / 617** (admin-access ×2, ManualBookingForm ×3).

**Schema premises all HOLD:** `bookings.cancelled_at` ABSENT; `customer_cancelled_at` EXISTS (backfill source); all five `email_delivery_events` columns ABSENT; `audit_logs` has no CHECK; `event_type` is free text → **the conditional enum migration will NOT fire** (plan §0.5(b) resolved, so cadence commit 9 is dead). `booking_status_type` includes `no_show`. The one CHECK to drop/re-add is **`email_delivery_events_delivery_status_check`** = `delivery_status = ANY (ARRAY['accepted','failed','skipped'])`; live values are `accepted` only (42 rows), so §5.2's undo precondition is satisfiable. `BookingRowAction` union is exactly the 5 members the plan expects — zero drift.

---

## 1 — OWNER DECISIONS (2026-07-27, in chat) — binding

1. **Test fixture (contradiction A):** the orchestrator **creates a future-dated `*.example.test` booking via the admin UI**, then cancels it, to give the restore path a genuine fixture. List it for cleanup at closeout alongside C-06's two rows.
2. **Backfill (contradiction B):** **extend backfill 2 to `OR action_type = 'booking_quick_cancel'`**, and audit for any other cancel-recording action types while doing so. As written the backfill stamps nothing.
3. **Files-touched list (contradiction C):** **EXTENDED** to include `src/app/admin/bookings/page.tsx` (a §1.9 shared surface) and `src/app/admin/bookings/types.ts`. **Condition:** `cancelled_at` must be added to `BOOKING_SELECT` in the *same* change as `types.ts`, and verified at **runtime**, not by type-check — see §2 C-bis for why splitting them silently kills the feature.

**Orchestrator decisions (no Owner input needed):**
4. **Cron transport (contradiction F):** follow the repo's existing pattern — **`POST` + `X-Cron-Secret`**, matching `api/cron/booking-reminders/route.ts:49-61`. The plan's route sketch and three of its verification curls say `GET` + `Bearer`; correct those checkpoints at Phase F start.
5. **Migration idempotency (contradiction G):** add `IF NOT EXISTS` / guarded DDL. The plan's bare `ADD COLUMN` and unguarded CHECK drop/re-add would not survive a re-apply — unlike C-06's, whose idempotency is what made its version-vs-filename drift harmless.

---

## 2 — ⚠️ THE EIGHT CONTRADICTIONS (read before Phase A)

### #1 — The deleted-client guard is unreachable dead code, not a hazard
Plan Step 1 line 117 is `.select("*")`. PostgREST **never** embeds a relation unless named, so `beforeState.clients` is `undefined` **always**, and the guard at plan line 171 can never fire. The same `.select("*")` appears at `actions.ts:171-172` and `:380-381`.
**tsc cannot catch it:** `src/lib/supabase/admin.ts` calls `createClient(url, key)` with **no `Database` generic**, so the admin client is `SupabaseClient<any>` and `beforeState.clients?.deleted_at` compiles clean.
**Fix:** `.select("*, clients(deleted_at)")` plus a runtime assertion.

### #2 — The refusal copy points at something that does not exist
Plan line 173: *"This booking's client has been deleted. Restore the client first, then the booking."* C-06 ships **no un-delete affordance** — `deleteClient` only ever *sets* `deleted_at`; nothing clears it. Reword.

### C-bis — the same trap would SILENTLY DISABLE THE WHOLE FEATURE
`BOOKING_SELECT` / `BOOKING_DETAIL_SELECT` are consumed through unchecked `.returns<BookingRecord[]>()` / `.single<>()` casts. If `types.ts` gains `cancelled_at` but the select strings don't, `booking.cancelled_at` is `undefined` → `isRestoreWindowExpired` returns `true` (fail-closed) → **every** cancelled booking renders "the 28-day restore window has passed" and the Restore button never appears anywhere. tsc, lint and vitest all pass. **Runtime verification per role and per surface is mandatory.**

### A — no usable restore fixture (resolved by decision 1)
Zero bookings of any status have both a future appointment moment and a safe test identity. The only two future-dated rows are a real customer's (`34cb635d…`) and the row C-06's cleanup list asks the Owner to delete (`d8a61721…`).

### B — the backfill misses the only cancel path in the data (resolved by decision 2)
Both backfills stamp **0 of 2**. The JSON path is fine — `after_state` is the full 43-key row — but both cancelled bookings were cancelled via the quick action, which writes `booking_quick_cancel` (`actions.ts:417`), and backfill 2 selects only `booking_management_updated`. The two rows that *should* match are invisible; the two that the filter *can* match are already restored.

### D — a second identical `||` bug the plan does not authorise
`reporting.ts:438` is the plan's target ✅. **Line 1334** is byte-identical (`completedRevenue += amount(booking.amount_paid || booking.total_price)`) inside the AUDIT-2026-05-22 Q2-locked average-revenue helper. **Log only — do not widen scope.**

### E — the brief's revenue premise is false
Brief §2.6: *"In production today: 0 such rows visible."* Reality: **1** completed booking has `amount_paid = 0, total_price = 55`. The `??` fix will drop `completedRevenue` from **£110 → £55** on a 2-booking sample. Plan §0.7 already requires recording the delta; the Owner has been told.

### H — the new email template will be invisible in the admin catalogue
C-04a adds `booking_restored_client` + `renderBookingRestoredEmail` but does not register it in `templates-data.ts` (the 9-entry `/admin/emails` catalogue, a §1.9 shared surface). Not on any files list. Flagging only.

---

## 3 — ⛔ / ⏸ inventory

**No `⏸ STOP-AND-ASK` markers exist in the plan or brief.** One marked ⛔:

| # | Where | Asks for |
|---|---|---|
| 1 | plan `:820-825` (Phase F, before Step 10) | Apply the migration: 5 `email_delivery_events` columns + partial index + `bookings.cancelled_at` + 2 backfills + the CHECK drop/re-add. The `after_state` JSON shape must be shown first — **already done**, see §2 B. |
| — | plan `:872` | Not a separate gate; instructs surfacing the CHECK DDL inside ⛔ #1. |
| — | plan `:1358` | Contingent on §0.5(b) finding an enum. **It did not — will not fire.** |

**Protocol §1.2 HARD-STOPs the plan text does not mark:**
- **Cloudflare deploy / `* * * * *` cron-trigger activation** (Phase F Step 12) — the new cron is inert until deployed. ⚠️ **That deploy will also apply C-22's `RateLimiter` Durable Object migration** (C-22 progress §8.1) — the approval text must say so.
- **Data-mutating prod SQL** — §3.2 sweep step 12 (back-date `booking_date`) and 12b (back-date `cancelled_at` to 29 days, then reset to 5).
- **Real emails** — §3.2 steps 3, 10, 11 must use `*.example.test` fixtures only.
- **§1.3 backup precondition: already satisfied** at C-06 via option (b). Does not re-fire.

---

## 4 — Cadence (plan §7) and anchor drift

10 commits: A restore+guards · B state-machine guard · C no-show · D auto-promote · E hygiene tail · F migration+cron · G row-level restore · H undo toast · **9 (dead — enum migration will not fire)** · 10 verification. Prefix `feat(redesign): C-04a {phase}`.
*Plan §7:1619 mandates a `Co-Authored-By: Claude Opus 4.7` trailer that conflicts with the live repo convention — use the live convention.*

**Anchors re-verified at HEAD.** The only §1.9 shared surface C-06 actually moved is **`notifications.ts`**: `sendTrackedEmail` now **:275** (plan says 262, **+13**); `sendBookingCancellationEmails` now **:405** (plan says 385, **+20**). Also shifted: `[bookingId]/page.tsx` `interface NextAction` **:1157** (+10); `clients/[clientId]/page.tsx` `AUDIT_PHRASING` **:139** (+12) and `case "refunded"` **:342** (+24); `clients/page.tsx` `hasRefund` **:174** (+19), filter **:320-323** (+20) — and the plan's `refund_issued` list is **incomplete**, four more at :362, :758, :1140, :1303.
Unchanged and exact: `BookingRowActions.tsx` union :17-22 · `reports-helpers.ts` :28-34 · `reporting.ts` :438 · `wrangler.jsonc` crons :58 · `worker-entrypoint.ts` (single unconditional `fireBookingReminders`, no dispatch switch — the plan's premise holds).
`_helpers.ts` confirmed absent — Phase A creates it.

---

*C-04a pre-flight only. Implementation begins at Phase A.*
