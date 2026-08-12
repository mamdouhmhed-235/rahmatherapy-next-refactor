# Item 7 Phase D — Layer 3 authenticated sweep, and a defect in the instrument

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
