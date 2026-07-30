# C-01 — Google review request email (2h after completion) — PROGRESS

**Plan:** `redesign/plans/C-phase/C-01-review-request-email-plan.md`
**Brief:** `redesign/briefs/C-01-review-request-email-brief.md`
**Programme:** Band C, C-C implementation — plan **#6 of 22** (§4 order).
**Predecessor closed at:** `40eccc6` (drift checkpoint #1)

> ## ✅ STATUS: SHIPPED — all 4 code phases implemented + independently verified (one fix round), whole-plan closeout review passed, §3.2 database E2E proved the full pipeline live, master-plan checklist flipped.
> **Final commit:** `5164d00` (Phase D) · bookkeeping in this file's commit + the checklist-flip commit.
>
> **§3.5 (4-role × 4-viewport Playwright sweep) and §3.6 (screenshots) NOT RUN — Owner-performed by necessity**, same standing policy as every prior plan (no agent may authenticate). Checklist in §4 below.
>
> **⛔ Cloudflare deploy: still outstanding, presented to the Owner separately — not a precondition for this plan's ✅**, same precedent as C-04a/C-22. C-01 adds a THIRD cron entry (`*/15 * * * *`) to the same pending deploy — it now activates C-22's rate limiter, C-04a's email-queue drain, AND C-01's review-email cron in one action.

---

## 0 — Pre-flight (2026-07-29)

Run read-only against HEAD `40eccc6`. No hard plan dependency (C-01 is LIGHT-routed, admin-side, no blocking predecessor).

- Branch `master`; `git merge-base --is-ancestor 7fe8b4f HEAD` → OK.
- Path-scoped tree clean: `git status --porcelain -- src/lib/email/ src/app/api/cron/ src/app/admin/email-templates/ src/app/admin/emails/components/ src/app/admin/clients/ worker-entrypoint.ts wrangler.jsonc supabase/migrations/` → empty.
- Env vars confirmed present (existence only, values never read/printed): `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — **the plan's pre-flight step 7 names the last one `RESEND_FROM_ADDRESS`, which does not exist; the real code (`src/lib/email/client.ts:35`) uses `RESEND_FROM_EMAIL`** — stale plan premise, corrected here, not a real defect.
- DB schema verification: `bookings.completed_at`/`review_email_sent_at` absent (additive-safe) ✓; `pg_cron` not installed (confirms Cloudflare path) ✓; **no CHECK constraint on `email_delivery_events.event_type`** — the only CHECK on that table is on `delivery_status` (from C-04a) — so the plan's conditional CHECK-update statement resolves to NOT NEEDED, identical resolution to C-04a's own equivalent conditional ✓; exactly 2 completed bookings exist, both safe `*.example.test` fixtures (`77f90d24…`, `ae9bb5bd…`) ✓; zero bookings have `contact_email = 'rahmatherapy@outlook.com'` ✓.
- `worker-entrypoint.ts` already has a dispatch switch (built by C-04a per D3's order-agnostic convention) with two cases (`"0 8 * * *"` → booking-reminders, `"* * * * *"` → scheduled-emails). C-01 adds one case, does not rebuild it.

---

## 1 — Phase ledger

| Phase | Commit(s) | What | Verify result |
|---|---|---|---|
| A | `b82be65` | Migration: `bookings.completed_at`/`review_email_sent_at` + `bookings_completed_at_trigger` + backfill + Owner-suppression. **⛔ Zone-2, Owner-approved in chat.** | PASS — 3 post-apply queries confirmed; Badar's booking (`9d55ce2a`) confirmed untouched |
| B | `3298238` | `templates.ts`: `DEFAULT_REVIEW_VARIANTS`, `pickReviewMessages`, `substituteCity`, `renderReviewRequestEmail`, `renderReviewRequestPlainText` + 6-case vitest spec | PASS — caught and fixed a double-period bug in the plan's own Step 8 sketch |
| C | `89f997b` + fix `588d0b2` | `notifications.ts`: `sendReviewRequestEmail` + `deriveGroupCategoryForBooking`; SUBJECTS entry; `templates-data.ts` registration (16 fields, `SafeFieldKind` extended); `AUDIT_PHRASING` entry; 6+1-case vitest spec | **FAIL → FIXED → PASS** (see §2) |
| D | `5164d00` | New `src/app/api/cron/review-emails/route.ts`; `fireReviewEmails` + one switch case in `worker-entrypoint.ts`; third cron entry in `wrangler.jsonc`; 6-case vitest spec | PASS — live local smoke curl confirmed `200 {"summary":{"candidates":0,...}}` before the E2E round below |

**Closeout gate (2026-07-29):** independent whole-plan diff review (`b82be65..5164d00`) — PASS, zero blocking findings. Scope clean (exact match to plan §2's files-touched table); all 18 completed steps (1–18) confirmed present; no HARD-STOP silently taken; cross-phase string consistency confirmed (`review_request_client`, `review_email_sent`, default subject text all agree byte-for-byte across every file); no style drift despite all 4 phases running on Sonnet with no Opus involvement.

---

## 2 — The one fix round: Phase C plain-text leg ignored overrides

Independent Phase C verification found `sendReviewRequestEmail` sent a real multipart email (confirmed via `resend.emails.send({html, text})`) where the HTML leg correctly resolved admin-configured review-variant overrides via `resolveTemplateOverrides`, but the plain-text leg built its variants from a **separate** `pickReviewMessages` call hardcoding `overrides: {}` — so an admin's override text would show in the HTML view but never in a plain-text-rendering client, for the same sent email. This directly contradicted the brief's own acceptance criterion #3 ("cron-sent email uses the override" — unqualified).

**Fixed in `588d0b2`:** `resolveTemplateOverrides` (already exported by `templates.ts`) is now called once in `notifications.ts` and its result passed to the text-leg's `pickReviewMessages` call. One new test proves the sent `text` body contains override content when all 5 pool variants are overridden. Independently re-verified: the fix genuinely closes the gap (traced mock-spy scoping to confirm the new test isn't accidentally vacuous), doesn't worsen anything, and all gates stay clean.

**Known, accepted, not fixed:** the HTML and plain-text legs still independently randomize which 3-of-5 variants they show (two separate `Math.random()` draws even post-fix) — so the two legs of the same email may list a different subset of (now-identical, override-respecting) sample reviews. Fixing this fully would require a Phase B signature change (return the picked variants from `renderReviewRequestEmail` for reuse) — out of scope for this fix round, logged here as a minor cosmetic gap.

---

## 3 — §3.2 Database E2E — proved live, no Playwright needed (2026-07-29)

Unlike C-04a/C-05's closeout sweeps, C-01's §3.2 database-verification gate doesn't require admin sign-in — it's pure SQL + a local curl, so the orchestrator ran it directly under one Zone-2 approval.

**Fixture:** `ae9bb5bd-23c0-4a6e-91af-42307ed4419f` (`audit.client.3.1779055968940@example.test`, already-completed test booking, previously marked "handled" by the migration's backfill).

**⛔ Zone-2 (Owner-approved in chat):**
```sql
UPDATE bookings SET review_email_sent_at = NULL, completed_at = now() - interval '3 hours'
WHERE id = 'ae9bb5bd-23c0-4a6e-91af-42307ed4419f';
```

**Results:**
1. Curl #1 → `{"summary":{"candidates":1,"sent":1,...}}`.
2. DB confirmed: `review_email_sent_at` populated; `audit_logs` row `action_type='review_email_sent'`, `after_state={automated:true, booking_id, cron_trigger:"review-emails-15min"}`; `email_delivery_events` row `event_type='review_request_client'`, `recipient_role='customer'`, `delivery_status='accepted'`.
3. Curl #2 (immediate re-run) → `{"summary":{"candidates":0,...}}` — sentinel idempotency proven.
4. `to_email` is NULL on the new delivery row — checked against 4 other event types' existing rows, **all** NULL — pre-existing behavior across the whole table (that column is only ever populated for C-04a's delayed-send path), not a C-01-specific gap.

**Fixture restored afterward** (`completed_at`/`review_email_sent_at` both set to `updated_at`, matching the migration's original backfill semantics) — though because `bookings_updated_at` re-stamps `updated_at` on every write, the restored timestamps land at today's test-run moment rather than the original 2026-05-17 backfill moment. **Functionally identical** (booking is `completed` + sentinel-set, correctly excluded from all future cron candidates) — only the audit-trail timestamp differs, which the plan's own §6 undo guidance explicitly treats as acceptable ("or leave as backdated; doesn't affect operational data").

**This constitutes genuine, live proof the whole pipeline works** — trigger → cron → send → sentinel → audit — without needing the Playwright role sweep for the mechanism itself. §3.5's remaining value is RBAC/UI verification (template visibility per role, the 16-field editor rendering cleanly), not pipeline correctness.

---

## 4 — §3.5 / §3.6 Owner-performed checklist (handed over, not run by any agent)

1. **Templates tab visibility** (`/admin/emails`) as each of the 4 roles: "Review request (2h post-completion)" card visible to Owner/Admin (via `manage_email_templates`), appropriately restricted for Coordinator/Therapist per the existing RBAC matrix (no new permission introduced by C-01).
2. **16-field editor** — click into the template, confirm the fields render in a usable grouped layout (6 shared + 5 massage + 5 cupping), not an undifferentiated wall of inputs. This is a UX-polish check, not a functional one — the plan flagged it as a "verify it doesn't look like a wall of inputs" item without mandating a specific grouping implementation, and no grouping UI was added in Phase C (the `templates-data.ts` registration is flat, matching this file's existing pattern for all 9 prior templates — none of which have UI-level grouping either). Confirm this is acceptable or flag for a follow-up.
3. **Override round-trip** — edit `massage_variant_3` to a test string, save, confirm an `email_template_overrides` row appears, then re-trigger the cron on a fresh test booking and confirm the HTML **and** (post-fix) plain-text leg both reflect it.
4. Screenshots per plan §3.6 (375+1280 Templates tab; 375+1280 16-field editor; 1280 Resend dashboard send-event; 1280 audit-log entry showing `review_email_sent`) — store in `redesign/evidence/C-01/`.
5. **Resend dashboard spot-check** (§3.3) — confirm the test send from §3's E2E actually shows up (subject "Thank you for visiting Rahma Therapy", correct body), no bounce/error recorded for the `*.example.test` address (expected to show as undeliverable/no-such-domain, which is normal for `.test` TLD sends and not a code defect).

**Safe fixtures:** `77f90d24-db80-4f4e-81d5-2fe677012632` and `ae9bb5bd-23c0-4a6e-91af-42307ed4419f` (both `*.example.test`, both currently "handled" — resetting either's sentinel again is safe and reversible). **Never** `9d55ce2a` (Badar) or `rahmatherapy@outlook.com`.

---

## 5 — Deviations and judgment calls (all reasoned, logged, none unresolved)

- **Pre-flight:** `RESEND_FROM_ADDRESS` (plan text) → `RESEND_FROM_EMAIL` (real env var) — corrected, see §0.
- **Migration:** the conditional `email_event_type` CHECK statement omitted entirely (confirmed not needed) rather than included as dead SQL — documented via an in-file comment instead, matching C-04a's precedent for its own equivalent conditional.
- **Phase B:** `renderReviewRequestEmail` shipped as a plain `async function` rather than the brief's `async () => {...}` IIFE wrapper — functionally identical, matches this file's own existing convention for sibling renderers (rule 11).
- **Phase B:** fixed a genuine double-period bug in the plan's own Step 8 plain-text template sketch (`"...find us.."` / `"...Google.."`) — not present in the shipped code.
- **Phase C:** `templates-data.ts`'s real `SafeField`/`TemplateMeta` shape (requires `placeholder`+`helper`, human-readable `trigger` sentences) diverged from the plan's simplified Step 12 sketch — implemented against the real, current file shape (orchestrator pre-verified and briefed this before dispatch, avoiding a wasted round-trip).
- **Phase C:** destructured only `{ input }` from `getBookingTemplateInput` (brief's sketch destructures unused `fullBooking`/`settings` too, which would be lint errors) — minor, faithful adaptation.
- **Phase C → fix round:** see §2.
- **Phase D:** omitted the `NEXT_PUBLIC_SITE_URL` validation the plan's Step 14 prose mentions mirroring from `booking-reminders/route.ts` — verified via direct read that (a) `booking-reminders` needs it because its email links to `{SITE_URL}/booking/manage`, (b) C-04a's sibling `scheduled-emails/route.ts` also omits it, (c) `renderReviewRequestEmail`'s only link is a hardcoded Google review URL with zero `SITE_URL` dependency. The brief's own §2.4 code sketch (more authoritative than the plan's summary prose) already omits this check. Confirmed by the independent verifier as a legitimate omission, not a gap — logged as a plan-authoring inconsistency (prose vs. code sketch disagree) rather than an implementation defect.
- **Phase D:** `wrangler.jsonc`'s stale comment ("Both self-fetch…") updated to "All three self-fetch…" since it was now factually wrong after the third cron landed — a comment-accuracy fix, not a functional change, confirmed by the verifier as the only non-additive line in that file's diff.

## 6 — Log-only (noticed, not this plan's to fix)

- `templates-data.ts`'s file-header comment ("...9 templates...") is now stale (10 templates post-C-01) — pre-existing comment, correctly left untouched per rule 3/6(a) rather than "improved" outside scope. Flagged for whoever next touches that file's header.
- The HTML/plain-text cross-leg variant-selection mismatch noted in §2 — cosmetic, would need a Phase B signature change to fully close.

## 7 — Baseline identity AFTER (final, independently re-run at HEAD `5164d00`)

`npx tsc --noEmit` → 0 errors. `pnpm lint` → 59E/7W, same six files. `pnpm vitest run` → 5 failed / 792 passed, the five inherited names unchanged (admin-access ×2, ManualBookingForm ×3). `pnpm build` → clean. **This is the baseline plan #7 (C-FIELDWORK) inherits.**

---

## 8 — Second fix round, post-closeout (2026-07-30) — orchestrator-takeover seam review

C-01 shipped on 2026-07-29 and this file was marked SHIPPED. A later **orchestrator-takeover seam review** (2026-07-30, at the handover to the Opus 5 orchestrator) re-examined C-01's whole diff range `40eccc6..9ce16e0` — the two plans shipped after drift checkpoint #1 had never been seen by any cross-plan reviewer. It found a **second, separate defect** that this plan's own per-phase verifiers missed. Owner approved the fix in chat before plan #8 (C-11) started.

**The defect:** `renderReviewRequestPlainText` hardcoded FIVE of the six admin-editable body fields as string literals — `body_intro`, `body_ask`, `body_cta_label`, `body_cta_url` (`https://g.page/r/Ccfwk27JycKDEBM/review`) and `body_signoff` — while `renderReviewRequestEmail` resolved all six from `resolveTemplateOverrides("review_request_client")`. An admin editing the Google review URL in the Templates tab got the new link in the HTML leg and the **stale hardcoded one in the plain-text leg of the same email**.

**Why §2's fix round did not close this.** §2 fixed the *sibling* gap — review **variants** not reaching the text leg (`588d0b2`). The regression test it added is titled generically ("propagates admin-configured override text into the plain-text leg, not just the HTML leg") but asserted only on `massage_variant_*`. Confident closeout language plus a same-shaped-but-narrower test produced a **false completeness signal**: the whole override-propagation class read as closed when only one member of it was. This is the transferable lesson — a generically-titled test that covers one specific case is worse than a narrowly-titled one, because it suppresses the next reviewer's suspicion.

**Fixed in `69c4e01`** (`fix(redesign): C-01 seam review — plain-text leg must respect all five editable body fields`), 3 files:
- `templates.ts` — the six defaults extracted into a single `REVIEW_REQUEST_DEFAULT_FIELDS` + `resolveReviewRequestFields(overrides)`, consumed by BOTH renderers, so the two legs can no longer drift apart. `renderReviewRequestPlainText(input, variants, overrides = {})` resolves via `substituteCity` → `substituteVars`, matching the HTML leg's substitution semantics exactly.
- `notifications.ts` — one line at the real call site inside `sendReviewRequestEmail`: the already-in-scope `overrides` is now passed through. **This line is the actual fix**; without it the renderer change would be inert while every test still passed.
- `sendReviewRequestEmail.test.ts` — 3 new direct-renderer tests (defaults apply, all five honoured, no `{city}`/`{service_name}` placeholder leak with and without a city) PLUS the assertion that would have caught this originally: an overridden `body_cta_url` reaching the **sent** email's plain-text body, and the hardcoded default absent from it.

**Independently verified** (read-only verifier, 9-point checklist, all PASS, all four gates re-run directly): the runtime path from the cron route through `fireReviewEmails` → `sendReviewRequestEmail` genuinely carries the overrides; no duplicated defaults remain; substitution parity confirmed on both the city and no-city paths; `subject` correctly left alone (its HTML-`<title>`-only reach is a pre-existing codebase-wide pattern, explicitly out of scope); scope held to exactly 3 files with the `sendBookingCancellationEmails` region untouched.

**Baseline identity after `69c4e01`:** tsc 0 · lint 59E/7W same six files · vitest **5 failed / 829 passed (834)**, the same five inherited names · build clean. Totals moved 831→834 and 826→829 — exactly the 3 added tests, no swapped-in failures.

---

*C-01 shipped 2026-07-29; second fix round `69c4e01` landed 2026-07-30 post-closeout. Next in §4 order: C-FIELDWORK (before C-11).*
