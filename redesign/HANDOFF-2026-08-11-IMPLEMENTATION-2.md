# HANDOFF — 2026-08-11 (second implementation session)

**Read this file first, end to end.** Then `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` §0.0a, §0.0b, §0.0c, §1, §10 and §11 before opening any item section.

The two earlier handoffs are still live and are **not** superseded:
- `HANDOFF-2026-08-11-PLANNING.md` §5 — gotchas 1-19, all still apply.
- `HANDOFF-2026-08-11-IMPLEMENTATION.md` §5 — gotchas 1-15, all still apply.

This file adds §5's **new** gotchas 16-27, which cost real time in *this* session, and restates the position.

Nothing is mid-flight. No agent is running. Every change is committed. The tree is clean apart from the one standing dirty path.

| | |
|---|---|
| **HEAD** | `e8a2faf` |
| **Branch** | `master` |
| **Shipped this session** | Item **2**, item **4**, item **1 Batch A**, item **8 Phase 1 (DB half)** |
| **Next** | Item **8 Phase 1 application code** → Phases 2-5 → item 1 Batch B → item 7 → item 5 → Step 0.5 → Step Z |
| **Deploy** | Still deferred, **to the very end of the plan, by Owner decision** |

---

## 1 — What happened this session, in order

| Commit | Item | What |
|---|---|---|
| `91a5864` | **2** | Privacy section 6 rewritten criteria-based. Analytics sentence kept byte-identical, heading ordinal and `id="how-long-we-keep-it"` unchanged, nothing renumbered, `LAST_UPDATED` bumped to 11 August 2026. **First test anywhere under `src/app/(public)/`** — 5 cases, all teeth-checked against mutants |
| `11c74a0` | **4** ⛔Zone-2 | 4 btree indexes on `bookings`. Owner-approved in chat, applied as version `20260811190535`. Post-apply: 7 indexes, 15 rows unchanged |
| `0863573` | **1 Batch A** | 6-month per-client review-request cooldown + repeat/one-off classification. Both batched one-query-per-tick. 16 new tests (18 → 34 across two files) |
| `e8a2faf` | **8 Phase 1 (DB)** ⛔Zone-2 | `free_travel_cities` (backfilled) + `mileage_origin` added **additively**; `manage_travel_origin` permission granted to Owner. Applied as `20260811203747` and `20260811203752`. Also records Owner decisions 6-9 in the plan |

---

## 2 — ⛔ GATE BASELINES. Use these, not any earlier file's numbers.

```powershell
npx tsc --noEmit    # 0, silent, exit 0
npx vitest run      # 5 failed / 2295 passed (2300)   <-- was 2274/2279 at session start
pnpm lint           # 59 errors / 7 warnings, the same six files
git status --porcelain -- src/ supabase/   # exactly:  M src/lib/maintenance.ts
```

**The five failures, by name — unchanged all session, unrelated to every item:**
- `src/lib/auth/admin-access.test.ts` — *"gives Owner broad access while keeping owner-only role actions permission-gated"*, *"gives Admin broad operational access without role template management"*
- `src/app/admin/bookings/new/ManualBookingForm.test.tsx` — *"renders step 1 on first load"*, *"moves focus to the first invalid field when continuing with errors"*, *"shows the consent error when trying to create booking without consent"*

**A 6th** (`ManualBookingForm > optional email > "still rejects a malformed email…"`, 5000 ms timeout) appears intermittently under load. Isolate before calling it a regression:
```powershell
npx vitest run src/app/admin/bookings/new/ManualBookingForm.test.tsx   # exactly 3 failed / 33 passed (36)
npx vitest run src/lib/auth/admin-access.test.ts                       # exactly 2 failed / 4 passed (6)
```

**Lint identity is the `{file, ruleId}` multiset with counts, never `file:line:column`.** Per file: `area-page.jsx` 48E/1W · `shared.jsx` 2E/5W · `site-chrome.jsx` 5E/0W · `BookingExperience.tsx` 3E · `BookingExperienceLoader.tsx` 1E · `returning-customer.ts` 0E/1W. To dump it exactly:
```powershell
npx eslint . --format json | ConvertFrom-Json | Where-Object { $_.messages.Count -gt 0 } |
  ForEach-Object { $f = $_.filePath; $_.messages | Group-Object ruleId |
    ForEach-Object { "{0} | {1} | x{2}" -f $f, $_.Name, $_.Count } }
```

**Contrast layers unchanged this session** (nothing touched `tokens.css` or admin colour): Layer 1 **456**, Layer 2 **0 failures / 11 ratio comments**, Layer 3 last read **2,151** — and that Layer-3 number is still perishable, see the earlier handoff §3.

---

## 3 — Live database state after this session

Everything below is verified, not assumed.

| Object | State |
|---|---|
| `bookings` | **7 indexes** (3 original + 4 from item 4), **15 rows** |
| `business_settings` | **12 columns**. `allowed_cities` AND `free_travel_cities` both `["Luton","Dunstable"]`; `mileage_origin` null |
| `permissions` | **40 rows**. `manage_travel_origin` exists, granted to **Owner only** |
| Owner's grants | **40 of 40** — by explicit rows, **not** a wildcard, trigger or role-name shortcut (all three searched for; none exists) |
| `email_delivery_events` | **43 rows**, 1 of type `review_request_client`, all `accepted`. **Zero rows created during this session** — the bounded SELECT since `2026-08-11 18:04:37+00` returned 0 |

**Migration versions applied this session:** `20260811190535` (bookings indexes), `20260811203747` (free_travel_cities + mileage_origin), `20260811203752` (manage_travel_origin). Filename timestamps differ from recorded versions — that is normal and documented; do not treat it as an error.

---

## 4 — Owner decisions made this session. Do NOT re-ask.

All folded into the plan at **§0.0b** and **§0.0c**.

| # | Decision | Answer |
|---|---|---|
| 6 | Vary review-request email copy by client class? | **Yes.** *(This overrode the implementer's recommendation to keep one version — it is the Owner's explicit call. The class is already computed and written to the audit trail by Batch A, so this is purely a template change.)* Still **unimplemented** |
| 7 | Where the manual review-send control lives | **A new tab on `/admin/emails`**, not a subsection of Reminders |
| 8 | What runs next | **Item 8**, ahead of item 1's Batch B and item 7 |
| 9 | The `allowed_cities` rename | **Expand-contract, NOT a rename.** Both columns coexist; app dual-writes; `DROP COLUMN` deferred to the very end after the deploy |

**Two ordering consequences, both already in the plan:**
- Item 8 landing before item 7 **removes item 7's Phase B / Phase B-tail split entirely** (§10.2's split existed only because 7 was scheduled first). Do not carve out the five-file tail.
- §1.10's `1 → 8` edge on `notifications.ts` now runs the other way. Item 1's Batch B must re-grep before touching that file — though in practice it barely does.

---

## 5 — NEW GOTCHAS (16-27). Each one cost real time this session.

Numbered continuing from the previous implementation handoff's §5.

16. **⛔ PowerShell here-strings STRIP DOUBLE QUOTES from git commit messages**, and a message containing them can break argument parsing entirely — git then reports `error: pathspec 'by' did not match any file(s)` for each word and commits nothing. One commit (`91a5864`) landed with its quote marks silently removed before this was noticed. **Always `git commit -F <scratchpad file>`.** Never `-m` with a here-string.

17. **`tsconfig.json`'s `include` is `**/*.ts` / `**/*.tsx` REPO-WIDE**, with only `node_modules` and `worker-entrypoint.ts` excluded. So **any `.tsx` under `redesign/evidence/**` is inside the `npx tsc --noEmit` gate.** `redesign/**` is excluded from lint and is outside vitest's `src/**`+`scripts/**` include — the tsc gate is the one exception, and it is documented nowhere else. **Never park a duplicated copy of a source component in the evidence tree**; a later change to its dependencies breaks the typecheck for an unrelated reason.

18. **The Edit tool rewrites a file's working copy to LF**, even when the file was CRLF. Git renormalises on commit (`.gitattributes`/autocrlf), so **the committed diff stays minimal and correct** — but any subsequent Python/Node edit script must **DETECT the line ending, not assume CRLF**:
    ```python
    s = io.open(p, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in s else "\n"
    ```
    An assert-before-write caught this immediately and nothing was corrupted. Keep asserting.

19. **Hand-built Supabase test stubs do not implement `.returns()`.** Adding `.returns<T[]>()` to a query in source breaks every existing test that stubs that chain (`TypeError: ....returns is not a function`). Against this repo's **untyped** admin client, `.returns<T>()` and `const rows = (data ?? []) as T[]` are exactly equally strong — both are assertions, neither is checked. **Prefer the cast**; it needs no shared test-infra change.

20. **`--reporter=basic` does not exist in vitest 4.** Passing it produces a *startup error*, which looks exactly like "zero failures" if you are filtering output for `×`. A teeth-check appeared to pass because of this. Always confirm you saw a real `Tests N passed` line.

21. **⚠️ DERIVATION AGENTS PRODUCE TOOTHLESS TESTS. Assume it.** The privacy test skeleton one agent proposed passed **5/5 on the unfixed file**, and its one wording-sensitive case asserted the **OLD** text — it would have gone red *after* the fix, for the wrong reason. It was discarded and rewritten by hand. This is the single most valuable thing the adversarial pass did all session.

22. **The teeth-check technique that actually works.** For a *behavioural* guard, don't rely on the pre-fix file failing to import (new symbols won't exist, so it fails trivially and proves nothing). Instead **mutate the source: delete the guard, keep every export**, run the tests, restore, and verify the restore is byte-identical. Script pattern used this session (kept at `redesign/evidence/post-band-c-impl/item-2/TEETH-CHECK.md` and reproducible):
    - assert each cut anchor occurs **exactly once** before slicing (an end anchor that is not unique file-wide → search from the unique start anchor's index);
    - write mutants, run, restore in a `finally`;
    - assert the restored bytes equal the originals.
    For *invariant* guards (things that must pass before and after), teeth-check against a targeted mutant that removes the thing they guard.

23. **`Date.prototype.setMonth`/`setDate` operate in the host's LOCAL time zone.** `reviewCooldownStart` used `setMonth` and produced an instant an hour off on a London machine crossing the BST/GMT boundary versus a UTC server. Use `setUTCMonth`/`setUTCDate` for anything stored or compared as an ISO string. Caught by its own unit test — write the assertion with an explicit expected ISO string, not a computed one.

24. **⛔ Postgres does NOT rewrite PL/pgSQL function bodies on `ALTER TABLE … RENAME COLUMN`.** The rename succeeds silently; the function fails at *call* time. `create_booking_request` reads `v_settings.allowed_cities` by field name, so renaming would have broken every booking, public and admin, surfacing raw Postgres error text to the customer as a 400. **`pg_depend` structurally cannot see PL/pgSQL body references** — bodies are opaque `prosrc` text — so a `prosrc ILIKE` sweep is the authoritative check, not a dependency walk.

25. **⛔ An atomic migration cannot protect application code on a separate deploy cadence.** `availability.ts` reads `allowed_cities` in a raw PostgREST select string. **The live site runs older code**, so any rename breaks the deployed booking calendar regardless of how the DDL is bundled. This is why item 8 went expand-contract. **Before any schema change, ask: does app code name this, and is the deployed app the same code I am holding?**

26. **`vi.mock` with an explicit factory makes an unlisted export `undefined`, NOT a fallthrough to the real module.** Verified against vitest 4.1.5's own bundled source: the mocked module still *statically* exports every real name (so imports link), but each binds to `factoryObject["name"]`, which is `undefined` for a missing key → `TypeError` at call time. **This fails loudly and safely** — there is no path by which a forgotten mock entry lets a real email through. Falling back to the real module happens **only** when the factory itself spreads `await importOriginal()`.

27. **Repo-wide grep counts drift because the evidence files themselves contain the search term.** Two agents disagreed 52 vs 54 on `allowed_cities` files; the delta was entirely their own sibling reports written minutes earlier. **Count code/SQL consumers, not documentation hits**, and don't chase count deltas in `redesign/**`.

**Also re-confirmed, and worth repeating because they bit again:** subagents sometimes return a complete JSON payload but **do not write their evidence file** (item 1's three refuters and item 8's R2 wrote none — their findings were still complete and were acted on). **Check the JSON return, not just the directory listing.**

---

## 6 — Plan claims that FAILED verification this session

Add these to the 29 from the deepening pass and item 6's §6.5.3.

| Where | Claim | Truth |
|---|---|---|
| §4.2 | `bookings.status` appears in **6** predicate sites | **7.** `notInert()` has two independent call sites (`bookings-list-data.ts:303` and `:331`) that both fire for `claimable`, and the plan's own method counts *call sites* for every other column. Does not change the index |
| §4.5 | All three `/booking/manage` queries are filtered "**only** by primary key, never by `status`" | **False.** `requestCustomerCancellation` (`actions.ts:150`) also filters `.in("status", ["pending","confirmed"])`. Conclusion survives via `bookings_pkey`; the reason did not |
| §4.5 | `client-detail-data.ts` has **6** client-scoped `bookings` queries (4 row-returning + 2 count-only) | **7** (4 + 3). `countClientBookings` is a seventh |
| §1.8 | `getEmailsPageData` at `emails-data.ts:142-197` | **Spans 128-254.** 142 is its internal `unstable_cache(` call; 197 is the end of a *different* symbol (`remindersPromise`'s IIFE, itself an exact hit at 175-197) |
| §8.4 | `alter table … rename column allowed_cities to free_travel_cities` | **Rejected outright** — gotchas 24 and 25. Replaced by expand-contract (§0.0c) |
| §8.4 | A missed rename in the four `lib/booking` fixtures is "**silent if missed**" | **False, in our favour.** `getAllowedCities(undefined)` → `[]` → `isCityAllowed` false → `ContextFailure` for literal `"Luton"`, so **all four fixtures fail loudly**. Misleading message, never silent |

**Everything else checked held.** 24 of 25 item-1 anchors were exact; `buildBookingPredicatePlan` is still `bookings-list-data.ts:273-401` with the file byte-identical between `33f895f` and HEAD; privacy section 6 was still at 165-173; every item-8 consumer anchor reported **NONE** drift.

---

## 7 — What is left, in order

### NEXT: Item 8 Phase 1 — the application code

The database half is done and is **purely additive**: nothing reads the new columns yet, so this is a clean starting point with nothing half-built.

**12 files, every anchor verified NONE drift** (`redesign/evidence/post-band-c-impl/item-8/C-consumer-anchors.md`):

| File | Sites |
|---|---|
| `src/lib/booking/availability.ts` | interface field `:58`, select string `:433`, gate read `:454` |
| `src/app/admin/settings/settings-data.ts` | `:47` |
| `src/app/admin/settings/page.tsx` | `:19` |
| `src/app/admin/settings/actions.ts` | parse `:49`, `fieldErrors` `:68`, upsert `:92`, min-one-entry `:67-68` |
| `src/app/admin/settings/SettingsForm.tsx` | `:27`, `:59`, `:76`, `:388`, hidden input `name=` `:395`; copy at `:378`, `:708-711`, `:718`; `ServiceAreaField` ~`:674` |
| `src/app/admin/bookings/new/page.tsx` | `:75`, `:84` |
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | doc comment `:547` (prop name `allowedCities` need not change) |
| `src/lib/auth/rbac.ts` | **add `MANAGE_TRAVEL_ORIGIN: "manage_travel_origin"`** to `PERMISSIONS`, mirroring `MANAGE_ROLE_TEMPLATES` |
| 5 test files | `updateBusinessSettings.test.ts:83` (**required**, not optional) + 4 `lib/booking` fixtures |

**Three things that are easy to get wrong here:**

1. **⛔ `settings/actions.ts` MUST DUAL-WRITE both columns.** Until Phase 2 replaces `create_booking_request`, the live SQL gate still reads `allowed_cities`. Write only `free_travel_cities` and the Owner can edit the free-travel list while the booking gate silently enforces the stale one. Delete the dual write as part of Step Z, not before.
2. **The Owner-only origin check must not break partial saves.** Compare the submitted `mileage_origin` against the stored value and enforce the permission **only when it actually changed**, or Admins cannot save any other setting. Exact shape is in plan §8.4.
3. **Migration 1b changed nothing the app enforces.** The settings form is gated in one place by `manage_settings`, granted to **Admin and Owner**. Until this code lands, an Admin keeps today's access to the origin field. Server-side enforcement is the real gate; hiding the field in the UI is presentation only.

Then **Phases 2-5**. ⛔ **Phase 3 and Phase 5's chip gating ship together or neither ships** — otherwise an admin can one-click confirm an out-of-zone booking at £0 and the fee locks permanently once completed or paid. That is a stop condition, not a note.

### Then, in this order

1. **Item 1 Batch B** — the manual admin send. **New tab** on `/admin/emails` (decision 7). New action mirroring `resendEmail`'s scope check (do **not** edit `sendManualBookingReminder` — RECON-untouchable). New `emails-data.ts` export. Register `review_email_sent` in `src/app/admin/audit/format.ts`'s `ACTIONS` — **verified absent today**, and the cron already writes that `action_type`, so it currently renders via the generic fallback. Verbatim idioms to mirror: `redesign/evidence/post-band-c-impl/item-1/B-idioms-to-mirror.md`.
2. **Item 1 Step 1e** — vary review copy by client class (decision 6, **approved, unimplemented**). The seam is `pickReviewMessages({ groupCategory, city, overrides })`; `classifyReviewClient` already exists and its result is already in the audit `after_state`.
3. **Item 7** — all phases in **one pass**, no Phase B split (decision 8's consequence).
4. **Item 5** — needs the one sanctioned `pnpm build`; coordinate, it writes the same `.next/` the Owner's dev server serves.
5. **Step 0.5's tooling half** — extend `scripts/verify-admin-token-contrast.mjs` to *parse* the prose ratio claims. Still outstanding from Phase 0.
6. **Step Z** — `DROP COLUMN allowed_cities` + delete the dual write. **AFTER the deploy, at the very end. Do not do this early as a tidy-up.**

---

## 8 — Standing facts (unchanged, restated so this file stands alone)

- **Tree is intentionally dirty**: `git status --porcelain -- src/ supabase/` must show exactly ` M src/lib/maintenance.ts`. Untracked `design_handoff_area_pages/`, `photos-rahma-therapy/`, `test-results/`, `redesign/evidence/C-21/*.png` are pre-existing. **Never `git add .`/`-A`; never stash/checkout/restore to "clean" it.**
- **`src/lib/maintenance.ts`: working copy `false`, HEAD `true`.** Never stage, commit or revert it. Under `MAINTENANCE_MODE`, `(public)/layout.tsx` does not mount `BookingExperienceLoader` at all — the public booking flow is unreachable. Which build is actually deployed could not be verified from here.
- **Zone-2** = migrations, any data-mutating SQL, deploys, package installs, env changes, real emails. **Owner-approved per action, orchestrator-performed, never delegated to a subagent.** `mcp__supabase__execute_sql` is SELECT-only, project `twzutkfgqclqurvkmvqz`.
- **⛔ No agent may ever enter a credential.** Does not lift when offered. The Playwright harness authenticates via `getCredentials(prefix)`; agents reference the prefix only.
- **⛔ Never send a real email.** `sendEmail` in `src/lib/email/client.ts` is an unguarded wrapper over the real Resend SDK. Module load is safe (all env reads are inside function bodies); only an unmocked *call* is dangerous. `RESEND_API_KEY` is not defined in the agent shell and vitest does not load `.env`, but do not rely on that — mock the mailer.
- **Dev server is Owner-run** at `localhost:3000` (not `127.0.0.1`). Never spawn, restart or kill it. If it is down, stop and ask.
- **Migration filenames**: `YYYYMMDDHHMMSS_<slug>.sql`, later than the newest existing and ≥60 s apart in apply order. Newest is now `20260811200100_item8_phase1b_manage_travel_origin_permission.sql`.
- **Test conventions**: components → sibling `<Name>.test.tsx`; page/data/action modules → `__tests__/<name>.test.ts`. Mailer mocked at `@/lib/email/client`. Supabase → mock the **factory**. RBAC → `vi.mock(..., importOriginal)` so the **real** permission logic runs. **Zero snapshot files repo-wide.** There is now exactly **one** test under `src/app/(public)/**` (the privacy page) and still zero under `src/components/ui/**`.
- **DO-NOT-TOUCH**: booking `9d55ce2a` (real customer); `redesign/audits/**`; `C-B-DECISIONS.md`; the Owner account in email-test paths.
- **Business reality that should govern effort**: 15 bookings, all Luton. 6 therapists who claim jobs voluntarily; no pay/rate/payout table exists anywhere.

---

## 9 — What must NOT happen next

- **No `git add .`/`-A`**, no stashing, no "cleaning" the tree.
- **No migrations, data writes, deploys, package installs or real emails** without per-action Owner approval.
- **No credential entry**, ever, by any agent.
- **Do not rename `allowed_cities`** — decision 9, gotchas 24-25.
- **Do not run Step Z early.**
- **Do not split item 7's Phase B** — item 8 lands first, so the split is obsolete.
- **Do not rebuild the three contrast verification layers** — they exist and work.
- **Do not "fix" `create_recurring_booking_series`'s missing city check** — its absence is deliberate and documented.
- **Do not fix the four pre-existing lint errors** in `BookingExperience.tsx` / `BookingExperienceLoader.tsx` as a drive-by.
- **Do not compare a Layer 3 sweep against a stored baseline from another day.**
- **Do not trust a derived test skeleton without teeth-checking it** (gotcha 21).
- **Do not start implementing from an item section alone** — read §1, §10 and §11 of the plan first.
