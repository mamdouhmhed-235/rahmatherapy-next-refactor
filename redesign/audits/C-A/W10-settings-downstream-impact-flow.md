# C-A.2 W10 — Settings edit + downstream impact flow audit

**Workflow:** admin edits `/admin/settings` (business_settings row) → save → downstream surfaces (`/admin/bookings/new`, `/admin/calendar`, customer manage page, etc.) should reflect the new values.
**Audit type:** C-A.2 cross-page workflow discovery (no fixes) — **final C-A.2 workflow**
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `d8f9bcd`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Predecessor audits referenced:** C-A.1 #17 (`/admin/settings` per-page, B-78 no concurrent-edit), W02 (SQL function consumes booking_window_days + allowed_cities), W04 (customer cancellation uses cancellation_cutoff_hours).
**Source surveyed:**
- Settings action: `src/app/admin/settings/actions.ts:26-113` (full).
- business_settings schema (10 columns, queried from `information_schema`).
- Consumer call sites: grep for each setting column name across `src/app/admin` + `src/app/booking` + `src/lib`.
**Roles swept:** Owner. Per #17, only Owner/Admin reach this surface.

---

## 1 — business_settings schema + downstream consumers

| Column | Type | Consumed by |
|---|---|---|
| `id` | integer (hardcoded `=1`) | Single-row config pattern |
| `company_name` | text | Email templates (templates.ts), header footer, customer manage page |
| `contact_email` | text | Email templates ("from" / "reply-to"?), admin notifications |
| `contact_phone` | text | Public-facing pages, email templates |
| `booking_window_days` | integer | SQL `create_booking_request` (W02 §2 — rejects bookings beyond window) + booking form date picker max |
| `buffer_time_mins` | integer | Likely calendar render + availability calc (not deeply traced) |
| `minimum_notice_hours` | integer | Booking form min-date / customer flow |
| `allowed_cities` | jsonb | SQL `create_booking_request` (W02 §2 — out-of-area rejection) |
| `booking_status_enabled` | boolean | Feature flag — likely toggles whether public booking flow accepts new requests |
| `customer_cancellation_cutoff_hours` | integer | W04 W04-E-1 — `customer-manage.ts:178-180` gate |

**10 columns; ~5 distinct downstream impact surfaces.**

---

## 2 — Bugs found

### B-149 — `updateBusinessSettings` ONLY revalidates `/admin/settings` — every downstream surface stays stale
**Severity:** HIGH (cross-page cache integrity — settings appear to save but their effect is invisible until natural cache expiry)
**Source:** `settings/actions.ts:111` — single line, single path. Compare with the booking-create action's invalidation set (~6 paths + 2 tags per W02 §1).
**Concrete failure modes:**
- Admin reduces `booking_window_days` from 90 → 30. The booking-creation form still allows dates 31-90 days out until natural revalidation. Customer submits → SQL function rejects with generic error. Confusing.
- Admin removes "Bedford" from `allowed_cities`. New bookings for Bedford keep being accepted via the form (frontend doesn't know) → fail at SQL with "Location is outside the service area" (W02 W02-E-1).
- Admin shortens `customer_cancellation_cutoff_hours` from 24 → 12. Customer manage page (and its cancel-button gating) still uses 24-hour window for cached page renders. Customers who try to cancel within the new 12-hour window may succeed (depending on which side renders the gate first).
- Admin changes `company_name`. Email templates referencing it still produce emails with old name for templates that are pre-rendered or cached.
**Decision:** **add comprehensive revalidation** — `revalidatePath("/admin/bookings/new")`, `revalidatePath("/admin/calendar")`, `revalidatePath("/admin/dashboard")`, plus tag-based invalidation for any `unstable_cache` consumers. Verify the customer manage page invalidation strategy separately (it's outside the admin tree). **This is a cache-integrity HEADLINE finding** — fold into C-09 cache pass OR fix as a one-off in C-12+ trivial.

### B-150 — Settings save has NO concurrent-edit guard (carried + confirmed from #17 B-78)
**Severity:** medium (data integrity — two admins editing same row, last write wins silently)
**Source:** `settings/actions.ts:95-99` — `.upsert(payload, { onConflict: "id" })`. No `updated_at` check, no version column, no optimistic lock. If Owner edits `allowed_cities` while Admin edits `booking_window_days` simultaneously, the second save wipes the first's `allowed_cities` change (because both POSTs carry the full state).
**Mitigation in current schema:** business_settings has no `updated_at` or `version` column (per the introspect query — only 10 columns listed; none for versioning).
**Decision:** add `business_settings.updated_at` + check `WHERE updated_at = $known_updated_at` in the upsert — if no row updated, surface "Someone else edited these settings; reload to see their changes." C-12+ data integrity.

### B-151 — Settings audit log captures before+after but no per-field diff or commit message
**Severity:** low (forensic — hard to skim "what changed?" without comparing JSON manually)
**Source:** `settings/actions.ts:103-109` — writes a `business_settings_updated` row with full before + after state. Good (W10-PE-1). But: no per-field summary, no "Reason for change" field.
**Decision:** add a `reason` formData field + include in audit_log. C-12+ forensic.

### B-152 — `booking_status_enabled` is a feature flag — has it ever been toggled OFF? What happens?
**Severity:** unknown (need clarification on what it gates)
**Source:** column is `boolean` in business_settings. Code-level usage not deeply traced. Likely gates the public booking flow's intake form.
**Decision:** trace + document. Out of W10 scope; flag for C-12+.

### B-153 — `id=1` hardcoded — single-tenant assumption
**Severity:** very low (intentional — Rahma Therapy is single-clinic)
**Source:** `settings/actions.ts:79, 83`. `id: 1` in both SELECT + upsert payload.
**Status:** intentional. ✅ Accept.

---

## 3 — Visual issues

### W10-V-1 — No "Settings affect these surfaces" callout on the Settings page
**Source:** observed. Admin saving `allowed_cities` doesn't see "This will affect new bookings, customer manage page, ..." Visual reassurance gap.
**Decision:** add a short callout under each field group. C-12+ copy/UX.

### W10-V-2 — No "N pending bookings outside the new booking window" warning when shortening `booking_window_days`
**Source:** changing 90 → 30 silently orphans any future-dated bookings between days 30 and 90 (they're now "outside the window" per the SQL function, but the SQL function only validates at CREATE time — existing bookings keep their data). The admin has no warning that "you have 12 bookings scheduled beyond the new window".
**Decision:** similar to W07-V-2 (availability change warning) — cross-page diff preview before save. C-07 or C-12+.

---

## 4 — Empty / edge states

### W10-E-1 — `allowed_cities` JSONB field requires parsing the form input (comma-separated text → array)
**Source:** `parseAllowedCities` helper (referenced but not deeply read). Likely splits on commas + trims. Edge case: city name containing a comma (e.g., "Luton, Bedfordshire" if anyone wrote it that way) would split incorrectly.
**Decision:** UX — use a tag-input component (per #17 audit hint) OR enforce no-comma-in-name validation. C-12+.

### W10-E-2 — All numeric fields default to NaN on empty submit (form coerces empty string → Number → NaN)
**Source:** lines 41-46. The `Number(formData.get("booking_window_days"))` returns NaN if the field is empty. Then validations at 52-65 catch it ("Enter a booking window above 0 days."). ✅ Good defensive validation.

### W10-E-3 — `contact_email` and `contact_phone` allowed to be NULL — no validation that at least one exists
**Source:** lines 39-40, 85-86 — both fields go to `null` if empty. No `if (!contactEmail && !contactPhone)` check.
**Implication:** if both are blank, email templates that interpolate "Contact us at {email} or {phone}" produce broken copy.
**Decision:** require at least one. C-12+ validation.

---

## 5 — Cross-role inconsistencies

### W10-CR-1 — Only canManageSettings (Owner / Admin) can edit
**Source:** `requireSettingsManager` predicate. Coord and below blocked. ✅ Correct.

---

## 6 — Cross-viewport issues

No new mobile-level findings beyond #17 baseline.

---

## 7 — Console / network issues

### W10-CN-1 — 0 errors / 0 warnings
Read-only walk.

---

## 8 — Pre-existing items the audit accepts

### W10-PE-1 — Settings update writes a `business_settings_updated` audit_log row with full before + after state
**Source:** lines 103-109. ✅ Strong forensic trail.

### W10-PE-2 — All numeric fields have lower-bound validation (>= 0 or > 0)
**Source:** lines 52-65. ✅ Defensive.

### W10-PE-3 — `allowed_cities` validated as non-empty (must have at least one city)
**Source:** line 66-68. ✅ Sensible business rule.

### W10-PE-4 — Settings page uses optimistic mobile sticky save bar pattern (per #17)
**Source:** referenced from #17 PE-? — best mobile sticky save bar pattern in the codebase. ✅ Pattern accept.

---

## 9 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | B-149 — settings save only revalidates /admin/settings | Add comprehensive revalidation across all downstream surfaces | **C-09 cache pass (HEADLINE)** |
| 2 | B-150 — no concurrent-edit guard | Add `updated_at` + version check | C-12+ data integrity |
| 3 | B-151 — no per-field diff or reason in audit log | Add reason field + summary | C-12+ forensic |
| 4 | B-152 — booking_status_enabled feature flag undocumented | Trace + document | C-12+ |
| 5 | W10-V-1 — no "settings affect these surfaces" callout | Inline callouts | C-12+ UX |
| 6 | W10-V-2 — no orphan-bookings warning on window shrink | Cross-page diff preview | C-07 or C-12+ |
| 7 | W10-E-1 — comma-in-city parse hazard | Tag-input or validation | C-12+ |
| 8 | W10-E-3 — both contact fields can be NULL | Require at least one | C-12+ validation |

---

## 10 — Cross-references to existing findings

- **#17 B-78** — concurrent-edit. W10 confirms cross-page + recommends DB schema change.
- **W02 W02-E-1** — city whitelist invisible until SQL error. W10's B-149 is the cache-side reason.
- **W04 W04-E-1** — customer cancellation cutoff. W10 B-149 confirms changes don't propagate immediately.
- **W07-V-2** — global-availability change has no "N bookings affected" warning. **Same pattern as W10-V-2** — settings/availability changes both lack downstream-impact previews.

**Consolidation note for C-09 cache pass:** the cache-invalidation gap pattern surfaced repeatedly in C-A.2:
- W02 B-113: createManualBooking doesn't invalidate /admin/clients*.
- W05 B-128: assignment changes don't invalidate /admin/staff*.
- W10 B-149: settings save only invalidates /admin/settings.

**Root cause:** the codebase has 4-6 distinct mutation hot-paths and each one cherry-picks which paths to revalidate. There's no centralised "mutation X affects surfaces Y,Z" registry. C-09 plan should consider whether to:
- (a) Cherry-pick per-mutation (current pattern; just be more thorough), OR
- (b) Build a central `recordMutation(kind)` helper that knows the full propagation graph, OR
- (c) Switch to tag-based invalidation everywhere (define tags like `business-settings`, `client`, `staff-roster` — each surface consumes specific tags via `unstable_cache`).

(c) is the most scalable; (a) is the cheapest. C-09 plan decides.

---

## 11 — Hand-off

**State:** 0 screenshots. 0 code changes. 0 prod DB writes. 5 new bugs (B-149 → B-153).

**Most consequential W10 findings to surface to C-B:**
1. **B-149 — settings cache-invalidation gap** — HEADLINE for C-09 cache pass. Settings appear to save but downstream stays stale until natural expiry.
2. **B-150 — concurrent-edit silent overwrite** — pair with W10 §10 consolidation. Real data-integrity concern.
3. **W10-V-2 — orphan bookings when shrinking window** — same pattern as W07-V-2; cross-page diff preview as a Band C theme.

**C-A.2 COMPLETE.** 10 workflow audits, 45 new bugs (B-104 → B-148, well actually B-104..B-153 = 50 bugs). Awaiting C-A.3 (role-day audit) or direct jump to C-B plan writing.

**Bug index advance:** B-148 → B-153. Next available: B-154.

*End of W10 settings-downstream-impact-flow audit.*
