# Band C Plan-Refinement Record — 2026-07-26

**What this is:** the durable record of the full-corpus refinement pass that reconciled all 23 Band C plans + briefs with the post-merge build (`master` @ `ea97932`) and made them autonomously executable (ultracode-workflow-compatible). Every claim below traces to an evidence-cited finding, an Owner-approved decision, or a per-plan gate verdict. This file + `BAND-C-MIGRATION-LEDGER.md` are the two artifacts a C-C implementation session should read after the handoff.

## 1 — Process (for audit)

1. **Stage 0:** HEAD pinned (`ea97932`); all 46 plan/brief files snapshotted; evidence-based triage (merge-changed-files ∩ plan-referenced paths → 8 FULL / 15 LIGHT review protocols); cross-reference index; pre-edit structural manifests (headings/steps/markers/hashed code fences); fact pack incl. a read-only production schema snapshot (2026-07-25).
2. **Stage 1:** one reviewer per plan against the live codebase (fixed findings schema + coverage checklist + honesty attestation); high-impact/plausible findings adversarially re-verified by independent skeptic agents (8 verify passes). **147 findings total; 0 verifier-REFUTED findings were applied; MODIFIED verdicts applied with corrections.**
3. **Stage 2:** three cross-plan synthesizers over the complete findings set → shared-file collision map (12 surfaces), consolidated migration ledger (9 migrations, zero DDL conflicts proven per-table), sequencing validation (order unchanged; 8 new constraints) + decision-class extraction.
4. **Checkpoint:** Owner reviewed the decision-class items and approved **all recommendations** (2026-07-26).
5. **Stage 3:** one refine agent per plan (surgical Edit-only, changelog per edit, never-renumber, VERIFY-wrappers for superseded steps) → mechanical non-removal gate per plan (snapshot-manifest diff + adjudication of every removed element against the changelog + EOL/isolation checks) → per-plan commit. Gate catches during the pass: one CRLF full-file-rewrite (C-23 — repaired + hand-reviewed line-by-line), one missed lint-gate caveat (C-01 §3.1 — hand-fixed), concurrency false-positives (gate rule corrected). Plans hand-diff-reviewed by the orchestrator in addition to gates: C-21, C-19, C-23, C-03, C-13.
6. **Stage 4:** mechanical sweeps across the refined corpus (HARD-STOP coverage grep — all migration/env/console steps covered; stale-premise grep — only quoted-in-amendment residue; audits-write-target grep — all redirected to `redesign/evidence/<plan-id>/`).

## 2 — The 23 refinement commits

| Plan | Commit | Headline changes |
|---|---|---|
| C-19 | `d7584cb` | STOP-AND-ASK owner gate (3 copy inputs); conditional-safe GA//cookies copy (D18); evidence dir (D15); third-party participant-notes sentence |
| C-21 | `894add2` | Step 2a area-page sweep (3 new `.co.uk` carriers); pure-constant `SITE_URL` (D21); prod-env HARD-STOP; 12-page verification (D22) |
| C-10 | `e2aec23` | C-16 hard pre-flight stop clarified; post-merge premises |
| C-17 | `c7a94d1` | `PreparedStep`→`SuccessScreen` retarget; dialog-based mount model; NEW `booking/layout.tsx` for `/booking/manage`; StrictMode fire-once note |
| C-18 | `8cc7ffb` | Inline consent bootstrap in both layouts (D16 — `beforeInteractive` is root-only); post-merge token/layout/footer anchors |
| C-22 | `2a829d9` | Honeypot wired end-to-end through types/form/schema/payload/route (D24); availability-API rate limiting added to scope (D23, Owner-approved); submit-path re-anchors |
| C-16 | `8c29101` | Verified cap/unbounded claims; post-merge premises |
| C-03 | `a36c3c9` | Conditional index confirmed live; anchors; evidence dir |
| C-20 | `f25999f` | `LocationDetailsStep`→`AboutYouStep` retarget (RHF + covered-chips + `availabilityInputsKey` interaction); `.pac-container` spike-first step (D20); `.co.uk` referrer gate re-opened (D19) |
| C-14 | `c85e30c` | Refactored-engine re-anchors; Phase D → VERIFY wrapper with optional residuals (D11); Phase C atomic co-deploy additions (D12); C-23 serialization |
| C-23 | `8ff20ed` | Phase A → verify-only (D25); live-public-endpoint risk posture; SAFE rollback rewrite (never revert engine below `ea97932`); C-14 serialization |
| C-11 | `e9be703` | **Admin-scoped dark tokens — the stale step that would have dark-flipped the public site is corrected**; color sweep trimmed with explicit C-12+ log (D9); reduced-motion demoted, already ~done (D8); inline FOUC script, no root-layout touch (D10) |
| C-15 | `9cb78f2` | ≤500-char override cap vs the live DB CHECK (D13); reciprocal C-01 note (D14); component/route anchors |
| C-06 | `7993139` | **deleteClient recurring-cascade written into Step 9 (D1)**; migration HARD-STOPs; verified schema premises |
| C-09 | `32971c6` | Post-merge premises; pagination-ready signature confirmations |
| C-05 | `5838c15` | Hard C-06-migration gate in pre-flight (D4); anchors |
| C-FIELDWORK | `78661d8` | Verified dashboard/sidebar anchors; premises; executability lines |
| C-13 | `feb8c98` | `ParticipantCard`→`ParticipantRow` corrections; C-15 FixedPart coordination; evidence dir |
| C-04a | `3826b9d` | Event-type naming kept `booking_cancellation_customer` (D2); order-agnostic cron dispatch (D3); notifications region annotations (D26); migration HARD-STOPs |
| C-01 | `22ba9c9` | Order-agnostic cron dispatch (D3); SafeFieldKind extension (D7); lint-baseline gates; migration HARD-STOP |
| C-02 | `3e91a33` | C-06 cascade cross-ref resolved (D1); marker-verifiable C-01/C-08 gates; migration HARD-STOPs |
| C-07 | `c1d56cc` | Default-view computations reconciled into one helper (D5 — fixes a latent divergence); `/booking/manage` route-shape fix |
| C-08 | `7ab28d1` | SafeFieldKind extension (D7); notifications region annotations (D26); Phase D supersession note (D6); migration HARD-STOPs |

## 3 — Owner-approved decisions (checkpoint, 2026-07-26 — "all as recommended")

D1 cascade→C-06 Step 9 · D2 keep `booking_cancellation_customer` · D3 order-agnostic cron dispatch (C-01+C-04a) · D4 hard C-06→C-05 gate, no fallback · D5 reconcile default-view computations · D6 C-08 Phase-D supersession stands · D7 minimal SafeFieldKind extension · D8 reduced-motion demoted (verified ~done: 68 occurrences/31 admin files) · D9 color sweep trimmed to variant surfaces, remainder logged for C-12+ · D10 inline FOUC script, admin layout only · D11 C-14 Phase D → VERIFY wrapper + optional residuals · D12 C-14 Phase C atomic co-deploy (upsert rewrite + assignment-eligibility widening + staff duplicate-date guard) · D13 C-15 ≤500-char field cap, no migration · D14 C-15↔C-01 reciprocal note · D15 evidence convention `redesign/evidence/<plan-id>/` · D16 inline consent bootstrap in nested layouts · D18 C-19 conditional-safe copy + STOP-AND-ASK gate · ~~D19 add `.co.uk` Maps referrer~~ **D19 WITHDRAWN same day (Owner clarification): the site serves ONLY on `rahmatherapy.uk` — the `.co.uk` strings are wrong metadata (C-21's bug), not a serving origin, and referrer restrictions check the serving origin; the 2026-07-16 referrer list is correct and complete; C-20 §3.5 stands DONE, only the key-rotation decision remains open** · D20 pac-container spike-first · D21 pure-constant SITE_URL module; email/cron keep the env contract; prod env change HARD-STOPped · D22 C-21 sweep = 15×`.co.uk`/12 files incl. area pages; 12-page verification · D23 C-22 scope extended to the two public availability APIs · D24 honeypot hoisted end-to-end · D25 C-23 Phase A verify-only; Phase B acknowledged as live-endpoint work · D26 notifications.ts region annotations in both C-04a and C-08 (order unchanged).

## 4 — New sequencing constraints (no order changes)

- C-06 → C-05 promoted to HARD (schema dependency; gate in C-05 pre-flight).
- C-23 Phase B **before** C-14 engine phases (same file; both plans carry the check).
- ~~C-21 soft-before C-20 (Maps referrer coverage)~~ — withdrawn same day with D19 (site serves only on `rahmatherapy.uk`; C-20's referrers were never affected). C-21-early remains recommended for SEO alone.
- C-17/C-18 soft-before C-19 — bridged by D18's conditional-safe copy.
- C-02 pre-flight gates on C-01 + C-08 now marker-verifiable (`git log --grep`).
- Cron dispatch: first of C-01/C-04a to ship builds the wrangler/worker dispatch table; the other adds a case.

## 5 — Standing conventions introduced (apply to all future Band C work)

1. **HARD-STOP blocks** (`⛔ HARD-STOP — ZONE-2`) before every migration / prod-env / external-console / package-install step — grep-able, so an orchestrator can mechanically enforce the pause. Never auto-apply.
2. **STOP-AND-ASK gates** (`⏸`) where a plan needs live Owner input.
3. **VERIFY-ALREADY-IMPLEMENTED wrappers** — superseded steps keep their original text; executors verify instead of re-implementing.
4. **Evidence dir:** `redesign/evidence/<plan-id>/` — `redesign/audits/**` is read-only history.
5. **Never renumber** steps/phases; insert as Na/Nb. Sections other plans reference keep number + title.
6. **Path-scoped tree checks** only; the wider tree is intentionally dirty — never stage broadly, never stash/restore.
7. **Baselines:** lint = 59 pre-existing errors; vitest = 6 pre-existing failures in 3 files; gates mean "no NEW errors/failures".
8. **Shared-surface re-grep** before editing `ManualBookingForm.tsx`, `notifications.ts` (`sendBookingCancellationEmails` region), `wrangler.jsonc`/`worker-entrypoint.ts`, `admin/bookings/page.tsx`, `templates-data.ts` — sibling plans move anchors.

## 6 — Open items surviving into C-C (statuses per Owner, 2026-07-26)

1. **Database backup / DR** — highest severity; no plan covers it. **Owner: will handle at a later time** (deliberately deferred, not forgotten).
2. **Email deliverability (SPF/DKIM/DMARC)** — **CLOSED 2026-07-26: Owner confirms SPF + DKIM are set up and emailing works.**
3. **No sitemap.ts / robots.ts** — flagged in C-21, out of scope. **Owner: will handle later personally.**
4. **`resend_booking_emails` permission-row existence** — read-only spot-check at C-08 pre-flight (see migration ledger).
5. ~~Maps key `.co.uk` referrer~~ — **withdrawn with D19** (site serves only on `rahmatherapy.uk`; referrer list correct as-is). The key **rotation decision** (C-20 pre-flight STOP-AND-ASK item (a)) is the only Maps item still open.
6. **Untracked `design_handoff_area_pages/prototype/*.jsx`** cause 55 of the 59 lint-baseline errors — a one-line `.gitignore` entry would clean the baseline; flag-only, Owner's call.
