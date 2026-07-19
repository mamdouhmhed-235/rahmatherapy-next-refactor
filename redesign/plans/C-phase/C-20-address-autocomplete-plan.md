# C-20 — Address autocomplete (Google Places) on both booking forms — **PLAN**

**Type:** Band C plan-writing output (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Brief:** `redesign/briefs/C-20-address-autocomplete-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-20-address-autocomplete-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. Branch confirmed with user (touches both public and admin trees — public layouts diverge ~9 lines from the frontend line; see C-17 note).
2. Dev server → 200; baseline tests + static gates green.
3. **Key + Cloud Console (blocking):**
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` present in the dev env (and planned for the Cloudflare BUILD env — `NEXT_PUBLIC_*` is inlined at build time, same caveat as C-17 Step 3).
   - Confirm with the user: key **restricted** (HTTP referrers: production domain + localhost; APIs: Maps JavaScript API + Places API only) and, per brief §2.4, whether the plaintext-shared key is being **rotated** first. Do not ship an unrestricted key.
4. **API-surface check (brief §3.9):** verify in the Cloud Console / current Google docs whether this project should use the classic `google.maps.places.Autocomplete` (as in the user's reference snippet) or the newer `PlaceAutocompleteElement`. Record the answer; implement whichever the account supports. The component's external contract is identical either way.
5. **Form-shape re-verify** (2026-07-16 line numbers):
   ```bash
   grep -n "register(\"address\")\|register(\"city\")\|register(\"postcode\")\|register(\"area\")" src/features/booking/components/LocationDetailsStep.tsx
   grep -n "setAddress\|setPostcode\|setCity\|setArea" src/app/admin/bookings/new/ManualBookingForm.tsx
   ```
6. **Sibling-plan collision check:** if C-06 (Step 13 email-optional) or C-02 (Phase E recurring section) are landing in the same window, note the shared file `ManualBookingForm.tsx` — different regions, but coordinate commit order.
7. **DO-NOT-TOUCH:** booking API schemas, availability logic, DB, RECON §5 untouchables. C-20 changes only how the four address fields get filled.

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

Also added beyond the snippet: `componentRestrictions: { country: 'gb' }`, Places **session tokens**, and a hard no-op fallback when the key/script is unavailable.

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
- On load: attach the autocomplete (per pre-flight #4's API choice) with `componentRestrictions:{country:'gb'}`, `types:['address']`, `fields:['address_components','geometry','name']`, and a **session token** created on the first keystroke of a lookup and discarded after a selection.
- On selection: `parsePlaceToAddressParts(place.address_components)` → `onAddressSelected(parts)`. If `place.address_components` is absent (user pressed Enter on free text), no-op — no alert.
- Cleanup: remove listeners on unmount; guard against the script resolving after unmount.
- Styling is entirely the host's (via `inputProps.className`) so the same component looks native in both trees.

**Step 4 — Component test** (mocked Maps global): renders as a plain input without a key; on a simulated `place_changed` calls `onAddressSelected` with parsed parts; never calls it on free typing.

### Phase C — Customer booking form

**Step 5 — Wire into `LocationDetailsStep.tsx`.** Replace the address `<Field>`'s inner `<input {...register("address")}>` with the shared component fed by `register`-compatible plumbing (`watch("address")` + `setValue("address", v, { shouldDirty: true })` for `onChange`, or `Controller` — implementer's choice; keep the existing label/error/aria markup untouched).

On `onAddressSelected(parts)`:
```ts
const apply = (k: "address"|"city"|"area"|"postcode", v: string) => {
  if (!v) return;                       // never blank an existing value (brief §3.3)
  setValue(k, v, { shouldValidate: true, shouldDirty: true });
};
```
Applying `city` with `shouldValidate` is what makes the **covered-area notice re-evaluate** (it reads `watch("city")`) — the single most important integration detail in this plan.

**Step 6 — Customer-side check:** postcode/city/area inputs remain visible + editable; step navigation/validation unchanged; existing `LocationDetailsStep` tests still pass (extend with a fill-from-selection case).

### Phase D — Admin create-booking form

**Step 7 — Wire into `ManualBookingForm.tsx`** (address field region, ~line 527 area): same component, admin `inputProps` styling. On selection call the existing setters and clear any `errs.address/postcode/city` entries so validation state matches typed behaviour. Prefill-from-client path untouched.

**Step 8 — Admin-side check:** availability lookup (city-dependent) behaves as if typed; `ManualBookingForm.test.tsx` extended with a selection case.

**Step 9 — Registry + env docs.** `.env.example` entry with a comment (key is public-by-nature, restrict in Cloud Console); if C-18 has landed, add the Maps entry to `cookie-registry.ts` + bump `CONSENT_BANNER_VERSION`, and record the brief §2.5 classification decision (functional-on-interaction vs consent-gated) **with the user**.

---

## 3 — Verification gate

### 3.1 Static
`pnpm lint` · `npx tsc --noEmit` · `pnpm vitest run` (parser fixtures + component + both form tests) · `pnpm build` · bundle script (**ceiling +3 kB per form bundle**; the Maps script is external, not bundled). No new package in `package.json`.

### 3.2 Real-address matrix (the correctness gate) — both forms
Type and select ≥5 real addresses, asserting all four fields:

| # | Case | Expect |
|---|---|---|
| 1 | Standard Luton terrace | address/city="Luton"/area/postcode all filled |
| 2 | Flat/apartment | street fills; flat detail typed by user or left to access notes |
| 3 | New-build / missing `postal_town` | fallback chain fills city; nothing blanked |
| 4 | London address | city="London", area falls back sensibly |
| 5 | Out-of-covered-area town | fields fill AND the covered-area notice updates (customer form) |

### 3.3 Behavioural
- **Lazy load:** DevTools Network shows **no maps.googleapis.com request on page load**; first request appears only after focusing the address field.
- **Session tokens:** typing → selecting produces one session (code review + request inspection).
- **Fallback:** run the dev server with the key unset → plain input, no console errors surfaced to the user, form fully usable and submittable.
- **Manual-entry parity:** submit a booking with a fully hand-typed address on both forms → identical result to today.
- **No-selection path:** type free text, press Enter, submit → no alert, value preserved.
- **UK restriction:** typing a US city surfaces no US suggestions.

### 3.4 Accessibility + responsive
Keyboard: arrow keys + Enter select a suggestion; Escape dismisses; focus returns sanely. Screen-reader: the suggestion list is announced (Google's widget provides ARIA; verify and document any gap). **375 + 1280 on both forms:** the dropdown is fully visible — specifically not clipped behind the customer flow's sticky footer or the admin sticky save bar. Screenshots stored in `redesign/audits/C-A/screenshots-c-20/`.

### 3.5 Key safety sign-off (blocking)
Confirm with the user, before marking C-20 done: key restricted (referrers + APIs), rotation decision recorded, billing alert optional-but-recommended. **No sign-off without this.**

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Unrestricted key abused → billing | medium | high | §3.5 blocking sign-off; rotation flagged (key was shared in plaintext); referrer+API restrictions; budget alert recommended. |
| Google API surface differs (classic vs `PlaceAutocompleteElement`) | medium | medium | Pre-flight #4 decides; the swap is contained in one component file behind a stable prop contract. |
| UK component mapping wrong for some addresses | medium | medium | Fallback chains + the 5-case real-address matrix (§3.2) as a hard gate. |
| Autocomplete fills `city` without triggering covered-area logic | medium | high | `setValue(..., { shouldValidate: true })` is specified explicitly (Step 5) and tested in §3.2 case 5 — the plan's single most important detail. |
| Dropdown clipped behind sticky footers at 375 | medium | low | §3.4 explicit check both forms. |
| Script load cost/latency on the booking step | low | low | Lazy on focus; the field is usable while it loads (plain input until ready). |
| Third-party request without consent coordination | medium | medium | Brief §2.5: registry entry + explicit classification decision with the user (C-18 standing rule). |
| Merge collision in `ManualBookingForm.tsx` with C-06/C-02 | medium | low | Pre-flight #6; different regions; coordinate commit order. |
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

1. Read brief + plan; run pre-flight — **#3 (key restriction/rotation) and #4 (API surface) are blocking**.
2. Phases A→D in order; the parser is testable with zero browser work, so it lands first and de-risks everything after.
3. Verification §3.2 (real-address matrix) and §3.5 (key sign-off) are the two gates that cannot be waived.
4. Record the C-18 consent classification decision in the progress file.
5. Final commit flips the master-plan C-20 row → ✅.

---

*End of C-20 plan. Brief: `redesign/briefs/C-20-address-autocomplete-brief.md`.*
