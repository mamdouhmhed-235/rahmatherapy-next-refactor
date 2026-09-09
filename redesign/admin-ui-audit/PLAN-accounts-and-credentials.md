# Staff accounts & the published credential — findings and plan

**Written** 2026-09-03 · 4 read-only research agents · every claim cited
**Status:** ⛔ **NOTHING CHANGED.** Findings and options only.

---

## PART 1 — the credential in the repo

### It is 15 files, not 92

**The email address itself is your PUBLIC contact address**, printed on the live
website on purpose (`src/content/site/contact.ts:20-24`, rendered in the site
header, footer, privacy page and maintenance banner). An address already on your
homepage cannot be leaked by a repository. Most of the 92 are harmless.

⛔ **The dangerous subset is 15 files** that pair it with a **working password**:

`docs/users-credentials` · `redesign/test-credentials.md` ·
`redesign/phase6-admin-workflow-guide.html` (29 occurrences) ·
`docs/production/production-readiness-checklist.md` ·
`redesign/LAUNCH-SHEET.md` · `redesign/MAIN-AGENT-CONTEXT.md` ·
`redesign/PER-PAGE-GOAL-COMMANDS.md` · `redesign/RECONCILIATION-WALK-PLAN.md` ·
3 handoffs · 2 plan documents · 2 recipe/evidence files

### It is live right now

⛔ **The repository is public** — an anonymous API call returns
`"private": false`. Four of those files were **downloaded anonymously today** with
no login: the credentials file is a 411-byte plain-text download away.

⛔ **Exposed since 2026-05-10 — about four months** — and it is in **git history**,
so deleting the files does not undo it. `git merge-base` confirms those commits
are on the published branch.

### Why it happened

One sentence. `redesign/test-credentials.md:19` describes the owner login as
*"the seeded test owner credential and is safe to use in dev"*. Once one document
said that, fourteen more copied it in good faith.

⚠️ **Nothing has ever scanned this repo's own text for secrets.** The one scanner,
`scripts/scan-browser-secrets.mjs:20`, only looks at build output — `.next/static`,
`.open-next/assets`, `public`. A password typed into a markdown table was invisible
to it. That is how it survived four months and a full production-readiness audit.

✅ Worth saying: `.gitignore` handles `.env` correctly. The discipline was fine —
it was hand-written documentation that leaked.

### What actually fixes it

| Step | Effect |
|---|---|
| **1. Change the password** (Supabase → Authentication → Users → Update password) | ⛔ **The only thing that closes it.** Everything else is tidying |
| 2. Delete the 15 files' credential lines | Stops it spreading further; does **not** remove it from history |
| 3. Add a secret scan over source and docs | Stops the next one |

---

## PART 2 — creating staff accounts

### Your question: is there really no way to do it from the website?

**Correct. There is no way, and it is not hidden in a menu — the code was never
written.** A person and a login are two separate things here, and the site only
ever creates the first.

| What you click | What it makes | Can they sign in? |
|---|---|---|
| Admin → Staff → **Add staff member** | the person's record | ❌ **No** |
| the new hire uses **Forgot password** | ⛔ **nothing — silently swallowed** | ❌ No |
| you use the **approval queue** | can only change an EXISTING password | ❌ No |

⛔ **The forgot-password dead end is the dangerous one.** The new hire is told
their request is pending. **You are never shown anything to approve.** Nobody
learns it vanished. The uniform response is deliberate anti-enumeration security
and correct as security — it just means this path can never onboard anyone.

⚠️ The staff page even shows an **unticked "Sign-in account created" checkbox with
nothing behind it** (`staff/[staffId]/page.tsx:320`). It tells you something is
missing and gives you nowhere to click.

### The one route that works today

Entirely in the Supabase dashboard, two steps:

1. **Authentication → Users → Add user → "Create new user"**
   ⛔ **Tick "Auto Confirm User".** Not optional — this project requires email
   confirmation, and without it the account is born broken.
   Copy the new user's **UUID**.
2. **Table Editor → `staff_profiles` → that person's row → paste the UUID into
   `auth_user_id`.**
   ⛔ Skip this and they type the right password and get bounced to the login
   screen for ever.

### ⚠️ Three traps in that route

1. **Forget "Auto Confirm" and the login page lies to you.** It says *"Incorrect
   email or password"* when the password is perfectly correct
   (`login/actions.ts:52-58`). Hours can go into resetting a password that was
   never wrong.
2. **`auth_user_id` has no uniqueness constraint.** Paste the same UUID into two
   staff rows and **both people are locked out**, with no clue why.
3. **"Send invitation" cannot work.** Nothing in this app can consume the link,
   and no Supabase auth email has ever been sent by this project.

⛔ Also ruled out: `bootstrap-owner-admin.mjs` is a one-time first-admin tool that
will refuse to run while your profile exists; `seed-e2e-staff.mjs` is a test
fixture that **deletes data on startup** and must never touch production.

---

## PART 3 — handover readiness

Of the five things a clinic owner must be able to do:

| | Task | Today |
|---|---|---|
| ✅ | Deactivate someone | **Works properly**, genuinely enforced |
| ✅ | Approve a password reset for someone who already has a login | **Works end to end** |
| ❌ | Add a staff member who can sign in | **Cannot, unaided** |
| ❌ | Reset their own password | **Cannot** — self-approval is blocked |
| ❌ | Delete someone | **Cannot** |

⛔ **Two of five. The site is not handover-ready for staff management.**

⚠️ **The sole-admin trap, which now applies to you.** You have just deleted every
other account. Self-approval is blocked (`account-password-requests/actions.ts:130`)
and there is no "change my password" anywhere in the signed-in admin. **If you
forget your password, the only way back in is a developer with the service-role
key.**

### Minimum viable fix — about 1.5 to 2 days

| | Item | Size |
|---|---|---|
| **A** | **"Create sign-in account" button** on the staff page, wired to that dead checkbox. Creates the login, links it, and emails a set-password link — reusing token and email machinery that **already exists and is tested** | ½–1 day |
| **B** | **"Send password reset link" button** for a locked-out staff member | ~2 hours |
| **C** | **Break-glass second admin** — ⛔ **zero code.** Create a second Owner account at handover so there is always someone who can approve a reset | minutes |

⛔ **C should happen regardless**, and before handover, whether or not A and B get
built. It is free and it removes the single-point-of-failure you now have.

### Worth doing later, not blocking

Revoke the login when a profile is deactivated (~½ day) · a proper invite flow with
pending/active states (2–3 days, only if hiring is frequent) · make the reset page
read the database rather than a cookie so a rejected request stops saying "still
waiting" (~2 hours) · finish or remove the dead create-role form.

---

## Open questions that change the answer

1. **Will the client have Supabase dashboard access after handover?** If **no**,
   item A is **mandatory**, not optional — there would be no way to onboard anyone.
2. **Is `RESEND_API_KEY` set on the live Cloudflare environment?** The whole reset
   flow, and anything built on it, fails closed without it. Unverified.
