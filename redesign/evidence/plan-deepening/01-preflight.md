---

## 2 — Pre-flight

Run this once, before touching anything, and record the output. Every number here was re-derived live on 2026-08-11; if any of them differs on your run, **that is the first finding of your session** — report it before starting work.

**PowerShell (preferred — see §1.11 for why):**

```powershell
git branch --show-current                    # master
git log --oneline -1                         # 0ec700c or a descendant
git status --porcelain -- src/ supabase/     # exactly:  M src/lib/maintenance.ts

npx tsc --noEmit                             # silent, exit 0            (~5s)
npx vitest run                               # 5 failed / 2236 passed (2241)  (~90s)
pnpm lint                                    # 59 errors / 7 warnings, 6 files (~25s)
```

**Toolchain, confirmed on this machine:** Node `v24.16.0` · pnpm `10.17.1` · Next `16.2.4` · TypeScript `5.9.3` · vitest `4.1.5` · `@playwright/test` `1.59.1`.

**Two things the gates leave behind, so they are not mistaken for stray output:**
- `npx tsc --noEmit` writes `tsconfig.tsbuildinfo` at the repo root on every run. It is gitignored (`.gitignore:47`) and must never be staged.
- Nothing else in the pre-flight set writes anything. `git status --porcelain -- src/ supabase/` was confirmed unchanged before and after every gate command.

**If `npx vitest run` reports 6 failures rather than 5**, do not report a regression until you have run the isolation procedure in §11.2. The sixth is a documented flake and it appears roughly half the time.

**Item-specific pre-flight**, run only for the item you are about to start:

| Item | Command | Record |
|---|---|---|
| 1 | `SELECT count(*), max(created_at), now() FROM public.email_delivery_events;` | Baseline was **43 rows**, latest `2026-07-29 09:56:19+00`. Capture `now()` — it is the run-window start for the "zero real emails" proof (§11.7) |
| 4 | `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='bookings' ORDER BY indexname;` and `SELECT count(*) FROM public.bookings;` | Baseline was exactly **3 indexes**, **15 rows** |
| 5 | `node scripts/measure-admin-bundles.mjs` against the existing `.next/` | Note the `BUILD_ID`; the current `.next/` was built at `aca7c18` on 2026-08-09 and is stale |
| 7 | `node scripts/measure-admin-contrast.mjs .` and `node scripts/verify-admin-token-contrast.mjs` | Baselines were **456** (377 dark / 79 light, 239 unresolved) and **1** |
| 8 | `SELECT id, allowed_cities FROM public.business_settings;` | Baseline is `{"id": 1, "allowed_cities": ["Luton","Dunstable"]}`. **This is the §8.9.G snapshot the plan requires for reversibility — it is recorded here so it cannot be lost** |
