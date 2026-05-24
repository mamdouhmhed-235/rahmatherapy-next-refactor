# WCAG severity-strong tokens — contrast verification (B-0 step 4)

**Captured:** 2026-05-24T13:20:25.125Z
**Method:** CSS Color Module Level 4 OKLCH → linear-sRGB → sRGB; WCAG 2.1 relative luminance.
**Pass criterion:** ≥ 4.5:1 AA for body text (per B-0 plan + SHARED-NOTES §3).

## Pairs

| Token | Background OKLCH | Background sRGB | Text token | Text sRGB | Ratio | AA? | AAA? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `--admin-danger-bg-strong` | `oklch(92% 0.075 20)` | `#ffd1d0` | `--admin-danger` | `#c52b28` | **4.08:1** | ❌ FAIL | — |
| `--admin-warning-bg-strong` | `oklch(93% 0.085 70)` | `#ffdfaa` | `--admin-warning` | `#b77900` | **2.84:1** | ❌ FAIL | — |
| `--admin-success-bg-strong` | `oklch(93% 0.060 155)` | `#c9f4d7` | `--admin-success` | `#047857` | **4.56:1** | ✅ pass | — |

## Summary

**At least one pair FAILS WCAG AA. Pause B-1; request user authorisation for token adjustment per B-0 plan step 4.**

## Notes

- Background tokens are PROPOSED (will land in B-1); text tokens are EXISTING (`src/styles/tokens.css` lines 79–84).
- AA threshold (4.5:1) chosen per B-0 plan; AAA (7:1) reported for context, not gated.
- OKLCH→sRGB conversion uses the standard cube-root LMS transform from CSS Color Module Level 4.
- The contrast result is symmetric — bg-vs-text and text-vs-bg are equal.


## Adjustment candidates for FAILING pairs

B-0 plan step 4 calls for one of three approaches when a pair fails. The minimum adjustment in each direction that crosses AA (4.5:1) is shown below per failing family. Pick one per family or mix-and-match.

### danger (current proposed oklch(92% 0.075 20) vs `#c52b28` → 4.08:1)

| Direction | Adjustment | New value | New hex | New ratio |
| --- | --- | --- | --- | --- |
| **A. Lift bg lightness** | L 92.0% → 96.5% (9 steps) | `oklch(96.5% 0.075 20)` | `#ffe0df` | **4.53:1** ✅ |
| B. Drop bg chroma | **no AA pass** down to C=0 — desaturated bg still too light against existing text | — | — | — |
| **C. Add `--admin-danger-text-strong` (darker text)** | L 30% at C=0.18, H=25 | `oklch(30% 0.18 25)` | `#6e0000` | **9.21:1** ✅ |

### warning (current proposed oklch(93% 0.085 70) vs `#b77900` → 2.84:1)

| Direction | Adjustment | New value | New hex | New ratio |
| --- | --- | --- | --- | --- |
| A. Lift bg lightness | **no AA pass** within L≤99.5% — colour can't be lifted high enough without becoming white | — | — | — |
| B. Drop bg chroma | **no AA pass** down to C=0 — desaturated bg still too light against existing text | — | — | — |
| **C. Add `--admin-warning-text-strong` (darker text)** | L 30% at C=0.16, H=55 | `oklch(30% 0.16 55)` | `#630000` | **10.71:1** ✅ |

**Recommendation:** option C (add `--admin-{severity}-text-strong` tokens) is the most reliable — every tested family passes AA with comfortable margin (≥ 9:1). It mirrors the existing `--admin-status-attention-bg` + `--admin-status-attention-text` pair convention and preserves the proposed bg-strong tints unchanged. Option A may not pass for the warning family because amber is intrinsically hard to combine with mid-saturation orange text at high contrast; option B desaturates the colour into grey, defeating the 'stronger tint' intent.
