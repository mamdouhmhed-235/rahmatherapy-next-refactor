# Critique — Lens: judgement-calls

Diff under review: `04e1b0c..c50cb6a` (8 commits, `git log --oneline 04e1b0c..c50cb6a`).
Scope: the five explicitly-flagged deviations from the diff's own mechanical rules. All
numbers below were computed by importing `parseTokensCss` / `resolveColour` /
`contrastRatio` / `oklchToRgb` from `scripts/verify-admin-token-contrast.mjs` and
`collectUnits` / `analyzeUnit` / `parseColour` / `composite` / `ratio` from
`scripts/measure-admin-contrast.mjs` into throwaway scripts in the system temp scratchpad,
plus one direct call into the project's real `@tailwindcss/oxide` scanner (also from
scratchpad, in-memory only, no build). Neither shipped script was edited; both were run
read-only (`node scripts/measure-admin-contrast.mjs . --json`,
`node scripts/verify-admin-token-contrast.mjs`) to confirm what each layer does and does
not catch.

Verdict: **PARTIALLY_DEFECTIVE**. (d) is fully vindicated by direct testing. (c) renders
correctly today but the stated reasoning for the asymmetric treatment doesn't hold up.
(a) and (b) are real, computable contrast failures that predate this diff (light values
are byte-identical to what shipped before), but the diff's own commit language describes
both as settled, considered judgement calls without disclosing that the underlying pairing
actually fails WCAG AA and is invisible to every check this project runs. (e) is a minor,
verifiable side effect of deriving two near-duplicate dark values independently.

## (a) `clients/[clientId]/page.tsx:888` — the count-pill role violation

Claim: `bg-[var(--admin-on-primary)]/30` on the active tab's count pill, beside
`!text-[var(--admin-on-primary)]`, must take a foreground token as a background because it
has to flip WITH the label.

**The flip logic itself is sound** — computed the real composited pill colour (30%
`--admin-on-primary` over the parent `<Link>`'s actual `bg-[var(--admin-primary)]` fill,
which is what a browser really paints, layer over layer):

| theme | tab fill (`--admin-primary`) | pill bg (30% wash) | label (`--admin-on-primary`) | label-vs-pill ratio |
|---|---|---|---|---|
| light | `#0f5e8e` → rgb(15,94,142) | rgb(87,142,175) | rgb(254,253,251) | **3.52:1** |
| dark  | oklch(76% .098 240) → rgb(117,186,233) | rgb(88,135,167) | oklch(18% .012 88) → rgb(20,17,12) | **4.89:1** |

Dark mode clears AA (barely, 0.39 above the 4.5:1 floor for the 11px/`0.6875rem`
semibold numeral — well under the "large text" size exemption). **Light mode does not.**
3.52:1 is a genuine WCAG AA failure for this numeral, and it is not new: `git show b7082a4
-- "src/app/admin/clients/[clientId]/page.tsx"` shows the pre-diff literal was
`bg-[oklch(99.5%_0.003_88)]/30` — byte-identical to `--admin-on-primary`'s light value — so
this exact composited failure already existed before ITEM 7 and is carried forward
unchanged, per the diff's own light-invariance rule.

**Nothing in this project's tooling catches it, and the commit's "Recorded rather than
automated" undersells why.** Ran both scripts directly against this exact site:

- `scripts/measure-admin-contrast.mjs` (`collectUnits`/`analyzeUnit`) returns **zero**
  findings for the line-888 unit, in both themes. Root cause, verified by re-running the
  script's own `FG` regex (`/(?:^|[\s"'\`])([^\s"'\`]*:)?text-\[([^\]]+)\](?:\/(\d{1,3}))?/g`)
  against the actual class string: it cannot match `!text-[var(--admin-on-primary)]` — the
  leading `!` (Tailwind's important-modifier prefix) satisfies neither the boundary
  character class nor the `prefix:` group, so the real foreground is invisible to it. The
  regex instead spuriously matches the adjacent `text-[0.6875rem]` (a font-*size* utility,
  not a colour) as if it were the foreground candidate; `parseColour("0.6875rem", …)`
  returns `null` and the unit is dropped with `fgs.length === 0` before any ratio is
  computed. This is a general blind spot for every `!text-[...]` site in the admin, not
  specific to this line — worth flagging separately from ITEM 7's own scope.
- `scripts/verify-admin-token-contrast.mjs`'s Layer 2 pairs `--admin-on-primary` against
  every entry in `SOLID_FILLS` (`--admin-primary`, `-hover`, `-active`,
  `--admin-danger-solid`, `-hover`) at **full opacity** — that's the tab *label* on the tab
  *fill*, which does pass (confirmed: the 5 "documented: --admin-on-primary is the
  foreground for solid admin action fills" pairs are among the 190 checks reported "no AA
  failures"). It never tests on-primary against a 30%-alpha composite of itself, and no
  manual ratio comment exists here — correctly, per Rule 5, since one would fail in light
  and turn a real defect into a reported Layer-2 failure instead of a silent gap.

So the deviation from the role rule is the right *mechanism* (the wash does need to invert
with its label, and it does), but the accompanying claim "the token is still correct" is
not verified for light mode — it is actively wrong there, pre-existing, and by construction
outside the reach of both of this project's contrast tools.

**The `ring-1 ring-inset ring-white/35`** on the same element is not itself a contrast
defect — it is a decorative 1px highlight, not a text/bg pair, and a static `white/35` ring
sits at similar relative brightness against both computed pill colours (mid-tone blue in
both light and dark), so it does not visibly break between themes. It is a hardcoded named-
colour literal Item 7's oklch-only census was never scoped to catch, not a missed
substitution.

**Distinguishability check** (pill vs. its own tab fill, the second half of the prompt):
light 1.95:1, dark 1.83:1 — both low but similar in magnitude, so the "subtle wash" design
intent survives the theme switch consistently; this part of the judgement call is fine.

## (b) `--admin-email-preview-bg` frozen white + `LivePreview.tsx`

Read `src/app/admin/emails/templates/components/LivePreview.tsx`. The outer container
(line 194, `bg-[var(--admin-email-preview-bg)]`) hosts three mutually-exclusive children:
a loading skeleton, the actual email `<iframe>` (which carries its own literal `bg-white`
and covers the container edge-to-edge once loaded — the commit's "paper the email renders
on" reasoning is correct for this branch), and — the branch the reasoning never addresses —
an `initialStatus === "error"` alert (lines 204-219) with **no background of its own**,
using `text-[var(--admin-status-cancelled-text)]` for its heading/message and
`text-[var(--admin-body)]` for the "Try again" button, both sitting directly on the frozen
container background.

`--admin-status-cancelled-text` and `--admin-body` are both tokens this same diff family
explicitly inverts *because* they're meant to read against dark admin panels
(`--admin-status-cancelled-text` dark = `oklch(88% 0.058 25)`, a bright light-red;
`--admin-body` dark = `oklch(90% 0.010 88)`, near-white). `--admin-email-preview-bg` is
declared identically in all four blocks (`oklch(99.2% 0.004 88)`, confirmed at
tokens.css:275/626/862/1087) — deliberately frozen near-white. Computed the actual pairing
with `resolveColour`/`contrastRatio`:

| theme | text token | vs `--admin-email-preview-bg` | ratio |
|---|---|---|---|
| dark | `--admin-status-cancelled-text` (error heading + message) | oklch(99.2%…) | **1.43:1** |
| dark | `--admin-body` ("Try again" button label) | oklch(99.2%…) | **1.31:1** |

Both are near-invisible (AA requires 4.5:1; these are barely above the 1:1 floor). This is
a real, reachable failure mode: any admin using dark mode whose initial
`GET /admin/email-templates/preview/[id]` fails (network blip, transient 5xx, expired
session) sees a pale-pink "Couldn't load the preview" message and an equally pale "Try
again" button on a white card — both effectively illegible. `git show b7082a4 --
".../LivePreview.tsx"` confirms the pre-diff literal was `bg-[oklch(99.2%_0.004_88)]` —
this exact defect predates ITEM 7 (literals never invert, so it was always frozen white),
but the commit message frames the non-inversion as a fully considered choice ("A token
that says so beats a literal that merely looks like an oversight") without acknowledging
that the same container also hosts admin-themed chrome the "paper" rationale doesn't cover.
The `refreshError` paragraph at line 236 is *not* affected — it is a sibling of the preview
box, rendered on the surrounding (correctly-inverting) admin panel, not on
`--admin-email-preview-bg`.

## (c) `--admin-page` phantom token, `AuditEventCard.tsx:195` vs `:231`

Confirmed `--admin-page` is declared nowhere in the repo (`grep -rn "\-\-admin-page"`
returns only the two `.tsx` reference sites plus prose in evidence docs). `git show b7082a4
-- AuditEventCard.tsx` shows :231's `bg-[var(--admin-page,_oklch(97.8%_0.006_88))]` was
replaced with `bg-[var(--admin-surface-subtle)]` in this diff, while :195's
`bg-[var(--admin-page,_var(--admin-panel))]` is untouched by the same commit.

Functionally :195 is correct today: an undeclared custom property always falls through to
its `var()` fallback, so this is equivalent at every browser to writing
`bg-[var(--admin-panel)]` directly, and `--admin-panel` is a real, correctly-inverting
token. No rendering defect.

But the stated reason for leaving it — "minting a real `--admin-page` would have silently
repainted it" — answers a question nobody needed to ask. Nobody had to *mint* anything to
clean this up: deleting the dead `--admin-page,_` prefix down to `bg-[var(--admin-panel)]`
is a zero-risk, zero-rendering-change edit (proven by the same fallback-resolution logic
the commit itself relies on), and it was available in the same file, in the same commit,
right next to the sibling site that *did* get cleaned. Leaving a reference to a
custom-property name that is declared nowhere in the codebase is also the exact landmine
the commit worries about, inverted: if anyone ever adds a `--admin-page` token for an
unrelated reason in the future, :195's rendering changes silently and untested, whereas
removing the phantom name now would have foreclosed that risk rather than preserved it.
This is a code-hygiene inconsistency inside the diff, not a user-visible bug.

## (d) `clients/page.tsx:1121` — raw-space arbitrary value, verified against the real scanner

Claim: `hover:border-b-[oklch(60% 0.08 247)]` (literal space, not `_`) cannot compile under
Tailwind v4, so leaving it unconverted is correct rather than a missed site.

Verified independently and directly, not by inference: this project has `tailwindcss@4.2.4`
and its real native scanner, `@tailwindcss/oxide@4.2.4`
(`node_modules/.pnpm/@tailwindcss+oxide@4.2.4/…/oxide/index.js`), installed. Loaded its
`Scanner` class in a throwaway script and called `getCandidatesWithPositions` — the exact
API `@tailwindcss/postcss` uses to extract utility candidates from source files during a
real build — against the file's actual source line, verbatim:

```
Candidates found in the ACTUAL source line:
"hover:bg-[var(--admin-hover-mist)]" @ 226
"focus-within:bg-[var(--admin-hover-mist)]" @ 298
...
```

`hover:border-b-[oklch(60%` never appears in the candidate list at all — not even as a
broken/garbage token; the scanner silently drops it because the space inside the brackets
ends the candidate before the closing `]`. Control test with the same value written with
an underscore (`hover:border-b-[oklch(60%_0.08_247)]`) is extracted correctly as a single
candidate by the same scanner. This is not merely plausible from Tailwind's documented
convention — it is what this project's actual build-time extractor does with this actual
line. **The claim holds**: the class produces no CSS rule in any theme, so declining to
convert it is correct, and it is not a missed defect.

## (e) `oklch(40% 0.13 55)` vs `oklch(40% 0.12 55)` kept as two tokens

These map to `--admin-tone-warning-icon` and `--admin-tone-info-icon` (tokens.css:211-212,
confirmed exact). Not merging them is defensible on the diff's own terms: Rule 2 requires
byte-identical light values, and the two literals, while nearly identical, are not
byte-identical — merging would have moved one of the two call sites' light-mode pixels by
construction. They are also semantically distinct slots (`tone="warning"` vs
`tone="info"` in `staff/page.tsx`'s `WorkloadSegment`), so keeping the naming apart is
consistent with how every other family in this diff was named (by the component's own
vocabulary, not by colour).

Quantified the actual visual gap in both themes (`oklchToRgb`, Euclidean RGB distance):

| theme | warning-icon rgb | info-icon rgb | Δ (Euclidean RGB) | self-contrast |
|---|---|---|---|---|
| light | (121,45,0) | (118,48,0) | **4.24** | 1.002:1 |
| dark | (228,192,152) | (229,198,142) | **11.70** | 1.041:1 |

In light mode the two literals are, as the commit says, indistinguishable (ΔRGB 4.24,
self-contrast 1.002:1 — as close to identical as two different oklch triples get). Because
each token's dark value was derived independently ("nearest existing family," Rule 3)
rather than by preserving the tiny 0.01-chroma delta between the two source literals, the
dark pair drifted apart by nearly 3× as much (ΔRGB 11.70) *and* picked up a 12° hue split
(70 vs 82) that the light pair never had. `WorkloadSegment` renders both tones side by side
in the same workload strip (`staff/page.tsx:418-434`, "No assignments" info tone next to
"Onboarding incomplete" warning tone) — so two icons that read as effectively the same
colour in light mode will read as two visibly different colours in dark mode. The absolute
gap is still modest (not a jarring, unmistakably-different-colour scenario), so this is
minor, but it is a real, measured, unintended-looking consequence of not merging plus
deriving the dark values independently — and the commit's own text flags the pair as
"almost certainly authoring drift, not two design states" without noting that the fix
chosen (keep separate, derive independently) reintroduces a distinction in dark mode that
didn't exist in light mode.
