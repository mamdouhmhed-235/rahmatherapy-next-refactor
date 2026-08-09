# C-20 — Address autocomplete (Google Places) on both booking forms — PROGRESS

**Plan:** `redesign/plans/C-phase/C-20-address-autocomplete-plan.md`
**Brief:** `redesign/briefs/C-20-address-autocomplete-brief.md`
**Programme:** Band C, C-C implementation. **Taken after C-23 Phase C and C-19** under the Owner-approved reorder (2026-08-04); §4 order position 19. C-23-before-C-14 is preserved.
**Predecessor HEAD at plan start:** `ed19eae`.
**Migrations:** none. **Packages:** none. **Commits:** 5 per the plan's cadence table.

---

## 0 — Pre-flight (2026-08-09, at `ed19eae`)

| # | Check | Result |
|---|---|---|
| 1 | branch `master`; `git merge-base --is-ancestor ea97932 HEAD` | ✅ `master`, exit 0 |
| 1 | `git status --porcelain -- src/features/booking src/components/address src/lib/address src/app/admin/bookings/new .env.example` | ✅ **empty** |
| 2 | dev server | ✅ up, Owner-run (`/` → 308 `/home/`, the documented normal form — the plan's literal "200 on `/`" is stale) |
| 3 | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` present in dev env | ✅ recorded present at the previous session's close. **No agent has read or printed its value, and none will.** |
| 3a | ⏸ key-rotation decision | ⏸ **OPEN — see §0.4** |
| 4 | API-surface check | ✅ **RESOLVED — see §0.2** |
| 5 | form-shape re-verify | ⚠️ **anchors drifted — see §0.1** |
| 6 | sibling-plan collision check | ✅ C-02, C-03, C-06 shipped; **C-23 Phases B+C landed and both left `ManualBookingForm.tsx` untouched**; C-23 Phase D is ⛔-blocked and will edit the *date* region, not the address region |
| — | C-18 landed? (Step 9 conditional) | ✅ **landed** — `src/lib/consent/cookie-registry.ts` exists, so Step 9's conditional branch is LIVE |

**Baselines inherited by identity** (from C-23 Phase C verification at `a345d99`, carried through `e70bef8`): tsc **0** · vitest failures **exactly** `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 (5 failed / 2007 passed / 2012) · eslint **59E/7W** in exactly `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`.
**The plan's own §0/§3.1 baseline text — "485/491, six failures including `createBookingTransaction`" — is a frozen 2026-07 snapshot and is SUPERSEDED.** `createBookingTransaction` was fixed by C-06 and its absence is now expected; treating it as a baseline entry would mask a regression.

### 0.1 — Anchor drift: four plan citations are stale, one finding understates reality

Re-located by symbol at `ed19eae` (SUBAGENT-RULES rule 7). The customer-side path-swap (C20-F1) proved exactly right; everything admin-side has moved.

| Anchor | Plan cites | Actual at `ed19eae` | |
|---|---|---|---|
| `register("city")` / `("area")` / `("postcode")` / `("address")` in `AboutYouStep.tsx` | 507 / 520 / 533 / 547 | **507 / 520 / 533 / 547** | exact — C20-F1's path-swap holds |
| admin setters `setAddress`/`setPostcode`/`setCity`/`setArea` | `:527-530` | **587–590** | drifted |
| admin typed handlers (postcode / city / area / address) | `:1356` / `:1368` / `:1388` | **1543 / 1556 / 1571 / 1582** | drifted |
| cookie registry | `src/lib/cookie-registry.ts` | **`src/lib/consent/cookie-registry.ts`** | drifted (and C-18 has landed, so Step 9's conditional is live) |
| `.env.example` Maps entry | expected absent | **absent** | Step 9 genuinely adds it |

**⚠️ Finding C20-F6 understates the city-change side effect — and the understatement is the dangerous direction.** C20-F6 says selecting an address must replicate the typed handler's clearing of `bookingDate` / `startTime` / `availChecked` / `availSlots`. The live handler at `ManualBookingForm.tsx:1556` **also** clears `femaleAvailChecked` and `maleAvailChecked`:

```
onChange={(e) => { setCity(e.target.value); markEdited("city"); setBookingDate(""); setStartTime(""); setAvailChecked(false); setAvailSlots([]); setFemaleAvailChecked(false); setMaleAvailChecked(false); }}
```

An implementation that replicated only C20-F6's four items would leave **stale mixed-gender availability state** after an autocomplete selection — the exact "informs but the state underneath is wrong" defect class this programme keeps catching. Phase D must replicate all six. Confirmed alongside: the postcode handler at `:1543` does clear `postcodeLookupError`, as C20-F6 says.

### 0.2 — ⚠️ Pre-flight #4 RESOLVED: the plan's reference API is unavailable to this project

The plan is written around the classic `google.maps.places.Autocomplete` (the Owner's reference snippet). **That API cannot be used here.**

- **`google.maps.places.Autocomplete` and `AutocompleteService` are not available to new customers as of 1 March 2025.** Existing users keep them (no discontinuation scheduled, ≥12 months' notice promised, regressions-only bug fixes), but this project's Google Cloud setup dates from **July 2026** — it is a new customer. The classic widget would not function.
- Verified against Google's current published reference, not from memory: [Places Autocomplete Service (deprecated)](https://developers.google.com/maps/documentation/javascript/reference/places-autocomplete-service).

**Consequences, all confirmed against the current reference rather than assumed:**

| Plan text (classic API) | Reality (new Places API) |
|---|---|
| components are `{ long_name, short_name, types }` | **`AddressComponent` = `{ longText, shortText, types }`** — camelCase, different key names |
| `fields: ['address_components','geometry']` | **`fetchFields({ fields: ["addressComponents", "location"] })`** |
| `componentRestrictions: { country: 'gb' }` | **`includedRegionCodes: ['gb']`** — a hard restriction. Note `region: 'gb'` is *not* a substitute: the reference states it "does not restrict results to the specified region", it only affects formatting and ranking. Using `region` alone would silently fail the plan's UK-restriction gate (§3.3 "typing a US city surfaces no US suggestions"). |
| session tokens hand-managed | `new AutocompleteSessionToken()`; automatically consumed by `fetchFields()` on a place derived from a prediction, after which a **fresh token must be created for the next session** |

**The `types` values themselves are unchanged** and remain snake_case (`street_number`, `route`, `postal_town`, `administrative_area_level_2`, `postal_code`, …), so the plan's UK component mapping — the whole point of the third deliberate deviation — survives intact.

**The cost rule survives translation and is unchanged in force:** Essentials fields only — `addressComponents` + `location`, **never `displayName`** (the new-API name for the `name` field that would push every lookup into the Pro tier: free allowance 10,000→5,000/month, unit price $5→$17 per 1,000).

**This is not an improvisation around a contradiction.** The plan's own pre-flight #4 delegates this decision — *"verify … whether this project should use the classic `google.maps.places.Autocomplete` … or the newer `PlaceAutocompleteElement`. Record the answer; implement whichever the account supports. The component's external contract is identical either way."* The external contract (`onAddressSelected(parts)`) is preserved; only the internals and the parser's input shape change. Recorded here as pre-flight #4's answer.

**Widget choice — Step 4a's spike is preserved, not pre-empted.** Phase B builds on `PlaceAutocompleteElement` (Google renders its own input and dropdown; session tokens handled automatically; accessibility supplied by Google). That is precisely what Step 4a's BLOCKING spike is designed to test inside the Base UI modal dialog, and D20 already sanctions the fallback — an in-dialog suggestion list built on `AutocompleteSuggestion.fetchAutocompleteSuggestions`, which keeps the same `onAddressSelected` contract and is dialog-safe by construction because we own the DOM. **If the spike fails, the fallback requires hand-managed session tokens and hand-built combobox ARIA** — both cost-critical and a11y-critical, and both must then be verified explicitly rather than inherited from Google.

### 0.3 — Verification tiers and model routing, declared in advance (§2.9c, §5)

| Phase | Tier | Model | Why |
|---|---|---|---|
| A — parser + fixtures | TARGETED | `sonnet` | Pure function, no browser, no live surface, fully unit-testable |
| B — shared component + lazy loader | **FULL** | `sonnet` | New file, but it owns script loading, session-token lifecycle (billing) and unmount safety |
| C — customer booking form | **FULL** | **`opus`** | Edits `AboutYouStep.tsx` inside the **live public booking flow** — the business's revenue path — plus the Step 4a modal-dialog spike and a **hard** covered-area validation gate (`validateServiceArea` superRefine). §5's capability amendment routes live customer surfaces to opus; justification logged here |
| D — admin create-booking form | **FULL** | **`opus`** | `ManualBookingForm.tsx` is the shared file five Band-C plans edit, and Step 7 demands exact side-effect parity with the typed handler — six pieces of state, not the four C20-F6 lists (§0.1). §2.9(c) makes FULL mandatory for shared files and state machines |
| E — closeout | FULL | `sonnet` fan-out | Two unwaivable gates (§3.2 real-address matrix, §3.5 key sign-off) |

### 0.4 — ⏸ HARD-STOP forecast (§2.9e) — two Owner items, both still OPEN

1. **⏸ Key rotation (pre-flight #3a / gate §3.5).** The key was shared in plaintext during planning, **and a live key was pasted into the chat transcript during the 2026-08-04 session** (embedded twice in a Google reference snippet). Whether the key now in `.env` is that same one is **unconfirmed — no agent has read the value, by design.** §3.5 is a blocking sign-off: C-20 cannot be marked done without a recorded rotation decision. Raised early so the Owner can pre-answer; it hard-blocks at closeout regardless.
2. **⏸ C-18 consent classification (Step 9).** C-18 has landed, so the conditional branch is live: Google Maps needs a `cookie-registry.ts` entry, a `CONSENT_BANNER_VERSION` bump, and an explicit **functional-on-interaction vs consent-gated** classification decision — which the plan requires be made *with the Owner*, not inferred. The plan recommends functional-on-interaction.

Gate §3.5's referrer half **stands DONE** (2026-07-16: `https://rahmatherapy.uk/*`, `https://*.rahmatherapy.uk/*`, `http://localhost:3000/*`, three APIs). The 2026-07-26 D19 re-mark and its `.co.uk` referrer step were withdrawn the same day — the site serves only on `rahmatherapy.uk`. Do not re-litigate either.

**Two shortcuts were assessed and rejected in the previous session — do NOT re-litigate:** Google's sample "Address Selection" HTML (requests `name` → Pro tier; US-shaped; hardcoded key; CDN; `window.alert`; no session tokens, debounce or country restriction), and embedding Google's hosted demo in an `<iframe>` (cross-origin, so the parent cannot read the selected address at all — the four fields would stay empty — plus it breaks C-18's regulator test by loading Google code before consent). Reasons in full at `C-23-admin-availability-calendar-progress.md` §3.4.

---

## 1 — Phase A (Steps 1–2)

▶ **In flight** at time of writing — implementer dispatched on `sonnet` at `ed19eae`. Scope: `src/lib/address/parse-place.ts` + `parse-place.test.ts`, two new files, nothing else.

**Orchestrator ruling on fixtures, recorded so it is not mistaken for evidence it is not:** the plan asks for "real `address_components` fixtures captured during pre-flight". Live capture needs the billed key plus a browser session, so the fixtures are instead **hand-built to Google's documented `AddressComponent` shape, modelled on real UK addresses, and labelled as such in the test file**. They prove the mapping logic, not real-world API behaviour. Real-world correctness is proved later by gate §3.2's five-case real-address matrix, which is a browser gate.

---

## 2 — ▶ Position

Phase A in flight. Phases B–E not started. Both ⏸ items in §0.4 open.
