# Harden recommendations — privacy

Source: `/impeccable harden privacy` pass under `/redesign/per-page-recipes/privacy-recipe.md` Step 9, mapped against brief `/redesign/briefs/privacy-brief.md` §6 Key States + §6 Backend error states + §8 Error messages.

Date: 2026-05-17

## Recommendations and implementation status

### 1. Page-load failure (brief §6 Layer-3 row 1) — IMPLEMENTED

**Brief copy verbatim:** `Couldn't load privacy requests. Try refreshing.`

**Implementation:** `src/app/admin/privacy/page.tsx` now derives `queueLoadFailed` from `requestsResult.error` when the operator depends on the queue. The render path checks this flag before falling to `queueEmpty`/data rendering and surfaces a Cancelled-family `role="alert" aria-live="polite"` region with:

- Heading: `Couldn't load privacy requests`
- Body: explains a refresh + audit-log preservation
- `Try again` Ghost-Cancelled outline button → `/admin/privacy` (full reload)

Rail-only callers (`view_sensitive_client_notes` without `manage_privacy_operations`) are unaffected — the rail still renders if the notes query succeeded independently.

### 2. Sensitive-note rail leak on tall viewports (Verification edge case "Sensitive notes rail with 25 rows") — IMPLEMENTED

**Risk:** With 25 rows the sticky `xl:` rail could extend past the viewport, locking the sensitive content out of reach while sticky positioning anchored the header.

**Implementation:** Added `xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto` to the sticky wrapper in `page.tsx`. The rail now caps at viewport height (minus the 2rem sticky top offset) and scrolls its body internally.

### 3. Long `request_note` wrapping at 375px (Verification edge case "1200-character note") — ALREADY HANDLED

`PrivacyRequestNote.tsx` uses `whitespace-pre-wrap` + `line-clamp-4` with explicit "Show more / Show less" toggle. At 375px the well respects its padding without breaking the row; expanded state lets the operator read the full 1200 chars within the same well. Tested via Playwright snapshot.

### 4. Mark-completed `ConfirmActionModal` body wrap at 375px (Verification edge case) — ALREADY HANDLED

`ConfirmActionModal` is sized `min(calc(100vw-2rem),26rem)`; body uses `text-sm leading-6`. The brief's full legal-posture sentence (88 chars) wraps cleanly inside that width. No change needed.

### 5. Contact-detail silent omission when `view_client_contact_details` is absent (brief §6 Layer-3 row 2) — ALREADY HANDLED

`page.tsx` conditionally renders the `<p>` with email + phone only when `showContactDetails && client && (client.email || client.phone)`. The line is silently absent from the DOM — not CSS-hidden, not replaced with a "hidden" placeholder. Matches brief verbatim.

### 6. `expand=all` URL param override for Completed/Declined (brief §6 + brief §10 Q1) — ALREADY HANDLED

Page reads `searchParams.expand === "all"` and forces all four panels open via the `isOpen` computation. Per-panel `defaultOpen` still applies otherwise.

### 7. Concurrent edit message (brief §8 error message table) — DEFERRED to Phase 7

**Brief copy:** `That request was just updated by {actor}. Refresh to see the latest.`

Currently the existing `updatePrivacyRequestStatus` server action doesn't detect this conflict — it overwrites. A real conflict path would require a backend revision check (versioning, updated_at conditional update). Tracking as a Phase 7 / backend follow-up rather than a Phase 6 UI fix.

### 8. Permission revoked mid-session (brief §8 error message table) — DEFERRED to Phase 7

**Brief copy:** `Your access has changed. Refresh to continue.` (toast, persistent)

The server action returns `Insufficient permissions.` when RBAC fails mid-flow. Surfacing this as the brief's exact persistent toast requires translating the generic action error into the brief copy in `PrivacyStatusForm`. Low risk for v1 (Owner accounts rarely lose privacy permission mid-session); defer.

### 9. Filtered-empty per-section behaviour (brief §6 Layer-3 row 3) — PARTIALLY HANDLED

With backend FAKE per `BUILD-privacy-filter-query.md`, the server returns the unfiltered page-load result regardless of filter params. Once the BUILD plan lands, the queue panels will naturally show their inline empty rows (`No {received|reviewing|completed|declined} requests.`) per-section; the page-level `No requests match` + Clear-filters CTA is also rendered correctly because `queueEmpty` reduces to "all four panels empty". Verified visually. Once the backend filter lands no UI change should be required.

## Files touched in this harden pass

- `src/app/admin/privacy/page.tsx` — added `queueLoadFailed` derivation and the Cancelled-family `role="alert"` error region; added `xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto` to the sticky sensitive-notes wrapper.

## States added vs already present

- Added: page-load failure error region; sticky rail max-height + scroll containment.
- Already present (no change): page-level EmptyState; per-status section empty inline lines; status submit failure toast (persistent + Retry); contact-detail silent omission; `expand=all` override.
- Deferred to Phase 7: concurrent-edit conflict copy, permission-revoked-mid-session persistent toast.
