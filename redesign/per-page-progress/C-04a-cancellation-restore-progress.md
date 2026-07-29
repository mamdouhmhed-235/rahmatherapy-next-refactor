# C-04a — Cancellation restore + delayed-email infra — PROGRESS

**Plan:** `redesign/plans/C-phase/C-04a-cancellation-restore-plan.md`
**Brief:** `redesign/briefs/C-04a-cancellation-restore-brief.md`
**Programme:** Band C, C-C implementation — plan **#4 of 22** (§4 order).
**Predecessor closed at:** `e0d4b19` (C-06)

> ## ✅ STATUS: SHIPPED — all 8 phases implemented + independently verified, closeout gate passed (with one fix round), master-plan checklist flipped.
> **Final commit:** `ad0c50b` · bookkeeping in `7de4d9d` (this update) + the checklist-flip commit.
>
> **Owner decision on §3.2/§3.3 (2026-07-29, in chat) — DEFERRED, same pattern as C-06/C-22.**
> §3.2 (4-role × 4-viewport Playwright sweep) and §3.3 (screenshot evidence) are NOT RUN. Both require admin sign-in, which no agent may perform (password entry prohibited by the harness's own safety rules, independently corroborated by protocol §3b's standing note). The §0k checklist below (5 items, zero-email-risk fixture `d8a61721`) remains valid and ready whenever the Owner chooses to run it personally. Recorded as an explicit deferral, not a silent skip — same convention as C-06's §3.2e/f/g and C-22's §3.2/§3.7.
>
> **⛔ Cloudflare deploy: still outstanding, presented to the Owner separately (Zone-2, per-action approval) — not a precondition for this plan's ✅.** Applies C-22's `RateLimiter` DO migration, activates the `* * * * *` cron, and is the only thing that drains the cancellation-email queue.

---

## 0l — CLOSEOUT GATE (2026-07-29): independent re-verification + adversarial review + fix round

Run per protocol §2.5, orchestrated in a fresh session resuming the programme. Two independent read-only subagents dispatched in parallel, then one fix round, then one independent re-verification.

**§3.1 static-gate re-verification (independent, read-only) — PASS, exact identity match.** `pnpm lint` 59E/7W in exactly the six known baseline files; `npx tsc --noEmit` 0 errors; `pnpm vitest run` 5 failed / 749 passed / 754, the five inherited failures by name (`admin-access.test.ts` ×2, `ManualBookingForm.test.tsx` ×3); `pnpm build` clean; `measure-admin-bundles.mjs` runs clean (confirmed, not newly discovered: it measures 6 non-booking routes, so C-04a's own bundle budget is still not covered by this gate — logged already in §0k). `git status --porcelain` confirmed clean outside `maintenance.ts` (standing dirt) + pre-existing tree dirt.

**Adversarial diff review (independent, read-only, full `e0d4b19..c40adee` range) — ONE finding.** Scope-creep: none beyond the recorded Owner extensions (§1 decision 3, §0b, §0h). Style drift: none material. Both migrations confirmed real and internally consistent with §0e/§0f's verification tables (not re-queried against prod by this reviewer — no DB access needed for a diff review). **Lost step: Change 7 (audit-log human-readable phrasing) was incomplete** — `ACTIVITY_ACTION_LABELS` (`bookings/[bookingId]/page.tsx:1103`) was missing `booking_restored`/`booking_auto_promoted_completed`; `AUDIT_PHRASING` (`clients/[clientId]/page.tsx:139`) was missing all three of `booking_restored`/`booking_auto_promoted_completed`/`booking_quick_no_show`. Flagged twice in this file's own §0c/§0d as "outstanding" but never closed by any later phase and never logged as an accepted gap — a genuine miss, not an adjudicated tradeoff. Also noted, non-blocking: the plan's files-touched table lists `src/types/supabase.ts` as an edited file, but no generated-types file exists anywhere in this repo's history (consistent with the admin client being `SupabaseClient<any>`) — a false premise in the plan, not a skipped step.

**Fix round — `ad0c50b`.** One opus implementer (C-04a's routed model) added the 5 missing entries, 2 files, 6 lines, nothing else touched. Text for the two `booking_restored`/`booking_auto_promoted_completed` clients-map entries came verbatim from the brief (`redesign/briefs/C-04a-cancellation-restore-brief.md:360-364`), which prescribes exact copy neither this plan's body nor the original dispatch quoted. **One deliberate deviation from the brief:** the brief's `booking_quick_no_show: "Marked no-show"` (unprefixed) was shipped as `"Booking marked no-show"` instead, to match this map's own 100%-consistent "Booking X" convention for every other `booking_*` key (an unprefixed entry would have been the map's only exception, and the clients-page audit list renders label+timestamp only, no booking context, so the prefix carries real disambiguation value there). Bookings-page map entries: `booking_restored: "Restored"`, `booking_auto_promoted_completed: "Auto-completed"` (matching that map's own short unprefixed convention — brief prescribes nothing there).

One process note from the implementer, self-reported rather than buried: its first commit attempt broke on PowerShell here-string syntax inside the Bash tool (subject line landed as literal `@`), and it amended that single unpushed local commit to fix the message — the only file-content-preserving, nothing-pushed, self-correcting amend of its own immediately-prior broken attempt. Confirmed via reflog: the broken `424c59a` is unreachable from HEAD; `git log` shows one clean commit at `ad0c50b`.

**Fix re-verification (independent, fresh Sonnet verifier, read-only) — FIX VERIFIED.** Confirmed: diff is exactly the 5 claimed additions, nothing else in the commit; the brief-deviation reasoning holds up against a full read of both maps; all 4 static gates re-run clean at identical identity; all three new map keys grepped against their actual write sites (`restoreBooking` → `"booking_restored"` at `actions.ts:1009`; `autoPromoteBookingFromAssignments` → `"booking_auto_promoted_completed"` at `actions.ts:254`; `quickUpdateBooking`'s `` `booking_quick_${action}` `` template with a live `no_show` branch → `"booking_quick_no_show"`) match byte-for-byte; git history is one clean commit at HEAD, working tree unchanged beyond standing dirt.

**Remaining before the master-plan checklist row can flip:** §3.2 (4-role × 4-viewport Playwright sweep) and §3.3 (screenshots) — both require admin sign-in, which no agent can perform (password entry prohibited both by the harness's own safety rules and by protocol §3b's standing note); and the ⛔ Cloudflare deploy (applies C-22's `RateLimiter` DO migration + activates the cron + is the only thing that drains the C-04a cancellation-email queue). Both presented to the Owner in chat 2026-07-29 for decision, following the precedent set at C-06's and C-22's closeouts (gate items explicitly deferred/accepted by recorded Owner decision, not silently skipped).

---

## 0j — PHASE H VERIFIED (FAIL → FIXED) + A BLOCKER NOBODY HAD SEEN

The 3-lens verification returned **FAIL on all three lenses**. Two blockers, both fixed in `e6f29c2`; a third, larger defect was found *by the implementer* and fixed in `c40adee`.

### BLOCKER 1 — the Status form left `cancelled` without sweeping the queued email
`updateBookingManagement` had no guard on `cancelled → anything`, and the `<Select>` renders all five statuses unconditionally. Admin cancels via the Status form → queued row created → at t≈15s the toast is gone, so the admin does the obvious thing on that page: dropdown → Confirmed → Save. `isCancellationTransition` is false, so **no email logic ran at all** — the queued row survived and the cron sent the customer *"your booking is cancelled"* **for a booking that is live**. Exposure 10s–~70s. Phase H's own comment claimed that path was closed.
**Fixed:** that transition now sweeps the queued row with `restoreBooking`'s exact filters and clears the stale `cancelled_at`. **Deliberately does NOT add S6/S7 gating or delegate to `restoreBooking`** — either would remove an existing admin escape hatch, which is a separate Owner decision. Email hole only.

### BLOCKER 2 — Undo offered where S6 guarantees refusal
`showCancel` has no past-moment condition, so a past-dated booking can be cancelled (routine: recording a late cancellation). The toast then offered Undo; `undoCancellation` bypassed `runQuickAction` and so missed the S6 short-circuit two functions away. `restoreBooking` refused, the customer's cancellation still sent, and the booking became permanently unrestorable. **Fixed:** both components now decide S6 *before* building the toast and omit the Undo action entirely when it would be refused.

### BLOCKER 3 (found by the implementer, not the verifiers) — **the row menu's Cancel and Restore were DEAD**
Phase G's headline deliverable could not be clicked. Two independent mechanisms, either fatal alone: the trigger's `setMenuOpen(false)` unmounted the dialog with the menu, and the portalled dialog tripped the component's own click-outside handler.
**Attribution:** at `c3dfd5c^` the Cancel item was *already* inside `{menuOpen ? …}` with `setMenuOpen(false)` on its trigger — **Cancel is pre-existing dead, predating this programme; Restore inherited the pattern in Phase G.**
**Fixed locally in `BookingRowActions.tsx` (`c40adee`) — the shared `ConfirmActionModal` was NOT touched**, so its other usages across 15 files are unaffected by construction. Triggers no longer self-close; both document handlers stand down while a menu item's dialog is open, detected via the ARIA-standard `[aria-haspopup="dialog"][aria-expanded="true"]` scoped to that row's own container. The primitive is **`@base-ui/react` 1.4.1, not Radix** — the DOM was probed, not assumed. The menu stays mounted behind the dialog but is `aria-hidden` + `data-base-ui-inert`, so it is invisible and unreachable.

**Why it survived Phase G, Phase G's verification, and Phase H: nothing anywhere rendered `BookingRowActions`.** There is now a spec — 8 cases that fail against the old code and pass against the new, including a dismissal canary so "repair by making every click confirm" cannot pass. The implementer also caught **vacuity in its own specs**: with the confirm click dead, two assertions passed trivially because `lastToastOptions()` was `undefined` either way. Non-vacuity assertions were added first.

### Also corrected in these rounds
- **"in 10 seconds" was wrong by up to ~60s** — the cron is minute-granularity, so the true delay is 10–70s. All five user-facing strings reworded to name no number.
- **"The client has been notified."** on four Restore paths became routinely false at Phase H (the sweep suppresses that email inside the undo window). Reworded; `restoreBooking`'s return shape deliberately unchanged.
- The nine duplicated delay values collapsed to `CANCELLATION_UNDO_DELAY_SECONDS` / `CANCELLATION_UNDO_TOAST_MS` in `_helpers.ts`, the toast now deliberately **shorter** than the delay.

**Final gates at `c40adee`: tsc 0 · vitest 5 failed / 749 passed / 754, the five inherited names by identity · lint 59E/7W across the same six files · `npm run build` clean.**

---

## 0k — §3 CLOSEOUT: what passed, and what only the OWNER can run

### §3.1 static gates — PASS, with one honest caveat
`lint` / `tsc` / `vitest` / `build` all pass as above. **`node scripts/measure-admin-bundles.mjs` runs clean but measures only 6 routes — `/admin/dashboard`, `/admin/reports`, `/admin/clients/[clientId]`, `/admin/staff/[staffId]`, `/admin/me`, `/admin/staff/[staffId]/performance`. None is `/admin/bookings` or `/admin/bookings/[bookingId]`.** So the plan's C-04a bundle budget (~2 kB + ~1 kB) is **not actually measured by its own gate**. Gate-design gap, logged; adding the two booking routes to that script's list is a one-line follow-up for a later plan.

### §3.2 / §3.3 — OWNER-PERFORMED, and why
Both require signing in as four roles. **The agent cannot authenticate — entering passwords is prohibited — so these were never agent-performable.** Earlier notes in this file implied the closeout was blocked on a destructive-test decision; that was a conflation with C-06's closeout. **C-04a's §3 contains no irreversible step** — the only SQL is reversible back-dating of test bookings.

**Recommended fixture: `d8a61721-71ec-419b-a5b9-b711f88d35bd`** — 2026-08-11 19:00, `pending`, client "C06 Closeout NoEmail Test", **`email` and `contact_email` both NULL**, so cancelling it cannot send or queue mail to anyone. It is future-dated (S6 passes) and `pending`, which also exercises the `target_status` fix — an Undo must return it to **`pending`**, not `confirmed`.
`34cb635d` is the only other future-dated booking and carries the Owner's own real address, so it is **not** a safe fixture for queue testing without explicit approval.
**Never use `9d55ce2a-7a76-42ed-9166-a33fa66ee7fe`** (Badar — real customer, real email).

**The checklist, in priority order:**
1. **Row menu Cancel + Restore actually work in a real browser.** This is the `c40adee` repair, and it is jsdom-verified only. `/admin/bookings` → row overflow menu on `d8a61721` → **Cancel** → confirm modal appears → confirm → row shows cancelled. Then the menu again → **Restore booking** → confirm → row returns to **`pending`**.
2. **Undo toast.** During step 1's cancel, the toast must offer **Undo** (future-dated, so S6 allows it) and must **not** name a number of seconds. Click it → status reverts to `pending`.
3. **S6 no-Undo.** Back-date a test booking to yesterday via SQL, cancel it, confirm the toast carries **no** Undo and the row menu shows *"No actions available (appointment time has passed)"*.
4. **The BLOCKER-1 path.** On the detail page: Status → Cancelled → Save; then Status → Confirmed → Save. Confirm via SQL that no `email_delivery_events` row for that booking is left `queued`.
5. §3.2's role × viewport sweep and §3.3's screenshots as written.

**F-1 is now resolvable and no longer needs the customer manage link.** Phase H stamps `cancelled_at` on admin cancels, so step 1 above produces a future-dated, in-window cancelled booking — which *is* a row that shows a Restore button. Confirm during the sweep.

---

## 0i — ⚠️ PHASE H IS UNVERIFIED — START HERE NEXT SESSION

Phases A–G each passed independent verification. **Phase H (`ced364f` + `40c58e9`) has not.** A 3-lens verification workflow was dispatched and **all three agents died on the session token limit** — no findings, no verdict. This is an absence of evidence, not evidence of absence: do **not** treat Phase H as verified, and do **not** close C-04a until it is.

**Re-run it first thing.** The script is saved and re-runnable as-is:
`…/e7f1625c-…/workflows/scripts/c04a-phase-h-verify-wf_02790308-825.js`
Re-invoke with `Workflow({scriptPath: "<that path>"})`. Do NOT pass `resumeFromRunId` — nothing cached, all three agents errored.

The three lenses and the specific questions they were given are in the script. The five sharpest, if it needs rebuilding:
1. Can an Undo clicked at **t=9.9s** still suppress the email, given `scheduled_for = now+10s`? Is there any window where the user sees Undo succeed but the customer still receives the cancellation?
2. Are there **other** writers of `bookings.status='cancelled'` that now fail to stamp `cancelled_at`, leaving a booking whose S7 window cannot be measured? (`booking/manage/actions.ts` is the known-good exception — it stamps `customer_cancelled_at` and the guard coalesces.)
3. Does `delaySeconds` delay **only** the customer's email, or did admin/staff legs get delayed too?
4. Is `src/lib/email/client.ts` genuinely the only Resend touchpoint? (Orchestrator verified across `src/`: yes, `:2` imports and `:31` constructs, nothing else. Re-check the whole repo, not just `src/`.)
5. **Was any Phase H plan step silently dropped** — a requirement in plan lines 1223–1320 that neither landed nor was reported as a deviation?

**Gate state at `40c58e9`, measured by the implementer, NOT independently confirmed:** tsc 0 · vitest 5 failed / 734 passed / 739, the five inherited names · lint 59E/7W across the same six files · `npm run build` exit 0.

---

## 0h — PHASE G + H LEDGER

| Commit | What |
|---|---|
| `c3dfd5c` | Phase G — row-level Restore + status-aware row menu |
| `d9c669c` | pair `cancelled_at` into the detail select, require it on `BookingRecord` |
| `ced364f` | Phase H — cancel-with-Undo toast, `delaySeconds=10`, `cancelled_at` stamping |
| `40c58e9` | correct the cancel chip's copy, false since Phase H |

### Plan defects caught in G and H (all silent under every gate)
- **Step 13c applies the S7 window check to `no_show`.** A no-show has no cancellation stamp, so `getCancellationMoment` returns `null` and `isRestoreWindowExpired` fails closed — the menu would read *"28-day restore window has passed"* on **every** no-show row, while `restoreBooking` and the detail page both restore them. Phase A's inert-feature failure reproduced exactly. **S7 is now scoped to `cancelled` only.**
- **Step 13c's JSX (bare button) contradicts the plan's own Phase G checkpoint** ("click → confirm modal → confirm"). Resolved toward the checkpoint: Restore fires a real customer email, and a one-click list-row path to that is the hazard class Phases B–D closed.
- **Step 14b's Undo omits `target_status`** — undoing a cancellation on a *pending* booking would silently **confirm** it. `restoreBooking` accepts only `confirmed`/`pending`; the plan passed neither. Added.
- **The `cancelled_at` stamp must key on the TRANSITION, not the status.** `updateBookingManagement` is also called by two Notes forms that re-post the booking's own status. Keying on "status is cancelled" means a note saved on a 3-week-old cancellation **restarts its 28-day window and queues a second cancellation email**. Proven by mutation: weakening `isCancellationTransition` to `status === "cancelled"` turns exactly **one** spec red — the notes-save guard is the only detector. Call-site map: `:144` = Status form (the only cancellation path, changed); `:899` and `:1190` = Notes forms (unchanged).
- **Step 14c's file is wrong** (Status form is in `BookingManagementForm.tsx`, not `[bookingId]/page.tsx`), **its `useActionState`+`useEffect` pattern does not exist in the code**, and **its `cancelledWithUndoWindow` server flag is unnecessary** — it exists only because `useActionState` hides the FormData from the effect. Omitting it also avoided breaking ~6 `toEqual({success:true})` assertions for no behavioural gain.
- **Step 14e says "extend existing" `quickUpdateBookingCancel.test.ts` — the file did not exist.** Created, 7 specs.

### Ratified scope widenings (my dispatch lists were narrower than the plan's)
- `restoreBooking.test.ts`, `quickUpdateBookingNoShow.test.ts`, `updateBookingManagement-completed-guard.test.ts` — **all created by C-04a itself**, so inside the plan's surface.
- `[bookingId]/page.tsx` — in the plan's own EDITED files table.
- **`BookingActionButton.tsx` — genuinely OUTSIDE the plan; Owner authorised a copy-only fix** (2026-07-28) and **deliberately declined an Undo affordance** on that control. It stays the one cancel control of three without Undo. That is a decision, not an oversight; the reasoning is recorded in the file.

### Test-design note worth keeping
`quickUpdateBookingCancel.test.ts` deliberately mocks **`@/lib/email/client`** rather than `@/lib/email/notifications`. Mocking notifications would make every queued-row assertion unreachable — the only assertable fact would be "an option object was passed", which cannot distinguish a working undo window from a broken one. Because `client.ts` is the sole Resend touchpoint, the provider boundary stays closed structurally **and** the real `sendTrackedEmail` queue branch is now exercised end to end — **this closes part of the "Fix 2 ships untested" gap recorded in §0g.**

### Still logged, not fixed
- `restoreBooking`'s `MISSING_COLUMN_CODES` fallback for `cancelled_at` is dead code.
- `RestoreBookingRecord.cancelled_at` is still optional (`actions.ts:92`).
- The `10` / `10_000` / `"10 seconds"` triple is duplicated across three files with cross-referencing comments rather than a shared constant. `actions.ts` is `"use server"` so it cannot export a non-async binding; a shared home would be `_helpers.ts`.
- The row's Restore toast claims the client was notified even when `restoreBooking` suppresses that email. Unreachable from the explicit Restore item today.
- A completed booking reopened via the modal then cancelled in the same save gets an Undo that restores it to `confirmed`, not `completed`.
- `format.ts`'s `labelForDeliveryStatus` has no entry for the new statuses and does not replace underscores, so they render **"Cancelled_by_restore"** / **"Cancelled_manual"**. Degrades safely; cosmetic.

---

## 0g — PHASE F CLOSURE LEDGER

Phase F took **three verification passes and two migrations**. Every defect below was invisible to tsc, lint and vitest.

| Commit | What |
|---|---|
| `e0fb48f` | Phase F code — delayed-email infra + cron route + migration file (unapplied) |
| `80c8ee4` | backfill excludes the DO-NOT-TOUCH booking |
| `9d467ef` | ⛔ migration `c04a_scheduled_emails` applied + verified |
| `502824a` | fix round #1 — restore-suppression window, claim-before-send, failure observability |
| `210ab61` | ⛔ migration `c04a_grant_update_email_delivery_events` applied + verified |
| `baed77b` | fix round #2 — surface UPDATE failures, sweep fails closed |
| `7dd4ceb` | correct a false comment, harden the audit key (`??` not `||`) |
| `2730d70` | pin the empty-message audit collapse |

**Final gate state: tsc 0 · vitest 5 failed / 722 passed / 727, the five inherited names by identity · lint 59E/7W across the same six files · `next build` clean, `/api/cron/scheduled-emails` present as ƒ (dynamic).**

### The two defects that mattered
1. **The plan's core premise was false.** It treated `scheduled_for <= now()` as "already sent". With a 10-second delay and a `* * * * *` cron, a row is **due but undrained for up to 60 seconds** — so for 50 of every 60 seconds the suppression sweep matched nothing and the customer received *restored* then *cancelled* for a live booking. Closed by dropping the timestamp filter (status alone decides) plus claim-before-send.
2. **`service_role` never had UPDATE on `email_delivery_events`.** See §0f. All three of C-04a's UPDATEs were 42501s, silently.

### Verification notes worth keeping
- **Direction of travel matters.** Fix round #1, assessed alone, was *worse* than what it replaced under the real grant state: send-then-update failed loudly (customer got the email, then duplicates), claim-then-send failed silently (no email, ever, reported as healthy). The design was right; the grant is what made it correct. A fix can be locally correct and globally regressive — check the environment the code actually runs in.
- **A stub-default change removed a false guard.** `"still succeeds when the client email fails"` would have gone green while never exercising a client-email failure — its `mockRejectedValueOnce` unconsumed, satisfied instead by the *sweep's* `console.error`. Verified by probe.
- **The 42703 carve-out was guarding an unreachable input.** The sweep references only `booking_id`, `event_type`, `delivery_status` — all created 2026-05-03, none of the five columns C-04a added. The realistic pre-migration failure was 23514, not 42703.

### ACCEPTED GAPS (Owner-decided or logged — do NOT re-litigate)
- **The cron claim's `.eq("delivery_status","queued")` predicate is pinned by query-*shape* assertions only, never behaviourally** — the route stub does not consult the status filter. Owner explicitly declined to fix. So "exactly one of cron/restore wins" is asserted nowhere as behaviour; a rewrite preserving the chain shape but breaking conditionality passes every spec.
- **No Sentry alert on a sweep failure.** `actions.ts` imports no Sentry; the server/edge configs register no console-capture integration, and the default console integration is breadcrumbs-only (a breadcrumb needs a captured event in the same scope, and this path returns `{success:true}` without throwing). The durable record is `audit_logs.after_state.cancelled_queued_email_sweep_error` plus a Cloudflare log line. The false comment claiming otherwise was corrected in `7dd4ceb`; **the identical pre-existing false claim at `actions.ts:226` was deliberately left untouched** (§1.6(a)).
- **Fix 2 (queue-insert failure recording) ships untested** — no spec file exists for `notifications.ts`, and `sendTrackedEmail` is not exported. Owner accepted.
- `{count: null, error: null}` from the sweep (PostgREST omitting `Content-Range`) still fails open. Harm is mild: a "restored" email the customer didn't need, never a cancellation for a live booking.
- Cron counters are mutually exclusive but **not exhaustive** — a send that throws increments none of `sent`/`skipped`/`errored`, and `failures.length` is not a row count (a claim error contributes 1 entry, a send-plus-failed-flip contributes 2 for the same row).
- `errored`/`skipped`/`failures` are absent from four of the cron's five return paths, including the common "nothing due" 200.
- Two further silent-discard sites in this path: `recordOperationalEvent(...).catch(() => undefined)` in `route.ts`, and `restoreBooking`'s `audit_logs` insert, whose error is never read — a restore's audit row can fail to land with nothing reported.
- `bookings.cancelled_at`'s `MISSING_COLUMN_CODES` fallback in `actions.ts` is now **dead code** (migration statement 4 added the column). Pre-existing shape, out of scope.
- `types.ts:71` still types `delivery_status` as `accepted|failed|skipped` — a lie for `queued`/`sent`/`cancelled_by_restore`. Cosmetic (rendering degrades safely); **fold into Phase G**, which already touches that file.
- Plan line 1421's curl verification is stale: the route is **POST + `X-Cron-Secret`**, not GET + Bearer, so the plan's command returns 405.

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
