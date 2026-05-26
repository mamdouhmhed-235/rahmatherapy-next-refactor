# C-A.3 R04 — Therapist day audit (worker app experience)

**Audit type:** C-A.3 role-day discovery (no fixes)
**Role:** Therapist (`test.therapist@rahmatherapy.example.test`)
**Day walked:** Mobile-first fieldwork — today's visits + next visit + claim a slot + complete a booking + add a session note
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `1a5f675`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Predecessor audits referenced:** C-A.1 #04 (booking detail Therapist narrowed view), #11 (staff detail self-view), #13 (performance self-redirect), #14 (/admin/me — Therapist's home), W05 (claim/assignment/completion), W04 (cancellation).
**Roles swept:** Therapist scope inferred from RBAC predicates + C-A.1 audits.

---

## 1 — Therapist's heavy narrowing (vs other roles)

| Surface / capability | Therapist has? | Source |
|---|---|---|
| `/admin/dashboard` | ✅ but TherapistDashboard variant — different layout | per `dashboard/TherapistDashboard.tsx` (existence per #01 audit) |
| `/admin/bookings` (assigned + claimable view) | ✅ scoped via `getScopedBookingIds` per `bookings/page.tsx:107-133` | only sees own + claimable |
| `/admin/bookings/new` | ❌ AdminAccessDenied per #03 CR-09 | "Bookings are created by coordinators and admins" |
| `/admin/bookings/[id]` | ✅ narrowed (no audit log panel, no full Status form) | per #04 CR-12 |
| `/admin/clients` | likely ❌ unless `canViewAssignedClients` | depends on grant |
| `/admin/clients/[id]` (for assigned clients) | ✅ narrowed view | per #07 — limited fields, no full edit |
| `/admin/enquiries` | ❌ middleware-blocked | per #08 CR-17 |
| `/admin/calendar` | ✅ likely scoped to own assignments | per #09 |
| `/admin/staff` list | ❌ likely | not in their workflow |
| `/admin/staff/[selfId]` | ✅ own profile only | per #11 |
| `/admin/staff/[selfId]/availability` | likely ❌ for Therapist (admin manages availability) — C-A.1 finding | per #12 |
| `/admin/staff/[selfId]/performance` | ✅ self-redirects to `/admin/me` | per #13 |
| `/admin/me` | ✅ **PRIMARY HOME** | per #14 |
| `/admin/availability` global | ❌ | settings-adjacent |
| `/admin/services` | ❌ | |
| `/admin/settings` | ❌ | |
| `/admin/operations` | ❌ | |
| `/admin/emails` | ❌ | |
| `/admin/roles` | ❌ | |
| `/admin/privacy` | ❌ | |
| `/admin/audit` | ❌ | |
| `/admin/reports` | ✅ auto-Personal (toggle hidden) | per W08 W08-E-1 |

**Effective Therapist scope:** `/admin/me` (home) + `/admin/bookings` (assigned + claimable) + `/admin/bookings/[id]` (narrowed) + `/admin/reports` (auto-Personal). **Their entire admin experience is ~4 surfaces.**

---

## 2 — Therapist's day walk (mobile fieldwork)

### 7:30 AM — Morning check (at home, on phone @ 375)
Therapist opens `/admin/me` on their phone. Sees:
- Recent Activity (capped at 20 per #14 + master-plan-stale-example correction).
- Today's assignments (likely).
- Performance metrics.

**Therapist-specific friction:**
- **Mobile sticky bottom bar:** does /admin/me have a "today" focal element above-the-fold? Per #04 V-13 the booking detail has poor mobile sidebar ordering — same risk on /admin/me.
- **First-glance "what's my day?"** — Therapist arriving in admin should immediately see "You have 3 visits today. Next: Sara at 10:00 in Luton LU1." If they have to scroll through Recent Activity to find today's visits, that's broken UX.

### 8:00 AM — Open Today's bookings
Therapist navigates `/admin/bookings` → "Today" tab? Or "Assigned" tab?

Per `bookings/page.tsx:174`: `(view === "assigned" && isOwnBooking(booking, profile))` — there's an "Assigned" view. Per:174, also "Today" view filters by date.

**Therapist friction:**
- Default view is "Attention" (R01 B-156) — irrelevant for Therapist.
- Therapist must click "Today" or "Assigned" to see what they care about. Two clicks before they see today's visits.
- **R04-V-1 (NEW):** Therapist's default landing page on /admin/bookings should be "Assigned + Today" — not "Attention".

### 8:30 AM — Get directions to first visit
Therapist clicks on first booking → narrowed booking detail page. Sees:
- Client name + visit location (sidebar; per #04 V-13 mobile sidebar order is wrong).
- Their assignment row.
- Treatment-note prompt.

**Therapist friction:**
- **V-13 #04 mobile sidebar order** — Therapist on a 375 phone has to scroll PAST main panels (Status, Notes, Participants, Assignment, Email activity) to reach the sidebar with the CLIENT PHONE + ADDRESS. The most critical mobile info is hardest to reach. **R04 surfaces this with elevated severity** because Therapist is the role most affected.
- **No "Call client" tap-target** — phone number is a `tel:` link (per #08 enquiries pattern; need to verify #07 client detail does same). If yes ✅; if not, friction.
- **No "Navigate" / "Open in maps"** affordance on the address — Therapist has to copy-paste the address into their map app. Could be one tap.

### 10:00 AM — Arrive, perform treatment, mark complete
Therapist completes the visit. Opens the booking detail → finds the "Mark complete" affordance.

Per W05 R04 walk:
- Therapist uses `updateOwnAssignmentStatus` action — different from admin's `quickUpdateBooking`.
- The booking's overall status stays where it was (W05 B-129 — independent state-machines).

**Therapist friction:**
- B-129: Therapist marks ASSIGNMENT complete; booking status stays `confirmed`. Therapist doesn't realise this; admin has to come along later and mark booking complete too.
- If C-01 review email is built later (per W03 §11), the trigger choice (booking-level OR all-assignments-completed) matters — Therapist's mental model says "I completed it; the customer should get the review email NOW".

### 10:30 AM — Add session note
Per #07 audit + RBAC `canCreateSessionNotes`: Therapist with permission can add session notes on assigned bookings. Mobile keyboard pop-up + textarea.

**Therapist friction:**
- **No voice-to-text affordance** — textarea is plain. Common workflow expectation in mobile field apps.
- **No template / quick-snippets** — every session note typed from scratch. After 5 visits, this is repetitive.
- **No "save draft" on the note** — if Therapist is interrupted mid-note (client asks question), do they lose it? Out of scope to verify; flag for #07 follow-up.

### 11:30 AM — Travel to next visit
Therapist returns to `/admin/bookings?view=assigned` (their home view conceptually) to see next visit. The "Today" tab works; the "Assigned" tab shows all their assignments including past + future. **Filter rigor matters.**

**Therapist friction:**
- No "next visit" widget on /admin/me — they have to mentally compute "what's after 10 AM that I haven't done yet".
- The browser may have cached the previous page state; Therapist taps Back instead of opening Bookings nav, but Back goes to the completed-booking detail (not the list).

### 1:00 PM — Notice claimable slot
Therapist's phone buzzes — they happened to look at `/admin/bookings?view=claimable`. They see an unassigned slot at 3 PM that matches their gender.

**Therapist friction:**
- Per W05 PE-1: atomic conditional UPDATE prevents double-claim race ✅.
- Per W05 B-126: cancelled bookings can still be CLAIMED at the data layer if accessed via deep link (predicate gap). At LIST level the in-memory view filter excludes cancelled, so this shouldn't bite typical Therapist usage.
- Per W05 B-127: if a previously-assigned booking gets reassigned away from Therapist (Admin reassigns to a colleague), Therapist gets no email. They show up; awkward.

### 4:00 PM — End of fieldwork
Therapist returns home. Opens /admin/me to confirm everything is logged.

**Therapist friction:**
- Performance metrics on /admin/me refresh — but only after natural cache TTL or revalidation. If Therapist's recent claim/completion isn't reflected, they wonder "did it save?"
- No "send daily summary" / "EOD" view.

---

## 3 — Therapist-day-specific findings

### B-164 — Booking detail mobile sidebar order BURIES the most critical mobile info (client phone + address)
**Severity:** HIGH for Therapist (workflow showstopper at mobile) — already documented as #04 V-13 but elevated by R04 to "headline" because Therapist is the primary user of this surface at mobile
**Source:** #04 V-13. The sidebar (client info + visit location + price) flows below the main panels at mobile. Therapist arriving at a client's address on their phone has to scroll through 5+ panels (Status, Notes, Participants, Assignment, Email activity) before they see the client's phone number.
**Decision:** for Therapist's view (narrowed), reorder so sidebar is TOP at mobile (sidebar contains the most-critical info). **C-12+ mobile-pass OR fold into the Therapist-day-specific surface refresh.**

### B-165 — No "Next visit" widget on /admin/me for Therapist
**Severity:** medium (UX gap — workflow critical for Therapist field experience)
**Source:** observed via /admin/me code-level + #14 audit (Recent Activity is the prominent section). There's no "Next assignment" callout.
**Decision:** add a "Your next visit" card prominent on /admin/me for Therapist (or auto-Personal /admin/staff/[id]/performance). Shows: client name, address, time, route-link. **C-12+ Therapist UX OR fold into C-11 dashboard refresh.**

### B-166 — Address field has no "Open in maps" affordance
**Severity:** medium (UX friction — Therapist copies address every visit)
**Source:** observed at /admin/bookings/[id] sidebar. Address is plain text (or `<address>` element). No `<a href="https://maps.google.com/?q=ADDRESS">` link.
**Decision:** add a "Navigate" link tap-target. Detect platform → open in iOS Maps / Google Maps. **C-12+ Therapist UX.**

### B-167 — Therapist's "Bookings" default tab is "Attention" (irrelevant) — should be "Assigned" or "Today"
**Severity:** medium (default-view preference for the role)
**Source:** R01 B-156 + R04 walk. The bookings list defaults to "Attention" regardless of role. Therapist sees a pile of pending/unassigned/customer-cancelled rows they CANNOT act on. **They have to find their relevant tabs.**
**Decision:** per-role default-tab — Therapist should default to "Assigned" or "Today". C-12+ default-view + per-role config.

### B-168 — Therapist marks own assignment complete; booking status stays at `confirmed` — implicit knowledge required
**Severity:** medium (mental-model gap — surfaced by R04, root cause is W05 B-129)
**Source:** W05 B-129. Therapist's mental model says "I completed it". System's state-machine says "assignment complete but booking not". Admin has to come along and mark booking complete too.
**Decision:** **two paths**:
- (a) Auto-promote booking.status to completed when ALL assignments are completed (RECOMMENDED for low-friction).
- (b) Surface a clear "Assignment marked complete. Admin will close the booking." status banner so Therapist knows the booking isn't fully closed.

(a) is cleaner — folds into C-04 lifecycle plan.

### B-169 — No session-note draft persistence
**Severity:** low-medium (mobile field reality — interruptions are common)
**Source:** observed at #07 client detail (which surfaces session notes). The note input is a plain textarea; no autosave to localStorage or server-draft.
**Decision:** add localStorage autosave (similar pattern to ManualBookingForm — per #03 E-09). C-12+ Therapist UX.

---

## 4 — Therapist-relevant cross-page rhythm gaps

| Therapist workflow step | Gap | Source |
|---|---|---|
| Morning check (/admin/me) | No "Next visit" widget | **R04 B-165** |
| Default landing on /admin/bookings | "Attention" tab irrelevant | **R04 B-167** |
| Open booking detail at mobile | Sidebar buried below main panels | #04 V-13 + **R04 B-164 elevated** |
| Get to client phone | Multi-scroll on mobile | #04 V-13 |
| Open address in maps | No affordance | **R04 B-166** |
| Mark visit complete | Assignment vs booking status confusion | W05 B-129 + **R04 B-168** |
| Add session note | No draft persistence + no voice-to-text + no templates | **R04 B-169** |
| Notified of reassignment | No email | W05 B-127 |
| Find next visit | Manual mental computation | R04 B-165 |

---

## 5 — Items for plans

| # | Finding | Best home |
|---|---|---|
| 1 | B-164 — booking detail mobile sidebar order | **C-12+ Therapist UX** (or fold into C-11) |
| 2 | B-165 — no "Next visit" widget on /admin/me | **C-12+ Therapist UX** |
| 3 | B-166 — no "Open in maps" affordance | C-12+ |
| 4 | B-167 — Therapist default bookings tab | C-12+ default-view |
| 5 | B-168 — assignment vs booking status semantics | C-04 lifecycle (auto-promote pattern) |
| 6 | B-169 — no session-note draft persistence | C-12+ |
| (others) | C-A.1 + C-A.2 + R01/R02/R03 findings | as per those audits |

---

## 6 — Hand-off

**State:** 0 screenshots. 0 code changes. 0 prod DB writes. 6 new bugs (B-164 → B-169).

**R04 summary insight:** Therapist's day is the FIRST mobile-field experience in the admin. The current admin is **mobile-friendly** (per C-A.1 #04 + #11 mobile findings) but is NOT **field-optimised**. The most critical mobile info is hardest to reach (B-164); the role-specific defaults are wrong (B-167); the navigation primitives Therapist needs (B-165 next-visit, B-166 maps link) are absent.

**C-12+ Therapist field-experience plan** is a natural emerging category — most of these findings cluster there. **Recommend folding into a "Therapist Field Experience" mini-plan inside Band C, alongside C-11 dark mode.**

**Next:** R05 Therapist-Fresh first-day audit.

**Bug index advance:** B-163 → B-169. Next available: B-170.

*End of R04 therapist-day audit.*
