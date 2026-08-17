# FINDINGS A3 — process artifacts

**Territory:** `redesign/audits`, `briefs`, `per-page-progress`, `per-page-scope`,
`per-page-recipes`, `per-page-deferrals`, `backend-plans`, `backend-smoke-tests`
**Date:** 2026-08-17 · **328 tracked files, 17.72 MB · 100% Class A** (`git ls-files` returns
exactly 328; `git status --porcelain` on them is empty). Nothing here is Class B — every deletion
would be recoverable from git history.

---

## ⛔ 0 — Two directories are governing documents, not history

`AGENTS.md` at the repo root — read by every session, per its own line 1 — says verbatim:

> line 7: *"Position of record is git (…) + `redesign/per-page-progress/` — never memory or assumptions."*
> line 9: *"…never touch … `redesign/audits/**` …"*

⛔ **`redesign/audits/**` (99 files, 14.0 MB) and `redesign/per-page-progress/` (57 files, 1.04 MB)
are KEEP-GOVERNING for the entire directory**, independent of any filename grep.

`per-page-progress/OWNER-ACTION-BACKLOG.md` (80.5 KB, last touched **2026-08-09**) reinforces this:
it is the live, actively-maintained cross-plan Owner-action tracker, still listing open items
(Cloudflare deploy, Sentry scrubbing rule, GA build-env var, DB index migration).

---

## 1 — Summary

| Metric | Value |
|---|---|
| Files / size | 328 / 17.72 MB (12.93 MB is `audits/C-A/screenshots-*/*.png`; 4.79 MB markdown) |
| Class | 100% A |
| Source-cited files (verified) | 21 |
| Directory-level governing citations | `audits/**`, `per-page-progress/` |
| ⛔ Confirmed STILL-OPEN deferrals | **15** |
| Confirmed DONE since deferral | 7 |
| Reclaimable if all DELETE-SAFE removed | ≈**1.43 MB** (55 files) — small, because 14 MB sits in the protected `audits/` tree |

---

## 2 — Per-directory findings

| Directory | Files | Size | Verdict |
|---|---|---|---|
| `audits/C-A/` | 99 | 14 MB | **KEEP-GOVERNING in full** — DO-NOT-TOUCH per AGENTS.md; also "tracked design archives" under the standing Owner decision |
| `per-page-progress/` | 57 | 1.04 MB | **KEEP-GOVERNING in full**; `OWNER-ACTION-BACKLOG.md` is KEEP-LIVE; two files additionally KEEP-CITED from `src/` |
| `briefs/` | 58 | 1.83 MB | 9 KEEP-CITED · ~16 KEEP-MEMORY (page still has an open deferral and the brief holds the spec to close it) · 16 C-series KEEP-MEMORY (cross-referenced by the backlog for pending sign-off) · 3 CONSOLIDATE |
| `per-page-scope/` | 29 | 93.6 KB | **DELETE-SAFE, all 29** — zero citations; spent boundary contracts for completed sessions |
| `per-page-recipes/` | 26 | 1.28 MB | **DELETE-SAFE, all 26** — zero citations; worktree-bound execution scripts for pages that have since shipped |
| `per-page-deferrals/` | 25 | 108 KB | ⛔ **KEEP-MEMORY, all 25, no exceptions** — see §3 |
| `backend-plans/` | 28 | 138 KB | 9 KEEP-LIVE/KEEP-CITED (backend genuinely still FAKE) · 1 KEEP-MEMORY · 18 CONSOLIDATE |
| `backend-smoke-tests/` | 6 | 96 KB | 1 KEEP-CITED (cited from a migration) · 5 KEEP-MEMORY |

⛔ **`per-page-deferrals/` is the highest-value directory in this territory.** Its own README says
files become historical only *after* Phase 7 resolves them — but the directory has not been touched
since **2026-05-19**, while the programme kept shipping through **2026-08-09+**. Phase 7's promised
global reconciliation never happened as a dedicated pass.

---

## 3 — ⛔ Open deferrals (re-verified against current code)

**Still open — 15:**

1. account-password-requests — Approve/Reject fire no success toast (handlers still FAKE)
2. audit — date-range presets still rolling windows (`now - dayMs(1)`), not calendar boundaries
3. audit — empty-state copy diverges from brief
4. calendar — `BookingListCard` never extracted; `CalendarBookingRow` still a local duplicate
5. client-detail — Therapist with zero assignments hits `notFound()` before `AdminAccessDenied`
6. client-new — postcode auto-fill shipped for booking-new, never extended here
7. dashboard-owner-admin — `AdminErrorBoundary` fallback lacks `role="alert"`
8. dashboard-therapist — gender-match chip and customer-notes block absent from the hero
9. email-templates — "Last sent" timestamp absent despite its blocking BUILD plan shipping
10. roles — `BUILD-create-role.md` / `BUILD-delete-role.md` unshipped; FAKE markers still present
11. role-detail — same delete-role dependency, still open
12. services — shared `AdminActionMenu` trigger still 36px, **below the 44px WCAG floor**
13. password-reset — both cited BUILD plans confirmed unshipped
14. staff / staff-availability — real avatar-photo support absent (no `avatar_url` column)
15. staff — pagination/Load-more absent (low urgency, ~11 rows)

**Done since the deferral was written — 7:** the `MANAGE_AUDIT_LOGS` permission bridge removed ·
audit `print:!open` `<details>` bug fixed · emails PAGE_SIZE=100 replaced with a real pager (C-16) ·
operations filter-query no longer FAKE · availability's 5 v1 P1 findings resolved · role-detail's
10/10 post-review fixes closed · most clients P1/P2 findings resolved.

**Flagged, unverified:** repo-wide oklch token drift (independently confirmed still open at
"98 files / 679 occurrences" by the backlog's own DECISION A row) is the largest recurring theme.
Also a roles DB seed drift — the "Inactive" role has `active=true` — which needs DB access to confirm.

---

## 4 — Source-cited files (complete, verified — undeletable)

- **Briefs (9):** B2-metric-backend, C-01, C-02, C-04a, C-06, C-08, C-14, C-18, password-reset
- **Progress (2 individually, plus the directory-wide citation):** C-16-data-growth-pagination, C-18-cookie-consent
- **Backend-plans (9):** BUILD-approve-reject-password-reset, BUILD-create-role, BUILD-delete-role,
  BUILD-password-reset-email-templates, BUILD-password-reset-request-actions,
  BUILD-rbac-permission-email-templates, BUILD-staff-availability-override-actions,
  BUILD-staff-blocked-dates-actions, BUILD-staff-workload-aggregates
- **Backend-smoke-tests (1):** `email-template-overrides-table-2026-05-19.txt`

⛔ **Two false positives caught and excluded** (the crude-grep trap): `briefs/bookings-brief.md`
(substring match — the real citation is `C-02-recurring-bookings-brief.md`) and both territory
`README.md` files (matched because unrelated docs discuss the repo-root `README.md`).

⛔ **The 9 backend-plans files are cited via `data-redesign-fake` / `data-redesign-backend="FAKE"`
HTML attributes, not comments** — a citation mechanism the "63 comment references" baseline
undercounts entirely. All 9 gate real unshipped functionality.

---

## 5 — High-confidence deletions, with proof

```bash
# per-page-scope (29) and per-page-recipes (26): no output for any file
for f in redesign/per-page-scope/*.md; do
  grep -rl "$(basename "$f")" --exclude-dir=node_modules --exclude-dir=redesign \
       --exclude-dir=.next --exclude-dir=.git .
done
```

The 18 shipped backend-plans files were each verified against a live code symbol
(e.g. `grep -n "auditLoadMore" src/app/admin/audit/actions.ts`) with zero remaining citations.

---

## 6 — Consolidation candidates

1. `per-page-scope` + `per-page-recipes` → fold into `per-page-progress` or delete (55 files, 1.37 MB, none cited).
2. 18 shipped `BUILD-*.md` → one "shipped backend plans" appendix — preserves rationale recorded
   nowhere else, such as the Cloudflare-Cron-vs-Supabase pivot.
3. `backend-smoke-tests` non-cited transcripts → fold into the relevant progress files.
4. password-reset / reports / settings briefs → fold into their progress file as a closing appendix.

---

## 7 — Uncertain / Owner-call

1. 16 C-series items are actively cross-referenced in `OWNER-ACTION-BACKLOG.md` for pending
   sign-off — do not touch until those rows close.
2. Several `audits/C-A/*` verdicts are now stale (e.g. the enquiries FAKE-marker note, since
   shipped). Does not change KEEP-GOVERNING, but worth knowing.
3. Roles DB seed drift — needs Owner/DB access.
4. booking-detail / booking-new / bookings / login / privacy briefs — not verified to the same
   depth; provisionally KEEP-MEMORY, especially booking-new and bookings, the most heavily reworked
   pages in the programme.
