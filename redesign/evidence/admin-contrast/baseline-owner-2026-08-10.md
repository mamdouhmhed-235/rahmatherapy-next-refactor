# Admin contrast — measured baseline (Owner role, both themes)

**Date:** 2026-08-10 · **HEAD:** `d58a323` · **Role:** Owner / Main Admin (Minhaj rahman), the Owner's own signed-in session, driven by the orchestrator
**Viewport:** 1440×900 · **Standard:** WCAG 2.x AA — ≥4.5:1 normal text, ≥3:1 large (≥24px, or ≥18.66px bold)

## Method

Text-node level audit run in the live DOM. For every non-empty visible text node: effective foreground from `getComputedStyle`, effective background by walking ancestors to the first opaque `background-color` with alpha compositing, both resolved to sRGB by **painting to a 1×1 canvas and reading the pixel** — which handles `oklch()`, `lab()`, `oklab()` and any other CSS colour syntax exactly, with no hand-written colour-space conversion to get wrong.

Theme was switched by setting `data-theme` on the `[data-admin-theme-root]` element directly, so **no `theme_preference` write reached the database**.

**Disclosed limitation:** `.sr-only` elements are clipped rather than hidden, so a small number (roughly 1–3 per page) are counted despite not being visible to sighted users. The production auditor specified in the plan must exclude them. Their presence slightly inflates the counts below; it does not affect any of the headline findings, all of which are visible content.

## Results

| Page | Nodes | **Dark** fails | **Light** fails | Worst (dark) | Worst (light) |
|---|---|---|---|---|---|
| `/admin/dashboard` | 89 | **8** | **15** | **1.05:1** | **1.01:1** |
| `/admin/bookings` | 147 | **8** | **8** | 1.88:1 | 2.51:1 |
| `/admin/staff` | 177 | **41** | 1 | **1.05:1** | 3.65:1 |
| `/admin/emails` | 72 | **13** | 2 | 1.88:1 | 2.51:1 |
| `/admin/settings` | 56 | **9** | 1 | **1.15:1** | 3.65:1 |
| `/admin/bookings/new` | 28 | **7** | 1 | **1.15:1** | 3.65:1 |
| **Total** | **569** | **86** | **28** | | |

**A contrast ratio of 1.0:1 is identical colour.** The worst results here are not "low contrast" — they are invisible text.

## The findings that matter

**1. `/admin/staff` fails on 23% of its text in dark mode** (41 of 177 nodes). Worst at **1.05:1** on the onboarding badges — `"Onboarding"`, `"6"`, `"/6"`.

**2. The dashboard's headline KPI numbers are invisible in dark mode.** `1.05:1`, foreground `rgb(21,27,24)` on background `rgb(32,30,26)`, on `p.break-words.text-base` carrying **`0`, `£0.00`, `—`**. The single most-read content on the most-visited page.

**3. Light mode is worse than dark on the dashboard** — 15 failures vs 8, worst **1.01:1** on the `"Enquiries"` label. Note its background: `rgb(28,26,22)`, a *dark* surface **while in light mode**. Hardcoded colours fail in **both** directions — some text does not lighten for dark mode, and some surfaces do not lighten for light mode.

**4. The required-field asterisk is invisible in dark mode, and the failing selector names its own cause:**

```
1.15:1   "*"   span.ml-0.5.text-[oklch(26%_0.14_25)]
```

That is `src/components/ui/input.tsx:116` verbatim. It recurs on every form — 7 failures on `/admin/bookings/new`, 9 on `/admin/settings`. `input.tsx:143` is the same literal on field **error messages**, so a user can be blocked by a validation error they cannot see.

**5. Primary actions fail in BOTH themes.** `"New booking"` and `"Needs Attention"` on `/admin/bookings` measure **1.88:1 dark / 2.51:1 light** — a call-to-action button, failing everywhere, on the busiest page in the product.

**6. Two defects are global.** The header notification badge (`3`, white on amber) is **3.65:1 in both themes** on every page. The dashboard period chips (`Today` / `This week`) are 1.88:1 dark, 2.51:1 light.

## How this corroborates the static analysis

The live measurement was taken **after** the static analysis predicted it, and matches:

- Predicted *"themed foreground + hardcoded light background → invisible in dark mode"* → observed on `"New booking"`, the period chips.
- Predicted *"hardcoded dark foreground on a themed dark surface"* → observed at 1.15:1 with the literal visible **in the class name**.
- Predicted *"hardcoded light/dark pairs are theme-blind in both directions"* → observed as light mode failing *more* than dark on the dashboard.

677 hardcoded literals is the cause; these ratios are the effect.

## Not yet covered

Owner role only. Admin, Coordinator and Therapist require the Owner to sign in as each in turn (agents may not authenticate). Per the plan, those passes are **coverage confirmation** — the four role-variant dashboard components contain zero literals, and once colour is token-driven, contrast is a token-pair property that holds across all roles by construction.
