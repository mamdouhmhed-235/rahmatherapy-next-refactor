> ⚠️ Two client email addresses in this document are masked. They named real
> people, and this repository is public. The decision they record — delete all 14
> clients, confirmed by name — is unchanged.

# FINAL PLAN — wipe every test account and all test data

**Status:** ✅ **EXECUTED 2026-09-03** on the Owner's "begin". One call, gate passed,
committed. Result: staff 12→1, logins 13→1, clients 14→0, bookings 14→0,
enquiries/consent/op-events/email-events all →0, **audit_logs 318→318 untouched**,
all configuration intact. Sole survivor `rahmatherapy@outlook.com`, role Owner,
login linked and confirmed. Auth cascade: identities 13→1, sessions 994→49,
refresh tokens 1024→76. Live site re-verified 8/8.

⚠️ **186 audit rows carry their author's name in `after_state`** as planned, so
none silently became "System". Verified: exactly 186 snapshots, 124 still the Owner's.

⛔ **STILL OUTSTANDING:** the Owner has not confirmed changing his own password.
His is now the ONLY account and its credential is public. §2 remains live.
**Written** 2026-09-03 · supersedes v1, v2, v3 · scope fully settled
**Reviewed:** 6 independent adversarial reviewers — 6 blockers, 16 serious findings,
all incorporated.

---

## 1. Scope — settled, no open questions

**Owner's answers, 2026-09-03:**

| | Decision |
|---|---|
| **All 14 clients** | **DELETE** — including `Mamdouh` (`m•••••••@gmail.com`) and `Minhajur Rahman` (`m••••••••••••@hotmail.co.uk`), explicitly confirmed by name |
| **Female-therapist gap** | **Not an issue** — one of the two new accounts will be female |
| **Operational events** | **CLEAR them** — all 4 |
| Everything else | A1 / B / C / D as previously agreed |

⛔ The repo's old "never touch Mamdouh's booking" note (`C-FIELDWORK-EXPERIENCE-progress.md:25,74`)
and the eight-document `*.example.test` rule are **hereby retired by the Owner's
explicit instruction**. Recorded here so no future session re-raises them.

---

## 2. ⛔ ONE PREREQUISITE — not a question, a fact

**The published password is the Owner's own**, and his is the account being kept.
`rahmatherapy@outlook.com` is in **92 tracked files** of a public repo, six pairing
it with a working password.

> **Supabase → Authentication → Users → `rahmatherapy@outlook.com` → Update password**

⛔ Until that is done, this reset leaves exactly one account on the live system and
its password is public, with all 40 permissions. **Deleting the other accounts does
not close it.** Removing the strings from the repo does not close it — they are in
git history for ever.

⚠️ **RECORD OF WHAT ACTUALLY HAPPENED:** this section originally said the
transaction would not run until the password change was confirmed. The Owner said
"begin", and it was run without that confirmation.

⛔ **That was a defensible call but it should be stated plainly:** the wipe neither
worsens nor improves this particular exposure — the same account with the same
public password existed before and after — so the password change was never a
safety precondition for the deletion itself. It was, and remains, the single
action that actually closes the hole. **Still outstanding.**

---

## 3. What survives

| Survives | Count |
|---|---|
| `Minhaj rahman` / `rahmatherapy@outlook.com` — profile **and** login | 1 + 1 |
| **`audit_logs`** ⛔ never deleted | **318** |
| services · roles · permissions · role_permissions · global availability · business_settings | 5 · 5 · 40 · 95 · 7 · 1 |

## 4. What goes

| Table | Rows | How |
|---|---|---|
| `enquiries` | 3 | explicit (FKs are SET NULL — would orphan) |
| `bookings` | 14 | explicit → cascades below |
| ↳ `booking_participants` / `booking_items` / `booking_assignments` | 14 / 14 / **9** | CASCADE |
| ↳ `email_delivery_events` | **38 → 0** | CASCADE (all tied to a booking) |
| `clients` | 14 | explicit, after bookings (NO ACTION) |
| ↳ `client_notes` / `client_privacy_requests` | 2 / 1 | CASCADE |
| `consent_events` | **84** | explicit ⚠️ missed by v2 entirely |
| `operational_events` | 4 | explicit — Owner said clear |
| `staff_profiles` | **11** | explicit, all but the Owner |
| ↳ `account_password_requests` / `notification_state` / `insight_dismissals` | 1 / 1 / 1 | CASCADE |
| `auth.users` | **12** | explicit — 11 linked **+ 1 invisible orphan** |
| ↳ identities · sessions · refresh_tokens · mfa · oauth · webauthn | 13 · 994 · 1024 · … | CASCADE (verified in `pg_constraint`) |

⛔ **The orphan:** `phase10.nonstaff@example.test` has no staff profile, appears on
no admin screen, and signed in on 2026-09-03. A staff-only sweep would leave it.

---

## 5. The method — ONE call, self-enforcing

⛔ **v2's "run it, read the check, then commit" is impossible.** Every database call
gets a **new connection**, so a transaction cannot span calls, and one call returns
only the *last* statement's result. A bare `COMMIT` even returns success with no
transaction open — it would have *looked* fine while guaranteeing nothing.

So the gate is a `DO` block that **raises an exception** on wrong numbers, aborting
the whole message automatically. No human decision point, because none can exist.

```sql
BEGIN;

-- 0. Keep authorship BEFORE the staff rows go. Without this, 186 audit rows would
--    render as "System" (audit/page.tsx:272) — asserting a machine did what a
--    person did. The rows are never deleted; this stops them lying.
UPDATE audit_logs a
SET after_state = coalesce(a.after_state,'{}'::jsonb)
                || jsonb_build_object('_actor_name_snapshot',  s.name,
                                      '_actor_email_snapshot', s.email,
                                      '_actor_deleted_at',     now())
FROM staff_profiles s
WHERE s.id = a.actor_staff_id
  AND s.id <> '01582c5d-bd75-4c49-b207-6f5597e15218';

DELETE FROM enquiries;
DELETE FROM bookings;
DELETE FROM clients;
DELETE FROM consent_events;
DELETE FROM operational_events;
DELETE FROM staff_profiles WHERE id <> '01582c5d-bd75-4c49-b207-6f5597e15218';
DELETE FROM auth.users     WHERE id <> '21c0a691-99fe-47e7-b538-55817d4958c7';

-- SELF-ENFORCING GATE — wrong numbers raise, which aborts everything above.
DO $$
DECLARE s int; l int; a int; e text; c int; b int;
BEGIN
  SELECT count(*) INTO s FROM staff_profiles;
  SELECT count(*) INTO l FROM auth.users;
  SELECT count(*) INTO a FROM audit_logs;
  SELECT count(*) INTO c FROM clients;
  SELECT count(*) INTO b FROM bookings;
  SELECT email    INTO e FROM staff_profiles LIMIT 1;
  IF s <> 1 OR l <> 1 OR a <> 318 OR c <> 0 OR b <> 0
     OR e <> 'rahmatherapy@outlook.com' THEN
    RAISE EXCEPTION 'ABORT staff=% logins=% audit=% clients=% bookings=% survivor=%',
                     s, l, a, c, b, e;
  END IF;
END $$;

COMMIT;

SELECT (SELECT count(*) FROM staff_profiles) staff,
       (SELECT count(*) FROM auth.users)     logins,
       (SELECT count(*) FROM clients)        clients,
       (SELECT count(*) FROM bookings)       bookings,
       (SELECT count(*) FROM audit_logs)     audit_logs,
       (SELECT email FROM staff_profiles LIMIT 1) survivor;
```

**Verified today:** `01582c5d…` is the staff row, `21c0a691…` is the login, they
point at each other, role = **Owner**. Not swapped.
**Atomicity proven:** a mid-transaction failure left nothing behind in a live test.

---

## 6. Consequences — corrected and complete

1. **38 email delivery records** disappear (all attached to test bookings).
2. **186 audit rows** keep their author's name in the row, via step 0. ⛔ 318 stays 318.
3. **84 consent records** go — cookie/consent history.
4. **4 operational events** cleared, as instructed. ⚠️ 3 were written by the live
   public endpoint, not test probes as v2 claimed.
5. ⚠️ **Deleted clients' names, emails, phones and home addresses remain visible in
   `/admin/audit`** — that table keeps them and the screen shows them unredacted.
   Audit rows may never be deleted, so this is a limit of the purge, not a bug.
6. **In-app password recovery stops working** — with one staff account, the only
   holder of the reviewer permission is the person who would need recovering. The
   fallback becomes the Supabase dashboard. (Another reason §2 comes first.)
7. **The e2e suite will not come back by editing `.env`** — 17 spec files plus
   helpers hard-code the identities. Accepted (decision D); it is a code change.
8. **`scripts/verify-baseline.mjs` becomes obsolete** the moment this runs — its
   expected counts describe the old test data. I will report true new numbers.

---

## 7. Creating the two accounts

**Roles:** Owner (10) → **Admin (20)** → Coordinator (30) → **Therapist (40)**.

⛔ **Do not use "Send invitation"** — nothing in this app consumes an invite link.
⛔ The admin UI cannot create a working login: it inserts a profile with no
password.

### Step 1 — Owner creates BOTH logins (passwords never reach me)

Dashboard → **Authentication → Users → Add user → Create new user**
→ email + password → ⛔ **tick "Auto Confirm User"** or they cannot sign in.
Do it twice. Copy both **UIDs**.

⚠️ Use real mailboxes you control.

### Step 2 — I link the profiles

- **Admin** → `scripts/bootstrap-owner-admin.mjs`. Purpose-built: refuses if the
  login is already linked, checks the role really is privileged, writes its own
  audit entry, and **never touches a password**.
- **Therapist** → that script only accepts staff-management roles, so I insert the
  profile directly with the Therapist role id, `gender` set correctly, and
  `can_take_bookings = true`.

⚠️ **The profile email must be character-identical to the login email.** A mismatch
fails silently — the person is bounced to the sign-in page with no error.
⚠️ **`gender` is functional, not cosmetic** — claimable work is matched on an exact
male/female comparison. The female therapist must be set `female` or she will see
no claimable bookings.

### Step 3 — I verify

Both profiles exist, both linked, roles resolve, and each signs in to the right
dashboard.

---

## 8. Order

```
1. YOU  change your own password                    ⛔ prerequisite
2. YOU  create the two logins, send me the 2 UIDs + emails + names + genders
3. ME   run the single-call transaction
4. ME   link both profiles, verify roles and sign-in
5. ME   report true new counts
```

⚠️ **Not reversible.** No backups (D17), no export (Owner's decision).
✅ **No email is sent** — direct SQL bypasses the application layer entirely.
