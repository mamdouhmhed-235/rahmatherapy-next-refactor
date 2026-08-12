# F7-primary-120-165 — Adversarial Verification Verdict

**Verdict: PARTIALLY_DEFECTIVE**

All eight checklist items were run against the real files (`src/styles/tokens.css`,
`src/app/admin/clients/[clientId]/page.tsx`, `src/components/ui/button.tsx`,
`src/app/admin/audit/AuditEventCard.tsx`, `src/app/admin/emails/ReminderResendForm.tsx`,
`src/app/admin/staff/page.tsx`, `src/components/ui/input.tsx`, `src/app/booking/manage/page.tsx`,
`src/app/booking/manage/ManageBookingForms.tsx`, `scripts/verify-admin-token-contrast.mjs`,
`redesign/evidence/post-band-c-impl/item-7/TAIL-CENSUS.md`, `F1-scrim.md`, `F2-shadow.md`), not
against the proposal's prose. Every mechanical claim — light-value byte-identity, role
agreement, find-string exactness, line numbers, dark-value direction, ratio arithmetic,
occurrence-count completeness — checks out. All 583→17 occurrences at all 11 sites (plus the 3
dead-fallback sites) were re-read from source and match exactly. Ratios were recomputed with the
shipped `resolveColour`/`contrastRatio`/`parseTokensCss` helpers (imported live, not
reimplemented) and every one lands within 0.01 of the claimed figure. One MAJOR finding survives:
a false, checkable claim about a token reaching the public `/booking/manage` route, used to
characterize the urgency of a disclosed (not fixed) WCAG failure. One MINOR finding: a source
comment is cited at the wrong line number.

## Checklist results

1. **Light byte-identity** — PASS, all 14 literals. Every `lightValue` in the proposal was
   diffed byte-for-byte (underscores→spaces) against the `find` string actually present in
   source at the cited line, for all 11 minted tokens and all 3 dropped fallbacks. No
   discrepancy found.

2. **Role agreement** — PASS, all 11 sites. Every `hover:bg-` / `active:bg-` / `bg-` / `text-` /
   `border-` site takes a token whose name's role suffix (`-bg-hover`, `-card-hover`,
   `-hover-moss`, `-active-moss`, `-button-primary-active`, `-avatar-bg`, `-avatar-bg-alt`,
   `-border-strong`, `-icon`, `-workload-success-icon`, `-workload-success-dot`) matches the CSS
   property the Tailwind utility actually sets. No `text-` site was given a `-bg` token or vice
   versa.

3. **Find-string exactness** — PASS, all 11 sites re-read directly from source, each occurring
   **exactly once** on its stated line with no ambiguity (no shared literal prefixes, no `/NN`
   opacity suffix trailing the bracket that the `find` string would have needed to include):
   - `clients/[clientId]/page.tsx:978,1553` — `hover:bg-[oklch(88%_0.055_155)]` — exact.
   - `clients/[clientId]/page.tsx:651` — `hover:bg-[oklch(91.5%_0.045_155)]` — exact.
   - `button.tsx:29,35` — both lines carry **two** distinct literals
     (`hover:bg-[oklch(95.5%_0.012_155)]` and `active:bg-[oklch(92%_0.022_155)]`) back to back;
     confirmed each find string matches only its own literal, not the other.
   - `button.tsx:26` — `active:bg-[oklch(15%_0.065_155)]` — exact, and confirmed it sits in the
     same class string as the already-tokenised `bg-[var(--admin-primary)]` /
     `hover:bg-[var(--admin-primary-hover)]`, as claimed.
   - `AuditEventCard.tsx:30,60,64` — `text-[oklch(38%_0.10_155)]`, `bg-[oklch(91%_0.025_155)]`,
     `bg-[oklch(92%_0.025_120)]` — exact.
   - `ReminderResendForm.tsx:111` — `border-[oklch(70%_0.10_155)]` — exact; not confused with the
     adjacent bare `border` utility on the same line.
   - `staff/page.tsx:702,830` — `text-[oklch(35%_0.085_155)]`, `bg-[oklch(50%_0.085_155)]` — exact.
   - `input.tsx:32,34,108` — `text-[var(--admin-body,oklch(23%_0.01_143))]`,
     `placeholder:text-[var(--admin-text-muted,oklch(42%_0.008_143))]`,
     `text-[var(--admin-heading,oklch(11%_0.014_155))]` — exact.

4. **Line drift** — PASS. All 14 cited lines confirmed current on direct read; none had drifted.

5. **Dark-value direction** — PASS, checked against the actual shipped `tokens.css` values (not
   the proposal's restated numbers):
   - `--admin-hover-mist` really is `oklch(95.5% 0.022 247)` → `oklch(27% 0.018 247)`;
     `--admin-hover-moss`'s dark L (27%) matches it exactly, as claimed.
   - `--admin-selected-sky` really is `oklch(92% 0.05 247)` → `oklch(33% 0.048 247)`;
     `--admin-active-moss`'s dark L (33%) matches it exactly, as claimed.
   - `--admin-status-confirmed-bg` really is `oklch(93.5% 0.038 155)` → `oklch(29% 0.052 158)`;
     `-bg-hover` (38%) and `-card-hover` (33%) both correctly *lighten* past the base's dark
     value (29%), matching the "hover = more luminance in dark" rule, while the *avatar-bg*
     tokens (static-panel role, not hover) correctly follow the base's own darkening ratio
     instead (91%×0.310≈28%, 92%×0.310≈29%) — the two different shapes for two different roles
     are both applied correctly, not mixed up.
   - `--admin-status-confirmed-text` really is `oklch(22% 0.085 155)` → `oklch(89% 0.105 158)`;
     `-icon` and `-workload-success-icon` both use the same light+dark≈111 rule and both
     correctly lighten in dark (foreground role).
   - `--admin-chart-status-confirmed` really is `oklch(58% 0.18 155)` → `oklch(76% 0.160 155)`
     (ratio 1.310×); `-workload-success-dot`'s 50%→66% (1.320×) matches this shape.
   - `--admin-primary`/`--admin-primary-hover` really do lighten in dark (76%→85%) despite
     darkening in light; `--admin-button-primary-active` continues that shape one step further
     (15% light, 92% dark). Direction correct, though the magnitude is honestly flagged by the
     proposal itself as a judgement call with no true hue-155 sibling to measure against.
   - No wrong-direction value found anywhere in the family.

6. **Ratio arithmetic** — PASS, all 11 tokens, recomputed with the shipped helpers themselves
   (imported live from `scripts/verify-admin-token-contrast.mjs` into a scratch script in the
   system temp directory, not reimplemented):

   | token | dark computed | dark claimed | light computed | light claimed |
   |---|---|---|---|---|
   | `--admin-status-confirmed-bg-hover` | 7.22 | 7.22 | 11.80 | 11.80 |
   | `--admin-status-confirmed-card-hover` | 10.57 | 10.57 | 13.76 | 13.76 |
   | `--admin-hover-moss` | 11.16 | 11.16 | 10.77 | 10.77 |
   | `--admin-active-moss` | 8.98 | 8.98 | 9.70 | 9.70 |
   | `--admin-button-primary-active` (vs white) | 1.25 | 1.25 | 19.32 | n/a |
   | `--admin-status-confirmed-icon` | 7.65 | 7.65 | 9.42 | 9.42 |
   | `--admin-status-confirmed-avatar-bg` | 10.76 | 10.76 | 12.84 | 12.84 |
   | `--admin-status-confirmed-avatar-bg-alt` | 10.45 | 10.45 | 13.12 | 13.12 |
   | `--admin-status-confirmed-border-strong` | 1.70 | 1.70 | 2.15 | 2.15 |
   | `--admin-workload-success-icon` | 9.37 | 9.37 | 10.25 | 10.25 |
   | `--admin-workload-success-dot` | 6.35 | 6.35 | 5.46 | 5.46 |

   Every value is within 0.01 of the claimed figure — well inside the shipped verifier's own
   0.15 tolerance (`RATIO_TOLERANCE` in `verify-admin-token-contrast.mjs:323`). Every
   `ratioAgainst` token (`status-confirmed-text`, `heading`, `body`, `panel`, `canvas`,
   `status-confirmed-bg`) exists in `tokens.css`. Independently re-verified the pre-existing
   `--admin-primary`/`--admin-primary-hover` dark-vs-white numbers the proposal cites
   (2.11:1 / 1.57:1) — both reproduce exactly, confirming the "already shipped, not introduced"
   claim about that inherited defect is accurate.

   Also confirmed, by reading `derivePairs()` at `verify-admin-token-contrast.mjs:596-598`, that
   the proposal's central technical claim about the verifier — "any token carrying the strict
   trailing `/* N:1 vs X */` comment gets auto-checked at AA 4.5:1 in **both** themes,
   unconditionally" — is exactly correct, and that `add()`'s `if (!(fg in tokens) ...) return`
   guard (line 537) does silently drop an unresolvable `"white"` reference, matching the claim
   about `--admin-button-primary-active`. The 2 tokens routed to prose instead of the strict
   form would indeed have failed that check (confirmed: `--admin-status-confirmed-border-strong`
   at 2.15/1.70 and `--admin-button-primary-active` at 1.25 dark are both < 4.5).

7. **Completeness** — PASS. Summed the proposal's own occurrence counts: 2+1+2+2+1+1+1+1+1+1+1
   (11 mints) + 1+1+1 (3 dead fallbacks) = 17, matching the family header exactly. Cross-checked
   every one of the 14 literals against `TAIL-CENSUS.md`'s independent per-literal occurrence
   counts — all match. Additionally swept the census for every OTHER hue-120–165 literal not in
   this family's list, to rule out an undercount: `oklch(12% 0.01 165)` (16×),
   `oklch(11% 0.014 155 / 0.45)` (1×) and `oklch(12% 0.014 155)` (1×) are hue-155/165 but are
   already claimed by `F1-scrim.md` (confirmed: F1's own literal table lists exactly these
   three); the seven `oklch(23% 0.073 155 / A)` shadow-alpha literals (16× total) are hue-155
   but already claimed by `F2-shadow.md` (confirmed: F2's own table lists exactly these seven).
   No hue-120–165 literal is claimed by two families, and none is left unclaimed by any family.

8. **The unasked question — two findings survive:**

   **MAJOR — the `--admin-button-primary-active` rationale asserts the site "is ... also
   rendered on `/booking/manage`," which is false.**
   The token's only site is `button.tsx:26`, the `admin-primary` *variant* of the shared
   `<Button>` (`buttonVariants` cva). Checked every `<Button>`/`variant=` usage under
   `src/app/booking/manage/`:
   - `ManageBookingForms.tsx:176` renders `<Button type="submit" disabled={...}>` with **no**
     `variant` prop, so it resolves to `buttonVariants`'s `defaultVariants.variant = "primary"`
     (`button.tsx:12-13`: `"bg-primary text-primary-foreground shadow-soft hover:bg-primary/90"`)
     — the **public-site** variant, a wholly different class string that never references
     `--admin-primary`, `--admin-primary-hover`, or the `oklch(15%_0.065_155)` literal at all.
   - `page.tsx:83-84` has one `variant=` prop in the whole file: `<Badge variant="secondary">`
     — an unrelated component, styled with `--rahma-green`/`--rahma-muted`, not `--admin-*`.
   - No other file under `src/app/booking/manage/` references `variant="admin-primary"` or
     imports anything from `button.tsx`'s admin variants.
   So `admin-primary`'s `:active` fill — the literal this token replaces — is **not** reached by
   `/booking/manage` today. (`--admin-primary` *is* confirmed used elsewhere in the live admin,
   in ≥3 files under `src/app/admin/**`, so "admin-wide default" is fair; only the
   "`/booking/manage`" clause is wrong.) This matters because the proposal uses the claim to
   frame the urgency of a real, disclosed defect it chooses only to flag (`--admin-primary` /
   `--admin-primary-hover` / this new token fail AA against their hardcoded `text-white`, at
   2.11:1 / 1.57:1 / 1.25:1) rather than fix — and the section is explicitly headed "proved (not
   assumed)" for an adjacent claim (the input.tsx fallback chain), lending false confidence to
   this unproven one by association. Does not change the correctness of the mint itself (colour
   values, ratios, and the `button.tsx:26` find/replace are all still right) — this is an
   evidence-accuracy defect, not a code-correctness one.

   **MINOR — "the line-29 comment literally names this colour 'Hover Moss'" cites the wrong
   line.**
   `button.tsx:33` (`// Ghost: no border, no fill. Hover Moss on hover.`) sits directly above the
   `admin-ghost` variant (`:34-35`), not above `admin-secondary` (`:28-29`), whose own comment
   (`:27`, `// Secondary: Form Seam border, transparent fill.`) says nothing about "Hover Moss."
   The token still correctly covers both sites (`:29` and `:35` both do use the literal), and the
   naming choice itself is reasonable either way — but the specific textual citation of "line-29"
   as the comment's location is wrong; it's line 33, annotating line 35.

## Other checks performed, no defect found

- Confirmed all three `input.tsx` fallback literals (`:32`, `:34`, `:108`) are provably dead: `
  --admin-heading`/`--admin-body`/`--admin-text-muted` are declared unconditionally in
  `tokens.css`'s bare `:root {}` (lines 73-76), `globals.css:4` imports `tokens.css`
  unconditionally, and `src/app/layout.tsx` is the sole file at `src/app` depth 1 named
  `layout.tsx` that renders `<html>` (confirmed via directory listing: only
  `src/app/layout.tsx`, `src/app/(public)/layout.tsx`, `src/app/admin/layout.tsx` exist, and the
  latter two are nested layouts per Next.js App Router semantics). `/booking/manage` has no
  `layout.tsx` of its own and sits outside the `(public)` route group, so it inherits directly
  from the one true root layout — same conclusion as the proposal, and here the "reaches every
  route including `/booking/manage`" claim IS correct (unlike the button-variant claim above).
- Swept for print-mode interaction: none of the 11 F7 sites carry a `print:` Tailwind modifier
  (cross-checked against `TAIL-CENSUS.md`'s per-literal "modifiers seen" field, which does flag
  `print:` on unrelated hue-80 literals elsewhere in the same file) — no print-block risk.
- Swept for inline `style={{...}}` object usage: all 11 F7 sites are Tailwind arbitrary-value
  bracket utilities inside `className` strings (confirmed via `TAIL-CENSUS.md`'s "roles seen"
  field showing `bg`/`text`/`border`, never "—"/non-utility) — no inline-style/var() risk.
- Swept `src/**/*.test.*`, `src/**/*.spec.*` and `e2e/` for any of the 11 literal substrings
  (`0.055_155`, `0.045_155`, `0.012_155`, `0.022_155`, `0.065_155`, `0.025_155`, `0.025_120`,
  `0.10_155`, `0.085_155`, `0.01_143`, `0.008_143`, `0.014_155`) — zero matches, no test
  depends on any of these literal values.
- Confirmed `--admin-primary-active` (the existing, differently-hued token the proposal declines
  to reuse) really is consumed only by `admin-ui.tsx:1345`, paired with
  `var(--admin-on-primary)` — a different `AdminButton` implementation from `button.tsx`'s cva
  variants, as claimed.
- Confirmed the existing `tokens.css:227` comment on `--admin-primary-active`
  (`/* AdminButton variant="primary" :active — one step past --admin-primary-hover. */`) and the
  dark-block comment at `:463` (`/* Continues the hover direction: 76% → 85% (hover) → 91%
  (active). */`) match the proposal's citations verbatim.
