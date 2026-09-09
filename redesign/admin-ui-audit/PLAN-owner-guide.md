# PLAN — a visual "how to use your admin" guide for the client

**Written** 2026-09-09
**Status:** ⛔ **PLAN ONLY. Nothing seeded, nothing captured, nothing written.**

**Goal:** one self-contained HTML file, mostly pictures, that a non-technical clinic
owner can read in ten minutes and then start using the admin.

---

# ⛔ The constraint that shapes everything

**The database is empty** — 0 clients, 0 bookings, 1 account. Screenshots taken today
would be blank screens and one lonely Owner login. A guide made of empty pages teaches
nothing.

**So the guide is built on temporary demo data**, then the demo data is destroyed.

⚠️ **Everything created is temporary and tracked.** Every id is written to a manifest
as it is created, and teardown deletes exactly that list — the four demo logins
included. Same pattern that ran cleanly twice before.

---

# Owner's decisions (settled)

| | |
|---|---|
| **Data** | Made-up, realistic-sounding, **deleted afterwards along with the demo users** |
| **Depth** | ~15–20 screens. Rare corners get a sentence, not a walkthrough |
| **Output** | A file in the local repo. No hosting, no link |

---

# Sub-agent budget — 2 agents

The Owner's concern was **not sending hundreds of agents**, not micro-managing what any
one of them does. So: few agents, each given room to do the job properly.

| # | Agent | Job |
|---|---|---|
| **1** | **Capture + copy** | Signs into all four roles, screenshots at 375px, writes plain-English notes per screen |
| **2** | **Fresh-eyes review** *(after the HTML exists)* | Reads the finished guide as a newcomer and says what is unclear |

⛔ **One capture agent, not four.** Four role-agents would need four browsers, collide on
the same database, and cost roughly 4× for work that is sequential anyway.

⛔ **Seeding, teardown and writing the HTML happen here, not in an agent** — SQL and
file-writing, where an agent adds cost and no judgement.

### How agent 1 should work

- **Save screenshots to `guide-shots/<role>-<screen>.png`.** ✅ **Look at them when it
  helps** — checking the framing is right, that nothing important is cut off, that the
  screen actually shows what the caption will claim. Quality matters more than frugality
  here.
- **The screen list below is the floor, not the ceiling.** If something genuinely
  deserves a picture, capture it and say why.
- ✅ **Re-take a bad shot.** A screenshot mid-load, with a menu open by accident, or
  scrolled to the wrong place is worse than none.
- Write notes to `_guide-notes.md` as it goes.
- One browser, one pass, roles in order: Owner → Admin → Coordinator → Therapist.
- ⚠️ Sign out between roles **in Playwright only**.

---

# The five steps

### 1. Seed the demo clinic — *here, ~20 min*

Realistic but obviously-not-real people. **No real names, no real emails.**

- **6 clients** — e.g. Sarah Ahmed, Yusuf Patel, Aisha Khan… all `@example.test`
- **~10 bookings** — some today, some this week, one completed, one cancelled,
  one needing attention
- **1 enquiry** waiting, **1 pending password request** (so those screens are not empty)
- **4 logins**, one per role: Owner (the real one, untouched), plus demo **Admin**,
  **Booking Coordinator**, **Therapist**

⛔ The three demo staff are created **through the new Add-staff feature**, not by SQL —
it proves the feature and produces an accurate screenshot at the same time.

⚠️ **Manifest first.** Every id appended to `_guide-manifest.json` as it is created.
Teardown reads that file. Nothing is deleted that is not on it.

### 2. Capture — *agent 1*

375×812. Saved as `guide-shots/<role>-<screen>.png`.

**The screen list (~18):**

| Group | Screens |
|---|---|
| Getting in | login · dashboard (Owner) |
| The day | today's bookings · a booking's detail · confirm/complete actions |
| Bookings | list · new booking · reschedule |
| People | clients list · one client · staff list · **add staff member** |
| Inbox | enquiries · one enquiry |
| Settings | services · availability |
| Other roles | Admin dashboard · Coordinator dashboard · Therapist "my day" |

### 3. Notes — *agent 1, same pass*

Per screen, three lines: **what it is · what you do here · what beginners get wrong.**
Plus one honest list of anything confusing, unlabelled, or surprising.

### 4. Build the HTML — *here*

Sections: **Start here → Your day → The four roles → Common jobs → When something looks
wrong.**

Screenshots embedded as data URIs so it is one portable file. ⚠️ Compressed — a
screenshot-heavy page gets large fast; target well under 20MB.

Plain words. No jargon. Short sentences. A picture beside every instruction.

### 5. Tear down — *here*

Delete exactly what the manifest lists — bookings, clients, enquiry, request, and the
**three demo logins**. Then `verify-baseline.mjs`.

⚠️ **The audit rows stay**, as always. The teardown report says how many.

---

# ⚠️ Known and accepted

- **The guide's screenshots will show demo data for ever.** That is the point — they are
  illustrations. The names are plainly not real patients.
- **The Owner's own account is never touched** — not its password, not its theme.
  ⛔ Agents must not use the in-app theme switcher; it writes to the signed-in user's row.
- **Audit rows are permanent.** Seeding and tearing down will add some.
- The guide describes the site **as it is on 2026-09-09**. If screens change later, it
  needs re-capturing — worth a dated line in the footer.
