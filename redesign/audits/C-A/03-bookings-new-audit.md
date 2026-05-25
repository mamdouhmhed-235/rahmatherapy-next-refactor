# C-A.1 #03 — `/admin/bookings/new` audit

**Surface:** `/admin/bookings/new` (manual booking creation form, 4-step wizard)
**Audit type:** C-A.1 per-page discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `d068a5f`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Source surveyed:** `src/app/admin/bookings/new/page.tsx` (102 LOC, me) + `ManualBookingForm.tsx` (2020 LOC, Explore subagent + spot-verified). Subagent claims spot-verified at lines 88–94 (ServiceOption.gender_restrictions declared) and 518–520 (no duplicate-client guard).
**Roles swept:** Owner @ 1280 (default + `?enquiryId=` prefill) + 375. Coordinator skipped (predicate-equivalent to Owner per `canManageAllBookings`). Therapist not swept — `page.tsx:25` returns AdminAccessDenied (correct RBAC) — verified via code, not live.
**Screenshots:** `redesign/audits/C-A/screenshots-03-bookings-new/` — 3 PNGs.

---

## 1 — Bugs found

### B-09 — No duplicate-client guard before booking creation
**Severity:** medium (data hygiene — multiple bookings for same person under email/phone variants create orphaned client records)
**Source:** `ManualBookingForm.tsx:518–520`. The form prefills name/email/phone from `prefillClient` (when navigating from a client detail) or `enquiry`, but **does not check for existing clients by email or phone** when creating a brand-new client through the form. Spot-verified — only one `prefillClient.email` reference in the file, no `select…clients…where email` lookup.
**Implication for C-06 (delete + bulk delete):** the delete UX has to account for orphaned dup clients. Possibly should pair with a dedup pass.

### B-10 — `ServiceOption.gender_restrictions` field declared but completely unused
**Severity:** medium (UX — male client can select a female-only service; the conflict only surfaces later via the availability check, with confusing error UX)
**Source:** `ManualBookingForm.tsx:88-94` declares `gender_restrictions: string` on `ServiceOption`. Spot-verified — only one occurrence of `gender_restrictions` in the file (the interface declaration itself). The PACKAGE_OPTIONS / MASSAGE_OPTIONS rendering (lines 1208–1282 per subagent) does NOT filter by participant gender.
**Adjacent:** the page.tsx selects `gender_restrictions` from the services table (line 42) so the data is plumbed end-to-end EXCEPT for the final filtering step.

### B-11 — Multiple `animate-spin` instances without `motion-reduce` guard
**Severity:** low/medium (a11y — vestibular sensitivity)
**Source:** subagent reports `animate-spin` at lines 1453, 1515, 1559, 1928, 2010 — none gated. Same anti-pattern as documented in dashboard B-03 + bookings-list B-05. Consistent failure mode across the codebase.

### B-12 — Phone validation message contradicts actual validation
**Severity:** very low (copy bug)
**Source:** `ManualBookingForm.tsx:194` — validation rule is `phone.trim() === ""` only (empty string check), but the error message says `"Phone number is too short. Include the area code."` Clicking submit with a 1-digit phone passes validation but reads like it should fail.

### B-13 — Availability fetch race condition
**Severity:** very low (only manifests on rapid date-flicking)
**Source:** lines 700–725 — `.then()` chain with no cancellation token. Last response wins; observed-not-tested.
**Decision suggested:** accept for now unless C-02 (recurring bookings) introduces faster date interactions.

### B-14 — Server errors only render a step-4 banner; no inline field error on server rejection
**Severity:** medium (UX — user can't see which field server rejected)
**Source:** `ManualBookingForm.tsx:878–890` and `:1878–1890` — server-state errors render in an alert banner on step 4. No round-trip from server-side field validation back to inline field errors.

---

## 2 — Visual issues

### V-08 — C-03 (enquiry → booking) is partially wired but feels far from "one-click"
**Source:** `page.tsx:54-60` fetches the enquiry by `?enquiryId=`. `ManualBookingForm.tsx:514–525` prefills only `full_name`, `email`, `phone`, `source`, and `customer_notes` (with the enquiry text concatenated). **Live verification at `/admin/bookings/new?enquiryId=59e3d933-…`:**
- ✅ Name "Audit Enquiry Two" prefilled
- ✅ Phone "07700000098" prefilled
- ✅ Source "whatsapp" prefilled
- ✅ Customer notes carries the enquiry's service_interest + notes
- ✅ Each prefilled field shows "From enquiry" badge text — good UX cue
- ❌ **Email empty** (Audit Enquiry Two has no email; enquiry had phone only — but if an enquiry HAD an email it would prefill)
- ❌ **Service is NOT pre-selected** even though the enquiry's `service_interest = "Supreme Combo Package"` matches an actual package option. The text shows up in notes but the radio buttons (Supreme Combo / Hijama / Fire) remain unselected.
- ❌ **Participant gender is NOT pre-selected** (Audit Enquiry Two has no gender on record)
- ❌ **No entry point** from `/admin/enquiries` — user must construct the URL manually or hard-code a link

**Items for C-03 plan:**
1. Add a "Convert to booking" button on `/admin/enquiries` rows + `/admin/enquiries/[id]` detail.
2. Service-interest fuzzy-match the enquiry text to a package option for pre-selection. If multiple match, leave un-pre-selected but visually highlight likely candidates.
3. Decide what "complete enough to be one-click" means: name + phone + maybe service + maybe location — versus the rest still being manual.

### V-09 — No per-participant health notes in group bookings
**Source:** subagent — health notes is a single global textarea (`ManualBookingForm.tsx:1714-1722`). Group bookings (≥2 participants) lose individual health context. For a clinical setting with hijama / cupping (potentially health-condition-sensitive), this is a real gap.
**Decision:** flag for C-12+ (operational quality) or fold into C-02 (recurring bookings) if scope extends to per-participant fields.

### V-10 — Step rail hidden on mobile; replaced with "Step N of 4" text
**Source:** subagent — `:333`. Trade-off for screen real estate. Acceptable per audit standards but worth noting in C-07 (routing) for breadcrumb / progress consistency across forms.

---

## 3 — Empty / edge states

### E-09 — Auto-save to sessionStorage with `beforeunload` warning
**Source:** subagent — lines 757–764 save, 774–781 warn on unload, 735–752 restore on mount when no prefill. ✅ Excellent UX. Accept.

### E-10 — Max 6 participants enforced with clear warning copy at capacity
**Source:** line 141 `MAX_PARTICIPANTS = 6`, lines 1332–1336 surface "For larger groups, contact the owner to arrange." Friendly bound. ✅ Accept.

### E-11 — `prefillFailed` flag passed from page.tsx but worth verifying the toast actually fires
**Source:** `page.tsx:78-80` derives a "prefill failed" signal when `?clientId=` or `?enquiryId=` returns a 404. Form receives it. Subagent didn't surface the toast firing — flag for spot-test in C-B planning.

---

## 4 — Cross-role inconsistencies

### CR-09 — Therapist correctly blocked at page level
**Source:** `page.tsx:25-33` — `canManageAllBookings(profile)` false → AdminAccessDenied with variant="therapist" copy "Bookings are created by coordinators and admins. Ask one of them…". ✅ RBAC correct. Verified via code.

### CR-10 — Coordinator + Admin have full form access (same as Owner)
**Source:** same predicate. Confirmed in #02 audit. Accept.

### CR-11 — "Take this booking myself" only renders if `currentUserIsBookable && participantGender === currentUserGender`
**Source:** lines 1735–1738 + 1809–1824. Correct gender-match gating. ✅ Accept.

---

## 5 — Cross-viewport issues

### CV-07 — Mobile sticky action bar at the bottom (hidden ≥ md)
**Source:** lines 1985–2015 `AdminMobileActionBar`. Standard pattern. ✅ Accept.

### CV-08 — Leave-confirmation dialog adapts: bottom sheet at mobile, centered modal at md+
**Source:** `:1944` `items-end` at mobile. ✅ Good responsive UX.

### CV-09 — At 375 the form is single-column with section headings; no awkward horizontal scroll observed
**Verified live.** ✅ Accept.

---

## 6 — Console / network issues

### CN-08 — 0 errors, 0 warnings on initial Owner load (default + prefill variants)
**Capture:** Owner @ 1280 default + Owner @ 1280 `?enquiryId=…` both return 0 errors / 0 warnings.

### CN-09 — Sentry tunnel 308 double-hop + Next.js font-preload warnings persist
*(Same as documented in #01 + #02 audits.)*

### CN-10 — `postcode` lookup not debounced
**Source:** line 844–861 per subagent. Each blur triggers a fetch. Cosmetic only — flag for C-12+ if a postcode fetch ever errors out under load.

---

## 7 — Pre-existing items the audit accepts

### PE-10 — Session-storage draft try/catch is intentional
**Source:** `:753, :763` catches localStorage/sessionStorage quota errors silently. Standard pattern. ✅ Accept.

### PE-11 — Email validation regex permissive but acceptable
**Source:** `:197` — `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` is the common pragmatic email validation. Strict per-RFC validation is overkill at this product stage. Accept.

### PE-12 — `MAX_PARTICIPANTS = 6` is a UX-derived constant
**Source:** line 141. Domain constant; surfaced in copy at the capacity boundary. Accept.

### PE-13 — Subagent reported "DESIGN.md doesn't mention `border-l-4` as banned"
**Correction:** the master-plan Part 0 explicitly lists `No border-l-4 (DESIGN.md ban)` as a hard rule. The subagent didn't read the master plan and made a contradictory claim. **Important:** the subagent ALSO reported finding no `border-l-4` in the form file, so the audit conclusion (clean of border-l-4) stands. But this is a reminder that subagent meta-claims about repo conventions need spot-verification.

---

## 8 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | V-08 — C-03 prefill incomplete (no service, no entry point) | Service fuzzy-match + Convert button on enquiries | C-03 |
| 2 | B-09 — no duplicate-client guard | Add email/phone uniqueness check before insert | C-12+ or fold into C-06 |
| 3 | B-10 — `gender_restrictions` declared but unused | Filter service options by participant gender | C-12+ |
| 4 | B-11 — animate-spin × 5 + transitions without motion-reduce | Same fix as dashboard B-03 + bookings-list B-05 — global pass | C-11 dark-mode pass naturally captures this |
| 5 | B-12 — phone validation message ≠ rule | One-line message change OR add length-check | C-12+ trivial |
| 6 | B-14 — server errors lack inline field UX | Round-trip server errors back to specific field | C-12+ |
| 7 | V-09 — no per-participant health notes | Add `health_notes_per_participant[]` schema + UI | C-12+ or out-of-band clinical workstream |
| 8 | E-11 — prefill-failed toast unverified | C-B should spot-test the failure path | C-B verification |

---

## 9 — Hand-off

**State at end of audit:**
- 3 screenshots captured.
- 0 code changes.
- C-03 wiring partially verified live (prefill works; service not pre-selected; no entry point yet).
- Subagent spot-verified on 2 high-impact claims.
- Browser still signed in as Owner (no signout needed yet — next surface uses same role).

**Next surface:** #04 `/admin/bookings/[bookingId]` (booking detail — also touched by C-04 / C-05). The cancelled-detail screenshot already captured during #02 audit gives a head start.

*End of bookings-new audit.*
