# P1 — `booking-schema.ts` verification (Item 8, Phase 2, app layer)

Read in full:
- `src/features/booking/schemas/booking-schema.ts` (208 lines)
- `src/features/booking/schemas/booking-schema.test.ts` (91 lines)

## 1. `BOOKING_ALLOWED_CITIES`

Claimed `:5-11`. **CONFIRMED — exact.**

```ts
export const BOOKING_ALLOWED_CITIES = [
  "luton",
  "dunstable",
  "houghton regis",
  "harpenden",
  "st albans",
] as const;
```
(`src/features/booking/schemas/booking-schema.ts:5-11`)

Repo-wide grep for the identifier `BOOKING_ALLOWED_CITIES` (excluding `redesign/**` evidence/plan docs, which only *discuss* it) finds it in exactly two `src/` files:

- `src/features/booking/schemas/booking-schema.ts`
  - `:5` — the declaration above
  - `:148` — consumed inside `validateServiceArea` (see §2)
- `src/features/booking/components/AboutYouStep.tsx`
  - `:18` — imported: `BOOKING_ALLOWED_CITIES,` (part of a multi-line import, `:17-20`)
  - `:56-58` — `const COVERED_TOWNS = BOOKING_ALLOWED_CITIES.map((city) =>\n  city.replace(/\b\w/g, (letter) => letter.toUpperCase())\n);`
  - `:127-130` — inside the component's own `isCovered` check (byte-exact, `:125-130`):
    ```ts
    const isCovered =
      hasCityValue &&
      BOOKING_ALLOWED_CITIES.some(
        (allowed) =>
          normalizedCity === allowed || normalizedCity.includes(allowed)
      );
    ```

The plan's claim ("AboutYouStep.tsx imports it") is confirmed. **No other importer exists** — this matches Phase 1's D7-blast-radius finding of exactly 2 files. `AboutYouStep.tsx` is outside this agent's write scope (target is `booking-schema.ts`/its test only) but the caller needs both this file's own two symbols removed *and* `AboutYouStep.tsx` updated in the same or a coordinated change, or `AboutYouStep.tsx` will fail to compile (`BOOKING_ALLOWED_CITIES` will no longer be exported).

## 2. `validateServiceArea`

Claimed `:139-161` (current pass); an earlier revision wrongly said `:139-164`. **CONFIRMED: actual function body is `:139-161`.** Line 164 is the *call site* (`superRefine(validateServiceArea)`), not part of the function — the earlier `:139-164` claim conflated the two.

Byte-exact, full function, `src/features/booking/schemas/booking-schema.ts:139-161`:

```ts
function validateServiceArea(
  value: { city: string },
  context: z.RefinementCtx
) {
  const normalizedCity = value.city.trim().toLowerCase();
  if (normalizedCity.length < 2) {
    return;
  }

  const covered = BOOKING_ALLOWED_CITIES.some(
    (allowed) =>
      normalizedCity === allowed || normalizedCity.includes(allowed)
  );

  if (!covered) {
    context.addIssue({
      code: "custom",
      path: ["city"],
      message:
        "This location is outside our current home visit area. Please use a covered town before choosing a time.",
    });
  }
}
```

## 3. Wire points — exhaustive grep of `superRefine` and `validateServiceArea`

Grep for `superRefine` in the file returns **4 occurrences**, in this order:

| line | context |
|---|---|
| `:120` | `export const bookingParticipantSchema =\n  bookingParticipantFieldsSchema.superRefine(validateParticipantGenders);` — **not** `validateServiceArea`. |
| `:164` | `export const bookingLocationSchema =\n  bookingLocationFieldsSchema.superRefine(validateServiceArea);` — **wire point 1**. |
| `:174` | `.superRefine(validateServiceArea)` — **wire point 2**, chained onto `bookingDetailsSchema`'s builder (see §4). |
| `:175` | `.superRefine(validateParticipantGenders);` — same chain, terminates `bookingDetailsSchema`; **not** `validateServiceArea`. |

Grep for `validateServiceArea` specifically in the file returns **3 occurrences**: the `function validateServiceArea(` declaration at `:139`, and the two `superRefine(validateServiceArea)` calls at `:164` and `:174`.

**Verdict: the plan's "TWO call sites" claim for `validateServiceArea` is CONFIRMED, exhaustively — exactly two, at `:164` and `:174`. No more than two exist.** (There are 4 `superRefine` calls total in the file, but the other two, at `:120` and `:175`, wire `validateParticipantGenders`, a different refinement, onto different schemas — out of scope for this removal.)

## 4. Full declarations (byte-exact, for unambiguous exact-match removal)

`bookingLocationFieldsSchema` — `:122-137`:

```ts
const bookingLocationFieldsSchema = z.object({
  postcode: requiredString("Enter your postcode.").min(3, {
    error: "Enter your postcode.",
  }),
  address: requiredString("Enter the home visit address.").min(5, {
    error: "Enter the home visit address.",
  }),
  city: requiredString("Enter your city or town.").min(2, {
    error: "Enter your city or town.",
  }),
  area: requiredString("Enter your area or county (e.g., Bedfordshire).").min(2, {
    error: "Enter your area or county.",
  }),
  accessNotes: z.string(),
  parkingNotes: z.string(),
});
```

`bookingLocationSchema` — `:163-164` (the export statement starts at 163; the `superRefine` call itself is `:164`):

```ts
export const bookingLocationSchema =
  bookingLocationFieldsSchema.superRefine(validateServiceArea);
```

To remove wire point 1 while keeping the export (schema becomes the plain object, no refine), the exact-match target is:

```ts
export const bookingLocationSchema =
  bookingLocationFieldsSchema.superRefine(validateServiceArea);
```
→ replace with `export const bookingLocationSchema = bookingLocationFieldsSchema;` (or equivalent single-line form — caller's call, not this agent's).

`bookingDetailsSchema` — `:166-175`:

```ts
export const bookingDetailsSchema = bookingParticipantFieldsSchema
  .merge(bookingLocationFieldsSchema)
  .extend({
    // C-22 honeypot — a pass-through so client validation never flags it.
    // Optional on purpose: a missing key must never be able to block a real
    // booking. The server reads the hoisted top-level copy, not this one.
    company_website: z.string().optional(),
  })
  .superRefine(validateServiceArea)
  .superRefine(validateParticipantGenders);
```

To remove wire point 2 only, the line `  .superRefine(validateServiceArea)` at `:174` is uniquely identifiable by its leading two-space indent and exact text (it's the only occurrence of that exact string in the file — `:120`'s `superRefine(validateParticipantGenders)` differs in the refined function name, and `:164`'s call is on a different receiver/line shape, not indented the same way as a chained `.superRefine(...)`). Deleting line `:174` in full (including its newline) leaves:

```ts
export const bookingDetailsSchema = bookingParticipantFieldsSchema
  .merge(bookingLocationFieldsSchema)
  .extend({
    // C-22 honeypot — a pass-through so client validation never flags it.
    // Optional on purpose: a missing key must never be able to block a real
    // booking. The server reads the hoisted top-level copy, not this one.
    company_website: z.string().optional(),
  })
  .superRefine(validateParticipantGenders);
```

## 5. Test file

`describe` block opens at `:34`: `describe("booking schema", () => {`.

The test the plan calls "rejects unsupported service areas before time selection" — claimed `:39-47`. **CONFIRMED — exact**, byte-exact quote, `src/features/booking/schemas/booking-schema.test.ts:39-47`:

```ts
  it("rejects unsupported service areas before time selection", () => {
    const result = bookingLocationSchema.safeParse({
      ...baseLocation,
      city: "Manchester",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/outside our current/i);
  });
```

It calls **`bookingLocationSchema`**, not `bookingDetailsSchema`.

Grepping the test file for `Manchester`, `service area` (case-insensitive), and `city`/`City` finds only these matches, all inside the same `describe("booking schema", ...)` block:

- `:28` — `city: "Luton",` inside the shared `baseLocation` fixture (`:25-32`), used by both service-area tests and by the `"accepts complete mixed-gender group details"` test (`:77-89`).
- `:35` — `it("accepts a supported service area before time selection", () => {` (`:35-37`, full body: `expect(bookingLocationSchema.safeParse(baseLocation).success).toBe(true);`).
- `:39` — the rejects-test analyzed above.
- `:42` — `city: "Manchester",` inside that test's inline override.

**Tests affected by deleting both `superRefine(validateServiceArea)` wire points:**
- `"rejects unsupported service areas before time selection"` (`:39-47`) — **will FAIL**. With the refine removed, `bookingLocationSchema.safeParse({ ...baseLocation, city: "Manchester" })` will succeed (`result.success === true`), so `expect(result.success).toBe(false)` fails. This test must be deleted or rewritten by whoever implements the removal.
- `"accepts a supported service area before time selection"` (`:35-37`) — **still passes**, but becomes a vacuous assertion (it never exercised anything else since `baseLocation.city` was always "Luton", a covered town — success was already guaranteed by the other required-field checks). Not a hard breakage, but worth flagging: its name becomes misleading once there's no service-area gate to "accept" into.
- `"accepts complete mixed-gender group details"` (`:77-89`) — uses `bookingDetailsSchema.safeParse` with `baseLocation` (city "Luton", already covered) — unaffected either way (no assertion tied to service-area rejection).
- No test references `bookingDetailsSchema` together with an out-of-area city, so wire point 2 (`:174`) has no direct test coverage of its own — its removal is only indirectly evidenced by the `bookingLocationSchema` test above testing the same `validateServiceArea` function.

## 6. Orphans after removing both wire points and the constant

Within `booking-schema.ts` itself: **none beyond the two symbols already slated for deletion.**

- `BOOKING_ALLOWED_CITIES` (`:5-11`) is referenced only at `:148`, inside `validateServiceArea` — deleted together with the function, so no separate orphan.
- `validateServiceArea` (`:139-161`) is referenced only at `:164` and `:174` — both wire points are being removed, so the function itself becomes fully unused and must also be deleted (this is already in the plan's scope per the caller's task framing — "delete `BOOKING_ALLOWED_CITIES`; delete `validateServiceArea`; remove both call sites").
- No other import, constant, or helper in the file exists solely to support `validateServiceArea`/`BOOKING_ALLOWED_CITIES`. The file's other imports (`z` from `zod/v4`, `isDateInBusinessWindow` from `@/lib/time/london`, `type BookingDetails` from `../types`) are all used elsewhere (`isDateInBusinessWindow` in `bookingVisitSchema`'s `preferredDate` refine at `:182-188`; `BookingDetails` in the `BookingDetailsFormValues` type alias at `:206`; `z` throughout). Removing the two target symbols introduces **no new `@typescript-eslint/no-unused-vars` regression** in this file — confirmed by full-file read, not inference.

Outside this file: `AboutYouStep.tsx`'s import of `BOOKING_ALLOWED_CITIES` (`:18`) becomes a hard compile error once the export is deleted from `booking-schema.ts` — that file is out of this agent's write scope but the caller must handle it in the same change (see §1).

## 7. Anti-drift idiom — `src/content/site/__tests__/canonical-domain.test.ts`

Full file read. Byte-exact, the two mechanisms relevant to a reusable guard:

The file-walker (`:23-29`):

```ts
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) ? [full] : [];
  });
}
```

The "single canonical source of truth" assertion idiom (`:47-50`), which is the pattern to adapt for guarding against a reintroduced hardcoded town list:

```ts
  it("hard-codes the live origin in exactly one module", () => {
    const carriers = files.filter((file) => file.contents.includes(LIVE_ORIGIN));
    expect(carriers.map((file) => file.path)).toEqual([SITE_URL_MODULE]);
  });
```

and its companion negative-literal guard (`:37-45`):

```ts
  it("keeps wrong-domain literals out of src/", () => {
    // Guards against a vacuous pass if the walk above ever stops finding files.
    expect(files.length).toBeGreaterThan(100);

    for (const domain of WRONG_DOMAINS) {
      const offenders = files.filter((file) => file.contents.includes(domain));
      expect(offenders.map((file) => file.path), `stale domain "${domain}"`).toEqual([]);
    }
  });
```

The reusable idiom: build the `sourceFiles()` list once, scan `.contents` for a needle constructed at runtime (never string-literal-matchable in the guard file itself, so the guard can't accidentally satisfy its own check), then assert either "this string appears nowhere" (for a banned pattern) or "this string appears in exactly one allowed module" (for a canonical single source). A guard against a hardcoded town list reappearing under `src/features/booking/` or `src/lib/booking/` would restrict `sourceFiles()` (or filter its result) to those two subtrees and assert none of the five town names (`luton`, `dunstable`, `houghton regis`, `harpenden`, `st albans`) — or a constant literally named `BOOKING_ALLOWED_CITIES` / similar — appears there anymore. Also note the file-count sanity check at `:39` (`expect(files.length).toBeGreaterThan(100)`), which exists specifically so the walker silently returning zero files can't produce a vacuous pass — the same safeguard should be replicated in any new guard built on this idiom.

## Summary of plan-claim verdicts

| # | Claim | Verdict |
|---|---|---|
| 1 | `BOOKING_ALLOWED_CITIES` at `:5-11` | CONFIRMED |
| 1 | Only `AboutYouStep.tsx` imports it besides the declaring file | CONFIRMED |
| 2 | `validateServiceArea` at `:139-161` (current); earlier `:139-164` claim was wrong | CONFIRMED as stated — actual is `:139-161`, `:164` is the call site not the body |
| 3 | Exactly two `superRefine(validateServiceArea)` wire points, at `:163-164` and `:174` | CONFIRMED — declaration/export starts `:163`, call is `:164`; second call is `:174`. Exhaustive grep found no third. |
| 5 | Test at `:39-47` calls `bookingLocationSchema`, matches "rejects unsupported service areas..." | CONFIRMED |
| 6 | No lint regression risk beyond the two symbols already slated for removal | CONFIRMED |
