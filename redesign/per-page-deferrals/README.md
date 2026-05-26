# Per-page deferrals — Phase 6 → Phase 7 bridge

This directory holds per-page deferral files written by autonomous `/goal` agents during Phase 6 implementation. Each file (`<slug>-deferrals.md`) records open questions, polish opportunities, or post-launch concerns that surfaced during a page's redesign but were intentionally NOT answered in Phase 6.

The Phase 7 gauntlet agent (`/impeccable audit admin`) reads all deferral files together and resolves them globally. This is the canonical bridge between Phase 6 (per-page implementation) and Phase 7 (whole-admin audit).

## Why deferrals exist

Some questions impeccable surfaces during a `/goal` session are open suggestions, polish opportunities, or post-launch concerns that belong to a later phase. The autonomous agent has no human in the loop, so it can't ask "should we do X?" mid-run. Three options:

1. **Invent an answer** — risks introducing decisions that contradict future phases.
2. **STUCK** — over-strict; trivial questions block real progress.
3. **Defer** — record the question with a provisional Phase 6 answer, let Phase 7 resolve it globally with full cross-page context.

Option 3 is what these files implement. Each per-page recipe's `## Decision-making directives` section instructs the agent to defer in this directory.

## File naming

`<slug>-deferrals.md` where `<slug>` matches the page slug used in the recipe filename. Examples:

- `login-deferrals.md`
- `dashboard-coordinator-deferrals.md`
- `email-templates-deferrals.md`

26 files total when Phase 6 completes (one per page recipe).

## Format

Each deferral entry uses this canonical format (per the recipe's Decision-making directives):

```markdown
## <Question summary>
- **Source:** <step number / skill / file:line>
- **Verbatim:** <what impeccable or the brief or your own observation said>
- **Defer to:** Phase 7 / Phase 8 / post-launch
- **Why deferred:** <one sentence>
- **Provisional Phase 6 answer used to continue this session:** <if any>
```

Multiple entries per file (one per deferred question) under the same `## ` heading style.

## "No deferrals" sentinel

When a page closes Phase 6 cleanly (no questions deferred), the agent still writes the file with this sentinel:

```
(no deferrals — Phase 6 closed cleanly for <slug>)
```

A missing file is ambiguous (did the agent skip writing it, or were there no deferrals?). The sentinel makes closure explicit. The Step 13 handoff checklist enforces this.

## Who reads these files

- **Main agent** (user's primary session) reads each file at QC time per [POST-AGENT-AUDIT-PROTOCOL.md §2E](../POST-AGENT-AUDIT-PROTOCOL.md). Anything that should NOT have been deferred (e.g. a real brief contradiction) → re-dispatch the spawned agent.
- **Phase 7 gauntlet agent** (`/impeccable audit admin`) reads all 26 deferral files together to produce `FINAL-AUDIT.md`. Cross-page deferrals get aggregated; single-page polish opportunities get scheduled into Phase 7 fixes.
- **Phase 8 extract agent** reads any "Defer to: Phase 8" entries that survived Phase 7.

## Lifecycle

1. **Phase 6 (now):** spawned agents write here during their `/goal` sessions.
2. **End of Phase 6:** main agent verifies every page has a deferral file (sentinel or content).
3. **Phase 7:** gauntlet agent reads all files, classifies, fixes or schedules.
4. **Phase 7 close:** files remain as a historical record of what was deferred and why.
5. **Phase 8 / post-launch:** any "Defer to: Phase 8" or "Defer to: post-launch" entries become inputs to those phases.

## What does NOT belong here

- Bugs the agent should have fixed in Phase 6 — those go in the audit findings, not deferrals.
- Brief contradictions — those become STUCK (the agent stops; user resolves).
- Cosmetic polish that the Step 7b polish loop already addresses — addressed inline, no deferral needed.
- Questions about *other* pages — each agent writes only its own deferral file.

If a question is deferrable, it belongs here. If it isn't, the recipe's Decision-making directives + STUCK clause tell the agent what else to do.
