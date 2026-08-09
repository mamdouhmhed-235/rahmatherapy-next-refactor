# Verification — ded190b (C-20 Step 9 registry entry) + 72670e1 (recurring-series email gate)

Read-only verifier pass. Working tree confirmed clean for every file either commit touches (`git status --porcelain -- <path>` empty in each case); the only tree-wide dirt is the pre-existing `src/lib/maintenance.ts` modification and unrelated C-14/C-21 evidence artifacts, none of which overlap these commits' files. Verified against commit blobs (`git show <sha>:<path>`) and current HEAD (identical for every touched file, confirmed via `git log --oneline -3 -- <path>`).

## Result

- **Commit A (ded190b) — PASS.** All checked claims are truthful and complete; no over- or under-disclosure found.
- **Commit B (72670e1) — PASS.** Gate mirrors the single-booking path with one disclosed, non-blocking behavioural difference (see below); tests genuinely prove both directions and cannot send a real email.

---

## Commit A — Maps cookie-registry entry (`ded190b`)

### Blocking findings
None.

### Checked and confirmed

1. **Description accuracy vs implementation.**
   - `src/components/address/AddressAutocompleteField.tsx:341-346` — `handleFocus()` is the only call site that fires on user interaction; it calls `loadMapsApi()`, which is a module-level singleton (`mapsApiPromise`, line 166-169) — a second call anywhere (there is one defensive fallback in `runFetch()`, line 308) returns the same cached promise rather than injecting a second `<script>`. Because the DOM never fires `onChange` before `onFocus` for a given input, real-world script injection always originates from `handleFocus()`. Verified true as written.
   - `render()` block, line 429-444: `<input onFocus={handleFocus} ... />` — confirms "the moment you tap or click into the address field."
   - `AboutYouStep.tsx:581` — `<AddressAutocompleteField` — anchor is exact, confirms the customer booking form call site.
   - Confirmed via `grep -rln "AddressAutocompleteField" src` that the component is also used by `src/app/admin/bookings/new/ManualBookingForm.tsx` (staff-only, authenticated `/admin` tree). The entry's "It never loads anywhere else on the site" claim holds for the visitor-facing scope this registry covers: the brief (`redesign/briefs/C-20-address-autocomplete-brief.md` §2.5) states explicitly "The admin form is staff-side — no consent surface applies," matching this registry's own file-level framing (top-of-file comment: 7 mechanisms are "staff-only inside the authenticated /admin tree... out of PECR's visitor-consent scope, and outside this registry"). Not a defect — considered and cleared.
   - No cookie/localStorage/sessionStorage reference anywhere in `AddressAutocompleteField.tsx` (`grep -n "cookie\|localStorage\|sessionStorage"` — zero matches). Confirms "Our own code doesn't set or read any cookie or browser storage for this feature."
   - Degrade path: `loadMapsApi()` resolves `null` (never rejects) when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is absent (line 174-178); `runFetch()` returns early with `if (!lib) return;` (line 311) leaving the field a plain, functional text input. Confirms "the address field just stays a normal text box and your booking isn't affected."

2. **"Essential" bucket's own rule satisfied.** `cookie-registry.ts:83-90` (JSDoc on `description`): "*For purpose:"essential" entries this MUST state the specific visitor-requested function the item enables*." The Maps entry's description (`cookie-registry.ts:275-276`) names it explicitly: "loads Google's address-lookup service so we can suggest matching UK addresses as you type and fill in your house/street, town, area and postcode... while making a booking." `registry-completeness.test.ts`'s existing test "every essential entry's description names the specific function it enables" passes with this entry included (confirmed by the scoped vitest run below).

3. **No invented cookie name.** `name: "Google Maps Platform (Google does not publish a cookie name for this API)"`; `duration: "Not published by Google for this API, and not independently verified by us — set, and controlled, entirely by Google, not by this site"`. Honest uncertainty, not evasive — it states what's known (Google's documented position that this API combination doesn't rely on cookie exchange) and what isn't (no published specific name), rather than omitting the topic.

4. **`CONSENT_BANNER_VERSION` bump.** Confirmed `"2026-07-16.1"` → `"2026-08-09.1"` (`cookie-registry.ts:34`), format matches the existing `YYYY-MM-DD.n` convention. `KNOWN_BANNER_VERSIONS` changed from `[CONSENT_BANNER_VERSION]` (pre-commit, would have collapsed to `["2026-08-09.1"]` only post-bump, silently dropping `"2026-07-16.1"`) to `["2026-07-16.1", CONSENT_BANNER_VERSION]` (`cookie-registry.ts:43`) — the implementer's claim about the pre-bump array's shape is verified true from the diff (`- export const KNOWN_BANNER_VERSIONS: readonly string[] = [CONSENT_BANNER_VERSION];`), and the fix is correct per the file's own documented policy at lines 36-42 ("A version is added here, never removed, in the SAME change that bumps CONSENT_BANNER_VERSION"). `src/app/api/consent-events/route.ts:84` is the sole consumer (`KNOWN_BANNER_VERSIONS.includes(...)`), confirming the array is load-bearing for accepting late in-flight beacons, not decorative.

5. **Rendering.** `src/app/(public)/cookies/page.tsx` imports `CONSENT_BANNER_VERSION`/`formatBannerVersionDate` from the registry and renders `<CookieRegistryGroups />`, which calls `groupRegistryByPurpose()` — single source of truth, no separate hand-maintained copy. `GATED_PURPOSES` in `src/components/consent/ConsentPreferencesPanel.tsx:56-58` is derived from `groupRegistryByPurpose().map(g => g.purpose).filter(p => p !== "essential")` — since the Maps entry is filed `purpose: "essential"`, it does **not** add or remove any gated ("Functional"/"Analytics") toggle. Confirmed no consent-toggle side effect.

6. **No key exposure.** `grep -n "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY\|AIza\|apiKey\|api_key"` against the full commit diff returns zero matches. The diff touches no file that reads `process.env`. Key itself was not printed by this verifier at any point.

7. **Scope.** `git show ded190b --stat` — exactly 3 files: `src/components/consent/consent-store.ts` (+1/-1, comment-only — changed "full six-entry array of prose descriptions" to "full array of prose descriptions", no code line touched), `src/lib/consent/__tests__/registry-completeness.test.ts` (test updates matching the new entry + version), `src/lib/consent/cookie-registry.ts` (the entry, header comment, and version bump). All three are consent-related; no drive-by changes.

8. **Does commit A complete C-20 Step 9?** Plan text (`redesign/plans/C-phase/C-20-address-autocomplete-plan.md:175-176`): "`.env.example` entry with a comment... if C-18 has landed, add the Maps entry to `cookie-registry.ts` + bump `CONSENT_BANNER_VERSION`, and record the brief §2.5 classification decision... with the user." All three sub-parts are done: `.env.example:25-34` already carried the commented entry (landed earlier, in the Phase D commit per the progress file §1b) and is unchanged/still present; `cookie-registry.ts` now has the entry + bump (this commit); the Owner's classification decision is recorded both in the commit message and in the entry's own source comment (`cookie-registry.ts:169-183`, "Owner decision, 2026-08-09: classified functional-on-interaction..."). **Nothing in Step 9's plan text is unimplemented.**
   - Non-blocking observation: `redesign/per-page-progress/C-20-address-autocomplete-progress.md` (last touched at `4611ee7`, before this commit) still carries the pre-fix "⏸ C-20 is NOT marked ✅... Step 9's second half... has not been done" language and has not been updated to reflect that this commit closed it. That is a progress-file bookkeeping gap, not a defect in the commit itself — flagging for the orchestrator's closeout pass, not counted against this commit.

---

## Commit B — recurring-series confirmation-email gate (`72670e1`)

### Blocking findings
None.

### Checked and confirmed

1. **`recurringSchema` carries the field; the send is genuinely gated.** `src/app/admin/bookings/recurring-actions.ts:66` — `send_confirmation_email: z.boolean()` added to `recurringSchema`. Parsed at line 124: `send_confirmation_email: formData.get("send_confirmation_email") === "on"`. Gate at line 128: `if (parsed.data.send_confirmation_email) { await sendRecurringSeriesCreatedEmail(...).catch(...) }` — previously this call was unconditional (confirmed from the diff's removed lines).

2. **Mirrors the single-booking path, with one disclosed difference.** `src/app/admin/bookings/actions.ts:1689` — `if (parsed.data.sendConfirmationEmail && parsed.data.details.email.trim())`. Same wire field name (`"on"`/`""`), same truthiness posture. Difference: the single-booking gate double-checks a posted email string (`details.email.trim()`) as a second gate before calling the sender; `recurringSchema` carries no client-email field at all (recurring series reference an existing client by `client_id: z.string().uuid()` — schema line 27 — never a posted email), so there is no equivalent string to re-check at the call site. The implementer's claim that `sendRecurringSeriesCreatedEmail`'s own internal guard plays that role is verified: `src/lib/email/notifications.ts:834-837` —
     ```
     const customerEmail = template.clients?.email;
     if (!customerEmail) {
       throw new Error("Recurring series client has no email address.");
     }
     ```
     This throw is caught by the existing `.catch((error) => console.error(...))` wrapper (recurring-actions.ts:129-131), same as any other send failure — it does not roll back the series or the redirect. One real behavioural difference worth noting: the single-booking path with no email skips the send silently (no log line), while the recurring path with the checkbox ticked but no client email produces one `console.error` line before continuing normally. Non-blocking — no user-visible or booking-affecting difference, and matches the "own guard plays that role" framing from the commit message exactly.

3. **Form genuinely submits the field on the recurring path.** `src/app/admin/bookings/new/ManualBookingForm.tsx`: one `<form action={formAction} ...>` at line 2423, where `formAction = isRecurring ? recurringAction : manualAction` (line 567) — single physical form, action swapped by state. Hidden input shared by both paths at line 1250: `<input type="hidden" name="send_confirmation_email" value={emailProvided && sendConfirmationEmail ? "on" : ""} />`. The visible checkbox (lines 2279-2289) sits in the same step-4 `AdminPanel` block that `RecurringSection` is rendered immediately after (line 2295) — not conditionally rendered per-path. `emailProvided` derives from the `email` state, seeded from `prefillClient?.email ?? enquiry?.email ?? ""` (line 597) — for a recurring series (which always targets an existing `client_id`), this reflects the selected client's known email. Confirmed by reading, not by trusting the commit message.

4. **New tests prove both directions and the absent-field case; mailer fully mocked.** `src/app/admin/bookings/__tests__/createRecurringSeries.test.ts:41-43` — `vi.mock("@/lib/email/notifications", () => ({ sendRecurringSeriesCreatedEmail: vi.fn() }))`, module replaced wholesale; no test path can reach the real send/render/network pipeline. New `describe("createRecurringSeries — confirmation email checkbox")` block (lines 491-530): "sends the email when the checkbox is ticked" (asserts `toHaveBeenCalledTimes(1)` with the right template id), "does not attempt the send when the checkbox is unticked" (asserts `not.toHaveBeenCalled()`, and that the series redirect still fires — email gating doesn't block series creation), "does not attempt the send when the form never posts the field at all" (deletes the key from `FormData` entirely, asserts `not.toHaveBeenCalled()` — covers a hand-crafted/malicious post, matching `actions.ts`'s "missing field reads as false" posture). All three ran and passed (see gate output below).

5. **`recurringFormData()` default change did not mask a regression.** The helper now sets `formData.set("send_confirmation_email", "on")` unconditionally by default (test file line 156), matching `ManualBookingForm.tsx`'s own default (`useState(true)` at line 691). Every pre-existing happy-path test that asserts the email **was** sent (e.g. "sends the recurring series created email with the new template id", line 471-478; "does not let a failed confirmation email roll back the redirect..." line 480-488) continues to exercise that path unmodified, because the new default preserves the old always-on behaviour for every spec that doesn't explicitly override it. Confirmed by running the full file: all 26 tests (23 pre-existing + 3 new) pass with no changed assertions elsewhere in the file.

---

## Gates

### `npx tsc --noEmit`
```
(no output — exit 0)
```
Zero errors, full repo. Nothing to attribute to either commit or to the concurrent C-14 Phase C work — the tree is clean of TypeScript errors project-wide at this snapshot.

### Scoped vitest — consent + cookies + address + admin/bookings
```
npx vitest run src/lib/consent src/components/consent "src/app/(public)/cookies" src/app/admin/bookings/__tests__ src/components/address

 Test Files  31 passed (31)
      Tests  420 passed (420)
```
Includes `registry-completeness.test.ts` (all Maps-entry and banner-version assertions passing) and `createRecurringSeries.test.ts` individually re-run for full visibility:
```
npx vitest run src/app/admin/bookings/__tests__/createRecurringSeries.test.ts --reporter=verbose

 Test Files  1 passed (1)
      Tests  26 passed (26)
```
(One expected `console.error` stderr line from the deliberate "failed confirmation email" test case — `Unable to send recurring series created email. Error: Resend is down` — this is the pre-existing test intentionally exercising the `.catch()` path, not a failure.)

### `pnpm lint`
```
✖ 66 problems (59 errors, 7 warnings)
```
Matches the expected baseline exactly: **59 errors / 7 warnings**, confirmed to be exactly `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}` (verified by extracting the unique file paths from lint output). No file touched by either commit under review appears anywhere in the lint output — the baseline is unpolluted by both these commits and by the concurrent C-14 Phase C work.

---

## Concurrency note
`git status --porcelain` confirms no modifications to any file either commit touches, or to any file this verification read (`src/lib/consent/*`, `src/components/consent/*`, `src/app/(public)/cookies/*`, `src/components/address/*`, `src/features/booking/components/AboutYouStep.tsx`, `src/app/admin/bookings/{actions.ts,recurring-actions.ts,new/ManualBookingForm.tsx}`, `src/lib/email/notifications.ts`). The only tree-wide dirt is the pre-existing, expected `src/lib/maintenance.ts` change and unrelated evidence/screenshot artifacts under `redesign/evidence/C-14` and `redesign/evidence/C-21`, plus deleted `design_handoff_public_pages/*` and untracked `design_handoff_area_pages/*`/`photos-rahma-therapy/*` — none overlapping either commit's files. No gate result here can be attributed to the concurrent C-14 Phase C work.
