# PLAN — seed therapist test data, then audit the therapist screens properly

**Status:** ✅ **DONE 2026-09-03.** Seeded, audited, fixed, and TORN DOWN the
same day. Database verified **BASELINE EXACT** — no test data remains. ⛔ What actually happened, including two traps this plan
did not foresee, is in `seed/RUN-LOG.md` — read that alongside this.
**Written** 2026-09-02 · at HEAD `bc6e5e8` (47 admin commits, unpushed)
**Prerequisite:** database at `BASELINE EXACT`

---

## 1. Why this exists

The admin audit covered four roles. Three are trustworthy. The therapist's is not,
for one reason:

> `Test Therapist` (`884311b1-e9d0-44b9-91f3-14188a3baf59`) has **ZERO assigned
> bookings**. Confirmed by query: `test_therapist_bookings = 0`.

Every list that role renders is an empty state. **An empty list cannot overflow**, so
the audit could not tell a sound layout from a broken one. Where the therapist scored
zero defects, that number means "nothing was tested", not "nothing is wrong".

The fix is to give that account realistic work, then run the same visual audit the
other three roles got.

---

## 2. ⛔ Safety — established by query, not assumed

### 2.1 Seeding by SQL sends no email

I checked every trigger on the tables involved:

| Table | Triggers |
|---|---|
| `bookings` | `updated_at`, `completed_at`, `stamp_recurring_occurrence` — all stamps |
| `booking_assignments` | `updated_at` — a stamp |
| `clients` | `updated_at` — a stamp |
| `booking_participants`, `booking_items`, `email_delivery_events`, `audit_logs` | **none** |

**No trigger sends anything.** Email in this system is fired by server actions and API
routes — the application layer. A direct `INSERT` bypasses all of it.

⛔ **This is the whole reason the plan seeds by SQL and never through the app.** Doing
it through the UI would fire `staff_assignment` and booking-confirmation emails at
real addresses, and would spend against the 100/day Resend cap (D3).

### 2.2 Seeding by SQL writes no audit rows

`audit_logs` rows are written by the application, not by triggers. This matters
because **audit rows must never be deleted** — G31 established that deleting them to
make a number match falsifies the audit trail, and the project's own integrity script
treats `audit_logs` as "recorded, never asserted". Seeding by SQL avoids creating the
problem rather than having to clean it up.

### 2.3 Nothing real is touched

Every row is **new** and carries a run marker. No existing booking, client,
assignment or staff row is modified. The 14 real bookings and 14 real clients are
read-only throughout.

⛔ **Never touch:** `Minhaj rahman` (`01582c5d-…`, the real Owner) or the real client
`Badar`. ⛔ **Never seed against** `Test Therapist Fresh` (`87e01c11-…`) — a different
account that is deliberately never available.

### 2.4 Constraints the SQL must satisfy

Read from the live schema:

- `bookings_time_check` — `end_time > start_time`. ⚠️ G5: a past fixture set
  `start_time` without moving `end_time` and three runs blamed the app for it.
- `booking_source` ∈ `website, phone, whatsapp, instagram, referral, admin, manual, other, recurring`
- `reschedule_status` ∈ `none, requested, reviewed, declined, completed`
- `amount_paid >= 0`, `amount_due >= 0 or null`
- `booking_items.service_duration_snapshot > 0`

---

## 3. ⛔ What the code actually requires — the eight facts that decide the seed

Four agents read the therapist surfaces. These change the shape of the data:

**1. The dashboard is a ONE-DAY window.** `dashboard/page.tsx:80-82` always passes
`from = to = today`, and `parseReportFilters` prefers explicit values over range
defaults. So the header, today's list, "My week", recent clients and the visit counts
**only ever see bookings dated today**. ⛔ Seeding "next week" lights up almost
nothing.

**2. `today` is a Europe/London date** (`_helpers.ts:198-205`). Seeding from a UTC
session near midnight lands on the wrong day. The SQL must compute the date in
London, not rely on `CURRENT_DATE`.

**3. There are TWO different "assignment status" columns**, and both must be set:
- `bookings.assignment_status` ∈ `unassigned, partially_assigned, fully_assigned` — drives the badges and filters
- `booking_assignments.status` ∈ `unassigned, assigned, completed, cancelled, no_show` — only `assigned` makes the therapist's own action buttons render

**4. `booking_items` are not optional.** Without one, every card reads "· Visit", the
hero has no duration and the service mix renders nothing.

**5. Revenue needs the participant chain.** `booking_items.booking_participant_id`
must match the `participant_id` on the therapist's assignment, or attributed revenue
stays £0.

**6. Claimable work is gated on an EXACT gender match** — `required_therapist_gender`
must equal this therapist's `staff_profiles.gender`, with no null-tolerance.

**7. Claimable rows are MASKED.** Any booking not assigned to the viewer renders as
`contact_full_name = 'Claimable booking'` with client fields nulled. ⛔ So long-name
truncation cannot be stressed through claimable work — it needs **assigned** bookings.

**8. Cancelled and no-show are hidden on every view a therapist can select.** Seeding
them tests nothing for this role.

### Things seeding CANNOT fix — do not attempt them

| Screen / feature | Why |
|---|---|
| `/admin/staff/[id]/performance` | **Redirects to `/admin/me`** for a therapist, always. Not auditable for this role |
| The "Next visit" hero | Requires `booking_date > today` but is fed today-only data. Unreachable by any seed |
| "Tomorrow: N visits" | Computed from today-only data — always 0 |
| Utilisation ring | Needs `staff_availability_rules` rows for this therapist; she is `use_global` with none |
| Enquiries / email / operations panels | Return empty for a therapist by scope, whatever is seeded |
| Audit "Activity" panel on booking detail | Never fetched for a therapist |

⚠️ **Utilisation is the one exception worth seeding deliberately** — adding
`staff_availability_rules` rows (day_of_week 1–6; Sunday is closed) would light up the
ring and the availability editor, which are otherwise permanently empty. That is a
judgement call for the Owner: it changes what the clinic *sells* if left in place, so
it must be torn down without fail (G13 — a stray availability row silently changes
what the business offers).

---

## 4. The seed

**Marker:** every seeded row carries `ZZTEST-THERAPIST-AUDIT` in a text field
(`clients.full_name` prefix, `bookings.admin_notes`). Teardown sweeps by **marker**,
never by a captured id — G19: an aborted run still creates rows, and a teardown gated
on having captured an id cleans up nothing in exactly the case that needs it.

### 4.1 Clients — 6 rows

Chosen to stress the layout faults the audit already found:

| # | Purpose |
|---|---|
| 1 | A very long name — **the `/admin/clients` truncation bug** ("N…") reproduced for a therapist |
| 2 | A non-Latin name (Arabic or Chinese) — the audit found these overflow worst |
| 3 | A long email address — this widened the whole staff profile at 320 |
| 4–6 | Ordinary short names, as a control |

### 4.2 Bookings — 14 rows

| Group | Count | Date | Status | Why |
|---|---|---|---|---|
| Today, assigned | 4 | today (London) | `confirmed` ×2, `pending` ×1, `completed` ×1 | **The dashboard only sees today.** Wide time spread (08:00→19:30) so the working-window label stresses |
| This week, assigned | 4 | Mon-of-week → today | `completed` | Feeds the Personal Contribution stripe and "completed sessions" |
| Future, assigned | 3 | today+1 … today+7 | `confirmed` | The bookings list, and the upcoming-work panel |
| Claimable | 2 | today … today+7 | `pending`, unassigned, gender-matched | The claim strip and its promoted state |
| Group booking | 1 | today | `confirmed`, **3 participants** | The group card branches on participant COUNT, not the flag |

Every booking gets: a `booking_participants` row per participant, a `booking_items`
row linked to that participant, a real `services` id, `end_time > start_time`,
`booking_source = 'admin'`, and `bookings.assignment_status` set consistently.

### 4.3 ⛔ The cache problem, and how it is handled

**Every therapist surface is `unstable_cache`'d for 60 seconds**, keyed per staff id:
dashboard (`dashboard-data.ts:171-196`), bookings list (`bookings-list-data.ts:1006`),
booking detail, staff list, staff detail, performance data.

⛔ **Rows written directly to Postgres invalidate nothing.** G1 is explicit: *never
assert that a directly-seeded row appears on a cached list.*

**Handling:** seed → **restart the production server** (which empties the in-process
cache) → wait → verify the data is visible before capturing anything. ⛔ And prove the
instrument first: confirm one seeded booking is on screen before trusting a whole
capture run, or the audit measures empty states again and calls them clean.

---

## 5. Teardown — designed before the seed, not after

⛔ G11: sweep order is load-bearing. `operational_events.booking_id` is
`ON DELETE SET NULL`, so deleting a booking **orphans** those rows instead of removing
them, leaving them permanently untraceable.

**Order:**
1. `operational_events` where `booking_id` ∈ seeded bookings — **before** anything else
2. `booking_items` → `booking_assignments` → `booking_participants` → `bookings`
3. `clients` matching the marker
4. `staff_availability_rules` for this therapist — **only if seeded**
5. Re-run `verify-baseline.mjs` and require **`BASELINE EXACT`**

⛔ Teardown runs **unconditionally**, whether the run succeeded, failed or was
interrupted, and sweeps by marker so a run that died before recording an id still
cleans up. ⛔ `audit_logs` is **not** swept — nothing the seed does writes to it, and
deleting audit rows would falsify the trail.

---

## 6. The audit, once the data is in

Identical method to the other three roles, so the results are comparable:

1. Capture all **32 pages × 5 widths** as `therapist_a` → `raw-therapist/`
2. Compare against the therapist's current empty-state capture — **every number that
   moves is a layout fact that was previously untestable**
3. A visual review of every page at 320 / 768 / 1280, plus the menu screenshots
4. Fix what it finds, re-measure, and hold to the same rules: **a fix whose number
   does not move is reverted; anything that worsens 1280 is reverted**
5. Public canary before and after — 28 cells, must stay identical

**Expected to surface:** the client-name truncation that scored a perfect 0/0/0 for
the owner, row-action menus under the bottom bar, and per-row chips that only appear
when a booking has real content.

---

## 7. ⛔ Decisions for the Owner before anything runs

| # | Decision | Recommendation |
|---|---|---|
| 1 | **Write to the live database at all?** It is your production data, even though the rows are new, marked and swept. | **Yes** — it is the only way to audit these screens, and the safety analysis in §2 is solid. |
| 2 | **Seed `staff_availability_rules` too?** It lights up the utilisation ring and availability editor, otherwise permanently empty. ⚠️ A stray rule changes what the clinic sells. | **Yes, but last and torn down first** — and only with the teardown proven on a single row beforehand. |
| 3 | **Timing.** Seeded rows are visible to anyone signed in while they exist. | **Run it in one sitting**, seed → capture → teardown, ~2–3 hours, rather than leaving data in place overnight. |
| 4 | **The one remaining bare 404.** A therapist assigned to a client whose record is soft-deleted still hits an unstyled Next.js 404 — there is no `not-found.tsx` anywhere in the app. | **Fix separately** — it is a real gap, unrelated to seeding, and cheap. |

⚠️ **Good news found during research:** the bare 404 on `/admin/clients/[id]` that the
audit reported is **already fixed at HEAD** (commit `f3317be` reordered the refusal
before the existence check). Only the soft-deleted-client path remains.

---

## 8. Estimated shape

| Step | Time |
|---|---|
| Write and review the seed SQL | 30 min |
| Seed + restart + verify visible | 20 min |
| Capture 160 cells (therapist × 32 × 5) | ~35 min |
| Visual review | ~40 min |
| Fixes + re-measure | variable |
| Teardown + baseline verification | 15 min |

⛔ **The teardown is not optional and not the last thing to be thought about.** It is
written and tested on one row **before** the full seed goes in.
