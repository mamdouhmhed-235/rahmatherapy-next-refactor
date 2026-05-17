# Deferrals — dashboard-owner-admin

## Severity tint inline OKLCH literals (dashboard-cards.tsx)

- **Source:** Step 11a token-drift grep
- **Verbatim:** `border-[oklch(88%_0.045_20)] bg-[oklch(95.5%_0.028_20)]/30` (and matching warning/clear variants) at `dashboard-cards.tsx:133-134, 423-425`
- **Defer to:** Phase 7
- **Why deferred:** existing `--admin-danger-bg/--admin-warning-bg/--admin-success-bg` tokens use lower-chroma hex values than the OKLCH literals chosen by the polish loop; swapping inline would shift visual weight and risk a polish regression. Phase 7 audit gauntlet can add `--admin-{severity}-bg-strong` tokens once the system-wide severity palette is reconciled across pages.
- **Provisional Phase 6 answer used to continue this session:** keep the OKLCH literals (semantic brand-band hues 20/65/155; not raw arbitrary colour).

## AI-slop verdict REGRESSED at Step 12b

- **Source:** Step 12b critique subagent
- **Verbatim:** "REGRESSED — structurally the page hits brief targets but visually it has slid into three named PRODUCT.md anti-patterns simultaneously: an icon+heading+text identical-row grid inside Urgent Attention, a header right rail that has expanded into a second navbar with duplicated controls, and the absence of the Cormorant marquee numeral that was the panel's named brand signature."
- **Defer to:** Phase 7
- **Why deferred:** the four highest-leverage fixes (restore Cormorant marquee numeral, collapse header rail to brief spec, replace Urgent Attention zero-state identical rows with single "All caught up" empty state, fix mobile bottom-tab overlap) overlap the audit's P1 list and require fresh brief-iteration rather than the bolder/distill axes the recipe's loop-twice rule prescribes. Running bolder/distill in this corrective dispatch (P0s already addressed in-session) would not change the underlying Tier 2 architecture or restore the Cormorant numeral; only a fresh shape pass can.
- **Provisional Phase 6 answer used to continue this session:** ship Phase 6 with the REGRESSED critique on the record and the P1 set tagged for `/impeccable audit admin` in Phase 7.

## Mobile bottom-nav overlap with page main

- **Source:** Step 7 visual self-audit (375 viewport)
- **Verbatim:** Mobile fixed bottom navigation visually covers the lower portion of `<main>` because `<main>` lacks safe-area bottom padding.
- **Defer to:** post-launch / 00-shared-components session
- **Why deferred:** `shell-variant.ts` and the admin shell layout are out of scope per the recipe's "Files to NEVER touch" list.
- **Provisional Phase 6 answer used to continue this session:** no change in this session.
