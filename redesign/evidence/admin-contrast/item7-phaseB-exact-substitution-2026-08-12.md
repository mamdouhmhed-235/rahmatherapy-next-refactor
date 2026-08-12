# Item 7 Phase B — the provably appearance-preserving substitution (2026-08-12)

Base: HEAD `f7a8ccd`. Every figure below was re-derived fresh; nothing is carried
over from §7 of the plan, whose counts all predate item 8.

## Census, re-derived from scratch

```
rg -o --no-filename 'oklch\(' src/app/admin src/components/ui -g '*.tsx' -g '*.ts' | wc -l
```

| | Plan §7.6 | Measured today | |
|---|---|---|---|
| occurrences | 717 | **717** | matches |
| files | 102 | **103** | +1, item 8 |
| distinct values | 94 | **96** | +2, item 8 |
| `ManualBookingForm.tsx` | 79 | **78** | −1, item 8 |
| top-10 sum | 483 | **481** | −2 |

## Classification of all 96 distinct literals

Produced by resolving each literal against `parseTokensCss()`'s own output —
the SHIPPED parser from `scripts/verify-admin-token-contrast.mjs`, reused rather
than reimplemented (§7.8's instruction). Numeric equality, so `0.120` and `0.12`
are recognised as the same colour rather than a near miss.

| Bucket | Occurrences | Distinct |
|---|---:|---:|
| **EXACT** — a token whose LIGHT value is the same colour | **590** | 29 |
| NEAR — small delta, needs judgement | 38 | 20 |
| NONE — no reasonable token, needs a new pair | 75 | 39 |
| **DYNAMIC** — `oklch(88% 0.025 ${hue})`, runtime-computed | **14** | 8 |

## What was applied: 549 of the 590 EXACT occurrences

Substitution was gated on a **role-agreement check**: the Tailwind utility prefix
at each call site must agree with the token's role suffix. A `text-` site may not
take a `-bg` token. 36 sites disagreed and were **skipped, not guessed at**.

That check earned its place. The clearest example:

```
src/app/admin/clients/[clientId]/page.tsx: bg-[oklch(99.5%_0.003_88)] -> --admin-on-primary
```

`--admin-on-primary` is the foreground painted on a primary fill; it stays near-white
in dark mode by design. Substituting it as a *background* would have rendered a
near-white panel in dark mode — a defect introduced by the very sweep meant to fix
dark mode. A blind global replace ships that.

## Verification — light mode is the control

| Check | Before | After | |
|---|---|---|---|
| raw census | 717 | **168** | −549, exactly the substitution count |
| Layer 1 total failures | 456 | **176** | −280 |
| Layer 1 **dark** | 377 | **97** | −280 |
| Layer 1 **light** | 79 | **79** | **unchanged — the control held** |
| Layer 1 unresolved | 240 | **240** | no increase (§7.7b hard stop clear) |
| Layer 2 | 0 | **0** | |
| `tsc` | 0 | 0 | |
| `pnpm lint` | 59E/7W | 59E/7W | same six files |
| `vitest` | 5F/2372P (2377) | 5F/2372P (2377) | same five named |

**Light failures unchanged at exactly 79** is the proof §7.7 asks for: every
substitution replaced a literal with a token whose light value is numerically
identical, so light mode cannot have moved. The entire −280 is dark mode
becoming correct — which is the defect this item exists to fix.

## `/booking/manage` — the customer page, proven unchanged without a screenshot

§7.7a requires the customer page be captured as a control before any UI primitive
is edited. A visual capture needs an authenticated session, which no agent may
create. A stronger proof was available instead:

1. `data-theme` is set by exactly one file — `admin/components/ThemeProvider.tsx`.
   Nothing under `src/app/booking/` or `src/app/(public)/` sets it
   (`rg -n 'data-theme' src/app/booking "src/app/(public)"` → no matches).
2. So on `/booking/manage` neither `[data-theme="dark"]` nor `[data-theme="light"]`
   matches, and every `--admin-*` token resolves from `:root`.
3. All **26** tokens referenced by the three customer-rendered primitives
   (`badge.tsx`, `button.tsx`, `input.tsx`) have byte-identical `:root` and
   `[data-theme="light"]` values — checked programmatically against
   `parseTokensCss()`'s `scopes.root` vs `scopes.light`.

Therefore the customer page renders the same bytes as before. This is a stronger
guarantee than a visual diff, which could only have shown that it *looked* the same.

## What remains, and why it was not done blind

**168 occurrences remain**, in three buckets that all need a decision rather than a
substitution:

- **36 role disagreements** — real design choices (an error-red *border* that reuses
  the error-text value; a solid amber chip using the attention-text value as a fill).
  Each needs a per-site call about which token is semantically right in dark mode.
- **75 occurrences / 39 distinct with no reasonable token** — these need new token
  PAIRS added to `:root`, `[data-theme="dark"]`, `[data-theme="light"]` AND
  `@media print` (§7.6's warning). That is Phase A design work, not mechanical.
- **14 occurrences / 8 distinct that are DYNAMIC** — e.g.
  `oklch(88% 0.025 ${hue})`, a runtime-computed hue. **These cannot be substituted
  for a static token at all.**

## ⛔ New finding: Phase C's zero-tolerance ratchet is unreachable as specified

§7.8 specifies the guard as "fail if a new `oklch(` literal appears in
`src/app/admin/**` or `src/components/ui/**`", started at the current census as a
ratchet and "flip to zero-tolerance on completion".

**Zero is not reachable.** The 8 dynamic patterns compute their hue at runtime and
have no static token equivalent. §7 never mentions them. The guard must either
carry an explicit allowlist for the computed-hue call sites, or stop at a non-zero
floor and say why. Recorded here rather than worked around silently.
