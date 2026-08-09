# C-20 Phase B — FULL independent verification

**VERDICT: FAIL — 2 BLOCKING findings (dark-mode theming architecture; `includedPrimaryTypes` over-filter). All mechanical/cost/test-identity gates PASS.**

Verified at `master` HEAD `e847a74c8d0c5b379f88dd1804b6c3ac1aa97567`. Commits under review: `cc3265736cc2d8c91f4acd4b977655a8ff61c079` (Phase A hardening) and `ac0a283b50d5fb0f9ac0feb1bd82097e59d34cdd` (Phase B component), both confirmed via `git show --stat` — diff scope exactly as described, no leakage.

Model I ran as: Claude Sonnet 4.5 (`claude-sonnet-5`, "Sonnet 5" build), independent-verifier role, FULL tier.

---

## LED POINT 1 — Dark mode (BLOCKING, but mechanism refuted and replaced with the correct one)

**Bootstrap facts confirmed by reading source:**
- Admin theme is scoped via `data-theme` on a wrapper `<div data-admin-theme-root data-theme={effectiveTheme}>` (`src/app/admin/components/ThemeProvider.tsx:105`), never on `<html>`/`<body>`.
- Dark is the default for any staff row with no saved preference: `getServerColorSchemeSnapshot()` returns `true` and the file comment states "A NULL preference stays dark" (`ThemeProvider.tsx:18-22, 82-83`).
- `[data-theme="dark"]` in `src/styles/tokens.css:331-447` redefines ONLY the `--admin-*` family — by explicit design (`tokens.css:266-282`) — and does **not** touch Tailwind's built-in `white`/`gray-*` palette anywhere in the repo (confirmed: no `tailwind.config.*` file exists, and no `--color-white`/`--color-gray-*` override appears in `tokens.css`'s `@theme`/`@theme inline` blocks).
- Comparator `src/app/admin/calendar/CalendarDatePopover.tsx` (an existing admin popover/list) is 100% `var(--admin-*)`-driven (`bg-[var(--admin-panel)]`, `border-[var(--admin-border)]`, `text-[var(--admin-heading)]`, `text-[var(--admin-text-muted)]`) — the established pattern for a themed dark-aware admin surface.

**What the shipped file actually does** — `src/components/address/AddressAutocompleteField.tsx:419-448`: the `<ul role="listbox">` uses `border-gray-200 bg-white` and each `<li role="option">` uses `text-gray-900` with `bg-gray-100`/`bg-white`. These are fixed Tailwind palette utilities, not CSS custom properties — mechanically incapable of responding to `[data-theme="dark"]` regardless of where the component mounts.

**Computed numbers (OKLCH→sRGB conversion + WCAG contrast, script in scratchpad):**
| Pair | Ratio |
|---|---|
| `text-gray-900` (#111827) on `bg-white` (#ffffff) — the list's own internal text contrast | **17.74:1** |
| `text-gray-900` on `bg-gray-100` (active row, #f3f4f6) | **16.12:1** |
| `border-gray-200` (#e5e7eb) on `bg-white` | 1.24:1 (subtle by design; shadow + the surface-boundary contrast below also demarcate the box) |
| `bg-white` vs dark `--admin-panel` (oklch(22% 0.008 88) ≈ #1c1a16) | **17.37:1** |
| `bg-white` vs dark `--admin-canvas` (oklch(17% 0.008 88) ≈ #110f0b) | **19.14:1** |

**Verdict on the hypothesized mechanism: REFUTED.** The orchestrator's hypothesis (a C-15-style ~1.2:1 "invisible text" defect — light-on-light text stranded on a dark panel) does not apply here. Internal list text is highly legible (17.74:1, far above AA). The Tailwind literals do not go transparent or near-invisible under dark mode.

**Verdict on whether it's still a real defect: CONFIRMED, different mechanism.** Because the colors are fixed literals wired to neither `--admin-*` nor `--rahma-*` nor any host-supplied class, the dropdown cannot ever track either tree's theme. In the admin tree specifically — where dark is the default for every staff member who hasn't set a preference — Phase D (`ManualBookingForm.tsx`, not yet reviewed) will mount this component inside a near-black form and the suggestion list will render as a stark, fully-opaque **white rectangle** (17-19:1 surface contrast against the surrounding dark canvas — the opposite failure mode from "invisible": maximally jarring instead). This breaks the plan's own stated intent that "the same component looks native in both trees" (plan §2 Step 3) and the implementer's own file-header rationale ("shared by a `--rahma-*`-themed public form and an `--admin-*`-themed admin form... legible and unopinionated in both hosts") is incorrect on the "unopinionated in both hosts" half — it is unopinionated only in the sense of not committing to either token family, which achieves neutral-in-neither, not native-in-both. (In the **public** tree the same literals happen to look fine because `--rahma-surface` is also `#ffffff` — the defect is admin-tree-specific.)

**BLOCKING.** Recommended fix (not implemented, per instructions): extend the existing "host owns styling" contract from the input to the list — add optional `listClassName` / `optionClassName` / `activeOptionClassName` props (mirroring `inputProps`) so Phase C passes `--rahma-*`-based classes and Phase D passes `--admin-*`-based classes matching `CalendarDatePopover.tsx`'s own established pattern. Do **not** reach for shadcn's `--popover`/`--border` tokens as a shortcut — `tokens.css:266-282` explicitly documents that the admin dark block deliberately never touches those shared tokens (to protect `/booking/manage`, a public route that also consumes `--admin-*` primitives), so they would either stay fixed-white (no fix) or, if ever made theme-aware, leak dark styling onto public routes.

---

## LED POINT 2 — `includedPrimaryTypes: ["street_address"]` over-filtering (BLOCKING, with doc evidence)

Shipped at `AddressAutocompleteField.tsx:295`: `includedPrimaryTypes: ["street_address"]`.

**Doc research (WebFetch against developers.google.com, current pages, not memory):**
1. `https://developers.google.com/maps/documentation/javascript/examples/places-autocomplete-addressform` — Google's own "Address Selection" example genuinely does use `included-primary-types="street_address"` alone. The implementer's citation is accurate; this is not a fabricated justification.
2. `https://developers.google.com/maps/documentation/places/web-service/place-types` — "Table B" (types usable specifically as `includedPrimaryTypes` values for Autocomplete (New) requests) explicitly lists `street_address`, `premise`, **and** `subpremise` as three separate, distinct entries. `subpremise` is defined verbatim as *"An addressable entity below the premise level, such as an apartment, unit, or suite."* — i.e., a flat.
3. `https://developers.google.com/maps/documentation/geocoding/search-for-destinations` — Google's own recommended Autocomplete filter for comprehensive destination coverage is: `"includedPrimaryTypes": ["establishment", "point_of_interest", "premise", "street_address", "subpremise"]`, specifically because filtering on `street_address` alone is documented to under-return results for addressable entities below street level.

**Conclusion:** `street_address`, `premise`, and `subpremise` are mechanically distinct `primaryType` values a Places prediction can carry. Restricting `includedPrimaryTypes` to `["street_address"]` alone will exclude any suggestion whose primary type is `premise` or `subpremise` — precisely the category that covers flats, apartments, and named-building addresses. This is a real, google-documented risk directly against **plan gate §3.2 case 2** ("Flat/apartment: street fills..."), which this same repo's own Phase-A parser fixture (`flatWithSubpremise` in `parse-place.test.ts`) shows the team already anticipated needing to handle on the parsing side — but the autocomplete suggestion list, as configured, may never surface such an address for the parser to receive in the first place.

**BLOCKING**, with the caveat stated honestly: I cannot make a live Places API call (prohibited) to prove a *specific* flat address is dropped end-to-end; the finding is a static-analysis conclusion from Google's own current, directly-quoted documentation, not an empirical repro. The unwaivable §3.2 real-address matrix (a later, live-browser gate) is where this gets its final empirical confirmation either way.

**Recommended fix:** broaden to `includedPrimaryTypes: ["street_address", "premise", "subpremise"]` (the address-relevant subset of Google's own recommended list — omitting `establishment`/`point_of_interest`, which would reintroduce business-name results the plan's UK deviation table deliberately excludes).

---

## LED POINT 3 — Cost trap: `displayName` exclusion, mechanically guarded (PASS, proven non-vacuous)

`AddressAutocompleteField.tsx:220`: `const PLACE_DETAIL_FIELDS = ["addressComponents", "location"];` — exactly two fields, no `displayName` anywhere in the file (grepped).

Test asserts the actual argument object, not just that the mock was called (`AddressAutocompleteField.test.tsx:315-317`):
```ts
expect(suggestion.__fetchFields).toHaveBeenCalledWith({
  fields: ["addressComponents", "location"],
});
```

**Mutation test (scratchpad, never touched the real file):** copied the component+test to `scratchpad/mutant-fields/`, changed the copy's `PLACE_DETAIL_FIELDS` to include `"displayName"`, ran the **unmodified real test file** against the mutant via a scratchpad-only vitest harness (`scratchpad/vitest.mutant.config.ts`, alias-only, never edits the project's own `vitest.config.ts`).
**Result: 9 passed, 1 failed** — exactly `"parses the selected place's addressComponents ... requesting exactly the two Essentials fields"` failed, diff showing the injected `displayName`. Non-vacuous, confirmed.

---

## LED POINT 4 — UK restriction mechanism (PASS)

Shipped: `includedRegionCodes: ["gb"]` (the restriction) plus separately `region: "gb"`, `language: "en-GB"` (formatting/ranking only) — `AddressAutocompleteField.tsx:294,296-297`.

Verified directly against Google's current `AutocompleteRequest` reference (WebFetch, not memory):
- `region`: *"This does not restrict results to the specified region."* — formatting/ranking/biasing only, as documented.
- `includedRegionCodes`: *"Only include results in the specified regions, specified as up to 15 CLDR two-character region codes."* — this is the field that actually restricts.

The code uses each field for its correct, documented purpose. **PASS** — the UK-restriction gate (§3.3 "typing a US city surfaces no US suggestions") is backed by the field that actually does the restricting, not the cosmetic one.

---

## LED POINT 5 — Session-token lifecycle (PASS, proven non-vacuous)

`ensureSessionToken()` (`AddressAutocompleteField.tsx:273-278`) creates a token only if `sessionTokenRef.current` is empty, reuses it across `fetchAutocompleteSuggestions` calls, and `selectSuggestion()` nulls it out after `fetchFields()` consumes it (`:356`) so the next typing session mints fresh.

Test: `"reuses one token across a typing session and mints a fresh one after selection"` asserts `tokenCall1 === tokenCall2` across two debounced fetches, then `tokenCall3 !== tokenCall1` after a selection.

**Mutation test:** scratchpad copy (`mutant-tokens/`) changed `ensureSessionToken` to unconditionally mint a new token on every call (never reuse). Ran the real, unmodified test file against it.
**Result: 9 passed, 1 failed** — exactly the token-identity test failed (`expected FakeAutocompleteSessionToken{ id: 1 } to be FakeAutocompleteSessionToken{ id: 2 }`). Non-vacuous, confirmed.

---

## LED POINT 6 — Debounce (PASS, proven non-vacuous)

`handleChange()` clears any pending timer and reschedules on every keystroke, firing `runFetch` only after `AUTOCOMPLETE_DEBOUNCE_MS` (300ms) of quiet (`AddressAutocompleteField.tsx:321-340`).

**Mutation test:** scratchpad copy (`mutant-debounce/`) removed the `setTimeout`/debounce entirely, calling `runFetch` synchronously per keystroke. Ran the real, unmodified test file against it.
**Result: 9 passed, 1 failed** — exactly `"collapses rapid keystrokes into exactly one request"` failed: `expected "vi.fn()" to be called 1 times, but got 5 times` (one call per keystroke of "L","Lu","Lut","Luto","Luton"). Non-vacuous, confirmed.

---

## LED POINT 7 — Lazy load, fallback, unmount safety (PASS, replacement test proven non-vacuous)

- **No script on mount:** confirmed by reading the code — the only mount-time effect (`AddressAutocompleteField.tsx:250-258`) sets `mountedRef` and returns a cleanup; `loadMapsApi()` is only ever invoked from `handleFocus()` (`:314-319`) or lazily inside `runFetch()`. Backed by a real, passing test (`"requests nothing on mount, requests the script on first focus, and a second field reuses the cached load"`) — this test is part of the real suite and passed in the full `pnpm vitest run` (not a mutation run — the genuine file).
- **Module-singleton loader / cached promise:** `mapsApiPromise` module-level variable (`:155-209`), idempotent against a script already present. Verified by the same test asserting exactly one `<script>` tag after two fields both focus.
- **Key absent → `null` → plain usable input, no visible error:** `loadMapsApi()` resolves `Promise.resolve(null)` when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is unset (`:163-167`); verified by the real, passing `"no API key: fallback"` test which also spies on `console.error` and asserts it's never called.
- **Unmount safety, the implementer's self-reported "vacuous test found, rewritten" claim — independently re-verified, not trusted:** I read the replacement test (`"does not call onAddressSelected... when a place-details fetch resolves after unmount"`) and the guard it exercises: `selectSuggestion()`'s `if (!mountedRef.current) return;` right after `await place.fetchFields(...)` (`:352`).
  **Mutation test:** scratchpad copy (`mutant-unmount/`) removed exactly that guard line. Ran the real, unmodified test file against it.
  **Result: 9 passed, 1 failed** — exactly the unmount-safety test failed: `expected "vi.fn()" to not be called at all, but actually been called 1 times`, with the full parsed address parts in the call args. **The replacement test genuinely discriminates; the implementer's self-report is confirmed, not merely trusted.**

---

## LED POINT 8 — Accessibility / modal-dialog Escape handling (PASS, with one forward-looking caveat)

**ARIA combobox wiring** (`AddressAutocompleteField.tsx:400-417`): `role="combobox"`, `aria-expanded={open}`, `aria-controls={listboxId}`, `aria-autocomplete="list"`, `aria-activedescendant` set to `${listboxId}-option-${activeIndex}` **only** when `open && activeIndex >= 0` (`:409-411`) — and that exact `<li id="...">` only exists in the DOM under the same `open && suggestions.length > 0` condition that renders the whole listbox (`:418-449`). Checked both branches: whenever `aria-activedescendant` is set, the referenced id is genuinely present in the DOM. Internally consistent. Minor, non-blocking observation: `aria-controls` references `listboxId` unconditionally, including while collapsed (when the `<ul>` isn't rendered at all) — a common, generally-accepted combobox pattern (many production comboboxes omit the listbox from the DOM until expanded; `aria-expanded="false"` already communicates the state), not a defect.

**Escape, both branches, read directly** (`AddressAutocompleteField.tsx:367-380`):
- List open: `preventDefault()` + `stopPropagation()` + `closeList()` — swallowed.
- List closed: function returns without touching propagation — falls through to any ancestor handler normally.

Test `"AddressAutocompleteField — Escape"` exercises exactly this: first Escape (list open) closes the list and the wrapping `<div onKeyDown>` handler is NOT called; second Escape (list now closed) DOES reach the wrapping handler. This test is part of the real, passing suite.

**Cross-boundary check (not merely assumed) — how Base UI's Dialog actually implements Escape-to-dismiss:** read `node_modules/@base-ui/react/floating-ui-react/hooks/useDismiss.js` directly. Its Escape handling (`closeOnEscapeKeyDown`, lines ~84-95) is exposed as `onKeyDown: closeOnEscapeKeyDown` returned from `getFloatingProps()`/`getReferenceProps()` (lines 408, 451) — i.e. it is wired as a **React synthetic `onKeyDown` prop** on the Dialog's own floating element, not a native `document`-level capture listener. This matters: it confirms `e.stopPropagation()` called on our nested synthetic event will correctly prevent the event from reaching the dialog's own Escape handler through React's synthetic bubble phase, exactly as the implementer's comment claims. Had Base UI instead used a capture-phase native `document.addEventListener`, `stopPropagation()` on our synthetic event would **not** have been sufficient (capture fires top-down, before bubble-phase handlers run) — that risk is now ruled out for this specific library.

**Caveat, stated as required:** Phase C (`AboutYouStep.tsx` inside `BookingDialog.tsx`'s Base UI modal) has not landed — there is no caller yet, so no live/browser confirmation of the actual nested DOM order is possible from Phase B alone. The static analysis of both sides (this component's logic, and Base UI's actual Escape-wiring mechanism) is as far as this phase can be taken; Phase C's own verification should re-confirm in the browser.

**Mobile-first (375px):** the list has no caller yet, so no browser check is possible — stated per instructions, not fabricated. Structurally, `absolute left-0 right-0` ties the list's width to the host input's width with no independent fixed/min-width, so it inherits whatever width constraint the host imposes at 375px; nothing in the component itself would force an overflow.

---

## Mutation-testing table

| # | Mutant | File (scratchpad copy) | Real test that should catch it | Caught? |
|---|---|---|---|---|
| 1 | Phase A: city fallback order swapped (`locality \|\| postal_town`) | `mutant-parser/parse-place.ts` | "prefers postal_town over locality when both are present and differ (Leagrave/Luton)" | **YES** (independently re-run by me, not trusting the implementer's self-report) |
| 2 | Phase A: postcode `pick("postal_code", true)` → `pick("postal_code")` | `mutant-parser2/parse-place.ts` | "takes the short postcode text, not the long text, when they differ" | **YES** (independently re-run) |
| 3 | Add `"displayName"` to `PLACE_DETAIL_FIELDS` | `mutant-fields/AddressAutocompleteField.tsx` | "...requesting exactly the two Essentials fields" | **YES** |
| 4 | `ensureSessionToken` always mints new (never reuses) | `mutant-tokens/AddressAutocompleteField.tsx` | "reuses one token across a typing session..." | **YES** |
| 5 | Debounce removed — `runFetch` called synchronously per keystroke | `mutant-debounce/AddressAutocompleteField.tsx` | "collapses rapid keystrokes into exactly one request..." | **YES** |
| 6 | Post-unmount guard removed in `selectSuggestion` | `mutant-unmount/AddressAutocompleteField.tsx` | "does not call onAddressSelected... after unmount" | **YES** |

All 6 mutants produced **exactly one** failing test each (never zero, never a cascade of unrelated failures) — clean, isolated mutation kills. Harness: `scratchpad/vitest.mutant.config.ts` (alias-only shim so `@/` and bare package imports resolve against the real project's `node_modules` from outside the repo tree; never touches the project's own `vitest.config.ts`). No file inside the repo was ever mutated in place.

---

## Gates by identity

| Gate | Command | Result | Identity match |
|---|---|---|---|
| Types | `npx tsc --noEmit` | **0 errors** | exit 0, no output |
| Tests | `pnpm vitest run` | **5 failed / 2026 passed / 2031 total**, 2 files failed | Failures are **exactly**: `src/lib/auth/admin-access.test.ts` × 2 ("gives Owner broad access...", "gives Admin broad operational access...") + `src/app/admin/bookings/new/ManualBookingForm.test.tsx` × 3 ("renders step 1 on first load", "moves focus to the first invalid field...", "shows the consent error..."). Matches the dispatch's forecast baseline identity exactly; total matches the forecast "~2026/2031" exactly, not approximately. |
| Lint | `pnpm lint` | **59 errors / 7 warnings** | All 59 errors + 7 warnings fall in exactly the six baseline files: `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`. Neither `src/components/address/*` nor `src/lib/address/parse-place.test.ts` appears anywhere in lint output. |
| Build | `pnpm build` | **NOT RUN** | Deliberately skipped per instructions (banned for this dispatch). |

---

## Findings

1. **BLOCKING** — `src/components/address/AddressAutocompleteField.tsx:419-448`. Suggestion-list styling uses fixed Tailwind neutral-palette literals (`bg-white`, `border-gray-200`, `text-gray-900`, `bg-gray-100`) with no `--admin-*`/`--rahma-*`/host-supplied class. In the admin tree, where dark is the default theme, Phase D will render this as a fully-opaque bright-white box (17-19:1 surface contrast) against a near-black canvas — breaks the plan's "looks native in both trees" requirement. Not an invisibility/contrast failure (internal text contrast is 17.74:1, well above AA); it is a theming-architecture defect. See LED POINT 1 above for the full numbers and recommended fix (host-supplied `listClassName`/`optionClassName` props).

2. **BLOCKING** — `src/components/address/AddressAutocompleteField.tsx:295`. `includedPrimaryTypes: ["street_address"]` mechanically excludes predictions whose primary type is `premise` or `subpremise` (Google's own documented type for "an addressable entity below the premise level, such as an apartment, unit, or suite") from ever appearing in the suggestion list. Directly threatens plan gate §3.2 case 2 (flat/apartment). See LED POINT 2 above for the three independent doc citations and recommended fix (`["street_address", "premise", "subpremise"]`).

No other BLOCKING findings. All cost-critical mechanisms (session tokens, debounce, field-list restriction, region restriction, lazy-load, unmount safety) are correctly implemented and independently proven non-vacuous by mutation testing, not merely present.

---

## Checks I could not run

- **Live Places API calls** — prohibited by dispatch (billed). LED POINT 2's conclusion is doc-evidence-based static analysis, not an empirical repro against a real flat address; final confirmation is the (later, unwaivable) §3.2 real-address matrix.
- **Browser/visual confirmation of the dark-mode clash** — Phase D (`ManualBookingForm.tsx` wiring) has not landed; there is no live mount of this component in the admin tree yet to screenshot. LED POINT 1's numbers are derived from static token/OKLCH-to-sRGB computation, not a rendered screenshot.
- **Browser/visual confirmation of the Base UI modal Escape interaction** — Phase C (`AboutYouStep.tsx` wiring inside `BookingDialog.tsx`) has not landed; no caller exists yet. LED POINT 8's cross-boundary conclusion is based on reading both sides' source (this component + `@base-ui/react`'s `useDismiss` implementation), not a live nested-DOM test.
- **375px/1280px screenshots** — no caller yet, so nothing renders to screenshot; per plan §3.4 this is expected to wait for Phase C/D.
- **`pnpm build`** — deliberately not run per explicit instruction; recorded here rather than silently skipped.

---

## Isolation

`git status --porcelain -- src/features/booking src/components/address src/lib/address src/app/admin/bookings/new .env.example` → **empty**. Full `git status --porcelain` otherwise shows only pre-existing dirt (`.playwright-mcp/` deletions, `design_handoff_public_pages/` deletions, untracked `design_handoff_area_pages/`, `photos-rahma-therapy/`, `redesign/evidence/C-21/*.png`, `test-results/` dated Aug 3-4, well before this session) plus the deliberate standing `M src/lib/maintenance.ts`, which was left untouched, unstaged, and unreverted as instructed. No package.json or lockfile change in either commit (confirmed via `git show --stat`). No key literal found in either commit's diff.
