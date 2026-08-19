# ⛔ Migration drift — the repo cannot rebuild this database

**Measured 2026-08-17 against the live project** (`twzutkfgqclqurvkmvqz`) via read-only
`list_migrations`. **F8** in `redesign/plans/PRODUCTION-FIXES-2026-08-17-plan.md`.

Production has **72** applied migrations. This directory has **66** files.

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

## 2 — Migrations here that were never applied to production

**There are TWO. One is an open question; the other is deliberate and scheduled.**

### 2.1 — `20260502183000_restore_api_role_grants.sql` — ⛔ undecided

Exists in this directory and does **not** appear in production's applied list. Either it was
superseded and should be deleted with a note, or it was missed and should be applied.
**Someone has to decide which.**

### 2.2 — `20260819160000_fix_booking_future_check_dst.sql` — ✅ deliberate, not yet applied

Written 2026-08-19. ⛔ **This is NOT drift — do not "reconcile" it, and do not flag it as an
eighth/ninth gap in a future census.** It is queued to ship **with Phase 12**, by the Owner's
explicit decision on 2026-08-19.

It changes exactly one line of `create_booking_request`, fixing a guard that is one hour wrong
throughout British Summer Time. Full reasoning is in the file's own header and in
`redesign/plans/PRODUCTION-FIXES-2026-08-17-plan.md` §17.5 row A.

⛔ **Applying it needs the Owner's per-action approval, like every DB write here.** It carries an
md5 pre-condition (`8e455336428b4376fdffb7744eb8ae9c`) so it aborts untouched if the live body has
drifted since. **Rename it to the version production records once applied**, per §4 rule 1.

⚠️ Applying it also **closes the §6 fidelity gap**: the live body would become byte-identical to the
repo file again, rather than merely equivalent.

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
2. Decide `restore_api_role_grants`: apply it, or delete it and record why here.
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
