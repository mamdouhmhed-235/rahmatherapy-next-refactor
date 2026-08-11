# Item 8 Phase 2 — P3: prop-threading chain (server → AboutYouStep)

Read-only derivation. Repo HEAD at time of read: `46f9369`. All line numbers below
are from files as they exist on disk right now — verified by direct read, not
assumed from the plan.

## 1. `src/lib/booking/booking-window-settings.ts` — full file (62 lines + trailing newline)

```ts
// SERVER ONLY — the two business_settings values the public booking dialog's
// date picker needs in order to draw the booking window (C-14 Phase D, Step 4).
//
// The dialog has no server entry of its own: it mounts client-only through
// BookingExperienceLoader (ssr:false) from src/app/(public)/layout.tsx, so the
// layout is where the settings enter the client tree.
//
// Failure-tolerant by design. Any error — missing row, missing service-role
// env at build time, network — returns null, and the picker keeps exactly the
// behaviour it had before this existed (past days and fully-booked days
// disabled, no window bound). This must never throw into a page render.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is two numbers.
// No Set / Map / Date crosses the cache boundary. Deliberately so — the bounds
// themselves are derived from these numbers on the VISITOR's clock inside
// ScheduleStep, so a cached (or prerendered) page can never bake in a stale
// "today".
//
// unstable_cache forbids cookies(), so the read runs on the admin client — the
// same trade-off, for the same reason, as src/app/admin/settings/settings-data.ts.
// It exposes nothing an anonymous visitor cannot already infer from
// /api/availability, which is itself a public service-role read.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";

export interface PublicBookingWindow {
  bookingWindowDays: number;
  minimumNoticeHours: number;
}

export async function getPublicBookingWindow(): Promise<PublicBookingWindow | null> {
  const cached = unstable_cache(
    async (): Promise<PublicBookingWindow | null> => {
      try {
        const admin = createSupabaseAdminClient();
        const { data } = await admin
          .from("business_settings")
          .select("booking_window_days, minimum_notice_hours")
          .eq("id", 1)
          .single<{
            booking_window_days: number;
            minimum_notice_hours: number;
          }>();

        if (!data) return null;

        return {
          bookingWindowDays: data.booking_window_days,
          minimumNoticeHours: data.minimum_notice_hours,
        };
      } catch {
        return null;
      }
    },
    ["public-booking-window"],
    { revalidate: 60, tags: [TAGS.SETTINGS] }
  );

  return cached();
}
```

**Pattern shape**: module-scope `export async function getX(): Promise<Shape | null>`
→ inside it, one `unstable_cache(fn, [cacheKey], { revalidate: 60, tags: [TAGS.SETTINGS] })`
→ `fn` is an `async () => Shape | null` that opens `createSupabaseAdminClient()`,
does one `.from("business_settings").select(...).eq("id", 1).single<Shape>()`,
returns `null` on `!data`, wraps the whole body in `try {} catch { return null; }`.
Cache key is a one-element string array unique to the export. Tag is always
`TAGS.SETTINGS` (confirmed present: `src/lib/cache/tag-taxonomy.ts:20` —
`SETTINGS: "settings",`).

### Extend vs. second function — recommendation

**Recommendation: add a second function, not an extension of `getPublicBookingWindow`.**

Reasoning:

- **The file's entire header comment is a contract about the *existing* two
  numbers** — "the returned shape is two numbers," "No Set / Map / Date
  crosses the cache boundary," tied specifically to the ScheduleStep
  stale-"today" hazard. `free_travel_cities` has nothing to do with the date
  window; folding it into `PublicBookingWindow` makes that interface name and
  its whole header comment inaccurate, forcing a rewrite of carefully-audited
  prose (SHARED-NOTES §15 reference and all) for an unrelated concern.
- **Different consumer.** The window numbers feed `ScheduleStep` (via
  `BookingExperience.tsx:704-705`, see §4). The town list feeds `AboutYouStep`
  (a sibling step, not downstream of ScheduleStep). They happen to live in the
  same `business_settings` row but are two independent product concepts.
- **No cache-correctness cost to splitting.** Both functions would tag on
  `TAGS.SETTINGS`, so a settings save invalidates both together regardless of
  whether it's one query or two — there is no staleness-mismatch risk from
  separating them.
- **Extra DB cost is negligible.** This is a single indexed point read
  (`eq("id", 1).single()`) on the service-role client, itself cached for 60s.
  The marginal cost of a second such read is not worth coupling two unrelated
  concerns for.

Secondary question — same file or a new file? I'd put it in a **new sibling
file** (e.g. `src/lib/booking/free-travel-cities.ts`) rather than as a second
export appended to `booking-window-settings.ts`, for the same reason: that
file's docblock is written entirely in the voice of "the date picker's
window," and a second, unrelated exported function sitting under that header
would be confusing to a future reader even though it compiles fine. This is a
style preference, not a correctness requirement — a second function in the
same file is a perfectly workable fallback if the team prefers fewer files.

Exact insertion text for **both** paths, so either can be taken without
re-deriving it:

**Path A — extend (one query, one cache entry).** Diff against the file above:

```ts
export interface PublicBookingWindow {
  bookingWindowDays: number;
  minimumNoticeHours: number;
  freeTravelCities: string[] | null;
}
```
```ts
        const { data } = await admin
          .from("business_settings")
          .select("booking_window_days, minimum_notice_hours, free_travel_cities")
          .eq("id", 1)
          .single<{
            booking_window_days: number;
            minimum_notice_hours: number;
            free_travel_cities: unknown;
          }>();

        if (!data) return null;

        return {
          bookingWindowDays: data.booking_window_days,
          minimumNoticeHours: data.minimum_notice_hours,
          freeTravelCities: Array.isArray(data.free_travel_cities)
            ? data.free_travel_cities.filter(
                (city): city is string => typeof city === "string"
              )
            : null,
        };
```

**Path B — second function (recommended), new file
`src/lib/booking/free-travel-cities.ts`:**

```ts
// SERVER ONLY — business_settings.free_travel_cities, the town list the
// public booking dialog's About You step needs for its covered-town chips
// and outside-coverage notice (item 8 Phase 2).
//
// The dialog has no server entry of its own: it mounts client-only through
// BookingExperienceLoader (ssr:false) from src/app/(public)/layout.tsx, so the
// layout is where the settings enter the client tree — same path as
// src/lib/booking/booking-window-settings.ts, which this mirrors. Kept as a
// separate function/file rather than folded into that one so its two-number
// cache contract and header comments stay unchanged.
//
// Failure-tolerant by design. Any error — missing row, missing service-role
// env at build time, network — returns null, and AboutYouStep falls back to
// its build-time BOOKING_ALLOWED_CITIES list.
//
// unstable_cache forbids cookies(), so the read runs on the admin client —
// same trade-off as booking-window-settings.ts.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";

export async function getPublicFreeTravelCities(): Promise<string[] | null> {
  const cached = unstable_cache(
    async (): Promise<string[] | null> => {
      try {
        const admin = createSupabaseAdminClient();
        const { data } = await admin
          .from("business_settings")
          .select("free_travel_cities")
          .eq("id", 1)
          .single<{ free_travel_cities: unknown }>();

        if (!data) return null;

        return Array.isArray(data.free_travel_cities)
          ? data.free_travel_cities.filter(
              (city): city is string => typeof city === "string"
            )
          : null;
      } catch {
        return null;
      }
    },
    ["public-free-travel-cities"],
    { revalidate: 60, tags: [TAGS.SETTINGS] }
  );

  return cached();
}
```

The `Array.isArray(...).filter(city => typeof city === "string")` normalization
mirrors the existing `getAllowedCities()` helper already used for this exact
column in `src/lib/booking/availability.ts:243-249`:

```ts
function getAllowedCities(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((city): city is string => typeof city === "string")
        .map((city) => city.trim().toLowerCase())
    : [];
}
```

(That helper also lower-cases; I left casing untouched in the new fetch since
it feeds UI chip labels, and `AboutYouStep.tsx:56-58` already
title-cases its own fallback list — see §6/bonus below.)

---

## 2. `src/app/(public)/layout.tsx` — full file (56 lines)

```tsx
import { BookingExperienceLoader } from "@/features/booking/BookingExperienceLoader";
import { getPublicBookingWindow } from "@/lib/booking/booking-window-settings";
import { PublicScrollbar } from "@/components/layout/PublicScrollbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { MAINTENANCE_MODE } from "@/lib/maintenance";
import { MaintenanceBanner } from "@/components/shared/MaintenanceBanner";
import { MaintenanceModal } from "@/components/shared/MaintenanceModal";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { ConsentScripts } from "@/components/consent/ConsentScripts";
import { CookieBanner } from "@/components/consent/CookieBanner";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // C-14 Phase D — the booking dialog mounts client-only, so its date picker's
  // window settings enter the tree here. Cached + null-tolerant; see
  // src/lib/booking/booking-window-settings.ts.
  const bookingWindow = MAINTENANCE_MODE ? null : await getPublicBookingWindow();

  return (
    <>
      {/* First, unconditionally — including under MAINTENANCE_MODE below, where
          the consent default still has to be established before anything else. */}
      <ConsentScripts />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1000] focus:rounded-full focus:bg-rahma-green focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white focus:shadow-card focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-rahma-gold"
      >
        Skip to main content
      </a>
      {MAINTENANCE_MODE && <MaintenanceBanner />}
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="public-main">
        {children}
      </main>
      <SiteFooter />
      {!MAINTENANCE_MODE && (
        <BookingExperienceLoader
          bookingWindowDays={bookingWindow?.bookingWindowDays}
          minimumNoticeHours={bookingWindow?.minimumNoticeHours}
        />
      )}
      {MAINTENANCE_MODE && <MaintenanceModal />}
      <PublicScrollbar />
      {/* Last in the tree, and unconditional like ConsentScripts above: the
          consent question is asked in maintenance mode too, and being late in
          the DOM keeps it late in the tab order rather than ahead of the page's
          own content. */}
      <CookieBanner />
      <GoogleAnalytics />
    </>
  );
}
```

**Plan-claim verification:**
- `getPublicBookingWindow` call claimed at `:21` — **CONFIRMED**, line 21 is
  exactly `const bookingWindow = MAINTENANCE_MODE ? null : await getPublicBookingWindow();`.
- `BookingExperienceLoader` props claimed at `:42-43` — **CONFIRMED**. Line 41
  is the opening tag `<BookingExperienceLoader`, line 42
  `bookingWindowDays={bookingWindow?.bookingWindowDays}`, line 43
  `minimumNoticeHours={bookingWindow?.minimumNoticeHours}`, line 44 is the
  closing `/>`.
- **MAINTENANCE_MODE branch**: line 40, `{!MAINTENANCE_MODE && (`, wraps the
  entire `<BookingExperienceLoader ... />` block (lines 40-45). The plan's
  claim that the loader "does not mount at all" under maintenance is
  **CONFIRMED** — it's not merely passed different props, the whole
  `<BookingExperienceLoader>` JSX is absent from the tree when
  `MAINTENANCE_MODE` is true. Separately, line 21 short-circuits the DB read
  itself to `null` under maintenance (`MAINTENANCE_MODE ? null : await ...`),
  so the settings query never even runs in that mode — belt-and-braces, not
  redundant, since the loader-omission is what actually keeps it out of the
  tree.

**Exact insertion text** (using Path B, `getPublicFreeTravelCities` from a new
file `@/lib/booking/free-travel-cities`):

Import, added as a new line after line 2:
```tsx
import { getPublicFreeTravelCities } from "@/lib/booking/free-travel-cities";
```

Fetch, added as a new line after line 21 (`const bookingWindow = ...`):
```tsx
  const freeTravelCities = MAINTENANCE_MODE ? null : await getPublicFreeTravelCities();
```

Prop, added inside the existing `<BookingExperienceLoader ... />` (after line 43):
```tsx
          freeTravelCities={freeTravelCities ?? undefined}
```
(`?? undefined` because `getPublicFreeTravelCities` returns `string[] | null`
directly — unlike `bookingWindow?.x`, there's no intermediate optional object
to fall through, so the null→undefined conversion has to be explicit to match
the existing "absent means `undefined`, never `null`" convention on
`BookingExperienceProps`.)

If Path A is taken instead (extending `getPublicBookingWindow`), the only
change here is one line: `freeTravelCities={bookingWindow?.freeTravelCities ?? undefined}`,
no new import, no new fetch line.

---

## 3. `src/features/booking/BookingExperienceLoader.tsx` — full file (95 lines)

```tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { BookingExperienceProps } from "./BookingExperience";

const BookingExperience = dynamic(
  () =>
    import("./BookingExperience").then((mod) => ({
      default: mod.BookingExperience,
    })),
  { ssr: false }
);

function preloadBookingExperience() {
  void import("./BookingExperience");
}

function hasBookingParam() {
  return new URL(window.location.href).searchParams.get("booking") === "1";
}

export function BookingExperienceLoader({
  bookingWindowDays,
  minimumNoticeHours,
}: BookingExperienceProps = {}) {
  const [shouldLoad, setShouldLoad] = useState(false);

  // Deep-link check happens in an effect (not a state initializer) so the
  // server and client render identical empty markup — no hydration mismatch
  // when the page loads with ?booking=1.
  useEffect(() => {
    if (hasBookingParam()) {
      setShouldLoad(true);
    }
  }, []);

  useEffect(() => {
    if (shouldLoad) {
      return undefined;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const trigger = target.closest<HTMLElement>("[data-booking-trigger='true']");
      if (!trigger) return;

      event.preventDefault();

      if (trigger instanceof HTMLAnchorElement) {
        const url = new URL(trigger.href, window.location.href);
        window.history.replaceState(null, "", url);
      }

      setShouldLoad(true);
    };

    // Warm the booking chunk the moment a visitor shows intent (hover,
    // keyboard focus, or first touch on any Book button) so opening feels
    // instant even on slow connections.
    const handleIntent = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-booking-trigger='true']")) return;

      preloadBookingExperience();
      removeIntentListeners();
    };

    const removeIntentListeners = () => {
      document.removeEventListener("pointerover", handleIntent);
      document.removeEventListener("focusin", handleIntent);
      document.removeEventListener("touchstart", handleIntent);
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("pointerover", handleIntent, { passive: true });
    document.addEventListener("focusin", handleIntent);
    document.addEventListener("touchstart", handleIntent, { passive: true });

    return () => {
      document.removeEventListener("click", handleClick);
      removeIntentListeners();
    };
  }, [shouldLoad]);

  return shouldLoad ? (
    <BookingExperience
      bookingWindowDays={bookingWindowDays}
      minimumNoticeHours={minimumNoticeHours}
    />
  ) : null;
}
```

**Plan-claim verification:**
- Destructure claimed at `:23-26` — **CONFIRMED EXACTLY**:
  ```
  23	export function BookingExperienceLoader({
  24	  bookingWindowDays,
  25	  minimumNoticeHours,
  26	}: BookingExperienceProps = {}) {
  ```
- Pass-through claimed at `:89-93` — **CONFIRMED EXACTLY**:
  ```
  89	  return shouldLoad ? (
  90	    <BookingExperience
  91	      bookingWindowDays={bookingWindowDays}
  92	      minimumNoticeHours={minimumNoticeHours}
  93	    />
  94	  ) : null;
  95	  }
  ```
  (line 94 is `) : null;`, line 95 is the closing `}` of the function — not
  part of the claimed 89-93 range, noted only for completeness.)
- Lint baseline `react-hooks/set-state-in-effect` at `:34` — **CONFIRMED**.
  Line 34 is `setShouldLoad(true);`, the sole statement inside the
  zero-dependency mount effect at lines 32-36:
  ```
  32	  useEffect(() => {
  33	    if (hasBookingParam()) {
  34	      setShouldLoad(true);
  35	    }
  36	  }, []);
  ```

**Exact insertion text.** Destructure — insert a new line after line 25
(`minimumNoticeHours,`), before line 26 (`}: BookingExperienceProps = {}) {`):

```tsx
  freeTravelCities,
```

Pass-through — insert a new line after line 92
(`minimumNoticeHours={minimumNoticeHours}`), before line 93 (`/>`):

```tsx
      freeTravelCities={freeTravelCities}
```

**Line-shift warning (per the brief).** The destructure insertion adds one
line above the existing `react-hooks/set-state-in-effect` baseline at L34.
After this one-line insertion, that finding's location becomes **L35**, not
L34. This is a location drift caused by the new code, not a regression to
"fix" — nothing about the effect itself changes. Whatever gate/baseline
tracking is keyed on `{file, ruleId}` per the repo's lint-baseline convention
(see project memory: "lint identity is keyed on {file, ruleId}, not line") is
unaffected by the shift; anything keyed on line number will need updating.

---

## 4. `src/features/booking/BookingExperience.tsx`

Full file confirmed read (738 lines). Quoting only the requested slices
byte-exact; full file was read in this session and matches what's shown below
at each cited range.

### `BookingExperienceProps` — claimed `:81-82`

```
74	export interface BookingExperienceProps {
75	  /**
76	   * business_settings.booking_window_days + minimum_notice_hours, read once by
77	   * the public layout and threaded down to the date picker (C-14 Phase D).
78	   * Both absent when that read failed — the picker then falls back to its
79	   * availability-only bounds.
80	   */
81	  bookingWindowDays?: number;
82	  minimumNoticeHours?: number;
83	}
```

**CONFIRMED EXACTLY** — lines 81-82 are precisely the two prop declarations.

### Destructure — claimed `:86-88`

```
85	export function BookingExperience({
86	  bookingWindowDays,
87	  minimumNoticeHours,
88	}: BookingExperienceProps = {}) {
```

**CONFIRMED EXACTLY** — lines 86-88 are the two destructured names plus the
closing type annotation.

### The "contradiction" — resolved

The plan claims (a) `bookingWindowDays`/`minimumNoticeHours` are passed at
`:704-705`, **and** (b) those props do not reach `AboutYouStep`. Both are
literally true simultaneously, because they refer to **two different render
sites** in this file — there is no contradiction, only ambiguous plan wording.

**AboutYouStep render site — lines 677-681:**

```
675	        {currentStep === "about" && (
676	          <MotionStep key="about" direction={navDirection}>
677	            <AboutYouStep
678	              form={form}
679	              prefilled={prefilled}
680	              onClearPrefill={clearPrefill}
681	            />
682	          </MotionStep>
683	        )}
```

`AboutYouStep` currently receives exactly three props: `form`, `prefilled`,
`onClearPrefill`. **Neither `bookingWindowDays`, `minimumNoticeHours`, nor any
town-list prop reaches it today.**

**ScheduleStep render site — lines 685-708, props at `:704-705`:**

```
685	        {currentStep === "time" && (
686	          <MotionStep key="time" direction={navDirection}>
687	            <ScheduleStep
688	              preferredDate={selectedDate}
689	              preferredTime={preferredTime}
690	              scheduleError={scheduleError}
691	              onDateChange={(date) => {
692	                setPreferredDate(date ? format(date, "yyyy-MM-dd") : null);
693	                setPreferredTime(null);
694	                clearStepErrors();
695	              }}
696	              serviceIds={selectedPackageIds}
697	              participantGenders={availabilityParticipantGenders}
698	              city={detailsPreview.city}
699	              onTimeClear={clearPreferredTime}
700	              onTimeChange={(time: BookingTimeSlot) => {
701	                setPreferredTime(time);
702	                clearStepErrors();
703	              }}
704	              bookingWindowDays={bookingWindowDays}
705	              minimumNoticeHours={minimumNoticeHours}
706	            />
707	          </MotionStep>
708	        )}
709	
710	        {currentStep === "confirm" && (
```

Line 708 is the closing `)}` for the `time` block; line 709 is blank; line 710
begins the `confirm` block.

So: **:704-705 is real and confirmed**, but it feeds `ScheduleStep`, not
`AboutYouStep`. The plan's second claim — "those props do NOT reach
AboutYouStep" — is also correct, read as "the window/notice props stop at
ScheduleStep." No prop of any kind related to service-area/free-travel towns
currently reaches `AboutYouStep` from `BookingExperience.tsx` in either
render site.

### Lint-baseline lines — verification only, do not touch

- **L201** — inside the `open`/`currentStep` scroll-reset effect (lines
  195-202):
  ```
  195	  useEffect(() => {
  196	    if (open) {
  197	      window.setTimeout(() => {
  198	        contentGridRef.current?.scrollTo({ top: 0 });
  199	      }, 0);
  200	    }
  201	    setSummarySheetOpen(false);
  202	  }, [open, currentStep]);
  ```
  Line 201 is exactly `    setSummarySheetOpen(false);`. **CONFIRMED.**

- **L253** — inside the "re-validate attempted step as it's edited" effect
  (lines 245-275), nested in a `window.setTimeout` inside the effect body:
  ```
  250	    const timer = window.setTimeout(() => {
  251	      if (attemptedStep === "about") {
  252	        const result = bookingDetailsSchema.safeParse(form.getValues());
  253	        applyFormIssues(result.success ? [] : result.error.issues);
  ```
  Line 253 is exactly `        applyFormIssues(result.success ? [] : result.error.issues);`.
  **CONFIRMED.**

- **L340** — inside the returning-customer prefill effect (lines 317-341),
  direct call, not nested in a timeout:
  ```
  338	
  339	    form.reset({ ...emptyBookingDetails, ...stored });
  340	    setPrefilled(true);
  341	  }, [open, form]);
  ```
  Line 340 is exactly `    setPrefilled(true);`. **CONFIRMED.**

**Exact insertion text.**

Interface — insert after line 82 (`minimumNoticeHours?: number;`), before line
83 (`}`):

```tsx
  /**
   * business_settings.free_travel_cities, read once by the public layout and
   * threaded down to AboutYouStep's covered-town chips and coverage notice
   * (item 8 Phase 2). Absent when that read failed — AboutYouStep then falls
   * back to its build-time BOOKING_ALLOWED_CITIES list.
   */
  freeTravelCities?: string[];
```

Destructure — insert after line 87 (`minimumNoticeHours,`), before line 88
(`}: BookingExperienceProps = {}) {`):

```tsx
  freeTravelCities,
```

AboutYouStep render site — insert after line 680
(`onClearPrefill={clearPrefill}`), before line 681 (`/>`):

```tsx
              freeTravelCities={freeTravelCities}
```

**Line-shift warning.** The interface edit (7 lines: 6-line JSDoc block + 1
prop line, as drafted above) and the destructure edit (1 line) both land
*above* lines 201, 253 and 340 — that's 8 lines added before all three
lint-baseline locations, in this file only (the `AboutYouStep` render-site
edit at old-line 680 is also above them, but it doesn't exist in the original
numbering used here — order in the file is: interface (~74) → destructure
(~85) → AboutYouStep render (~677) → lint-baseline lines 201/253/340 are all
*above* the AboutYouStep render site, so that edit doesn't affect their shift;
only the interface + destructure edits, both earlier in the file, do). Net:
if inserted exactly as drafted, **L201 → L209, L253 → L261, L340 → L348**.
This is arithmetic on my exact draft text, not a promise — a differently
worded JSDoc comment changes the offset. As with file 3, do not "fix" these
findings; they are pre-existing and simply move.

---

## 5. Summary — exact insertion text, all files, one place

| # | File | Anchor (current line) | Insert |
|---|---|---|---|
| 1 | `booking-window-settings.ts` | n/a (no edit if Path B taken) | new file `free-travel-cities.ts`, full text in §1 |
| 2 | `(public)/layout.tsx` | after line 2 | `import { getPublicFreeTravelCities } from "@/lib/booking/free-travel-cities";` |
| 2 | `(public)/layout.tsx` | after line 21 | `const freeTravelCities = MAINTENANCE_MODE ? null : await getPublicFreeTravelCities();` |
| 2 | `(public)/layout.tsx` | after line 43 | `freeTravelCities={freeTravelCities ?? undefined}` |
| 3 | `BookingExperienceLoader.tsx` | after line 25 | `freeTravelCities,` |
| 3 | `BookingExperienceLoader.tsx` | after line 92 | `freeTravelCities={freeTravelCities}` |
| 4 | `BookingExperience.tsx` | after line 82 | JSDoc + `freeTravelCities?: string[];` |
| 4 | `BookingExperience.tsx` | after line 87 | `freeTravelCities,` |
| 4 | `BookingExperience.tsx` | after line 680 | `freeTravelCities={freeTravelCities}` |

**Not one of the requested four, but required to close the chain** (read in
full for necessary context — `src/features/booking/components/AboutYouStep.tsx`,
634 lines):

- Props interface, lines 26-30:
  ```tsx
  interface AboutYouStepProps {
    form: UseFormReturn<BookingDetailsFormValues>;
    prefilled?: boolean;
    onClearPrefill?: () => void;
  }
  ```
  insert after line 29 (`onClearPrefill?: () => void;`): `freeTravelCities?: string[];`

- Destructure, lines 91-95:
  ```tsx
  export function AboutYouStep({
    form,
    prefilled = false,
    onClearPrefill,
  }: AboutYouStepProps) {
  ```
  insert after line 94 (`onClearPrefill,`): `freeTravelCities,`

**IMPORTANT SCOPE CAVEAT**: receiving the prop is not the same as using it.
`AboutYouStep.tsx` currently derives its covered-town chips and
covered/outside-coverage state entirely from a **module-scope constant**
built from a **static import**, independent of any prop:

```
17	import {
18	  BOOKING_ALLOWED_CITIES,
19	  type BookingDetailsFormValues,
20	} from "../schemas/booking-schema";
...
56	const COVERED_TOWNS = BOOKING_ALLOWED_CITIES.map((city) =>
57	  city.replace(/\b\w/g, (letter) => letter.toUpperCase())
58	);
...
125	  const isCovered =
126	    hasCityValue &&
127	    BOOKING_ALLOWED_CITIES.some(
128	      (allowed) =>
129	        normalizedCity === allowed || normalizedCity.includes(allowed)
130	    );
131	  const isOutsideCoverage = hasCityValue && !isCovered;
```

and the outside-coverage notice at lines 520-529 hardcodes the town names in
copy:

```
520	        {isOutsideCoverage ? (
521	          <div className={styles.noticeError}>
522	            <MapPin aria-hidden="true" size={18} />
523	            <p>
524	              <strong>Outside current home visit area:</strong> We currently
525	              cover Luton, Dunstable, Houghton Regis, Harpenden and St Albans.
526	              Use a covered town before choosing a time.
527	            </p>
528	          </div>
529	        ) : null}
```

Threading `freeTravelCities` into this component's props (as shown above)
does **not by itself** change any of `COVERED_TOWNS`, `isCovered`,
`isOutsideCoverage`, or the hardcoded notice copy — those all need to be
rewritten to prefer the prop (falling back to `BOOKING_ALLOWED_CITIES` when
the prop is absent) as a **separate, subsequent edit** inside this same file.
That rewrite is not "prop-threading" and is out of scope for what this report
was asked to derive, but it is the actual behavior change the business needs
— without it, the prop arrives and is unused, and the component still gates
on the old static Luton/Dunstable/Houghton Regis/Harpenden/St Albans list.
`AboutYouStep.tsx` also separately imports `BOOKING_ALLOWED_CITIES` from
`src/features/booking/schemas/booking-schema.ts`, which independently blocks
submission via a Zod `.refine()` at lines 143-153 of that file — a **second,
fully independent gate** that has no prop-threading path at all (it's a
schema-level pure function, not a component), and is unaffected by anything
in this report.

---

## 6. Other consumers of the public booking flow

Repo-wide grep for both component names, JSX-tag-form and import-form:

- `grep -n "<BookingExperienceLoader" src/**` → exactly one hit:
  `src/app/(public)/layout.tsx:41`.
- `grep -n 'from ["'"'"']\./BookingExperienceLoader["'"'"']|from ["'"'"']@/features/booking/BookingExperienceLoader["'"'"']' src/**`
  → exactly one hit: `src/app/(public)/layout.tsx:1`.
- `BookingExperience` (the inner component, not the Loader) has **no direct
  JSX mount site anywhere** — it is loaded exclusively via
  `next/dynamic(() => import("./BookingExperience")...)` inside
  `BookingExperienceLoader.tsx:7-13` and rendered only at
  `BookingExperienceLoader.tsx:90` (see §3). No other file imports
  `BookingExperience` as a component.

Everything else the broader grep surfaced (86-115 hits across the repo) is
either: markdown files under `redesign/**` (progress logs, plans, evidence —
not code), `.module.css` re-exports of `BookingExperience.module.css`
consumed by sibling step components (`ScheduleStep.tsx`, `AboutYouStep.tsx`,
etc. — a *stylesheet* import, unrelated to the component), or test files
(`AboutYouStep.test.tsx`, `returning-customer-consent-gate.test.ts`) that
import individual exports, not the mounted tree.

**Conclusion: there is exactly one mount point for the public booking flow —
`src/app/(public)/layout.tsx`. No second mount point, no test harness that
independently renders `BookingExperience` with its own props, needs the same
prop threaded.** The four-file chain (plus the fifth, `AboutYouStep.tsx`,
for the prop to actually land) is the complete surface.
