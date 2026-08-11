# X1 — Contradictions and arithmetic audit (D1a vs D1b, plus cross-report numeric sweep)

Adversarial review of the 7 derivation reports in this directory. Read-only. No file
under `src/`, `scripts/`, `e2e/`, `supabase/`, or repo root was touched. Two `npx
vitest run` commands were executed read-only (no `--update`) to verify two agents'
"I re-ran this and got N pass/fail" claims — both reproduced exactly, reported below.

Primary lens: every point where D1a (`D1a-settings-actions.md`) and D1b
(`D1b-settings-actions-independent.md`) — two independent reads of the same file,
`src/app/admin/settings/actions.ts` — disagree with each other, resolved against the
actual file. Secondary lens: numeric claims (line numbers, counts, "N files") checked
against the repo, across all 7 reports.

---

## 1. D1a vs D1b — the one real contradiction, and why the "confident" one loses

**Claim (D1a, header line 3):** "Target file read in full: `src/app/admin/settings/actions.ts`
(**119 lines**, entire file — confirmed at line 119 `EOF`)."

**Claim (D1b, header line 3):** "Read-only derivation. File read in full (**120 lines**)
on 2026-08-11."

These are mutually exclusive claims about the same file. Resolved directly:

```
$ wc -l src/app/admin/settings/actions.ts
119 src/app/admin/settings/actions.ts

$ tail -3 src/app/admin/settings/actions.ts | cat -A
  revalidatePath("/admin/settings");^M$
  return { success: true };^M$
}^M$
```

`wc -l` counts newline characters; 119 newlines with the file's last byte being the
`\n` that terminates line 119 (`}`) means the file has exactly **119 lines**, no
partial/unterminated 120th line and no blank trailing line 120. My own full `Read` of
the file (done independently before reading either D1a or D1b) also showed content
stopping at line 119 (`}`) with nothing beyond it.

**Verdict: D1a is correct (119). D1b's "120" is wrong** — off by one, most likely a
miscount rather than a different counting convention (there's no trailing blank line
to plausibly count as 120, per the byte dump above). Practically low-stakes on its own
(it doesn't change where any edit lands — every specific line-numbered claim inside
D1b's body, e.g. `SettingsActionState` at 9–13, the auth gate at 31–36, the upsert at
96–100, all check out exactly against the real file), but it is the one place these
two independent reads of the identical text produced a directly conflicting number,
and D1b's report is written in a more elaborated, more confident register (explicit
"Q1–Q7" structure, per-claim confidence caveats) than D1a's — which is exactly the
shape of error the task warns about: more elaborate ≠ more correct. The plain,
mechanically-checkable claim (D1a's) was the accurate one here.

**No other point-for-point numeric disagreement exists between D1a and D1b.** I
diffed every line-range D1a and D1b each attach to the same code region (signature,
auth gate, field-parsing/validation block, `beforeState` read, payload, upsert call,
audit insert, cache-invalidation footer, `requireSettingsManager`,
`parseAllowedCities`) and every other range matches exactly, even where the two
reports draw the section boundaries slightly differently (e.g. D1a splits "field
parsing" 38–50 and "validation" 52–73 into two subsections while D1b treats 38–73 as
one continuous block — this is a labeling-granularity difference, not a numeric
conflict, since both agree on the exact boundary lines). Every semantic/behavioral
claim shared between the two reports also agrees: exactly one `.upsert()` (not
`.update()`), `beforeState` is read-only-for-the-audit-log and never merged into the
write, `contact_email`/`contact_phone` have zero format validation, the payload has
10 keys, `PERMISSIONS.MANAGE_TRAVEL_ORIGIN` does not exist anywhere in `src/`, and the
generic `"Insufficient permissions."` message discards the real `PermissionError`
code. I did not find a second contradiction between these two reports.

---

## 2. D1a self-contradicts on its own headline occurrence count

**Claim (D1a, §8):** "Walking every occurrence of the literal string `"allowed_cities"`
in this file (**5 occurrences**: lines 48, 49 combined region, 68, 92 — see exact list
below) plus the one DB-column write:"

Two paragraphs later, D1a's own itemized list only produces **three** string-literal
occurrences, and explicitly disqualifies one of the four line numbers it just cited:

> "Exact list of the literal string `"allowed_cities"` occurrences in this file...
> Line 49: ... Line 68: ... Line 92: ... (Line 48 is `const allowedCities =
> parseAllowedCities(` — the identifier, not the string literal; included above only
> as context...)"

So D1a's own accounting arrives at 3, directly contradicting the "5" it opened the
section with (and even the intermediate tally of "lines 48, 49 combined region, 68,
92" is only four locations, not five — the headline number doesn't match either of
D1a's own subsequent counts). Resolved directly against the file:

```
$ grep -n 'allowed_cities' src/app/admin/settings/actions.ts
49:    String(formData.get("allowed_cities") ?? "")
68:    fieldErrors.allowed_cities = "Enter at least one allowed service area.";
92:    allowed_cities: allowedCities,
```

**Verdict: exactly 3 occurrences (lines 49, 68, 92). D1a's headline "5" is wrong; its
own detailed list (3) is right.** This is independently corroborated by D7's
repo-wide sweep, which counted `actions.ts` as contributing exactly 3 hits to its
351-occurrence total (verified in §4 below) — a second, independent source agreeing
with the correct number and disagreeing with D1a's stated headline. Practical risk:
an implementer skimming only D1a's section header ("5 occurrences... see exact list
below") and not reading the caveat two paragraphs down could go looking for two
occurrences that don't exist.

---

## 3. Cross-report contradiction outside D1a/D1b: PERMISSIONS key count (D2 vs D3)

Not part of the D1a/D1b pair, but a direct numeric contradiction between two other
reports describing the identical object (`PERMISSIONS` in `src/lib/auth/rbac.ts`,
lines 6–50), surfaced while cross-checking counts as instructed:

**Claim (D2-SettingsForm.md, §7, point 3):** "`src/lib/auth/rbac.ts` does not
currently define a `MANAGE_TRAVEL_ORIGIN` key in the `PERMISSIONS` const object
(lines 6–50; confirmed by direct read — **the object has 34 keys** ending at
`MANAGE_ACCOUNT_PASSWORD_REQUESTS: "manage_account_requests"` on line 49...)"

**Claim (D3-rbac.md, §4):** "`Permission` is a string-literal union of every value in
`PERMISSIONS` (**currently 39 members**: `"view_dashboard" | "view_bookings_all" |
... | "manage_account_requests"`)."

Both describe the same 45-line object (rbac.ts:6–50) and cannot both be right.
Resolved by direct read plus an independent mechanical count:

```
$ awk 'NR==6,NR==50' src/lib/auth/rbac.ts | grep -cE '^\s*[A-Z_]+:\s*"'
39
```

Manually listing every `KEY: "value",` line from 7 through 49 (44, 45, 46, 47, 48 are
a block comment, not entries) gives 38 entries on lines 7–44 plus 1 more on line 49
(`MANAGE_ACCOUNT_PASSWORD_REQUESTS`) = **39**, matching the script exactly.

**Verdict: D3 is correct (39). D2's "34" is wrong.** Likely source of D2's error: D3
itself (§5) separately and correctly notes that `admin-access.test.ts`'s
`OWNER_PERMISSIONS` hand-typed test-fixture array — a *different* object entirely —
has exactly 34 entries (lines 35–71 of that test file). D2 most plausibly counted (or
recalled) that fixture's size and mis-attributed it to the `PERMISSIONS` const itself.
This doesn't change either report's bottom-line conclusion (both correctly say
`MANAGE_TRAVEL_ORIGIN` doesn't exist yet), but the "34" figure is factually wrong
wherever D2 is used as a source of truth about the permission surface's size.

---

## 4. Numeric claims verified correct (no error found) — the arithmetic checks that held up

Per the task's "cross-check every numeric claim" instruction, these were independently
re-derived (not just re-read) and all matched exactly:

**D7's repo-wide blast-radius arithmetic** (`allowed_cities`, repo-wide). D7's own
stated equations — `22+18+0+0+311=351` and `12+7+0+0+38=57` — are arithmetically
correct as sums, and I additionally re-derived the underlying grep counts from
scratch (excluding the 8 sibling `D*.md` files in this same directory, which did not
exist yet at repo-scan time and inflate a fresh scan by 174 hits / 9 files if left
in): raw repo-wide grep for `allowed_cities` today returns 525 occurrences across 66
files; subtracting the 8 D-report files' 174 occurrences leaves exactly **351
occurrences across 57 files** — matching D7 exactly. The category breakdown also
reproduced exactly: `src/` = 12 files / 22 hits, `supabase/` SQL = 7 files / 18 hits,
`e2e/` and `scripts/` = 0/0 each, `redesign/`+`implementation-plans/` docs = 38 files
/ 311 hits (12+7+0+0+38=57 files, 22+18+0+0+311=351 hits — both totals independently
reconstructed, not just re-summed from D7's own numbers).

**D7's "9 `business_settings` call sites across 8 files."** Independently grepped
`from\(['"]business_settings['"]\)` across `src/`: 9 matches across exactly 8 files
(`settings-data.ts`, `assignment-eligibility.ts`, `actions.ts` ×2, `notifications.ts`,
`bookings/new/page.tsx`, `customer-manage.ts`, `availability.ts`,
`booking-window-settings.ts`) — confirmed exactly, including that `actions.ts` is the
only file with two call sites (the `beforeState` read and the upsert), and the upsert
is the only write.

**D3's live re-run of `admin-access.test.ts`.** Claimed "6 tests, 2 failed, 4 passed,"
both failures about `accountRequests`/`MANAGE_ACCOUNT_PASSWORD_REQUESTS`, one failing
assertion specifically at line 222. Re-ran independently: `Test Files 1 failed (1)`,
`Tests 2 failed | 4 passed (6)`, and the second failure's diff is at
`admin-access.test.ts:222:58` exactly as D3 described — reproduced exactly.

**D6's live re-run of the 5 target test files.** Claimed "5 test files passed, 57
tests passed, 0 failures." Re-ran `updateBusinessSettings.test.ts`,
`availability-options.test.ts`, `working-hours-segments.test.ts`,
`staff-recurring-windows.test.ts`, `override-windows.test.ts` together: `Test Files 5
passed (5)`, `Tests 57 passed (57)` — reproduced exactly.

**D2's SettingsForm.tsx anchors.** Spot-checked the full set D2 flagged as unusually
all-correct: interface field `allowed_cities` at line 27, `useState` at line 59,
dirty-check baseline at line 76, `error={state.fieldErrors?.allowed_cities}` at line
388, hidden input at lines 393–397 (`name="allowed_cities"` at 395),
`ServiceAreaField` at line 674, and the three copy strings at 378, 708–711, 718 — all
confirmed byte-exact by direct `Read`.

**rbac.ts anchors shared by D1a/D3.** `requirePermission` spans 401–423 (full
function, not just the 401–404 signature D1a quoted — D3's fuller 401–423 claim is
the complete and correct range), `hasPermission` spans 428–433,
`StaffProfile.permissions: Set<string>` at line 289, `PERMISSIONS.MANAGE_SETTINGS` at
line 40 immediately followed by `MANAGE_AVAILABILITY_GLOBAL` at line 41 — all
confirmed by direct `Read`.

**D1b's `admin.ts` and `tag-taxonomy.ts` claims.** `createSupabaseAdminClient` spans
lines 11–27 in `src/lib/supabase/admin.ts`, is a direct, unwrapped
`createClient(...)` call from `@supabase/supabase-js` (service-role key, RLS
bypassed) — confirmed. `TAGS.SETTINGS`/`TAGS.AUDIT` resolve to the literal strings
`"settings"`/`"audit"` at `tag-taxonomy.ts` lines 20–21 — confirmed.

**Test-stub line claims shared by D1b/D6.** `stubAdminClient()` in
`updateBusinessSettings.test.ts` spans lines 34–69; its `business_settings` branch's
`select().eq().single()` read-chain sits at lines 48–56; its `upsert` is a pure
passthrough that pushes the payload into an array and echoes it back as `data`
(cannot distinguish column-preservation from column-reset); the form-data builder
sets `"allowed_cities"` at line 83 — all confirmed by direct `Read`.

---

## Summary table

| # | Claim | Source(s) | Verdict | Ground truth |
|---|---|---|---|---|
| 1 | `actions.ts` is 119 lines | D1a | CONFIRMED | 119 (`wc -l` + tail-byte dump) |
| 1 | `actions.ts` is 120 lines | D1b | **WRONG** | 119 — off by one |
| 2 | 5 occurrences of literal `"allowed_cities"` in `actions.ts` | D1a (headline) | **WRONG** | 3 (lines 49, 68, 92) — D1a's own itemized list already says this |
| 2 | 3 occurrences of literal `"allowed_cities"` in `actions.ts` | D1a (own detailed list), corroborated by D7 | CONFIRMED | 3 |
| 3 | `PERMISSIONS` const has 34 keys | D2 | **WRONG** | 39 — D2 likely conflated with `admin-access.test.ts`'s unrelated 34-entry `OWNER_PERMISSIONS` fixture |
| 3 | `PERMISSIONS`-derived `Permission` union has 39 members | D3 | CONFIRMED | 39 |
| 4 | 351 occurrences / 57 files of `allowed_cities` repo-wide, split 12/22 src, 7/18 supabase, 0/0 e2e+scripts, 38/311 docs | D7 | CONFIRMED | exact, independently re-derived |
| 4 | 9 `business_settings` call sites / 8 files, 1 writer | D7 | CONFIRMED | exact |
| 4 | `admin-access.test.ts`: 6 tests, 2 failed (accountRequests), 4 passed | D3 | CONFIRMED | reproduced live |
| 4 | 5 files / 57 tests / 0 failures for D6's target set | D6 | CONFIRMED | reproduced live |
| 4 | SettingsForm.tsx anchors (27/59/76/378/388/393-397/674/708-711/718) | D2 | CONFIRMED | byte-exact |
| 4 | rbac.ts anchors (401-423/428-433/289/40/41) | D1a, D3 | CONFIRMED | byte-exact |
| 4 | admin.ts (11-27), tag-taxonomy.ts (20-21) | D1b | CONFIRMED | byte-exact |
| 4 | test-stub anchors (34-69/48-56/83) | D1b, D6 | CONFIRMED | byte-exact |

**Bottom line for the caller:** the two independent reads of `actions.ts` (D1a, D1b)
agree on every substantive behavioral and line-numbered claim about the code itself —
the only place they conflict is a cosmetic file-length metadata line, and the
plainer, less-elaborated report (D1a) was the one that got it right. The more
consequential numeric error in this batch is D2's wrong `PERMISSIONS` key count (34
vs. actual 39) and D1a's own internal "5 vs 3" inconsistency about `allowed_cities`
occurrences — neither changes any recommended edit, but both would misinform an
implementer who trusted the headline number without reading the detail underneath it.
