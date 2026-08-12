# Critique — Lens: dark-direction

Diff under review: `04e1b0c..c50cb6a` (8 commits, `git log --oneline 04e1b0c..c50cb6a`).
Claim under test: every one of the 58 new tokens' DARK value is correctly directioned,
readable against the surface/foreground it actually sits on, and role-consistent with
the family it belongs to.

Verdict: **PARTIALLY_DEFECTIVE**. Hover/active direction is correct on every one of the
~20 hover/active tokens checked (light darkens, dark lightens, with no exceptions), and
readability is fine everywhere it was checked directly against a real call site's actual
surface/foreground (avatar tints vs status text: 8.5–10.8:1 in dark; chip icons vs panel:
5.7–7.9:1; `--admin-tone-warning-fill` / `--admin-tone-success-fill` both clear the
unfilled-dot border by 4–7:1 and both correctly go *lighter* in dark, matching the
family-wide "more emphasis = more luminance in dark" pattern). But one new token
(`--admin-button-primary-active`) was given a dark value that mirrors the wrong family's
hue, and one (`--admin-status-confirmed-border-strong`) fails to deliver the emphasis its
name promises in dark even though its own light value and its sibling tokens do.

Method: read every call site the diff touches (`git diff 04e1b0c..c50cb6a` for non-CSS
files) to identify the real surface/foreground each new token sits against, then computed
contrast with `parseTokensCss` / `resolveColour` / `contrastRatio` imported by file URL
from `scripts/verify-admin-token-contrast.mjs` in a throwaway script in the system temp
scratchpad (never in the repo). `scripts/verify-admin-token-contrast.mjs` was also run
directly, read-only.

---

## 1. MAJOR — `--admin-button-primary-active`'s dark value uses the pre-rebrand green hue, not the current blue primary's

`src/styles/tokens.css:688` (dark block):

```
--admin-button-primary-active: oklch(92% 0.032 155);  /* 15.01:1 vs on-primary */
```

Hue **155** — the confirmed/success-green hue, and the exact hue `--admin-button-subtle-hover`/`-active`
(`tokens.css:686-687`) also use for the *secondary/ghost* variants' "Hover Moss" accent
(`src/components/ui/button.tsx:29`, comment: `// Ghost: no border, no fill. Hover Moss on
hover.`). That comment confirms hue 155 is a real, intentional accent elsewhere in this
same file — it is simply the wrong accent for this token.

`--admin-button-primary-active` is consumed only by the `"admin-primary"` Button variant
(`src/components/ui/button.tsx:24-26`):

```
// Primary: Clinic Green fill, Field White text.
"admin-primary":
  "bg-[var(--admin-primary)] text-white hover:bg-[var(--admin-primary-hover)] active:bg-[var(--admin-button-primary-active)] ...",
```

`--admin-primary` itself is **blue** in both themes — light `#0f5e8e` → RGB `[15,94,142]`,
dark `oklch(76% 0.098 240)` → RGB `[117,186,233]` — and the comment one line above still
says "Clinic Green fill", a leftover from before the green→blue admin re-theme. The
*existing* (not new) sibling token that correctly tracks that re-theme,
`--admin-primary-active` (`tokens.css:672`, used elsewhere e.g. nav active-state), is
`oklch(91% 0.040 240)` dark → RGB `[202,230,250]`, a pale **blue**. Computed:

| token | theme | raw | RGB | reads as |
|---|---|---|---|---|
| `--admin-primary` | light | `#0f5e8e` | `[15,94,142]` | blue |
| `--admin-primary` | dark | `oklch(76% .098 240)` | `[117,186,233]` | blue |
| `--admin-primary-active` (existing, correct) | light | `oklch(28% .085 247)` | `[0,42,80]` | dark blue |
| `--admin-primary-active` (existing, correct) | dark | `oklch(91% .040 240)` | `[202,230,250]` | pale blue |
| `--admin-button-primary-active` (**new**) | light | `oklch(15% .065 155)` | `[0,18,1]` | near-black, faint **green** cast |
| `--admin-button-primary-active` (**new**) | dark | `oklch(92% .032 155)` | `[213,235,219]` | pale **mint green** |

Direction (light darkens / dark lightens) is correct — the defect is purely hue/role: the
newly-authored **dark** value had a choice to align with `--admin-primary-active`'s blue
family (Rule 3: "mirrors the inversion shape of the nearest existing token family") and
instead copied the *secondary/ghost* button's green-Moss hue. The self-declared ratio
comment (`15.01:1 vs on-primary`) is numerically correct — verified via
`verify-admin-token-contrast.mjs`'s own `verifyRatioComments` — so this passes Layer-2
contrast checking while still being the wrong colour: contrast math does not catch hue.

**Reachability, disclosed rather than assumed:** `variant="admin-primary"` (the only
consumer of this token) is used at exactly three call sites —
`src/app/admin/login/LoginForm.tsx:204`, `src/app/admin/password-reset/PasswordResetSubmitButton.tsx:28`,
`src/app/admin/password-reset/states/Rejected.tsx:33` — and all three are pre-authentication
pages. `src/app/admin/layout.tsx:19-20` bails out (`if (!profile) return <>{children}</>;`)
*before* mounting `<ThemeProvider>` when there is no staff profile (i.e. exactly the login /
password-reset case), and `tokens.css` has no `@media (prefers-color-scheme: dark)` block
(`grep -c prefers-color-scheme tokens.css` → 0) — dark theming is 100% gated on the
`data-theme="dark"` attribute `ThemeProvider` writes. So today, no user can actually see
this dark value: all three call sites render under bare `:root` (light) regardless of OS
or saved preference. That does not make the value correct — it makes it an unverified
landmine: the moment `admin-primary` is used anywhere inside the authenticated (theme-aware)
shell — the most likely next use for "the" primary CTA variant — a press on a blue Save/
Confirm button will flash pale mint-green (the same hue family as this design system's own
"confirmed/success" status colour) in dark mode. Flagging as MAJOR because the value itself
is wrong regardless of current reachability, and because the reachability gap is itself
evidence the sweep never rendered the three sites it does reach to check its own fix.

**Fix:** rebase `--admin-button-primary-active` off `--admin-primary-active`'s hue (247/240)
at both light and dark, the same way `--admin-danger-solid-active` correctly stayed at hue
25 (the danger family's own hue) in both themes.

---

## 2. MINOR — `--admin-status-confirmed-border-strong` promises emphasis in light but delivers none in dark

`src/styles/tokens.css:154` vs `:165` (light) and `:536` vs `:547` (dark):

```
light: --admin-status-confirmed-border:        oklch(88% 0.055 155)
light: --admin-status-confirmed-border-strong:  oklch(70% 0.10  155)   Δ 18pt darker
dark:  --admin-status-confirmed-border:        oklch(42% 0.070 158)
dark:  --admin-status-confirmed-border-strong:  oklch(42% 0.090 158)   Δ 0pt — same L
```

In light, `-strong` is a genuine 18-point lightness drop from the base border (a visibly
bolder ring). In dark, `-strong` sits at the *exact same lightness* as the base border —
only chroma moves (0.070→0.090, a small saturation bump at identical L). Computed contrast
against `--admin-canvas` confirms this is not just an L-arithmetic quirk: `confirmed-border`
vs canvas = light 1.32:1 → dark 2.36:1 (already inverts to something more visible), while
`confirmed-border-strong` vs canvas = light 2.41:1 → dark **2.35:1**, i.e. dark's "strong"
variant is *statistically indistinguishable* from dark's plain variant (2.35 vs 2.36).

This is not how the diff's own sibling `-border-strong` tokens behave — both get a real
step up in dark:

```
dark: --admin-status-cancelled-border 42% → --admin-status-cancelled-border-strong 50%   Δ +8pt
dark: --admin-status-pending-border   43% → --admin-status-pending-border-strong   51%   Δ +8pt
dark: --admin-status-confirmed-border 42% → --admin-status-confirmed-border-strong 42%   Δ  0pt  ← odd one out
```

The only live consumer is `src/app/admin/emails/ReminderResendForm.tsx:111` — the border
around the "reminder sent" success badge. In dark mode the badge will render with
essentially the same-weight ring as an ordinary confirmed chip elsewhere on the page,
losing the extra visual confirmation the "-strong" variant is there to provide. Status is
still conveyed through the badge's bg/text swap, so this is a polish gap, not a functional
break — MINOR.

**Fix:** give dark `--admin-status-confirmed-border-strong` the same ~8pt lift its siblings
get, e.g. `oklch(50% 0.090 158)`.

---

## 3. Informational — the whole `-border-soft` / `-border-vivid` / `-border-strong` tier sits under 3:1 in dark, but this is the pre-existing family's own convention, not a regression

Task asked specifically to flag any new border under 3:1 on the surface it sits on, so
reporting factually. Checked each new border token against both its own fill and
`--admin-canvas` (the page background most of these bordered boxes sit directly on —
`DeliveryTab`'s alert in `src/app/admin/emails/page.tsx:473-480`, `EmptyState`'s warning
tone in `src/app/admin/components/EmptyState.tsx:52-55`, `BulkDeleteToolbar`'s delete
button in `src/app/admin/clients/components/BulkDeleteToolbar.tsx:130-135`, etc.):

| new token (dark) | vs own fill | vs `--admin-canvas` |
|---|---|---|
| `--admin-danger-border-soft` | 2.72:1 | 3.00:1 |
| `--admin-status-cancelled-border-soft` | 1.93:1 | 2.56:1 |
| `--admin-status-cancelled-border-strong` | 2.29:1 | 3.04:1 |
| `--admin-status-pending-border-strong` | 2.35:1 | 3.28:1 |
| `--admin-status-pending-border-vivid` | 2.14:1 | 2.99:1 |
| `--admin-status-confirmed-border-strong` | 1.70:1 | 2.35:1 |
| `--admin-danger-border` | 4.10:1 | 4.52:1 |

None of these clear 3:1 against their own fill; most are borderline-to-failing against
canvas too. But the **pre-existing** status-border family (untouched by this diff, already
shipped) performs *worse* by the same measure: `--admin-status-confirmed-border` /
`-cancelled-border` / `-pending-border` / `-attention-border` / `-restricted-border` each
sit at 1.6–1.7:1 against their own fill and 2.2–2.4:1 against canvas in dark — the exact
same "soft, not the sole differentiator" pattern (status is carried primarily by the fill
colour and paired text/icon, not the border). Every new border token here is equal to or
*better than* that baseline, never worse. Also worth naming: `verify-admin-token-contrast.mjs`'s
`derivePairs()` (`scripts/verify-admin-token-contrast.mjs:522-594`) only builds pairs for
tokens matching `/text|body|heading|muted/i` against the four `REAL_SURFACES`, plus
ratio-commented pairs — it does not test **any** border token, old or new, at 3:1 or at
all. So this whole tier (58-new and pre-existing alike) has zero automated coverage; not a
regression introduced by item 7, but a real, disclosed gap in what "Layer 2: 0 failures"
actually proves.

---

## 4. Explicitly checked per the task's call-outs, found sound

- **`--admin-tone-warning-fill` going lighter in dark (78%→82%) — is that right for a
  progress-bar fill?** Yes. Its sibling `--admin-tone-success-fill` does the same
  (50%→66%, also lighter in dark), matching the family-wide "more emphasis = more
  luminance in dark" pattern used throughout this diff (e.g. `--admin-warning-solid`
  26%→78%). Both fills stay clearly separated from the unfilled-dot colour
  (`--admin-border`, dark 33%): `tone-warning-fill` vs `--admin-border` = 6.84:1,
  `tone-success-fill` vs `--admin-border` = 4.06:1. The relative ordering (warning fill
  brighter/more prominent than success fill) holds in both themes (light 78% vs 50%; dark
  82% vs 66%), so dark doesn't introduce a new relationship, it preserves the existing one.
  `src/app/admin/staff/page.tsx:817-836` (`ProgressDots`) confirms the fill sits against
  `--admin-border` (unfilled dots), not `--admin-text-muted` as the surrounding
  `WorkloadSegment` icon logic might suggest at a glance — read the actual component before
  computing.

- **`--admin-status-*-border-*` values in the 46–60% dark band** — covered in §3 above:
  marginal but consistent with (mostly better than) the pre-existing family; not a
  direction defect, a pre-existing systemic pattern.

- **`--admin-avatar-tint-*` paired with the status `-text` tokens** — all four checked in
  dark: `avatar-tint-green` vs `confirmed-text` 10.76:1, `avatar-tint-lime` vs
  `confirmed-text` 10.45:1, `avatar-tint-amber` vs `pending-text` 10.82:1,
  `avatar-tint-violet` vs `restricted-text` 8.53:1. Every tint correctly inverts from a
  near-white light value to a deep, low-chroma dark value while its paired `-text` token
  inverts the opposite way (dark→light), exactly as the token block's own comment
  describes (`tokens.css:9-13`, `:157-161`). No contrast or direction issue.

## 5. Hover/active direction — checked every one, no exceptions

Every hover/active pair among the 58 (confirmed-bg-hover, -card-hover, cancelled-bg-hover,
-outline-hover, severity-{danger,warning,restricted}-bg-hover, attention-bg-hover,
restricted-bg-hover / -bg-hover-strong, hover-warm, button-subtle-hover / -active,
button-primary-active, danger-solid-active, restricted-text-hover) darkens relative to its
base in light and lightens relative to its base in dark, with **zero** exceptions. Verified
by diffing each token's light L against its base's light L, and dark L against its base's
dark L, from the raw declarations in both `[data-theme="light"]` and `[data-theme="dark"]`
blocks. `--admin-button-primary-active` (§1) is direction-correct — its defect is hue, not
direction — which is why it isn't listed as a direction failure here.
