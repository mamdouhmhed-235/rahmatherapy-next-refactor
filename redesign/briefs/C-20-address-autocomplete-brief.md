# C-20 — Address autocomplete (Google Places) on both booking forms

**Type:** Band C plan-writing brief (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Predecessors:**
- User direction 2026-07-16: location autocomplete on **the admin create-booking page** and **the customer-facing booking form**, using the user's Google Cloud Maps/Places setup. Reference snippet supplied (Google's "Address Selection" quickstart — reproduced in the plan §1 as the reference implementation to translate, not to paste).
- Code audit 2026-07-16: both forms collect the SAME four address fields — `address`, `postcode`, `city`, `area` — but bind differently: customer `LocationDetailsStep.tsx` via react-hook-form `register`, admin `ManualBookingForm.tsx` via `useState` (`setAddress`/`setPostcode`/`setCity`…). **`city` is load-bearing**: it drives the covered-area check (`LocationDetailsStep` watches it) and admin-side availability/validation.
  **Post-merge update (2026-07-26, C20-F1):** `LocationDetailsStep.tsx` was DELETED by merge `ea97932`; the same four fields now live in `src/features/booking/components/AboutYouStep.tsx` L497-549 (register city L507 / area L520 / postcode L533 / address L547). The `register`/`useState` split and the load-bearing-`city` premise still hold (`AboutYouStep` watches `city` L91; admin file merge-untouched). Also note the customer booking flow is now a full-screen MODAL dialog (`BookingDialog.tsx`), not a page — see plan Step 4a for the dropdown-in-modal spike this forces.
- `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md` Part 0 standing rule (C-18, 2026-07-16): any new third-party script on customer pages needs a cookie-registry entry + disclosure and must respect the consent gate — see §5.
**Companion files:**
- Plan: `redesign/plans/C-phase/C-20-address-autocomplete-plan.md`
- Progress: `redesign/per-page-progress/C-20-address-autocomplete-progress.md` (filled during C-C)

---

## 0 — TL;DR

One shared, form-library-agnostic `AddressAutocompleteField` consumed by both booking forms. Customer types "12 Dun…" → picks a suggestion → **address, postcode, city, area fill themselves** and run their normal validation. Manual typing keeps working unchanged (progressive enhancement: if the key is absent, the API fails, or the user ignores suggestions, the field is a plain text input and the form behaves exactly as today).

Five things the plan gets right beyond "paste the snippet":

1. **UK-restricted, address-only suggestions** (`componentRestrictions: { country: 'gb' }`) — no US states, no random businesses.
2. **A UK-correct component mapping** (the snippet's US state/zip model is wrong here): `address` = street number + route, `city` = `postal_town`, `area` = `administrative_area_level_2`, `postcode` = `postal_code`.
3. **Both binding styles supported** — the component emits a parsed `AddressParts` object; the customer form applies it with `setValue(..., { shouldValidate: true, shouldDirty: true })`, the admin form with its setters. City-dependent logic (covered-area, availability) re-runs exactly as if typed. *(Mechanism corrected 2026-07-26 — see the §2.2 note: the notice re-evaluates via `watch("city")` on any `setValue`, not because of `shouldValidate`; the prescribed options stand.)*
4. **Cost + key discipline** — script loaded lazily on first focus (not on page load), Places **session tokens** so a session bills once, key from `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (never committed), and a mandatory Cloud-Console restriction step (HTTP referrers + API restrictions) recorded as a user action.
5. **Consent-gate compliance** — per the C-18 standing rule, the Maps script gets a cookie-registry entry and a disclosure decision (functional-on-interaction vs consent-gated) made explicitly with the user, not defaulted.

**No migration. No new package** (Google's JS API loaded via `next/script`; the reference snippet's Extended Component Library CDN import is deliberately not used — see plan §1). Independent of every other plan except the C-18 registry coordination.

---

## 1 — Why this plan exists

Both booking forms make people type a full address by hand: four fields, on a phone, often one-handed, with postcode typos that later send a therapist to the wrong street. Autocomplete removes the typing and — more valuable operationally — **normalises the data**: consistent city spellings feed the covered-area check and availability logic that today depend on free text matching.

---

## 2 — Scope

### 2.1 Shared component (the whole feature, once)

`src/components/address/AddressAutocompleteField.tsx` — client component, presentation-agnostic:

- Renders the address text input the host form already renders (label/error/aria passed through as props, so each form keeps its own styling: `--rahma-*` on the customer side, `--admin-*` on the admin side).
- Lazily loads the Google Maps JS API **on first focus** (never on page load) via `next/script`; a module-level singleton promise means the second field/second form never re-loads it.
- Creates the Places autocomplete bound to the input with: UK restriction, `types: ['address']`, and **only Essentials-tier fields: `addressComponents` + `location`** (classic API: `address_components` + `geometry`).
  > **COST-CRITICAL (verified research 2026-07-16 — corrects the reference snippet):** Google bills Place Details at the **highest field tier requested**. `name` / `displayName` is a **Pro**-tier field: including it (as the user's snippet does) drops the free allowance from **10,000/month to 5,000** and raises the unit price from **$5 to $17 per 1,000**. A booking form needs the address, not a business name. **Never request `name`/`displayName`.** Fields are a review-gate item, not an implementation detail.
- Uses a **Places session token** per lookup session (created on first keystroke, consumed on selection). Verified billing behaviour: when a session completes with a selection, **all the typing requests are free** (Autocomplete Session Usage SKU, $0 unlimited) and only ONE Place Details event is charged. **Abandoned sessions** (typing, no selection) bill per request against the 10,000/month Autocomplete Requests allowance — which is why **input debouncing (~300 ms) is a cost control, not just a UX nicety**, and is specified in the plan.
- On selection: parses components → calls `onAddressSelected(parts: AddressParts)`. **The component never writes to form state itself** — that's the host's job, which is what makes it work with both react-hook-form and useState.
- Emits nothing on free-typing; the input remains a normal controlled/registered input so manual entry is untouched.

```ts
export interface AddressParts {
  address: string;   // "12 Dunstable Road"  (street_number + route)
  city: string;      // postal_town           ("Luton")
  area: string;      // administrative_area_level_2 ("Bedfordshire") — fallback: administrative_area_level_1
  postcode: string;  // postal_code           ("LU1 1AA")
}
```

**UK mapping note (the snippet's biggest gap):** the reference uses `locality` + `administrative_area_level_1` + `postal_code` (a US model). UK addresses resolve properly with **`postal_town`** for the town/city (`locality` is frequently absent or a village), and `administrative_area_level_2` for county. The plan's parser tries the correct key first with documented fallbacks, and the verification gate tests real Luton-area addresses.

### 2.2 Customer booking form (`AboutYouStep.tsx`)

*(Section retitled 2026-07-26, C20-F1: originally "`LocationDetailsStep.tsx`" — that file was deleted by merge `ea97932`; the address fields live in `src/features/booking/components/AboutYouStep.tsx` L497-549.)*

Swap the plain address `<Field>` input for the shared component; on selection call `setValue` for each of the four fields with `{ shouldValidate: true, shouldDirty: true }` so react-hook-form's errors clear and the **covered-area check re-evaluates** (it watches `city`). Postcode/city/area inputs stay visible and editable — autocomplete fills them, the customer can correct them. Flat/apartment detail: the existing address field remains free-text after fill, and the existing access-notes field covers "flat 3, buzzer B" — no new field is added.

> **Mechanism corrected (2026-07-26, C20-F4):** post-merge the form is `mode: "onSubmit"` with no resolver and no register rules; errors are manual (`safeParse` → `setError({ type: "manual" })` in `BookingExperience.tsx`) and re-clear via the watched-details re-validation effect. The covered-area check re-evaluates because it watches `city` — any `setValue` triggers it, with or without `shouldValidate`. Keep the prescribed `{ shouldValidate: true, shouldDirty: true }` (matches the covered-town chip convention at `AboutYouStep.tsx:190-195`); only the "so errors clear" causal wording above is corrected. Full anchors in plan Step 5.

### 2.3 Admin create-booking form (`ManualBookingForm.tsx`)

Same component; on selection call the existing `setAddress`/`setPostcode`/`setCity`/`setArea` setters and clear any address-related entries in the form's error state, so admin-side validation matches typed behaviour. Prefill-from-client path is unaffected (autocomplete only fires on user selection). Admin is **not** UK-restricted differently — same restriction (the clinic is UK-only); if the owner ever needs an out-of-area entry they type it manually, exactly as today.

> **Parity note (2026-07-26, C20-F6):** "matches typed behaviour" also means replicating the typed handlers' side effects — `markEdited(field)` per filled field, the city-change availability reset (clears date/time/availability-check state), clearing `postcodeLookupError` on postcode fill — and coexisting with the existing postcode-lookup autofill (fills empty city/area; an explicit selection wins). Exact anchors and verification in plan Step 7.

### 2.4 Key handling + Cloud Console (user actions, recorded)

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in the Cloudflare build environment; documented in `.env.example`; **never committed**. (Maps browser keys are necessarily visible in client HTML — restriction, not secrecy, is the protection.)
- **Mandatory user action before/at ship:** in Google Cloud Console restrict the key to (a) HTTP referrers: the production domain(s) + localhost for dev, and (b) APIs: Maps JavaScript API + Places API only. The plan blocks sign-off until this is confirmed. **Done 2026-07-16** — key restricted to `https://rahmatherapy.uk/*`, `https://*.rahmatherapy.uk/*`, `http://localhost:3000/*` + 3-API restriction.
  **Re-marked NOT COMPLETE (2026-07-26 — D19, C20-F2):** those referrers do not cover the codebase canonical domain `rahmatherapy.co.uk` (root `metadataBase`; `rahmatherapy.uk` ×0 in `src/`; C-21 cutover pending) — if prod serves `.co.uk` the key is referrer-blocked and autocomplete silently degrades behind its own fallback. The Owner must add `https://rahmatherapy.co.uk/*` (+ www if used) per plan §3.5a (HARD-STOP, external-console change) before sign-off.
- **Billing reality (verified research 2026-07-16):** a Cloud Billing account **with a card is mandatory** even to use only the free allowance — without one the APIs are throttled to 1 request/day. Google does not charge while inside the monthly free allowance. **Budgets only email; they never hard-stop spend.** Maps Platform quotas are largely per-minute (not per-day), so quotas bound burst abuse rather than monthly totals — **the HTTP-referrer key restriction is the load-bearing cost control**, which is why its sign-off is blocking.
- **Expected usage vs allowance:** with session tokens + Essentials fields, one completed booking = **one** Place Details Essentials event. At ~20 bookings/day × 2 lookups ≈ 1,200/month against **10,000 free** — roughly **12% of the allowance**. Comfortable, not a knife-edge.
- **Trial-credit trap:** the 90-day $300 new-customer credit is separate from the permanent free tier and will silently absorb any overage for 90 days. Check the Maps Platform **Metrics** page in month one to confirm real usage sits inside the free allowance on its own merits.
- **Security note recorded (2026-07-16):** the key was shared in plaintext in the planning conversation. If it has ever been used unrestricted, the safe move is to **rotate it** in Cloud Console and set restrictions on the new key before ship. Flagged for the user's decision; the plan works with whatever key is in the env var.

### 2.5 Consent-gate coordination (C-18 standing rule)

Loading Google's Maps script is a third-party request. Per the Part 0 standing rule, C-20 must not sneak it past the consent layer:

- **Registry entry** added to `cookie-registry.ts` (once C-18 lands) describing the Maps script + any storage it sets, with a `CONSENT_BANNER_VERSION` bump.
- **Classification decided with the user at impl** (the plan surfaces it, doesn't default): (a) **functional/strictly-necessary-on-interaction** — loaded only when the customer focuses the address field while completing a booking they initiated, disclosed in the cookie notice but not consent-gated; or (b) **consent-gated** — autocomplete only offered when the customer has accepted, with manual typing as the always-available fallback. Option (a) is the common reading (the user asked for the service; nothing is loaded until they interact with the address step); option (b) is the conservative one. **Recommendation: (a), disclosed.** If C-18 hasn't shipped yet, C-20 still records the entry for C-18 to absorb.
- The admin form is staff-side — no consent surface applies.

---

## 3 — States & edge cases

- **3.1 Key missing / script blocked / offline:** the field is a plain input; no error shown to the customer; a console warning only. Booking flow unaffected (this is the load-bearing fallback).
- **3.2 User types an address and never picks a suggestion:** exactly today's behaviour — free text submits. No forced selection, no blocking validation.
- **3.3 Selection missing a component** (new-build with no postcode, missing `postal_town`): fill what exists, leave the rest for the user; never overwrite a non-empty field with an empty string.
- **3.4 User edits after selecting:** their edit wins; no re-fill, no fighting the user.
- **3.5 Out-of-area address selected:** the existing covered-area notice does its job (it re-evaluates because `city` was set with validation) — autocomplete does not gate or block anything. **Updated 2026-07-26 (C20-F10):** covered-area is now a HARD validation gate (`validateServiceArea` superRefine in `bookingDetailsSchema`, `booking-schema.ts:139-169`, enforced About→Time at `BookingExperience.tsx:389-396`) — an out-of-area selection shows the red notice AND blocks advancing with an error on `city`. Identical to typing the same city, so autocomplete still adds no NEW gate of its own; the notice also re-evaluates on any `setValue`, not because of validation options.
- **3.6 Address the customer's own device autofills (browser autofill):** unchanged; the field keeps `autoComplete="street-address"`.
- **3.7 Mobile keyboard/dropdown overlap at 375:** verified in the gate — the suggestions list must not be hidden behind the sticky booking-step footer.
- **3.8 Rapid retyping:** session token reused until a selection is made; no per-keystroke session churn.
- **3.9 Google deprecation risk:** Google has been migrating from the classic `Autocomplete` class to `PlaceAutocompleteElement`. **Pre-flight verifies which API the account/key supports** and the plan implements whichever is current — the component's public props (`onAddressSelected`) are identical either way, so the choice is contained in one file.

---

## 4 — Files touched (preview)

**NEW (2–3):** `src/components/address/AddressAutocompleteField.tsx`; `src/lib/address/parse-place.ts` (component→`AddressParts` parser, pure + unit-tested); tests.
**EDITED (2–4):** `LocationDetailsStep.tsx` (customer), `ManualBookingForm.tsx` (admin), `.env.example`, and `cookie-registry.ts` (+ version bump) if C-18 has landed.
**Path-swap (2026-07-26, C20-F1):** the customer edit target is `AboutYouStep.tsx` (`LocationDetailsStep.tsx` deleted by merge `ea97932`); the NEW list additionally gains a customer address-step test file (plan Step 6 — no such test survives the merge, C20-F7).
**UNCHANGED:** API routes, schemas, DB, availability logic — the fields and their meanings don't change; only how they get filled.

---

## 5 — Migration footprint

**None.** One env var + the Cloud Console restriction (user actions).

---

## 6 — Sequencing

Independent. Coordinates with **C-18** only for the registry entry (either order; if C-20 ships first, it lands the entry and C-18's registry absorbs it). Touches the same customer file as **C-14 Phase D** (`ScheduleStep`/date picker is a different step — no conflict) and the same admin file as **C-06 Step 13** (email-optional) and **C-02 Phase E** (recurring section) — all different regions of `ManualBookingForm.tsx`; note at impl if landing simultaneously.

**Added 2026-07-26 (D19):** soft order — prefer **C-21** (canonical-domain cutover) before C-20, OR execute plan §3.5a (Owner adds the `.co.uk` referrers) first; the Maps-key referrer list must cover the live domain before ship. **Collision-map update:** the full `ManualBookingForm.tsx` set is C-02, C-03, C-06, C-20, C-23 — re-grep anchors before editing (plan Step 7 note).

---

## 7 — Acceptance criteria

1. **Customer form:** typing a partial Luton address shows UK-only address suggestions; selecting one fills address + postcode + city + area correctly; the covered-area notice re-evaluates on the filled city; errors clear.
2. **Admin form:** same behaviour with the admin styling; validation errors clear; availability lookup uses the filled city.
3. **Manual typing still works on both**, including with the API key removed (fallback proven by deliberately unsetting it in a dev run).
4. **UK mapping verified** against ≥5 real addresses (incl. a Luton one, a flat, and a new-build/edge case) — component→field mapping correct.
5. Script loads **only after first focus** on the address field (Network tab evidence) — not on page load.
6. Session tokens in use (one session per lookup+selection, verified by request inspection or code review).
7. Suggestions usable and unobstructed at 375 and 1280 on both forms; keyboard navigation (arrow keys + Enter) and screen-reader announcement verified.
8. **Key restricted in Cloud Console** (referrers + APIs) — confirmed with the user; rotation decision recorded.
9. Registry entry + disclosure classification decided and recorded (C-18 coordination).
10. Static gates pass; bundle ceiling +3 kB per form bundle (script itself is external); no new package.

---

## 8 — Out of scope

- Map display/pin-drop UI, distance/travel-time calculation, geocoding stored coordinates (`geometry` is fetched for validity checking only, not persisted — persisting lat/lng is a separate future item).
- Address validation/verification API (a different, billed Google product).
- Replacing the covered-area logic (unchanged — it just gets cleaner input).
- Autocomplete anywhere else (client edit forms, settings) — a later sweep if wanted.
- International addresses.

---

*End of C-20 brief. Plan: `redesign/plans/C-phase/C-20-address-autocomplete-plan.md`.*
