# Deferrals — enquiries

## Server-side `phone XOR email` cross-field validation
- **Source:** Step 9 harden — brief Copy §Error messages requires "Add a phone or email; you need at least one to follow up."
- **Verbatim:** Brief: `Phone and email both empty: Add a phone or email; you need at least one to follow up.`
- **Defer to:** Phase 7 / backend cycle
- **Why deferred:** Requires `.refine()` on the `enquirySchema` in `src/app/admin/enquiries/actions.ts`. That file is in the recipe's Files-NEVER-touch list; current schema treats both fields as independently optional. Client-side hint copy ("Either phone or email helps you reply.") is present on the Phone field as a soft cue.
- **Provisional Phase 6 answer used to continue this session:** Hint copy on Phone field signals the requirement; server still accepts both-empty. Acceptable for the lead-pipeline use case (an enquiry with neither contact field is unusual but not data-corrupting).

## Mobile filter sheet uses native `<details>` instead of `AdminSheet`
- **Source:** Step 5 craft / Step 8 adapt — brief §5 Layout Strategy says "Filter bar collapses to a `Filters` Ghost button that opens an `AdminSheet`."
- **Verbatim:** Brief: `Filter bar collapses to a "Filters" Ghost button that opens an AdminSheet.`
- **Defer to:** Phase 7 audit
- **Why deferred:** `<details>` disclosure is functionally equivalent for "tap to reveal filters then submit". `AdminSheet` adds focus trap + portal which improves a11y but requires wrapping a GET form inside a `BaseDialog.Popup` — Step 7b polish loop time-boxed before that refactor.
- **Provisional Phase 6 answer used to continue this session:** Native `<details>` with `min-h-11` summary tap target meets the disclosure intent; filter submit works identically.
