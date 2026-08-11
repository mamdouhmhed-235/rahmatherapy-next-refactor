# P2-AboutYouStep — verification report

Files read in full:
- `src/features/booking/components/AboutYouStep.tsx` (633 lines)
- `src/features/booking/components/AboutYouStep.test.tsx` (297 lines)

Also inspected for cross-reference:
- `src/features/booking/schemas/booking-schema.ts` (lines 1-30, 135-166)
- `src/features/booking/BookingExperience.module.css` (lines 825-887, the `.notice`/`.noticeError` block)
- `src/features/booking/BookingExperience.tsx` (grep only, for `bookingDetailsSchema.safeParse` call sites)

---

## 1. `AboutYouStepProps` — claimed :26-30

**Claim: REFUTED on exact range, CONFIRMED on shape.** The interface is at lines **26-30** (plan's claimed range is byte-for-byte correct for the line span — but I want to flag this precisely since the task said to treat every claim as suspect: after checking, this one line-range claim actually lands correctly). Byte-exact:

```
26	interface AboutYouStepProps {
27	  form: UseFormReturn<BookingDetailsFormValues>;
28	  prefilled?: boolean;
29	  onClearPrefill?: () => void;
30	}
```

So the plan's claim that it is exactly `{ form, prefilled, onClearPrefill }` at :26-30 is **CONFIRMED**, byte-exact, three props, in that order.

**"A new prop would be the FIRST prop this component receives via the layout chain" — REFUTED / unverifiable as stated.** `form` is line 27, the first field in the interface, and in the destructuring at lines 92-95 `form` is also destructured first:

```
91	export function AboutYouStep({
92	  form,
93	  prefilled = false,
94	  onClearPrefill,
95	}: AboutYouStepProps) {
```

There is nothing in this file establishing "the first prop through the layout chain" — that phrase describes how the parent (`BookingExperience.tsx`, not in scope here) passes props down, not something derivable from `AboutYouStep.tsx` alone. Flagging as **UNVERIFIABLE from this file**: confirm against `BookingExperience.tsx`'s render call before relying on it.

---

## 2. `COVERED_TOWNS` — claimed :56-58

**CONFIRMED**, byte-exact, lines **56-58**:

```
56	const COVERED_TOWNS = BOOKING_ALLOWED_CITIES.map((city) =>
57	  city.replace(/\b\w/g, (letter) => letter.toUpperCase())
58	);
```

Derivation: `BOOKING_ALLOWED_CITIES` is imported at line 18 (`import { BOOKING_ALLOWED_CITIES, type BookingDetailsFormValues } from "../schemas/booking-schema";`, lines 17-20) and is defined in `src/features/booking/schemas/booking-schema.ts:5-11` as:

```
5	export const BOOKING_ALLOWED_CITIES = [
6	  "luton",
7	  "dunstable",
8	  "houghton regis",
9	  "harpenden",
10	  "st albans",
11	] as const;
```

`COVERED_TOWNS` title-cases each lower-case entry via a regex replace on the first letter of every word (`\b\w`), giving `["Luton", "Dunstable", "Houghton Regis", "Harpenden", "St Albans"]`. This is the array rendered as chips at line 494 (`{COVERED_TOWNS.map((town) => {`).

---

## 3. `isCovered` / `isOutsideCoverage` — plan says :123-131 in one place, `isCovered` :125-130 / `isOutsideCoverage` :131 in another

**Neither cited range is byte-exact; the plan is internally inconsistent as flagged. Reporting the truth.** Actual lines **123-131**, full statements with surrounding context:

```
123	  const normalizedCity = city.trim().toLowerCase();
124	  const hasCityValue = normalizedCity.length > 1;
125	  const isCovered =
126	    hasCityValue &&
127	    BOOKING_ALLOWED_CITIES.some(
128	      (allowed) =>
129	        normalizedCity === allowed || normalizedCity.includes(allowed)
130	    );
131	  const isOutsideCoverage = hasCityValue && !isCovered;
```

So: the outer block (`normalizedCity` + `hasCityValue` + `isCovered` + `isOutsideCoverage`) spans **123-131**, matching the first plan citation. The second plan citation (`isCovered` :125-130 / `isOutsideCoverage` :131) is **byte-exact correct** for the `isCovered` statement specifically (125-130, the `const isCovered = ... ;` assignment) and for `isOutsideCoverage` (131). The two plan citations are not actually contradictory once you separate "the whole coverage-derivation block" (123-131) from "just the `isCovered` assignment" (125-130) — but since the task called this out as inconsistent, the byte-exact truth above resolves it either way.

`city` itself comes from `const city = watch("city");` at line 105.

---

## 4. Covered-case notice (claimed :510-518) and outside-coverage notice (claimed :520-529)

Both **CONFIRMED**, byte-exact, on the claimed line ranges.

**Covered notice — lines 510-518:**

```
510	        {isCovered ? (
511	          <div className={styles.notice}>
512	            <MapPin aria-hidden="true" size={18} />
513	            <p>
514	              <strong>Covered area:</strong> We can check matched appointment
515	              times for this location.
516	            </p>
517	          </div>
518	        ) : null}
```

**Outside-coverage notice — lines 520-529:**

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

Class/style references, exhaustively:
- Covered case: `styles.notice` (div, line 511) — no other `styles.*` reference inside this block; icon is a bare `<MapPin ... />`, no className on it.
- Outside case: `styles.noticeError` (div, line 521) — same structure otherwise (same `MapPin` icon, same `<p><strong>...</strong> ...</p>` shape), no other `styles.*` reference inside this block.

For a caller who wants the outside case to mirror the covered case's neutral treatment, the only edit needed inside these two blocks is swapping `styles.noticeError` → `styles.notice` on line 521 (the `<div className={...}>` wrapper) — everything else (icon, paragraph structure) is already structurally identical between the two blocks.

Underlying CSS (`src/features/booking/BookingExperience.module.css:833-882`), for reference on what "neutral" vs "red" actually means visually:

```
833	.notice,
834	.noticeError,
835	.reassurance {
836	  display: flex;
837	  gap: 10px;
838	  padding: 12px 14px;
839	  border-radius: 12px;
840	  font-size: 13.5px;
841	  line-height: 1.5;
842	}
843	
844	.notice {
845	  background: color-mix(in oklab, var(--rahma-green) 7%, transparent);
846	  color: var(--rahma-charcoal);
847	}
848	
849	.notice svg {
850	  flex: 0 0 auto;
851	  color: var(--rahma-green);
852	  margin-top: 1px;
853	}
854	
855	.noticeError {
856	  background: #fdecea;
857	  border: 1px solid #f2c4be;
858	  color: #8a1c12;
859	}
860	
861	.noticeError svg {
862	  flex: 0 0 auto;
863	  color: #b3261e;
864	  margin-top: 1px;
865	}
```

(`.reassurance` styling, lines 867-876, is unrelated to either notice used here and is not referenced by this component's outside/covered blocks.)

---

## 5. Exact current outside-coverage copy, verbatim

**CONFIRMED, byte-for-byte**, matches the plan's quote. The rendered text (concatenating the JSX text nodes at lines 524-526) is:

> **Outside current home visit area:** We currently cover Luton, Dunstable, Houghton Regis, Harpenden and St Albans. Use a covered town before choosing a time.

This is exactly the plan's quoted string: `"Outside current home visit area: We currently cover Luton, Dunstable, Houghton Regis, Harpenden and St Albans. Use a covered town before choosing a time."` — confirmed, including punctuation, the serial-comma-less "Harpenden and St Albans", and the trailing period.

---

## 6. Component signature and prop destructuring

Function declaration at lines 91-95:

```
91	export function AboutYouStep({
92	  form,
93	  prefilled = false,
94	  onClearPrefill,
95	}: AboutYouStepProps) {
```

House style notes for adding a new prop:
- Props are destructured directly in the function signature (not via a separate `props` object then manual destructure).
- Optional props get inline defaults in the destructuring pattern itself (`prefilled = false`), not `??` inside the body.
- `onClearPrefill` (an optional callback, no default) is left as `undefined`-able and called directly (`onClick={onClearPrefill}` at line 253) without a fallback no-op — so an optional new callback prop could follow that same pattern (declare as `?:` in the interface, destructure with no default, wire directly to the handler that needs it).
- Right after destructuring `form`, the component immediately pulls sub-pieces off it: `const { control, register, setValue, watch, formState: { errors } } = form;` at lines 96-102. Any new prop that needs to interact with form state would sit alongside this block, not inside `AboutYouStepProps` itself unless it's independent of `form`.

---

## 7. Test file

**`renderStep` harness — claimed :99-119.** **CONFIRMED**, byte-exact, lines **99-120** (the plan's claimed 99-119 covers the function body/signature; the closing brace is on 120 — reporting the full byte-exact block including the trailing brace since the caller will need it to match precisely):

```
99	async function renderStep(defaults: Partial<BookingDetailsFormValues> = {}) {
100	  vi.resetModules();
101	  const { AboutYouStep } = await import("./AboutYouStep");
102	
103	  const formRef: { current: UseFormReturn<BookingDetailsFormValues> | null } = {
104	    current: null,
105	  };
106	
107	  function Harness() {
108	    // Same shape BookingExperience builds the real form with: no resolver,
109	    // manual errors, validation on submit only.
110	    const form = useForm<BookingDetailsFormValues>({
111	      defaultValues: { ...emptyBookingDetails, ...defaults },
112	      mode: "onSubmit",
113	    });
114	    formRef.current = form;
115	    return <AboutYouStep form={form} />;
116	  }
117	
118	  render(<Harness />);
119	  return { formRef };
120	}
```

Note for the caller: `<AboutYouStep form={form} />` (line 115) passes **only** `form` — no `prefilled`, no `onClearPrefill`, and (relevant to any new prop) no other prop at all. Any new required prop added to `AboutYouStepProps` without a default will make this harness fail to typecheck/render as-is; if the new prop is being added, either it must be optional with a safe default inside the component, or this harness call site needs updating (which is out of scope for a `.tsx` reader but the caller doing the edit must know it touches here too, since a test-file edit is a `.tsx`-adjacent change the caller may still need to make consciously — flagging, not doing).

**Assertion `screen.getByText("Covered area:")` — claimed :201.** **CONFIRMED**, byte-exact, line 201:

```
201	    expect(screen.getByText("Covered area:")).toBeTruthy();
```

**Outside-coverage test — claimed :263-280.** **CONFIRMED**, byte-exact, lines **263-280**:

```
263	  it("surfaces the outside-coverage notice when the selected address is out of area", async () => {
264	    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = TEST_KEY;
265	    seedGoogle([
266	      makeSuggestion("place-mk", "5 Silbury Boulevard, Milton Keynes", OUT_OF_AREA_COMPONENTS),
267	    ]);
268	
269	    const { formRef } = await renderStep();
270	
271	    await typeAddress("5 Silbury");
272	    await selectFirstSuggestion();
273	
274	    expect(inputByName("city").value).toBe("Milton Keynes");
275	    // The city that the About -> Time gate will reject is the one now in form
276	    // state — a selection reaches the gate exactly as typing does.
277	    expect(formRef.current!.getValues().city).toBe("Milton Keynes");
278	    expect(screen.getByText("Outside current home visit area:")).toBeTruthy();
279	    expect(screen.queryByText("Covered area:")).toBeNull();
280	  });
```

**Two stale inline comments describing the About-to-Time hard gate as still blocking — claimed :192-193 and :275-276.**

First comment — **CONFIRMED**, byte-exact, lines **192-193** (inside test 1, "fills address, city, area and postcode..."):

```
192	    // What the About -> Time hard gate reads (bookingDetailsSchema.safeParse
193	    // runs against form.getValues() in BookingExperience).
```

Second comment — **CONFIRMED**, byte-exact, lines **275-276** (inside test 4, "surfaces the outside-coverage notice...", shown above in the full block):

```
275	    // The city that the About -> Time gate will reject is the one now in form
276	    // state — a selection reaches the gate exactly as typing does.
```

Both comments are now **factually stale** given the verified state of the world: per the task's "STATE OF THE WORLD" briefing, Phase 1 (already committed, 46f9369) made `settings.free_travel_cities` the live read path in `src/lib/booking/availability.ts`, and the DB-side migration (20260811230807) removed the `create_booking_request` service-area rejection entirely. But **within this file's own current code**, the phrase "the gate will reject" is still literally true: `bookingLocationSchema`'s `validateServiceArea` refinement (`src/features/booking/schemas/booking-schema.ts:139-161`) still calls `context.addIssue` for a non-covered city, and `bookingDetailsSchema` (which extends it, booking-schema.ts:166) is still `safeParse`'d as an advance-gate in `BookingExperience.tsx` at lines 252 and 429 (grep-confirmed; file not read in full — out of this agent's targeted scope but flagged since the comments explicitly name it). So: the comments are stale relative to the *intended end state* of Item 8 Phase 2, but accurate relative to *the code that exists today* in this file's sibling schema. Neither comment has been updated to reflect that the DB no longer enforces this and that the client-side schema gate is what Phase 2 app-layer work is meant to relax/remove.

**Every test in the file, by title** (single `describe` block at line 165: `"AboutYouStep — address autocomplete fills the location fields"`):

1. line 166 — `"fills address, city, area and postcode from one confirmed selection, and the covered-area notice follows"`
2. line 212 — `"never blanks a value the customer already has when the selected place has no equivalent part"`
3. line 235 — `"leaves the other fields alone while the customer is only typing"`
4. line 263 — `"surfaces the outside-coverage notice when the selected address is out of area"`
5. line 282 — `"is a plain, fully usable input when no API key is configured"`

Five tests total, all in one `describe`.

---

## 8. Does anything else in `src/features/booking/` read `COVERED_TOWNS` or duplicate the town list?

**`COVERED_TOWNS` itself: no other reader.** Grep for `COVERED_TOWNS` across `src/` returns exactly two hits, both inside `AboutYouStep.tsx`:
- line 56 (the definition)
- line 494 (the `.map()` that renders the town chips)

No other file imports or references `COVERED_TOWNS` — it is not exported (`const COVERED_TOWNS = ...`, no `export` keyword, line 56), so it structurally cannot be read elsewhere.

**`BOOKING_ALLOWED_CITIES` (the underlying array `COVERED_TOWNS` derives from): duplicated coverage logic exists, in `booking-schema.ts`.** Grep for `BOOKING_ALLOWED_CITIES` across `src/` returns:
- `booking-schema.ts:5` — the `export const` definition
- `booking-schema.ts:148` — used inside `validateServiceArea`
- `AboutYouStep.tsx:18` — the import
- `AboutYouStep.tsx:56` — `COVERED_TOWNS` derivation
- `AboutYouStep.tsx:127` — the `isCovered` check

The coverage predicate itself is **duplicated verbatim** between the two files. `AboutYouStep.tsx:127-130`:

```
127	    BOOKING_ALLOWED_CITIES.some(
128	      (allowed) =>
129	        normalizedCity === allowed || normalizedCity.includes(allowed)
130	    );
```

`booking-schema.ts:148-151` (`validateServiceArea`, full function at 139-161):

```
139	function validateServiceArea(
140	  value: { city: string },
141	  context: z.RefinementCtx
142	) {
143	  const normalizedCity = value.city.trim().toLowerCase();
144	  if (normalizedCity.length < 2) {
145	    return;
146	  }
147	
148	  const covered = BOOKING_ALLOWED_CITIES.some(
149	    (allowed) =>
150	      normalizedCity === allowed || normalizedCity.includes(allowed)
151	    );
152	
153	  if (!covered) {
154	    context.addIssue({
155	      code: "custom",
156	      path: ["city"],
157	      message:
158	        "This location is outside our current home visit area. Please use a covered town before choosing a time.",
159	    });
160	  }
161	}
162	
163	export const bookingLocationSchema =
164	  bookingLocationFieldsSchema.superRefine(validateServiceArea);
```

(Line-149-151 indentation reproduced exactly as read; note the closing paren at 151 is indented 4 spaces past `covered`'s `const`, matching the actual file — verify against source before using for an exact-match edit, since this is a secondary/context file, not the primary target this agent was asked to make edit-precise.)

This is the **hard gate** the two stale test comments (item 7 above) refer to: `bookingLocationSchema` (built from `validateServiceArea`) is what `bookingDetailsSchema` extends (`booking-schema.ts:166`, not fully quoted here — outside this agent's read scope), and `bookingDetailsSchema.safeParse(...)` is called as an advance-gate in `BookingExperience.tsx` at **lines 252 and 429** (grep hit only — `BookingExperience.tsx` was not read in full by this agent; confirm those two line numbers directly before relying on them for an edit).

**Summary for the caller:** there are exactly two places that know the covered-city list and its matching predicate — `AboutYouStep.tsx` (UI-level `isCovered`/`isOutsideCoverage` + the `COVERED_TOWNS` chip labels) and `booking-schema.ts`'s `validateServiceArea` (the Zod refinement that actually blocks form submission via `bookingDetailsSchema.safeParse`). A Phase 2 app-layer change that only edits `AboutYouStep.tsx`'s notice styling/copy will **not** by itself remove the hard gate — `validateServiceArea` in `booking-schema.ts` is the actual blocker referenced by the stale test comments, and it lives in a different file than the one this agent was scoped to edit-prepare.

---

## Findings summary (for structured output)

- Item 1: `AboutYouStepProps` interface confirmed byte-exact at :26-30, exactly `{ form, prefilled, onClearPrefill }`. The "first prop via layout chain" claim is unverifiable from this file alone (it's about the parent's call site, not this file) — `form` is the first field/destructured prop in this file's own signature.
- Item 2: `COVERED_TOWNS` confirmed byte-exact at :56-58; derives from `BOOKING_ALLOWED_CITIES` (booking-schema.ts:5-11) via a title-case regex replace.
- Item 3: The plan's two citations are reconcilable, not contradictory — full block is :123-131, and the narrower `isCovered` assignment alone is :125-130 with `isOutsideCoverage` at :131. Both quoted claims are individually byte-exact once scoped correctly.
- Item 4: Both notices confirmed byte-exact at claimed ranges (:510-518 covered, :520-529 outside). Only className difference: `styles.notice` (511) vs `styles.noticeError` (521) on the wrapper div; everything else structurally identical.
- Item 5: Outside-coverage copy confirmed byte-for-byte matching the plan's quote.
- Item 6: Signature confirmed at :91-95; house style destructures directly in the function signature with inline defaults for optional props.
- Item 7: `renderStep` confirmed byte-exact :99-120 (plan said 99-119, off by one closing brace). `getByText("Covered area:")` confirmed at :201. Outside-coverage test confirmed byte-exact :263-280. Both stale comments confirmed byte-exact at :192-193 and :275-276. Five tests total, listed with exact titles and lines.
- Item 8: `COVERED_TOWNS` has no external readers (not exported, only used within `AboutYouStep.tsx`). `BOOKING_ALLOWED_CITIES` and its coverage predicate ARE duplicated in `booking-schema.ts`'s `validateServiceArea` (:139-161), which backs `bookingLocationSchema`/`bookingDetailsSchema`, `safeParse`'d as the actual advance-gate in `BookingExperience.tsx` (grep-only, lines 252 and 429) — this is the real "hard gate" the stale test comments describe, and it is NOT in `AboutYouStep.tsx`.
