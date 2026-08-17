# Safety Net Chosen: A — git

> ⛔ **HISTORICAL — this describes the rollback net for a phase that closed three months ago.**
> ✅ Both anchors still resolve, so the commands below would still work: tag `redesign-baseline`
> → `a9ef885`, branch `redesign/start-state` → `0325838`. But the site has since shipped Bands A-C
> and the whole SEO/AEO/GEO programme, so rolling back to that baseline would discard essentially
> the entire product. **Do not treat this as a current recovery procedure.**
> ⚠️ This file appears heavily cited (~31 inbound), but that is an artefact: 26 of those are one
> boilerplate reading-list line copy-pasted across the per-page recipes.
> **Current position: `redesign/HANDOFF-2026-08-17-IMPLEMENTATION-10.md`.** *(Stamped 2026-08-17.)*

- Starting branch: redesign/start-state
- Starting tag: redesign-baseline
- Remote: none
- Date set up: 2026-05-10
- Rollback command (full reset to baseline): `git reset --hard redesign-baseline`
- Rollback command (one page only): `git revert HEAD`
- Rule: no edits reach the live site or main branch until Phase 7 sign-off.
