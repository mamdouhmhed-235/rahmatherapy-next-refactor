# C-04a — Cancellation restore + delayed-email infra — PROGRESS

**Plan:** `redesign/plans/C-phase/C-04a-cancellation-restore-plan.md`
**Brief:** `redesign/briefs/C-04a-cancellation-restore-brief.md`
**Programme:** Band C, C-C implementation — plan **#4 of 22** (§4 order).
**Predecessor closed at:** `e0d4b19` (C-06)

> ## ⏸ STATUS: PRE-FLIGHT COMPLETE + OWNER DECISIONS TAKEN. No implementation yet.
> **Next action:** Phase A (Step 1 `restoreBooking` + guards). Everything below is settled — do not re-litigate it.
> **The drift checkpoint for plans #1–#5 falls due after this plan** (protocol §2.6).

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
