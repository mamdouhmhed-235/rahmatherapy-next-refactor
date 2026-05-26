# Progress — audit

Started: 2026-05-15
Recipe: /redesign/per-page-recipes/audit-recipe.md

## Step log

step-1: COMPLETE — re-prime confirmed (7 files summarised, PRODUCT register=product, brief §6 S2 quoted verbatim, Feature Preservation Manifest enumerated, BASELINE 0/6/0 confirmed)
step-2: COMPLETE — BROKEN guard run; BROKEN_GUARD_RESULT: none (all Track A Zone 1 items HANDLED elsewhere)
step-3: COMPLETE — scope written (7 files: 1 edit + 6 net-new), IMPLEMENTATION-PLAN "Currently on" updated to 20 of 29 — audit
step-4: COMPLETE — craft built page (page.tsx rewritten; 6 net-new files: format.ts, redaction.ts, actions.ts, AuditFilterStrip.tsx, AuditEventCard.tsx, AuditLoadMoreButton.tsx + CopyIdButton.tsx helper); CRAFT_COMPLETE emitted
step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE (summary weight + chevron easing tightened to brief tokens)
step-6: COMPLETE — dev server on 3003 (webpack mode — Turbopack root inference rejects junctioned node_modules; HTTP 308 trailing-slash redirect expected)
step-11a-static: COMPLETE — TOKEN_DRIFT: 0 (oklch literals match admin-ui.tsx status-family convention); REDACTION_REGEX_VERBATIM: yes (redaction.ts:3 character-for-character RECON §6.2); AUDIT_WRITES_ON_LOAD: 0 (no .insert() in any net-new file)
step-7: COMPLETE — axes applied: quieter, typeset (7 baseline + 2 per-axis + 3 post-axes screenshots saved)
step-7b: COMPLETE — polish loop done (iter1 fixed: ol numeric counters + dot chroma; iter2 clean, no horizontal scroll at 375 or 768)
step-8: COMPLETE — adapt run, breakpoints clean (HORIZONTAL_SCROLL_TABLET/MOBILE both false; TOUCH_TARGET_DETAILS_MOBILE 44px after fix; Copy IDs + Filter trigger + search input bumped to ≥44px at 375; JSON columns stack vertically below 768px)
step-9: COMPLETE — harden run, HARDEN-RECS-audit.md saved; states added: Try again Ghost + from>to inline error
step-10: COMPLETE — clarify run, copy verified (CLARIFY_RESULT: copy already matches brief §8 + Copy block)
step-11: COMPLETE — verification clean (TOKEN_DRIFT: 0; REDACTION_REGEX_VERBATIM: yes; AUDIT_WRITES_ON_LOAD: 0; CONSOLE_NEW_ERRORS: 0; NETWORK_BASELINE_MATCH: yes; Coordinator denied state title=Access denied · Rahma with no raw permission identifier; final 3-viewport screenshots saved)
step-12: COMPLETE — audit (17/20, 0 P0 / 2 P1 / 5 P2 / 4 P3, Backend FAKE: BUILD-audit-filter-and-pagination + BUILD-audit-target-existence; BUSINESS-COMPLETENESS 2A-6 contribution), critique (30/40 Nielsen, AI-slop PASS), smoke ALL PASS
step-13: COMPLETE — handoff emitted, awaiting approval
step-14: COMPLETE — 8 post-handoff operator-value fixes applied across the audit timeline based on user-led visual + functional review.

## Corrective dispatch (2026-05-17)

Eight surgical fixes applied on top of the handoff state. All scoped inside `src/app/admin/audit/`; no shared components or other admin pages touched. Verified live in browser at 375 / 768 / 1440 — no horizontal scroll, 0 console errors, no regressions.

- **Fix 1 (operator-value: one-click filter by actor):** Actor name in each card renders as `<Link href="?actor=<id>">` preserving the other URL params (`AuditEventCard.tsx` + new `buildFilterHref` helper in `format.ts`). Click on "Rahma Therapy" → `/admin/audit/?actor=01582…218` + result count "Showing 12 of 25 events." When the actor filter is already active on the row's own actor, the name renders as a plain span (no self-link).
- **Fix 2 (operator-value: one-click filter by family):** Action-family dot renders as `<Link href="?family=<key>">` with `aria-label="Filter by action family: <name>"`. Same self-link guard.
- **Fix 3 (operator-value: Expand all / Collapse all):** New `AuditPageActions.tsx` client component above the timeline. Targets `details[data-audit-json="true"]` specifically so the trailing-menu `<details>` elements stay closed. Click test confirmed 25 JSON wells opened, 0 row menus accidentally opened.
- **Fix 4 (operator-value: Refresh + freshness ticker):** Same `AuditPageActions.tsx`. Refresh button calls `router.refresh()` + Sonner success toast. "Last refreshed N min ago" indicator updates every 30 seconds via `setInterval` and respects `aria-live="polite"`.
- **Fix 5 (visual: search result UUID-prefix highlight):** `renderTargetChipContent` helper in `AuditEventCard.tsx` wraps the matched prefix in a `<mark>` element with Pending-family tint. `/admin/audit?q=da69` → 5 `<mark>` elements with "da69" highlighted in the target chips.
- **Fix 6 (a11y / visual: active date-range chip marker):** Active chip in `AuditFilterStrip.tsx` `DateRangeChipStrip` adds `aria-current="true"` + `<Check>` icon + tight focus-ring shadow (`shadow-[0_0_0_2px_oklch(99.2%_0.004_88),0_0_0_3px_var(--admin-primary)]`).
- **Fix 7 (visual hierarchy: day-grouped timeline):** New `DayGroupedTimeline` server component in `page.tsx`. New `dayKey()` + `dayLabel()` helpers in `format.ts` use `Intl.DateTimeFormat` in Europe/London timezone, returning "Today" / "Yesterday" / "Friday 15 May" labels. Renders an `<h3>` per day group with row count badge.
- **Fix 8 (visual noise reduction: trailing more-horizontal menu):** New `AuditRowMenu.tsx` client component replaces the inline `Copy event ID` + `Copy target ID` Ghost button pair. Each card now carries one trailing icon button instead of two text buttons; "Open booking" / "Open client" / etc. stays surfaced at rest only where the target type maps to a route. Cuts visual repetition by ~200 buttons across a full 100-row page.
- **Bonus fix (impeccable em-dash rule):** `truncateUuid()` returns `""` instead of `"—"` when target_id is null; `renderTargetChipContent` omits the trailing UUID portion when empty. "business settings" rows no longer render an em-dash after the type label.

**Files in dispatch scope:**
- Modified: `src/app/admin/audit/page.tsx`, `AuditEventCard.tsx`, `AuditFilterStrip.tsx`, `AuditLoadMoreButton.tsx`, `format.ts`
- Net-new: `src/app/admin/audit/AuditPageActions.tsx`, `AuditRowMenu.tsx`
- Deleted: `src/app/admin/audit/CopyIdButton.tsx` (functionality folded into `AuditRowMenu.tsx`)

**Deferred to Phase 7 (still open from initial audit subagent):**
- P1 family-dot → compact pill (the dot is still colour-only for sighted users; the brief specced a labelled pill)
- P1 `print:!open` non-functional Tailwind class (requires `src/app/globals.css` edit)
- 5 P2 + 4 P3 items per `audit-deferrals.md`
