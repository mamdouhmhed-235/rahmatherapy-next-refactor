> SUPERSEDED by PLAN-account-and-data-reset-FINAL.md (2026-09-03). Kept for the
> reasoning trail only. v3 contains errors corrected in the FINAL version.

# PLAN v3 — the reset, after adversarial review

**Status:** ⛔ **NOTHING DELETED. Two questions must be answered first (§2).**
**Written** 2026-09-03 · supersedes v1 and v2 · six reviewers, **6 blockers, 16 serious**

⛔ **v2 was wrong in ways that mattered.** Every correction below is measured, not
argued.

---

## 1. ⛔ The finding that changes everything

### The published password is the OWNER'S OWN — and his is the account we keep

v2 told you (§5.5) that deleting the test accounts *"neutralises the published
password"*. **That is false, and it is the opposite of the truth.**

`rahmatherapy@outlook.com` appears in **92 tracked files** in your **public**
GitHub repo, and at least six pair it with a working password on the same line —
`redesign/test-credentials.md`, `docs/production/production-readiness-checklist.md`,
`redesign/LAUNCH-SHEET.md`, `redesign/MAIN-AGENT-CONTEXT.md`, and two handoffs.

So after this reset, **the only account left on your live system is the one whose
password is published**, and it holds all 40 permissions. The reset does not close
the hole; it removes every other account *around* the hole.

⛔ **THE FIX, AND IT IS NOT OPTIONAL:**
**Supabase Dashboard → Authentication → Users → `rahmatherapy@outlook.com` →
Update password.** Do this **before** the deletion.

⚠️ Deleting the strings from the repo does nothing — they are in git history for
ever. Only changing the password closes it.

---

## 2. ⛔ Two questions only you can answer

### Q1 — Two clients are recorded in your own repo as REAL

You said "all clients are test data". Your repo says otherwise about two of them,
and this is irreversible, so I will not proceed on the generalisation.

**`redesign/per-page-progress/C-FIELDWORK-EXPERIENCE-progress.md:25`:**
> *"a real customer's own booking (**Mamdouh**, `m•••••••@gmail.com`) — **not a
> safe test fixture**, correctly left untouched throughout"*

and line 74: > ***"Never** touch Mamdouh's real booking"*

| Client | Email | Phone | Address | Booking |
|---|---|---|---|---|
| **Mamdouh** | `m•••••••@gmail.com` | 07984 775305 | 65 Eaton Valley Road, LU2 0SN, Luton | 2026-05-30 08:30, **confirmed**, £55 |
| **Minhajur Rahman** | `m••••••••••••@hotmail.co.uk` | 07754966439 | 99 Humberstone Road, LU4 9SR, Luton | 2026-05-27, **confirmed**, £40 |

Both have real routable mailboxes, real Luton addresses, real UK mobiles, and
**no test marker of any kind**. A standing rule repeated in **eight** plan
documents says any client whose email is not `*.example.test` and whose name is
not `Phase10*`/`Audit Test*` is off-limits live data. Four of the fourteen fail
that test (these two, plus `Zara Test Client` and `Fatima Ahmed`).

⛔ **Answer one of:**
- **"Delete all 14"** — you confirm these are you and a family member testing.
- **"Keep those two"** — I delete 12 clients and 12 bookings, keeping those two.

### Q2 — After this, you have ZERO female therapists

You are male, and yours is the only account left. Measured today: **4 bookable
female therapists → 0**. Meanwhile **12 booking participants required a female
therapist**.

Every layer of the booking engine matches gender exactly, so until a female
therapist exists, a woman requesting one **cannot be served at all**.

⛔ **Answer one of:**
- **"Create the accounts first"** — you make the new therapist login before I
  delete. Nothing is ever without cover.
- **"Delete now, create straight after"** — a gap of minutes. Fine while bookings
  are closed, which they are.

---

## 3. What v2 got factually wrong

| v2 claimed | Truth |
|---|---|
| "310 audit entries lose their author" | **186.** 124 belong to you and keep their name; 8 were already null |
| The trail "stops saying who did it" | **It asserts a falsehood instead** — `audit/page.tsx:272` renders a null actor as **"System"**. 186 human actions would be relabelled as automated |
| `booking_assignments` = 16 | **9** |
| 4 operational_events are "test artefacts" | **3 were written by the live public booking endpoint** — real signals |
| "The app never writes `auth_user_id`" | True of the app, **false of the repo** — `scripts/bootstrap-owner-admin.mjs:248` writes it |
| "Send invitation" recommended | **Dead end** — nothing in this app consumes an invite link |
| Complete inventory | **Missed `consent_events` entirely — 84 rows** |
| "Run inside one transaction, then read the check and COMMIT" | **Impossible.** Each database call gets a new connection, so a transaction cannot span calls, and one call returns only the last statement's result |

⚠️ I had *tested* atomicity and it passed — but I only proved it for a **single
call**. The reviewer proved the *read-then-commit* flow I actually wrote is
unachievable. My test validated something the plan wasn't doing.

---

## 4. The corrected method — one call, self-enforcing

Everything goes in **one** database call. The safety check is a `DO` block that
**raises an exception** if the numbers are wrong, which aborts the whole message
automatically. No human decision between the delete and the commit, because that
decision point cannot exist.

```sql
-- ONE call. Any failure anywhere aborts everything.
BEGIN;

-- 0. Snapshot authorship BEFORE staff are deleted, so audit rows keep the name
--    instead of silently becoming "System".
UPDATE audit_logs a
SET after_state = coalesce(a.after_state,'{}'::jsonb)
                || jsonb_build_object('_actor_name_snapshot', s.name,
                                      '_actor_email_snapshot', s.email,
                                      '_actor_deleted_at', now())
FROM staff_profiles s
WHERE s.id = a.actor_staff_id
  AND s.id <> '01582c5d-bd75-4c49-b207-6f5597e15218';

DELETE FROM enquiries;                       -- FKs are SET NULL; would orphan otherwise
DELETE FROM bookings         WHERE <scope>;  -- cascades items/participants/assignments/emails
DELETE FROM clients          WHERE <scope>;  -- must follow bookings (NO ACTION)
DELETE FROM consent_events;                  -- 84 rows, missed by v2
DELETE FROM operational_events;              -- see Q3 below
DELETE FROM staff_profiles WHERE id       <> '01582c5d-bd75-4c49-b207-6f5597e15218';
DELETE FROM auth.users     WHERE id       <> '21c0a691-99fe-47e7-b538-55817d4958c7';

-- SELF-ENFORCING GATE. Wrong numbers => exception => nothing commits.
DO $$
DECLARE s int; l int; a int; e text;
BEGIN
  SELECT count(*) INTO s FROM staff_profiles;
  SELECT count(*) INTO l FROM auth.users;
  SELECT count(*) INTO a FROM audit_logs;
  SELECT email    INTO e FROM staff_profiles LIMIT 1;
  IF s <> 1 OR l <> 1 OR a <> 318 OR e <> 'rahmatherapy@outlook.com' THEN
    RAISE EXCEPTION 'ABORT staff=% logins=% audit=% survivor=%', s, l, a, e;
  END IF;
END $$;

COMMIT;
```

**Both survivor ids verified today** — `01582c5d…` is the staff row, `21c0a691…`
is the login, they point at each other, role reads **Owner**. Not swapped.

⚠️ `<scope>` is filled in once you answer **Q1** — either unbounded, or excluding
the two named clients and their bookings.

---

## 5. Consequences, corrected and complete

1. **38 email delivery records go** — all are tied to test bookings.
2. **186 audit rows** would have become "System"; step 0 above preserves the name
   inside the row instead. ⛔ No audit row is ever deleted — still 318.
3. **`consent_events` (84)** — cookie/consent history, missed by v2.
4. **3 real operational alerts** are currently open on your operations board.
   ⚠️ **Q3: keep them or clear them?** They are genuine signals from the live
   endpoint, not test probes as v2 claimed.
5. **Your clients' names, emails, phones and addresses remain visible in
   `/admin/audit`** even after deletion. The audit table keeps them and the screen
   shows them unredacted. Deleting them there is not permitted (audit rows are
   never deleted), so this is a limit of the purge, not a bug.
6. **The in-app password-recovery route stops working** — with one staff account,
   the only holder of the reviewer permission is the person who would need
   recovering. Your fallback becomes the Supabase dashboard.
7. **The e2e suite does not come back by editing `.env`** — 17 spec files plus
   helpers hard-code the identities. Accepted (decision D), but it is a code
   change, not a config change.

---

## 6. Creating the two accounts — corrected

⛔ v2 told you to hand-write an INSERT. **There is a purpose-built script**, and
it is safer: `scripts/bootstrap-owner-admin.mjs`. It refuses to run if the auth
user is already linked, checks the role really is privileged, and writes its own
audit entry.

**It never handles a password** — it requires the login to exist first. That fits
your decision C exactly: you set the passwords, I never see them.

### The Admin account (the role just below Owner)

1. **You:** Dashboard → Authentication → Users → **Add user** → **Create new
   user**. Enter the email and a password. ⛔ **Tick "Auto Confirm User"** or it
   cannot sign in.
   ⚠️ Do **not** use "Send invitation" — nothing in this app can consume the link.
2. **Me:** run the script with that email, the name, the gender and `--role Admin`.
   It finds the login, creates the profile and links them.

### The Therapist account

⚠️ The script only accepts *critical* roles (staff-management permissions), so it
will refuse "Therapist". Same step 1; then I insert the profile with the Therapist
role id and link it, and verify.

⚠️ **The profile email must be the identical string to the login email** — a
mismatch fails silently and the person is bounced back to the sign-in page with no
error.

---

## 7. Order of operations

```
1. YOU  change your own password           ⛔ closes the actual security hole
2. YOU  answer Q1 (the two clients) and Q2 (therapist first, or after?)
3. YOU  create 1-2 logins in the dashboard  (if "create first")
4. ME   run the single-call transaction
5. ME   link the new profiles, verify roles and sign-in routing
6. ME   report true new counts; the old baseline script is now obsolete
```
