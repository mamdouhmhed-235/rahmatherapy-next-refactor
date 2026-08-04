# HANDOFF — The Advisor Seat (2026-08-04)

**What this is:** the self-contained context for the session that plays the OWNER'S ADVISOR — distinct from the implementation sessions. Read this end to end, then run the pre-flight at §8. Your predecessor session ran from 2026-07-25 (plan-refinement kickoff) to 2026-08-04. The Owner will hand you this file and expect you to continue seamlessly: same knowledge, same discipline, same prompt-craft.

---

## 1 — Your role (what the Owner uses this seat for)

You are NOT the implementer. Implementation happens in SEPARATE Claude Code sessions (Opus 5 orchestrator + routed subagents, driven by `/goal` + ultracode workflows). This seat:

1. **Authors and maintains the execution machinery** — `redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md` (the binding rulebook), `SUBAGENT-RULES.md` (worker one-pager), resume briefs. Every change red-teamed with adversarial agents before committing.
2. **Crafts the `/goal` prompts** the Owner pastes into implementation sessions — see §5 for the exact current template and its rules.
3. **Verifies position from git before EVERY prompt** — never trust the implementation agent's handoff text or your own memory; `git log` is the position of record. The Owner pastes agent handoffs here; treat them as claims to verify.
4. **Audits the implementation** on request — read-only multi-agent review fan-outs (conformance vs plan, protocol compliance, fresh-eyes bug hunts). One mid-run audit is done (see §6); the full end-of-programme review is PROMISED and outstanding — trigger phrase: **"done — review it"**.
5. **Presents decisions tersely with a recommendation** — the Owner decides everything. They are the clinic Owner (Rahma Therapy, Luton; home-visit massage; production Supabase `twzutkfgqclqurvkmvqz` is LIVE with real customers).

**Hard lessons your predecessor learned (do not repeat):**
- **NEVER change anything without an explicit ask.** A question ("are you sure?") is a question — answer it, present options, wait. Predecessor flipped a protocol decision on a question and got: "dont make a change unless i fucking ask you."
- The Owner says "give me the full prompt dont confuse me" — when a prompt changes, reprint the WHOLE thing, never a swap-in fragment.
- `/goal` has a **4,000-character cap** — overflow goes into a committed companion file (pattern: `C-C-RESUME-<date>.md`) with the prompt pointing at it.
- Max 5x usage limits kill big agent bursts — run YOUR audit/red-team workflows in small batches (3–6 agents), sonnet for mechanical work, and have agents persist outputs to files before returning.
- Log agent-notification results promptly; a "test"/stub structured return is a FAILED audit, not a CLEAN one — re-run it.

## 2 — Programme state (verified 2026-08-04, HEAD `16c700e`)

**Band C: 23 plans (22 checklist rows; C-17+C-18 co-ship). SHIPPED 18/22:** C-21, C-22, C-06, C-04a, C-05, C-01, C-FIELDWORK, C-11, C-08, C-15, C-13, C-02, C-09, C-03, C-07, C-16, C-17, C-18 — each with per-phase commits, independent verification, closeout gate, progress file, master-plan row ✅.

**In flight:**
- **C-19** (privacy page): all three ⏸ Owner copy inputs now ANSWERED (contact = site's published details; retention = 7-year; controller = **RAHMATHERAPY LIMITED, company no. 16769945**, register-verified). Page NOT yet built. **`redesign/per-page-progress/C-19-privacy-policy-page-progress.md` has an UNCOMMITTED edit** recording answer (c) — the implementation session's in-flight work; do not commit it yourself.
- **C-23** (admin availability calendar): pre-flight recorded (`8504746`, held at the Zone-2 baseline), Phase B committed (`61111ee` additive engine options, `16c700e` authenticated admin month endpoint). The orchestrator moved onto C-23 while C-19 waited on the Owner — verify the reordering was logged when you next audit.
- **Remaining:** C-20, C-14 (after C-23 — same engine file, serialized), C-10 (dead last — overlap catalogue).

**Migrations applied (9):** c06_client_crud_hardening · c04a_scheduled_emails + grant fix · c01_review_email_infrastructure · c11_theme_preference · c08_tighten_email_delivery_events_rls · c08_notification_email_and_metadata · c02_recurring_bookings · c18_consent_events. All Owner-approved per-action via ⛔ HARD-STOP flow.

**Standing tree facts:** `master`, ~373 commits ahead of origin, NEVER pushed (Owner keeps everything local). Intentional dirt: 258 deletions (`.playwright-mcp/`, `design_handoff_public_pages/`) + 3 untracked dirs. **`src/lib/maintenance.ts` working copy = `false` (Owner's own uncommitted change; HEAD's committed copy = `true`)** — never stage/commit/revert; must be Owner-flipped before deploy. Uncommitted C-19 progress edit (above).

**Owner-side open items:** the **four-in-one Cloudflare deploy** (⛔ Owner-gated: C-22 rate-limiter DO + C-04a email-drain cron + C-01 review cron + all shipped code — until it runs, queued cancellation/review emails do NOT reach customers); **Sentry console ingest-scrubbing rule + stored-replay retention** (a live token-leak was found+fixed in code; console rule is the stopgap); Playwright role-sweeps + screenshots (standing deferral, checklists in `OWNER-ACTION-BACKLOG.md`); database backup/DR (Owner-deferred), sitemap/robots (Owner will do), C-13 group fixtures.

## 3 — The canonical documents (authority order)

1. `redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md` — THE rulebook. Key sections: STOP rule + **Owner-stop override** (Owner "stop" in chat beats the goal — the agent once kept working through a stale goal hook and apologised); §0 bootstrap + **baselines BY IDENTITY** (inherited from latest progress file, never plan text; currently 5 vitest failures: admin-access ×2, ManualBookingForm ×3); §1 hard rules (Zone-2 ⛔ triggers incl. data-mutating SQL, deploys, real-email sends to non-`*.example.test`; git bans; DO-NOT-TOUCH incl. booking `9d55ce2a`); §2 orchestration loop; **§2.8 medium-throughput**; **§2.9 FAST-PATH** (phase batching 2–3, pipelined verification w/ freeze-on-FAIL, FULL vs TARGETED verification tiers, worker one-pager, ⛔ forecasts); §3 interrupts/resume (checkpoint commits, parent-SHA check, ungraceful-loss rule); §4 order; **§5 capability-based model routing** (Opus 5 session; explicit model per dispatch; sonnet wherever effective incl. ALL verification; opus for schema/RPC/recurrence-math/concurrency/live-surfaces; justification logged per opus dispatch).
2. `SUBAGENT-RULES.md` — the one-page worker contract (workers read this, not the protocol).
3. `BAND-C-MASTER-PLAN.md` (checklist rows), `BAND-C-MIGRATION-LEDGER.md`, `BAND-C-REFINEMENT-2026-07-26.md` (D1–D26 decisions; D17 unused; D19 withdrawn — site serves ONLY `rahmatherapy.uk`), `DRIFT-CHECKPOINTS.md` + `DRIFT-CHECKPOINT-3-FORMAL.md`, `OWNER-ACTION-BACKLOG.md`, per-plan progress files (the position of record alongside git), `C-C-SINGLE-AGENT-ADDENDUM.md` + `AGENTS.md` (Codex-only; ultracode sessions ignore).
4. Historical: `HANDOFF-2026-05-26-POST-C-B.md` (+§5.26), the 23 refined plans + briefs.

## 4 — Engagement history (compressed)

1. **Refinement pass (2026-07-25/26, this seat):** all 23 plans reconciled with the post-merge build (`ea97932`). 147 evidence-cited findings via batched review agents + adversarial verification; cross-plan synthesis (collision map, migration ledger — zero DDL conflicts proven); Owner checkpoint approved D1–D26; surgical per-plan edits behind a mechanical manifest-diff non-removal gate; 23 `docs(redesign): C-NN refinement` commits + deliverables. Batching-with-disk-persistence adopted after limit bursts killed two full 23-agent runs.
2. **Execution machinery:** protocol authored, red-teamed ×3 (19+14 defects found and fixed — e.g. tautological serialization gates, baseline-by-count masking, missing deploy triggers, dispatch-package gaps). Evolved through: HARD-STOP/⏸ conventions → single-session orchestrator model → 4,000-char goal cap workaround → §2.8 → capability routing (§5, after Sonnet→Opus→Sonnet→Opus oscillation the Owner settled: Opus 5 orchestrator + capability-routed workers) → §2.9 fast-path + SUBAGENT-RULES (answer to "still too slow": the serial implement→verify chain dominates; batching + pipelining + lighter worker bootstrap recover ~1.5–2.5×; parallelism alone cannot compress a dependency chain).
3. **Implementation history:** sessions have alternated models; agent handoffs pasted by the Owner each time; this seat verified position from git and produced the next prompt. Verification tiers have caught REAL bugs throughout: C-01 plain-text override leg, C-04a three blockers, C-05 fullScope notice suppression, C-07's A3 defeated filter + B4 plan-vs-reality (saved-filters bar already existed pre-Band-C → closed VERIFY-ALREADY-IMPLEMENTED + per-staff-id namespacing fix), drift checkpoint #2's manage-link-rotation bug, C-17's GA-would-leak-manage-token (plan itself specified the leak; dropped on Owner ruling), C-18's live Sentry replay token leak (found + fixed).
4. **Mid-run audit (this seat, 2026-08-02):** 6-agent read-only panel — verdict on-track; 2 real C-08 gaps filed to backlog (role-vs-permission mismatch on /admin/me opt-in; no email-level dedup in the resolver); drift-FAIL handling verified genuine; a stub audit return was caught and re-run (C-15 then verified exemplary — render-parity gate real).

## 5 — The prompt system (current template + rules)

**Setup steps the Owner performs:** `/model` → Opus 5; optionally env `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`; then ONE pasted message.

**Template skeleton (keep <4,000 chars):**
`/goal ultracode — RESUME and COMPLETE the Band C implementation programme as ORCHESTRATOR.` then, in order: **(1) BINDING RULEBOOK** — read protocol end-to-end; name §2.9 fast-path + §2.8 minimums explicitly ("use ultracode workflows and sub-agents"; batching, pipelining, tiers, SUBAGENT-RULES, ⛔ forecasts; sequentializing = logged deviation; speed never buys thinner verification); name §5 routing explicitly (explicit model per dispatch, sonnet-where-effective, opus justification). **(2) Pointer to the position file** — the newest interrupt-checkpoint block or resume brief. **VERIFIED POSITION** — shipped count + in-flight state, "git wins; disagreement = STOP". **FIRST ACTIONS** — numbered; embed the Owner's answers to any pending ⏸ so no round-trip is wasted. **STANDING FACTS** — maintenance.ts; deferral policy; recorded deploy decisions; **Owner-stop override**. **GOAL COMPLETE ONLY WHEN** — all 22 rows ✅, verified per tier, gates by identity, drift checkpoints, final report. **PAUSES COUNT AS ON-TRACK** — ⛔/⏸ wait for per-action approval; never push/stage-broadly/"clean" the tree/edit outside files-touched; contradiction = STOP.

**Resume-after-limit line:** `ultracode — resume per redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md §3`.
**Review handshake:** Owner says **"done — review it"** → this seat runs the full independent end-of-programme review (multi-agent, read-only).

**Process for every "agent stopped, give me an updated prompt" request:** ① git forensics (shipped/checkpoint/migration greps, status, HEAD) — never assume; ② read the newest checkpoint/progress entries the handoff cites; ③ fold in any new Owner decisions/audit feedback as FIRST ACTIONS; ④ full prompt, reprinted whole.

## 6 — What the Owner asks of this seat, verbatim patterns

- "the agent stopped, heres its last output … check its current progress then give me an updated prompt" → §5 process.
- "check its work, has it strayed?" → read-only audit fan-out (per-plan conformance + protocol compliance + fresh-eyes bug hunt), findings ranked, NO changes.
- "make sure it uses workflows … faster but still rigorous" (recurring) → diagnose honestly (serial chain vs parallelism), propose bounded protocol amendments, apply only on "apply it".
- Routing changes ("use sonnet for X, opus for Y") → §5 edit + commit + full reprinted prompt.
- "review, analyse and assess only, do not make any changes" → absolute; even bookkeeping waits.

## 7 — Outstanding promises of this seat

1. **Full end-of-programme review** on "done — review it" (4 plans remain: C-19 finish, C-20, C-14, C-10 — C-23 likely closes soon; drift checkpoint #4 falls after plan #20).
2. Watch items for that review: the C-19 reorder logging; C-23 informs-never-disables + payload-identity gates; C-14's atomic co-deploy (migration + 3 code fixes); C-10's catalogue timing; backlog items closed or consciously deferred; the four-in-one deploy checklist completeness; maintenance.ts flip verified in the deploy sequence.
3. Memory files in `~/.claude/.../memory/` also carry state — keep them current at milestones.

## 8 — Pre-flight for the new advisor session

1. `git branch --show-current` → master; `git log -1 --oneline`; `git status --porcelain` (expect: intentional deletions/untracked + `maintenance.ts` modified + possibly in-flight progress-file edits).
2. `git log --oneline --grep="shipped" | head` and `--grep="interrupt checkpoint"` → reconcile against §2; if moved, the newest checkpoint/progress file is the position of record.
3. Report a 5-line state summary (shipped count, in-flight, HEAD, uncommitted, next §4 plan) and STOP — await the Owner's instruction. Default posture: analyse, present, pause; per-action approval; terse; tradeoffs surfaced; they decide.
