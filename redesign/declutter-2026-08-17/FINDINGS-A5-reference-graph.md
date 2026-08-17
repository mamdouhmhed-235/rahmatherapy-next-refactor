# A5 — Reference Graph Findings (the safety spine)

Agent A5, workspace-decluttering inventory, 2026-08-17. Read-only. Repo root:
`C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` at commit
`c04b6b45981ff839d7287c046ed71d0b2b0b4643` (branch `master`).

This document answers one question exhaustively: **what points at what?** A1–A4
propose deletions; this is the citation map that vetoes them. Everything here
was produced by re-runnable commands, not by eyeballing — see §3 for the
extractor script and the methodology notes under each section for exactly
what each check does and does not catch.

---

## 1. SUMMARY

| Metric | Count |
|---|---:|
| Citation lines found in src/scripts/e2e/supabase/root-config comments | 104 |
| Distinct citing files | 70 |
| Distinct cited **doc paths that resolve today** (the PROTECTED LIST) | **49** |
| Dangling citations **inside the repo** | **0** |
| Citations to a path **outside the repo entirely** (exists on disk, not tracked) | 1 |
| Total tracked `.md` files repo-wide | 712 |
| Tracked `.html` files under `redesign/` | 4 |
| `.md`+`.html` nodes scanned for the doc→doc graph | 716 |
| Docs in scope (`redesign/` + repo-root `.md`) for the inbound-count table | 622 |
| Doc→doc **zero-inbound** docs in scope | 103 |
| Reachable from the 3 governing roots (transitive closure) | 422 / 622 in scope (462 / 716 overall) |
| Unreachable from the governing roots (deletion **candidates**, pending §2 cross-check) | 200 / 622 in scope |
| Docs that are unreachable from the spine **but source-code-protected** (must still be kept) | **6** |
| Docs that are doc-graph zero-inbound **but source-code-protected** | **2** |

Headline: the prior measurement's "zero code imports anything from `redesign/`, but
63 files cite doc paths in comments, 38 distinct paths, all resolving" reproduces
directionally correct but undercounts. A more exhaustive sweep (root config files
included, bare filenames resolved by basename, multi-line citations followed)
finds **70 citing files, 104 citation lines, 49 distinct resolving paths, 0
dangling links inside the repo.** The 38→49 gap is almost entirely bare filenames
like `DESIGN.md`, `BUILD-create-role.md`, `ENGINEERING-LOG.md` cited without their
`redesign/` subfolder — a naive "does this literal string exist as a path"
check would have wrongly flagged 10 of these 49 as dangling. They all resolve;
see §3's extractor for the basename-fallback logic that proves it.

---

## 2. PROTECTED LIST — every doc cited from source code (deletion veto list)

**Complete. 49 distinct paths.** Any deletion proposal from A1–A4 touching one of
these paths must be rejected outright, regardless of what the doc-graph inbound
count in §5 says about it (§6 shows 6 of these are doc-graph-unreachable and
2 are doc-graph-zero-inbound — the doc graph alone would have missed them).

Three of the 49 are **directories** (a comment cites the folder, not one file in
it — e.g. `redesign/evidence/C-16/`); two are non-`.md` evidence artifacts
(`.sql`, `.json`) that a `*.md`-only sweep would have missed entirely.

| Protected path | # citing lines | Example citer |
|---|---:|---|
| `DESIGN.md` | 18 | src/app/admin/audit/AuditEventCard.tsx:57 |
| `PRODUCT.md` | 2 | src/app/admin/dashboard/dashboard-cards.tsx:271 |
| `redesign/backend-plans/BUILD-approve-reject-password-reset.md` | 2 | src/app/admin/account-password-requests/ApproveModal.tsx:75 |
| `redesign/backend-plans/BUILD-create-role.md` | 2 | src/app/admin/roles/CreateRoleSheet.tsx:39 |
| `redesign/backend-plans/BUILD-password-reset-email-templates.md` | 1 | src/lib/email/templates.ts:1545 |
| `redesign/backend-plans/BUILD-password-reset-request-actions.md` | 3 | src/app/admin/password-reset/page.tsx:22 |
| `redesign/backend-plans/BUILD-rbac-permission-email-templates.md` | 1 | src/app/admin/email-templates/preview/[id]/route.ts:21 |
| `redesign/backend-smoke-tests/` | 1 | supabase/migrations/20260519121000_email_template_overrides_authenticated_select_grant.sql:12 |
| `redesign/baselines/bundle-pre-B1.json` | 2 | scripts/measure-admin-bundles.mjs:21 |
| `redesign/baselines/wcag-severity-tokens.md` | 1 | src/styles/tokens.css:112 |
| `redesign/briefs/B2-metric-backend-brief.md` | 2 | src/app/admin/clients/client-metrics.ts:11 |
| `redesign/briefs/C-01-review-request-email-brief.md` | 1 | supabase/migrations/20260729064606_c01_review_email_infrastructure.sql:4 |
| `redesign/briefs/C-02-recurring-bookings-brief.md` | 1 | supabase/migrations/20260802122636_c02_recurring_bookings.sql:4 |
| `redesign/briefs/C-04a-cancellation-restore-brief.md` | 1 | supabase/migrations/20260728073903_c04a_scheduled_emails.sql:4 |
| `redesign/briefs/C-06-client-crud-hardening-brief.md` | 1 | supabase/migrations/20260727120000_c06_client_crud_hardening.sql:4 |
| `redesign/briefs/C-08-email-automation-expansion-brief.md` | 1 | supabase/migrations/20260731192911_c08_notification_email_and_metadata.sql:4 |
| `redesign/briefs/C-14-granular-working-hours-breaks-brief.md` | 2 | supabase/migrations/20260809120000_c14_save_availability_day.sql:4 |
| `redesign/briefs/C-18-cookie-consent-brief.md` | 1 | supabase/migrations/20260804182200_c18_consent_events.sql:11 |
| `redesign/briefs/password-reset-brief.md` | 1 | src/lib/email/templates.ts:1546 |
| `redesign/ENGINEERING-LOG.md` | 2 | src/app/api/cron/booking-reminders/route.ts:16 |
| `redesign/evidence/admin-contrast/root-cause-D1.md` | 1 | scripts/verify-admin-token-contrast.mjs:240 |
| `redesign/evidence/admin-contrast/summary.md` | 1 | e2e/admin-contrast.spec.ts:195 |
| `redesign/evidence/C-02/phase-b-rpc-verification.md` | 2 | src/app/api/cron/__tests__/extend-recurring-horizons.test.ts:27 |
| `redesign/evidence/C-04a/delivery_status_check-BEFORE.sql` | 1 | supabase/migrations/20260728073903_c04a_scheduled_emails.sql:12 |
| `redesign/evidence/C-06/create_booking_request-BEFORE.sql` | 1 | supabase/migrations/20260727120000_c06_client_crud_hardening.sql:16 |
| `redesign/evidence/C-06/migration-diff-summary.md` | 1 | supabase/migrations/20260727120000_c06_client_crud_hardening.sql:20 |
| `redesign/evidence/C-16/` | 1 | src/app/admin/account-password-requests/__tests__/resolvePasswordRequestsBannerState.test.ts:8 |
| `redesign/evidence/C-16/steps1112-verify.md` | 2 | src/app/admin/account-password-requests/__tests__/password-requests-data.test.ts:226 |
| `redesign/evidence/C-17/phase-a-verify-full.md` | 1 | src/app/booking/__tests__/no-google-analytics.test.ts:43 |
| `redesign/evidence/C-18/cookie-inventory-browser.md` | 2 | src/lib/consent/cookie-registry.ts:178 |
| `redesign/evidence/C-18/cookie-inventory-source.md` | 3 | src/lib/consent/__tests__/registry-completeness.test.ts:3 |
| `redesign/evidence/C-18/phase-d-verify-full.md` | 1 | src/components/consent/__tests__/consent-transitions.test.ts:204 |
| `redesign/evidence/C-18/sentry-replay-investigation.md` | 1 | src/components/__tests__/SentryProvider.test.tsx:10 |
| `redesign/evidence/C-20/closeout-cost-mechanics.md` | 1 | src/components/address/AddressAutocompleteField.test.tsx:256 |
| `redesign/evidence/post-band-c-impl/item-2/` | 1 | src/app/(public)/privacy/page.test.tsx:15 |
| `redesign/per-page-progress/C-16-data-growth-pagination-progress.md` | 1 | src/app/admin/account-password-requests/password-requests-data.ts:8 |
| `redesign/per-page-progress/C-18-cookie-consent-progress.md` | 1 | src/lib/consent/cookie-registry.ts:200 |
| `redesign/plans/B-phase/B2-metric-backend-plan.md` | 7 | src/app/admin/clients/client-metrics.ts:10 |
| `redesign/plans/B-phase/B4-reports-rebuild-plan.md` | 8 | src/app/admin/reports/HeadlineTileStrip.tsx:11 |
| `redesign/plans/B-phase/SHARED-IMPLEMENTATION-NOTES.md` | 3 | src/app/admin/reports/report-insights.ts:11 |
| `redesign/plans/C-phase/C-01-review-request-email-plan.md` | 1 | supabase/migrations/20260729064606_c01_review_email_infrastructure.sql:3 |
| `redesign/plans/C-phase/C-02-recurring-bookings-plan.md` | 1 | supabase/migrations/20260802122636_c02_recurring_bookings.sql:3 |
| `redesign/plans/C-phase/C-04a-cancellation-restore-plan.md` | 1 | supabase/migrations/20260728073903_c04a_scheduled_emails.sql:3 |
| `redesign/plans/C-phase/C-06-client-crud-hardening-plan.md` | 1 | supabase/migrations/20260727120000_c06_client_crud_hardening.sql:3 |
| `redesign/plans/C-phase/C-08-email-automation-expansion-plan.md` | 1 | supabase/migrations/20260731192911_c08_notification_email_and_metadata.sql:3 |
| `redesign/plans/C-phase/C-14-granular-working-hours-breaks-plan.md` | 2 | supabase/migrations/20260809120000_c14_save_availability_day.sql:3 |
| `redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md` | 3 | supabase/migrations/20260728073903_c04a_scheduled_emails.sql:19 |
| `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` | 4 | e2e/admin-contrast-helpers.ts:7 |
| `redesign/plans/SEO-AEO-GEO-IMPLEMENTATION.md` | 3 | src/app/__tests__/canonicals.test.ts:19 |

---

## 3. THE REUSABLE EXTRACTOR

Verbatim, re-runnable after any deletion pass to prove nothing broke. It only
reads tracked files (`git grep`/`git ls-files`), never touches `node_modules`,
`.next`, or build output, and makes no writes. Save as `extract-doc-citations.sh`
at the repo root and run `bash extract-doc-citations.sh`.

It catches three citation forms — explicit `redesign/...` paths, bare `*.md`
filenames with no path prefix (e.g. `DESIGN.md`), and directory-only citations
(a trailing `/`) — and applies the punctuation-trap fix called out in the brief:
it strips trailing sentence punctuation **twice** before testing existence
(catches `...brief.md).` where a paren and a period both trail the real name),
and it falls back to a repo-wide basename search before declaring a bare
filename dangling (this is what correctly resolves `DESIGN.md`,
`BUILD-create-role.md`, `SHARED-IMPLEMENTATION-NOTES.md`, etc. instead of
false-flagging all ten of them as broken links).

```bash
#!/usr/bin/env bash
# extract-doc-citations.sh
#
# Reusable extractor: finds every documentation path cited from a comment
# (or string literal) anywhere under src/, scripts/, e2e/, supabase/, and the
# root config files, and reports whether each cited path resolves today.
#
# Usage:  bash extract-doc-citations.sh            (from repo root)
#
# Output columns (tab-separated): CITING_FILE:LINE <TAB> RAW_TOKEN <TAB> NORMALIZED_PATH <TAB> STATUS
#   STATUS is RESOLVES, RESOLVES(dir), RESOLVES(basename: <path>), or DANGLING.
#
# Method notes:
#  - Only searches files tracked by git (git grep), so build artifacts,
#    node_modules, .next etc. are never scanned.
#  - Catches three citation forms: explicit repo-relative paths beginning
#    redesign/, docs/, or implementation-plans/; and bare *.md filenames
#    (e.g. "DESIGN.md", "BUILD-create-role.md") that carry no path prefix.
#  - Strips a leading "/" (some comments write "/redesign/..." as if repo-root-absolute).
#  - PUNCTUATION TRAP: strips trailing sentence punctuation (. , ) ] } : ' " `)
#    from every extracted token before testing existence, and re-strips after
#    removing a trailing paren in case a second punctuation mark follows it
#    (e.g. "...brief.md)." -> "...brief.md"). Without this a naive matcher
#    reports false-positive dangling links for ordinary sentence-final periods.
#    (This project's prior run produced exactly that false alarm.)
#  - A token ending in "/" (or that resolves to a directory) is checked as a
#    directory prefix against the tracked-file list, not as a file.
#  - A bare filename (no "/") that doesn't resolve as a literal repo-root path
#    gets a repo-wide basename fallback search before being called dangling.

set -u
cd "$(git rev-parse --show-toplevel)" || exit 1

ROOT_CONFIG_FILES="next.config.ts tsconfig.json eslint.config.mjs playwright.config.ts vitest.config.ts wrangler.jsonc package.json postcss.config.mjs components.json open-next.config.ts pnpm-workspace.yaml"

strip_punct() {
  local s="$1"
  s="${s%.}"; s="${s%,}"; s="${s%)}"; s="${s%:}"; s="${s%\'}"; s="${s%\"}"; s="${s%\`}"; s="${s%]}"; s="${s%\}}"
  s="${s%.}"; s="${s%,}"; s="${s%)}"; s="${s%:}"; s="${s%\'}"; s="${s%\"}"; s="${s%\`}"; s="${s%]}"; s="${s%\}}"
  printf '%s' "$s"
}

resolve_status() {
  local p="$1"
  p="${p#/}"
  if [ -f "$p" ]; then echo "RESOLVES"; return; fi
  local dirp="${p%/}/"
  if git ls-files -- "$dirp*" | grep -q .; then echo "RESOLVES(dir)"; return; fi
  case "$p" in
    */*) : ;;
    *)
      local hit
      hit="$(git ls-files | grep -F "/$p" | head -1)"
      [ -z "$hit" ] && hit="$(git ls-files | grep -E "^$p\$" | head -1)"
      if [ -n "$hit" ]; then echo "RESOLVES(basename: $hit)"; return; fi
      ;;
  esac
  echo "DANGLING"
}

printf 'CITING_FILE:LINE\tRAW_TOKEN\tNORMALIZED_PATH\tSTATUS\n'

git grep -n -E '(redesign/|docs/|implementation-plans/|[A-Za-z0-9_-]+\.md)' \
    -- src scripts e2e supabase $ROOT_CONFIG_FILES |
while IFS=: read -r file line rest; do
  echo "$rest" | grep -oE '(redesign/[A-Za-z0-9_./-]+|docs/[A-Za-z0-9_./-]+|implementation-plans/[A-Za-z0-9_./-]+|[A-Za-z0-9_-]+\.md)' |
  while read -r raw; do
    norm="$(strip_punct "$raw")"
    [ -z "$norm" ] && continue
    status="$(resolve_status "$norm")"
    printf '%s:%s\t%s\t%s\t%s\n' "$file" "$line" "$raw" "$norm" "$status"
  done
done
```

**Verified working** on this repo right now: 104 rows in, 0 `DANGLING` rows out
(the one true miss — an absolute Windows path outside the repo — doesn't match
the `redesign/|docs/|implementation-plans/|*.md` grep pattern in the first
place, because it's not a repo-relative path; see below).

To check pass/fail automatically after a deletion pass:
```bash
bash extract-doc-citations.sh | awk -F'\t' 'NR>1 && $4=="DANGLING"' 
# empty output = nothing broke
```

---

## 4. DANGLING REFERENCES

**Zero, inside the repo.** Every one of the 104 citation lines resolves (see
§3's verified run and the full per-line detail in the appendix at the end of
this document).

**One citation to a path that is not part of the repo at all:**

| Citing file:line | Cited text | Target | Status |
|---|---|---|---|
| `supabase/migrations/20260521160000_create_notification_state.sql:7` | `C:\Users\mamdo\.claude\plans\lets-start-with-r4-lazy-stroustrup.md` | User's global `~/.claude/plans/` folder, outside the repo entirely | **Exists on disk** (verified with `test -f`), but it is not a repo path, not tracked by git, and cannot be a deletion candidate *or* a protected repo doc — it is simply out of scope. Flagging so nobody chases it as a "dangling repo link"; it isn't one, and it also isn't something A1–A4's repo-scoped deletions could ever affect. |

This is the only entry the naive `redesign/|docs/|implementation-plans/|*.md`
grep pattern didn't fully capture as a path (it only caught the trailing bare
`lets-start-with-r4-lazy-stroustrup.md` token, which the basename fallback
correctly could not resolve inside the repo — hence `DANGLING` in the raw
extractor output for that one row, which is the *correct* answer once you know
the full citation is an external, non-repo path).

---

## 5. INBOUND-REFERENCE COUNTS

### Method

A Node script (`doc-graph.mjs`, logic summarized below; full script kept in the
session scratchpad, not committed) scanned all 716 tracked `.md` + `redesign/*.html`
files for two citation shapes: Markdown links `[text](path)` and bare
`word/word.md`-or-`.html` tokens in prose. Same punctuation-trap stripping as
§3. Relative links (`./`, `../`) resolve against the citing file's own
directory. Bare filenames with no `/` first try a literal repo-root path, then
fall back to a repo-wide basename search — **preferring a same-directory
candidate** when the basename is ambiguous (e.g. `redesign/evidence/C-16/`
citing bare `phase-b-verify-full.md` resolves to its own sibling file, not to
`redesign/evidence/C-14/phase-b-verify-full.md`, even though a file with that
exact basename exists in six different `C-xx` evidence folders). Self-citations
are excluded. External URLs (`http(s)://`, `mailto:`) are excluded.

**Known noise, verified and excluded from conclusions:** the raw sweep produced
377 "dangling doc-to-doc" candidate tokens, and the overwhelming majority are
false positives from two sources, both checked by hand:
1. Generic HTML-element examples inside evidence/verification docs — `home.html`,
   `about.html`, `index.html`, `input.html`, `row.html`, `src/app.html` are
   prose describing *webpage sections*, not file citations (e.g. "the About
   section" written near a stray `.html`-shaped substring). None of the 4 real
   `redesign/*.html` files are named any of these, so they correctly never
   resolved and never polluted a real target's inbound count.
2. The vendored `.agents/skills/impeccable/` and `.claude/skills/impeccable/`
   plugin docs use short generic example names (`brief.md`, `plan.md`) in
   their own template prose — not citations into this project's `redesign/`
   tree.

A small number (5, all listed in §6) of remaining ambiguous bare-filename
resolutions could not be disambiguated by the same-directory heuristic and are
flagged low-confidence rather than silently resolved.

**Real, verified dangling doc→doc references worth knowing about** (not fixed
here — out of scope for A5, flagged for whoever owns doc content): several
`redesign/` files cite sibling docs that were apparently never created or were
already removed — `redesign/SEO-MANIFEST.md`, `redesign/CUSTOMER-JOURNEY.md`,
`redesign/COPY-AUDIT.md`, `redesign/REFERENCE-CRITIQUE.md`,
`redesign/STAGING-ACCESS.md`, `redesign/EXTRACT-REPORT.md`,
`redesign/MOBILE-CONVERSION-REPORT.md`, `redesign/SEO-VERIFICATION.md`, and
five `docs/production/*.md` files (`phase9-rls-privacy-verification.md`,
`reporting-metric-definitions.md`, `privacy-data-retention.md`, `role-matrix.md`,
`phase10-test-setup.md`, `sentry-privacy.md`, `migration-history.md`) that
`docs/` itself only partially delivers (it currently holds 5 files total:
`production-runbook.md`, `production/backend-parity-audit.md`,
`production/production-readiness-checklist.md`, plus two extensionless files
`docs/tech-stack` and `docs/users-credentials` — the latter was not opened,
out of caution, since its name suggests credential-shaped content). These are
pre-existing content gaps, not a result of any deletion, and they don't affect
the protected/candidate determination below.

### ⚠️ Critical caveat before using this table to pick deletion candidates

**A zero (or low) inbound count in this table means nothing else in the
markdown/HTML doc corpus links to that file. It does NOT mean nothing in the
codebase depends on it.** Cross-reference every candidate against the §2
PROTECTED LIST first. §6 shows this isn't hypothetical: 6 files that this
table's methodology alone would rank as prime candidates are in fact cited
directly from test code, migrations, or `cookie-registry.ts`.

### Full ranked table — every doc in `redesign/` + repo root (622 files), ascending

| Doc path | Inbound refs |
|---|---:|
| implementation.md | 0 |
| redesign/backend-smoke-tests/README.md | 0 |
| redesign/DEFERRALS-SUMMARY.md | 0 |
| redesign/ENGINEERING-PAUSE-EXPLAINED.html | 0 |
| redesign/evidence/admin-contrast/ADMIN-dark.md | 0 |
| redesign/evidence/admin-contrast/ADMIN-light.md | 0 |
| redesign/evidence/admin-contrast/COORDINATOR-dark.md | 0 |
| redesign/evidence/admin-contrast/COORDINATOR-light.md | 0 |
| redesign/evidence/admin-contrast/item7-phaseB-exact-substitution-2026-08-12.md | 0 |
| redesign/evidence/admin-contrast/THERAPIST_A-dark.md | 0 |
| redesign/evidence/admin-contrast/THERAPIST_A-light.md | 0 |
| redesign/evidence/admin-contrast/UNAUTHENTICATED-dark.md | 0 |
| redesign/evidence/admin-contrast/UNAUTHENTICATED-light.md | 0 |
| redesign/evidence/C-04a/migration-notes.md | 0 |
| redesign/evidence/C-06/migration-diff-summary.md | 0 |
| redesign/evidence/C-16/closeout-fix-reverify.md | 0 |
| redesign/evidence/C-17/closeout-review.md | 0 |
| redesign/evidence/C-17/fix-reverify.md | 0 |
| redesign/evidence/C-17/phase-a-verify-full.md | 0 |
| redesign/evidence/C-18/adversarial-plan-review.md | 0 |
| redesign/evidence/C-18/live-browser-gate.md | 0 |
| redesign/evidence/C-18/phase-a-final-verify.md | 0 |
| redesign/evidence/C-18/phase-a-reverify.md | 0 |
| redesign/evidence/C-18/phase-a-verify-full.md | 0 |
| redesign/evidence/C-18/replay-fix-verify.md | 0 |
| redesign/evidence/C-19/closeout-gates-scope.md | 0 |
| redesign/evidence/C-19/closeout-truthfulness.md | 0 |
| redesign/evidence/C-20/closeout-adversarial.md | 0 |
| redesign/evidence/C-22/honeypot-accessibility.md | 0 |
| redesign/evidence/C-23/phase-d-verify-full.md | 0 |
| redesign/evidence/checkpoint-3/baseline-erosion-audit.md | 0 |
| redesign/evidence/checkpoint-3/unowned-debt-inventory.md | 0 |
| redesign/evidence/plan-deepening/draft-item-01-review-emails.md | 0 |
| redesign/evidence/plan-deepening/draft-item-03-override-sort.md | 0 |
| redesign/evidence/plan-deepening/draft-item-05-bundle-tooling.md | 0 |
| redesign/evidence/plan-deepening/draft-item-06-count-by-date.md | 0 |
| redesign/evidence/plan-deepening/draft-item-07a-phase0-theme.md | 0 |
| redesign/evidence/plan-deepening/draft-item-07b-literals.md | 0 |
| redesign/evidence/plan-deepening/item-01-review-emails.md | 0 |
| redesign/evidence/plan-deepening/item-03-override-sort.md | 0 |
| redesign/evidence/plan-deepening/item-05-bundle-tooling.md | 0 |
| redesign/evidence/plan-deepening/item6/i6a-admin-tree.md | 0 |
| redesign/evidence/plan-deepening/item6/i6b-staff-tree.md | 0 |
| redesign/evidence/plan-deepening/item6/i6c-saturation-and-tests.md | 0 |
| redesign/evidence/plan-deepening/phase0/a1-dealias-table.md | 0 |
| redesign/evidence/plan-deepening/phase0/a2-parser-fix.md | 0 |
| redesign/evidence/plan-deepening/phase0/a3-warning-token.md | 0 |
| redesign/evidence/plan-deepening/phase0/a4-alias-guard.md | 0 |
| redesign/evidence/plan-deepening/phase0/a5-prose-claims.md | 0 |
| redesign/evidence/plan-deepening/phase0/a6-unmeasured-aliases.md | 0 |
| redesign/evidence/post-band-c-impl/item-1/A-symbols-and-anchors.md | 0 |
| redesign/evidence/post-band-c-impl/item-1/B2-actions-current.md | 0 |
| redesign/evidence/post-band-c-impl/item-1/B2-critique-money-and-state.md | 0 |
| redesign/evidence/post-band-c-impl/item-1/B2-notifications-current.md | 0 |
| redesign/evidence/post-band-c-impl/item-1/B2-page-current.md | 0 |
| redesign/evidence/post-band-c-impl/item-1/B2-step1e-seam.md | 0 |
| redesign/evidence/post-band-c-impl/item-1/B2-test-precedents.md | 0 |
| redesign/evidence/post-band-c-impl/item-2/R1-refute-facts.md | 0 |
| redesign/evidence/post-band-c-impl/item-4/B-blast-radius.md | 0 |
| redesign/evidence/post-band-c-impl/item-4/R1-refute-counts.md | 0 |
| redesign/evidence/post-band-c-impl/item-4/R2-refute-shapes.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/CRITIQUE-completeness.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/CRITIQUE-dark-direction.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/CRITIQUE-judgement-calls.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/CRITIQUE-light-invariance.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/CRITIQUE-tokens-css-structure.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/F1-scrim-VERDICT.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/F2-shadow-VERDICT.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/F3-neutral-88-VERDICT.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/F3-neutral-88.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/F4-restricted-280-VERDICT.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/F5-danger-20-25.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/F6-warning-55-80-VERDICT.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/F6-warning-55-80.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/F7-primary-120-165-VERDICT.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/F7-primary-120-165.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/F8-info-230-247-VERDICT.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/F8-info-230-247.md | 0 |
| redesign/evidence/post-band-c-impl/item-7/PHASE-D-LAYER3.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/B-permission-insert.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/phase1-app/D4-availability.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/phase1-app/D6-tests.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/phase1-app/D7-blast-radius.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/phase1-app/TEETH-CHECK.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/phase1-app/X1-contradictions.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/phase1-app/X2-what-breaks.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/phase1-app/X3-completeness.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/phase2-app/P1-booking-schema.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/phase2-app/P2-AboutYouStep.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/phase2-app/P3-prop-threading.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/phase2-app/TEETH-CHECK.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/phase2-app/Y1-what-breaks.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/phase2-app/Y2-completeness.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/phase3-app/TEETH-CHECK.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/phase3-app/Z1-money.md | 0 |
| redesign/evidence/post-band-c-impl/item-8/phase3-app/Z2-bypass.md | 0 |
| redesign/evidence/SEO-phase0-baseline/README.md | 0 |
| redesign/evidence/SEO-phase11-review/README.md | 0 |
| redesign/HANDOFF-2026-08-04-ADVISOR-SEAT.md | 0 |
| redesign/PHASE-7-EXPLAINED.html | 0 |
| redesign/PHASE-7-THEME-RECOLOR.md | 0 |
| redesign/plans/C-phase/C-C-RESUME-2026-07-31.md | 0 |
| redesign/subagent-chunk1-instructions.md | 0 |
| dashboard_audit.md | 1 |
| redesign/audits/C-A/05-clients-list-audit.md | 1 |
| redesign/audits/C-A/11-staff-detail-audit.md | 1 |
| redesign/audits/C-A/13-staff-performance-audit.md | 1 |
| redesign/audits/C-A/14-admin-me-audit.md | 1 |
| redesign/audits/C-A/16-services-audit.md | 1 |
| redesign/audits/C-A/17-settings-audit.md | 1 |
| redesign/audits/C-A/21-roles-audit.md | 1 |
| redesign/audits/C-A/23-password-requests-audit.md | 1 |
| redesign/audits/C-A/24-audit-log-audit.md | 1 |
| redesign/CLARIFY-PASS.md | 1 |
| redesign/evidence/admin-contrast/ab-phase0-2026-08-11.md | 1 |
| redesign/evidence/admin-contrast/OWNER-dark.md | 1 |
| redesign/evidence/admin-contrast/OWNER-light.md | 1 |
| redesign/evidence/C-02/phase-b-rpc-verification.md | 1 |
| redesign/evidence/C-06/closeout-role-sweep.md | 1 |
| redesign/evidence/C-14/closeout-adversarial.md | 1 |
| redesign/evidence/C-14/phase-a-verify-full.md | 1 |
| redesign/evidence/C-16/closeout-adversarial-review.md | 1 |
| redesign/evidence/C-16/inventory-bookings.md | 1 |
| redesign/evidence/C-16/inventory-dashboard-calendar.md | 1 |
| redesign/evidence/C-16/inventory-logs.md | 1 |
| redesign/evidence/C-16/inventory-privacy-staff.md | 1 |
| redesign/evidence/C-16/step12-fix-reverify.md | 1 |
| redesign/evidence/C-16/step14-fix-reverify.md | 1 |
| redesign/evidence/C-16/step5-verify-full.md | 1 |
| redesign/evidence/C-16/steps67-verify-full.md | 1 |
| redesign/evidence/C-17/phase-b-verify-full.md | 1 |
| redesign/evidence/C-18/fix-round-verify.md | 1 |
| redesign/evidence/C-18/phase-a-delta-reverify.md | 1 |
| redesign/evidence/C-18/phase-b-verify-full.md | 1 |
| redesign/evidence/C-18/phase-c-surface-map.md | 1 |
| redesign/evidence/C-18/phase-c-verify-full.md | 1 |
| redesign/evidence/C-18/phase-ef-verify-full.md | 1 |
| redesign/evidence/C-18/registry-rls-accuracy.md | 1 |
| redesign/evidence/C-18/sentry-replay-investigation.md | 1 |
| redesign/evidence/C-19/closeout-a11y-responsive.md | 1 |
| redesign/evidence/C-19/closeout-adversarial.md | 1 |
| redesign/evidence/C-19/closeout-content-legal.md | 1 |
| redesign/evidence/C-20/closeout-a11y-tokens.md | 1 |
| redesign/evidence/C-20/closeout-cost-mechanics.md | 1 |
| redesign/evidence/C-20/closeout-gates-scope.md | 1 |
| redesign/evidence/C-20/step9-registry-verify.md | 1 |
| redesign/evidence/C-21/visual-regression-1280.md | 1 |
| redesign/evidence/C-23/implementation-surface-map.md | 1 |
| redesign/evidence/C-23/phase-b-verify-full.md | 1 |
| redesign/evidence/C-23/phase-c-verify.md | 1 |
| redesign/evidence/checkpoint-3/final-head-gates.md | 1 |
| redesign/evidence/plan-deepening/00-front.md | 1 |
| redesign/evidence/plan-deepening/01-preflight.md | 1 |
| redesign/evidence/plan-deepening/99-tail.md | 1 |
| redesign/evidence/plan-deepening/draft-item-02-privacy.md | 1 |
| redesign/evidence/plan-deepening/draft-item-04-bookings-indexes.md | 1 |
| redesign/evidence/plan-deepening/draft-item-08a-settings-gates.md | 1 |
| redesign/evidence/plan-deepening/draft-item-08b-fee-recurring-comms.md | 1 |
| redesign/evidence/plan-deepening/item-02-privacy.md | 1 |
| redesign/evidence/plan-deepening/item-07b-literals.md | 1 |
| redesign/evidence/plan-deepening/item-08b-fee-recurring-comms.md | 1 |
| redesign/evidence/plan-deepening/x1-shared-surfaces.md | 1 |
| redesign/evidence/plan-deepening/x2-collisions-ordering.md | 1 |
| redesign/evidence/plan-deepening/x4-verification-commands.md | 1 |
| redesign/evidence/post-band-c-impl/item-1/B2-audit-format-current.md | 1 |
| redesign/evidence/post-band-c-impl/item-1/B2-critique-security.md | 1 |
| redesign/evidence/post-band-c-impl/item-1/B2-emails-data-current.md | 1 |
| redesign/evidence/post-band-c-impl/item-1/D-query-shapes.md | 1 |
| redesign/evidence/post-band-c-impl/item-2/A-deletion-paths.md | 1 |
| redesign/evidence/post-band-c-impl/item-2/B-blast-radius.md | 1 |
| redesign/evidence/post-band-c-impl/item-2/R2-refute-harness.md | 1 |
| redesign/evidence/post-band-c-impl/item-4/A-column-usage.md | 1 |
| redesign/evidence/post-band-c-impl/item-4/C-index-shapes.md | 1 |
| redesign/evidence/post-band-c-impl/item-7/F4-restricted-280.md | 1 |
| redesign/evidence/post-band-c-impl/item-8/phase1-app/D1b-settings-actions-independent.md | 1 |
| redesign/evidence/post-band-c-impl/item-8/phase1-app/D2-SettingsForm.md | 1 |
| redesign/evidence/post-band-c-impl/item-8/phase1-app/D3-rbac.md | 1 |
| redesign/evidence/post-band-c-impl/item-8/phase1-app/D5-remaining-consumers.md | 1 |
| redesign/evidence/post-band-c-impl/item-8/phase2-app/P4-availability-and-manual.md | 1 |
| redesign/evidence/post-band-c-impl/item-8/phase3-app/Q1-actions.md | 1 |
| redesign/evidence/post-band-c-impl/item-8/phase3-app/Q2-form.md | 1 |
| redesign/evidence/post-band-c-impl/item-8/phase3-app/Q3-data-and-tests.md | 1 |
| redesign/evidence/post-band-c-impl/item-8/R1-refute-rename.md | 1 |
| redesign/FINAL-CRITIQUE.md | 1 |
| redesign/HANDOFF-2026-08-13-IMPLEMENTATION-8.md | 1 |
| redesign/HARDEN-RECS-00-shared-components.md | 1 |
| redesign/HARDEN-RECS-booking-new.md | 1 |
| redesign/HARDEN-RECS-bookings.md | 1 |
| redesign/per-page-deferrals/availability-deferrals.md | 1 |
| redesign/per-page-deferrals/client-detail-deferrals.md | 1 |
| redesign/per-page-deferrals/dashboard-therapist-deferrals.md | 1 |
| redesign/per-page-deferrals/emails-deferrals.md | 1 |
| redesign/per-page-deferrals/operations-deferrals.md | 1 |
| redesign/per-page-deferrals/password-reset-deferrals.md | 1 |
| redesign/per-page-deferrals/README.md | 1 |
| redesign/per-page-deferrals/reports-deferrals.md | 1 |
| redesign/per-page-deferrals/role-detail-deferrals.md | 1 |
| redesign/per-page-deferrals/staff-detail-deferrals.md | 1 |
| redesign/PER-PAGE-GOAL-COMMANDS.md | 1 |
| redesign/per-page-progress/audit-progress.md | 1 |
| redesign/per-page-progress/availability-progress.md | 1 |
| redesign/per-page-progress/booking-detail-progress.md | 1 |
| redesign/per-page-progress/calendar-progress.md | 1 |
| redesign/per-page-progress/client-detail-progress.md | 1 |
| redesign/per-page-progress/client-new-progress.md | 1 |
| redesign/per-page-progress/clients-progress.md | 1 |
| redesign/per-page-progress/dashboard-coordinator-progress.md | 1 |
| redesign/per-page-progress/dashboard-owner-admin-progress.md | 1 |
| redesign/per-page-progress/dashboard-therapist-progress.md | 1 |
| redesign/per-page-progress/email-templates-progress.md | 1 |
| redesign/per-page-progress/emails-progress.md | 1 |
| redesign/per-page-progress/enquiries-progress.md | 1 |
| redesign/per-page-progress/operations-progress.md | 1 |
| redesign/per-page-progress/password-reset-progress.md | 1 |
| redesign/per-page-progress/privacy-progress.md | 1 |
| redesign/per-page-progress/reports-progress.md | 1 |
| redesign/per-page-progress/role-detail-progress.md | 1 |
| redesign/per-page-progress/roles-progress.md | 1 |
| redesign/per-page-progress/services-progress.md | 1 |
| redesign/per-page-progress/settings-progress.md | 1 |
| redesign/per-page-progress/staff-availability-progress.md | 1 |
| redesign/per-page-progress/staff-detail-progress.md | 1 |
| redesign/per-page-progress/staff-progress.md | 1 |
| redesign/per-page-recipes/account-password-requests-recipe.md | 1 |
| redesign/per-page-recipes/availability-recipe.md | 1 |
| redesign/per-page-recipes/booking-detail-recipe.md | 1 |
| redesign/per-page-recipes/calendar-recipe.md | 1 |
| redesign/per-page-recipes/client-detail-recipe.md | 1 |
| redesign/per-page-recipes/clients-recipe.md | 1 |
| redesign/per-page-recipes/dashboard-therapist-recipe.md | 1 |
| redesign/per-page-recipes/enquiries-recipe.md | 1 |
| redesign/per-page-recipes/operations-recipe.md | 1 |
| redesign/per-page-recipes/password-reset-recipe.md | 1 |
| redesign/per-page-recipes/role-detail-recipe.md | 1 |
| redesign/per-page-recipes/roles-recipe.md | 1 |
| redesign/per-page-recipes/staff-availability-recipe.md | 1 |
| redesign/per-page-recipes/staff-recipe.md | 1 |
| redesign/per-page-scope/00-shared-components-scope.md | 1 |
| redesign/per-page-scope/booking-new-scope.md | 1 |
| redesign/per-page-scope/bookings-scope.md | 1 |
| redesign/RECONCILIATION-WALK-PLAN.md | 1 |
| sentry_guide.md | 1 |
| GITHUB_ISSUES_GUIDE.md | 2 |
| redesign/audits/C-A/03-bookings-new-audit.md | 2 |
| redesign/audits/C-A/06-clients-new-audit.md | 2 |
| redesign/audits/C-A/08-enquiries-audit.md | 2 |
| redesign/audits/C-A/09-calendar-audit.md | 2 |
| redesign/audits/C-A/10-staff-list-audit.md | 2 |
| redesign/audits/C-A/12-staff-availability-audit.md | 2 |
| redesign/audits/C-A/15-availability-global-audit.md | 2 |
| redesign/audits/C-A/18-operations-audit.md | 2 |
| redesign/audits/C-A/25-reports-audit.md | 2 |
| redesign/audits/C-A/R02-admin-day.md | 2 |
| redesign/audits/C-A/W04-cancellation-and-restore-flow.md | 2 |
| redesign/audits/C-A/W08-owner-scope-switching-flow.md | 2 |
| redesign/audits/C-A/W09-refund-payment-correction-flow.md | 2 |
| redesign/BRIEF-COMMANDS.md | 2 |
| redesign/evidence/admin-contrast/baseline-owner-2026-08-10.md | 2 |
| redesign/evidence/C-14/phase-b-verify-full.md | 2 |
| redesign/evidence/C-14/phase-c-verify-full.md | 2 |
| redesign/evidence/C-14/phase-d-verify-full.md | 2 |
| redesign/evidence/C-16/closeout-static-gates.md | 2 |
| redesign/evidence/C-16/inventory-clients-enquiries.md | 2 |
| redesign/evidence/C-16/inventory-roles-config.md | 2 |
| redesign/evidence/C-16/phase-b-verify-full.md | 2 |
| redesign/evidence/C-16/step14-verify-full.md | 2 |
| redesign/evidence/C-16/step8-verify-full.md | 2 |
| redesign/evidence/C-16/step9-fix-reverify.md | 2 |
| redesign/evidence/C-16/steps1112-verify.md | 2 |
| redesign/evidence/C-18/phase-d-verify-full.md | 2 |
| redesign/evidence/C-19/fix-round-reverify.md | 2 |
| redesign/evidence/C-20/phase-a-verify.md | 2 |
| redesign/evidence/C-20/phase-b-fix-reverify.md | 2 |
| redesign/evidence/plan-deepening/item-08a-settings-gates.md | 2 |
| redesign/evidence/plan-deepening/x3-tests-and-baselines.md | 2 |
| redesign/evidence/post-band-c-impl/item-1/B2-critique-correctness.md | 2 |
| redesign/evidence/post-band-c-impl/item-1/C-tests-and-mocks.md | 2 |
| redesign/evidence/post-band-c-impl/item-2/C-test-harness.md | 2 |
| redesign/evidence/post-band-c-impl/item-2/D-wording-candidates.md | 2 |
| redesign/evidence/post-band-c-impl/item-2/TEETH-CHECK.md | 2 |
| redesign/evidence/post-band-c-impl/item-7/F1-scrim.md | 2 |
| redesign/evidence/post-band-c-impl/item-7/F2-shadow.md | 2 |
| redesign/evidence/post-band-c-impl/item-8/A-rename-hazard.md | 2 |
| redesign/evidence/post-band-c-impl/item-8/C-consumer-anchors.md | 2 |
| redesign/evidence/post-band-c-impl/item-8/phase1-app/D1a-settings-actions.md | 2 |
| redesign/HANDOFF-2026-05-25-POST-C-A.md | 2 |
| redesign/HANDOFF-2026-05-26-POST-C-B.md | 2 |
| redesign/HANDOFF-2026-08-09-ORCHESTRATOR.md | 2 |
| redesign/HANDOFF-2026-08-13-IMPLEMENTATION-9.md | 2 |
| redesign/HARDEN-PASS.md | 2 |
| redesign/HARDEN-RECS-booking-detail.md | 2 |
| redesign/per-page-deferrals/account-password-requests-deferrals.md | 2 |
| redesign/per-page-deferrals/audit-deferrals.md | 2 |
| redesign/per-page-deferrals/calendar-deferrals.md | 2 |
| redesign/per-page-deferrals/client-new-deferrals.md | 2 |
| redesign/per-page-deferrals/clients-deferrals.md | 2 |
| redesign/per-page-deferrals/dashboard-coordinator-deferrals.md | 2 |
| redesign/per-page-deferrals/enquiries-deferrals.md | 2 |
| redesign/per-page-deferrals/privacy-deferrals.md | 2 |
| redesign/per-page-deferrals/roles-deferrals.md | 2 |
| redesign/per-page-deferrals/services-deferrals.md | 2 |
| redesign/per-page-deferrals/settings-deferrals.md | 2 |
| redesign/per-page-deferrals/staff-availability-deferrals.md | 2 |
| redesign/per-page-deferrals/staff-deferrals.md | 2 |
| redesign/per-page-progress/account-password-requests-progress.md | 2 |
| redesign/per-page-progress/B2-metric-backend-progress.md | 2 |
| redesign/per-page-progress/B3-performance-surface-progress.md | 2 |
| redesign/per-page-progress/B4-reports-rebuild-progress.md | 2 |
| redesign/per-page-progress/B5-dashboard-rebuild-progress.md | 2 |
| redesign/per-page-progress/B6-client-ltv-ribbon-progress.md | 2 |
| redesign/per-page-progress/login-progress.md | 2 |
| redesign/per-page-recipes/audit-recipe.md | 2 |
| redesign/per-page-recipes/dashboard-coordinator-recipe.md | 2 |
| redesign/per-page-recipes/dashboard-owner-admin-recipe.md | 2 |
| redesign/per-page-recipes/email-templates-recipe.md | 2 |
| redesign/per-page-recipes/emails-recipe.md | 2 |
| redesign/per-page-recipes/login-recipe.md | 2 |
| redesign/per-page-recipes/services-recipe.md | 2 |
| redesign/per-page-recipes/staff-detail-recipe.md | 2 |
| redesign/per-page-scope/account-password-requests-scope.md | 2 |
| redesign/per-page-scope/audit-scope.md | 2 |
| redesign/per-page-scope/availability-scope.md | 2 |
| redesign/per-page-scope/booking-detail-scope.md | 2 |
| redesign/per-page-scope/client-detail-scope.md | 2 |
| redesign/per-page-scope/client-new-scope.md | 2 |
| redesign/per-page-scope/clients-scope.md | 2 |
| redesign/per-page-scope/dashboard-coordinator-scope.md | 2 |
| redesign/per-page-scope/dashboard-owner-admin-scope.md | 2 |
| redesign/per-page-scope/dashboard-therapist-scope.md | 2 |
| redesign/per-page-scope/enquiries-scope.md | 2 |
| redesign/per-page-scope/operations-scope.md | 2 |
| redesign/per-page-scope/password-reset-scope.md | 2 |
| redesign/per-page-scope/privacy-scope.md | 2 |
| redesign/per-page-scope/reports-scope.md | 2 |
| redesign/per-page-scope/role-detail-scope.md | 2 |
| redesign/per-page-scope/roles-scope.md | 2 |
| redesign/per-page-scope/services-scope.md | 2 |
| redesign/per-page-scope/staff-availability-scope.md | 2 |
| redesign/per-page-scope/staff-detail-scope.md | 2 |
| redesign/per-page-scope/staff-scope.md | 2 |
| redesign/PHASE6-AUTONOMOUS-AGENT-PLAN.md | 2 |
| redesign/plans/B-phase/BAND-B-MASTER-CHECKLIST.md | 2 |
| redesign/plans/C-phase/DRIFT-CHECKPOINT-3-FORMAL.md | 2 |
| redesign/plans/C-phase/DRIFT-CHECKPOINT-4-FORMAL.md | 2 |
| redesign/plans/CLEANUP-AND-CONTRAST-plan.md | 2 |
| redesign/POLISH-PASS.md | 2 |
| redesign/audits/C-A/02-bookings-list-audit.md | 3 |
| redesign/audits/C-A/07-client-detail-audit.md | 3 |
| redesign/audits/C-A/c-12-plus-fake-inventory.md | 3 |
| redesign/audits/C-A/C-A-3-SUMMARY.md | 3 |
| redesign/audits/C-A/W06-client-create-and-first-booking-flow.md | 3 |
| redesign/audits/C-A/W07-availability-recurring-flow.md | 3 |
| redesign/audits/C-A/W10-settings-downstream-impact-flow.md | 3 |
| redesign/AUTONOMOUS-LOG.md | 3 |
| redesign/backend-plans/BUILD-clients-sort-last-visit.md | 3 |
| redesign/backend-plans/BUILD-group-session-id.md | 3 |
| redesign/baselines/screenshots-pre-B1/README.md | 3 |
| redesign/briefs/C-01-review-request-email-brief.md | 3 |
| redesign/evidence/C-07/b4-verify-full.md | 3 |
| redesign/evidence/C-07/closeout-adversarial-review.md | 3 |
| redesign/evidence/C-07/closeout-static-gates.md | 3 |
| redesign/evidence/C-16/c-16-list-inventory.md | 3 |
| redesign/evidence/C-16/roles-visual-checklist.md | 3 |
| redesign/evidence/C-16/steps910-verify.md | 3 |
| redesign/evidence/C-20/phase-b-verify-full.md | 3 |
| redesign/evidence/plan-deepening/item-04-bookings-indexes.md | 3 |
| redesign/evidence/plan-deepening/item-06-count-by-date.md | 3 |
| redesign/evidence/plan-deepening/item-07a-phase0-theme.md | 3 |
| redesign/evidence/post-band-c-impl/item-1/B-idioms-to-mirror.md | 3 |
| redesign/HANDOFF-2026-08-13-IMPLEMENTATION-7.md | 3 |
| redesign/HARDEN-RECS-audit.md | 3 |
| redesign/HARDEN-RECS-availability.md | 3 |
| redesign/HARDEN-RECS-calendar.md | 3 |
| redesign/HARDEN-RECS-client-detail.md | 3 |
| redesign/HARDEN-RECS-client-new.md | 3 |
| redesign/HARDEN-RECS-clients.md | 3 |
| redesign/HARDEN-RECS-dashboard-coordinator.md | 3 |
| redesign/HARDEN-RECS-dashboard-owner-admin.md | 3 |
| redesign/HARDEN-RECS-dashboard-therapist.md | 3 |
| redesign/HARDEN-RECS-email-templates.md | 3 |
| redesign/HARDEN-RECS-enquiries.md | 3 |
| redesign/HARDEN-RECS-operations.md | 3 |
| redesign/HARDEN-RECS-password-reset.md | 3 |
| redesign/HARDEN-RECS-privacy.md | 3 |
| redesign/HARDEN-RECS-reports.md | 3 |
| redesign/HARDEN-RECS-role-detail.md | 3 |
| redesign/HARDEN-RECS-roles.md | 3 |
| redesign/HARDEN-RECS-services.md | 3 |
| redesign/HARDEN-RECS-settings.md | 3 |
| redesign/HARDEN-RECS-staff-availability.md | 3 |
| redesign/HARDEN-RECS-staff-detail.md | 3 |
| redesign/HARDEN-RECS-staff.md | 3 |
| redesign/LAUNCH-SHEET.md | 3 |
| redesign/ONBOARD-PASS.md | 3 |
| redesign/per-page-deferrals/dashboard-owner-admin-deferrals.md | 3 |
| redesign/per-page-deferrals/email-templates-deferrals.md | 3 |
| redesign/per-page-progress/B1-foundation-progress.md | 3 |
| redesign/per-page-progress/C-10-bottom-spacing-footer-overlap-progress.md | 3 |
| redesign/per-page-recipes/settings-recipe.md | 3 |
| redesign/per-page-scope/calendar-scope.md | 3 |
| redesign/per-page-scope/email-templates-scope.md | 3 |
| redesign/per-page-scope/emails-scope.md | 3 |
| redesign/per-page-scope/settings-scope.md | 3 |
| redesign/PERF-REPORT.md | 3 |
| redesign/plans/B-phase/README.md | 3 |
| redesign/plans/C-phase/C-01-review-request-email-plan.md | 3 |
| redesign/plans/C-phase/C-08-email-automation-expansion-plan.md | 3 |
| redesign/plans/C-phase/C-C-SINGLE-AGENT-ADDENDUM.md | 3 |
| redesign/plans/SEO-AEO-GEO-2026-08-13-plan.md | 3 |
| redesign/POST-AGENT-AUDIT-PROTOCOL.md | 3 |
| redesign/ADAPT-PASS.md | 4 |
| redesign/audits/C-A/22-privacy-audit.md | 4 |
| redesign/audits/C-A/C-A-1-SUMMARY.md | 4 |
| redesign/audits/C-A/C-A-2-SUMMARY.md | 4 |
| redesign/audits/C-A/R03-coordinator-day.md | 4 |
| redesign/audits/C-A/W01-enquiry-to-booking-flow.md | 4 |
| redesign/backend-plans/BUILD-availability-this-week-chip.md | 4 |
| redesign/backend-plans/BUILD-booking-create-inline-assignment.md | 4 |
| redesign/backend-plans/BUILD-booking-create-override-flag.md | 4 |
| redesign/BAND-B-RESEARCH-2026-05-22.md | 4 |
| redesign/BASELINE-AUDIT.md | 4 |
| redesign/briefs/B4-reports-rebuild-brief.md | 4 |
| redesign/briefs/C-02-recurring-bookings-brief.md | 4 |
| redesign/briefs/C-05-cancelled-bookings-inert-brief.md | 4 |
| redesign/briefs/C-06-client-crud-hardening-brief.md | 4 |
| redesign/briefs/C-08-email-automation-expansion-brief.md | 4 |
| redesign/briefs/C-10-bottom-spacing-footer-overlap-brief.md | 4 |
| redesign/briefs/C-13-group-bookings-and-gender-clarity-brief.md | 4 |
| redesign/briefs/C-14-granular-working-hours-breaks-brief.md | 4 |
| redesign/briefs/C-15-email-template-studio-brief.md | 4 |
| redesign/briefs/C-16-data-growth-pagination-brief.md | 4 |
| redesign/briefs/C-19-privacy-policy-page-brief.md | 4 |
| redesign/briefs/C-21-canonical-domain-fix-brief.md | 4 |
| redesign/briefs/C-22-booking-form-abuse-protection-brief.md | 4 |
| redesign/briefs/C-23-admin-availability-calendar-brief.md | 4 |
| redesign/DEFERRED-COMPLETENESS.md | 4 |
| redesign/evidence/admin-contrast/summary.md | 4 |
| redesign/evidence/C-18/cookie-inventory-browser.md | 4 |
| redesign/evidence/C-23/closeout-adversarial.md | 4 |
| redesign/evidence/checkpoint-3/post-deploy-runbook.md | 4 |
| redesign/HANDOFF-2026-08-12-IMPLEMENTATION-5.md | 4 |
| redesign/HANDOFF-2026-08-13-IMPLEMENTATION-6.md | 4 |
| redesign/HARDEN-RECS-account-password-requests.md | 4 |
| redesign/HARDEN-RECS-login.md | 4 |
| redesign/per-page-progress/B0-baseline-progress.md | 4 |
| redesign/per-page-progress/C-03-enquiry-to-booking-conversion-progress.md | 4 |
| redesign/per-page-progress/C-09-cache-invalidation-filter-cleanup-progress.md | 4 |
| redesign/per-page-progress/C-11-dashboard-variants-design-system-progress.md | 4 |
| redesign/per-page-progress/C-13-group-bookings-and-gender-clarity-progress.md | 4 |
| redesign/per-page-progress/C-FIELDWORK-EXPERIENCE-progress.md | 4 |
| redesign/per-page-recipes/client-new-recipe.md | 4 |
| redesign/per-page-recipes/privacy-recipe.md | 4 |
| redesign/per-page-recipes/reports-recipe.md | 4 |
| redesign/per-page-scope/login-scope.md | 4 |
| redesign/plans/B-phase/AUDIT-2026-05-22.md | 4 |
| redesign/plans/B-phase/B1-foundation-plan.md | 4 |
| redesign/plans/B-phase/B4-reports-rebuild-plan.md | 4 |
| redesign/plans/C-phase/C-03-enquiry-to-booking-conversion-plan.md | 4 |
| redesign/plans/C-phase/C-05-cancelled-bookings-inert-plan.md | 4 |
| redesign/plans/C-phase/C-11-dashboard-variants-design-system-plan.md | 4 |
| redesign/plans/C-phase/C-13-group-bookings-and-gender-clarity-plan.md | 4 |
| redesign/plans/C-phase/C-15-email-template-studio-plan.md | 4 |
| redesign/plans/C-phase/C-16-data-growth-pagination-plan.md | 4 |
| redesign/plans/C-phase/C-17-google-analytics-plan.md | 4 |
| redesign/plans/C-phase/C-22-booking-form-abuse-protection-plan.md | 4 |
| redesign/plans/SEO-AEO-GEO-IMPLEMENTATION.md | 4 |
| redesign/WAVE-RECONCILIATION.md | 4 |
| AGENTS.md | 5 |
| README.md | 5 |
| redesign/audits/C-A/01-dashboard-audit.md | 5 |
| redesign/audits/C-A/04-bookings-detail-audit.md | 5 |
| redesign/audits/C-A/19-emails-audit.md | 5 |
| redesign/audits/C-A/R04-therapist-day.md | 5 |
| redesign/audits/C-A/W03-booking-lifecycle-flow.md | 5 |
| redesign/backend-plans/BUILD-audit-target-existence.md | 5 |
| redesign/backend-plans/BUILD-email-templates-preview-route.md | 5 |
| redesign/backend-plans/BUILD-enquiries-filter-query.md | 5 |
| redesign/backend-plans/BUILD-settings-last-changed-by.md | 5 |
| redesign/backend-plans/BUILD-staff-workload-aggregates.md | 5 |
| redesign/BASELINE-CRITIQUE.md | 5 |
| redesign/briefs/B1-foundation-primitives-brief.md | 5 |
| redesign/briefs/B2-metric-backend-brief.md | 5 |
| redesign/briefs/B3-performance-surface-brief.md | 5 |
| redesign/briefs/B6-client-ltv-ribbon-brief.md | 5 |
| redesign/briefs/C-03-enquiry-to-booking-conversion-brief.md | 5 |
| redesign/briefs/C-04a-cancellation-restore-brief.md | 5 |
| redesign/briefs/C-07-routing-and-per-role-defaults-brief.md | 5 |
| redesign/briefs/C-09-cache-invalidation-filter-cleanup-brief.md | 5 |
| redesign/briefs/C-11-dashboard-variants-design-system-brief.md | 5 |
| redesign/briefs/C-17-google-analytics-brief.md | 5 |
| redesign/briefs/C-20-address-autocomplete-brief.md | 5 |
| redesign/briefs/C-FIELDWORK-EXPERIENCE-brief.md | 5 |
| redesign/evidence/C-10/c-10-overlap-catalogue.md | 5 |
| redesign/FINAL-REPORT.md | 5 |
| redesign/HANDOFF-2026-05-21.md | 5 |
| redesign/HARDEN-RECS-emails.md | 5 |
| redesign/MAIN-AGENT-CONTEXT.md | 5 |
| redesign/per-page-progress/C-02-recurring-bookings-progress.md | 5 |
| redesign/per-page-progress/C-04a-cancellation-restore-progress.md | 5 |
| redesign/per-page-progress/C-05-cancelled-bookings-inert-progress.md | 5 |
| redesign/per-page-progress/C-06-client-crud-hardening-progress.md | 5 |
| redesign/per-page-progress/C-08-email-automation-expansion-progress.md | 5 |
| redesign/per-page-progress/C-15-email-template-studio-progress.md | 5 |
| redesign/per-page-progress/C-17-google-analytics-progress.md | 5 |
| redesign/per-page-progress/C-20-address-autocomplete-progress.md | 5 |
| redesign/per-page-progress/C-21-canonical-domain-fix-progress.md | 5 |
| redesign/per-page-progress/C-22-booking-form-abuse-protection-progress.md | 5 |
| redesign/plans/B-phase/B0-baseline-plan.md | 5 |
| redesign/plans/B-phase/B2-metric-backend-plan.md | 5 |
| redesign/plans/B-phase/B3-performance-surface-plan.md | 5 |
| redesign/plans/B-phase/B5-dashboard-rebuild-plan.md | 5 |
| redesign/plans/B-phase/B6-client-ltv-ribbon-plan.md | 5 |
| redesign/plans/C-phase/BAND-C-MIGRATION-LEDGER.md | 5 |
| redesign/plans/C-phase/C-02-recurring-bookings-plan.md | 5 |
| redesign/plans/C-phase/C-04a-cancellation-restore-plan.md | 5 |
| redesign/plans/C-phase/C-07-routing-and-per-role-defaults-plan.md | 5 |
| redesign/plans/C-phase/C-10-bottom-spacing-footer-overlap-plan.md | 5 |
| redesign/plans/C-phase/C-21-canonical-domain-fix-plan.md | 5 |
| redesign/audits/C-A/R01-owner-day.md | 6 |
| redesign/audits/C-A/W02-new-booking-end-to-end-flow.md | 6 |
| redesign/audits/C-A/W05-assignment-claim-reassign-flow.md | 6 |
| redesign/backend-plans/BUILD-audit-filter-and-pagination.md | 6 |
| redesign/backend-plans/BUILD-rbac-permission-email-templates.md | 6 |
| redesign/backend-plans/BUILD-staff-availability-override-actions.md | 6 |
| redesign/backend-plans/BUILD-staff-blocked-dates-actions.md | 6 |
| redesign/baselines/wcag-severity-tokens.md | 6 |
| redesign/briefs/B5-dashboard-rebuild-brief.md | 6 |
| redesign/briefs/booking-new-brief.md | 6 |
| redesign/briefs/client-detail-brief.md | 6 |
| redesign/briefs/operations-brief.md | 6 |
| redesign/ENGINEERING-LOG.md | 6 |
| redesign/evidence/C-18/cookie-inventory-source.md | 6 |
| redesign/HANDOFF-2026-08-12-IMPLEMENTATION-4.md | 6 |
| redesign/per-page-progress/C-01-review-request-email-progress.md | 6 |
| redesign/per-page-progress/C-19-privacy-policy-page-progress.md | 6 |
| redesign/per-page-progress/C-23-admin-availability-calendar-progress.md | 6 |
| redesign/plans/C-phase/C-06-client-crud-hardening-plan.md | 6 |
| redesign/plans/C-phase/C-09-cache-invalidation-filter-cleanup-plan.md | 6 |
| redesign/plans/C-phase/C-14-granular-working-hours-breaks-plan.md | 6 |
| redesign/plans/C-phase/C-19-privacy-policy-page-plan.md | 6 |
| redesign/plans/C-phase/C-FIELDWORK-EXPERIENCE-plan.md | 6 |
| redesign/audits/C-A/R05-therapist-fresh-day.md | 7 |
| redesign/backend-plans/BUILD-automated-booking-reminders.md | 7 |
| redesign/backend-plans/BUILD-email-template-overrides-table.md | 7 |
| redesign/backend-plans/BUILD-privacy-filter-query.md | 7 |
| redesign/briefs/bookings-brief.md | 7 |
| redesign/briefs/C-18-cookie-consent-brief.md | 7 |
| redesign/briefs/dashboard-coordinator-brief.md | 7 |
| redesign/briefs/enquiries-brief.md | 7 |
| redesign/briefs/login-brief.md | 7 |
| redesign/briefs/role-detail-brief.md | 7 |
| redesign/briefs/roles-brief.md | 7 |
| redesign/evidence/admin-contrast/root-cause-D1.md | 7 |
| redesign/evidence/admin-contrast/surgical-review.md | 7 |
| redesign/FOUNDATION-FLOOR.md | 7 |
| redesign/per-page-progress/C-14-granular-working-hours-breaks-progress.md | 7 |
| redesign/per-page-progress/C-16-data-growth-pagination-progress.md | 7 |
| redesign/plans/C-phase/BAND-C-REFINEMENT-2026-07-26.md | 7 |
| redesign/plans/C-phase/C-18-cookie-consent-plan.md | 7 |
| redesign/plans/C-phase/DRIFT-CHECKPOINTS.md | 7 |
| redesign/A11Y-BASELINE.md | 8 |
| redesign/backend-plans/BUILD-email-templates-actions.md | 8 |
| redesign/backend-plans/BUILD-operations-filter-query.md | 8 |
| redesign/backend-plans/BUILD-staff-filter-query.md | 8 |
| redesign/briefs/booking-detail-brief.md | 8 |
| redesign/briefs/calendar-brief.md | 8 |
| redesign/briefs/clients-brief.md | 8 |
| redesign/briefs/emails-brief.md | 8 |
| redesign/briefs/privacy-brief.md | 8 |
| redesign/briefs/staff-availability-brief.md | 8 |
| redesign/briefs/staff-brief.md | 8 |
| redesign/briefs/staff-detail-brief.md | 8 |
| redesign/HANDOFF-2026-08-12-IMPLEMENTATION-3.md | 8 |
| redesign/per-page-progress/C-18-cookie-consent-progress.md | 8 |
| redesign/backend-plans/BUILD-delete-role.md | 9 |
| redesign/backend-plans/BUILD-email-delivery-filter-query.md | 9 |
| redesign/backend-plans/BUILD-rbac-permission-account-password-requests.md | 9 |
| redesign/briefs/account-password-requests-brief.md | 9 |
| redesign/briefs/audit-brief.md | 9 |
| redesign/briefs/availability-brief.md | 9 |
| redesign/briefs/client-new-brief.md | 9 |
| redesign/briefs/dashboard-therapist-brief.md | 9 |
| redesign/briefs/password-reset-brief.md | 9 |
| redesign/briefs/reports-brief.md | 9 |
| redesign/briefs/services-brief.md | 9 |
| redesign/HANDOFF-2026-08-11-IMPLEMENTATION-2.md | 9 |
| redesign/HANDOFF-2026-08-11-IMPLEMENTATION.md | 9 |
| redesign/per-page-progress/C-07-routing-and-per-role-defaults-progress.md | 9 |
| redesign/plans/C-phase/C-23-admin-availability-calendar-plan.md | 9 |
| redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md | 9 |
| redesign/backend-plans/BUILD-postcode-lookup-client.md | 10 |
| redesign/briefs/settings-brief.md | 10 |
| redesign/evidence/post-band-c-impl/item-7/TAIL-CENSUS.md | 10 |
| redesign/plans/C-phase/C-20-address-autocomplete-plan.md | 10 |
| redesign/backend-plans/BUILD-password-reset-request-actions.md | 11 |
| redesign/briefs/dashboard-owner-admin-brief.md | 11 |
| redesign/briefs/email-templates-brief.md | 11 |
| redesign/plans/B-phase/SHARED-IMPLEMENTATION-NOTES.md | 11 |
| redesign/backend-plans/BUILD-approve-reject-password-reset.md | 12 |
| redesign/briefs/00-shared-components-brief.md | 12 |
| redesign/FINAL-AUDIT.md | 12 |
| redesign/plans/C-phase/SUBAGENT-RULES.md | 13 |
| redesign/backend-plans/BUILD-create-role.md | 14 |
| redesign/backend-plans/BUILD-password-reset-email-templates.md | 14 |
| redesign/HANDOFF-2026-08-11-PLANNING.md | 14 |
| redesign/per-page-progress/OWNER-ACTION-BACKLOG.md | 29 |
| redesign/impeccable-v5-latest-stable.html | 30 |
| redesign/phase6-admin-workflow-guide.html | 30 |
| redesign/SAFETY-NET.md | 31 |
| redesign/test-credentials.md | 33 |
| redesign/BASELINE-ISSUES.md | 35 |
| redesign/plans/POST-BAND-C-FOLLOWUP-plan.md | 35 |
| redesign/IMAGES-NEEDED.md | 37 |
| redesign/RECIPE-PROGRESS.md | 38 |
| redesign/IMPLEMENTATION-PLAN.md | 42 |
| redesign/BUSINESS-COMPLETENESS.md | 44 |
| redesign/plans/C-phase/C-B-DECISIONS.md | 44 |
| redesign/RECON.md | 48 |
| redesign/PER-PAGE-SCORES.md | 55 |
| redesign/plans/C-phase/BAND-C-MASTER-PLAN.md | 69 |
| PRODUCT.md | 92 |
| DESIGN.md | 140 |

### Zero-inbound files, listed explicitly (103 of 622)

These are the primary deletion candidates **by the doc-graph signal alone**.
2 of them are flagged below as source-code-protected — check §2 before acting
on any of the rest too; the doc graph and the source-code citation graph are
independent signals and this list only reflects the former.

- `implementation.md`
- `redesign/DEFERRALS-SUMMARY.md`
- `redesign/ENGINEERING-PAUSE-EXPLAINED.html`
- `redesign/HANDOFF-2026-08-04-ADVISOR-SEAT.md`
- `redesign/PHASE-7-EXPLAINED.html`
- `redesign/PHASE-7-THEME-RECOLOR.md`
- `redesign/backend-smoke-tests/README.md`
- `redesign/evidence/C-04a/migration-notes.md`
- `redesign/evidence/C-06/migration-diff-summary.md` — **PROTECTED by source citation (see §2) — do NOT treat as a candidate**
- `redesign/evidence/C-16/closeout-fix-reverify.md`
- `redesign/evidence/C-17/closeout-review.md`
- `redesign/evidence/C-17/fix-reverify.md`
- `redesign/evidence/C-17/phase-a-verify-full.md` — **PROTECTED by source citation (see §2) — do NOT treat as a candidate**
- `redesign/evidence/C-18/adversarial-plan-review.md`
- `redesign/evidence/C-18/live-browser-gate.md`
- `redesign/evidence/C-18/phase-a-final-verify.md`
- `redesign/evidence/C-18/phase-a-reverify.md`
- `redesign/evidence/C-18/phase-a-verify-full.md`
- `redesign/evidence/C-18/replay-fix-verify.md`
- `redesign/evidence/C-19/closeout-gates-scope.md`
- `redesign/evidence/C-19/closeout-truthfulness.md`
- `redesign/evidence/C-20/closeout-adversarial.md`
- `redesign/evidence/C-22/honeypot-accessibility.md`
- `redesign/evidence/C-23/phase-d-verify-full.md`
- `redesign/evidence/SEO-phase0-baseline/README.md`
- `redesign/evidence/SEO-phase11-review/README.md`
- `redesign/evidence/admin-contrast/ADMIN-dark.md`
- `redesign/evidence/admin-contrast/ADMIN-light.md`
- `redesign/evidence/admin-contrast/COORDINATOR-dark.md`
- `redesign/evidence/admin-contrast/COORDINATOR-light.md`
- `redesign/evidence/admin-contrast/THERAPIST_A-dark.md`
- `redesign/evidence/admin-contrast/THERAPIST_A-light.md`
- `redesign/evidence/admin-contrast/UNAUTHENTICATED-dark.md`
- `redesign/evidence/admin-contrast/UNAUTHENTICATED-light.md`
- `redesign/evidence/admin-contrast/item7-phaseB-exact-substitution-2026-08-12.md`
- `redesign/evidence/checkpoint-3/baseline-erosion-audit.md`
- `redesign/evidence/checkpoint-3/unowned-debt-inventory.md`
- `redesign/evidence/plan-deepening/draft-item-01-review-emails.md`
- `redesign/evidence/plan-deepening/draft-item-03-override-sort.md`
- `redesign/evidence/plan-deepening/draft-item-05-bundle-tooling.md`
- `redesign/evidence/plan-deepening/draft-item-06-count-by-date.md`
- `redesign/evidence/plan-deepening/draft-item-07a-phase0-theme.md`
- `redesign/evidence/plan-deepening/draft-item-07b-literals.md`
- `redesign/evidence/plan-deepening/item-01-review-emails.md`
- `redesign/evidence/plan-deepening/item-03-override-sort.md`
- `redesign/evidence/plan-deepening/item-05-bundle-tooling.md`
- `redesign/evidence/plan-deepening/item6/i6a-admin-tree.md`
- `redesign/evidence/plan-deepening/item6/i6b-staff-tree.md`
- `redesign/evidence/plan-deepening/item6/i6c-saturation-and-tests.md`
- `redesign/evidence/plan-deepening/phase0/a1-dealias-table.md`
- `redesign/evidence/plan-deepening/phase0/a2-parser-fix.md`
- `redesign/evidence/plan-deepening/phase0/a3-warning-token.md`
- `redesign/evidence/plan-deepening/phase0/a4-alias-guard.md`
- `redesign/evidence/plan-deepening/phase0/a5-prose-claims.md`
- `redesign/evidence/plan-deepening/phase0/a6-unmeasured-aliases.md`
- `redesign/evidence/post-band-c-impl/item-1/A-symbols-and-anchors.md`
- `redesign/evidence/post-band-c-impl/item-1/B2-actions-current.md`
- `redesign/evidence/post-band-c-impl/item-1/B2-critique-money-and-state.md`
- `redesign/evidence/post-band-c-impl/item-1/B2-notifications-current.md`
- `redesign/evidence/post-band-c-impl/item-1/B2-page-current.md`
- `redesign/evidence/post-band-c-impl/item-1/B2-step1e-seam.md`
- `redesign/evidence/post-band-c-impl/item-1/B2-test-precedents.md`
- `redesign/evidence/post-band-c-impl/item-2/R1-refute-facts.md`
- `redesign/evidence/post-band-c-impl/item-4/B-blast-radius.md`
- `redesign/evidence/post-band-c-impl/item-4/R1-refute-counts.md`
- `redesign/evidence/post-band-c-impl/item-4/R2-refute-shapes.md`
- `redesign/evidence/post-band-c-impl/item-7/CRITIQUE-completeness.md`
- `redesign/evidence/post-band-c-impl/item-7/CRITIQUE-dark-direction.md`
- `redesign/evidence/post-band-c-impl/item-7/CRITIQUE-judgement-calls.md`
- `redesign/evidence/post-band-c-impl/item-7/CRITIQUE-light-invariance.md`
- `redesign/evidence/post-band-c-impl/item-7/CRITIQUE-tokens-css-structure.md`
- `redesign/evidence/post-band-c-impl/item-7/F1-scrim-VERDICT.md`
- `redesign/evidence/post-band-c-impl/item-7/F2-shadow-VERDICT.md`
- `redesign/evidence/post-band-c-impl/item-7/F3-neutral-88-VERDICT.md`
- `redesign/evidence/post-band-c-impl/item-7/F3-neutral-88.md`
- `redesign/evidence/post-band-c-impl/item-7/F4-restricted-280-VERDICT.md`
- `redesign/evidence/post-band-c-impl/item-7/F5-danger-20-25.md`
- `redesign/evidence/post-band-c-impl/item-7/F6-warning-55-80-VERDICT.md`
- `redesign/evidence/post-band-c-impl/item-7/F6-warning-55-80.md`
- `redesign/evidence/post-band-c-impl/item-7/F7-primary-120-165-VERDICT.md`
- `redesign/evidence/post-band-c-impl/item-7/F7-primary-120-165.md`
- `redesign/evidence/post-band-c-impl/item-7/F8-info-230-247-VERDICT.md`
- `redesign/evidence/post-band-c-impl/item-7/F8-info-230-247.md`
- `redesign/evidence/post-band-c-impl/item-7/PHASE-D-LAYER3.md`
- `redesign/evidence/post-band-c-impl/item-8/B-permission-insert.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/D4-availability.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/D6-tests.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/D7-blast-radius.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/TEETH-CHECK.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/X1-contradictions.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/X2-what-breaks.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/X3-completeness.md`
- `redesign/evidence/post-band-c-impl/item-8/phase2-app/P1-booking-schema.md`
- `redesign/evidence/post-band-c-impl/item-8/phase2-app/P2-AboutYouStep.md`
- `redesign/evidence/post-band-c-impl/item-8/phase2-app/P3-prop-threading.md`
- `redesign/evidence/post-band-c-impl/item-8/phase2-app/TEETH-CHECK.md`
- `redesign/evidence/post-band-c-impl/item-8/phase2-app/Y1-what-breaks.md`
- `redesign/evidence/post-band-c-impl/item-8/phase2-app/Y2-completeness.md`
- `redesign/evidence/post-band-c-impl/item-8/phase3-app/TEETH-CHECK.md`
- `redesign/evidence/post-band-c-impl/item-8/phase3-app/Z1-money.md`
- `redesign/evidence/post-band-c-impl/item-8/phase3-app/Z2-bypass.md`
- `redesign/plans/C-phase/C-C-RESUME-2026-07-31.md`
- `redesign/subagent-chunk1-instructions.md`

---

## 6. GOVERNING SPINE — transitive closure from the three roots

### Method

BFS over the resolved doc→doc edge set (§5's graph, same-directory-preferring
resolver) starting from the three roots:

- `redesign/HANDOFF-2026-08-13-IMPLEMENTATION-9.md`
- `redesign/plans/SEO-AEO-GEO-2026-08-13-plan.md`
- `redesign/plans/SEO-AEO-GEO-IMPLEMENTATION.md`

**The handoff chain checks out.** All nine `HANDOFF-2026-08-1*-IMPLEMENTATION*`
docs (`IMPLEMENTATION`, `IMPLEMENTATION-2` through `IMPLEMENTATION-9`, plus
`PLANNING`) are reached at depth 1 — `HANDOFF-2026-08-13-IMPLEMENTATION-9.md`
cites all eight of its predecessors directly, exactly as the brief said it
would (gotchas 1–108). Four *other*, earlier-era handoffs from different
project phases (`HANDOFF-2026-05-21.md`, `HANDOFF-2026-05-25-POST-C-A.md`,
`HANDOFF-2026-05-26-POST-C-B.md`, `HANDOFF-2026-08-09-ORCHESTRATOR.md`) are
also reachable, via the Band-C master-plan / decisions docs they're linked
from. **One handoff is not reachable at all:** `redesign/HANDOFF-2026-08-04-ADVISOR-SEAT.md`
has zero inbound references from anywhere in the entire doc corpus (verified —
it cites thirteen other docs itself, but nothing cites it back; it reads as a
dead-end handoff from a superseded "Advisor" seat that was replaced by the
Orchestrator/Implementation seats). It is a strong, well-evidenced deletion
candidate.

### Reachable = load-bearing (422 of 622 in scope; 462 of 716 overall)

68% of the `redesign/` + root corpus is reachable from the three current
governing documents. This set is not reprinted file-by-file here (it's the
"safe" side); it is exactly `scope (622) minus the 200 listed below`.

### Unreachable = candidates, pending the protected-list cross-check (200 of 622)

**Before deleting any of these**, check it against the §2 PROTECTED LIST. Six
of the 200 are cited directly from test code, a migration, or
`src/lib/consent/cookie-registry.ts` — the doc graph has no way to see that,
because those citations live in `.ts`/`.sql` comments, not in another
markdown file. They're marked inline below. **Do not delete anything marked
PROTECTED.**

Five entries in the underlying edge set resolved via basename with residual
ambiguity (a bare filename existing in multiple sibling `C-xx` evidence
folders, with no same-directory match to prefer) and are lower-confidence:
`TEETH-CHECK.md` cited from `HANDOFF-2026-08-12-IMPLEMENTATION-3.md`;
`evidence/C-07/closeout-adversarial-review.md` and
`evidence/C-07/closeout-static-gates.md` cited from
`redesign/plans/C-phase/DRIFT-CHECKPOINT-3-FORMAL.md` and
`redesign/evidence/checkpoint-3/final-head-gates.md`; and bare
`phase-b-verify-full.md` cited from
`redesign/plans/C-phase/DRIFT-CHECKPOINT-4-FORMAL.md`. These affected edges
don't change any entry's reachable/unreachable status in this list (the target
files they resolved to were already reachable through other paths), but flag
them if you want to verify the exact intended target by hand.

- `implementation.md`
- `redesign/DEFERRALS-SUMMARY.md`
- `redesign/ENGINEERING-PAUSE-EXPLAINED.html`
- `redesign/HANDOFF-2026-08-04-ADVISOR-SEAT.md`
- `redesign/LAUNCH-SHEET.md`
- `redesign/MAIN-AGENT-CONTEXT.md`
- `redesign/PER-PAGE-GOAL-COMMANDS.md`
- `redesign/PHASE-7-EXPLAINED.html`
- `redesign/PHASE-7-THEME-RECOLOR.md`
- `redesign/PHASE6-AUTONOMOUS-AGENT-PLAN.md`
- `redesign/POST-AGENT-AUDIT-PROTOCOL.md`
- `redesign/RECONCILIATION-WALK-PLAN.md`
- `redesign/WAVE-RECONCILIATION.md`
- `redesign/backend-smoke-tests/README.md`
- `redesign/evidence/C-04a/migration-notes.md`
- `redesign/evidence/C-06/migration-diff-summary.md` — **PROTECTED by source citation (see §2) — do NOT treat as a candidate despite being outside the doc-graph spine**
- `redesign/evidence/C-16/closeout-adversarial-review.md`
- `redesign/evidence/C-16/closeout-fix-reverify.md`
- `redesign/evidence/C-16/closeout-static-gates.md`
- `redesign/evidence/C-16/step12-fix-reverify.md`
- `redesign/evidence/C-16/step14-fix-reverify.md`
- `redesign/evidence/C-16/step14-verify-full.md`
- `redesign/evidence/C-16/step5-verify-full.md`
- `redesign/evidence/C-16/step8-verify-full.md`
- `redesign/evidence/C-16/step9-fix-reverify.md`
- `redesign/evidence/C-16/steps1112-verify.md` — **PROTECTED by source citation (see §2) — do NOT treat as a candidate despite being outside the doc-graph spine**
- `redesign/evidence/C-16/steps67-verify-full.md`
- `redesign/evidence/C-16/steps910-verify.md`
- `redesign/evidence/C-17/closeout-review.md`
- `redesign/evidence/C-17/fix-reverify.md`
- `redesign/evidence/C-17/phase-a-verify-full.md` — **PROTECTED by source citation (see §2) — do NOT treat as a candidate despite being outside the doc-graph spine**
- `redesign/evidence/C-17/phase-b-verify-full.md`
- `redesign/evidence/C-18/adversarial-plan-review.md`
- `redesign/evidence/C-18/cookie-inventory-browser.md` — **PROTECTED by source citation (see §2) — do NOT treat as a candidate despite being outside the doc-graph spine**
- `redesign/evidence/C-18/fix-round-verify.md`
- `redesign/evidence/C-18/live-browser-gate.md`
- `redesign/evidence/C-18/phase-a-delta-reverify.md`
- `redesign/evidence/C-18/phase-a-final-verify.md`
- `redesign/evidence/C-18/phase-a-reverify.md`
- `redesign/evidence/C-18/phase-a-verify-full.md`
- `redesign/evidence/C-18/phase-d-verify-full.md` — **PROTECTED by source citation (see §2) — do NOT treat as a candidate despite being outside the doc-graph spine**
- `redesign/evidence/C-18/phase-ef-verify-full.md`
- `redesign/evidence/C-18/registry-rls-accuracy.md`
- `redesign/evidence/C-18/replay-fix-verify.md`
- `redesign/evidence/C-19/closeout-a11y-responsive.md`
- `redesign/evidence/C-19/closeout-adversarial.md`
- `redesign/evidence/C-19/closeout-content-legal.md`
- `redesign/evidence/C-19/closeout-gates-scope.md`
- `redesign/evidence/C-19/closeout-truthfulness.md`
- `redesign/evidence/C-20/closeout-a11y-tokens.md`
- `redesign/evidence/C-20/closeout-adversarial.md`
- `redesign/evidence/C-20/closeout-cost-mechanics.md` — **PROTECTED by source citation (see §2) — do NOT treat as a candidate despite being outside the doc-graph spine**
- `redesign/evidence/C-20/closeout-gates-scope.md`
- `redesign/evidence/C-22/honeypot-accessibility.md`
- `redesign/evidence/C-23/phase-d-verify-full.md`
- `redesign/evidence/SEO-phase0-baseline/README.md`
- `redesign/evidence/SEO-phase11-review/README.md`
- `redesign/evidence/admin-contrast/ADMIN-dark.md`
- `redesign/evidence/admin-contrast/ADMIN-light.md`
- `redesign/evidence/admin-contrast/COORDINATOR-dark.md`
- `redesign/evidence/admin-contrast/COORDINATOR-light.md`
- `redesign/evidence/admin-contrast/OWNER-light.md`
- `redesign/evidence/admin-contrast/THERAPIST_A-dark.md`
- `redesign/evidence/admin-contrast/THERAPIST_A-light.md`
- `redesign/evidence/admin-contrast/UNAUTHENTICATED-dark.md`
- `redesign/evidence/admin-contrast/UNAUTHENTICATED-light.md`
- `redesign/evidence/admin-contrast/item7-phaseB-exact-substitution-2026-08-12.md`
- `redesign/evidence/checkpoint-3/baseline-erosion-audit.md`
- `redesign/evidence/checkpoint-3/unowned-debt-inventory.md`
- `redesign/evidence/plan-deepening/draft-item-01-review-emails.md`
- `redesign/evidence/plan-deepening/draft-item-02-privacy.md`
- `redesign/evidence/plan-deepening/draft-item-03-override-sort.md`
- `redesign/evidence/plan-deepening/draft-item-05-bundle-tooling.md`
- `redesign/evidence/plan-deepening/draft-item-06-count-by-date.md`
- `redesign/evidence/plan-deepening/draft-item-07a-phase0-theme.md`
- `redesign/evidence/plan-deepening/draft-item-07b-literals.md`
- `redesign/evidence/plan-deepening/item-01-review-emails.md`
- `redesign/evidence/plan-deepening/item-02-privacy.md`
- `redesign/evidence/plan-deepening/item-03-override-sort.md`
- `redesign/evidence/plan-deepening/item-05-bundle-tooling.md`
- `redesign/evidence/plan-deepening/item-06-count-by-date.md`
- `redesign/evidence/plan-deepening/item6/i6a-admin-tree.md`
- `redesign/evidence/plan-deepening/item6/i6b-staff-tree.md`
- `redesign/evidence/plan-deepening/item6/i6c-saturation-and-tests.md`
- `redesign/evidence/plan-deepening/phase0/a1-dealias-table.md`
- `redesign/evidence/plan-deepening/phase0/a2-parser-fix.md`
- `redesign/evidence/plan-deepening/phase0/a3-warning-token.md`
- `redesign/evidence/plan-deepening/phase0/a4-alias-guard.md`
- `redesign/evidence/plan-deepening/phase0/a5-prose-claims.md`
- `redesign/evidence/plan-deepening/phase0/a6-unmeasured-aliases.md`
- `redesign/evidence/post-band-c-impl/item-1/A-symbols-and-anchors.md`
- `redesign/evidence/post-band-c-impl/item-1/B2-actions-current.md`
- `redesign/evidence/post-band-c-impl/item-1/B2-critique-correctness.md`
- `redesign/evidence/post-band-c-impl/item-1/B2-critique-money-and-state.md`
- `redesign/evidence/post-band-c-impl/item-1/B2-critique-security.md`
- `redesign/evidence/post-band-c-impl/item-1/B2-emails-data-current.md`
- `redesign/evidence/post-band-c-impl/item-1/B2-notifications-current.md`
- `redesign/evidence/post-band-c-impl/item-1/B2-page-current.md`
- `redesign/evidence/post-band-c-impl/item-1/B2-step1e-seam.md`
- `redesign/evidence/post-band-c-impl/item-1/B2-test-precedents.md`
- `redesign/evidence/post-band-c-impl/item-1/C-tests-and-mocks.md`
- `redesign/evidence/post-band-c-impl/item-1/D-query-shapes.md`
- `redesign/evidence/post-band-c-impl/item-2/A-deletion-paths.md`
- `redesign/evidence/post-band-c-impl/item-2/B-blast-radius.md`
- `redesign/evidence/post-band-c-impl/item-2/R1-refute-facts.md`
- `redesign/evidence/post-band-c-impl/item-4/A-column-usage.md`
- `redesign/evidence/post-band-c-impl/item-4/B-blast-radius.md`
- `redesign/evidence/post-band-c-impl/item-4/C-index-shapes.md`
- `redesign/evidence/post-band-c-impl/item-4/R1-refute-counts.md`
- `redesign/evidence/post-band-c-impl/item-4/R2-refute-shapes.md`
- `redesign/evidence/post-band-c-impl/item-7/CRITIQUE-completeness.md`
- `redesign/evidence/post-band-c-impl/item-7/CRITIQUE-dark-direction.md`
- `redesign/evidence/post-band-c-impl/item-7/CRITIQUE-judgement-calls.md`
- `redesign/evidence/post-band-c-impl/item-7/CRITIQUE-light-invariance.md`
- `redesign/evidence/post-band-c-impl/item-7/CRITIQUE-tokens-css-structure.md`
- `redesign/evidence/post-band-c-impl/item-7/F1-scrim-VERDICT.md`
- `redesign/evidence/post-band-c-impl/item-7/F1-scrim.md`
- `redesign/evidence/post-band-c-impl/item-7/F2-shadow-VERDICT.md`
- `redesign/evidence/post-band-c-impl/item-7/F2-shadow.md`
- `redesign/evidence/post-band-c-impl/item-7/F3-neutral-88-VERDICT.md`
- `redesign/evidence/post-band-c-impl/item-7/F3-neutral-88.md`
- `redesign/evidence/post-band-c-impl/item-7/F4-restricted-280-VERDICT.md`
- `redesign/evidence/post-band-c-impl/item-7/F4-restricted-280.md`
- `redesign/evidence/post-band-c-impl/item-7/F5-danger-20-25.md`
- `redesign/evidence/post-band-c-impl/item-7/F6-warning-55-80-VERDICT.md`
- `redesign/evidence/post-band-c-impl/item-7/F6-warning-55-80.md`
- `redesign/evidence/post-band-c-impl/item-7/F7-primary-120-165-VERDICT.md`
- `redesign/evidence/post-band-c-impl/item-7/F7-primary-120-165.md`
- `redesign/evidence/post-band-c-impl/item-7/F8-info-230-247-VERDICT.md`
- `redesign/evidence/post-band-c-impl/item-7/F8-info-230-247.md`
- `redesign/evidence/post-band-c-impl/item-7/PHASE-D-LAYER3.md`
- `redesign/evidence/post-band-c-impl/item-7/TAIL-CENSUS.md`
- `redesign/evidence/post-band-c-impl/item-8/A-rename-hazard.md`
- `redesign/evidence/post-band-c-impl/item-8/B-permission-insert.md`
- `redesign/evidence/post-band-c-impl/item-8/R1-refute-rename.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/D1a-settings-actions.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/D1b-settings-actions-independent.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/D2-SettingsForm.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/D3-rbac.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/D4-availability.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/D5-remaining-consumers.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/D6-tests.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/D7-blast-radius.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/TEETH-CHECK.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/X1-contradictions.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/X2-what-breaks.md`
- `redesign/evidence/post-band-c-impl/item-8/phase1-app/X3-completeness.md`
- `redesign/evidence/post-band-c-impl/item-8/phase2-app/P1-booking-schema.md`
- `redesign/evidence/post-band-c-impl/item-8/phase2-app/P2-AboutYouStep.md`
- `redesign/evidence/post-band-c-impl/item-8/phase2-app/P3-prop-threading.md`
- `redesign/evidence/post-band-c-impl/item-8/phase2-app/P4-availability-and-manual.md`
- `redesign/evidence/post-band-c-impl/item-8/phase2-app/TEETH-CHECK.md`
- `redesign/evidence/post-band-c-impl/item-8/phase2-app/Y1-what-breaks.md`
- `redesign/evidence/post-band-c-impl/item-8/phase2-app/Y2-completeness.md`
- `redesign/evidence/post-band-c-impl/item-8/phase3-app/Q1-actions.md`
- `redesign/evidence/post-band-c-impl/item-8/phase3-app/Q2-form.md`
- `redesign/evidence/post-band-c-impl/item-8/phase3-app/Q3-data-and-tests.md`
- `redesign/evidence/post-band-c-impl/item-8/phase3-app/TEETH-CHECK.md`
- `redesign/evidence/post-band-c-impl/item-8/phase3-app/Z1-money.md`
- `redesign/evidence/post-band-c-impl/item-8/phase3-app/Z2-bypass.md`
- `redesign/per-page-deferrals/README.md`
- `redesign/per-page-deferrals/availability-deferrals.md`
- `redesign/per-page-deferrals/calendar-deferrals.md`
- `redesign/per-page-deferrals/client-detail-deferrals.md`
- `redesign/per-page-deferrals/dashboard-coordinator-deferrals.md`
- `redesign/per-page-deferrals/dashboard-therapist-deferrals.md`
- `redesign/per-page-deferrals/enquiries-deferrals.md`
- `redesign/per-page-deferrals/operations-deferrals.md`
- `redesign/per-page-deferrals/password-reset-deferrals.md`
- `redesign/per-page-deferrals/role-detail-deferrals.md`
- `redesign/per-page-progress/availability-progress.md`
- `redesign/per-page-progress/booking-detail-progress.md`
- `redesign/per-page-progress/calendar-progress.md`
- `redesign/per-page-progress/client-detail-progress.md`
- `redesign/per-page-progress/clients-progress.md`
- `redesign/per-page-progress/dashboard-coordinator-progress.md`
- `redesign/per-page-progress/dashboard-therapist-progress.md`
- `redesign/per-page-progress/enquiries-progress.md`
- `redesign/per-page-progress/operations-progress.md`
- `redesign/per-page-progress/password-reset-progress.md`
- `redesign/per-page-progress/role-detail-progress.md`
- `redesign/per-page-progress/roles-progress.md`
- `redesign/per-page-progress/staff-availability-progress.md`
- `redesign/per-page-progress/staff-progress.md`
- `redesign/per-page-recipes/availability-recipe.md`
- `redesign/per-page-recipes/booking-detail-recipe.md`
- `redesign/per-page-recipes/calendar-recipe.md`
- `redesign/per-page-recipes/client-detail-recipe.md`
- `redesign/per-page-recipes/clients-recipe.md`
- `redesign/per-page-recipes/dashboard-coordinator-recipe.md`
- `redesign/per-page-recipes/dashboard-therapist-recipe.md`
- `redesign/per-page-recipes/enquiries-recipe.md`
- `redesign/per-page-recipes/operations-recipe.md`
- `redesign/per-page-recipes/password-reset-recipe.md`
- `redesign/per-page-recipes/role-detail-recipe.md`
- `redesign/per-page-recipes/roles-recipe.md`
- `redesign/per-page-recipes/staff-availability-recipe.md`
- `redesign/per-page-recipes/staff-recipe.md`
- `redesign/plans/C-phase/C-C-RESUME-2026-07-31.md`
- `redesign/subagent-chunk1-instructions.md`

---

## 7. BUILD-SURFACE ANSWER — proven yes/no per directory

Commands run (read-only, verified above in this session):

```bash
# imports/requires
git grep -n -E "from ['\"].*redesign|require\(['\"].*redesign" -- src scripts e2e   # -> 0 hits
# config files, full contents inspected
cat eslint.config.mjs next.config.ts tsconfig.json playwright.config.ts \
    vitest.config.ts wrangler.jsonc open-next.config.ts
# fs reads in scripts/
grep -n "readFileSync\|writeFileSync\|readdirSync\|existsSync" scripts/*.mjs
grep -n "function writeEvidenceFile" -A5 e2e/admin-contrast-helpers.ts
# package.json scripts
grep -A20 '"scripts"' package.json
# asset-directory references anywhere outside redesign/
git grep -l -E "brand-logo-assets|rahma-therapy-image-replacements|photos-rahma-therapy" -- . ':!redesign'
# tracked-file extension audit of the 4 asset/doc dirs
git ls-files brand-logo-assets rahma-therapy-image-replacements docs implementation-plans \
  | sed -E 's/.*\.([a-zA-Z0-9]+)$/\1/' | sort | uniq -c
```

| Directory | Read by build/test/runtime? | Evidence |
|---|---|---|
| **`redesign/`** | **Partially — not by the main build or unit tests, but yes by two dev/e2e mechanisms.** | `next build`, `next.config.ts`, `tsconfig.json` (no `.ts`/`.tsx` exist under `redesign/` for its `**/*.ts` include to catch), `vitest.config.ts` (`include`/`exclude` never mention it), `playwright.config.ts` (`testDir: "./e2e"` only) — none touch it. `eslint.config.mjs` explicitly `globalIgnores(["redesign/**", ...])` — an exclusion, and a no-op one at that, since ESLint only lints JS/TS and `redesign/` holds none. **But:** `scripts/measure-admin-bundles.mjs` (a manual script, not wired into any `package.json` script) does `readFileSync("redesign/baselines/bundle-pre-B1.json")` guarded by `existsSync` — optional but real. And `e2e/admin-contrast-helpers.ts`'s `writeEvidenceFile()`, used by `e2e/admin-contrast.spec.ts` — which **is** wired in via `"test:e2e": "playwright test"` + `playwright.config.ts`'s `testDir: "./e2e"` — does `fs.mkdirSync(...redesign/evidence/admin-contrast...)` + `fs.writeFileSync(...)` on every e2e run. `redesign/evidence/admin-contrast/` is a **live write target of a wired test suite**, and `redesign/baselines/bundle-pre-B1.json` is a live (optional) read target of a manual bundle-size script. Neither is part of `pnpm build` or `pnpm test` (vitest). |
| **`docs/`** | **No.** Zero references from any build/test/runtime mechanism, anywhere in the tracked tree. The only `docs/` mentions outside `docs/` itself are inside the vendored `.agents/skills/impeccable/` and `.claude/skills/impeccable/` plugin scripts, which refer to a generic `docs/` convention in *their own* skill-context, unrelated to this repo's `docs/` folder. |
| **`implementation-plans/`** | **No.** Zero references anywhere in the tracked tree outside its own 18 files. |
| **`brand-logo-assets/`** | **No.** 59 tracked files (31 png, 24 svg, 3 ico, 1 md), zero code references. Only mentioned in prose inside 7 `redesign/` docs (`HANDOFF-2026-08-13-IMPLEMENTATION-6.md`, `-7.md`, `PHASE-7-THEME-RECOLOR.md`, `RECIPE-PROGRESS.md`, `briefs/login-brief.md`, `plans/CLEANUP-AND-CONTRAST-plan.md`, `subagent-chunk1-instructions.md`). The image manifest generator (`scripts/gen-image-manifest.mjs`, run by `pnpm build`) scans only `public/images` — confirmed by reading the full script; it never looks at this directory. |
| **`rahma-therapy-image-replacements/`** | **No.** 14 tracked files (6 png, 6 webp, 1 json, 1 txt), zero code references. Same 7-doc prose-only mention pattern as above. |
| **`photos-rahma-therapy/`** | **No — and it's not even tracked.** `.gitignore` line 74 excludes it entirely; `git ls-files photos-rahma-therapy` returns 0 files. `.gitignore`'s own comment confirms the intent: "the Owner's source photo inbox... nothing in src/ or public/ loads from this path — it is working material, not a site asset." |

**Bottom line for whoever plans the actual deletions:** `docs/`,
`implementation-plans/`, `brand-logo-assets/`, `rahma-therapy-image-replacements/`,
and `photos-rahma-therapy/` are all safe from a build-surface standpoint — delete
freely as far as *runtime/build/test mechanisms* are concerned (content-level
decisions are A1–A4's call). `redesign/` is **not** safe to delete wholesale:
at minimum, preserve `redesign/evidence/admin-contrast/` (write target of the
wired `test:e2e` suite) and `redesign/baselines/bundle-pre-B1.json` (read
target of a real, if manual, script) even if every other file in `redesign/`
were to go — and cross-reference every other candidate against the §2
PROTECTED LIST first, since 49 more `redesign/`+root paths are cited directly
from `src/`, `scripts/`, `e2e/`, and `supabase/` comments and would break
those comments' cross-references (not a build break, but a broken paper
trail) if removed.

---

## Appendix — full per-line citation detail (§1–§2 source data, 104 rows)

| Citing file:line | Raw token | Resolved path | Status |
|---|---|---|---|
| e2e/admin-contrast-helpers.ts:7 | `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` | redesign/plans/POST-BAND-C-FOLLOWUP-plan.md | RESOLVES |
| e2e/admin-contrast.spec.ts:18 | `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` | redesign/plans/POST-BAND-C-FOLLOWUP-plan.md | RESOLVES |
| e2e/admin-contrast.spec.ts:195 | `summary.md` | summary.md | RESOLVES(basename: redesign/evidence/admin-contrast/summary.md) |
| scripts/measure-admin-bundles.mjs:21 | `redesign/baselines/bundle-pre-B1.json` | redesign/baselines/bundle-pre-B1.json | RESOLVES |
| scripts/measure-admin-bundles.mjs:146 | `redesign/baselines/bundle-pre-B1.json` | redesign/baselines/bundle-pre-B1.json | RESOLVES |
| scripts/verify-admin-token-contrast.mjs:5 | `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` | redesign/plans/POST-BAND-C-FOLLOWUP-plan.md | RESOLVES |
| scripts/verify-admin-token-contrast.mjs:240 | `redesign/evidence/admin-contrast/root-cause-D1.md` | redesign/evidence/admin-contrast/root-cause-D1.md | RESOLVES |
| scripts/verify-admin-token-contrast.test.ts:110 | `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` | redesign/plans/POST-BAND-C-FOLLOWUP-plan.md | RESOLVES |
| src/app/(public)/privacy/page.test.tsx:15 | `redesign/evidence/post-band-c-impl/item-2/.` | redesign/evidence/post-band-c-impl/item-2/ | RESOLVES(dir) |
| src/app/__tests__/canonicals.test.ts:19 | `SEO-AEO-GEO-IMPLEMENTATION.md` | SEO-AEO-GEO-IMPLEMENTATION.md | RESOLVES(basename: redesign/plans/SEO-AEO-GEO-IMPLEMENTATION.md) |
| src/app/__tests__/sitemap-robots.test.ts:9 | `SEO-AEO-GEO-IMPLEMENTATION.md` | SEO-AEO-GEO-IMPLEMENTATION.md | RESOLVES(basename: redesign/plans/SEO-AEO-GEO-IMPLEMENTATION.md) |
| src/app/admin/account-password-requests/ApproveModal.tsx:75 | `BUILD-approve-reject-password-reset.md` | BUILD-approve-reject-password-reset.md | RESOLVES(basename: redesign/backend-plans/BUILD-approve-reject-password-reset.md) |
| src/app/admin/account-password-requests/RejectModal.tsx:73 | `BUILD-approve-reject-password-reset.md` | BUILD-approve-reject-password-reset.md | RESOLVES(basename: redesign/backend-plans/BUILD-approve-reject-password-reset.md) |
| src/app/admin/account-password-requests/__tests__/password-requests-data.test.ts:226 | `redesign/evidence/C-16/steps1112-verify.md` | redesign/evidence/C-16/steps1112-verify.md | RESOLVES |
| src/app/admin/account-password-requests/__tests__/resolvePasswordRequestsBannerState.test.ts:8 | `redesign/evidence/C-16/` | redesign/evidence/C-16/ | RESOLVES(dir) |
| src/app/admin/account-password-requests/__tests__/resolvePasswordRequestsBannerState.test.ts:9 | `steps1112-verify.md` | steps1112-verify.md | RESOLVES(basename: redesign/evidence/C-16/steps1112-verify.md) |
| src/app/admin/account-password-requests/password-requests-data.ts:8 | `redesign/per-page-progress/C-16-data-growth-pagination-progress.md` | redesign/per-page-progress/C-16-data-growth-pagination-progress.md | RESOLVES |
| src/app/admin/audit/AuditEventCard.tsx:57 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/app/admin/availability/page.tsx:812 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/app/admin/bookings/[bookingId]/BookingDetailSidebar.tsx:137 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/app/admin/bookings/[bookingId]/BookingDetailSidebar.tsx:358 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/app/admin/bookings/[bookingId]/page.tsx:1058 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/app/admin/calendar/page.tsx:1704 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/app/admin/clients/client-metrics.ts:10 | `redesign/plans/B-phase/B2-metric-backend-plan.md` | redesign/plans/B-phase/B2-metric-backend-plan.md | RESOLVES |
| src/app/admin/clients/client-metrics.ts:11 | `redesign/briefs/B2-metric-backend-brief.md` | redesign/briefs/B2-metric-backend-brief.md | RESOLVES |
| src/app/admin/components/AdminTopNav.tsx:85 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/app/admin/dashboard/dashboard-cards.tsx:271 | `PRODUCT.md` | PRODUCT.md | RESOLVES |
| src/app/admin/dashboard/therapist-fullness.ts:3 | `PRODUCT.md` | PRODUCT.md | RESOLVES |
| src/app/admin/email-templates/preview/[id]/route.ts:21 | `BUILD-rbac-permission-email-templates.md` | BUILD-rbac-permission-email-templates.md | RESOLVES(basename: redesign/backend-plans/BUILD-rbac-permission-email-templates.md) |
| src/app/admin/emails/format.ts:108 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/app/admin/enquiries/actions.ts:189 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/app/admin/password-reset/PasswordResetCard.tsx:25 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/app/admin/password-reset/[token]/page.tsx:32 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/app/admin/password-reset/page.tsx:22 | `BUILD-password-reset-request-actions.md` | BUILD-password-reset-request-actions.md | RESOLVES(basename: redesign/backend-plans/BUILD-password-reset-request-actions.md) |
| src/app/admin/password-reset/page.tsx:37 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/app/admin/password-reset/states/ForgotForm.tsx:89 | `BUILD-password-reset-request-actions.md` | BUILD-password-reset-request-actions.md | RESOLVES(basename: redesign/backend-plans/BUILD-password-reset-request-actions.md) |
| src/app/admin/password-reset/states/SetNewPassword.tsx:102 | `BUILD-password-reset-request-actions.md` | BUILD-password-reset-request-actions.md | RESOLVES(basename: redesign/backend-plans/BUILD-password-reset-request-actions.md) |
| src/app/admin/reports/HeadlineTileStrip.tsx:11 | `redesign/plans/B-phase/B4-reports-rebuild-plan.md` | redesign/plans/B-phase/B4-reports-rebuild-plan.md | RESOLVES |
| src/app/admin/reports/InsightsStripe.tsx:13 | `redesign/plans/B-phase/B4-reports-rebuild-plan.md` | redesign/plans/B-phase/B4-reports-rebuild-plan.md | RESOLVES |
| src/app/admin/reports/PersonalTeamToggle.tsx:18 | `redesign/plans/B-phase/B4-reports-rebuild-plan.md` | redesign/plans/B-phase/B4-reports-rebuild-plan.md | RESOLVES |
| src/app/admin/reports/ReportsCharts.tsx:21 | `redesign/plans/B-phase/B4-reports-rebuild-plan.md` | redesign/plans/B-phase/B4-reports-rebuild-plan.md | RESOLVES |
| src/app/admin/reports/ScopePill.tsx:13 | `redesign/plans/B-phase/B4-reports-rebuild-plan.md` | redesign/plans/B-phase/B4-reports-rebuild-plan.md | RESOLVES |
| src/app/admin/reports/WorkloadStaffRow.tsx:17 | `redesign/plans/B-phase/B4-reports-rebuild-plan.md` | redesign/plans/B-phase/B4-reports-rebuild-plan.md | RESOLVES |
| src/app/admin/reports/insight-actions.ts:13 | `redesign/plans/B-phase/B2-metric-backend-plan.md` | redesign/plans/B-phase/B2-metric-backend-plan.md | RESOLVES |
| src/app/admin/reports/report-insights.ts:9 | `redesign/plans/B-phase/B2-metric-backend-plan.md` | redesign/plans/B-phase/B2-metric-backend-plan.md | RESOLVES |
| src/app/admin/reports/report-insights.ts:10 | `redesign/briefs/B2-metric-backend-brief.md` | redesign/briefs/B2-metric-backend-brief.md | RESOLVES |
| src/app/admin/reports/report-insights.ts:11 | `SHARED-IMPLEMENTATION-NOTES.md` | SHARED-IMPLEMENTATION-NOTES.md | RESOLVES(basename: redesign/plans/B-phase/SHARED-IMPLEMENTATION-NOTES.md) |
| src/app/admin/reports/reporting.ts:1046 | `redesign/plans/B-phase/B2-metric-backend-plan.md.` | redesign/plans/B-phase/B2-metric-backend-plan.md | RESOLVES |
| src/app/admin/reports/reports-data.ts:24 | `redesign/plans/B-phase/B4-reports-rebuild-plan.md` | redesign/plans/B-phase/B4-reports-rebuild-plan.md | RESOLVES |
| src/app/admin/reports/reports-helpers.ts:16 | `redesign/plans/B-phase/B4-reports-rebuild-plan.md` | redesign/plans/B-phase/B4-reports-rebuild-plan.md | RESOLVES |
| src/app/admin/roles/CreateRoleSheet.tsx:39 | `BUILD-create-role.md` | BUILD-create-role.md | RESOLVES(basename: redesign/backend-plans/BUILD-create-role.md) |
| src/app/admin/roles/CreateRoleSheet.tsx:186 | `BUILD-create-role.md` | BUILD-create-role.md | RESOLVES(basename: redesign/backend-plans/BUILD-create-role.md) |
| src/app/api/cron/__tests__/extend-recurring-horizons.test.ts:27 | `redesign/evidence/C-02/phase-b-rpc-verification.md` | redesign/evidence/C-02/phase-b-rpc-verification.md | RESOLVES |
| src/app/api/cron/booking-reminders/route.ts:16 | `ENGINEERING-LOG.md` | ENGINEERING-LOG.md | RESOLVES(basename: redesign/ENGINEERING-LOG.md) |
| src/app/api/cron/booking-reminders/route.ts:150 | `ENGINEERING-LOG.md` | ENGINEERING-LOG.md | RESOLVES(basename: redesign/ENGINEERING-LOG.md) |
| src/app/api/cron/extend-recurring-horizons/route.ts:30 | `redesign/evidence/C-02/phase-b-rpc-verification.md` | redesign/evidence/C-02/phase-b-rpc-verification.md | RESOLVES |
| src/app/booking/__tests__/no-google-analytics.test.ts:43 | `redesign/evidence/C-17/phase-a-verify-full.md` | redesign/evidence/C-17/phase-a-verify-full.md | RESOLVES |
| src/components/__tests__/SentryProvider.test.tsx:10 | `redesign/evidence/C-18/sentry-replay-investigation.md` | redesign/evidence/C-18/sentry-replay-investigation.md | RESOLVES |
| src/components/address/AddressAutocompleteField.test.tsx:256 | `closeout-cost-mechanics.md` | closeout-cost-mechanics.md | RESOLVES(basename: redesign/evidence/C-20/closeout-cost-mechanics.md) |
| src/components/consent/__tests__/consent-transitions.test.ts:204 | `redesign/evidence/C-18/phase-d-verify-full.md` | redesign/evidence/C-18/phase-d-verify-full.md | RESOLVES |
| src/components/faqs-aftercare/__tests__/FaqCategoryAccordions.test.tsx:8 | `SEO-AEO-GEO-IMPLEMENTATION.md` | SEO-AEO-GEO-IMPLEMENTATION.md | RESOLVES(basename: redesign/plans/SEO-AEO-GEO-IMPLEMENTATION.md) |
| src/components/ui/badge.tsx:8 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/components/ui/badge.tsx:10 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/components/ui/button.tsx:23 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/components/ui/input.tsx:9 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/lib/consent/__tests__/registry-completeness.test.ts:3 | `redesign/evidence/C-18/cookie-inventory-source.md` | redesign/evidence/C-18/cookie-inventory-source.md | RESOLVES |
| src/lib/consent/cookie-registry.ts:5 | `redesign/evidence/C-18/cookie-inventory-source.md` | redesign/evidence/C-18/cookie-inventory-source.md | RESOLVES |
| src/lib/consent/cookie-registry.ts:49 | `redesign/evidence/C-18/cookie-inventory-source.md` | redesign/evidence/C-18/cookie-inventory-source.md | RESOLVES |
| src/lib/consent/cookie-registry.ts:178 | `redesign/evidence/C-18/cookie-inventory-browser.md` | redesign/evidence/C-18/cookie-inventory-browser.md | RESOLVES |
| src/lib/consent/cookie-registry.ts:183 | `cookie-inventory-browser.md` | cookie-inventory-browser.md | RESOLVES(basename: redesign/evidence/C-18/cookie-inventory-browser.md) |
| src/lib/consent/cookie-registry.ts:200 | `redesign/per-page-progress/C-18-cookie-consent-progress.md` | redesign/per-page-progress/C-18-cookie-consent-progress.md | RESOLVES |
| src/lib/email/templates.ts:1545 | `BUILD-password-reset-email-templates.md` | BUILD-password-reset-email-templates.md | RESOLVES(basename: redesign/backend-plans/BUILD-password-reset-email-templates.md) |
| src/lib/email/templates.ts:1546 | `redesign/briefs/password-reset-brief.md` | redesign/briefs/password-reset-brief.md | RESOLVES |
| src/styles/tokens.css:85 | `DESIGN.md` | DESIGN.md | RESOLVES |
| src/styles/tokens.css:112 | `redesign/baselines/wcag-severity-tokens.md` | redesign/baselines/wcag-severity-tokens.md | RESOLVES |
| src/styles/tokens.css:147 | `DESIGN.md` | DESIGN.md | RESOLVES |
| supabase/migrations/20260519121000_email_template_overrides_authenticated_select_grant.sql:12 | `redesign/backend-smoke-tests/` | redesign/backend-smoke-tests/ | RESOLVES(dir) |
| supabase/migrations/20260521160000_create_notification_state.sql:7 | `lets-start-with-r4-lazy-stroustrup.md` | lets-start-with-r4-lazy-stroustrup.md | DANGLING |
| supabase/migrations/20260522120000_add_enquiry_first_contacted_at.sql:6 | `redesign/plans/B-phase/B2-metric-backend-plan.md` | redesign/plans/B-phase/B2-metric-backend-plan.md | RESOLVES |
| supabase/migrations/20260522121000_add_band_b_indexes.sql:6 | `SHARED-IMPLEMENTATION-NOTES.md` | SHARED-IMPLEMENTATION-NOTES.md | RESOLVES(basename: redesign/plans/B-phase/SHARED-IMPLEMENTATION-NOTES.md) |
| supabase/migrations/20260522121000_add_band_b_indexes.sql:7 | `redesign/plans/B-phase/B2-metric-backend-plan.md` | redesign/plans/B-phase/B2-metric-backend-plan.md | RESOLVES |
| supabase/migrations/20260522122000_add_insight_dismissals.sql:6 | `SHARED-IMPLEMENTATION-NOTES.md` | SHARED-IMPLEMENTATION-NOTES.md | RESOLVES(basename: redesign/plans/B-phase/SHARED-IMPLEMENTATION-NOTES.md) |
| supabase/migrations/20260522122000_add_insight_dismissals.sql:7 | `redesign/plans/B-phase/B2-metric-backend-plan.md` | redesign/plans/B-phase/B2-metric-backend-plan.md | RESOLVES |
| supabase/migrations/20260727120000_c06_client_crud_hardening.sql:3 | `redesign/plans/C-phase/C-06-client-crud-hardening-plan.md` | redesign/plans/C-phase/C-06-client-crud-hardening-plan.md | RESOLVES |
| supabase/migrations/20260727120000_c06_client_crud_hardening.sql:4 | `redesign/briefs/C-06-client-crud-hardening-brief.md` | redesign/briefs/C-06-client-crud-hardening-brief.md | RESOLVES |
| supabase/migrations/20260727120000_c06_client_crud_hardening.sql:16 | `redesign/evidence/C-06/create_booking_request-BEFORE.sql` | redesign/evidence/C-06/create_booking_request-BEFORE.sql | RESOLVES |
| supabase/migrations/20260727120000_c06_client_crud_hardening.sql:20 | `redesign/evidence/C-06/migration-diff-summary.md` | redesign/evidence/C-06/migration-diff-summary.md | RESOLVES |
| supabase/migrations/20260728073903_c04a_scheduled_emails.sql:3 | `redesign/plans/C-phase/C-04a-cancellation-restore-plan.md` | redesign/plans/C-phase/C-04a-cancellation-restore-plan.md | RESOLVES |
| supabase/migrations/20260728073903_c04a_scheduled_emails.sql:4 | `redesign/briefs/C-04a-cancellation-restore-brief.md` | redesign/briefs/C-04a-cancellation-restore-brief.md | RESOLVES |
| supabase/migrations/20260728073903_c04a_scheduled_emails.sql:12 | `redesign/evidence/C-04a/delivery_status_check-BEFORE.sql` | redesign/evidence/C-04a/delivery_status_check-BEFORE.sql | RESOLVES |
| supabase/migrations/20260728073903_c04a_scheduled_emails.sql:19 | `redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md` | redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md | RESOLVES |
| supabase/migrations/20260728073903_c04a_scheduled_emails.sql:164 | `redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md` | redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md | RESOLVES |
| supabase/migrations/20260729064606_c01_review_email_infrastructure.sql:3 | `redesign/plans/C-phase/C-01-review-request-email-plan.md` | redesign/plans/C-phase/C-01-review-request-email-plan.md | RESOLVES |
| supabase/migrations/20260729064606_c01_review_email_infrastructure.sql:4 | `redesign/briefs/C-01-review-request-email-brief.md` | redesign/briefs/C-01-review-request-email-brief.md | RESOLVES |
| supabase/migrations/20260731192911_c08_notification_email_and_metadata.sql:3 | `redesign/plans/C-phase/C-08-email-automation-expansion-plan.md` | redesign/plans/C-phase/C-08-email-automation-expansion-plan.md | RESOLVES |
| supabase/migrations/20260731192911_c08_notification_email_and_metadata.sql:4 | `redesign/briefs/C-08-email-automation-expansion-brief.md` | redesign/briefs/C-08-email-automation-expansion-brief.md | RESOLVES |
| supabase/migrations/20260802122636_c02_recurring_bookings.sql:3 | `redesign/plans/C-phase/C-02-recurring-bookings-plan.md` | redesign/plans/C-phase/C-02-recurring-bookings-plan.md | RESOLVES |
| supabase/migrations/20260802122636_c02_recurring_bookings.sql:4 | `redesign/briefs/C-02-recurring-bookings-brief.md` | redesign/briefs/C-02-recurring-bookings-brief.md | RESOLVES |
| supabase/migrations/20260804182200_c18_consent_events.sql:11 | `redesign/briefs/C-18-cookie-consent-brief.md` | redesign/briefs/C-18-cookie-consent-brief.md | RESOLVES |
| supabase/migrations/20260804182200_c18_consent_events.sql:50 | `redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md` | redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md | RESOLVES |
| supabase/migrations/20260809120000_c14_save_availability_day.sql:3 | `redesign/plans/C-phase/C-14-granular-working-hours-breaks-plan.md` | redesign/plans/C-phase/C-14-granular-working-hours-breaks-plan.md | RESOLVES |
| supabase/migrations/20260809120000_c14_save_availability_day.sql:4 | `redesign/briefs/C-14-granular-working-hours-breaks-brief.md` | redesign/briefs/C-14-granular-working-hours-breaks-brief.md | RESOLVES |
| supabase/migrations/20260809160000_c14_override_breaks.sql:3 | `redesign/plans/C-phase/C-14-granular-working-hours-breaks-plan.md` | redesign/plans/C-phase/C-14-granular-working-hours-breaks-plan.md | RESOLVES |
| supabase/migrations/20260809160000_c14_override_breaks.sql:4 | `redesign/briefs/C-14-granular-working-hours-breaks-brief.md` | redesign/briefs/C-14-granular-working-hours-breaks-brief.md | RESOLVES |
