# POST-DEPLOYMENT BACKLOG

**Set 2026-09-03 by the Owner: "defer everything else and log them all for post
deployment."**

⛔ **Nothing in this file is being worked on.** No item here is a blocker, and
none should be started, re-raised or recommended until after the deploy. If a
future session is asked "what is open", this is the list.

⛔ **Do not re-report anything in section F as a new finding.** Those were
examined and accepted.

---

## ⛔ THE ONE THING STILL OUTSTANDING

### ⛔ THE OWNER'S PASSWORD IS STILL PUBLISHED AND STILL UNCHANGED

> **Supabase → Authentication → Users → `rahmatherapy@outlook.com` → Update password**

`rahmatherapy@outlook.com` is now the **only** account on the live system and
holds **all 40 permissions**. Its password sits in **15 files of this PUBLIC
repository** paired with a working value, and four of those were **downloaded
anonymously, with no login, on 2026-09-03** to prove it.

⛔ **Nothing done since has closed this, and nothing can except the Owner.**
The account wipe did not. Deleting the files would not — they are in git history
for ever. It has been open since **2026-05-10**.

⚠️ **Raised at the end of every session since 2026-09-03.** Recorded here so it
is never mistaken for done.

---

## ✅ COMPLETED — was "AT GO-LIVE / READY TO RUN"

### ✅ G1. Delete every staff account and create fresh ones

**Half done, and the other half no longer needs the Owner.**

✅ **The wipe ran 2026-09-03.** All test accounts and test data deleted; only the
Owner remains. Plan and full account: `PLAN-account-and-data-reset-FINAL.md`
(v1/v2/v3 superseded and marked). Reviewed by 6 adversarial agents.
The five test "therapists" that were inflating calendar capacity are gone.

✅ **Creating fresh ones is now a website job, not a Supabase one.** Shipped
2026-09-09 — see `PLAN-staff-logins-in-app.md`. **Admin → Staff → Add staff
member** takes a password and a role and creates the sign-in account itself.

⛔ **The old note that this is "Owner-only, credentials must never pass through
an agent" is retired for account CREATION** — no credential is needed to create
one any more. It still stands for the Owner's own password, above.

⚠️ **What the Owner still has to do himself:** create the first two accounts.
Not because the site cannot — because there is nobody but him to press the
button. After that the site makes its own.

---

## OWNER-OWNED, ALREADY DECIDED — do not recommend a fix

### D-018. Sentry — the free tier drops error events

⛔ **Sentry is fully installed and working.** `@sentry/nextjs`, three config
files, and a client provider that avoids capturing the customer's bearer token on
`/booking/manage`. Nothing is missing from the code.
*(An earlier version of this file wrongly said "Sentry is not wired up".)*

**The issue:** the free-tier DSN was measured returning **429 (rate limited)**
from Sentry's own ingest on seven public pages, so error events are **dropped** —
a customer can hit a fault the Owner is never told about.

**The Owner decided this on 2026-08-20, verbatim:**
> *"im on a free tier, so defer this issue i will choose whether or not to
> resolve it myself at some point, just leave it open but not really an issue for
> agents to keep bringing up, but if i ever ask for any open issues, this should
> be brought up as well as what my choice here was."*

⛔ Both halves bind:
- **Ordinary work:** do not raise it, do not re-explain it, **do not recommend a
  fix**. It is decided.
- **When the Owner asks what is open:** it must appear — *with* the fact that he
  deferred it and that the cause is the free tier.

The deferral lapses only if the Owner takes out a Sentry subscription.

---

## POST-DEPLOYMENT WORK — in the order I would do it

### 1. Review the booking journey (large)
Nobody has ever looked at whether the booking flow **reads well or converts**.
The geometry is settled — see `PUBLIC-SITE-KNOWN-UNKNOWN.md`, nothing is pushed
off-screen or clipped — but that is a different question from whether it works as
a sales journey.

⚠️ **The only remaining item that touches revenue** rather than staff time.

### 2. Three unfixed major findings (small)
Measured and evidenced in `THERAPIST-FINDINGS.md`.

**2a. Calendar hour ruler hard-coded to 828px** (320 / 375 / 414). The gutter is a
fixed pixel height while the card list grows with its content, so any card taller
than its slot desynchronises the two and the times stop lining up with the
bookings beside them.
*Fix:* size the ruler from the rendered list height, or drop it on phones.

**2b. Email template form squeezed at 768px.** A 2fr/3fr split gives the preview
more room than the form it is previewing; three fields truncate mid-word with no
way to scroll them.
*Fix:* reverse the ratio, or stack below 1024.

**2c. Calendar therapist attribution truncated at 320.** The name beside the
avatar chip gets ~32px.
⚠️ **May already be fixed** — the calendar card became a single column on phones
in commit `3864b10`, recorded after this finding. **Re-measure before doing any
work on it.**

### 3. Password-reset markup (small, but handle with care)
The layout symptom is already fixed (`7bb839a`) — the button no longer falls
below the fold at 320.

**Still open:** a signed-in user visiting `/admin/password-reset` gets a second
`<main id="admin-main">` rendered **inside** the admin shell's own one. Duplicate
DOM id, two nested `<main>` landmarks, and the skip link targets the wrong
element.

⛔ **Deliberately not attempted.** The real fix moves the route out of the admin
layout — auth-adjacent routing. Get it wrong and signed-out users cannot reset
their password.

### 4. The 35 minor findings (medium)
Skipped by the Owner's choice when scope was set to "root causes + blocking +
major". All listed with evidence in `THERAPIST-FINDINGS.md`.

---

## ADDED 2026-09-09 — found while building in-app staff logins

Deferred by the Owner. Full context: `PLAN-staff-logins-in-app.md`.

### ⛔ 5. Signing out logs that person out on EVERY device (small — one line)

`src/app/admin/signout/route.ts:6` calls `signOut()` with no scope. supabase-js
defaults to **global**, so every session for that user is killed everywhere.

**A therapist signing out on their phone is logged out of the practice desktop
mid-shift.** With one clinic computer likely shared between people, that is a
daily annoyance rather than a theoretical one.

*Fix:* `signOut({ scope: "local" })`.

⚠️ **Why it is worth doing despite being one line:** it nearly ended a test run —
an agent almost destroyed the Owner's working session by clicking Sign out in a
second browser, because the two sessions were not independent.

⚠️ **Think before flipping it.** Global sign-out is the correct behaviour for
"my account is compromised, log me out everywhere". Local is right for the
everyday case. Ideally the everyday button is local and a separate deliberate
control does global — but a plain switch to local is still a clear improvement
over the current surprise.

### 6. Deleting a staff member silently anonymises their audit trail (medium)

`audit_logs.actor_staff_id` is `ON DELETE SET NULL`, and a null actor renders as
**"System"** (`audit/page.tsx:272`). So removing someone re-attributes their past
actions to the machine. **205 rows are already in this state.**

⚠️ The 2026-09-03 account wipe worked around this by snapshotting names into
`after_state` first, but nothing does that automatically — the next person deleted
through the UI loses their attribution silently.

*Fix:* write the snapshot in the delete path, the way the wipe did by hand.

### 7. Hydration mismatch on `/admin/audit` (small)

`<details open="">` differs between server and client on the audit event cards.
Console warning only; no visible breakage observed.

### 8. A used reset link says "expired", not "already used" (tiny)

Possibly deliberate — refusing to distinguish the two is a reasonable
anti-enumeration stance. Recorded so it is not re-reported as a bug.

### 9. Signed-out pages are light-only (tiny)

`/admin/login` and `/admin/password-reset` render identically under
`prefers-color-scheme: dark`. Contrast is fine; this is a consistency gap, not a
defect.

### ⚠️ 10. Every other admin dialog can trap its buttons off-screen (medium)

The shared `DialogContent` (`src/components/ui/dialog.tsx:46`) is vertically
centred with **no `max-height` and no overflow**, while `body` is scroll-locked.
Any dialog taller than the viewport puts its own buttons out of reach.

The Add-staff dialog hit this once a password field was added, and was fixed
**locally** (`NewStaffForm.tsx`) rather than in the shared component — changing
every dialog in the admin as a side effect of one feature was the larger risk.

*Fix:* add `max-h-[calc(100dvh-2rem)] overflow-y-auto` to the shared component,
then re-check the taller dialogs.

---

## ⚠️ NOT A CODE DEFECT, but worth knowing

**The Next dev server prints server-action arguments to the terminal**, so every
local sign-in writes that email **and password in clear text** to the console —
including the Owner's, against the live database. Anyone with access to that
terminal or its scrollback has live credentials. Nothing to fix in this repo;
just do not share that window or paste its scrollback.

---

## F. EXAMINED AND ACCEPTED — never re-report these

| Item | Why it stands |
|---|---|
| 768px nav strip scrolls (~3 of 5 links visible) | Fitting five needs 207px that do not exist. An edge fade signals the scroll. |
| "Templates" tab off-screen on `/admin/emails` at 320 | The strip is swipeable. Reachable, not discoverable. |
| Two different phone row-menu shapes | Services/Bookings are bottom sheets; Clients is an anchored popover because its library positions with a transform. Unifying is a redesign. |
| Sticky header covers content when scrolled | That is a working sticky header. It never stuck before. |
| A control under the bottom tab bar at opening scroll | Self-resolves on scroll. Refused by the adversarial pass. |
| Therapists have no nav link to `/admin/emails` | Owner's decision 2026-09-03: **leave hidden**. |
| Homepage's 645 off-edge elements | **Answered** — carousels and SVG internals. Mask lifted, document stays 320px, real overflow 0. Not a defect. |

---

## G. ⚠️ Limits of the measuring instrument

Not product defects — defects in how it was measured. They change how the audit
numbers should be read.

1. **`obscuredInteractive` has false positives.** Elements merely **below the
   fold** were counted as unreachable. Two claims in my own briefing dissolved.
2. **A void cell reads as a perfect score.** One cell recorded HTTP 200 with no
   measurement block; the comparison scored it **0**, which looked like a
   flawless improvement. Count cells that actually carry a measurement before
   trusting any total.
3. **`clipped` going up can be a fix.** Text truncating with an ellipsis counts
   as clipped; the same text sliced mid-word did not.
4. **Nothing was tested on real hardware.** All emulated Chromium.

---

## H. Deployment status

✅ **PUSHED AND LIVE 2026-09-09** — `03e6d83..8f71644c`, **5 commits**: staff
sign-in accounts creatable from the admin, the approval flow's one-time link
fixed, the password-reset status page made honest, one shared password rule, and
this documentation. Live verified **8/8** by
`node scripts/verify-live-after-deploy.mjs` — banner present (2 markers,
unchanged), **0 booking-dialog markers**, no 5xx. **0 unpushed.**

State at that push: `tsc` 0 · **3,165 tests pass** across 263 files · lint
unchanged (6 pre-existing problems, all in booking/home files) · production build
clean · working tree clean.

⛔ **TWO THINGS THAT NEARLY WENT WRONG — read before the next deploy.**

1. **`git add redesign/admin-ui-audit/` staged 21,635 files and 38.6M
   insertions**, including full-page screenshots of `/admin/audit` — the one
   screen that still shows deleted clients' names, emails, phones and home
   addresses. Into a **PUBLIC** repo. Caught before pushing; the commit was
   undone and every capture directory is now gitignored (`raw*/`, `canary/`,
   `digest/`, `findings/`, `review/`, `seed/`, `reference/`, and `_*` scratch).
   Confirmed **0 capture files reached origin**.
   ⚠️ **Check what you are staging before you stage it.** A directory add on a
   working tree is how this happened.
2. **Two real personal email addresses** in the account-reset plans were masked
   at the same time. The decision they record is unchanged.

---

### Previous deploy, retained for reference

✅ **PUSHED AND LIVE 2026-09-03** — `fdeb273..03e6d83`, 70 commits (47 admin
responsive repair + 23 therapist audit and fix pass). Cloudflare rebuilt
automatically; the live site verified **8/8 three times, spaced.**

Proof the new build shipped: the served stylesheet contains
`:is(p,h1,h2,h3).truncate{text-wrap:nowrap}`, a rule committed that day.

⛔ **NEVER run `pnpm deploy` / `pnpm upload`.** They build on the developer's
machine and would inline the local `NEXT_PUBLIC_BOOKING_ENABLED=true`, **opening
live bookings**. Deploy by `git push` only — README documents only the manual
path, which is the trap.

⚠️ Deploying does **not** open the live booking page — but the reason matters,
and an earlier version of this file gave the WRONG one. It is **not** a database
row and **not** a Cloudflare setting.

**The actual mechanism** (`src/lib/maintenance.ts:34`):
`MAINTENANCE_MODE = process.env.NEXT_PUBLIC_BOOKING_ENABLED !== "true"` — opt-OUT.
`.env` is gitignored, so the flag exists locally and is simply **absent** on
Cloudflare, which builds from the repo. **Absence is the control.** Nothing is
configured anywhere to keep the site closed, and none of the 70 commits touch it.

⛔ **Name the surface, always.** Two independent switches:
- the booking **PAGE** — closed by that build flag;
- the booking **ENDPOINT** (`POST /api/bookings`) — **open**, because
  `business_settings.booking_status_enabled` is `true`. The Owner was shown this
  on 2026-08-30 and chose "option C: leave it" (D31). ⛔ **A decision, not an
  oversight — do not re-open it.**

State at hold: `tsc` 0 · **3,157 tests pass** across 263 files · production build
clean · database **BASELINE EXACT** · customer site verified untouched.
