# C-20 — Address autocomplete (Google Places) on both booking forms — **PLAN**

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: none hard. *(The D19 soft-order-on-C-21 note was WITHDRAWN 2026-07-26 — Owner confirmed the site serves ONLY on `rahmatherapy.uk`, so the 2026-07-16 Maps-key referrer list already covers the live domain; C-21's cutover has no bearing on this plan's key. C-20 and C-21 may land in either order.)* C-18: either order (Step 9's conditional handles both; `src/lib/cookie-registry.ts` absent as of 2026-07-26 = not landed).
> Decisions: C-B-DECISIONS.md — silent on C-20 (no conflicting Qs). Checkpoint resolutions applied: D15 (evidence dir), ~~D19~~ (WITHDRAWN same day — see §3.5), D20 (Step 4a modal-dialog spike). Findings applied: see refinement changelog.

**Type:** Band C plan-writing output (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Brief:** `redesign/briefs/C-20-address-autocomplete-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-20-address-autocomplete-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. Branch confirmed with user (touches both public and admin trees — public layouts diverge ~9 lines from the frontend line; see C-17 note). **Post-merge update (2026-07-26):** the divergence note is stale — merge `ea97932` landed the frontend line into `master`, single source of truth. Run on `master`; HEAD at or descended from `ea97932`; verify with `git branch --show-current` + `git merge-base --is-ancestor ea97932 HEAD`. Working tree: no modifications under the paths this plan touches — `git status --porcelain -- src/features/booking src/components/address src/lib/address src/app/admin/bookings/new .env.example` returns empty. The wider tree is intentionally dirty (untracked photo/design folders, deleted .playwright-mcp logs) — NEVER stage broadly, NEVER stash/restore/checkout to "clean" it.
2. Dev server → 200; baseline tests + static gates green. **Baseline caveat (2026-07-26):** "green" = no NEW failures vs the verified baselines — lint has 59 pre-existing errors (55 untracked `design_handoff_area_pages/prototype` JSX + 4 pre-existing in `src/features/booking/`); vitest is 485/491 with 6 pre-existing failures in 3 files (ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1). Note: 3 of those failures are in `ManualBookingForm.test.tsx`, the exact file Step 8 extends — the new selection case must pass while the 3 baseline failures persist.
3. **Key + Cloud Console (blocking):**
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` present in the dev env (and planned for the Cloudflare BUILD env — `NEXT_PUBLIC_*` is inlined at build time, same caveat as C-17 Step 3).
   - Confirm with the user: key **restricted** (HTTP referrers: production domain + localhost; APIs: Maps JavaScript API + Places API only) and, per brief §2.4, whether the plaintext-shared key is being **rotated** first. Do not ship an unrestricted key.

   > ⏸ **STOP-AND-ASK: OWNER INPUT REQUIRED** — (a) rotation decision for the key shared in plaintext during planning (this depends on conversational context not recoverable from the repo). *(Item (b) — referrer-list expansion — withdrawn 2026-07-26: Owner confirmed the site serves ONLY on `rahmatherapy.uk`, so the 2026-07-16 referrer list is correct and complete; see §3.5.)* Do not proceed with placeholder values.
4. **API-surface check (brief §3.9):** verify in the Cloud Console / current Google docs whether this project should use the classic `google.maps.places.Autocomplete` (as in the user's reference snippet) or the newer `PlaceAutocompleteElement`. Record the answer; implement whichever the account supports. The component's external contract is identical either way.
5. **Form-shape re-verify** (2026-07-16 line numbers):
   ```bash
   grep -n "register(\"address\")\|register(\"city\")\|register(\"postcode\")\|register(\"area\")" src/features/booking/components/AboutYouStep.tsx
   grep -n "setAddress\|setPostcode\|setCity\|setArea" src/app/admin/bookings/new/ManualBookingForm.tsx
   ```
   **Path-swap (2026-07-26, C20-F1):** `LocationDetailsStep.tsx` was DELETED by merge `ea97932`; the customer address fields now live in `src/features/booking/components/AboutYouStep.tsx` L497-549 — expected grep hits: `register("city")` L507, `register("area")` L520, `register("postcode")` L533, `register("address")` L547 (inside `<Field>` wrappers). Admin anchors verified 2026-07-25: setters at `ManualBookingForm.tsx:527-530`. If either grep returns zero hits, STOP and re-anchor before any Phase C/D work.
6. **Sibling-plan collision check:** if C-06 (Step 13 email-optional) or C-02 (Phase E recurring section) are landing in the same window, note the shared file `ManualBookingForm.tsx` — different regions, but coordinate commit order. **Updated 2026-07-26 (collision map):** the full set sharing this file is C-02, C-03, C-06, C-20, C-23 — see the rubric §10 coordination note at Step 7; re-grep anchors before every ManualBookingForm.tsx edit.
7. **DO-NOT-TOUCH:** booking API schemas, availability logic, DB, RECON §5 untouchables. C-20 changes only how the four address fields get filled.

```
DO-NOT-TOUCH (live data): booking 9d55ce2a (Badar — real customer email); Owner account rahmatherapy@outlook.com in email-test paths; any client whose email isn't *.example.test or name isn't Phase10*/Audit Test* test patterns.
```

---

## 1 — Reference snippet → what we actually build

The user's supplied Google quickstart (verbatim, for reference only):

```html
<!-- Google "Address Selection" quickstart — reference implementation -->
<script type="module">
  import {APILoader} from 'https://ajax.googleapis.com/ajax/libs/@googlemaps/extended-component-library/0.6.15/index.min.js';
  const CONFIGURATION = {
    "mapsApiKey": "<KEY — NEVER COMMIT; use NEXT_PUBLIC_GOOGLE_MAPS_API_KEY>",
    "capabilities": {"addressAutocompleteControl":true, ...}
  };
  const ADDRESS_COMPONENT_TYPES_IN_FORM =
    ['location','locality','administrative_area_level_1','postal_code','country'];

  async function initMap() {
    const {Autocomplete} = await APILoader.importLibrary('places');
    const autocomplete = new Autocomplete(getFormInputElement('location'), {
      fields: ['address_components', 'geometry', 'name'],
      types: ['address'],
    });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry) { window.alert(`No details available…`); return; }
      fillInAddress(place);
    });
  }
  initMap();
</script>
```

**Four deliberate deviations** (each with a reason — do not "restore" the original):

| Snippet does | We do | Why |
|---|---|---|
| Loads the Extended Component Library from an ajax.googleapis CDN | Load the Maps JS API via `next/script`, lazily on first focus | One less third-party dependency + CDN origin; App-Router-native; no load until the user reaches the address step (cost + privacy) |
| Hard-codes the API key | `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Keys never in the repo; rotation without a code change |
| US component model (`locality`, `administrative_area_level_1`, `postal_code`, `country`) | UK model: `postal_town` → city, `administrative_area_level_2` → area, `postal_code` → postcode, `street_number + route` → address | The snippet's mapping produces wrong/empty values for UK addresses |
| `window.alert()` on a bad selection | Silent no-op (keep whatever the user typed) | An alert mid-booking is hostile; free text is already valid input |
| `fields: ['address_components','geometry','name']` | **`address_components` + `geometry` ONLY — never `name`** | **COST-CRITICAL (verified 2026-07-16):** Place Details bills at the highest field tier requested. `name`/`displayName` is **Pro** tier → free allowance halves (10,000 → 5,000/month) and unit price triples ($5 → $17 per 1,000). A booking form needs the address, not a business name. |

Also added beyond the snippet: `componentRestrictions: { country: 'gb' }`, Places **session tokens**, **~300 ms input debounce** (a cost control — see below), and a hard no-op fallback when the key/script is unavailable.

**Verified billing model (2026-07-16 research — drives three implementation choices):**
- A session that **ends in a selection**: every keystroke request collapses into *Autocomplete Session Usage* (**$0, unlimited**) and exactly **one** Place Details event is charged. So cost scales with **bookings**, not keystrokes.
- A session that is **abandoned** (typing, no selection): each request bills against the *Autocomplete Requests* allowance (10,000/month free). Abandoners outnumber bookers, so **debouncing at ~300 ms is the difference between ~7,200/month (inside free) and ~14,400/month (over)**.
- Loading the Maps JS library **without rendering a map** should produce **zero** Dynamic Maps events (that SKU fires on map instantiation). Marked verify-in-console after go-live (§3.6).
- If the implementation uses the newer `PlaceAutocompleteElement`, **session tokens are handled automatically**; a hand-rolled classic-`Autocomplete` integration must manage them explicitly or every keystroke bills.

---

## 2 — Implementation order (4 phases)

### Phase A — Parser (pure, testable, no browser)

**Step 1 — `src/lib/address/parse-place.ts`.**

```ts
export interface AddressParts { address: string; city: string; area: string; postcode: string; }

// Google returns address_components: { long_name, short_name, types[] }[]
export function parsePlaceToAddressParts(components: PlaceComponent[]): AddressParts {
  const pick = (type: string, short = false) => { /* first component whose types include `type` */ };
  const streetNumber = pick("street_number");
  const route = pick("route");
  return {
    address: [streetNumber, route].filter(Boolean).join(" "),
    // UK: postal_town is the reliable town/city; locality is often absent or a village
    city: pick("postal_town") || pick("locality") || pick("administrative_area_level_3"),
    // county-ish; falls back up the admin chain
    area: pick("administrative_area_level_2") || pick("administrative_area_level_1"),
    postcode: pick("postal_code", /* short */ true),
  };
}
```

**Step 2 — Unit tests** with real `address_components` fixtures captured during pre-flight: a standard Luton terrace, a flat/apartment, a new-build with no `postal_town`, a postcode-less result, and a London address (where `postal_town` = "London" and level_2 is absent → area falls back). Assert: never returns `undefined`; missing parts return `""`.
   File: `src/lib/address/parse-place.test.ts` (new). Verify: `pnpm vitest run src/lib/address` → all new tests pass.

### Phase B — Shared component

**Step 3 — `src/components/address/AddressAutocompleteField.tsx`** (client):

```tsx
interface Props {
  value: string;
  onChange: (v: string) => void;              // free typing — host owns the value
  onAddressSelected: (parts: AddressParts) => void;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>; // id/name/aria/className from the host
}
```

Behaviour:
- `loadMapsApi()` module-singleton: injects the Maps JS script (`libraries=places`, `region=GB`, `language=en-GB`) **on first focus**; returns a cached promise so a second field or the second form reuses it; resolves `null` when the key is missing → component silently stays a plain input (brief §3.1).
- On load: attach the autocomplete (per pre-flight #4's API choice) with `componentRestrictions:{country:'gb'}`, `types:['address']`, **`fields:['address_components','geometry']` — Essentials tier only, NEVER `name`/`displayName`** (see §1 cost table), a **session token** created on the first keystroke and discarded after selection (automatic if using `PlaceAutocompleteElement`), and **~300 ms debounce on input** before requests fire.
- On selection: `parsePlaceToAddressParts(place.address_components)` → `onAddressSelected(parts)`. If `place.address_components` is absent (user pressed Enter on free text), no-op — no alert.
- Cleanup: remove listeners on unmount; guard against the script resolving after unmount.
- Styling is entirely the host's (via `inputProps.className`) so the same component looks native in both trees.

**Step 4 — Component test** (mocked Maps global): renders as a plain input without a key; on a simulated `place_changed` calls `onAddressSelected` with parsed parts; never calls it on free typing.
   File: `src/components/address/AddressAutocompleteField.test.tsx` (new). Verify: `pnpm vitest run src/components/address` → all new tests pass.

### Phase C — Customer booking form

**Step 4a — Modal-dialog dropdown spike (BLOCKING — D20, C20-F3; NEW 2026-07-26).** The booking flow is no longer a page: it is a Base UI MODAL dialog (`src/features/booking/components/BookingDialog.tsx:57-64` — `Dialog.Root … modal` → `Dialog.Portal` → `Dialog.Backdrop` z-index 9998 / `Dialog.Popup` z-index 9999, `src/features/booking/BookingExperience.module.css:12`/`:20`). Google's `.pac-container` suggestion dropdown mounts on `document.body` OUTSIDE the dialog's owned DOM, so three integration risks the original plan never addressed apply: (1) z-index stacking below the backdrop/popup; (2) outside-pointer handling — a click on a suggestion may be treated as an outside click and be dismissed/swallowed; (3) modal inert/focus management. **Before any Step 5 wiring**, spike inside the OPEN booking dialog: attach autocomplete to the address input on the About step, type a partial address, and verify (a) the dropdown renders ABOVE the popup (a global `.pac-container { z-index: 10000 }` rule is an acceptable fix) and (b) clicking a suggestion registers the selection WITHOUT closing the dialog. **Both outcomes are sanctioned (D20):** PASS → proceed with Steps 5–6 as written; FAIL on either check → the approach shifts to an **in-dialog suggestion list** (fetch predictions via the Places API and render them in our own list inside the dialog DOM, keeping the same `onAddressSelected` contract) — record which outcome applied in the progress file before continuing. Verify: manual dev-run (`localhost:3000` → open booking dialog → About step); screenshot evidence to `redesign/evidence/C-20/`.

**Step 5 — Wire into `AboutYouStep.tsx`.** Replace the address `<Field>`'s inner `<input {...register("address")}>` with the shared component fed by `register`-compatible plumbing (`watch("address")` + `setValue("address", v, { shouldDirty: true })` for `onChange`, or `Controller` — implementer's choice; keep the existing label/error/aria markup untouched).
   **Path-swap (2026-07-26, C20-F1):** this step originally targeted `LocationDetailsStep.tsx`, which no longer exists — the target file is `src/features/booking/components/AboutYouStep.tsx`. The described structure holds there: address `<Field>` region L497-549 with `register("city")` L507, `register("area")` L520, `register("postcode")` L533, `register("address")` L547. The covered-town chips already use `setValue("city", …, { shouldValidate: true, shouldDirty: true })` at L190-195 — match that convention. Anchor check before editing: `grep -n 'register("address")' src/features/booking/components/AboutYouStep.tsx` → exactly one hit.

On `onAddressSelected(parts)`:
```ts
const apply = (k: "address"|"city"|"area"|"postcode", v: string) => {
  if (!v) return;                       // never blank an existing value (brief §3.3)
  setValue(k, v, { shouldValidate: true, shouldDirty: true });
};
```
Applying `city` with `shouldValidate` is what makes the **covered-area notice re-evaluate** (it reads `watch("city")`) — the single most important integration detail in this plan.

> **Mechanism corrected (2026-07-26, C20-F4):** the sentence above overstates `shouldValidate`. Post-merge, the form is `mode: "onSubmit"` with NO resolver and NO register rules (`BookingExperience.tsx:86-89`); errors are set manually (`safeParse` → `applyFormIssues`/`setError({ type: "manual" })`, `BookingExperience.tsx:346-357`, `389-396`) and re-clear via the watched-details re-validation effect (`BookingExperience.tsx:209-235`). The covered-area notice re-evaluates via `watch("city")` (`AboutYouStep.tsx:91`, `109-117`) on ANY `setValue` — `shouldValidate` is not what drives it. **KEEP `{ shouldValidate: true, shouldDirty: true }` exactly as specified** (it matches the covered-town chip convention at `AboutYouStep.tsx:190-195` and is harmless); only the causal claim is corrected.

**Step 6 — Customer-side check:** postcode/city/area inputs remain visible + editable; step navigation/validation unchanged; existing `LocationDetailsStep` tests still pass (extend with a fill-from-selection case).
   **Premise update (2026-07-26, C20-F7):** those tests no longer exist — the `LocationDetailsStep` tests were deleted with the old flow, and NO test file covers `AboutYouStep` (only `BookingSummary.test.tsx`, `booking-schema.test.ts`, `booking-packages.test.ts` under `src/features/booking/`). CREATE a new test file (e.g. `src/features/booking/components/AboutYouStep.test.tsx`) carrying the fill-from-selection case; "extend" is not possible. Verify: `pnpm vitest run src/features/booking` → new tests pass, no regressions.
   **Side-effect note (2026-07-26, C20-F5):** "navigation/validation unchanged" needs one caveat — `city` is folded into `availabilityInputsKey` (`BookingExperience.tsx:131-139`, normalized trim+lowercase) and the effect at `BookingExperience.tsx:237-247` calls `setPreferredDate(null)` when it changes. First-pass fills are safe (step order service → about → time), but an autocomplete city change during BACK-navigation silently clears the chosen date — identical to typing, so no code change; state it in the check and cover it in §3.3.

### Phase D — Admin create-booking form

**Step 7 — Wire into `ManualBookingForm.tsx`** (address field region, ~line 527 area): same component, admin `inputProps` styling. On selection call the existing setters and clear any `errs.address/postcode/city` entries so validation state matches typed behaviour. Prefill-from-client path untouched.

> **Coordination (rubric §10):** "ManualBookingForm.tsx is edited by C-02, C-03, C-06, C-20, and C-23 in this programme. Before this plan's ManualBookingForm.tsx steps, re-run this plan's own anchor greps (do not trust hardcoded line numbers) — a predecessor plan may have already shifted them. If a target region overlaps a just-landed edit from another Band-C plan, stop and diff manually rather than applying a line-numbered patch."

> **Typed-behaviour parity (2026-07-26, C20-F6):** "matches typed behaviour" requires MORE than bare setters + error clears — the typed input handlers also run side effects that a selection must replicate: (1) `markEdited(field)` per filled field (address `:1388`, postcode `:1356`, city `:1368`); (2) the city-change availability reset — clears `bookingDate`/`startTime`/`availChecked`/`availSlots` (`:1368`); (3) clear `postcodeLookupError` when filling postcode. Also coexist with the EXISTING postcode-lookup autofill (`:850-859`, fills empty city/area): an explicit autocomplete selection fills all four fields and should win. Bare setters would leave stale availability state and skip draft/edit tracking. Anchors are 2026-07-25 line numbers (setters `:527-530`, `errs.address/postcode/city` `:213-215`, address input region `:1380-1388`) — re-grep per the coordination note above. Verify: after wiring, select an address in the admin form with a date already checked → availability state resets and the edited fields are draft-tracked, exactly as when typed.

**Step 8 — Admin-side check:** availability lookup (city-dependent) behaves as if typed; `ManualBookingForm.test.tsx` extended with a selection case.
   File: `src/app/admin/bookings/new/ManualBookingForm.test.tsx` (exists). Verify: `pnpm vitest run src/app/admin/bookings/new` → the NEW selection case passes; the 3 pre-existing baseline failures in this file persist unchanged (do not "fix" them here).

**Step 9 — Registry + env docs.** `.env.example` entry with a comment (key is public-by-nature, restrict in Cloud Console); if C-18 has landed, add the Maps entry to `cookie-registry.ts` + bump `CONSENT_BANNER_VERSION`, and record the brief §2.5 classification decision (functional-on-interaction vs consent-gated) **with the user**.
   Files: `.env.example` (repo root, exists). `cookie-registry.ts` / `CONSENT_BANNER_VERSION`: absent as of 2026-07-26 (C-18 not landed) — the conditional stands; check `git log --oneline --grep="C-18"` at execution. Verify: `.env.example` diff shows only the one new commented entry.

---

## 3 — Verification gate

### 3.1 Static
`pnpm lint` · `npx tsc --noEmit` · `pnpm vitest run` (parser fixtures + component + both form tests) · `pnpm build` · bundle script (**ceiling +3 kB per form bundle**; the Maps script is external, not bundled). No new package in `package.json`.

**Baselines + gate corrections (2026-07-26, C20-F8/C20-F7/C20-F11):**
- `pnpm lint` = no NEW errors vs the 59-error baseline (55 untracked `design_handoff_area_pages/prototype` JSX + 4 pre-existing in `src/features/booking/`).
- `pnpm vitest run` = no NEW failures vs the 6 pre-existing baseline failures in 3 files (ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1); "both form tests" = `ManualBookingForm.test.tsx` (exists, extended in Step 8) + the NEW AboutYouStep test created in Step 6 (no customer address-step test survives the merge).
- Bundle check: only `scripts/measure-admin-bundles.mjs` exists (admin side). For the customer side there is no named script — compare `pnpm build` first-load-JS output for the `(public)` routes before vs after and record both numbers against the +3 kB ceiling.

### 3.2 Real-address matrix (the correctness gate) — both forms
Type and select ≥5 real addresses, asserting all four fields:

| # | Case | Expect |
|---|---|---|
| 1 | Standard Luton terrace | address/city="Luton"/area/postcode all filled |
| 2 | Flat/apartment | street fills; flat detail typed by user or left to access notes |
| 3 | New-build / missing `postal_town` | fallback chain fills city; nothing blanked |
| 4 | London address | city="London", area falls back sensibly |
| 5 | Out-of-covered-area town | fields fill AND the covered-area notice updates (customer form). **Updated 2026-07-26 (C20-F10):** covered-area is now a HARD validation gate (`validateServiceArea` superRefine, `booking-schema.ts:139-169`, enforced at `BookingExperience.tsx:389-396`) — expect the red notice AND About→Time advance blocked with an error on `city`, consistent with typing |

### 3.3 Behavioural
- **Lazy load:** DevTools Network shows **no maps.googleapis.com request on page load**; first request appears only after focusing the address field.
- **Session tokens:** typing → selecting produces one session (code review + request inspection).
- **Cost-shape checks (blocking, 2026-07-16):** (a) **no `name`/`displayName` in any field list** — grep the component + confirm in the request payload; (b) **debounce active** (~300 ms — rapid typing must not emit a request per character; count requests in the Network tab for a 20-character address); (c) after go-live, the Maps Platform **Metrics** page (SKU view) shows *Autocomplete Session Usage* at £0, a small count of *Place Details Essentials*, and **zero** *Dynamic Maps* events.
- **Fallback:** run the dev server with the key unset → plain input, no console errors surfaced to the user, form fully usable and submittable.
- **Manual-entry parity:** submit a booking with a fully hand-typed address on both forms → identical result to today.
- **No-selection path:** type free text, press Enter, submit → no alert, value preserved.
- **UK restriction:** typing a US city surfaces no US suggestions.
- **City-change date reset (added 2026-07-26, C20-F5):** pick a date on the time step, navigate BACK to About, select an address with a different city, return to the time step → the previously chosen date is cleared (no stale slots). This is existing behaviour (`availabilityInputsKey` → `setPreferredDate(null)`, `BookingExperience.tsx:131-139` + `237-247`) — autocomplete must match it, not bypass it.
- **In-dialog dropdown (added 2026-07-26, D20):** whichever Step 4a outcome applied, the shipped suggestion UI is fully usable inside the OPEN modal dialog — renders above backdrop/popup, click-select does not dismiss the dialog.

### 3.4 Accessibility + responsive
Keyboard: arrow keys + Enter select a suggestion; Escape dismisses; focus returns sanely. Screen-reader: the suggestion list is announced (Google's widget provides ARIA; verify and document any gap). **375 + 1280 on both forms:** the dropdown is fully visible — specifically not clipped behind the customer flow's sticky footer or the admin sticky save bar. Screenshots stored in `redesign/evidence/C-20/` (evidence-dir convention 2026-07-26, D15 — never write into `redesign/audits/**`). **Context update (2026-07-26, C20-F3):** the customer flow is a full-screen modal dialog, not a page — run the 375/1280 customer checks inside the OPEN dialog; the sticky element there is the `BookingActionBar`; Escape behaviour must dismiss the suggestion list WITHOUT closing the dialog (verify explicitly).

### 3.5 Key safety sign-off (blocking)
Confirm with the user, before marking C-20 done: key restricted (referrers + APIs) — **done 2026-07-16**: `https://rahmatherapy.uk/*`, `https://*.rahmatherapy.uk/*`, `http://localhost:3000/*` + Maps JS / Places / Places (New); rotation decision recorded; £1 budget alert set. **No sign-off without this.**

> **Re-mark WITHDRAWN — gate stands DONE as of 2026-07-16 (Owner clarification, 2026-07-26).** The same-day re-mark (D19/C20-F2) and its §3.5a "add `.co.uk` referrer" HARD-STOP step are void: the Owner confirmed the site is served ONLY on `https://rahmatherapy.uk/` — the `.co.uk` strings in the codebase are wrong *metadata* (canonicals/JSON-LD, which C-21 corrects), not a serving origin. HTTP-referrer restrictions check the domain pages are actually served from, so the 2026-07-16 list (`rahmatherapy.uk` + wildcard + localhost) is correct and complete; no `.co.uk` referrer is needed, ever. The **rotation decision** (key shared in plaintext during planning) remains the one open sign-off item. Smoke-test note kept: verify suggestions appear on the served domain with no `RefererNotAllowedMapError` in the console.

### 3.6 Cost posture confirmation (post-deploy, with the user)
Two weeks after go-live and again on the first working day of the following month: Maps Platform → **Metrics** (SKU view) shows *Autocomplete Session Usage* £0, *Place Details Essentials* well under 8,000/month, **zero** Dynamic Maps. Note the trial-credit trap — during the first 90 days a $300 credit can silently absorb overage, so this check must confirm usage is inside the **free allowance itself**, not merely that the bill is £0.

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Unrestricted key abused → billing | medium | high | §3.5 blocking sign-off (**done 2026-07-16**; the 2026-07-26 re-mark was withdrawn same day — Owner confirmed the site serves only on `rahmatherapy.uk`, so the referrer list is correct); rotation flagged (key was shared in plaintext); referrer restriction is the load-bearing control since Maps quotas are per-minute, not per-day, and budgets only email. |
| **Referrer/domain mismatch → autocomplete silently dead in prod** (NEW 2026-07-26) | high until §3.5a done | medium | §3.5a Owner referrer addition + smoke test for `RefererNotAllowedMapError`; soft-order C-21 first (header note, D19). |
| **`name` field requested → Pro tier** (halves free allowance, triples unit price) | **high if unchecked — the reference snippet includes it** | medium | §1 deviations table + §3.3 blocking grep. The single most likely way this feature accidentally costs money. |
| Abandoned autocomplete sessions blow the Autocomplete Requests allowance | medium | medium | ~300 ms debounce (§2 Step 3) + §3.3 request-count check; verified arithmetic: ~7,200/month debounced vs ~14,400 undebounced against 10,000 free. |
| Trial credit masks real overage for 90 days | medium | low | §3.6 checks usage against the free allowance itself, not the invoice total. |
| Google API surface differs (classic vs `PlaceAutocompleteElement`) | medium | medium | Pre-flight #4 decides; the swap is contained in one component file behind a stable prop contract. |
| UK component mapping wrong for some addresses | medium | medium | Fallback chains + the 5-case real-address matrix (§3.2) as a hard gate. |
| Autocomplete fills `city` without triggering covered-area logic | medium | high | `setValue(..., { shouldValidate: true })` is specified explicitly (Step 5) and tested in §3.2 case 5 — the plan's single most important detail. **Mechanism corrected 2026-07-26 (C20-F4):** the notice re-evaluates via `watch("city")` on any `setValue` — see the Step 5 correction; the mitigation (setValue with the specified options + §3.2 case 5) stands. |
| Dropdown clipped behind sticky footers at 375 | medium | low | §3.4 explicit check both forms. |
| **Google `.pac-container` (body-mounted) vs the Base UI modal dialog — z-index below backdrop, outside-click dismissal, inert handling** (NEW 2026-07-26, C20-F3) | high if unspiked | high | Step 4a BLOCKING spike (D20) with the sanctioned fallback (in-dialog suggestion list); §3.3 in-dialog check + §3.4 dialog-context checks. |
| Script load cost/latency on the booking step | low | low | Lazy on focus; the field is usable while it loads (plain input until ready). |
| Third-party request without consent coordination | medium | medium | Brief §2.5: registry entry + explicit classification decision with the user (C-18 standing rule). |
| Merge collision in `ManualBookingForm.tsx` with C-06/C-02 (full set 2026-07-26: C-02/C-03/C-06/C-23) | medium | low | Pre-flight #6; different regions; coordinate commit order; Step 7 rubric §10 note — re-grep anchors, never trust line numbers. |
| Users become dependent on autocomplete and mistype when it's down | low | low | Manual entry always available and tested (§3.3). |

---

## 5 — Undo procedure

Pure git revert (per-phase commits). Reverting Phase C/D restores hand-typed inputs; Phases A/B leave unused files (harmless, deletable). No migration, no DB state. If the key must be killed urgently, deleting/restricting it in Cloud Console degrades the field to a plain input immediately — no deploy required.

---

## 6 — Test fixture guidance

Real addresses only for the §3.2 matrix — use **the clinic's own address and obviously-public addresses**, never a real client's. Any test bookings created follow the `.example.test` convention and are cleaned up. Badar's `9d55ce2a` untouched.

---

## 7 — Commit cadence

| Commit | Coverage |
|---|---|
| 1 | Phase A — parser + fixtures/tests |
| 2 | Phase B — shared component + lazy loader + test |
| 3 | Phase C — customer form wiring + test |
| 4 | Phase D — admin form wiring + test + env/registry docs |
| 5 | Verification — matrix evidence + screenshots + progress file + master plan row → ✅ |

`feat(redesign): C-20 {phase}` prefixes. No migration commits.

---

## 8 — Hand-off to C-C

1. Read brief + plan; run pre-flight — **#3 (key restriction/rotation) and #4 (API surface) are blocking** (#3 carries a STOP-AND-ASK, 2026-07-26).
2. Phases A→D in order; the parser is testable with zero browser work, so it lands first and de-risks everything after. **Step 4a (modal-dialog dropdown spike) blocks Phase C wiring (added 2026-07-26, D20).**
3. Verification §3.2 (real-address matrix) and §3.5 (key sign-off) are the two gates that cannot be waived. **§3.5 stands DONE as of 2026-07-16 (the 2026-07-26 D19 re-mark was withdrawn same day — Owner confirmed the site serves only on `rahmatherapy.uk`); the surviving open item inside §3.5 is the key-rotation STOP-AND-ASK (pre-flight #3a).**
4. Record the C-18 consent classification decision in the progress file.
5. Final commit flips the master-plan C-20 row → ✅.

---

*End of C-20 plan. Brief: `redesign/briefs/C-20-address-autocomplete-brief.md`.*
