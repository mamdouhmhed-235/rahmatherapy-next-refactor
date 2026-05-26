# C-A.2 W06 — Client creation + first booking flow audit

**Workflow:** `/admin/clients/new` (or `?clientId=` deep link from elsewhere) → form submit → `/admin/clients/[id]` → "Book again" CTA → `/admin/bookings/new?clientId=<id>` (prefilled) → submit → `/admin/bookings/[bookingId]`.
**Audit type:** C-A.2 cross-page workflow discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `6e04030`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Predecessor audits referenced:** C-A.1 #05 (clients list), #06 (clients new — DuplicateWarningBanner pattern), #07 (client detail — booking history + edit gap B-34), W01 (enquiry prefill — same form layer), W02 (SQL RPC client-overwrite behaviour B-110).
**Source surveyed:**
- Client creation: `src/app/admin/clients/actions.ts:117-223` (`createClient` server action).
- Booking form client-prefill plumbing: `src/app/admin/bookings/new/ManualBookingForm.tsx:518-530, 636-639`.
- Booking server action: `src/app/admin/bookings/actions.ts:726-960` — grepped for `client_id` plumbing.
- Cross-page links: `clients/[clientId]/page.tsx:556, :597, :868` (3 `?clientId=` links).
**Roles swept:** Owner. Coord/Admin predicate-equivalent.

---

## 1 — Step-by-step walk

| Step | Action | Side-effect |
|---|---|---|
| 1 | Navigate `/admin/clients/new` | Form renders (per #06 audit). |
| 2 | Fill in name + email + phone + address | Client-side validation runs. |
| 3 | Click "Save client" | `createClient` server action runs (actions.ts:117). |
| 4 | Server: dedup check on email AND phone (lines 153-187) | If matches exist + `confirm_duplicate` not set → returns `duplicateWarning` for the form to surface the DuplicateWarningBanner. Per #06 audit, this UI is in place. |
| 5 | Admin sees the dup warning OR proceeds | If they confirm + resubmit with `confirm_duplicate=on` → server inserts new client row (line 202-206). |
| 6 | Cache invalidation: `report-data` + `dashboard-data` tags + `/admin/clients` + `/admin/dashboard` paths | **NOT `/admin/staff` or `/admin/bookings`** — neither surface depends directly on new client; acceptable here. |
| 7 | Redirect to `/admin/clients/${newId}` | Land on the empty client detail. |
| 8 | Click "Book again" / similar CTA (3 distinct links on detail at lines 556, 597, 868) | Navigate to `/admin/bookings/new?clientId=<id>`. |
| 9 | Form renders prefilled (name, email, phone, address, postcode, city, area per `ManualBookingForm.tsx:518-530`) | Page-level: `prefillClient` populated via SELECT (per bookings/new/page.tsx:48-53). |
| 10 | Admin completes step 1-4 + submits | `createManualBooking` runs → SQL `create_booking_request` → **matches client by EMAIL via `on conflict (email) do update`** (W02 B-110). |
| 11 | Server redirects to `/admin/bookings/${bookingId}` | Standard new-booking flow from W02. |

---

## 2 — Bugs found

### B-131 — `?clientId=` prefill does NOT plumb client.id through the form — SQL matches by email instead (vulnerable to W02 B-110 + silent orphaning on email edit)
**Severity:** HIGH (data integrity — silent client-row duplication or destructive overwrite, depending on admin behavior)
**Source:** grep for `client_id|name=.client_id` in `ManualBookingForm.tsx` returns no hidden input. Grep for `client_id|p_client_id` in `bookings/actions.ts` returns no references. The `prefillClient.id` is loaded server-side (per new/page.tsx) but used ONLY to populate React state for display. The booking form POSTs ONLY field values (no `client_id`).
**SQL RPC behavior** (W02 §2): `INSERT INTO clients ... ON CONFLICT (email) DO UPDATE SET full_name=excluded.full_name, phone=..., address=..., ...`.
**Concrete failure modes:**
- **(a) Admin doesn't edit email** → SQL matches existing client by email → existing client row's `full_name`/`phone`/etc. get OVERWRITTEN by form values. **W02 B-110 destructive overwrite reaches the booking flow via this path too.**
- **(b) Admin edits email** (e.g., correcting a typo: `sara@gmial.com` → `sara@gmail.com`) → SQL no longer matches the existing client → SQL INSERT creates a NEW client row → booking attaches to the new client. Original client is LEFT orphaned in DB (still exists, no new booking attached). Original client's booking history will NOT reflect the new booking.
- **(c) Admin edits email to match a DIFFERENT existing client** (typing mistake or muscle memory) → booking attaches to the WRONG client. Original "Book again" intent lost.
**Decision:** plumb a hidden `client_id` input + server-side update the booking creation to honor it OR detect divergence and either reject or surface confirmation. **The dedicated `createClient` action has this pattern (DuplicateWarningBanner per #06); the booking flow doesn't.** Pair with C-06 (delete/dedup) AND C-12+ for the plumbing fix.

### B-132 — Asymmetry: `/admin/clients/new` has DuplicateWarningBanner; `/admin/bookings/new` (which also creates clients) does NOT
**Severity:** medium (pattern inconsistency — admins learn one dedup workflow then encounter a different one in a similar surface)
**Source:** `clients/actions.ts:153-187` has explicit phone + email dup detection with explicit user-confirmation flag. `bookings/actions.ts createManualBooking` has nothing — it relies on the SQL function's `on conflict (email)` which DOES dup-handle but DESTRUCTIVELY (B-110).
**Implication:** an admin who creates a client via the dedicated form is shown a polished "Hey, looks like Sara already exists — link or create new?" experience. An admin doing the SAME conceptual action via the booking form has zero awareness of the existing client; the SQL silently merges or creates.
**Decision:** lift the `DuplicateWarningBanner` from `/admin/clients/new` into `ManualBookingForm` (per #06 audit's "lift this pattern" finding). Fold into the C-06 plan as the recommended fix for both B-110 and B-131.

### B-133 — `createClient` server action does NOT invalidate `/admin/bookings` paths (acceptable here)
**Severity:** very low (defensive note — accept)
**Source:** `clients/actions.ts:218-221`. Invalidates clients + dashboard, but not bookings. ✅ Correct — a brand-new client has no bookings yet. Note here for symmetry with B-128 (assignment changes don't invalidate /admin/staff*) which IS a real gap.

### B-134 — Newly-created client's "first booking" CTA visibility — discoverability
**Source:** per #07 audit, `/admin/clients/[id]` has THREE `?clientId=` links to /admin/bookings/new at lines 556 (primary CTA), 597, 868 (empty-state). Three duplicate affordances. Same destination.
**Severity:** very low (UX redundancy, not a bug).
**Decision:** consolidate to one or two during C-07 routing refactor.

### B-135 — `addClientNote` server action is separate from `createClient` — first-impression notes are forced through 2 round-trips
**Severity:** very low (UX gap)
**Source:** `clients/actions.ts:225` — adding the FIRST client note requires (1) save client → redirect → (2) navigate to detail → add note via separate form → save again.
**Decision:** the create-client form already has a `notes` field (line 138-139, passed into payload at line 199). So the FIRST note CAN be entered at creation time. ✅ accept; this works. Subsequent notes use `addClientNote` which writes to a separate `client_notes` table (likely). Out of W06 scope.

---

## 3 — Visual issues

### W06-V-1 — On `/admin/clients/[id]` empty-state (a client with zero bookings), the primary CTA is "Book again"-labelled but it's the FIRST booking — copy mismatch
**Source:** per #07 audit references. Need to verify the actual button label on a 0-booking client. If it reads "Book again" universally regardless of history, that's a copy bug.
**Decision:** verify in live or fold into the per-page #07 follow-up. C-07 routing or C-12+ copy pass.

### W06-V-2 — After successful client creation + redirect to `/admin/clients/[id]`, no "Client created" flash/toast surfaces
**Source:** `createClient` ends in `redirect()` (line 222). Same flash-message limitation as W02 V-2. New admin's first reaction: "Did it save?" answered only by the URL change.
**Decision:** ?created=1 search-param + toast on detail. Same fix shape as W02 V-2. C-07.

---

## 4 — Empty / edge states

### W06-E-1 — `createClient` Zod schema requires full_name + phone OR email (not both?)
**Source:** schema body not deeply inspected. Per code, both email + phone are conditionally checked at lines 153-187 (`if (email || phone)`). If neither is provided, the dup-check block is skipped. The Zod schema (clientSchema) governs whether either is required.
**Implication:** if the schema permits both blank, the system can create a "ghost" client with just a name. Unlikely intentional. Out of W06 scope; verify schema during C-06 or C-12+.

### W06-E-2 — `createClient` write-back includes `notes` if provided — first note captured atomically
**Source:** line 138, 199. ✅ Accept (as noted in B-135).

### W06-E-3 — `?clientId=` URL with deleted/non-existent client ID — similar to W01 enquiry case
**Source:** `bookings/new/page.tsx:48-53` (`prefillClient` SELECT). If returns null, the form receives `prefillClient=null` + `prefillFailed=true`. Same toast bug as W01 B-104 (says "Couldn't load client details" — which IS correct for this path; bug is only when the path is enquiry).

### W06-E-4 — "Book again" from a client with `customer_cancelled_at` set or with all bookings cancelled — no special handling
**Source:** the link href is unconditional. Whether the prefilled service/address fields make sense for a churned-but-revived client is a copy/UX question.
**Decision:** out of W06 scope; flag for C-12+.

---

## 5 — Cross-role inconsistencies

### W06-CR-1 — Therapist cannot create clients (RBAC at `requireClientManager`)
**Source:** `clients/actions.ts:123` — same `canManageClients` predicate. Per #05 + #06 audits, Therapist cannot reach `/admin/clients/new`.
**Status:** intended. ✅ Accept.

### W06-CR-2 — Therapist can VIEW their assigned-clients' detail pages (per #07) but cannot create new clients NOR book new bookings
**Source:** layered predicates. ✅ Consistent.

---

## 6 — Cross-viewport issues

No new mobile-level findings beyond #05/#06/#07 baselines.

---

## 7 — Console / network issues

### W06-CN-1 — 0 errors / 0 warnings
Read-only walk; carried baselines.

---

## 8 — Pre-existing items the audit accepts

### W06-PE-1 — `createClient` dedup pattern is EXEMPLARY — the model for how booking flow's dedup should work
**Source:** lines 153-187. Two-step dedup (search by email + phone, surface warning, accept confirm) is the right shape. **This is the template the booking flow should adopt** (B-132). ✅ Pattern accept.

### W06-PE-2 — `createClient` audit_log row captures actor + after_state
**Source:** lines 210-216. ✅ Standard pattern.

### W06-PE-3 — `?clientId=` prefill correctly fetches client row server-side + populates form state
**Source:** new/page.tsx:48-53 + ManualBookingForm.tsx:518-530. The prefilled DISPLAY is correct. The submission asymmetry (B-131) is the issue.

### W06-PE-4 — Cache invalidation on createClient is appropriate (clients list + dashboard)
**Source:** lines 218-221. ✅ Accept (not bookings/* — see B-133).

---

## 9 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | B-131 — `?clientId=` prefill doesn't plumb client.id to server | Hidden `client_id` input + server-side honor + divergence guard | **C-06 (HEADLINE)** + C-12+ plumbing |
| 2 | B-132 — pattern asymmetry: clients/new has dup-banner; bookings/new doesn't | Lift DuplicateWarningBanner into ManualBookingForm | **C-06** |
| 3 | B-133 — createClient doesn't invalidate /admin/bookings | Accept (correct here) | — |
| 4 | B-134 — 3 duplicate CTAs on client detail | Consolidate to 1-2 | C-07 |
| 5 | W06-V-1 — "Book again" copy mismatch for first-time client | Conditional label | C-07 or C-12+ |
| 6 | W06-V-2 — no flash after client create | Same as W02 V-2 | C-07 |
| 7 | W06-E-1 — verify Zod schema requires email OR phone | Schema audit | C-06 or C-12+ |

---

## 10 — Cross-references to existing findings + critical reframe of B-110

**B-110 (W02) is bigger than I described it.** W02 said: "create_booking_request does destructive client overwrite on email match." That's correct but understated. W06 reveals the COMPLETE picture:

**The booking flow's client handling has THREE problematic paths:**
1. **No prefill** (entered fields, no `?clientId=`): SQL matches by email → overwrites or creates. W02 B-110.
2. **Prefill from enquiry** (`?enquiryId=`): SQL matches by email → overwrites or creates. Same as (1). W01 + W02.
3. **Prefill from client** (`?clientId=`): SQL matches by email → if admin edits email, ORPHANS the source client. NEW behaviour. **W06 B-131.**

**All three paths converge on the SQL `on conflict (email) do update`.** The fundamental fix is: **plumb `client_id` through the form when known, and have the SQL function HONOR a passed `p_client_id` parameter (skip the `on conflict` logic when client is explicit, otherwise apply the current path BUT with `do nothing` instead of destructive overwrite + surface a dup-warning to the user)**.

**B-110 fix architecture (consolidated across W02 + W06):**
- Add `p_client_id uuid DEFAULT NULL` parameter to `create_booking_request`.
- If `p_client_id` is provided + valid → SELECT FROM clients WHERE id = p_client_id → use that row directly (no overwrite).
- If `p_client_id` is NOT provided → check by `(email, phone)` → if no matches, INSERT (current path). If matches exist, RAISE EXCEPTION with a structured payload the server action can surface as a "duplicate found" response (lift the `DuplicateWarningBanner` pattern).
- Add `confirmDuplicate` parameter to bypass the new exception (for admin-acknowledged dup creation).
- Form-side: add hidden `client_id` input populated when prefilling from `?clientId=`.
- Booking action: pass `client_id` + `confirm_duplicate` to RPC.

**This is the C-06 plan architecture.** Lift it directly.

---

## 11 — Cross-references to existing findings

- **#06 B-29** — DuplicateWarningBanner pattern. W06 PE-1 confirms this is the lift target.
- **#07 B-34** — client edit gap. Adjacent (and unrelated) — W06 just confirms the booking flow doesn't help close that gap.
- **W02 B-110 / B-111** — destructive overwrite + email-only dedup. **W06 expands to a 3-path consolidated picture** in §10.
- **W01 B-9 / B-104** — dup-client guard + toast copy. Pairs with B-131.
- **W02 B-113** — missing /admin/clients/* cache invalidation. Same gap — booking-create doesn't refresh client surfaces.

---

## 12 — Hand-off

**State:** 0 screenshots. 0 code changes. 0 prod DB writes. 5 new bugs (B-131 → B-135).

**Most consequential W06 findings to surface to C-B:**
1. **B-131 + §10 reframe of B-110** — the booking flow's client handling is the single biggest data-hygiene risk in the admin. W06 §10 contains a complete C-06 fix architecture.
2. **B-132 — pattern asymmetry**: dup-detection in one place, destructive merge in another.
3. **B-134 — 3 duplicate CTAs on client detail**: cosmetic but the kind of thing a routing pass should consolidate.

**Next workflow:** W07 — therapist availability + recurring booking. Tests `/admin/staff/[id]/availability` configuration → `/admin/bookings/new` recurring booking attempt → recurrence absence confirms C-02 is greenfield.

**Bug index advance:** B-130 → B-135. Next available: B-136.

*End of W06 client-create-and-first-booking-flow audit.*
