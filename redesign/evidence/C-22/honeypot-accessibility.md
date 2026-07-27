# C-22 — Honeypot invisibility / accessibility / autofill evidence

**Plan §3 gate item 4, plus the invisibility half of gate item 3.**

- **Date:** 2026-07-27
- **HEAD:** `a63de0b` (`feat(redesign): C-22 Phase B — rate limiting`)
- **Harness:** Playwright MCP (Part 0 canonical), Chromium, dev server `http://localhost:3000`
- **Component under test:** `src/features/booking/components/ConfirmStep.tsx` (final step, step 4 of 4)
- **Route used:** `http://localhost:3000/home/?booking=1&services=hijama-package`
- **Fixture data only:** `Audit Test C22` / `audit.c22@fixture.example.test` / `07700900123` / `1 Fixture Street`, Luton. No real customer data. Booking `9d55ce2a` untouched.

> **⛔ NO SUBMISSION OCCURRED.** The booking form was never submitted. Verified from the browser's own network log: **zero** requests matching `bookings` across the whole session; the only API traffic was `POST /api/availability` and `POST /api/availability/month` (read-only calendar queries made by the dialog itself). No booking row was created, no email was sent.

---

## Results

| # | Check | Verdict | Measured value (actual, from the live rendered page) |
|---|---|---|---|
| 1 | **Not visible at 1280 and 375** | ✅ PASS | **1280×900:** `getBoundingClientRect()` = `{x: -9999, left: -9999, right: -9825.857, top: 98.429, width: 173.143, height: 20.857}` → fully off-screen left. `document.elementFromPoint(centre)` = `null`. **375×812** (dialog scroller at the very bottom, `scrollTop 887 / scrollHeight 1528`, `atBottom: true` — i.e. the honeypot's own DOM position): rect identical, `intersectsViewport: false`, `elementFromPoint` = `null`. Its `<label>` ("Leave this field empty") is likewise off-screen at `x: -9999, right: -9949.67`. Screenshots: `honeypot-confirm-1280.png`, `honeypot-confirm-375.png` — no decoy artifact, no stray label in either. |
| 1b | **No horizontal-scroll side effect** | ✅ PASS | **1280:** `documentElement.scrollWidth` 1280 = `clientWidth` 1280 = `innerWidth` 1280; `body.scrollWidth` 1280. **375:** `scrollWidth` 375 = `clientWidth` 375 = `innerWidth` 375; dialog scroller `scrollWidth` 365 = `clientWidth` 365. The `-9999px` offset creates **no** overflow at either width (the `w-0 h-0 overflow-hidden` wrapper contains it). |
| 2 | **Not keyboard reachable** | ✅ PASS | **Real key presses:** 40 × `Tab` = 2.2 complete cycles of the dialog's 18-stop focus trap → `honeypotEverFocused: false`. 22 × `Shift+Tab` (reverse) → `honeypotEverFocused: false`. Tab order runs `…manageAcknowledged → Back → Show booking summary → Submit booking request → (trap sentinel) → Close booking form…`, stepping straight over the honeypot, which sits between `manageAcknowledged` and the action bar in DOM order. **Static enumeration:** 17 tabbable elements in the dialog; honeypot **present** in the candidate set but **absent** from the tabbable set (`honeypotInTabbableSet: false`), excluded solely by `tabIndex: -1` (it is not disabled, not `display:none`, not `visibility:hidden`). |
| 3 | **Not exposed to assistive tech** | ✅ PASS | **Authoritative source — Chrome's own accessibility tree via CDP `Accessibility.getFullAXTree`:** 380 nodes (152 ignored); `company_website` appears **nowhere**; `"leave this field empty"` appears **nowhere**; `exposedTextboxCount: 0`. **Playwright `ariaSnapshot()` of the dialog** (70 lines): no `company_website`, no "Leave this field empty", zero textbox lines. **Rendered DOM:** wrapper `aria-hidden="true"` ✔ and input `tabindex="-1"` ✔ — both confirmed present as real attributes (not just JSX). |
| 4 | **Off-screen positioning, NOT `display:none`** | ✅ PASS | **Wrapper computed style:** `display: block` (**not `none`** ✔), `visibility: visible`, `position: absolute`, `left: -9999px`, `top: 0px`, `width: 0px`, `height: 0px`, `overflow: hidden`. **Input computed style:** `display: inline-block` (**not `none`** ✔), `visibility: visible`, `position: static`, `width: 173.143px`, `height: 20.857px`, `overflow: clip`, `opacity: 1`, `clip-path: none`. The Tailwind v4 utilities (`absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden`) **do compile** in this build — verified by computed style, not by reading the class string. This is the off-screen technique the brief requires, not a `display:none` hide. |
| 5 | **`autoComplete="off"` + autofill does not populate** | ✅ PASS (with a stated limit) | **Rendered DOM:** `autocomplete` attribute = `"off"`, IDL property `.autocomplete` = `"off"`. **Autofill exercised for real:** a saved address profile was installed via CDP `Autofill.setAddresses`, then `Autofill.trigger` (address) was aimed **directly at the honeypot** → honeypot stayed `""`. **Positive control (proves the mechanism is live, not a dead harness):** the identical trigger on `input[name="address"]` **did** fill it with `"9 Autofill Road"`. **Realistic journey:** that browser-autofilled address was carried through steps 2 → 3 → 4 (it appears in the Confirm recap); at Confirm the honeypot value was `""` and it does **not** match `:-internal-autofill-selected`. See caveat 5.1 below. |
| 6 | **Registered `name` is `company_website`** | ✅ PASS | `getAttribute("name")` = `"company_website"`; IDL `.name` = `"company_website"`. Full attribute list in the real DOM: `id="company_website"`, `tabindex="-1"`, `autocomplete="off"`, `type="text"`, `name="company_website"` — 5 attributes, none lost. **The spread-order concern is resolved empirically:** React props on the element are, in order, `type, id, tabIndex, autoComplete, name, onChange, onBlur, ref`. `{...register("company_website")}` contributed only `name`/`onChange`/`onBlur`/`ref` — it carries **no** `tabIndex` or `autoComplete` key, so nothing was overridden despite the spread coming last in the JSX. |

**Overall verdict: PASS.** All six checks pass on measured evidence from the live rendered page. The honeypot is invisible at both breakpoints, unreachable by keyboard in both directions, entirely absent from the browser's accessibility tree, hidden by off-screen positioning rather than `display:none`, and not populated by Chrome's address autofill. The brief §2.1 NON-NEGOTIABLE requirement — that the decoy never becomes a trap for a screen-reader user — is satisfied.

---

## Read-only observation: the decoy is registered, not orphaned

Its value would be included in the React Hook Form values. Established three ways, **without submitting**:

1. **React props on the element** carry RHF's `register` return: `name: "company_website"`, `onChange: function`, `onBlur: function`, `ref: present`. An orphaned input would have none of these.
2. **Same form, no override:** the honeypot's `closest("form")` is the dialog's `formRows` form — the *same* element as the real `consentAcknowledged` field's form (`realFieldSharesSameForm: true`), and it has no `form=` attribute redirecting it elsewhere.
3. **State round-trip through RHF (the decisive one):** set the honeypot to `"c22-probe-value"` (native setter + `input` event) → navigated to the About step, where `ConfirmStep` unmounts and the input **leaves the DOM** (`honeypotStillInDom: false`) → returned to Confirm → the freshly mounted input came back holding `"c22-probe-value"`. The value survived DOM removal, so it lives in RHF's `_formValues`, not the DOM. That is exactly what `handleConfirmSubmit` reads via `form.getValues()` and hoists at `BookingExperience.tsx:490` (`company_website: values.company_website`).

The probe value was cleared afterwards (`""`); the field was left empty.

---

## Could not verify / caveats

- **5.1 — Native autofill *dropdown acceptance* was not exercised.** Accepting Chrome's own suggestion popup requires `ArrowDown` + `Enter`, and on the Confirm step `Enter` inside this `<form>` triggers the `type="submit"` button — a live booking submission. That is prohibited, so I did not do it. I substituted CDP `Autofill.trigger`, which invokes Chrome's real address-autofill path programmatically, and I proved it is genuinely functional with the positive control (a real field *was* filled). This is strong evidence but is not byte-identical to a human picking a suggestion from the popup.
- **5.2 — Chrome's "fill the whole section" behaviour could not be triggered from the Confirm step,** because the Confirm step contains **no autofillable visible text input** to anchor such a session: its only fields are 3 checkboxes, 2 optional textareas inside collapsed disclosures, and the honeypot itself (which is unfocusable, so a user can never start an autofill session from it). Related structural fact, measured: the honeypot **is not in the DOM at all** during steps 1–3, where every contact/address field lives — so an autofill session on the About step cannot reach it. I report this as a reasoned structural observation plus one measurement, not as a full behavioural test.
- **No real screen-reader software was run.** No NVDA/VoiceOver pass. I used Chrome's own accessibility tree via CDP (`Accessibility.getFullAXTree`) — the authoritative structure a screen reader consumes — plus Playwright's ARIA snapshot. This is the mechanised equivalent, not a human AT session.
- **Server-side behaviour was NOT tested** — out of scope here and impossible without submitting. Gate item 3 (honeypot filled → no row, no email, success-shaped 200, warning logged) remains **unverified by this run**.
- **Gate item 4's screen-reader wording** ("a screen-reader pass … never announces it") is satisfied by the accessibility-tree evidence above; treat it as tool-verified rather than AT-user-verified.

---

## Files produced

| File | Content |
|---|---|
| `redesign/evidence/C-22/honeypot-confirm-1280.png` | Confirm step at 1280×900 — no decoy visible |
| `redesign/evidence/C-22/honeypot-confirm-375.png` | Confirm step at 375×812, scrolled to the honeypot's DOM position — no decoy visible |
| `redesign/evidence/C-22/honeypot-accessibility.md` | This file |

No source files were modified. `src/lib/maintenance.ts` shows the pre-existing Owner-authorised local-only `MAINTENANCE_MODE = false` flip and was **not** touched by this run. HEAD unchanged at `a63de0b`; nothing staged or committed.
