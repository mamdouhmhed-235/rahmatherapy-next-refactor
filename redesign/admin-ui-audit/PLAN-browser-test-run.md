# PLAN — browser test of the new staff-login feature

**Written** 2026-09-08 · **amended 2026-09-08 with the Owner's decisions**
**Status:** ⛔ **PLAN ONLY — approved in principle, not yet run.**

> ## ✅ SETTLED — and the sign-in has changed again, for the better
>
> **1. ⭐ THE OWNER SIGNS IN HIMSELF.** The browser is opened, the Owner types his own
> credential, and the agent starts *after* that. ⛔ **The agent never sees, reads or
> types the Owner's password** — `docs/users-credentials` is not opened, and ruling
> D-006 (*"no password is ever typed into a form, by a human or by an agent"*) is
> **no longer set aside for the agent at all**. Options B and C are both dropped.
>
> **2. Live writes: APPROVED.** *"It's fine even if the new user made is real, as we
> are trying to test this for real anyways."* The test therapist is a real account on
> the live system. Cleanup still runs.
>
> **3. The test account is created and used entirely by the agent** — it invents the
> email and password, creates the account end-to-end through the real UI, and then
> signs into it itself in a **second, separate browser**.
>
> ⚠️ **Changing the Owner's password is still outstanding.** This test no longer
> touches it either way.
>
> ### ⛔ The consequence that governs everything below
>
> **The agent cannot sign back in as the Owner.** It has no credential and must not
> obtain one. So:
>
> ⛔ **IT MUST NEVER SIGN OUT, CLEAR COOKIES, OR NAVIGATE AWAY FROM THE ADMIN IN THE
> MAIN BROWSER PANE.** One careless "Sign out" ends the run and needs the Owner back at
> the keyboard. Every signed-out action — the forgot-password request, the set-password
> page — happens in the SECOND browser, which is exactly what it is for.
>
> ### ✅ Two mechanics verified before writing this, not assumed
>
> | Question | Answer |
> |---|---|
> | Does a subagent share this session's browser pane? | ✅ **Yes.** A probe agent saw the same tab (`seed`, `localhost:3000`) and drove it |
> | Can it get a genuinely separate second session? | ✅ **Yes — the Playwright MCP**, its own browser with its own cookie jar. A second *tab* would NOT do: tabs share cookies, so it would still be the Owner |
>
> ⚠️ **And one trap the probe found:** the browser tools report the **origin only**
> (`http://localhost:3000`) and never the path. So "am I on the right page?" must be
> answered by reading page **content**, never the reported URL.

---

# ⛔ ONE THING THAT SHAPES THIS PLAN

## There is no test database. The local site writes to LIVE.

`.env` points `NEXT_PUBLIC_SUPABASE_URL` at **`twzutkfgqclqurvkmvqz`** — the live
production project. Running the site locally does **not** make the data local.

**So "just testing" is not what it sounds like.** Every account the agent creates is a
**real, working login to the live admin**, and the audit rows it writes are permanent
(audit rows are never deleted — that rule has not changed).

| Effect | Reversible? |
|---|---|
| A new staff profile + a new sign-in account | ✅ Yes — deletable afterwards |
| `staff_profiles` 1 → 2, so `verify-baseline.mjs` goes red | ✅ Yes — passes again once removed |
| **Audit rows for every action taken** | ⛔ **No. Permanent.** |

✅ **Accepted by the Owner.** Recorded here so the permanent audit rows are never a
surprise later.

## ⚠️ The agent needs no credential — and must not go looking for one

The Owner signs in by hand, so there is nothing for the agent to find.

⛔ **If it is ever not signed in, the answer is STOP AND ASK — never "find a way in".**
Recorded because there are three tempting dead ends and one live hazard:

- `E2E_OWNER_EMAIL` / `E2E_ADMIN_EMAIL` in `.env` are **`@example.test`** addresses from
  the batch **deleted on 2026-09-03**. They will not work.
- `scripts/mint-e2e-session.mjs` signs in with those same dead identities. Will not work.
- `scripts/seed-e2e-staff.mjs` ⛔ **DELETES DATA ON STARTUP** and must never be run
  against this database.
- ⛔ The service-role key in `.env` *could* mint a session or create an admin. **It must
  not be used for that.** The whole point of this arrangement is that the agent's access
  is the Owner's own session and nothing else.

---

# What the agent will do

**Model:** `opus` — ⚠️ a specific version like "4.6" cannot be selected; the tool takes
`sonnet` / `opus` / `haiku` / `fable`. It will get the configured Opus.

### ✅ Step 0 — ALREADY DONE (this session, before the agent)

The dev server is running (`rahma-admin`, `next dev`, port 3000) and the browser pane is
open at `localhost:3000`. ⚠️ `localhost`, not `127.0.0.1` — a known Next-dev quirk here.

### 👤 Step 1 — THE OWNER, BY HAND

The Owner signs in at `/admin/login` in the open pane, then says go.
⛔ **The agent is not running yet.** It is launched only after that.

### Phase 2 — confirm the inherited session, then freeze it

First action, before anything else: prove it really is signed in as the **Owner**, by
reading page **content** (the reported URL is origin-only and cannot tell you the path).

⛔ If it is NOT signed in: **stop and report.** Do not attempt any sign-in.

Then record the "before" state — `staff_profiles`, `auth.users`, `audit_logs` counts —
so cleanup has a target to return to.

### Phase 3 — ⭐ the actual test: create a staff member with a login

Admin → Staff → **Add staff member**. Fill name, email, **password**, role
(**Therapist**), gender. Submit.

**Must verify:**
- ✅ The success message says they can sign in
- ✅ They appear in the staff list
- ✅ On their profile, **"Sign-in account created" is TICKED** — this was the dead
  checkbox with nothing behind it
- ✅ `staff_profiles.auth_user_id` is actually set
- ✅ The audit row reads **"created a staff sign-in account"** and ⛔ **contains no
  password anywhere**

**Also test what should FAIL:**
- A password under 12 characters → refused, and ⛔ **no orphaned login left behind**
- A duplicate email → the friendly message, ⛔ **not a raw database error** (this was
  broken before)

### Phase 4 — ⭐ prove the new account actually works — SECOND BROWSER

⛔ **Use the Playwright MCP**, which is a genuinely separate browser with its own
cookies. ⚠️ **A second tab in the pane would prove nothing** — tabs share cookies, so it
would still be the Owner.

⛔ **Do not sign out of the pane. Ever.** The Owner's session is not recoverable by the
agent.

In the Playwright browser: go to `/admin/login`, sign in with the email and password the
agent itself set in Phase 3, and confirm it reaches the admin as a **Therapist** — a
narrower view than the Owner's, not an admin's.

**That single step is the heart of this test:** it proves an account created entirely
through the website actually works.

### Phase 5 — the reset loop, across both browsers

| Where | Step |
|---|---|
| **Playwright** (signed out) | **Forgot password** as the test therapist |
| **Pane** (still the Owner) | Approve it → ⛔ **confirm the one-time link appears on screen and the Copy button works** |
| **Playwright** | Open that link → set a new password → sign in with the new one |

That closes the whole loop end to end. ⚠️ Note whether the approval email was reported
as sent, since real mail goes to a real address.

### Phase 6 — UI/UX review

Across every screen touched — Add staff dialog, staff list, staff profile, login,
forgot-password, approval queue, approve modal, set-password page:

- **Mobile (375px), tablet (768px) and desktop** — this admin had a 768px nav lockout
  before, so that width matters
- **Light and dark**
- Keyboard-only: can every step be completed without a mouse?
- Does anything overflow, truncate badly, or sit under a fixed bar?
- ⚠️ Console and network errors on every page
- **Is the wording honest?** Especially: does anything still promise an email that is
  not sent?

⚠️ **Flag and report only. The agent fixes nothing** — findings come back for review.

### Phase 7 — cleanup

Delete the test staff profile and its login. Re-run `verify-baseline.mjs` and confirm
**BASELINE EXACT**.

⚠️ The audit rows stay. They cannot be removed, and the report must say plainly which
permanent rows the test added.

---

# ✅ Both decisions are settled

| | Decision |
|---|---|
| **Sign-in** | ⭐ **The Owner, by hand, before the agent starts.** The agent never touches the credential |
| **Live writes** | **Approved.** The test therapist is a real account. Cleanup still runs |
| **Test account** | Created and signed into **by the agent**, end-to-end, in two browsers |
| **Model** | `opus` — ⚠️ a version like "4.6" cannot be selected; the tool takes `sonnet` / `opus` / `haiku` / `fable` |

⛔ **The only thing left is the Owner logging in.** Then the agent goes.

---

# ⛔ Hard limits on the agent, regardless

These are not preferences. An agent with the Owner's credential on a live system needs
edges it will not cross:

0. ⛔⛔ **NEVER SIGN OUT OF THE MAIN PANE.** Not to "test the login page", not to tidy
   up, not by clicking a menu item to see what it does. The Owner's session was created
   by hand and the agent cannot recreate it. Everything signed-out belongs in the
   Playwright browser. **This is the single easiest way to end the run.**
1. ⛔ **Never change the Owner's password, email, role or anything else on that account.**
   And never open `docs/users-credentials` or any other credential file — there is no
   longer any reason to.
2. ⛔ **Never delete or edit anything it did not create.** Not one row.
3. ⛔ **Never touch `audit_logs`.** Read-only, always.
4. ⛔ **Never `git commit`, `git push`, or `pnpm deploy`.** Nothing leaves the machine.
   ⚠️ `pnpm deploy` would build locally with `NEXT_PUBLIC_BOOKING_ENABLED=true` from
   `.env` and **open live bookings**.
5. ⛔ **Never paste the credential anywhere but the login form** — not into a file, a
   commit, a screenshot it keeps, or its own report.
6. ⛔ **Fix nothing.** Findings are reported, not repaired. A UI fix made mid-test
   invalidates the test.
7. ⚠️ **If anything unexpected happens to live data, stop immediately and report.** Do
   not attempt a repair.
