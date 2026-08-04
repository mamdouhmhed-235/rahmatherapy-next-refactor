# C-23 — Implementation surface map (pre-flight preparation, read-only)

**Produced by:** read-only preparation subagent, per SUBAGENT-RULES.md. No source files were edited. Git usage: `status`/`diff`/`log` only.
**Verified at:** `master` @ `7b1db05` (HEAD at time of this scan — matches the state recorded in `redesign/per-page-progress/C-23-admin-availability-calendar-progress.md`, which was already at pre-flight #4 HOLD when this map was produced).
**Purpose:** replace the plan's July-vintage line numbers with anchors verified against the current tree, so the C-23 implementer can work from exact text instead of re-deriving it under a live hold.

**Important:** `redesign/per-page-progress/C-23-admin-availability-calendar-progress.md` already records that the Owner hit and resolved the pre-flight #3 "empty diff" contradiction on 2026-08-04 (see Risk 1 below). That resolution is binding; this document's Risk 1 corroborates it independently from the code rather than superseding it.

---

## A — The three `type="date"` branches, in full

Confirmed by `grep -n 'type="date"' ManualBookingForm.tsx` → exactly three matches, at **1639, 1692, 1824** (plan text cites 1445/1498/1630 — stale by ~194 lines; the file grew 2,019 → 2,254 lines under C-02/C-03/C-06/C-07).

### Branch 1 — single/same-gender — `:1633-1683`

**Selecting condition** (line 1633):
```tsx
{canCheckAvailability && !overrideAvailability && !isMixedGenderGroup && (
```

**The date input and its complete `onChange` body** (lines 1635-1644):
```tsx
<AdminInput
  id="booking_date"
  label="Date"
  required
  type="date"
  value={bookingDate}
  error={stepErrors.booking_date}
  min={new Date().toISOString().split("T")[0]}
  onChange={(e) => { const d = e.target.value; setBookingDate(d); setStartTime(""); if (d) checkAvailability(d); }}
/>
```

**Immediately below (must remain untouched), lines 1645-1682:**
- Loading row (1645-1649): `availLoading` spinner, "Checking availability…"
- No-therapists notice (1650-1661): shown when `availChecked && !availLoading && availSlots.length === 0`; text *"No therapists available on this date. Pick another date, or override."*, plus `availReason` sub-text and an "Override this date" button that calls `setShowOverrideConfirm(true)`.
- Slot buttons (1662-1681): shown when `availChecked && !availLoading && availSlots.length > 0`; each button calls `setStartTime(slot.time)` and renders `{slotLabel(slot)}` beneath the time.

### Branch 2 — mixed-gender — `:1685-1792`

**Selecting condition** (line 1686):
```tsx
{canCheckAvailability && !overrideAvailability && !femaleOverride && !maleOverride && isMixedGenderGroup && (
```

**The date input and its complete `onChange` body** (lines 1688-1697) — **byte-identical handler body to Branch 1**:
```tsx
<AdminInput
  id="booking_date"
  label="Date"
  required
  type="date"
  value={bookingDate}
  error={stepErrors.booking_date}
  min={new Date().toISOString().split("T")[0]}
  onChange={(e) => { const d = e.target.value; setBookingDate(d); setStartTime(""); if (d) checkAvailability(d); }}
/>
```

**Immediately below (must remain untouched), lines 1698-1791:**
- Shared-time note (1698-1702): *"Both groups will share the same appointment time. Support for different times per group is coming soon."*, shown whenever `bookingDate` is set.
- Female participants panel (1704-1746): heading with count; loading row (`femaleAvailLoading`); no-therapists notice (*"No female therapists available on this date…"*) with an "Override for female participants" button (`setShowFemaleOverrideConfirm(true)`); slot buttons rendering `{slot.availableStaffByGender.female} available` (**not** via `slotLabel` — see Risk 3); the female override confirm sub-panel (1736-1745) whose Override button runs `setFemaleOverride(true); setShowFemaleOverrideConfirm(false);`.
- Male participants panel (1748-1790): structurally identical mirror of the female panel — `maleAvailLoading`, *"No male therapists available…"*, `setShowMaleOverrideConfirm(true)`, slot buttons showing `{slot.availableStaffByGender.male} available`, confirm sub-panel (1780-1789) setting `maleOverride(true)`.

### Branch 3 — fallback/override — `:1794-1828`

**Selecting condition** (line 1795) — note this is **not** literally `!canCheckAvailability`, it is:
```tsx
{(overrideAvailability || (isMixedGenderGroup && (femaleOverride || maleOverride))) && (
```
(When `!canCheckAvailability && !overrideAvailability`, a *different*, date-input-free block renders instead — see Risk 2 below.)

**The date input and its complete `onChange` body** (line 1824) — **materially different from Branches 1 & 2**:
```tsx
<AdminInput id="booking_date" label="Date" required type="date" value={bookingDate} error={stepErrors.booking_date} min={new Date().toISOString().split("T")[0]} onChange={(e) => setBookingDate(e.target.value)} />
```
No `setStartTime("")`, no `checkAvailability` call — see Risk 2.

**Immediately around it (must remain untouched):**
- Warning banner (1797-1804): *"No availability checked. This booking will be unassigned until a therapist accepts it."*
- "Check available slots instead" reset button (1805-1821): resets `overrideAvailability`, `femaleOverride`, `maleOverride`, `bookingDate`, `startTime`, `availChecked`, `availSlots`, `femaleAvailChecked`, `maleAvailChecked`.
- Paired manual `start_time` input, same `grid-cols-2` row (line 1825): `<AdminInput id="start_time" label="Start time" required type="time" value={startTime} error={stepErrors.start_time} onChange={(e) => setStartTime(e.target.value)} />`.

**Also present, not a `type="date"` branch but adjacent and load-bearing** — lines 1623-1630, rendered when `!canCheckAvailability && !overrideAvailability`: an informational panel only (*"Fill in the city, participant genders, and services above to see available times."*), with **no date input at all**. This is the state a staff member is actually in before either filling prerequisites or clicking "Override availability" (button at 1613-1620, opens the confirm dialog at 1830-1841, whose Override button sets `overrideAvailability(true)` and routes into Branch 3).

---

## B — Non-removal checklist (brief §2, verbatim, with current location)

Verbatim from the brief: *"shared `bookingDate`/`startTime` state · hidden `booking_date` + `override_availability` inputs · all three date-input branches · override toggle + both cohort skips · `canCheckAvailability` semantics · per-day `/api/availability` fetching and slot buttons with `slotLabel` staff counts · `min=today` · `setStartTime("")` on date change · step-3 gate (`bookingDate && startTime`) · draft persistence."*

| # | Item | Located? | file:line |
|---|---|---|---|
| 1 | Shared `bookingDate` state | ✅ | `ManualBookingForm.tsx:593` — `const [bookingDate, setBookingDate] = useState("");` |
| 2 | Shared `startTime` state | ✅ | `ManualBookingForm.tsx:594` — `const [startTime, setStartTime] = useState("");` |
| 3 | Hidden `booking_date` input | ✅ | `ManualBookingForm.tsx:1075` — `<input type="hidden" name="booking_date" value={bookingDate} />` |
| 4 | Hidden `override_availability` input | ✅ | `ManualBookingForm.tsx:1077-1079` — `{(overrideAvailability \|\| femaleOverride \|\| maleOverride) && (<input type="hidden" name="override_availability" value="on" />)}` |
| 5 | All three date-input branches | ✅ | `:1639` (single/same-gender), `:1692` (mixed-gender), `:1824` (fallback/override) — see §A |
| 6 | Override toggle | ✅ | state `:595`; trigger button `:1613-1620` (opens confirm); confirm dialog `:1830-1841` sets `overrideAvailability(true)` |
| 7 | Both cohort skips (female + male) | ✅ | state `:665-666`; female skip button `:1717` → confirm `:1736-1745` (sets `femaleOverride(true)` at `:1741`); male skip button `:1761` → confirm `:1780-1789` (sets `maleOverride(true)` at `:1785`) |
| 8 | `canCheckAvailability` semantics | ✅ | `:742-746` |
| 9 | Per-day `/api/availability` fetching + slot buttons with `slotLabel` staff counts | ✅ (with a nuance) | `checkAvailability` useCallback `:748-765` (POST to `/api/availability` at `:754`); `slotLabel` fn `:989-995`. **Nuance:** `slotLabel()` is used only by Branch 1's slot buttons (`:1676`). Branch 2's slot buttons show gender counts directly — `{slot.availableStaffByGender.female} available` (`:1731`) / `{slot.availableStaffByGender.male} available` (`:1775`) — not through `slotLabel`. Both are real, both must survive; the audit shouldn't grep only for `slotLabel` and miss the mixed-gender variant. |
| 10 | `min=today` | ✅ | all three branches: `:1642`, `:1695`, `:1824` — `min={new Date().toISOString().split("T")[0]}` |
| 11 | `setStartTime("")` on date change | ✅ (with a nuance) | present in Branch 1 onChange (`:1643`) and Branch 2 onChange (`:1696`), and inside `checkAvailability` itself (`:767`). **Not** present in Branch 3's onChange (`:1824`) — intentional, since Branch 3 pairs the date input with an independent manual `start_time` field. See Risk 2. |
| 12 | Step-3 gate (`bookingDate && startTime`) | ✅ | `isStepReady` for step 3, `:1009-1012` (`bookingDate && startTime`); mirrored in `validateStep`'s step-3 branch, `:232-233` (`errs.booking_date`, `errs.start_time`) |
| 13 | Draft persistence | ✅ | `draftKey` `:707-711`; restore effect `:810-832`; save effect `:834-841`. **Note:** `bookingDate`/`startTime`/`overrideAvailability` are deliberately **excluded** from the persisted draft (only `step, bookingSource, fullName, email, phone, bookingForMode, participants, address, postcode, city, area, customerNotes, healthNotes` are saved/restored — see `:836-841`). This is favourable for C-23: the calendar rewiring in Phases C/D never has to touch draft save/restore logic at all. |

The brief lists these as ten dot-separated clauses; I split "override toggle + both cohort skips" and "per-day fetching + slot buttons" into their natural sub-items above for a mechanical walk, giving 13 rows — no item was collapsed or dropped. **Every item located. None missing.**

---

## C — Phase B surface

**`calculateAvailableDays` current signature** (`src/lib/booking/availability.ts:867-871`):
```ts
export async function calculateAvailableDays(
  input: CalculateAvailableDaysInput,
  supabase: SupabaseClient,
  options: { now?: Date } = {}
): Promise<AvailableDaysResult> {
```

**Guarded site 1 — `booking_status_enabled` early return** (`:883-889`):
```ts
  const now = options.now ?? new Date();
  const settings = await loadSettings(supabase);

  if (!settings) {
    return unavailable("Booking settings unavailable.");
  }

  if (!settings.booking_status_enabled) {
    return unavailable("Online booking is currently paused.");
  }
```

**Guarded site 2 — `datesInWindow` filter** (`:891-912`):
```ts
  const contextResult = await loadContextRest(supabase, settings, input);
  if ("reason" in contextResult) {
    return { ...unavailable(contextResult.reason), durationMins: contextResult.durationMins };
  }

  const datesInWindow = input.dates.filter(
    (date) =>
      DATE_PATTERN.test(date) &&
      isDateInBusinessWindow({
        date,
        now,
        bookingWindowDays: settings.booking_window_days,
      })
  );

  if (datesInWindow.length === 0) {
    return {
      days: input.dates.map((date) => ({ date, hasSlots: false, slotCount: 0 })),
      durationMins: contextResult.durationMins,
      requiredStaffByGender,
    };
  }
```
Both anchors match the plan's `:867` / `:887-889` / `:896-904` claims exactly — this file has not moved a line since `ea97932` (corroborates the progress file's own note at §0.3).

**Every existing caller of `calculateAvailableDays` / `calculateAvailableSlots` in `src/`** (grepped repo-wide; production code only, test mocks noted separately):

| Function | Caller | Passes options bag? |
|---|---|---|
| `calculateAvailableDays` | `src/app/api/availability/month/route.ts:65-68` — `calculateAvailableDays({ dates: datesOfMonth(month), serviceIds, participantGenders, city }, supabase)` | **No** — 2 args only, relies on the `{}` default |
| `calculateAvailableSlots` | `src/app/api/availability/route.ts:52` — `calculateAvailableSlots(parsed.data, supabase)` | **No** — 2 args only, relies on the `{}` default |
| both | `src/app/api/availability/route.test.ts` — both imported and `vi.mocked(...)`, not real calls | n/a (test mocks) |

**Today, each function has exactly one production caller, and neither passes an options bag.** This means Step 3's "defaults preserve today's behaviour exactly, every existing caller untouched by omission" claim is currently trivial (there is only one caller each, and it already relies on the default). It stops being trivial the moment Step 4 lands the second caller (the new admin route) — see Risk 5.

**`src/app/api/availability/month/route.ts`, quoted in full** (55 lines, matches plan's "55 lines" note):
```ts
import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { calculateAvailableDays } from "@/lib/booking/availability";
import {
  AVAILABILITY_RATE_LIMIT,
  RATE_LIMITED_AVAILABILITY_MESSAGE,
  checkRateLimit,
} from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const monthAvailabilityRequestSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  serviceIds: z.array(z.string().trim().min(1)).min(1).max(3),
  participantGenders: z.array(z.enum(["male", "female"])).min(1).max(10),
  city: z.string().trim().min(2),
});

function datesOfMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return Array.from({ length: dayCount }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${month}-${day}`;
  });
}

export async function POST(request: Request) {
  // C-22 Step 4a (D23): a month sweep costs ~30 day calculations on the
  // service-role client, so the same per-IP limiter guards it. Its own counter
  // scope, so calendar browsing never eats the day endpoint's budget.
  if (
    !(await checkRateLimit(request, "availability-month", AVAILABILITY_RATE_LIMIT))
  ) {
    return NextResponse.json(
      { ok: false, error: RATE_LIMITED_AVAILABILITY_MESSAGE },
      { status: 429 }
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const parsed = monthAvailabilityRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid availability request.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 }
    );
  }

  const { month, serviceIds, participantGenders, city } = parsed.data;
  const supabase = createSupabaseAdminClient();
  const result = await calculateAvailableDays(
    { dates: datesOfMonth(month), serviceIds, participantGenders, city },
    supabase
  );

  return NextResponse.json({ month, ...result });
}
```

**C-22's rate-limit guard (lines 28-39, `checkRateLimit(..., "availability-month", AVAILABILITY_RATE_LIMIT)`) is present in this public route and landed after `ea97932`** (commits `a63de0b` "C-22 Phase B — rate limiting", `ceb028d` "C-22 Phase A — honeypot"; confirmed via `git log --oneline --grep="feat(redesign): C-22"`). Per the plan/brief, Step 4's new `src/app/api/admin/availability/month/route.ts` is authenticated via `getStaffProfile()` and is **deliberately not gated by this same rate limiter** — confirmed no conflicting instruction exists; the new route needs its own auth check, not this one.

`getStaffProfile` — confirmed at `src/lib/auth/rbac.ts:340` (plan cites `:308`, stale):
```ts
export async function getStaffProfile(
  supabase: SupabaseClient
): Promise<StaffProfile | null> {
```

`src/app/api/admin/` does not exist yet (`ls` fails, "No such file or directory") — Step 4 creates the first route under it, confirmed.

---

## D — Phase C reference material

**`ScheduleStep.tsx` effect Step 6's hook is lifted from** (`src/features/booking/components/ScheduleStep.tsx:77-130` — the plan's shorthand ":94-104" is only the `fetch` call itself; the full effect, including cache lookup and abort wiring, spans 77-130):
```tsx
  useEffect(() => {
    const cached = monthCacheRef.current.get(monthCacheKey);
    if (cached) {
      setMonthDays(cached);
      return;
    }

    const controller = new AbortController();

    async function loadMonthAvailability() {
      try {
        await Promise.resolve();
        if (controller.signal.aborted) return;

        setMonthLoading(true);
        setMonthDays(null);

        const response = await fetch("/api/availability/month", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            month: monthKey,
            serviceIds,
            participantGenders,
            city,
          }),
          signal: controller.signal,
        });
        const data = (await response.json()) as MonthAvailabilityApiResponse;

        if (!response.ok || !data.days) {
          setMonthDays(null);
          return;
        }

        monthCacheRef.current.set(monthCacheKey, data.days);
        setMonthDays(data.days);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setMonthDays(null);
      } finally {
        if (!controller.signal.aborted) {
          setMonthLoading(false);
        }
      }
    }

    loadMonthAvailability();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCacheKey]);
```
Cache key construction (`:68-73`): `[monthKey, serviceIdsKey, participantGendersKey, city.trim().toLowerCase()].join("|")` — matches the brief's `month|services|genders|city` shape. Failure and abort both resolve to `setMonthDays(null)` (unmarked, silent) — matches brief §5.3.

**`CalendarDatePopover.tsx`'s react-day-picker usage** (`src/app/admin/calendar/CalendarDatePopover.tsx:238-251`) — the file Step 5 is told to match for admin idiom:
```tsx
          <DayPicker
            mode="range"
            selected={selection}
            defaultMonth={
              selection?.from ?? parseISODate(selectedDate)
            }
            weekStartsOn={1}
            onSelect={(range) => {
              setSelection(range);
              // Defer commit to the explicit Apply button (or popover close)
              // so the user can pick a second date for a range without us
              // committing the single-day intermediate state.
            }}
          />
```
Trigger button and dialog shell use `--admin-*` tokens and `h-11`/focus-ring conventions exactly as the plan describes (e.g. `:218` — `h-11 ... rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] ... focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55`). **This file uses no `disabled`, `modifiers`, or `modifiersClassNames` prop at all** — it is a plain, fully-selectable range picker (it filters an admin calendar *view*, it doesn't gate a booking submission). See Risk 4 — there is no admin-styled precedent for the marker/de-emphasis pattern Step 5 needs.

**react-day-picker version:** `^9.14.0` in `package.json` (`:43`), resolved to `react-day-picker@9.14.0` in `pnpm-lock.yaml`. The API surface actually exercised in this repo (evidenced across `CalendarDatePopover.tsx` and `DatePickerField.tsx`, both real usages, not documentation): `mode` (`"range"` / `"single"`), `selected`, `onSelect`, `month` / `defaultMonth`, `onMonthChange`, `weekStartsOn`, `className`, `disabled` (accepts a matcher array, e.g. `[{ before: someDate }, ...Date[]]`), `modifiers` (a `{ name: Date[] }` map), `modifiersClassNames` (a `{ name: className }` map keyed to the same modifier names). Step 5's constraint — `disabled` limited to `{ before: min }` only, everything else expressed as a `modifiers`/`modifiersClassNames` pair — is achievable with this exact API; there's no version gap to worry about.

**The only in-repo example combining `disabled` + `modifiers` + `modifiersClassNames`** is `src/features/booking/components/DatePickerField.tsx:59-70` (public side, explicitly out of bounds as a style source):
```tsx
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={onSelect}
        month={month}
        onMonthChange={onMonthChange}
        disabled={[{ before: today }, ...fullDates]}
        modifiers={{ hasTimes: availableDates }}
        modifiersClassNames={{ hasTimes: styles.dayHasTimes }}
        weekStartsOn={1}
        className={styles.dayPicker}
      />
```
This disables fully-booked days (`...fullDates` inside `disabled`) and styles via a public CSS module (`styles.dayHasTimes` from `BookingExperience.module.css`) — both are exactly what Step 5 forbids (never `disabled` beyond `{ before: min }`; never a public CSS module; never `--rahma-*`). See Risk 4.

---

## E — Risks

**Risk 1 — Pre-flight #3's literal "empty diff" check will not come back empty, and the reason is already diagnosed and Owner-resolved.**
Ran the read-only identity assertion myself:
```
git diff master redesign/start-state --stat -- src/lib/booking/availability.ts src/app/api/availability/
```
Result: **not empty** —
```
 src/app/api/availability/month/route.ts |  17 ---
 src/app/api/availability/route.test.ts  | 177 --
 src/app/api/availability/route.ts       |  15 ---
 3 files changed, 209 deletions(-)
```
Isolating `src/lib/booking/availability.ts` alone confirms it is still genuinely byte-identical (empty diff on that path specifically). The entire 209-line divergence is C-22's rate-limiting, added to master after the `ea97932` merge (`a63de0b`, `ceb028d`) and absent from the frozen `redesign/start-state`. All hunks are deletions in the master→start-state direction (master is strictly ahead; start-state contains nothing master lacks), so the property the gate exists to protect still holds. **`redesign/per-page-progress/C-23-admin-availability-calendar-progress.md` §0.1 already records the Owner hit exactly this on 2026-08-04 and amended gate §3.2/pre-flight #3 to "zero insertions in the master→start-state diff, and `availability.ts` specifically byte-identical"** rather than requiring the literal whole-diff to be empty. An implementer resuming this plan should follow that recorded decision and not re-litigate it as a fresh stop condition.

**Risk 2 — the fallback branch's `onChange` handler is not the same body as the other two, and Step 9's wording could be misread to assume it is.**
Branch 1 (`:1643`) and Branch 2 (`:1696`) both run `setBookingDate(d); setStartTime(""); if (d) checkAvailability(d);`. Branch 3/fallback (`:1824`) runs only `setBookingDate(e.target.value)` — no `setStartTime("")`, no `checkAvailability` call — because the override branch pairs the date input with its own independent manual `start_time` field (`:1825`) and never performs a network availability check while overriding. If Step 9's implementer renders `AvailabilityCalendarField` for the fallback branch (the `cohorts: []` option, rather than keeping the plain `AdminInput`) and copies the Branch-1/2 handler body out of habit, the calendar would start silently clearing `startTime` and firing `checkAvailability` on every override-mode date pick — a real behaviour change the current code deliberately avoids. Step 7's "identical handler body" instruction is correct and specific to Branches 1/2 only; it should not be generalised to Branch 3.

**Risk 3 — the two per-branch slot-count UIs don't share one code path.**
`slotLabel()` (`:989-995`) is used only by Branch 1's slot buttons (`:1676`). Branch 2's slot buttons bypass it and read `slot.availableStaffByGender.female` / `.male` directly (`:1731`, `:1775`). The non-removal audit (brief item 10, "slot buttons with slotLabel staff counts") should check both code paths, not just grep for `slotLabel(`.

**Risk 4 — no admin-styled react-day-picker precedent exists for the marker/de-emphasis pattern Step 5 needs.**
`CalendarDatePopover.tsx` (the file Step 5 must match stylistically) uses no `disabled`/`modifiers`/`modifiersClassNames` at all — it's a plain range picker. The only in-repo example of that trio together is `DatePickerField.tsx` on the public side, and it does the two things Step 5 explicitly forbids: disables fully-booked days via `disabled={[{before: today}, ...fullDates]}`, and styles via a public CSS module. `AvailabilityCalendarField.tsx` is therefore not "port an existing admin pattern" so much as "invent a new admin-token-styled modifiers pattern with no local precedent to copy" — worth budgeting more implementation time/scrutiny for than "matches `CalendarDatePopover.tsx`" implies.

**Risk 5 — today's "every existing caller untouched by omission" claim is trivial and will stop being trivial after Step 4.**
`calculateAvailableDays` and `calculateAvailableSlots` each have exactly one production caller today, and neither passes an options bag — so Step 3's regression claim currently has nothing non-trivial to prove. The moment Step 4's new admin route becomes the second caller of `calculateAvailableDays`, the public route's behaviour-under-defaults needs to be explicitly re-verified (not just assumed), and there is no dedicated test file for `src/app/api/availability/month/route.ts` today (`src/app/api/availability/month/route.test.ts` does not exist — only the per-day `src/app/api/availability/route.test.ts` does) to regression-test against. Step 4's own new test suite is the first coverage this route will have had.

**Risk 6 — the reset button sitting directly above the fallback date input touches `bookingDate`.**
`:1805-1821` ("Check available slots instead") resets `overrideAvailability`, `femaleOverride`, `maleOverride`, `bookingDate`, `startTime`, `availChecked`, `availSlots`, `femaleAvailChecked`, `maleAvailChecked` in one click. If Step 9 renders a calendar (rather than the plain input) for the fallback branch, this reset needs to still correctly blank the calendar's selected day — should be automatic since `value`/`bookingDate` stays the single source of truth, but it's adjacent, load-bearing behaviour worth a manual check once Step 9 is implemented.

**Risk 7 — C-14 serialization is currently satisfied but is a live condition, not a fact fixed at this snapshot.**
`git log --oneline --grep="feat(redesign): C-14"` returns nothing, and `src/lib/booking/working-hours-segments.ts` does not exist — so the plan's required "C-23 Phase B before C-14" ordering is currently true. This must be re-checked at the exact moment Phase B resumes (not assumed from this document), since other Band-C work continues in parallel.

**Nothing else found.** Working tree is clean over all three target path roots (`git status --porcelain -- src/lib/booking src/app/api src/app/admin/bookings/new` returns empty), matching pre-flight #1's requirement.

---

*End of implementation-surface map. Produced read-only; no source files modified. Companion: `redesign/per-page-progress/C-23-admin-availability-calendar-progress.md` (live position/hold state — read that for current programme status, this document for verified code anchors).*
