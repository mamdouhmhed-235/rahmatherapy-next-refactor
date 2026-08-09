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

### 0.2a — Widget choice: `AutocompleteSuggestion` + our own input, NOT `PlaceAutocompleteElement`

Resolved at Phase B dispatch, 2026-08-09, after working through what the plan's own Step 3 contract actually requires. **This is D20's sanctioned fallback shape, reached before the spike rather than after it — and the reasoning is that the plan's stated component contract is incompatible with the alternative.**

The two candidates on the new API:

| | **A — `PlaceAutocompleteElement`** | **B — `AutocompleteSuggestion` + our own input/list** |
|---|---|---|
| Who owns the input | Google (a web component) | **We do** |
| Who owns the dropdown | Google, its own DOM | **We do — inside the dialog** |
| Session tokens | automatic | hand-managed |
| Combobox ARIA | supplied by Google | **we build it** |
| Host styling | constrained to CSS parts | **exact, via `inputProps.className`** |

**Why B.** The plan's Step 3 interface is `{ value, onChange, onAddressSelected, inputProps }`, annotated *"free typing — host owns the value"* and *"`id`/`name`/`aria`/`className` from the host"*, plus *"Styling is entirely the host's … so the same component looks native in both trees."* **That contract only exists if we own the `<input>`** — option A cannot satisfy it, because Google's web component renders and owns its own field. The plan's Step 3 spec is, in substance, a description of option B.

Two corroborating reasons:
- **Step 4a's spike was written for the classic API too.** It tests `.pac-container`, the *classic* widget's body-mounted dropdown, against the Base UI modal dialog's backdrop/z-index/outside-click handling (C20-F3). That specific failure mode **cannot occur under option B**, because our suggestion list lives inside the dialog's own DOM. D20 pre-sanctions exactly this outcome: *"FAIL on either check → the approach shifts to an in-dialog suggestion list (fetch predictions via the Places API and render them in our own list inside the dialog DOM, keeping the same `onAddressSelected` contract)."* Step 4a is therefore **not skipped** — it is re-pointed from "does Google's dropdown survive the dialog?" to "does our own list behave correctly in the dialog?", which is still a blocking Phase C check with screenshot evidence.
- **Both host forms are bespoke-designed.** An unstyleable Google-rendered field would look foreign in the public booking dialog *and* in the admin form — the one thing the plan's styling clause exists to prevent.

**What option B costs, and what must therefore be verified explicitly rather than inherited from Google:**
1. **Session tokens are ours to manage.** One `AutocompleteSessionToken` per typing session, passed on every `fetchAutocompleteSuggestions` call, consumed automatically by the subsequent `fetchFields()` on the place derived from the prediction, then **a fresh token created for the next session**. Getting this wrong is the difference between one billed Place Details event per booking and a billed request per keystroke. This is a **blocking** Phase B verification item, not a code-review nicety.
2. **Combobox accessibility is ours to build** — WAI-ARIA combobox with a listbox popup, arrow-key traversal, Enter to select, Escape to dismiss the list **without closing the surrounding dialog**. Gate §3.4 already requires all of this; under option A it would have come free.

The cost rule is unchanged and unaffected by the choice: `addressComponents` + `location` only, **never `displayName`**.

### 0.3 — Verification tiers and model routing, declared in advance (§2.9c, §5)

| Phase | Tier | Model | Why |
|---|---|---|---|
| A — parser + fixtures | TARGETED | `sonnet` | Pure function, no browser, no live surface, fully unit-testable |
| B — shared component + lazy loader | **FULL** | `sonnet` | New file, but it owns script loading, session-token lifecycle (billing) and unmount safety |
| C — customer booking form | **FULL** | **`opus`** | Edits `AboutYouStep.tsx` inside the **live public booking flow** — the business's revenue path — plus the Step 4a modal-dialog spike and a **hard** covered-area validation gate (`validateServiceArea` superRefine). §5's capability amendment routes live customer surfaces to opus; justification logged here |
| D — admin create-booking form | **FULL** | **`opus`** | `ManualBookingForm.tsx` is the shared file five Band-C plans edit, and Step 7 demands exact side-effect parity with the typed handler — six pieces of state, not the four C20-F6 lists (§0.1). §2.9(c) makes FULL mandatory for shared files and state machines |
| E — closeout | FULL | `sonnet` fan-out | Two unwaivable gates (§3.2 real-address matrix, §3.5 key sign-off) |

### 0.4 — ⏸ HARD-STOP forecast (§2.9e) — two Owner items, both still OPEN

1. **⏸ Key rotation (pre-flight #3a / gate §3.5) — ✅ ANSWERED 2026-08-09, in chat: DO NOT ROTATE.**
   **Owner decision, recorded verbatim in intent: "no need to rotate it".** This closes the last open half of gate §3.5 — the referrer/API half already stood DONE from 2026-07-16 — so **§3.5 is now fully satisfied** and C-20 has no remaining rotation blocker.
   **Context the decision was made against, recorded once for the audit trail and not re-argued:** the key was shared in plaintext during planning, and a live key was pasted into the 2026-08-04 chat transcript (embedded twice inside a Google reference snippet). Whether the key currently in `.env` is that same one remains **unconfirmed — no agent has read the value, by design, and none will.**
   **Why the decision is defensible on the facts:** the load-bearing cost control for a Maps key is not secrecy but the **HTTP-referrer restriction**, which is already in place and correct — `https://rahmatherapy.uk/*`, `https://*.rahmatherapy.uk/*`, `http://localhost:3000/*`, limited to Maps JavaScript + Places + Places (New). A `NEXT_PUBLIC_*` Maps key is inlined into client bundles and is public by nature in any case, so exposure in a transcript does not change its threat model materially; a third party cannot bill this key from their own origin while the referrer list holds. **Residual risk, stated once:** referrer headers are spoofable outside a browser, so the restriction deters casual abuse rather than a determined actor — which is why the plan's §3.6 post-deploy Metrics check (usage inside the free allowance, not merely a £0 invoice, since the 90-day trial credit can mask overage) stays on the Owner's list regardless.
2. **⏸ C-18 consent classification (Step 9).** C-18 has landed, so the conditional branch is live: Google Maps needs a `cookie-registry.ts` entry, a `CONSENT_BANNER_VERSION` bump, and an explicit **functional-on-interaction vs consent-gated** classification decision — which the plan requires be made *with the Owner*, not inferred. The plan recommends functional-on-interaction.

Gate §3.5's referrer half **stands DONE** (2026-07-16: `https://rahmatherapy.uk/*`, `https://*.rahmatherapy.uk/*`, `http://localhost:3000/*`, three APIs). The 2026-07-26 D19 re-mark and its `.co.uk` referrer step were withdrawn the same day — the site serves only on `rahmatherapy.uk`. Do not re-litigate either.

**Two shortcuts were assessed and rejected in the previous session — do NOT re-litigate:** Google's sample "Address Selection" HTML (requests `name` → Pro tier; US-shaped; hardcoded key; CDN; `window.alert`; no session tokens, debounce or country restriction), and embedding Google's hosted demo in an `<iframe>` (cross-origin, so the parent cannot read the selected address at all — the four fields would stay empty — plus it breaks C-18's regulator test by loading Google code before consent). Reasons in full at `C-23-admin-availability-calendar-progress.md` §3.4.

---

## 1 — Phase A (Steps 1–2)

▶ **In flight** at time of writing — implementer dispatched on `sonnet` at `ed19eae`. Scope: `src/lib/address/parse-place.ts` + `parse-place.test.ts`, two new files, nothing else.

**Orchestrator ruling on fixtures, recorded so it is not mistaken for evidence it is not:** the plan asks for "real `address_components` fixtures captured during pre-flight". Live capture needs the billed key plus a browser session, so the fixtures are instead **hand-built to Google's documented `AddressComponent` shape, modelled on real UK addresses, and labelled as such in the test file**. They prove the mapping logic, not real-world API behaviour. Real-world correctness is proved later by gate §3.2's five-case real-address matrix, which is a browser gate.

---

## 1a — Phases A, B, C — implemented

| Commit | Phase | Model |
|---|---|---|
| `92f031d` | A — parser + fixtures | `sonnet` |
| `cc32657` | A hardening — closed two **proven-vacuous** assertions found by the Phase A verifier | `sonnet` |
| `ac0a283` | B — shared autocomplete component + tests | `sonnet` |
| `af2c5b1` | B fix round — host-themed list + widened primary types (2 BLOCKING) | `sonnet` |
| `9593a74` | C — customer booking form wiring + new `AboutYouStep.test.tsx` | `opus` |

**Opus justification for Phase C (§5):** it edits `AboutYouStep.tsx` inside the **live public booking flow** — the business's revenue path — behind a hard covered-area validation gate.

### 1a.1 — Phase B's two BLOCKING findings, and why they mattered
1. **The suggestion list shipped hardcoded light** (`bg-white`/`text-gray-900`). Contrast was *fine* (17.74:1) — the defect was the opposite of the expected one: dark is the **default** admin theme, so Phase D would have mounted a bright white panel into a dark form. Fixed by making `listClassName`/`optionClassName`/`activeOptionClassName` **required with no defaults**, so a host that forgets to theme the list fails `tsc` rather than shipping the bug.
2. **`includedPrimaryTypes: ["street_address"]` would have excluded flats.** Google's Place Types doc defines `subpremise` as "an apartment, unit, or suite" — a distinct primary type. Plan gate §3.2 case 2 explicitly requires a flat to work. Widened to `["street_address","premise","subpremise"]`.

### 1a.2 — ✅ LIVE verification of Phase C, run by the orchestrator against the real Google API

The plan sanctions real (billed) Places calls at gate §3.2. Cost incurred: one autocomplete session + one Place Details Essentials event.

| Check | Result |
|---|---|
| **§3.3 lazy load** | ✅ **0** `maps.googleapis.com` requests on page load, **0** on booking-dialog render, **0** on reaching the About step — the script loads only on **first focus** of the address field |
| **§3.3 debounce (cost control)** | ✅ **24 keystrokes → exactly 1 `AutocompletePlaces` RPC.** This is the control the plan's arithmetic rests on (~7,200/month debounced vs ~14,400 un-debounced against a 10,000 free allowance) |
| **§3.3 UK restriction** | ✅ every suggestion a real Luton address — `includedRegionCodes: ["gb"]` doing the work |
| **§3.2 case 1 — standard Luton terrace** | ✅ selecting "12 Dunstable Road, Luton" filled **all four** fields from a real Google response: `address="12 Dunstable Road"`, `city="Luton"`, `area="Luton"`, `postcode="LU1 1DY"` |
| **Step 4a spike (BLOCKING, D20)** | ✅ **PASSES on both halves.** `listInsideDialog: true` — the suggestion list renders inside the Base UI dialog's own DOM, so the `.pac-container` z-index / outside-click / inert failure class is gone **by construction**. And selecting a suggestion left `dialogStillOpen: true` — the click was not read as an outside-click dismissal |
| ARIA | ✅ live `role="combobox"` input with a `role="listbox"` popup of `role="option"` items; list dismissed on selection |

**Observation, not a defect:** for "12 Dunstable Road, Luton", **`area` and `city` both resolve to "Luton"**. That is *correct* per the plan's mapping — Luton is a unitary authority, so its `administrative_area_level_2` genuinely is "Luton" — but it means the Area field duplicates City for most of this business's catchment. The field stays visible and editable, so it is cosmetic. Recorded because it is exactly what gate §3.2's matrix exists to surface; the Owner may want Area left blank when it equals City.

**Residual flagged by the implementer, not yet settled:** `.contentGrid` is the dialog's scroll container, so a list opened with the address input at the very bottom of the viewport could clip until the user scrolls. Inherent to any in-flow dropdown inside a scroll box; to be settled by gate §3.4's 375/1280 checks at closeout.

**⏸ Open decision — `autoComplete` on the address input.** Phase C kept the existing `autoComplete="street-address"` (the component itself defaults to `"off"`, overridable). Keeping it preserves native browser address autofill, which matters most on the no-key fallback path; the trade-off is that the browser's own autofill dropdown can appear alongside ours. **To be settled by observation during the §3.4 live pass**, not by argument — if both dropdowns appear together, switch to `off`.

### 1a.3 — 🔴 The `.env` key IS the key that was exposed. Now confirmed, previously unknown.

While confirming the lazy load, the loader's script URL was captured and it **contained the key value**. That was an avoidable slip on the orchestrator's part — the standing instruction is never to read or print it — and it is not repeated anywhere in this record.

It does resolve an open question. `OWNER-ACTION-BACKLOG.md` recorded that a live key with prefix `AIzaSyBZ…` had been pasted into the chat transcript during the 2026-08-04 session, but that **whether the key in `.env` was that same one was "unconfirmed — no agent read the value."** It is the same key.

**This does not reopen the decision.** The Owner ruled on 2026-08-09 not to rotate, and that ruling stands (§0.4). It is recorded only because the backlog explicitly flagged the question as open, and it is now answered. The mitigating facts are unchanged: a `NEXT_PUBLIC_*` Maps key is inlined into client bundles and is public by nature — it is visible to any visitor who opens dev tools, exactly as it was visible here — so the load-bearing control is the referrer restriction, which is in place and correct.

## 2 — ▶ Position (corrected 2026-08-09 — drift checkpoint #4 finding 2)

**Phases A, B and C are committed and verified** (see §1a for commits, verification rounds and live gate evidence). **Phase D is in flight.** Phase E (closeout) not started.

⏸ **Open items:** the key-rotation decision is **ANSWERED** (§0.4 item 1 — do not rotate). Still open: the **C-18 consent classification** (§0.4 item 2), which blocks the `cookie-registry.ts` half of Step 9; plus two observations awaiting an Owner view — the `area == city` duplication on unitary-authority addresses and the `autoComplete="street-address"` vs `off` choice (§1a.2).

> **Why this section was wrong, recorded rather than quietly corrected.** Until this edit, §2 still read *"Phase A in flight. Phases B–E not started"* — written at plan start and never updated as §1a was appended above it, so the file contradicted itself by three sections. Drift checkpoint #4 caught it and rated it BLOCKING, correctly: a progress file that misreports its own plan's state is the same defect class this programme keeps finding in product code — **the record asserting something untrue about the thing beneath it.** The lesson is that appending a new section is not the same as updating the position marker, and the position marker is the part a resuming session reads first.
