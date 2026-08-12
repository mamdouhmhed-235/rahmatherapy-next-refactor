# Item 7 Phase D — Layer 3 authenticated sweep, and a defect in the instrument

> **✅ FIXED 2026-08-12, later the same day, by Owner instruction.** The
> transition race described below is closed: `visitAndAudit` now injects
> `*, *::before, *::after { transition: none !important; }` before the theme
> loop, so both passes read the settled end state. Animations are deliberately
> left running — killing `animate-pulse` or `motion-safe:animate-in` would
> change what is on screen, whereas a transition only interpolates between two
> states the audit already samples.
>
> **The instrument is now deterministic.** Two consecutive runs produced
> **byte-identical** output in all ten evidence files — a stronger result than
> matching totals. And the light half turned out to have been almost entirely
> artefact:
>
> | role · light | before the fix | after |
> |---|---:|---:|
> | OWNER | 632 / 544 (unstable) | **24** |
> | ADMIN | 533 / 612 (unstable) | **24** |
> | COORDINATOR | 250 | **20** |
> | THERAPIST_A | 74 / 80 | **2** |
>
> Every dark figure was unchanged by the fix (113 / 113 / 31 / 1), which is the
> control: the dark pass was always sampling a settled page, so a correct fix
> had to leave it alone, and it did.
>
> Sweep total **1745 → 328**. The rest of this file is the original analysis,
> kept because it is the evidence for why the fix was needed.

---


Run 2026-08-12 against the Owner's dev server at `http://localhost:3000`, at
`d1425cf`, twice:

```powershell
node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts --project=chromium
```

6 passed both times (3.7 min cold, 2.6 min warm). 4 roles — OWNER, ADMIN,
COORDINATOR, THERAPIST_A — plus the unauthenticated pair, over 24/22/15/8
reachable route templates. No credential was ever typed: `loginAs` signs in
through `supabase.auth.signInWithPassword()` in Node and injects cookies.
No `theme_preference` write reached the database — `setAdminTheme` sets
`data-theme` directly on `[data-admin-theme-root]`.

## ⛔ FINDING: Layer 3's LIGHT readings are not reproducible. Its DARK readings are.

Two consecutive runs, **same commit, same data, identical node counts**:

| role · theme | run 1 | run 2 | delta |
|---|---:|---:|---:|
| OWNER-dark | 113 | 113 | **0** |
| ADMIN-dark | 113 | 113 | **0** |
| COORDINATOR-dark | 31 | 31 | **0** |
| THERAPIST_A-dark | 1 | 1 | **0** |
| UNAUTHENTICATED-dark | 1 | 1 | **0** |
| OWNER-light | 632 | 544 | −88 |
| ADMIN-light | 533 | 612 | **+79** |
| COORDINATOR-light | 250 | 250 | 0 |
| THERAPIST_A-light | 74 | 80 | +6 |

Per route it is worse: `/admin/audit` OWNER-light went 225 → 115 across the two
runs with its node count fixed at 462, and `/admin/availability` went 34 → 57.
Every dark route matched to the unit: **0 routes differed** in any of the four
dark files.

### Why

`e2e/admin-contrast-helpers.ts:14` — `export const THEMES = ["dark", "light"]`.
The sweep audits **dark first, then light**. `setAdminTheme` (`:384`) sets the
attribute and returns; `:440-446` calls `runContrastAudit` on the very next
line, with **no wait for the CSS transition to settle**. The admin applies
`transition-colors` at `--motion-duration-fast: 160ms` on cards, rows, chips and
links throughout — including the exact selector that dominates the noise,
`AuditEventCard.tsx:185`'s
`a.font-display.font-semibold.text-[var(--admin-heading)]`.

So the dark pass samples an already-settled page, and the light pass samples a
page part-way through a 160ms dark→light interpolation. That predicts, and
explains, every symptom:

- **dark bit-stable, light noisy** — only the light pass follows a flip;
- **intermediate colours in the light file** that exist in neither palette, e.g.
  `rgb(131, 133, 128)` on `rgb(124, 122, 118)` (a mid-grey pair reported at
  1.15:1) and `rgb(73, 142, 190)` on `rgb(110, 133, 155)`;
- **dark grounds recorded in a light file** — `rgb(28, 26, 22)` is the dark
  canvas;
- **light totals above dark totals**, which is backwards for a theme whose
  static analyser reports 79 light vs 46 dark.

### This is PRE-EXISTING, not introduced by this work

The committed sweep from 2026-08-11 (`ad0db14`) already carries 13 dark-ground
rows in its own `OWNER-light.md` detail table, and already reports light totals
above dark for ADMIN (580 vs 369), COORDINATOR (264 vs 50) and THERAPIST_A
(74 vs 7). The instrument has behaved this way for as long as it has existed.

### Not fixed here, deliberately

The standing instruction is not to rebuild the three contrast layers. The fix is
also not free: awaiting `transitionend`, or a `page.waitForTimeout` above 160ms,
or `document.getAnimations()` settling, would change **every** number this layer
has ever recorded, so it needs to land as its own change with its own
re-baseline. Recorded here so the next person does not spend the afternoon I
spent deciding whether a 197-failure swing was a regression.

**Consequence for the plan.** §13 asks for "Layer 3's total against the 2,615
baseline". That comparison is not meaningful for the light half. Report the dark
half, which is stable, and treat the light half as unmeasured until the settle
is fixed.

## Results — the dark half, which is trustworthy

Cross-day caveat applies to the *before* column: it was captured 2026-08-11,
before items 1, 5 and 8 shipped, so node counts moved 13750 → 13480 and the
pages are not identical. The direction and magnitude are nonetheless unambiguous.

| role · dark | 2026-08-11 | 2026-08-12 | delta |
|---|---:|---:|---:|
| OWNER | 371 | 113 | **−258** |
| ADMIN | 369 | 113 | **−256** |
| COORDINATOR | 50 | 31 | −19 |
| THERAPIST_A | 7 | 1 | −6 |
| UNAUTHENTICATED | 1 | 1 | 0 |
| **total** | **798** | **259** | **−539 (−67.5%)** |

The one remaining unauthenticated-dark failure is unchanged and unrelated to
item 7: `/admin/password-reset`'s "Back to sign in" link at 3.09:1,
`rgb(94, 98, 94)` on `rgb(17, 15, 11)`. It renders through the documented
`html-fallback` mechanism because those pre-auth pages never mount
`ThemeProvider` — `src/app/admin/layout.tsx` returns `children` unwrapped when
there is no staff profile — so in the real product that page is never dark. It
is an artefact of the harness forcing a theme the page cannot otherwise reach.

---

## What the sweep says now that it can be trusted (2026-08-12, post-fix)

Total **328** failures over 13,480 nodes. Two consecutive runs byte-identical.

| role · theme | failures |
|---|---:|
| OWNER-dark / ADMIN-dark | 113 each |
| COORDINATOR-dark | 31 |
| THERAPIST_A-dark | 1 |
| OWNER-light / ADMIN-light | 24 each |
| COORDINATOR-light | 20 |
| THERAPIST_A-light | 2 |
| UNAUTHENTICATED, both themes | **0** |

`UNAUTHENTICATED` reached zero in this pass: the two failures the fix exposed —
"Sign in" and "Submit request" at 2.11:1 — were `button.tsx`'s hardcoded
`text-white` on a fill that inverts. They now take
`--admin-action-primary-text`, whose light value is `#ffffff`, so light mode is
byte-identical and dark goes 2.11:1 → 8.93:1.

### ⛔ The largest remaining dark defect class is NOT a token problem

**15 of OWNER-dark's 113 are one pair: `rgb(225,222,215)` on `rgb(240,240,240)`,
at 1.18:1** — and `rgb(240,240,240)` is not a token. No `--admin-*` token
resolves to it in either theme, and `color-scheme` is declared nowhere in the
repo. It is the browser's default `ButtonFace`, showing through on `<button>`
elements that never set a background. In dark mode the admin's light text lands
on that permanently-light UA default.

The fix is a `color-scheme: dark` declaration on the theme root (which makes the
UA defaults invert) or explicit backgrounds on those buttons. Either is a
distinct change with a broad visual blast radius — scrollbars, form controls and
every unstyled UA surface in the admin — so it wants its own item, its own
review and its own sweep. **Recorded, not attempted.**

70 of OWNER-dark's 113 sit on `/admin/audit` alone, so that route is the single
highest-yield place to look next.

### The light half, in full — 24 for OWNER

| ratio | route | text |
|---|---|---|
| 3.80:1 ×6 | `/admin/clients` | "Last visit" |
| 2.14:1 ×3 | `/admin/clients` | "·" separator |
| 2.13:1 ×3 | `/admin/operations` | "0" |
| 3.09:1 ×2 | `/admin/dashboard` | "Updated", "just now" |
| 2.27:1 | `/admin/privacy` | "0" |

These are muted metadata tones on panel — a deliberate design choice that has
never been contrast-checked, now measurable for the first time. They are the
real accessibility backlog, and they are small enough to be worth a pass.
