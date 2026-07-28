# C-04a migration — what changes vs the live database

**Migration file:** `supabase/migrations/20260728073903_c04a_scheduled_emails.sql`
**Status:** ⛔ **WRITTEN, NOT APPLIED.** Applying it is a protocol §1 rule-2 HARD-STOP — orchestrator-only, after explicit Owner approval in chat.
**Constraint baseline capture:** `redesign/evidence/C-04a/delivery_status_check-BEFORE.sql`
**Captured / verified:** 2026-07-28, read-only SELECTs against production `twzutkfgqclqurvkmvqz`.

Plan source: `C-04a-cancellation-restore-plan.md` §1 Phase F **Step 10** + the schema-premise note beneath it.

---

## 0 — Read this first: one decision taken, one consequence to carry into the HARD-STOP

### (a) Booking `9d55ce2a` is EXCLUDED from both backfills — DECIDED 2026-07-28

As first written, backfill 2 stamped `cancelled_at` on exactly two rows, and one of them was **Badar's booking `9d55ce2a`** (`avonrk@hotmail.co.uk`), the real customer protocol §1.7 names as untouchable.

**Owner decision: exclude it.** Both backfills now carry

```sql
  and id <> '9d55ce2a-7a76-42ed-9166-a33fa66ee7fe'
```

so this migration cannot write to that row under any database state, on first apply or on any re-apply.

| Booking | Identity | Value written |
|---|---|---|
| `9d55ce2a-7a76-42ed-9166-a33fa66ee7fe` | **Badar — real customer (§1.7)** | **none — excluded** (would have been `2026-05-19 17:16:59.155691+00`) |
| `eaafbb1a-7f02-48ef-b954-fb961c06c564` | `audit.client.5…@example.test` — safe fixture | `cancelled_at = 2026-05-20 19:24:17.514045+00` |

**Nothing is lost by excluding it.** Both bookings are dated `2026-05-20`, so the S6 past-appointment guard already blocks restore regardless; and a ~70-day-old cancellation is S7-expired, which is the *same* outcome as leaving the column NULL (the guard fail-closes on an unknown cancellation moment). Because the outcome is identical either way, the tie breaks in favour of keeping §1.7 absolute rather than letting it become a per-row judgement call.

**Backfill 1 carries the same exclusion**, even though it matches **zero** rows today — neither cancelled booking has `customer_cancelled_at` (re-verified read-only 2026-07-28: 0 candidates with the exclusion, 0 without). Its predicate is state-dependent and the file is built to be re-applied safely: any future write of `customer_cancelled_at` on the protected row would pull it into scope on a later apply. Excluding it in both statements makes *"this migration never writes to `9d55ce2a`"* a property of the file itself rather than of a row count that happened to be zero on one day.

### (b) After this migration, restore is still not demonstrable on live data — F-1 is NOT resolved

Post-apply the coverage query returns **`stamped = 1 / unstamped = 1`**: `eaafbb1a` stamped, `9d55ce2a` deliberately left NULL.

**Both** cancelled bookings remain **S6-past** (appointment `2026-05-20`, already elapsed) and **S7-expired** (cancelled 69 and 68 days ago against a 28-day window) — re-verified read-only 2026-07-28. So **no production booking will show a Restore button after this migration applies**, and the unstamped row behaves exactly like the stamped one: both fail closed.

This does **not** resolve progress §0a **F-1**, and nobody should expect it to at the closeout sweep. The fixture question (Owner decision 1, route (a) vs (b)) is still open and still needs a future-dated fixture cancelled through a path that stamps a cancellation moment.

---

## 1 — Statement-by-statement

Six statement groups, in file order. **Every one is idempotent** — see §2.

### 1. `email_delivery_events` — five nullable columns

```sql
alter table public.email_delivery_events add column if not exists scheduled_for timestamptz;
alter table public.email_delivery_events add column if not exists html_payload text;
alter table public.email_delivery_events add column if not exists text_payload text;
alter table public.email_delivery_events add column if not exists to_email text;
alter table public.email_delivery_events add column if not exists subject text;
```

Purely additive, all nullable. Verified absent before writing (`information_schema.columns` → `(none)` for all five).

`scheduled_for IS NULL` means "immediate send" — that is all 42 existing rows, so legacy semantics are preserved byte for byte. The other four columns hold the rendered payload so the cron can dispatch without re-rendering the template; only rows written by `sendTrackedEmail`'s new `delaySeconds` branch populate them.

Five `comment on column` statements accompany them. The plan writes comments for two columns; the file carries all five so the schema is self-describing (comments are inert metadata).

### 2. Partial index

```sql
create index if not exists idx_email_delivery_events_scheduled_pending
  on public.email_delivery_events (scheduled_for)
  where scheduled_for is not null and delivery_status = 'queued';
```

Matches the cron's candidate query exactly (`delivery_status = 'queued'` + `scheduled_for <= now()` ordered by `scheduled_for`). The partial predicate means the index only ever holds *undelivered queued* rows — a handful — no matter how large the table grows, and every successful send drops its row straight back out of it.

Verified absent (`pg_indexes` → 0). Not `CONCURRENTLY`, so it is transaction-safe inside the `begin;…commit;` wrapper; the table is 42 rows, so the exclusive lock is momentary.

### 3. `delivery_status` CHECK — drop + re-add

```sql
alter table public.email_delivery_events
  drop constraint if exists email_delivery_events_delivery_status_check;

alter table public.email_delivery_events
  add constraint email_delivery_events_delivery_status_check
  check (delivery_status in (
    'accepted', 'failed', 'skipped',
    'queued', 'sent', 'cancelled_by_restore', 'cancelled_manual'
  ));
```

**Live definition, captured verbatim** (`pg_get_constraintdef`, in the evidence file):

```
CHECK ((delivery_status = ANY (ARRAY['accepted'::text, 'failed'::text, 'skipped'::text])))
```

Without this statement **every queue insert fails at runtime** — the whole delayed-email feature is dead on arrival. The four added values and who writes them:

| Value | Writer |
|---|---|
| `queued` | `sendTrackedEmail`'s `delaySeconds` branch (Step 11) |
| `sent` | the scheduled-emails cron on a successful dispatch (Step 12) |
| `cancelled_by_restore` | `restoreBooking` killing a queued cancellation email (Step 1, already shipped in Phase A) |
| `cancelled_manual` | the rollback drain in plan §5.2 |

The constraint is **widened, never narrowed** — the three original values are all retained, so the re-add cannot reject an existing row. Live data is `'accepted'` only (42 rows), so validation is instant.

`IN (…)` vs the captured `= ANY (ARRAY[…])` is the same predicate; Postgres will normalise the stored definition. That matters for the rollback: restore from the captured file, not from a re-read of the post-migration definition.

### 4. `bookings.cancelled_at`

```sql
alter table public.bookings add column if not exists cancelled_at timestamptz;
```

Verified absent. The S7 28-day restore window is keyed to the *cancellation* moment, and admin cancels stamp nothing on the booking row today — `customer_cancelled_at` is written only by the customer-facing `/booking/manage` path (`booking/manage/actions.ts:143-144`).

**Side effect worth knowing:** C-06's `deleteClient` cascade (`clients/actions.ts:599-609`) *already* writes `cancelled_at`, behind a missing-column fallback that silently retries without it. The moment this column exists that fallback stops firing and the cascade starts stamping for real — no code change needed, and C-06's delete path immediately becomes S7-correct.

Phase A's `restoreBooking` clears the column behind the same kind of probe (`actions.ts:812-817`), so restore stays correct on both sides of this migration.

### 5. Backfill 1 — customer-cancelled rows

```sql
update public.bookings
set cancelled_at = customer_cancelled_at
where status = 'cancelled'
  and customer_cancelled_at is not null
  and cancelled_at is null
  -- Protocol §1.7 DO-NOT-TOUCH (see statement 6).
  and id <> '9d55ce2a-7a76-42ed-9166-a33fa66ee7fe';
```

**Stamps 0 rows today.** Neither live cancelled booking has `customer_cancelled_at` — no customer has ever cancelled through the manage link.

`and cancelled_at is null` is **added beyond the plan's text** (Owner/orchestrator decision 5, idempotency). Without it a re-apply would overwrite a *fresher* `cancelled_at` with a stale `customer_cancelled_at`. With it, statements 5 and 6 also compose cleanly: 5 wins where both could stamp, which is right — the customer's own timestamp is more precise than an audit row's.

The `id <> …` exclusion is the §1.7 DO-NOT-TOUCH guard from §0(a), carried here as well as in statement 6. It changes nothing today (0 rows either way) and is here so a future re-apply cannot reach the protected row if `customer_cancelled_at` is ever written on it.

### 6. Backfill 2 — from the latest cancel audit row

```sql
update public.bookings b
set cancelled_at = a.latest
from (
  select target_id::uuid as booking_id, max(created_at) as latest
  from public.audit_logs
  where action_type in (
      'booking_management_updated',
      'booking_quick_cancel',
      'customer_booking_cancelled'
    )
    and after_state->>'status' = 'cancelled'
  group by target_id
) a
where b.id = a.booking_id
  and b.status = 'cancelled'
  and b.cancelled_at is null
  -- Protocol §1.7 DO-NOT-TOUCH - Badar's real booking; rationale in the block above.
  and b.id <> '9d55ce2a-7a76-42ed-9166-a33fa66ee7fe';
```

**This is the Owner-decision-2 correction.** The plan's original filter is `action_type = 'booking_management_updated'` alone, which stamps **0 of 2** live cancelled bookings — both were cancelled through the *quick action*, which writes `booking_quick_cancel` (`actions.ts:689`).

**The action-type audit decision 2 asked for** — every action type in the codebase that can record a booking landing in `cancelled`, with what each stamps today (counts from read-only production SELECTs, 2026-07-28):

| `action_type` | Written by | Rows with `after_state.status='cancelled'` | Bookings it stamps |
|---|---|---|---|
| `booking_management_updated` | Status form (`actions.ts:414`) | 2 (2 distinct targets) | **0** — both targets have since left `cancelled`, so the `b.status = 'cancelled'` join drops them |
| `booking_quick_cancel` | cancel quick action (`actions.ts:689`) | 2 (2 distinct targets) | **1** — 2 candidates, minus `9d55ce2a` excluded per §0(a) |
| `customer_booking_cancelled` | `/booking/manage` (`manage/actions.ts:158-167`) | 0 | **0** — none exist yet; included belt-and-braces, since backfill 1 already owns that population |
| `client_deleted` | C-06 delete cascade (`clients/actions.ts:659`) | 0 | **0, and structurally unreachable** — `target_id` is the *client* id; the booking ids live in `after_state.cascaded_booking_ids`. No such rows exist, and per statement 4 the cascade stamps `cancelled_at` directly once the column is there, so no backfill is owed |

**Combined coverage: 1 of the 2 live cancelled bookings** (0 from backfill 1, 1 from backfill 2). The second, `9d55ce2a`, is left unstamped **on purpose** — §0(a) — and fail-closes to the same refusal a stamped-but-expired value would produce.

Two premises re-verified rather than assumed:
- `after_state` is the full booking row, so `after_state->>'status'` is the post-write status (progress §2 B).
- `audit_logs.target_id` is **already a `uuid` column** (`information_schema` → `uuid`), so `target_id::uuid` is a no-op cast, kept only for parity with the plan's text. There is no text→uuid parse that could throw.

The subquery + join was **dry-run as a SELECT** against production (minus the not-yet-existing `cancelled_at is null` predicate). Without the exclusion it returns the two rows in §0(a); **re-run with the exclusion on 2026-07-28 it returns exactly one row, `eaafbb1a`** — the projected stamp count for this statement.

Rows neither backfill reaches stay NULL → the S7 guard treats them as window-expired (fail-closed, brief §5.12). Today that is exactly one row, `9d55ce2a`, and it is deliberate — its cancellation is 69 days old, so the guard refuses restore on it either way.

---

## 2 — Why every statement is idempotent (decision 5)

Re-applying the whole file is a no-op. C-06's migration was idempotent, and that is what made its version-vs-filename drift harmless; this one matches.

| # | Statement | What makes a second apply safe |
|---|---|---|
| 1 | 5 × `add column` | `if not exists` on each |
| 1 | 5 × `comment on column` | Comments are set, not appended — re-running writes the same string |
| 2 | `create index` | `if not exists` |
| 3 | CHECK drop + re-add | `drop constraint **if exists**` runs unconditionally *before* the add, so the pair is idempotent even though `add constraint` has no `if not exists`. Second apply: drop removes the new constraint, add re-creates the identical one |
| 4 | `add column` + comment | `if not exists` |
| 5 | Backfill 1 | `and cancelled_at is null` — added for exactly this reason; cannot clobber a post-migration value |
| 6 | Backfill 2 | `and b.cancelled_at is null` (in the plan already) — same protection |

Both backfills additionally carry `id <> '9d55ce2a-…'` (§0(a)), so no apply — first or Nth, under any future data state — can write to the §1.7 protected row.

The whole file is wrapped in `begin; … commit;`, matching C-06's precedent: a mid-file failure leaves the database untouched rather than half-migrated.

---

## 3 — Post-apply verification (plan Step 10, for the orchestrator to run)

```sql
-- 1. Five columns present — expect 5 rows.
SELECT column_name FROM information_schema.columns
WHERE table_name = 'email_delivery_events'
  AND column_name IN ('scheduled_for','html_payload','text_payload','to_email','subject');

-- 2. Index present — expect 1 row.
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_email_delivery_events_scheduled_pending';

-- 3. CHECK extended — expect the 7-value list.
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.email_delivery_events'::regclass
  AND conname = 'email_delivery_events_delivery_status_check';

-- 4. Backfill coverage — report BOTH numbers to the Owner.
SELECT COUNT(*) FILTER (WHERE cancelled_at IS NOT NULL) AS stamped,
       COUNT(*) FILTER (WHERE cancelled_at IS NULL)     AS unstamped_will_be_unrestorable
FROM bookings WHERE status = 'cancelled';
-- Predicted: stamped = 1 (eaafbb1a), unstamped = 1 (9d55ce2a, excluded per §0(a)).
-- The unstamped row is EXPECTED, not a backfill miss — see §0(b).
```

Then `mcp__supabase__generate_typescript_types` → `src/types/supabase.ts` (plan Step 10; not done here — the types cannot describe columns that do not exist yet).

---

## 4 — Rollback

Plan §5.2, unchanged, plus the constraint restore:

```sql
-- Precondition: no queued rows depending on the columns.
SELECT COUNT(*) FROM email_delivery_events WHERE delivery_status = 'queued';   -- expect 0
SELECT DISTINCT delivery_status FROM email_delivery_events;
-- must be only accepted/failed/skipped, or the CHECK re-add below fails

DROP INDEX IF EXISTS idx_email_delivery_events_scheduled_pending;
ALTER TABLE email_delivery_events
  DROP COLUMN IF EXISTS scheduled_for,
  DROP COLUMN IF EXISTS html_payload,
  DROP COLUMN IF EXISTS text_payload,
  DROP COLUMN IF EXISTS to_email,
  DROP COLUMN IF EXISTS subject;

-- Exact restore, from delivery_status_check-BEFORE.sql — not reconstructed.
ALTER TABLE email_delivery_events
  DROP CONSTRAINT IF EXISTS email_delivery_events_delivery_status_check;
ALTER TABLE email_delivery_events
  ADD CONSTRAINT email_delivery_events_delivery_status_check
  CHECK ((delivery_status = ANY (ARRAY['accepted'::text, 'failed'::text, 'skipped'::text])));

-- Revert the S7 code first, or the guard reads a missing column.
ALTER TABLE bookings DROP COLUMN IF EXISTS cancelled_at;
```

Dropping `bookings.cancelled_at` loses admin-cancel timestamps recorded since the migration; `customer_cancelled_at` is untouched, so customer timestamps survive. The single backfilled value (`eaafbb1a`) is recoverable from the audit log by re-running statement 6.
