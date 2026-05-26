# Deferrals — privacy

Phase 6 deferrals raised during the `/goal` recipe run at `/redesign/per-page-recipes/privacy-recipe.md`. Phase 7 `/impeccable audit admin` will read this file and globally resolve.

## Concurrent-edit toast copy

- **Source:** Step 9 harden + brief §8 error message table
- **Verbatim:** brief copy is `That request was just updated by {actor}. Refresh to see the latest.`
- **Defer to:** Phase 7
- **Why deferred:** The `updatePrivacyRequestStatus` server action is on the Files-to-NEVER-touch list. Surfacing this conflict requires a backend revision check (versioning or `updated_at` conditional update) before the UI can be wired. Out of Phase 6 scope.
- **Provisional Phase 6 answer used to continue this session:** the failure-toast path catches the existing generic action error and shows the brief's `Couldn't update the request. Try again.` persistent Sonner with Retry, which is acceptable until the revision check exists.

## Permission-revoked-mid-session persistent toast

- **Source:** Step 9 harden + brief §8 error message table
- **Verbatim:** brief copy is `Your access has changed. Refresh to continue.` (toast, persistent)
- **Defer to:** Phase 7
- **Why deferred:** Distinguishing "permission revoked" from "generic action failure" requires inspecting the server-action error shape (`Insufficient permissions.` substring match), which is brittle. Better solved by extending `PrivacyActionState` with a typed error reason once `actions.ts` becomes touchable in Phase 7. Owner accounts (the primary privacy users) rarely lose mid-session permission, so the impact in v1 is low.
- **Provisional Phase 6 answer used to continue this session:** the generic Sonner failure toast covers the failure path; the user can refresh manually if they suspect a permission change.

## Stat-tile "Sensitive notes reviewed this month" filter target

- **Source:** brief §10 Open Question 3 + brief tooltip "Click to filter"
- **Verbatim:** brief defers this in §10 Q3 ("the feed is *review*, not *triage*; if the operator needs older notes, the client detail surface is the right entry. Proposal: defer.")
- **Defer to:** Phase 7 / post-launch
- **Why deferred:** the brief itself flags this as a deferred open question. No filter behaviour defined.
- **Provisional Phase 6 answer used to continue this session:** the tile renders without click behaviour and without the "Click to filter" tooltip (which would mislead since there is no filter target). Cormorant numeral + label + sub-line only.

## (no further deferrals)
