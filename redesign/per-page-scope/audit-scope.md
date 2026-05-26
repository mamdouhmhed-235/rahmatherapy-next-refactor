# Scope — audit (Phase 6, row 20 of 29)

Brief: `/redesign/briefs/audit-brief.md`
Recipe: `/redesign/per-page-recipes/audit-recipe.md`

## Files to edit

- `src/app/admin/audit/page.tsx` — replace top-100 list render with filter strip + search + result count + paginated timeline + Load more; preserve `manage_audit_logs` gate; render `AdminAccessDenied` for non-Owner; FAKE-mark backend cursor + filter call sites.
- `src/app/admin/audit/format.ts` *(net-new)* — action-verb-phrase map (every `action_type` → present-tense verb phrase) + 8-family action-taxonomy map (every `action_type` → family key). Includes 4 password-reset types from Brief 10.
- `src/app/admin/audit/redaction.ts` *(net-new)* — pure helper using the RECON §6.2 regex `note|health|treatment|consent|token|secret|key|payload|body` verbatim; returns `{ keysHidden, count }` for a state blob.
- `src/app/admin/audit/actions.ts` *(net-new)* — server action `auditLoadMore({ filters, cursor }): Promise<AuditPage>` for paginated next-page reads. Read-only; no mutations.
- `src/app/admin/audit/AuditFilterStrip.tsx` *(net-new)* — client component: search box + actor/family/target-type selects + date-range chips + Clear link; mobile collapse to "Filter" Ghost + `AdminSheet`; GET-form submission.
- `src/app/admin/audit/AuditEventCard.tsx` *(net-new)* — server component per timeline row: 32px actor avatar + verb phrase + target chip + relative timestamp + action-family chip + redaction chip + `<details>` JSON expansion + Copy IDs + conditional "Open target" Ghost.
- `src/app/admin/audit/AuditLoadMoreButton.tsx` *(net-new)* — client component for Load more; calls `auditLoadMore` and appends results in place without scroll jump.

## Files to NEVER touch

- `src/lib/auth/**` — `manage_audit_logs` permission resolution stays as-is (RECON §5).
- `src/lib/supabase/**` — client factories.
- `src/middleware.ts`.
- `supabase/migrations/**` — `audit_logs` schema is untouchable; no new columns proposed.
- Existing audit-log repository helper (e.g. `getRecentAuditLogs`) — `actions.ts` adds a cursor-paged variant alongside; never modifies the existing helper.
- RECON §6.2 redaction regex — preserved character-for-character; `redaction.ts` references it verbatim.
- All build/config files.

## Features preserved

- `manage_audit_logs` Owner-only gate at top of `page.tsx`.
- Redaction regex behaviour (the value redaction itself is preserved; this brief surfaces it via a chip — does not change which keys it matches).
- Zero audit-log writes from this page; loading `/admin/audit` is not itself an audit event.
- Skip-link target `id="admin-main"` and cmd-K palette hook `id="admin-command-search"` (shared top nav).
