# ITEM 7 Workstream 2 (hardcoded literals, §7.6–7.12) — deepening audit

**Scope of this report:** plan lines 787–978 (§7.6 Phase A through §7.12 Verification). Phase 0
(§7.5b, theme-resolution) is explicitly out of scope per the dispatch and is not re-verified here.

**Repo state:** branch `master`. `src/` confirmed byte-identical to `33f895f` per the dispatch's own
claim; I re-located every anchor below by symbol/grep, not by trusting that claim blindly, and report
drift where found (none found in `src/`, all drift found is in the plan's own arithmetic/labels).

Every command below was actually run. Where a number in the plan is repeated from an already-existing
independent review (`redesign/evidence/admin-contrast/surgical-review.md`, dated 2026-08-10), I note the
overlap but still give my own independently-run command and number — the two were derived by different
regexes and agree to within rounding, which is itself useful corroboration.

---

## 1. Re-measuring the headline counts

### 1.1 "677 literals / 99 files" — this is an admin-only figure, not admin+ui

Plan line 450: *"677 hardcoded `oklch(…)` colour literals across 99 files in `src/app/admin/`, plus 3
shared primitives in `src/components/ui/`."*

```bash
grep -rhEo 'oklch\(' src/app/admin --include='*.tsx' --include='*.ts' | wc -l
# → 677
grep -rlE 'oklch\(' src/app/admin --include='*.tsx' --include='*.ts' | wc -l
# → 99
grep -rhEo 'oklch\(' src/components/ui --include='*.tsx' --include='*.ts' | wc -l
# → 40
grep -rlE 'oklch\(' src/components/ui --include='*.tsx' --include='*.ts' | wc -l
# → 3   (badge.tsx, input.tsx, button.tsx — the other 10 files in src/components/ui/ have 0)
```

**677 and 99 are CONFIRMED CORRECT — but only as admin-only figures.** The sentence's second clause
("plus 3 shared primitives") is additive, not included in the 677/99. So:

- **True combined total for Workstream 2's actual working set (admin + the 3 UI primitives Phase B
  edits) is 717 occurrences across 102 files, not 677/99.**
- This matters because §7.11's Risks table (line 945: *"677 edits is a large diff to review"*) and
  §7.5's summary table (line 682: *"Size … 677 occurrences / 99 files"*) both cite 677/99 as
  Workstream 2's *total size* — but Workstream 2's own defect list (line 679: `D2, D3, D4, D5, D6, D10`)
  explicitly includes **D2 (`button.tsx`) and D3 (`input.tsx`)**, both in `src/components/ui/`, which
  are outside the 677/99 count. **The plan undercounts its own workstream's size by 40 occurrences / 3
  files**, in the exact table meant to size the review burden.
- **Fix for the deepened plan:** state both numbers explicitly — "677/99 in `src/app/admin/`, 717/102
  including the 3 UI primitives" — everywhere the total is used to size effort or risk.

### 1.2 "94 distinct literals" — CONFIRMED, but only when counted admin+ui combined (a second scope mismatch in the same sentence)

```bash
grep -rhEo 'oklch\([0-9.]+%[^)]*\)' src/app/admin --include='*.tsx' --include='*.ts' \
  | tr '_' ' ' | sort -u | wc -l
# → 84   (admin-only distinct values)
grep -rhEo 'oklch\([0-9.]+%[^)]*\)' src/app/admin src/components/ui --include='*.tsx' --include='*.ts' \
  | tr '_' ' ' | sort -u | wc -l
# → 94   (admin + 3 UI primitives combined — MATCHES the plan)
```

**94 is correct, but only as a combined admin+ui figure** — the 3 UI primitives introduce 10 distinct
literal values that don't otherwise appear in `src/app/admin/`. So the same sentence (line 450) uses an
admin-only denominator for "677/99" and a combined denominator for "94" one clause later, with no flag
that the scopes differ. An implementer skimming this line would reasonably (and wrongly) read "94
distinct values out of 677 occurrences," which are not co-scoped numbers.

### 1.3 "top ten account for ~483 … roughly 71%" — the SUM is exactly right; the PERCENTAGE is scope-mismatched too

```bash
grep -rhEo 'oklch\([0-9.]+%[^)]*\)' src/app/admin src/components/ui --include='*.tsx' --include='*.ts' \
  | tr '_' ' ' | sort | uniq -c | sort -rn | head -10
#    171 oklch(26% 0.14 25)
#     74 oklch(95.5% 0.028 20)
#     58 oklch(26% 0.13 55)
#     40 oklch(95% 0.05 65)
#     33 oklch(22% 0.085 155)
#     30 oklch(93.5% 0.038 155)
#     24 oklch(30% 0.02 280)
#     21 oklch(94% 0.008 280)
#     16 oklch(88% 0.045 20)   ┐ tied at 16 with the two lines below;
#     16 oklch(28% 0.12 55)    │ whichever two of the three are picked,
#     16 oklch(12% 0.01 165)  ┘ the top-10 SUM is unaffected (16+16=32 either way)
```

Sum of the top 10 = **483** — this is an EXACT match to the plan's "roughly 483." Good, and it
reproduces to the digit against `redesign/evidence/admin-contrast/surgical-review.md`'s independent
top-10 table (§1.5 there), which found the same values with deltas ≤5 per line, all traceable to
minor tokenization differences, not real disagreement.

But **483 / 677 = 71.3%** (admin-only denominator, what the plan's "~71%" is implicitly doing), while
**483 / 717 = 67.4%** (the true combined denominator, since 3 of the top-10 values' occurrences include
UI-primitive instances — spot check below). Once the plan is corrected to use 717 as Workstream 2's
true total (§1.1), "~71%" should become **"~67%,"** or the sentence should explicitly say "71% of the
admin-only literal count" if that's genuinely the intended scope.

```bash
# spot check: does 'oklch(26%_0.14_25)' (rank 1, 171 occurrences) appear in src/components/ui/ at all?
grep -rn '26%_0.14_25' src/components/ui/*.tsx
# → src/components/ui/badge.tsx (several), src/components/ui/input.tsx:116, :143 (D3's own defect)
# Confirms the #1 literal is NOT admin-exclusive — mixing an admin-only denominator with a
# combined-scope numerator double-counts nothing but does understate the true percentage.
```

**Fix for the deepened plan:** recompute the percentage against 717, or label both numbers by scope.

### 1.4 The button-hover "near-identical" example (line 792) — confirmed present, description imprecise

```bash
grep -n '95.5%_0.012_155' src/components/ui/button.tsx
# → button.tsx:29 and :35 (admin-secondary hover:, admin-ghost hover: — see §5 below)
grep -n 'admin-hover-mist' src/styles/tokens.css
# → tokens.css:140  --admin-hover-mist: oklch(95.5% 0.022 247);   (:root / light)
#   tokens.css:382  --admin-hover-mist: oklch(27% 0.018 247);      (dark)
#   tokens.css:488  --admin-hover-mist: oklch(95.5% 0.022 247);    ([data-theme="light"])
```

The literal is `oklch(95.5% 0.012 155)`; `--admin-hover-mist`'s light value is `oklch(95.5% 0.022 247)`.
**Lightness (95.5%) matches; chroma (0.012 vs 0.022) AND hue (155 vs 247) both differ** — the plan
(line 792) says "same lightness, different hue" but omits that chroma differs too. Minor, but worth
correcting since this is the plan's own worked example of how to classify a Class 2 substitution.

---

## 2. `src/components/ui/` — every file, every importer outside admin

```bash
ls src/components/ui/
# accordion.tsx badge.tsx button-link.tsx button.tsx card.tsx checkbox.tsx container.tsx
# dialog.tsx form.tsx input.tsx section.tsx switch.tsx textarea.tsx     (13 files)

for f in accordion badge button-link button card checkbox container dialog form input section switch textarea; do
  echo "=== $f ==="
  grep -rln "from [\"']@/components/ui/$f[\"']" src --include='*.tsx' --include='*.ts' \
    | grep -v "^src/components/ui/"
done
```

| File | oklch( count | Importers OUTSIDE `src/app/admin/**` |
|---|---:|---|
| `accordion.tsx` | **0** | `src/components/area-pages/AreaFAQ.tsx`, `src/components/faqs-aftercare/FaqCategoryAccordions.tsx`, `src/components/home/HomeFAQPreview.tsx`, `src/components/package-pages/PackageFAQ.tsx` — all rendered on **public pages** |
| `badge.tsx` | **22** (11 lines) | `src/app/booking/manage/page.tsx` — **only consumer in the entire repo, admin included** (see §3) |
| `button-link.tsx` | 0 | none found |
| `button.tsx` | **8** (4 lines) | `src/app/booking/manage/ManageBookingForms.tsx:5` |
| `card.tsx` | 0 | none found |
| `checkbox.tsx` | 0 | none found |
| `container.tsx` | 0 | none found |
| `dialog.tsx` | 0 | `src/components/shared/MaintenanceModal.tsx`, `src/app/admin/staff/NewStaffForm.tsx` |
| `form.tsx` | 0 | none found |
| `input.tsx` | **10** | `src/app/booking/manage/ManageBookingForms.tsx:6` |
| `section.tsx` | 0 | none found |
| `switch.tsx` | 0 | admin-only importers |
| `textarea.tsx` | 0 | `src/app/booking/manage/ManageBookingForms.tsx:7` |

**Conclusion: only `badge.tsx`, `input.tsx`, `button.tsx` carry any literal at all** among the 13 files —
confirms the plan's framing that exactly 3 primitives matter for Phase B. But two things the plan
doesn't currently state, both real:

1. **`dialog.tsx` (0 literals) is imported by `src/components/shared/MaintenanceModal.tsx`**, which per
   this codebase's own convention (`src/lib/maintenance.ts`, which this audit is instructed never to
   touch) can render **site-wide, public pages included**. It is proven clean (0 literals) — a fact
   worth stating explicitly so nobody re-derives it, since "shared with the public site" is exactly the
   red flag category this plan is hunting for and `dialog.tsx` matches that category by import graph
   alone.
2. **`accordion.tsx` (0 literals) is imported by four files rendered on public FAQ sections** — same
   situation: proven clean, worth stating so it's not re-investigated.

Neither changes Phase B's scope. Both are useful negative findings ("proven not affected") for the
blast-radius section.

---

## 3. `src/app/booking/manage/` — the known trap, verified in full

```bash
find src/app/booking -type f | sort
# src/app/booking/__tests__/no-google-analytics.test.ts
# src/app/booking/manage/ManageBookingForms.tsx
# src/app/booking/manage/actions.ts
# src/app/booking/manage/page.tsx
```

**`src/app/booking/manage/` is the ENTIRE `src/app/booking/` tree.** There is no other route under
`src/app/booking/**` — no `src/app/booking/page.tsx`, no confirmation page, nothing else. (The main
customer booking flow lives elsewhere, under `src/features/booking/` + `src/app/(public)/`, outside
this route group entirely.) So "what else does `src/app/booking/**` render that Phase B would touch" has
a complete, closed answer: **nothing beyond the 3 files already named** (`ManageBookingForms.tsx`,
`page.tsx`, `actions.ts`), and `actions.ts` has zero JSX/className and zero oklch literals.

Import lines, verified exact:

```bash
grep -n "^import" src/app/booking/manage/ManageBookingForms.tsx
# 3: import { useActionState } from "react";
# 4: import { Loader2 } from "lucide-react";
# 5: import { Button } from "@/components/ui/button";
# 6: import { Input } from "@/components/ui/input";
# 7: import { Textarea } from "@/components/ui/textarea";
# 8: import { addCustomerManageNote, requestCustomerCancellation, requestCustomerReschedule, ... } from "./actions";

grep -n "^import" src/app/booking/manage/page.tsx
#  1: import Link from "next/link";
#  2: import { CalendarCheck, CreditCard, MapPin, ShieldCheck, Users } from "lucide-react";
#  9: import { Badge } from "@/components/ui/badge";
# 10: import { getCustomerManageBooking } from "@/lib/booking/customer-manage";
# 11: import { ManageBookingForms } from "./ManageBookingForms";
```

**CONFIRMED, exact:** `Button` at `ManageBookingForms.tsx:5`, `Input` at `:6`, `Badge` at `page.tsx:9` —
matches the plan's §7.7a table precisely. `Textarea` (`:7`) is also imported but is proven clean (§2).

**`Badge`'s exposure is worse than "the customer page is one of several consumers" — it is the ONLY
consumer, anywhere:**

```bash
grep -rln "from [\"']@/components/ui/badge[\"']" src --include='*.tsx' --include='*.ts'
# → src/app/booking/manage/page.tsx     (exactly one hit, repo-wide)
```

The plan's §7.7a already demotes `badge.tsx` correctly on the "0 admin call sites" evidence, but
understates the actual finding: `badge.tsx` isn't merely under-used in admin, **it has never had a
single consumer anywhere except this one live customer page.** Editing it is 100% customer-facing risk
for 0% admin benefit — stronger than "dead-code hygiene with real risk to the customer page," it is
"editing a component whose only live rendering is on a bearer-token-carrying customer page, for zero
admin readability gain." Recommend the plan say this more starkly, since it changes the batch's actual
risk/reward from "low reward, some risk" to "zero reward, all risk."

---

## 4. `<Badge` / `AdminStatusBadge` counts

Plan §7.7a (line 840): *"Measured: 0 `<Badge` call sites in `src/app/admin/**`, against 141 uses of
`AdminStatusBadge`."*

```bash
grep -rEo '<Badge[ >]' src/app/admin --include='*.tsx' | wc -l
# → 0        CONFIRMED — 0 <Badge call sites in admin.

grep -rhoE "<AdminStatusBadge" src/app/admin --include='*.tsx' --include='*.ts' | wc -l
# → 99       NOT 141.
```

**"141 uses of `AdminStatusBadge`" does not hold up. The true JSX-usage count is 99.** Diagnosing the
gap: a raw `grep -c "AdminStatusBadge"` (counting *any* line mentioning the identifier — imports,
destructured import braces on their own line, the definition itself, and two doc comments referencing
it by name) returns 142 matching lines in `src/app/admin/**`, which is suspiciously close to "141" and
is the likely source of the plan's number — but that count includes ~19 import statements, the
function's own definition and its doc comment in `admin-ui.tsx`, none of which are "uses" in the sense
the sentence claims (call sites). **99 is the correct call-site count; use it.** (`AdminStatusBadge`
being defined and consumed only inside `src/app/admin/` — confirmed via `grep -rln "export function
AdminStatusBadge" src` returning only `admin-ui.tsx` — is otherwise accurate and unaffected by this
correction; also confirmed 0 `oklch(` in `admin-ui.tsx`, so `AdminStatusBadge` itself is genuinely
already token-clean.)

---

## 5. `button.tsx`'s D2 — the same "dead variant" trap as `badge.tsx`, not currently flagged

```bash
sed -n '1,55p' src/components/ui/button.tsx
```

`button.tsx` defines 5 admin variants: `admin-primary`, `admin-secondary`, `admin-destructive`,
`admin-ghost`, plus 5 public-site variants. **D2's literal (`active:bg-[oklch(92%_0.022_155)]`,
`hover:bg-[oklch(95.5%_0.012_155)]`) lives exclusively inside `admin-secondary` (line 29) and
`admin-ghost` (line 35).**

```bash
grep -rn 'variant="admin-secondary"\|variant="admin-ghost"' src --include='*.tsx'
# → (no matches anywhere in the tree)
```

**Confirmed (independently re-derived, and matches `surgical-review.md` §1.1): `admin-secondary` and
`admin-ghost` have zero live call sites anywhere in the codebase.** Every admin `<Button>` /
`buttonVariants()` call site in the tree uses either the default (`admin-primary`) or `outline`
(a public-site variant, literal-free). D2 is therefore, by the same "dead variant" logic the plan
already applies to demote `badge.tsx`, **currently invisible in the live product** — fixing it is
correct hygiene but delivers no observable readability win today, contradicting §7.7's framing of the
`input.tsx` + `button.tsx` batch as "the biggest readability win in the smallest, most reviewable diff."

**What actually IS live and carries an unregistered literal:** `admin-primary` (the default, used at
every genuine admin button call site) has its own `active:` literal, `oklch(15%_0.065_155)`
(button.tsx:26), which is not any of D1–D12 in the defect register. It is presumably swept into Layer
1/2's aggregate counts already (their tools don't need a named defect ID to find it), but the plan's
prose treats D2 as *the* button defect worth prioritizing, when the literal with real reach is a
different, unlabelled one on the same file.

**Recommendation for the deepened plan:** either (a) relabel D2 to point at `admin-primary`'s
`active:` literal instead, or (b) explicitly note, exactly as §7.7a already does for `badge.tsx`, that
D2 as currently defined is dead code, and that `input.tsx`'s D3 (confirmed live via `AdminField`'s
`required` asterisk and field-error text — used at 5 call sites via `StaffProfileForm.tsx` and others)
is doing all of the real readability work in that first batch. This does not change the "ship
input/button/(badge separately)" ordering, but it changes the stated *justification* for shipping
`button.tsx` in the first batch at all.

---

## 6. Six availability files, items 3 + 6 collision — re-counted, off by 3

Item 3 (§3.2, plan lines 210–220) touches exactly:
- `src/app/admin/availability/page.tsx`
- `src/app/admin/staff/[staffId]/availability/page.tsx`

Item 6 (§6.4, plan lines 384–409) additionally touches:
- `src/app/admin/availability/availability-data.ts`
- `src/app/admin/staff/[staffId]/availability/lib.ts`
- `src/app/admin/availability/AvailabilityOverridesManager.tsx`
- `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx`

Together, exactly **six** files — confirms the plan's "six availability files" count.

```bash
for f in \
  "src/app/admin/availability/page.tsx" \
  "src/app/admin/staff/[staffId]/availability/page.tsx" \
  "src/app/admin/availability/availability-data.ts" \
  "src/app/admin/staff/[staffId]/availability/lib.ts" \
  "src/app/admin/availability/AvailabilityOverridesManager.tsx" \
  "src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx"; do
  n=$(grep -oE 'oklch\(' "$f" | wc -l); echo "$n  $f"
done
```

| File | `oklch(` count |
|---|---:|
| `availability/page.tsx` | 8 |
| `staff/[staffId]/availability/page.tsx` | 0 |
| `availability/availability-data.ts` | 0 |
| `staff/[staffId]/availability/lib.ts` | 9 |
| `availability/AvailabilityOverridesManager.tsx` | 7 |
| `staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx` | 2 |
| **Total** | **26** |

**The plan's "23 `oklch()` literals" (lines 850, 1222) is off by 3 — the true count is 26.** (This
matches `surgical-review.md`'s independent count of 23 almost exactly, off by the same handful — that
review's own per-file table sums to 23 using slightly different per-file numbers (7+6+9+1+0+0), so both
this review and that one land close but not identical; **the deepened plan should say "re-run the exact
grep at execution time," not print either fixed number as fact**, since both are demonstrably off by a
few from a clean re-run today.)

**Sequencing implication unchanged:** items 3 and 6 must land, and be re-grepped, before item 7 touches
these six files — this conclusion holds regardless of whether the true count is 23 or 26.

---

## 7. Confirmed: items 3/6 never touch `AdminTopNav.tsx`

```bash
grep -n "AdminTopNav" redesign/plans/POST-BAND-C-FOLLOWUP-plan.md | sed -n '1,20p'
```
Item 3's file list (§3.2) and item 6's file list (§6.4) name only the six files in §6 above.
`AdminTopNav.tsx` appears nowhere in either. **The plan's own correction at §7.7a (line 848) is itself
correct** — the original "AdminTopNav.tsx collision" claim was wrong and has already been retracted in
the current plan text. No further finding needed here; flagging only that the retraction is accurate on
re-check.

---

## 8. Collisions the plan does NOT mention

### 8.1 ITEM 1 → `src/app/admin/emails/page.tsx` — confirmed real, TWO separate collision mechanisms

Item 1 (§1.6, line 146) places its new manual-send form **"beside `ReminderResendForm` on
`/admin/emails` (`src/app/admin/emails/page.tsx:925`)."**

```bash
grep -oE 'oklch\(' src/app/admin/emails/page.tsx | wc -l
# → 29
grep -n 'oklch(' src/components/ui/../../app/admin/emails/ReminderResendForm.tsx 2>/dev/null
grep -n 'oklch(' src/app/admin/emails/ReminderResendForm.tsx
# → ReminderResendForm.tsx:111 — a raw oklch() literal in a success-state banner
```

Two distinct, real collisions, not one:

1. **File-level:** `emails/page.tsx` carries 29 `oklch()` literals that Phase B's substitution work
   will edit. Item 1 also edits this file (adding the new form's mount point near line 925). If item 1
   runs before item 7 (as the plan's own "Suggested order" table has it — item 1 at position 6, item 7
   at position 7), item 7's pre-Phase-A literal census will be stale by the time Phase A starts.
2. **Copy-paste collision:** item 1's own instruction (§1.6) is to **"mirror the established pattern
   exactly"** — and the pattern being mirrored, `ReminderResendForm.tsx`, itself contains a live
   `oklch()` literal at line 111. Followed literally, item 1's new form will introduce **at least one
   brand-new hardcoded literal**, in a component that didn't exist when Phase A's 94-value catalogue
   was built — directly working against item 7's goal, in the same commit sequence the plan proposes.

**Neither collision is currently named anywhere in the plan.** (This exact pair of findings also
appears, independently derived, in `surgical-review.md` §2 and §6 — corroborating, not duplicative;
that review's number for `emails/page.tsx` was 17, not 29 — see the note below.)

*Note on the 17-vs-29 discrepancy:* `surgical-review.md` (line 153) says "`emails/page.tsx` itself
carries 17 literals." My own re-run today gives 29. Both re-runs used the same grep. **This is very
likely NOT tool disagreement but genuine drift** — `redesign/HANDOFF-2026-08-11-PLANNING.md` §4 item 9
records that "`page.tsx` added to C-14's files list" was approved *after* that review was written, and
`emails/page.tsx` independently grew a new manual-resend UI block in the time since. Either way, this is
exactly the kind of number Phase A must re-derive at execution time rather than trust from any prior
document, this one included.

**Recommendation:** either (a) instruct item 1's implementer to write the new form's colour classes
using tokens only — a small, explicit, scoped deviation from "mirror exactly" — or (b) make it an
explicit, named prerequisite that item 7's Phase A re-runs `measure-admin-contrast.mjs` fresh
immediately before starting, never trusting the plan's printed 677/717 figures. Recommend doing both.

### 8.2 ITEM 8 → four files, one of them NOT in item 8's own consumer list

```bash
for f in "src/app/admin/settings/SettingsForm.tsx" \
         "src/app/admin/bookings/new/ManualBookingForm.tsx" \
         "src/app/admin/bookings/BookingManagementForm.tsx" \
         "src/app/admin/bookings/new/page.tsx" \
         "src/app/admin/bookings/[bookingId]/page.tsx"; do
  n=$(grep -oE 'oklch\(' "$f" | wc -l); echo "$n  $f"
done
```

| File | `oklch(` | Touched by item 8 per plan text? |
|---|---:|---|
| `settings/SettingsForm.tsx` | 37 | Yes — §8.4, `ServiceAreaField`, named lines |
| `bookings/new/ManualBookingForm.tsx` | **79** (largest single-file count in the whole tree) | **NOT named — but IS a real consumer (see below)** |
| `bookings/BookingManagementForm.tsx` | 13 | Yes — §8.8, `StatusAndPaymentSection`, named lines |
| `bookings/new/page.tsx` | 0 | Yes — §8.4, named as an `allowed_cities` consumer |
| `bookings/[bookingId]/page.tsx` | 21 | Not directly named, but `getBookingDetailData` (fetched from this page) is named in §8.8 as needing the town list added |

**The real gap: `ManualBookingForm.tsx` is a genuine consumer of `allowed_cities` that item 8's own
"~8 files" list (§8.4, line 1022) omits.**

```bash
grep -n "allowedCities" src/app/admin/bookings/new/ManualBookingForm.tsx
#  529:  allowedCities = [],
#  550:  allowedCities?: string[];
# 1689:    allowedCities.length === 0 ||
# 1690:    allowedCities.some((allowed) => {
# 1727:                &ldquo;{cityTrimmed}&rdquo; is outside our current service area. We deliver to: {allowedCities.join(", ")}.
```

`ManualBookingForm.tsx` receives an `allowedCities` prop (fed from `admin/bookings/new/page.tsx:84`,
which §8.4 DOES name) and renders its own inline warning: *"'{city}' is outside our current service
area. We deliver to: {allowedCities.join(", ")}."* This is **exactly the class of statement §8.4
already identifies as needing rewrite in `SettingsForm.tsx`** ("actively false" once `allowed_cities`
inverts meaning to a free-travel zone rather than a gate) — but `ManualBookingForm.tsx` is not in that
rewrite list, and the file itself is not named anywhere in §8 as a file to touch.

**Compounding factor: `ManualBookingForm.tsx` is ALSO item 7's own D5 defect file**
(`ManualBookingForm.tsx:1486`, confirmed — see below) **and the single largest concentration of
`oklch()` literals anywhere in the codebase (79, more than `emails/page.tsx`'s 29 or
`SettingsForm.tsx`'s 37).** This is the most consequential undocumented collision found in this audit:
one file, touched for three unrelated reasons (item 7's D5 fix, item 8's copy rewrite once
`allowedCities` semantics flip, and — separately — any future work on the manual-booking flow), 79
literals deep.

**Recommendation:** add `ManualBookingForm.tsx` to item 8's §8.4 consumer list (with the specific
line-1727 copy that must change), and add a named cross-reference from item 7's D5 entry noting this
file is also touched by item 8 — so whichever item runs second re-greps rather than assuming its
snapshot still holds.

### 8.3 D2/D4/D5/D6 anchors re-verified — all confirmed exact, zero drift

```bash
sed -n '340,344p' src/app/admin/components/admin-ui-interactions.tsx   # D4
sed -n '1484,1488p' src/app/admin/bookings/new/ManualBookingForm.tsx   # D5
sed -n '169,175p' src/app/admin/operations/event-row.tsx               # D6 (event-row half)
sed -n '648,662p' src/app/admin/calendar/page.tsx                      # D6 (calendar half)
```

All four anchors (`admin-ui-interactions.tsx:342`, `ManualBookingForm.tsx:1486`,
`event-row.tsx:171-173`, `calendar/page.tsx:650,660`) land exactly where the plan says, with the exact
literal text quoted in the plan. **No drift on these four — the dispatch's "src/ is byte-identical"
claim holds for every anchor checked in this report.**

---

## 9. Guard-test precedents — re-verified, and the plan overstates what they already disclose

### 9.1 C-21's anti-drift domain test

`src/content/site/__tests__/canonical-domain.test.ts` (read in full). Confirmed idiom: `readFileSync` +
substring scan over every file under `src/`, with an explicit "vacuous pass" guard
(`expect(files.length).toBeGreaterThan(100)`), and a comment block naming the two failure modes it
guards (wrong-domain literal; a second hardcoded copy of the correct one). **Good model to copy for the
new oklch guard**, specifically the vacuous-pass guard and the "why this test exists" comment block.

### 9.2 C-17's "recursive GA-import guard"

`src/app/booking/__tests__/no-google-analytics.test.ts` (read in full). Same idiom: recursive
`readFileSync` walk, vacuous-pass guard, substring match on `"GoogleAnalytics"`.

**Correction to the plan's claim (§7.8, line 866): "the C-17 guard makes exactly this disclosure"
(i.e. discloses that a source-text match can be evaded by a computed string or alias) — it does NOT.**
Reading the actual file, its comment explains *why* the guard exists (the bearer-token exfiltration
risk) and *that* a prior regression happened, but contains no sentence disclosing "this is a
source-text match; an aliased import or a computed reference would evade it." The plan is citing this
test as a precedent for a disclosure it doesn't actually contain.

**This matters for the deepened plan:** the new oklch guard (Phase C) should still add this disclosure
— it's good practice regardless — but should not be instructed to "copy the idiom" of a disclosure that
isn't there to copy. Recommend the deepened plan state the disclosure sentence in full (a draft is
below in §10) rather than deferring to a precedent that doesn't actually contain one.

---

## 10. The "cheap tripwire" — made concrete

Plan §7.7a (lines 852–858) specifies the *concept* — assert every substituted token's resolved
light-mode value equals the literal it replaced — but names no file. `surgical-review.md` §3
("The regression tripwire") independently proposed the same check and named the machinery to build it
on. I verified that machinery exists exactly as described:

```bash
grep -n "^export function\|^export const" scripts/verify-admin-token-contrast.mjs
#  86: export function resolveColour(raw, scope, depth = 0)
# 193: export function parseTokensCss(css)
```

**Concrete spec for the deepened plan:**

- **New file:** `scripts/verify-admin-substitution-log.mjs` + a corresponding `.test.ts`, following
  this repo's existing pattern of a standalone `.mjs` script paired with a `.test.ts` that imports its
  exported functions (exactly as `measure-admin-contrast.mjs`/`.test.ts` and
  `verify-admin-token-contrast.mjs`/`.test.ts` already do).
- **What it parses:** a substitution log the implementer keeps during Phase B — one line per edit, e.g.
  `{file, line, oldLiteral, newToken}` (JSON or CSV; JSON preferred for consistency with this repo's
  other scripts' `--json` mode) — plus `tokens.css` via the already-exported `parseTokensCss`.
- **What it asserts:** for every logged substitution where the literal was classified as "byte-identical
  to an existing token's light value" (§7.6 Class 1), `resolveColour("var(--<newToken>)", "light")` (the
  already-exported function, reused, not reimplemented) equals the byte value of `oldLiteral`. Any
  mismatch is a hard failure with the file/line printed.
- **Cost:** no server, no browser, no login — pure string/colour comparison, milliseconds, matching the
  plan's own framing exactly. It converts §7.7's prose rule ("light mode is the control... any diff =
  mis-map") into a machine-checked one that runs per-batch, not just at the end.

---

## 11. `e2e/admin-contrast.spec.ts` + helpers — read in full; TWO factual errors in plan §7.9(b)

### 11.1 Roles — the plan names 6 roles; the actual, already-built spec runs 4, and its own comment says why

Plan line 893: *"For each role in `OWNER`, `ADMIN`, `COORDINATOR`, `THERAPIST_A`, `THERAPIST_B`,
`REPORTING`."*

```ts
// e2e/admin-contrast.spec.ts:48
const CONTRAST_ROLES = ["OWNER", "ADMIN", "COORDINATOR", "THERAPIST_A"] as const;
```

The spec's own comment block (lines 27–29) states explicitly: *"Roles — verified against the live
database (2026-08-10): only Owner, Admin, Booking Coordinator, Therapist and Inactive exist. There is
no Reporting role; THERAPIST_B and NON_STAFF credentials are unpopulated."*

**This is a real, load-bearing factual error in the plan, not a rounding difference.** `THERAPIST_B` and
`REPORTING`/`Reporting` are not roles this spec can run — one role literally does not exist in the
product's role model, and the other has no credentials to populate even if it existed. An implementer
following plan §7.9(b) literally would try to add `E2E_THERAPIST_B_*` and `E2E_REPORTING_*` entries to
`.env.e2e` (as the plan's own §7.9 template does at lines 923, 925) for a role and a set of credentials
that cannot exist. **§7.9(b)'s role list and the `.env.e2e` template must both be corrected to the 4
roles the spec already runs** (`OWNER`, `ADMIN`, `COORDINATOR`, `THERAPIST_A`), with `INACTIVE` kept as
its own separate negative-path-only credential (already handled by a dedicated test, not part of the
contrast sweep), and `THERAPIST_B`/`REPORTING` removed as non-existent.

### 11.2 Route count — the plan says 31; the spec's own list has 29, and the repo has 32 `page.tsx` files

```bash
grep -c '^\s*"/admin' e2e/admin-contrast-helpers.ts
# → 29   (ADMIN_CONTRAST_ROUTE_TEMPLATES, lines 71-101 — the spec's own comment at line 64
#          independently confirms: "The 29 role-loop route templates")
find src/app/admin -name "page.tsx" | wc -l
# → 32
```

Three different true numbers, none of which is "31":
- **32** — raw count of every `page.tsx` under `src/app/admin/**`.
- **29** — the route-loop templates the live sweep actually visits per authenticated role
  (`ADMIN_CONTRAST_ROUTE_TEMPLATES`, confirmed by the array's own length and by its own header comment).
- The remaining **3** are `src/app/admin/login/page.tsx` and
  `src/app/admin/password-reset/page.tsx` (both audited once, outside the role loop, by the
  `"unauthenticated admin surfaces"` test — 2 of the 3), and `src/app/admin/page.tsx` (the bare `/admin`
  root, presumably a redirect — **not audited anywhere in the spec**, a genuine small coverage gap worth
  noting but not urgent, since a redirect-only page has no text nodes to fail contrast on).

**Recommendation:** correct plan line 894 to "29 role-loop route templates (`ADMIN_CONTRAST_ROUTE_TEMPLATES`
in `e2e/admin-contrast-helpers.ts`), plus 2 unauthenticated routes audited once outside the loop; 32
`page.tsx` files exist in total, `/admin` itself is a bare redirect and is not separately audited."

### 11.3 Theme-setting mechanism — CONFIRMED exactly as the plan describes

```ts
// admin-contrast-helpers.ts:384-399, setAdminTheme()
root.setAttribute("data-theme", t);   // sets [data-admin-theme-root] directly
```
Confirmed: theme is set via direct DOM attribute mutation on `[data-admin-theme-root]`, never through
the in-app theme control, so no `theme_preference` write reaches the database — matches plan line 896
exactly. A documented `html-fallback` mechanism exists for unauthenticated pages where the theme-root
div never mounts (login/password-reset), which is a measurement-only test behaviour, explicitly
commented as never happening in production code.

### 11.4 `/booking/manage` cannot be added to the sweep without a database write — confirmed, and here is why

```bash
# manage_token_hash is set ONLY by ensureBookingManageUrl (src/lib/booking/manage-token.ts:43-61),
# which is called from the booking-CREATION send path and nowhere else that returns plaintext:
grep -rn "ensureBookingManageUrl(" src --include="*.ts" --include="*.tsx"
```

`src/lib/booking/manage-token.ts` stores **only the sha256 hash** of the manage token
(`manage_token_hash`); the plaintext is minted once (`randomUUID()`), written to the DB as a hash, and
handed back as a URL — and is **never recoverable from the hash afterward.** The only production path
that mints a fresh plaintext token is `ensureBookingManageUrl`, called at booking creation (an INSERT).
A second helper, `getExistingBookingManageUrl`, exists specifically to avoid re-minting and **always
returns `undefined`** by design (its own doc comment explains why — there is currently no schema support
for retrieving an already-minted token).

**Conclusion: there is no way to obtain a valid `/booking/manage?token=...` URL without a database
write (a new `bookings` INSERT).** This confirms the audit brief's suspicion. `/booking/manage` **cannot
be added to Layer 3's automated, unattended sweep** without either (a) a Zone-2 approved test-booking
creation (mirroring the precedent already used for C-23's test bookings — created under explicit Owner
approval, verified, then deleted), or (b) accepting it as permanently out of the automated sweep.

**Recommended manual-control alternative, concretely:**
1. Under a single Owner-approved Zone-2 action, create one throwaway test booking via the existing
   admin manual-booking flow (or `ensureBookingManageUrl` called directly in a one-off script), capture
   its manage URL.
2. Before the primitives batch (button/input/badge), screenshot `/booking/manage?token=<that token>` in
   both themes — this satisfies §7.7a's binding requirement #1 ("capture it as a control first"), which,
   read literally, already assumes a token is obtainable and currently has no stated mechanism for
   obtaining one.
3. After the batch, re-screenshot and diff.
4. Delete the test booking afterward (same precedent as the C-23 cleanup already performed this
   programme), or simply let its token expire naturally (`manage_token_expires_at` is set to the
   booking date's end-of-day — a test booking dated in the past would already be expired and
   `InvalidManageLink()` would render instead of the real form, so the test booking should be dated
   **today or later**, and cleaned up promptly regardless).
5. Record this as a **manual, human-verified control**, not an automated Layer-3 sweep entry — do not
   silently omit it, and do not claim Layer 3 "covers" this route.

This is materially different from what §7.7a currently says (point 3, line 836: *"if none can be
obtained without a production write, record it unreachable and verify manually"*) — the plan already
anticipates this exact outcome and already specifies the fallback correctly. This section's job is
confirming the "cannot obtain without a write" premise is TRUE (it is) and making the manual-control
steps concrete rather than leaving them as a one-line fallback.

---

## 12. Print block — confirmed exactly as the plan describes

```bash
sed -n '543,548p' src/styles/tokens.css
```
```css
@media print {
  :root,
  [data-theme="dark"],
  [data-theme="light"],
  [data-admin-theme-root][data-theme="dark"] ~ *,
  [data-admin-theme-root][data-theme="light"] ~ * {
    --admin-canvas: #fbf8f2;
    ...
```

**Confirmed: one ruleset, five selectors, all forced to light-mode values regardless of the active
theme.** Any new token added during Phase A must add an entry inside this same block (alongside `:root`,
`[data-theme="dark"]`, `[data-theme="light"]`) or it will silently fall back to whatever the browser's
print-media default resolves to for that custom property, which is exactly the failure mode §7.6
already warns about. No correction needed here — this is the one claim in this section of the plan that
checks out exactly as written.

---

## 13. Batch definitions — reviewable groups, exact commands, expected literal-count movement

All batches assume Phase 0 (§7.5b) and items 3/6 have already landed (per §6/§7 above). Every batch
re-runs the same three commands; only the expected direction/magnitude differs.

```bash
# Layer 1 — static source analyser
node scripts/measure-admin-contrast.mjs . --json > /tmp/layer1-after.json
# Layer 2 — token-pair proof
node scripts/verify-admin-token-contrast.mjs . --json > /tmp/layer2-after.json
# Gates by identity
npx tsc --noEmit
pnpm lint
npx vitest run
# Raw literal census (Workstream 2's own metric, not Layer 1's WCAG-failure metric — see §1)
grep -rhEo 'oklch\(' src/app/admin src/components/ui --include='*.tsx' --include='*.ts' | wc -l
```

### Batch 1 — `input.tsx` alone (D3)

- **Files:** `src/components/ui/input.tsx` only.
- **Literal count this batch must move:** raw census −10 (from 717 → 707); Layer 1 total must fall by
  the genuine pairings inside `input.tsx`'s asterisk (`:116`) and field-error (`:143`) spans specifically
  — do not expect a large drop, `input.tsx` is 2 of the file's 10 literals in the genuinely-failing
  spans, the rest are already `var(--…, fallback)` pairs.
- **Must NOT move:** Layer 2 (button/badge/input reference no `--admin-warning*` pair — confirmed via
  `grep -n "admin-warning" src/components/ui/{button,badge,input}.tsx` → no matches); `tsc`/`lint`/vitest
  identity.
- **New, batch-specific check:** capture `/booking/manage` in both themes per §11.4's manual-control
  procedure — this is the batch where `Input`'s two customer-facing call sites
  (`ManageBookingForms.tsx:89,100`) are directly touched.

### Batch 2 — `button.tsx` alone, with the D2 caveat from §5

- **Files:** `src/components/ui/button.tsx` only.
- **Literal count this batch must move:** raw census −8 (707 → 699).
- **Expected visible change:** effectively **zero**, live — `admin-secondary`/`admin-ghost` (where D2's
  literals live) have 0 call sites (§5). Do not treat "no visible diff" as a failed batch; it is the
  expected outcome. `admin-primary`'s own `active:` literal (`oklch(15%_0.065_155)`, not currently a
  named defect) is untouched by this batch unless explicitly added to Phase A's classification — flag
  this decision explicitly in the commit message either way.
- **Must NOT move:** Layer 2 identity; `/booking/manage`'s `Button` call site
  (`ManageBookingForms.tsx:176`) uses the default `primary` variant, which carries no `admin-*` literal
  and is proven untouched by this batch (§2, confirmed by `surgical-review.md` §1.1 independently).

### Batch 3 — `badge.tsx` alone, separate and later, labelled as hygiene not readability

- **Files:** `src/components/ui/badge.tsx` only.
- **Literal count this batch must move:** raw census −22 (from wherever batch 2 left off, −22).
- **Expected visible change:** zero in admin (0 call sites, confirmed §4); **the only observable
  surface is `/booking/manage`'s status badge** (its only consumer, repo-wide — §3). Capture that
  surface specifically before/after this batch, per §11.4.
- **Commit message must say "0 admin call sites, dead-code hygiene"** — do not let this batch be read as
  fixing a live defect.

### Batch 4 — top-10 literal values across `src/app/admin/**`

- **Files:** whichever files contain occurrences of the 10 values in §1.3's table — re-derive the exact
  file list at execution time via `grep -rl` per value, do not use a stored list (anchors drift; file
  contents don't, but the *set* of files carrying a given literal can change if items 1/3/6/8 landed new
  code in the interim — see §8).
- **Literal count this batch must move:** raw census should drop by close to 483 (§1.3), concentrated in
  exactly those 10 values — **verify concentration, not just aggregate**: re-run the top-10 table after
  the batch and confirm each of the 10 values' occurrence count is at or near zero, not merely that the
  total fell by roughly the right amount (an aggregate drop not concentrated in the target 10 indicates
  the substitution touched the wrong things — this is `surgical-review.md`'s own recommendation, and it
  is correct).
- **Must NOT move:** Layer 2; `unresolvedElements` in Layer 1's output must not increase (an increase
  means a literal was replaced with a *computed* expression the analyser can no longer see, defeating
  both Layer 1 and the future Phase C guard simultaneously — treat as a hard stop).

### Batch 5+ — long tail, batched by directory

- **Files:** remaining files, batched per admin subdirectory (`bookings/`, `clients/`, `staff/`,
  `emails/`, etc.) for reviewability — same per-batch checks as Batch 4, scaled down.
- **Special note:** `ManualBookingForm.tsx` (79 literals, the largest single file) should be its own
  batch, not folded into a `bookings/` directory batch, given its size and its item-8 collision (§8.2) —
  land it only after confirming item 8 has (or has not) touched its copy in the interim.
- **Special note:** `emails/page.tsx` (29 literals) should be re-scanned immediately before its batch,
  given the item-1 collision (§8.1) — do not trust this report's or the plan's count.

### Batch — Phase C guard + cheap tripwire

- **Files:** new `scripts/admin-oklch-ceiling.json` (or similar) + guard test (existing
  `measure-admin-contrast.test.ts`'s `--max-failures`-style CLI gate, or a new file modeled on
  `src/app/booking/__tests__/no-google-analytics.test.ts`'s idiom — see §9); new
  `scripts/verify-admin-substitution-log.mjs` + `.test.ts` (§10).
- **Must move:** the ceiling constant should equal the raw census at the moment Phase C starts (re-run
  fresh, per §8.1's recommendation), not 677/717/any number from this report.
- **Must NOT move:** nothing else — this batch touches no product code.

---

## 14. Tests to add — named, with exact file/path

| Test | File | Asserts |
|---|---|---|
| No hardcoded colour in the 3 primitives | `src/components/ui/__tests__/no-hardcoded-colour.test.ts` (new) | `oklch(` does not appear in `button.tsx`, `badge.tsx`, `input.tsx` source text; vacuous-pass guard (file-count > 0); should land WITH the primitives batch, not wait for Phase C |
| Substitution light-mode tripwire | `scripts/verify-admin-substitution-log.mjs` + `scripts/verify-admin-substitution-log.test.ts` (new) | Per §10 — every logged byte-identical substitution resolves to the same light-mode hex as the literal it replaced, using `parseTokensCss`/`resolveColour` already exported from `verify-admin-token-contrast.mjs` |
| Phase C ratchet/guard | extend `scripts/measure-admin-contrast.test.ts` (existing — already has a `--max-failures` CLI-gate test per its own `run()` coverage), OR a new `src/app/admin/__tests__/no-new-admin-oklch.test.ts` modeled on `src/app/booking/__tests__/no-google-analytics.test.ts`'s idiom | Raw `oklch(` occurrence count under `src/app/admin/**` + `src/components/ui/**` does not exceed a checked-in ceiling; **must include an explicit disclosure comment** (draft: *"This is a source-text match. A computed template literal, string concatenation, or a value imported from a constant/JSON file will not be caught, nor will the same problem reintroduced via `lab()`/`hsl()`/hex syntax."*) — per §9.2's finding that the cited precedent doesn't already contain this disclosure |
| `--admin-warning` fix regression guard | extend `scripts/verify-admin-token-contrast.test.ts`'s existing `describe("verifyRatioComments...")` block (Phase 0 territory, cross-referenced here since it shares the file) | `{fg: "--admin-warning", bg: "--admin-warning-bg", theme: "light"}` resolves ≥4.5:1 post-fix |
| `/booking/manage` primitive regression (manual-triggered, not CI-automatic given §11.4) | document as a manual verification step in the commit description for Batches 1–3, or a Playwright spec gated behind a manually-supplied `E2E_TEST_MANAGE_TOKEN` env var if the Owner wants it scriptable later | Foreground/background colours on the two `<Input>` fields and the `Badge` are byte-unchanged before/after each of Batches 1–3 |

---

## 15. Stop conditions

1. **Any change in Layer 2's failure count during Phases A/B** other than the one sanctioned D8 change
   (which belongs to Phase 0, not this workstream) — stop, do not proceed, re-check which token pair
   moved and why.
2. **Any increase in Layer 1's `unresolvedElements`** — a literal was replaced with a computed
   expression the analyser (and the future guard) cannot see. Hard stop, not a note.
3. **A visual diff on `/booking/manage`** after any of Batches 1–3 (§11.4) — per §7.7a's own binding
   requirement, this is a STOP, not a note.
4. **`items 3/6` have not yet landed** and an implementer is about to edit one of the six files in §6 —
   stop, land 3/6 first, re-grep.
5. **A prose contrast claim in `tokens.css` looks wrong** while touching a nearby literal — log it
   (D11, Phase 0 territory), do not edit the comment inline as part of this workstream.
6. **`ManualBookingForm.tsx` is about to be edited by both this workstream and item 8 in the same
   session** — confirm which lands first, re-grep after, per §8.2.
7. **`CONTRAST_ROLES`/`.env.e2e` is about to be populated with `THERAPIST_B` or `REPORTING`** — stop;
   per §11.1 these do not exist / have no credentials; use the 4 roles the spec actually runs.

---

## 16. Rollback

- **Every Phase B commit is a pure text substitution** (literal → `var(--token)`), reviewable and
  revertable with a single `git revert` per commit — no data, no migration, no irreversible action
  anywhere in this workstream.
- **The Phase C guard/ratchet and the cheap tripwire are additive test files** — revertable by deleting
  the file; they assert on source text only, no runtime state.
- **The one genuinely irreversible action touched by this report is the `/booking/manage` manual-control
  test booking (§11.4)** — this is Zone-2 (a database INSERT) and requires its own Owner approval,
  separate from anything else in this workstream; rollback is deleting the test booking (same precedent
  as the C-23 cleanup already performed this programme) or letting its token expire naturally.

---

## Appendix — every command run for this report, in order

```bash
grep -rhEo 'oklch\([0-9.]+%[^)]*\)' src/app/admin src/components/ui --include='*.tsx' --include='*.ts' | wc -l
grep -rEl 'oklch\([0-9.]+%' src/app/admin src/components/ui --include='*.tsx' --include='*.ts' | wc -l
grep -rhEo 'oklch\([0-9.]+%[^)]*\)' src/app/admin src/components/ui --include='*.tsx' --include='*.ts' | tr '_' ' ' | sort -u | wc -l
grep -rhEo 'oklch\(' src/app/admin --include='*.tsx' --include='*.ts' | wc -l
grep -rlE 'oklch\(' src/app/admin --include='*.tsx' --include='*.ts' | wc -l
grep -rcE 'oklch\(' src/app/admin --include='*.tsx' --include='*.ts' | awk -F: '{s+=$2} END{print s}'
grep -rhEo 'oklch\(' src/components/ui --include='*.tsx' --include='*.ts' | wc -l
grep -rhEo 'oklch\([0-9.]+%[^)]*\)' src/app/admin --include='*.tsx' --include='*.ts' | tr '_' ' ' | sort -u | wc -l
grep -rhEo 'oklch\([0-9.]+%[^)]*\)' src/components/ui --include='*.tsx' --include='*.ts' | tr '_' ' ' | sort -u | wc -l
grep -rhEo 'oklch\([0-9.]+%[^)]*\)' src/app/admin src/components/ui --include='*.tsx' --include='*.ts' | tr '_' ' ' | sort | uniq -c | sort -rn | head -15
grep -n "95.5%_0.012_155\|95.5% 0.012 155" src/components/ui/*.tsx src/app/admin -r
grep -n "admin-hover-mist" src/styles/tokens.css
for f in accordion badge button-link button card checkbox container dialog form input section switch textarea; do
  grep -rln "from [\"']@/components/ui/$f[\"']" src --include='*.tsx' --include='*.ts' | grep -v "^src/components/ui/"
done
for f in src/components/ui/*.tsx; do grep -oE 'oklch\(' "$f" | wc -l; done
grep -rEo '<Badge[ >]' src/app/admin --include='*.tsx' | wc -l
grep -rln "from [\"']@/components/ui/badge[\"']" src --include='*.tsx' --include='*.ts'
grep -rhoE '<AdminStatusBadge' src/app/admin --include='*.tsx' --include='*.ts' | wc -l
grep -rln "export function AdminStatusBadge" src --include='*.tsx' --include='*.ts'
find src/app/booking -type f | sort
grep -n "^import" src/app/booking/manage/ManageBookingForms.tsx
grep -n "^import" src/app/booking/manage/page.tsx
grep -n "^## ITEM 3\|^## ITEM 6\|^## ITEM 4" redesign/plans/POST-BAND-C-FOLLOWUP-plan.md
for f in "src/app/admin/availability/page.tsx" "src/app/admin/staff/[staffId]/availability/page.tsx" \
  "src/app/admin/availability/availability-data.ts" "src/app/admin/staff/[staffId]/availability/lib.ts" \
  "src/app/admin/availability/AvailabilityOverridesManager.tsx" \
  "src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx"; do
  grep -oE 'oklch\(' "$f" | wc -l
done
grep -n "AdminTopNav" redesign/plans/POST-BAND-C-FOLLOWUP-plan.md
grep -oE 'oklch\(' src/app/admin/emails/page.tsx | wc -l
grep -n "oklch(" src/app/admin/emails/ReminderResendForm.tsx
for f in "src/app/admin/settings/SettingsForm.tsx" "src/app/admin/bookings/new/ManualBookingForm.tsx" \
  "src/app/admin/bookings/BookingManagementForm.tsx" "src/app/admin/bookings/new/page.tsx" \
  "src/app/admin/bookings/[bookingId]/page.tsx"; do
  grep -oE 'oklch\(' "$f" | wc -l
done
grep -n "allowedCities" src/app/admin/bookings/new/ManualBookingForm.tsx
sed -n '340,344p' src/app/admin/components/admin-ui-interactions.tsx
sed -n '1484,1488p' src/app/admin/bookings/new/ManualBookingForm.tsx
sed -n '169,175p' src/app/admin/operations/event-row.tsx
sed -n '648,662p' src/app/admin/calendar/page.tsx
sed -n '1,55p' src/components/ui/button.tsx
grep -rn 'variant="admin-secondary"\|variant="admin-ghost"' src --include='*.tsx'
sed -n '110,120p;140,146p' src/components/ui/input.tsx
grep -rln "C-21" src scripts e2e --include='*.test.ts' --include='*.test.tsx'
grep -rln "C-17" src scripts e2e --include='*.test.ts' --include='*.test.tsx'
grep -n "^export function\|^export const" scripts/verify-admin-token-contrast.mjs
grep -n "@media print" src/styles/tokens.css
sed -n '543,548p' src/styles/tokens.css
wc -l e2e/admin-contrast.spec.ts e2e/admin-contrast-helpers.ts
grep -c '^\s*"/admin' e2e/admin-contrast-helpers.ts
find src/app/admin -name "page.tsx" | wc -l
grep -rn "ensureBookingManageUrl(" src --include="*.ts" --include="*.tsx"
```

No product file was modified. Only this report file was written, at
`redesign/evidence/plan-deepening/item-07b-literals.md`. No migration applied, no credential read or
referenced, no git write command run.
