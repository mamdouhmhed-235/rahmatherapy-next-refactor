# PLAN — create staff logins inside the website

**Written** 2026-09-08 · researched by 3 read-only agents · every claim cited

> ## ✅ BUILT 2026-09-08 — Parts A, B and C all done
>
> 10 files changed, 1 added, **798 insertions**. Owner's decisions: build it all in
> one go · no forced password change · email AND on-screen link.
>
> **Verified:** typecheck 0 · **3,164 tests pass** (263 files, 8 new specs) · lint
> introduces no new problems · production build succeeds.
>
> ## ✅ VERIFIED IN A REAL BROWSER 2026-09-09 — third run, against the LIVE database
>
> **The whole loop completes end to end.** An account was created through the UI, that
> person signed in in a separate browser, requested a reset, had it approved, set a new
> password from the on-screen link, and signed in with it. The old password was
> refused; re-using the link showed "expired" (single-use confirmed).
>
> ⛔ **It took three runs and two wrong fixes to get there.** Approving destroyed its
> own one-time link:
> 1. `revalidatePath` re-rendered the list → the modal unmounted → link gone. Removed.
> 2. ⚠️ **Not enough** — `updateTag(TAGS.AUDIT)` did the same, because the list is
>    cached with `tags:[AUDIT,STAFF]`. The comment I left claiming otherwise was
>    **wrong**, and `password-requests-data.ts:46-49` says so outright.
> 3. ✅ The approve action now busts **no caches at all**; `finishApprovalRefresh()`
>    does it when the reviewer clicks **Done**.
>
> **Lesson worth keeping:** a server action that must RETURN something unrecoverable
> cannot also invalidate the cache that renders the component holding it. Verified by
> browser, not by reasoning — reasoning got it wrong twice.
>
> ⛔ **Not committed at time of writing.** Working tree only.
>
> ✅ **The email question is settled by evidence, not assumption:** password-reset
> mail goes through the *same* `sendEmail` client as booking notifications and the
> scheduled-email cron — same Resend key, same sender. If booking email works live,
> this does too. Nothing to configure.

---

## The goal, in the Owner's words

1. Owner/Admin creates a new user — **sets their email, password and role** — in the
   admin website. No Supabase dashboard.
2. Later, that person uses **Forgot password** on the site.
3. The Owner **approves** it.
4. They **set their own password**.

---

## ⛔ The Owner's question: does this need an email to be sent?

**No.**

| Step | Needs email? | Why |
|---|---|---|
| **1. Owner creates the account** | ❌ **Never** | The Owner types the password and hands it over directly. Nothing to send |
| 2. Person requests a reset | ❌ No | Just writes a row |
| **3. Owner approves** | ⚠️ **Today, yes** | The secret link exists **only** inside the email |
| 4. Person sets their password | ❌ No | The link is checked by hashing it — email never touches the lock |

⛔ **Email is the delivery van, not the lock.** The fix is to **also show the Owner the
link on screen** so it can be handed over by message or in person.

⚠️ **Why this is a code change, not a setting.** The link is stored only as a one-way
hash (`password-reset-token.ts`). Once the approve action returns, the real link is
**gone for ever** — it cannot be looked up later. It has to be captured in the same
moment it is created.

---

## ⛔ A real bug this must fix on the way

`account-password-requests/actions.ts:143-209` runs in this order:

1. mints the link and marks the request **approved** ✅ *(already saved)*
2. **then** tries to email it
3. if the email fails → returns an error to the Owner

**A failed email therefore leaves a request marked approved, whose only valid link no
longer exists anywhere, and no audit record that approval happened.** The Owner sees an
error and **cannot even retry** — the row is no longer "pending".

⚠️ Worse: `getSiteUrl()` at :188 sits **outside** the try/catch. If
`NEXT_PUBLIC_SITE_URL` is missing in production that is an uncaught crash — a generic
error page — with the request already approved and the link already destroyed.

---

# The work

## PART A — "Add staff member" also creates the login

One form, one action. Fields: **name · email · password · role · gender**.

### Order of operations — ⛔ this is the whole design

There is **no transaction that can span Supabase Auth and the database**, so ordering
plus a clean-up step is the only available safety.

```
1. Permission check      — reuse the existing gate, unchanged
2. Validate              — new shared zod schema (see below)
3. Pre-check duplicates  — BOTH staff_profiles AND auth.users
4. Create the Auth user  — { email, password, email_confirm: true }
5. INSERT staff_profiles — with auth_user_id set IN the insert, not a later update
6. If step 5 fails       — ⛔ DELETE the Auth user just made, then report the error
7. Audit                 — never the password
8. Revalidate the `staff` cache tag
```

⛔ **Step 6 is the important one.** Without it, a failed step 5 leaves someone who can
type a correct password, gets bounced to the login screen for ever, and **nobody —
including the Owner — gets any signal why.** That is the worst outcome available here,
and it is silent. `deleteUser` is already used elsewhere in the repo.

⛔ **Step 3 before step 4** so the ordinary duplicate-email case never creates an Auth
user it then has to delete. Note there are **two** separate uniqueness surfaces, and
today only one is checked — with a friendly message that is **dead code**
(`NewStaffForm.tsx:93-100` tests `/already/i` against a Postgres message that reads
"duplicate key value violates unique constraint"). Both need real mapped messages.

⚠️ `staff_profiles.auth_user_id` has **no unique constraint**. A botched retry can point
two profiles at one login, and the code that reads it expects exactly one row — so both
people break. The pre-check protects against this.

### Password rules

⚠️ **There is no password schema in this project to reuse.** The rule — minimum 12 —
exists as one un-exported constant plus a hard-coded copy of the same number.

**Create one shared zod schema and move the existing reset page onto it**, so the rule
lives in one place instead of becoming a third copy. zod is already the house validator
for admin actions, so this is the existing pattern, not a new one.

⚠️ Supabase's own minimum is probably the default 6, so **the app's 12 is the only real
rule.** It must be enforced server-side, not only in the browser.

### Permissions — already correct, no change needed

Gated by `MANAGE_STAFF_PROFILES` **and** `canAssignStaffRoles`. Live grants confirm both
are held by **Owner and Admin only** — exactly what was asked for.

### The 5 roles (dropdown order)

Owner · Admin · Booking Coordinator · Therapist · Inactive

⚠️ **"Inactive" is currently offered in the dropdown.** Creating a login for an
Inactive-role person is possible today. Worth excluding from the new form.

### ⛔ Audit — the trap

**The audit page's redaction list does not contain the word "password".** Anything
stored under that name would be displayed in full on `/admin/audit`.

**Never write the password, its hash, or its length.** Log only: staff id, email,
role_id, auth_user_id, and who did it.

⚠️ Register the new action type in `audit/format.ts` (family `account_security`) or it
renders through the fallback and is missed by the filters.

---

## PART B — show the reset link on screen when approving

Four small parts, one change:

1. Widen the approve result to carry `resetLinkUrl` and `emailSent`
2. ⛔ **Reorder**: save the row, write the audit entry and revalidate — **all before**
   attempting the email. Build the URL inside the try/catch so a missing site URL can
   never crash after the row is committed
3. Email becomes **best-effort**: a failed send reports *"approved, but the email did not
   go — use the link below"*, **not** a failure
4. Show the link in the approve modal with a **copy button**, and wording that says
   plainly: **treat this like a password**

⚠️ **Do the same for reject** — a rejection should never fail because email is down.

### Is showing the link safe?

**Yes — arguably safer than emailing it.** Anyone holding that link can set that
account's password; that is already true today, and today it travels through a third
party in plain text. Shown once, over TLS, to an Owner who is **already signed in and
already holds greater power**, is a *narrower* exposure than the email path it replaces.

⚠️ The honest new risk: an Owner could mint a link and use it to take over another
staff member's account. The audit row records it but does not prevent it. **Accepted
trade-off** — the Owner already holds the service-role key and could do far more.

⚠️ The hand-over channel (WhatsApp, SMS) becomes the new weakest link. The wording in
the UI must say so.

---

## PART C — small fixes found along the way

| | Fix | Why |
|---|---|---|
| 1 | Register `staff_profile_created` in `format.ts` | The action writes one name and the label registry expects another, so **every staff creation is filed under the wrong family** and missed by the "Staff & roles" filter |
| 2 | Fix the dead duplicate-email message | The regex never matches, so users see raw database errors |
| 3 | Stop the login page saying *"Incorrect email or password"* for an **unconfirmed** account | It reports the wrong cause. Less pressing once Part A always confirms, but still wrong |

---

## Size

| Part | Estimate |
|---|---|
| **A** — create with login | **~1 day** |
| **B** — on-screen link + ordering fix | **~3 hours** |
| **C** — three small fixes | **~1 hour** |

⛔ **A and B are independent.** B is smaller, fixes a live bug, and could ship first.

---

## What this deliberately does NOT include

- **No forced password change at first sign-in.** No such mechanism exists — building
  one is real work, not a flag. The Owner's own flow already covers it: the person
  resets to something private whenever they want.
- **No invite emails.** The Owner hands the password over directly, so **nothing in
  Part A depends on email working at all.**

---

## ⚠️ Still unverified

**Whether `RESEND_API_KEY` and `NEXT_PUBLIC_SITE_URL` are set on the live site.**
Environment variables are set in the Cloudflare dashboard, not in the repo, so this
cannot be answered from here. The reset loop has completed end-to-end against the live
*database*, which proves the code works — it proves nothing about live email.

⛔ **This is exactly why Part A sends no email**, and why Part B makes email
best-effort. Both work either way.

---

# ✅ What was actually built

| File | What changed |
|---|---|
| `src/lib/auth/password-policy.ts` | **NEW.** The single home for the 12-character rule, which previously existed as three unlinked copies |
| `staff/actions.ts` | **NEW** `createStaffProfileWithLogin` — permission → validate → pre-check → create login → insert profile linked → ⛔ **delete the login again if the insert fails** → audit → revalidate |
| `staff/NewStaffForm.tsx` | Password field; calls the new action; honest copy; the dead duplicate-email message actually works now |
| `account-password-requests/actions.ts` | ⛔ Reordered so the row, audit and revalidate all commit **before** the email; `getSiteUrl()` moved inside the try; the link is returned; reject made best-effort |
| `account-password-requests/ApproveModal.tsx` | Stays open on success and shows the link with a copy button and a blunt warning |
| `audit/format.ts` | Registered `staff_profile_created` (was filed wrongly) and the new `staff_login_created` |
| `password-reset/actions.ts` + `SetNewPassword.tsx` | Moved onto the shared policy — the three copies of "12" are now one |
| 2 test files | **8 new specs**, including the compensating delete and "never log the password" |

---

# ⛔ What still needs the Owner

1. **Change the published password.** Still open. Still the only thing that closes it.
2. **Create one account** so the new screens can actually be exercised. After that the
   feature creates its own — this is the last time the dashboard is needed.
3. **Review the "Inactive" role.** It is offered in the Add-staff dropdown, so a login
   can be created for a suspended role. Harmless before this change (no login was
   created at all); worth removing now that one is. **Left alone deliberately** —
   removing a role option was not part of what was asked.
