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

## 2 — One migration here was never applied to production

`20260502183000_restore_api_role_grants.sql` exists in this directory and does **not** appear in
production's applied list. Either it was superseded and should be deleted with a note, or it was
missed and should be applied. **Someone has to decide which.**

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
