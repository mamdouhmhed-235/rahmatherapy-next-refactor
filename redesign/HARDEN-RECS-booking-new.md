# Harden Recommendations — booking-new

Generated: 2026-05-14  
Source: `/impeccable harden booking-new` + cross-check against `booking-new-brief.md §6 Key States` and `Implementation Notes`

---

## Code changes already made by `/impeccable harden`

The following were applied directly to `src/app/admin/bookings/new/ManualBookingForm.tsx` during the harden pass:

| # | Change | Location |
|---|---|---|
| 1 | `fetchSlotsForGenders` wrapped in `try/catch` — network failure no longer leaves availability loading stuck forever | `checkAvailability` fn, ~line 600 |
| 2 | `dl()` DL items: `min-w-0` on outer div + `break-words` on `<dd>` — prevents long addresses/names breaking step 4 two-column grid | `dl()` helper fn |
| 3 | `maxLength={100}` on `full_name` input | Step 1 |
| 4 | `maxLength={254}` on `email` input | Step 1 |
| 5 | `maxLength={20}` on `phone` input | Step 1 |
| 6 | `maxLength={80}` on participant name `AdminInput` | Step 2 |
| 7 | `maxLength={10/60/80/200}` on postcode/city/area/address inputs | Step 3 |
| 8 | `maxLength={400}` on access_notes and parking_notes textareas | Step 3 |
| 9 | `maxLength={1000}` on customer_notes, `maxLength={2000}` on health_notes | Step 4 |

---

## Gaps found by cross-checking brief §6 + Implementation Notes

### GAP 1 — Email format not validated (medium)

**Brief says:** "Email malformed: `Email needs an @. For example, sara@example.com.`"

**Current state:** `validateStep` for step 1 only checks `fullName`, `phone`, and `bookingSource`. If the coordinator types a malformed email (e.g. `sara-at-example.com`), it passes through to the server silently. Additionally, the email `<input>` in step 1 has no `<FieldError>` element — even if a `stepErrors.email` were set, it would not display.

**Fix:** Add email format check to `validateStep` step 1; add `<FieldError>` below the email input in step 1.

**Token guidance:** Error uses Cancelled family inline `<div role="alert">` per DESIGN.md §5.

---

### GAP 2 — Pre-fill failure: no toast when `?clientId` or `?enquiryId` fetch fails (medium)

**Brief says (Implementation Notes — Loading state):** "If server fetch fails (invalid `clientId`/`enquiryId`): form loads empty; Sonner toast warning `Couldn't load client details. Fill in manually.` (Pending family, 6s auto-dismiss)"

**Current state:** `page.tsx` silently coerces the failed query result to `null` via `?? null`. The form receives `null` for `prefillClient`/`enquiry` with no indication a pre-fill was attempted and failed. The coordinator sees an empty form, has no idea why, and may re-ask the caller for information she thought would be pre-loaded.

**Fix:**
- `page.tsx`: compute `prefillFailed` boolean (true when clientId/enquiryId was provided but the respective query returned no data and an error).
- `ManualBookingForm`: accept `prefillFailed?: boolean` prop; fire `toast.warning("Couldn't load client details. Fill in manually.", { duration: 6000 })` via `useEffect` on mount when true.

**Token guidance:** Pending family — `oklch(96.0% 0.038 75)` bg, `oklch(28% 0.120 55)` text, `clock` icon, 6s auto-dismiss.

---

### GAP 3 — Server error: no Sonner toast (only inline alert) (medium)

**Brief says (Implementation Notes — Server error):** "Error Sonner toast (no auto-dismiss, Ghost 'Retry'); inline `role='alert'` region above submit button on step 4"

**Current state:** The inline `role="alert"` div on step 4 is implemented (displays `state.error`). However, there is no Sonner toast — so if the coordinator is scrolled down on a long step 4 and submits, they may not notice the inline alert.

**Fix:** Add a `useEffect` that watches `state.error`. When it becomes truthy, fire `toast.error("Something went wrong. Your details are still here — try again.", { duration: Infinity })`. The toast is persistent (no auto-dismiss) per the brief.

**Token guidance:** Cancelled family toast. Persistent (`duration: Infinity`). The inline alert already present covers the "above submit button" requirement — no change there.

---

## States cross-check against brief §6

| Brief state | Implemented? | Notes |
|---|---|---|
| Fresh form (no pre-fill) | ✅ | Continue disabled with aria-disabled |
| Pre-filled from enquiry | ✅ | Surface-selected tint + chip |
| Pre-filled from client | ✅ | Surface-selected tint + chip |
| **Pre-fill fetch failed** | ❌ → Fixed | GAP 2 above |
| Step validation error (inline) | ✅ | role=alert per field, focus to first error |
| **Email malformed** | ❌ → Fixed | GAP 1 above |
| Step completed → step rail check | ✅ | Clinic Green fill + check icon |
| Navigating back, values preserved | ✅ | handleBack() |
| Booking for: Themself / Someone else / Group | ✅ | All three handled |
| Package radio per participant | ✅ | |
| Massage toggle + duration | ✅ | |
| Service validation per participant | ✅ | |
| Multiple participant rows, cap at 6 | ✅ | |
| Gender-match chip | n/a | Deliberately removed per user decision (final commit 892df61) |
| Postcode not found inline error | ✅ | |
| City not in allowed list | n/a | No allowed-cities list exists in codebase — future feature, not blocking |
| Availability loading | ✅ | |
| Slots available (same/mixed gender) | ✅ | |
| No slots on date + Override button | ✅ | |
| Override mode active (Attention banner) | ✅ | |
| Additional participant address override | ✅ | "Different address?" toggle |
| Step 4 confirmation review | ✅ | Summary cards + Edit links |
| Step 4 inline assignment | ✅ | Owner/Admin only |
| Submitting (spinner, aria-busy) | ✅ | |
| Success (REQUEST created → redirect → toast) | ✅ | BookingCreatedToast.tsx |
| **Server error (inline + Sonner toast)** | ⚠️ → Fixed | GAP 3 — inline existed, toast added |
| Unsaved navigation (Leave dialog) | ✅ | |
| Permission denied (AdminAccessDenied) | ✅ | page.tsx renders before form |

---

## Overflow / edge case hardening (verified post-fix)

- **60-char names:** `min-w-0 break-words` on DL `<dd>` prevents step 4 grid breakage. Inputs capped at 80–100 chars.
- **Long addresses:** `break-words` on `<dd>`, `maxLength={200}` on address input.
- **Large numbers:** No numeric inputs on this form — not applicable.
- **Empty lists:** Availability sections show "Enter the client's city first…" when prerequisites unmet; no-slots banner when slots empty — no blank screen.
- **Error responses:** Server error now shows inline alert + persistent Sonner toast; availability fetch errors show inline reason string; postcode lookup failure shows inline error.

---

## Files touched

| File | Changes |
|---|---|
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | All harden changes (maxLength, overflow, try/catch, email validation, pre-fill toast, server error toast) |
| `src/app/admin/bookings/new/page.tsx` | `prefillFailed` prop computation |
