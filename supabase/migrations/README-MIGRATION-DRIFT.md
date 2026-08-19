# ⛔ Migration drift — the repo cannot rebuild this database

**Measured 2026-08-17 against the live project** (`twzutkfgqclqurvkmvqz`) via read-only
`list_migrations`. **F8** in `redesign/plans/PRODUCTION-FIXES-2026-08-17-plan.md`.

Production has **72** applied migrations. This directory has **66** files.

> ⚠️ **UPDATED 2026-08-19.** Production now has **76** applied; this directory has **69** files.
> The gap is now **purely the 7 missing files in §1** — as of 2026-08-19 there are **NO unapplied
> migrations left in this directory** (§2). The four applied since are `20260819072517`,
> `20260819072756`, `20260819134224` and `20260819150206`; all four carry the version production
> recorded.

---

## 1 — Seven migrations exist in production with no file here

```
phase9_account_password_requests                    the account-password-requests TABLE
phase8_staff_avatars_bucket                         avatar storage bucket
phase18_storage_avatars_canonical_perm              its permissions
restore_phase8_service_role_read_grants             service-role grants
restore_phase8_service_role_permissions_read_grant  service-role grants
phase9_payload_text                                 payload column
add_override_availability_and_area_to_booking_rpc   a booking RPC change
```

⛔ **A fresh rebuild from this directory produces a broken database** — no password-requests table
and no avatar storage. That very likely explains why *"staff avatar photos unsupported (no
`avatar_url` column)"* has sat in `redesign/per-page-deferrals/` as an unexplained gap.

Verified absent under any filename: `ls supabase/migrations/ | grep -c "<name>"` returns **0** for
all seven.

## 2 — ✅ CLOSED 2026-08-19 — nothing in this directory is unapplied any more

**Both open items were resolved on 2026-08-19 with the Owner's explicit approval. Do not re-raise
either. A future census should find ZERO unapplied files here.**

### 2.1 — `20260502183000_restore_api_role_grants.sql` — ✅ DELETED, verified superseded

It granted `usage` on schema `public` and `select` on 14 tables to `service_role`. **Every one of
those grants already existed in production**, so applying it would have been a no-op. Measured
before deleting, two ways:

- `has_table_privilege('service_role', …, 'SELECT')` → **true for all 14**
- the stronger check — a **direct** `service_role=…r…` entry in each table's `relacl`, not merely
  inherited → **true for all 14**
- `has_schema_privilege('service_role','public','USAGE')` → **true**
  (control: `has_schema_privilege('anon','information_schema','CREATE')` → false, so the test does
  discriminate)

Almost certainly superseded by `restore_phase8_service_role_read_grants` (`20260502165759`) and
`restore_phase8_service_role_permissions_read_grant` (`20260502170527`), which ran in production
earlier the same afternoon — and which are themselves two of the 7 files missing from §1.

⛔ **Recoverable from git history** (last present in `46e7732`); nothing was rewritten. No code
referenced it — the only mentions were documentation about this very decision.

### 2.2 — `20260819134224_fix_booking_future_check_dst.sql` — ✅ APPLIED 2026-08-19

Owner approved and it is **live**. See §6.3.

## 3 — Most filenames disagree with production's recorded versions

Sampled 11; **9 differ**. This directory uses tidy timestamps, production recorded actual apply
times:

| Migration | This directory | Production |
|---|---|---|
| `c06_client_crud_hardening` | `20260727120000` | `20260727202424` |
| `c04a_scheduled_emails` | `20260728073903` | `20260728120408` |
| `c02_recurring_bookings` | `20260802122636` | `20260802131001` |
| `item8_phase2_remove_service_area_gate` | `20260811210000` | `20260811230807` |

Supabase keys on the **version**, so a fresh `supabase db push` treats these as unapplied and tries
to run them again on a database where they have already run.

⚠️ **`grant_manage_account_requests_to_owner_admin` looks like an eighth gap and is not** —
production recorded it with a doubled timestamp prefix. Same migration.

---

## 4 — ⛔ How to fix this. Do NOT hand-write the missing SQL.

The seven missing files must be recovered **from the database itself**, by tooling. Reconstructing
schema definitions by hand — or worse, by asking an agent to transcribe them — risks a subtly wrong
table that then diverges silently from production forever.

**Owner-side, requires CLI credentials this repo does not hold:**

```bash
supabase link --project-ref twzutkfgqclqurvkmvqz
supabase db pull            # writes the true remote state into supabase/migrations/
git status supabase/migrations/    # review EVERY generated file before committing
```

⛔ **Approval required before running this.** It touches the live project, and `db pull` can
generate a large diff.

**Then, three decisions that are not automatable:**

1. Keep the generated filenames (production's timestamps) — do **not** rename them to match the
   tidy local convention. The version is the identity.
2. ~~Decide `restore_api_role_grants`: apply it, or delete it and record why here.~~
   ✅ **DECIDED 2026-08-19: deleted, verified superseded. See §2.1.**
3. ⛔ **Do not rename the 66 existing files** to match production. Renaming changes nothing in the
   database and risks a future `db push` re-running them. The drift is recorded here instead.

**Verification afterwards:** `supabase db diff` should come back clean, or every remaining
difference should be explained in writing in this file.

---

## 5 — Why this file exists rather than seven guessed migrations

The alternative was to reconstruct the missing SQL from the live schema through an agent's context
window. That would have produced files that *look* right and are unverifiable — and this repo has
already been bitten repeatedly by findings that looked authoritative and were wrong (see gotchas
109-118). A recorded gap with a mechanical recovery path is worth more than seven plausible files.

---

## 6 — ⛔ APPLIED 2026-08-19 — two migrations, and an honest note about fidelity

Owner approved. Applied via the Supabase MCP with an md5 pre-condition on the
live function body, so a mismatch would have aborted before touching anything.

| Version applied | Name | Repo filename |
|---|---|---|
| `20260819072517` | `f10_restore_series_fn_grants` | **renamed to match** |
| `20260819072756` | `f1_f2_booking_capacity_and_window` | **renamed to match** |

✅ **These two do NOT add to the drift** — the repo filenames were renamed to the
versions production recorded, per §4's rule that the version is the identity.

### ⚠️ Fidelity: the repo file is equivalent, not byte-identical to what ran

`f1_f2` was applied as a **DO block that patches the live function source**, not
as the repo file's literal `CREATE OR REPLACE`. That was deliberate: it starts
from the guaranteed-correct live body and asserts its md5 first, rather than
re-transmitting 711 lines and risking a transcription error in a function that
takes customer bookings.

The consequence, stated plainly: **the repo file and the live function are
functionally equivalent but not byte-identical.** The inserted comment text is
abbreviated in the applied version. Measured:

```
live prosrc after apply : md5 8e455336428b4376fdffb7744eb8ae9c, length 20105
repo file body          : md5 9a10991d765979610c66a1615e73e97f, length 22410
pre-apply live body     : md5 6b5fb9de14dd01ffe978e72d3e818066, length 17715
```

The logic is identical — verified field by field after applying: F1 counters
present, D6 gated on `p_booking_source = 'website'`, D4 using `v_requested_at`,
D5 buffer applied at **4** sites, D12 status set, D13 lock keyed on date only,
and PUBLIC EXECUTE revoked (D8).

⛔ **Anyone rebuilding from the repo gets the fuller-commented version and the
same behaviour.** If byte-identity ever matters, `supabase db pull` after these
migrations is the authority, not the repo file.

### Rollback

Re-apply `20260811210000_item8_phase2_remove_service_area_gate.sql`, whose body
is byte-identical to the pre-apply live function (md5 `6b5fb9de…`, verified
before the change). The grant fixes should NOT be rolled back — they restore an
intended lock that a signature change silently dropped.

---

## 6.3 — ✅ APPLIED 2026-08-19 — the BST future-check fix

| Version applied | Name | Repo filename |
|---|---|---|
| `20260819134224` | `fix_booking_future_check_dst` | **renamed to match** |

Owner approved explicitly. One line of `create_booking_request` changed:

```sql
-  if v_requested_at < timezone('Europe/London', now()) then
+  if v_requested_at < now() then
```

The old form compared a `timestamptz` against a **naive** timestamp, which Postgres
coerced at the session TimeZone (UTC here), so throughout BST the "must be in the
future" threshold sat **one hour ahead** and any booking starting within the next
~60 minutes was refused. Full reasoning: `redesign/plans/PRODUCTION-FIXES-2026-08-17-plan.md` §18.

**Applied as an md5-guarded patch of the live source, not by re-transmitting the
file** (gotcha 126). Measured, with the whole thing predicted by a read-only dry
run *before* anything was written:

```
pre-apply  prosrc : md5 8e455336428b4376fdffb7744eb8ae9c, length 20105
predicted           md5 7bea3df6fdaf25bc8825c824b6b03967, length 20078
post-apply prosrc : md5 7bea3df6fdaf25bc8825c824b6b03967, length 20078   ✅ exact
bytes removed     : 27   (the 59-char guard line became 32 chars)
guard occurrences : 1    (asserted before replacing)
```

The migration carried **both** an md5 pre-condition and an md5 **post-condition**,
so any deviation would have aborted inside the transaction. Verified after:
`proacl` unchanged (`service_role` keeps EXECUTE — `CREATE OR REPLACE` does not
discard grants, gotcha 124), `prosecdef` still true, the old form **gone**, the new
form **present**, and ⛔ **`v_today` (line 9) and the `v_requested_at` assignment
(line 82) both deliberately UNTOUCHED** — those `timezone()` calls are correct and
"fixing" them would introduce a real bug.

Behaviour re-tested live across BST and GMT, past and future: **6 of 6 correct**.

### ⚠️ The §6 fidelity note still applies — it was NOT closed

An earlier draft of this file claimed applying the fix would make the live body
byte-identical to the repo file. **That was wrong, because the patch route was
chosen over re-transmitting the file.** The position is unchanged in kind:

```
live prosrc            : md5 7bea3df6fdaf25bc8825c824b6b03967, length 20078
repo file body         : md5 80375eefbe40bf20a60042568552cfee, length 22627
comments+whitespace stripped, BOTH sides: md5 adf3343a43187b8545bfc1164b01c868, 12668
```

⛔ **The repo file and the live function are logically IDENTICAL and textually
different** — the repo carries fuller comments. Proven, not asserted: strip comments
and whitespace and both hash `adf3343a…`. If byte-identity ever matters,
`supabase db pull` is the authority, not the repo file.

---

## 6.4 — ✅ APPLIED 2026-08-19 — the buffer midnight-wrap fix (A2)

| Version applied | Name | Repo filename |
|---|---|---|
| `20260819150206` | `fix_booking_buffer_midnight_wrap` | **renamed to match** |

Both padded-overlap predicates in `create_booking_request` did `time` arithmetic,
which **wraps**: `time '00:10' - interval '30 min'` → `23:40`. `OVERLAPS` then
normalises the inverted pair, so the padded window covered nearly the whole day and
**one late booking broke ordinary midday bookings for that date**.

Replaced with minutes-since-midnight comparison, mirroring `availability.ts:226`.

⛔ **The obvious `greatest`/`least` clamp does NOT fix this** — measured before
writing the migration: `least(time '23:59:59', (time '23:59' + interval '30 min'))`
returns `00:29`, because `least()` compares the already-wrapped value. The pair stays
inverted. Recorded so nobody "simplifies" it back.

Applied as an md5-guarded patch, predicted by a read-only dry run first:

```
pre-apply  prosrc : md5 7bea3df6fdaf25bc8825c824b6b03967, length 20078
predicted           md5 c0d74f2454bff1778e692e54a1817e80, length 20185
post-apply prosrc : md5 c0d74f2454bff1778e692e54a1817e80, length 20185   ✅ exact
overlaps predicates remaining: 0   (each of the two asserted to occur once first)
```

Verified after: ACL `{postgres=X, service_role=X}` — `anon` and `authenticated` both
`false`, `service_role` `true`; `SECURITY DEFINER`; `search_path = public, app_private`;
the `auth.role()` guard, the date-only advisory lock key, the unassigned-reservation
subtraction and its `ba.status`/`b.status` filters all intact.

✅ **This file's body matches the live function exactly** — both hash
`502292ac279dcfc393f392c84c770489` (12734 chars) with comments and whitespace
stripped, so §6's "logically identical, textually different" position continues to
hold and was independently re-derived rather than assumed.
