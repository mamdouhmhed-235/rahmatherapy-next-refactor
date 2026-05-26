# Deferrals — account-password-requests

## Sonner toast on Approve / Reject success

- **Source:** brief §6 Key States ("Toast Confirmed family: 'Approval email sent to {email}.'") + brief ## Copy / Toasts
- **Verbatim:** "Modal closes. Sonner toast Confirmed family: 'Approval email sent to {email}.' 4s auto-dismiss."
- **Defer to:** Phase 7
- **Why deferred:** Toast meaningfully fires when an email actually went out; FAKE handler does not yet send one. Landing the toast alongside the real `BUILD-approve-reject-password-reset.md` server-action wiring keeps the UX claim honest (an "email sent" toast that fires when no email left the system would be misleading copy during the FAKE window).
- **Provisional Phase 6 answer used to continue this session:** Modal closes via `useEffect(result.ok)`; page revalidates. No toast.

## FAKE permission bridge via `MANAGE_AUDIT_LOGS`

- **Source:** page.tsx permission gate (account-password-requests/page.tsx)
- **Verbatim:** the canonical gate is `MANAGE_ACCOUNT_PASSWORD_REQUESTS`; BUILD-rbac-permission-account-password-requests.md hasn't seeded that permission onto Owner / Admin role templates yet, so the gate also accepts `MANAGE_AUDIT_LOGS` (Owner-only) as a bridge.
- **Defer to:** Phase 7 (or coincident with `BUILD-rbac-permission-account-password-requests.md` landing)
- **Why deferred:** Without the bridge, even Owner cannot reach the FAKE page during Phase 6 verification. The bridge is comment-flagged in source with the exact removal instruction.
- **Provisional Phase 6 answer used to continue this session:** OR'd `MANAGE_AUDIT_LOGS` into the gate. When the BUILD plan seeds the canonical permission, the OR branch is deleted (the source comment names the exact change).

## Admin/PM role-variant verification

- **Source:** Step 12c functional smoke test ("Role pass (sign-out + sign-in each): … Admin/PM sees full surface minus audit link")
- **Verbatim:** brief §11 "Admin / Practice Manager — Everything Owner sees, with one difference… The 'Open audit row' Ghost link is hidden (not greyed-out)…"
- **Defer to:** Phase 7
- **Why deferred:** During the FAKE window, Admin/PM has neither `MANAGE_ACCOUNT_PASSWORD_REQUESTS` nor `MANAGE_AUDIT_LOGS`, so Admin hits AdminAccessDenied. The Admin-variant render path (page renders + audit-link hidden) is verified only by source review until the BUILD plan lands the canonical permission on Admin/PM. The code path itself is correct (`canOpenAudit` flag toggles the audit link), and the smoke-test source review confirms it; runtime verification waits for the seed.
- **Provisional Phase 6 answer used to continue this session:** Owner-only runtime verification + source review for the Admin branch.
