> SUPERSEDED by PLAN-account-and-data-reset-FINAL.md (2026-09-03). Kept for the
> reasoning trail only. v2 contains errors corrected in the FINAL version.

# PLAN v2 — delete every test account and all test data (APPROVED SCOPE)

**Status:** ⛔ **NOTHING DELETED YET.** Awaiting the Owner's final "go".
**Written** 2026-09-03 · live database `twzutkfgqclqurvkmvqz`

**Owner's decisions, recorded 2026-09-03:**
- **A1** — delete everything except `rahmatherapy@outlook.com`. All clients are test data.
- **B** — I execute the deletion.
- **C** — the Owner creates the two new accounts in Supabase; I write the guide.
- **D** — do not recreate the testing identities.
- **No safety-net export.**

---

## 1. Exactly what survives

| Survives | Why |
|---|---|
| `Minhaj rahman` / `rahmatherapy@outlook.com` — staff profile **and** login | The Owner |
| **All 318 `audit_logs`** | ⛔ Never deleted (G31). Their `actor_staff_id` becomes NULL for deleted staff — the rows stay, the authorship goes |
| 5 services, 7 global availability rules, 1 business_settings row, 5 roles, 40 permissions, 95 role-permissions | Configuration, not test data |

## 2. Exactly what goes

| Table | Rows | How |
|---|---|---|
| `enquiries` | 3 | explicit — they'd otherwise survive as orphans |
| `bookings` | 14 | explicit |
| ↳ `booking_participants`, `booking_items`, `booking_assignments` | 14/14/16 | **CASCADE** from bookings |
| ↳ `email_delivery_events` | **38 → 0** | **CASCADE** from bookings ⚠️ all 38 are tied to a booking |
| `clients` | 14 | explicit, after bookings |
| ↳ `client_notes`, `client_privacy_requests` | 2, 1 | **CASCADE** from clients |
| `operational_events` | 4 | explicit ⚠️ see §5 |
| `staff_profiles` | **11** | explicit — everyone except the Owner |
| ↳ `account_password_requests`, `notification_state`, `insight_dismissals` | 1, 1, 1 | **CASCADE** from staff |
| `auth.users` | **12** | explicit — the 11 above **plus one orphan** |
| ↳ `auth.identities`, `sessions`, `refresh_tokens`, `mfa_*`, `oauth_*`, `webauthn_*` | 13, 994, 1024, … | **CASCADE**, verified in `pg_constraint` |

⛔ **The orphan login:** `phase10.nonstaff@example.test` has **no staff profile**,
does not appear on the staff page, and signed in on 2026-09-03. It is invisible to
every UI and would survive a staff-only sweep.

---

## 3. The order, and why each step is where it is

```sql
BEGIN;

-- 1. enquiries FIRST. Their FKs to clients and bookings are ON DELETE SET NULL,
--    so deleting bookings/clients would leave 3 orphan enquiries behind, not
--    remove them.
DELETE FROM enquiries;

-- 2. bookings. Cascades to participants, items, assignments and all 38
--    email_delivery_events.
DELETE FROM bookings;

-- 3. clients. MUST follow bookings: bookings.client_id is NO ACTION, so this
--    would be refused while any booking still points at a client.
DELETE FROM clients;

-- 4. operational_events. Not reachable by cascade (booking_id is SET NULL and
--    all four already hold NULL), so they need naming.
DELETE FROM operational_events;

-- 5. staff_profiles — everyone EXCEPT the Owner, named by id, not by pattern.
DELETE FROM staff_profiles
WHERE id <> '01582c5d-bd75-4c49-b207-6f5597e15218';

-- 6. auth logins — the 11 above plus the orphan. Named by id.
DELETE FROM auth.users
WHERE id <> '21c0a691-99fe-47e7-b538-55817d4958c7';

COMMIT;
```

⛔ **Both survivor ids are hard-coded and both are `<>` exclusions**, so a typo
that fails to match deletes *nothing extra* — it would delete the Owner too, which
is why §6 verifies the Owner is present **before** committing.

⚠️ `recurring_booking_templates.client_id` is **RESTRICT** and would block step 3
— it has **0 rows**, so it will not. Confirmed today.

---

## 4. Verification, run inside the same transaction before COMMIT

```sql
SELECT
  (SELECT count(*) FROM staff_profiles)                      AS staff,          -- 1
  (SELECT count(*) FROM auth.users)                          AS logins,         -- 1
  (SELECT count(*) FROM clients)                             AS clients,        -- 0
  (SELECT count(*) FROM bookings)                            AS bookings,       -- 0
  (SELECT count(*) FROM booking_assignments)                 AS assignments,    -- 0
  (SELECT count(*) FROM enquiries)                           AS enquiries,      -- 0
  (SELECT count(*) FROM email_delivery_events)               AS emails,         -- 0
  (SELECT count(*) FROM operational_events)                  AS op_events,      -- 0
  (SELECT count(*) FROM audit_logs)                          AS audit_logs,     -- 318  ⛔ MUST NOT MOVE
  (SELECT count(*) FROM services)                            AS services,       -- 5
  (SELECT count(*) FROM roles)                               AS roles,          -- 5
  (SELECT email FROM staff_profiles LIMIT 1)                 AS survivor,       -- rahmatherapy@outlook.com
  (SELECT count(*) FROM staff_profiles WHERE auth_user_id IS NULL) AS orphaned;  -- 0
```

⛔ **If `audit_logs` is not 318, or `survivor` is not the Owner's email — ROLLBACK.**

---

## 5. ⛔ Consequences the Owner should agree to before I run it

1. **38 email delivery records disappear.** Every one is attached to a test
   booking, so they cascade. That history is gone — it is the only record of which
   test emails were sent.
2. **310 audit entries lose their author.** The rows survive (they must), but
   `actor_staff_id` becomes NULL, so the trail stops saying *who* did it.
   ⚠️ Unavoidable if the accounts go — the alternative is keeping dead accounts
   for ever purely as name tags.
3. **`operational_events` goes to 0**, including **3 "open" failed-booking alerts**
   currently showing on the admin operations board. All four are test artefacts
   (`audit_seed`, and failures from booking probes).
   ⚠️ **Say if you would rather keep these** — they are the one item in the list
   that is arguably operational history rather than test data.
4. **All automated browser testing stops working** until new accounts exist and
   `.env` is updated. Expected and accepted (decision D).
5. **The published password is neutralised** — the accounts it opens will not
   exist. It remains in git history for ever; nothing can change that.
6. **Not reversible.** No backups (D17, your decision). No export taken (your
   decision).

---

## 6. How I will run it

1. Re-read every count immediately before starting — nothing trusted from this
   document.
2. Run steps 1-6 and the verification **inside one transaction**.
3. Read the verification output. **COMMIT only if it matches §4 exactly**;
   otherwise ROLLBACK and report.
4. Re-run `node --env-file=.env scripts/verify-baseline.mjs` — it will now
   *legitimately* mismatch, because the baseline describes the old test data.
   ⚠️ **That script's expected numbers become obsolete the moment this runs.**
   I will report the new true numbers; updating the script is a follow-up.
5. Confirm the live site still loads and the Owner can still sign in.

---

## 7. Creating the two new accounts — for the Owner

**Roles:** `Owner (10) → Admin (20) → Booking Coordinator (30) → Therapist (40)`.
"The high role just below Owner" is **Admin**.

⛔ **Why you have to do this outside the app:** creating staff in
`/admin/staff` inserts a profile with **no login**. I verified that the
application only ever *reads* `auth_user_id` and never writes it, so an account
made in the admin cannot sign in. The login must be made in Supabase.

### Step 1 — create the login (Supabase Dashboard)

1. Open your project → **Authentication** → **Users**.
2. Click **Add user**. Two options appear:
   - **Send invitation** — emails the person a link to set their own password.
     ⛔ This is the only method Supabase's own documentation describes
     (`supabase.com/docs/guides/auth/users`). **Recommended:** you never handle a
     password, and the address is proven to work.
   - **Create new user** — you type the email and password yourself. If you use
     this, tick **Auto Confirm User**, or the account cannot sign in.
3. Do this twice — once for the therapist, once for the admin.
4. Copy each new user's **UID** — you need it in step 2.

⚠️ Use **real mailboxes you control**. An invitation to a fake address never
arrives and the account stays unusable.

### Step 2 — create the staff profile and link it

The app cannot link the login, so this is one SQL statement per person, run in
**SQL Editor** (or send me the two UIDs and emails and I will run it).

```sql
INSERT INTO staff_profiles (name, email, role_id, gender, active, can_take_bookings, availability_mode, auth_user_id)
VALUES
  ('THERAPIST NAME', 'therapist@yourdomain',
   'c30bd264-7f50-454d-9ba4-c393af0ce618',   -- Therapist
   'female',                                  -- must be 'male' or 'female'
   true, true, 'use_global',
   'PASTE-THERAPIST-UID-HERE'),
  ('ADMIN NAME', 'admin@yourdomain',
   '9f746458-a342-49ae-8b24-ff1a9068f422',   -- Admin
   'male',
   true, false, 'use_global',
   'PASTE-ADMIN-UID-HERE');
```

⚠️ **`gender` is not cosmetic.** Claimable work is matched on an exact
male/female comparison, so a therapist with the wrong value silently sees no
claimable bookings.

⚠️ **`can_take_bookings`** — `true` for the therapist so they appear in
availability and can be assigned; `false` for the admin unless they treat
clients too.

### Step 3 — I verify

I will confirm both profiles exist, both are linked to a real login, the roles
resolve, and that signing in lands each on the right dashboard.

---

## 8. What I am NOT doing

- Not touching services, roles, permissions, availability or business settings.
- Not deleting a single `audit_logs` row.
- Not creating any account or handling any password.
- Not changing any code, Cloudflare setting or environment variable.
