> SUPERSEDED by PLAN-account-and-data-reset-FINAL.md (2026-09-03). Kept for the
> reasoning trail only. v1 contains errors corrected in the FINAL version.

# PLAN — clear out every test account and all test data, then rebuild the team

**Status:** ⛔ **PLAN ONLY. NOTHING DELETED.** Awaiting the Owner's choices.
**Written** 2026-09-03 · live database `twzutkfgqclqurvkmvqz` · `BASELINE EXACT`
**Goal:** remove every account and every piece of test data except the Owner's own
account, then add two new accounts — one **Therapist** and one **Admin** (the role
directly below Owner).

---

## 1. What is actually in there — counted today

### Staff accounts: 12, of which **exactly 1 is real**

| Keep | Account | Role | Login last used | Booking assignments |
|---|---|---|---|---|
| ✅ **KEEP** | **Minhaj rahman** `rahmatherapy@outlook.com` | Owner | 2026-08-24 | 1 |
| ❌ | Phase10 OWNER | Owner | 2026-09-03 | 0 |
| ❌ | Phase10 ADMIN | Admin | 2026-05-21 | 0 |
| ❌ | Test Admin | Admin | 2026-09-03 | 0 |
| ❌ | Phase10 COORDINATOR | Coordinator | 2026-05-21 | 0 |
| ❌ | Test Booking Coordinator | Coordinator | 2026-09-03 | 0 |
| ❌ | **Phase10 THERAPIST A** | Therapist | 2026-05-21 | **2** ⚠️ |
| ❌ | Phase10 THERAPIST B | Therapist | 2026-09-03 | 0 |
| ❌ | Test Therapist | Therapist | 2026-09-03 | 0 |
| ❌ | Test Therapist Fresh | Therapist | 2026-05-25 | 0 |
| ❌ | Phase10 INACTIVE | Inactive | never | 0 |
| ❌ | Test Inactive | Inactive | 2026-09-03 | 0 |

### Logins: 13 — one MORE than there are staff

⚠️ `phase10.nonstaff@example.test` is an **orphan login**: a real, confirmed,
sign-in-capable account with **no staff profile at all**. It signed in on
2026-09-03. It must be deleted too, and it would be easy to miss.

### Clients: 14 — and **all 14 look like test data**

11 are unmistakable (`@example.test`, "Audit Test Client", "TEST Please Ignore",
"Zara Test Client", the deliberate long/CJK/Arabic name fixtures).

⚠️ **Three carry real personal email addresses** and only you can classify them:

| Client | Email | Bookings |
|---|---|---|
| **Minhajur Rahman** | `m••••••••••••@hotmail.co.uk` | 1 |
| **Mamdouh** | `m•••••••@gmail.com` | 1 |
| **Fatima Ahmed** | `fatima.verify@example.com` | 2 |

They look like real people testing the real site — probably you and me — but I
will not assume that. ⛔ **These are the only records where deleting the wrong
thing would destroy a genuine customer.**

### Bookings: 14 — every one matches a test client above

### Everything else

3 enquiries · 2 client notes · 1 password request · 1 privacy request ·
1 notification state · **318 audit logs (310 with an actor)** ·
0 recurring templates · 0 permission overrides

---

## 2. ⛔ Six things to watch out for

**1. Deleting a staff profile does NOT delete their login.**
They are two separate systems (`staff_profiles` and `auth.users`). Delete only the
profile and the person can still sign in — they just have no role. **Both halves,
every time.** This is the single easiest mistake to make here.

**2. The admin has no delete button for staff.** I checked: the only lifecycle
action in the UI is moving someone to the "Inactive" role. So **this cannot be
done through the website** — it needs the Supabase dashboard or a script.

**3. Deleting a therapist silently unassigns real bookings.**
`booking_assignments.assigned_staff_id` is `ON DELETE SET NULL`. Phase10 THERAPIST A
holds **2 assignments**. Delete them and those bookings survive but quietly become
unassigned. Since we are deleting those bookings anyway, this is moot — **but only
if the bookings go first.** Order matters.

**4. 310 audit entries lose their author.**
`audit_logs.actor_staff_id` is `SET NULL`, so the rows survive but stop saying who
did it. ⛔ Audit rows must never be deleted (G31), and this does not delete them —
but you should know the history becomes anonymous. The alternative is keeping dead
accounts forever purely as name tags.

**5. It breaks all automated browser testing.**
The `phase10.*` accounts are the designated identities for the multi-agent test
gate, and `scripts/mint-e2e-session.mjs` signs in as them using `.env`. After this,
every e2e and audit run stops working until new accounts exist and `.env` is
updated. That is a real cost, not a detail.

**6. The published password.** ⚠️ Deleting these accounts closes the exposure —
but the password stays in public git history **for ever**. Removing it from the
file changes nothing. Deleting the accounts is what actually closes it.

---

## 3. The order that works

⛔ Children before parents, or foreign keys block the delete.

```
1.  operational_events pointing at test bookings   (ON DELETE SET NULL — must go first)
2.  bookings            (cascades to items, participants, assignments, email events)
3.  clients             (must follow bookings)
4.  enquiries, client_notes, privacy requests, password requests, notification state
5.  staff_profiles      (11 rows — everyone except Minhaj rahman)
6.  auth.users          (12 logins — the 11 above PLUS the orphan)
7.  verify              nothing left, Owner intact, audit_logs still 318
```

⛔ **`audit_logs` is never deleted.** It should still read exactly **318** at the end.

---

## 4. YOUR CHOICES

### Choice A — how much to delete

| | Option | What it means |
|---|---|---|
| **A1** | **Everything except the Owner** *(what you asked for)* | All 11 staff + 12 logins, all 14 clients, all 14 bookings, enquiries, notes. A genuinely blank slate. |
| **A2** | Everything except the Owner, **but keep the 3 real-email clients** | Same, but `Minhajur Rahman`, `Mamdouh` and `Fatima Ahmed` and their 4 bookings survive, in case any is a real customer. |
| **A3** | Accounts only, leave the data | Closes the security hole now; the test clients and bookings stay until later. |

### Choice B — who does the deleting

| | Option | Notes |
|---|---|---|
| **B1** | **I do it, by SQL, in one transaction** | Fastest and exact. I write it, show you every row first, you approve, it runs as one all-or-nothing block with a verification straight after. I already have database access. |
| **B2** | You do it in the Supabase dashboard | You keep your hands on the wheel. Slow and error-prone: ~26 rows across two systems, and the order matters. |
| **B3** | Split — I clear the data, you delete the logins | You personally close the security half; I do the tedious half. |

### Choice C — who creates the two new accounts

⛔ **First, a fact that constrains this:** the app **cannot create a working
login**. Creating staff in the admin makes a profile with no password — I verified
that `auth_user_id` is only ever read by the application, never written. A working
account can only be made with the service-role key, which means the Supabase
dashboard or a script.

| | Option | Who sees the password |
|---|---|---|
| **C1** | **You create both, in the Supabase dashboard** | Only you. I give you an exact click-by-click checklist and verify afterwards that the roles and links are right. |
| **C2** | You create the logins, I link the profiles | You set the passwords; I do the fiddly role/profile wiring and verify. |
| **C3** | I create both with a script | I would have to handle passwords. ⛔ **I do not recommend this and would rather not** — it is the exact thing that got a working password into your public repo. |

⚠️ Whichever you pick, the **Admin** role is the one directly below Owner — that
is what "high role just below owner" means here (Owner 10 → **Admin 20** →
Coordinator 30 → Therapist 40).

### Choice D — the testing accounts

| | Option | Consequence |
|---|---|---|
| **D1** | **Don't recreate them** | Cleanest and safest. Automated browser testing stays broken until you decide otherwise. |
| **D2** | Recreate them later, with a fresh password kept out of git | Testing works again. Needs `.env` updating and the password never committed. |

---

## 5. What I suggest

**A1 + B1 + C1 + D1.**

- **A1** — you asked for a clean slate, and every one of the 14 clients and 14
  bookings is test data. ⚠️ The one thing I want you to confirm out loud: the three
  real-email clients. If any is a genuine customer, say so and we switch to A2.
- **B1** — 26 rows across two systems in a specific order is exactly the kind of
  job where doing it by hand goes wrong. I will show you the full list before
  anything runs, and it goes as one transaction that either completes or doesn't.
- **C1** — **you should hold the passwords.** Not because I can't, but because the
  current problem is a password that ended up somewhere it shouldn't. Two accounts
  is ten minutes of clicking, and I will verify the result immediately.
- **D1** — don't recreate testing accounts you don't need yet. If you later want
  the browser testing back, that is a small, separate job.

---

## 6. Safety rails, whatever you pick

- ⛔ **Nothing runs until you approve the exact row list**, shown to you first.
- ⛔ **One transaction.** All of it lands or none of it does.
- ⛔ **`audit_logs` untouched** — 318 before, 318 after.
- ⛔ **The Owner's account is never in any statement** — every delete explicitly
  excludes `01582c5d-bd75-4c49-b207-6f5597e15218`.
- ⛔ **No email is sent** — direct SQL bypasses the application layer entirely,
  the same method proven during the therapist seed.
- ⚠️ **This is not reversible.** There are **no database backups** (deferred, free
  tier, D17). Once these rows are gone they are gone. If you want a safety net, I
  can export every affected row to a local JSON file first — say so and I will.
