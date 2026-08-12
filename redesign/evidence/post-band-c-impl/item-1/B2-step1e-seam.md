# Step 1e seam derivation — vary review-request copy by client class

Read-only derivation. Every symbol below was located by name (`Grep`), then read with
`Read` so the line numbers shown are what the file actually contains right now, not
copied from any plan/handoff. Repo root: `rahmatherapy-next-refactor`. All paths are
relative to it.

---

## 1. `pickReviewMessages` — full source, signature, data structure

**Location:** `src/lib/email/templates.ts:833-858`. Exported.

```ts
// Picks 3 of the 5 pooled sample review sentences for the booking's service
// category, substituting an operator-configured override where present, then
// substituting {city}. Mixed-category bookings (groupCategory null) fall back
// to the massage pool (C-01 brief §5.3 — impl-time decision).
//
// C-15 Phase A: the 10 pooled defaults now read from the registry
// (fieldDefault) instead of a locally-duplicated DEFAULT_REVIEW_VARIANTS
// object — same literal strings, single source of truth.
export function pickReviewMessages(
  args: PickReviewMessagesArgs
): ReviewMessageVariant[] {
  const { groupCategory, city, overrides, random = Math.random } = args;
  const category = groupCategory ?? "massage";

  const pool: ReviewMessageVariant[] = [];
  for (let i = 1; i <= 5; i++) {
    const key = `${category}_variant_${i}`;
    const overrideValue = overrides[key];
    if (overrideValue) {
      pool.push({ text: overrideValue, source: "override" });
    } else {
      pool.push({ text: fieldDefault("review_request_client", key), source: "default" });
    }
  }

  // Shuffle and pick 3.
  const shuffled = [...pool].sort(() => random() - 0.5);
  const picked = shuffled.slice(0, 3);

  return picked.map((variant) => ({
    ...variant,
    text: substituteCity(variant.text, city),
  }));
}
```

**Its argument type** (`templates.ts:818-823`):

```ts
interface PickReviewMessagesArgs {
  groupCategory: "massage" | "cupping" | null;
  city: string | null;
  overrides: Record<string, string>;
  random?: () => number;
}
```

Not exported — a caller cannot name it, only satisfy its shape. There is **no
`clientClass` field on this type today.**

**Return type** (`templates.ts:813-816`):

```ts
export interface ReviewMessageVariant {
  text: string;
  source: "override" | "default";
}
```

**How it uses `groupCategory`:** collapses `null` to `"massage"` (line 837), then builds
registry keys `"massage_variant_1".."massage_variant_5"` or `"cupping_variant_1".."cupping_variant_5"`
(line 841). That is the *only* thing `groupCategory` does inside this function — it
selects which 5-item pool to draw from. It has no other effect on the function's output.

**How it uses `city`:** not during pool selection — only at the very end (line
854-857), where every one of the 3 *picked* variants (default or override) is run through
`substituteCity`.

**Data structure of the pool:** a flat, in-memory array built fresh on every call — 5
`{text, source}` objects for whichever single category applies, shuffled with a
Fisher-Yates-style `Array.sort` (stable-under-constant-comparator, per the test file's own
comment), then `.slice(0, 3)`. There is no persistent/cached "pool" object — nothing to
extend a class dimension onto except this per-call loop.

`substituteCity` (`templates.ts:862-865`, not exported):

```ts
function substituteCity(text: string, city: string | null): string {
  if (city) return text.replace(/\{city\}/g, city);
  return text.replace(/\s+in\s+\{city\}/g, "").replace(/\{city\}/g, "");
}
```

---

## 2. `review_request_client` registry entry — every field, verbatim, placeholder vs defaultValue marked

**File:** `src/app/admin/emails/components/templates-data.ts`. The `TemplateMeta` object
is at **lines 728-759**:

```ts
{
    id: "review_request_client",
    audience: "customer",
    cardName: "Review request (2h post-completion)",
    trigger: "Sent automatically 2 hours after a booking is marked completed",
    rendersAs: "html",
    subjectDefault: "Thank you for visiting Rahma Therapy",
    fields: [
      subjectField("Thank you for visiting Rahma Therapy"),
      REVIEW_BODY_INTRO,
      REVIEW_BODY_ASK,
      REVIEW_BODY_CTA_LABEL,
      REVIEW_BODY_CTA_URL,
      REVIEW_BODY_SIGNOFF,
      REVIEW_MASSAGE_VARIANT_1,
      REVIEW_MASSAGE_VARIANT_2,
      REVIEW_MASSAGE_VARIANT_3,
      REVIEW_MASSAGE_VARIANT_4,
      REVIEW_MASSAGE_VARIANT_5,
      REVIEW_CUPPING_VARIANT_1,
      REVIEW_CUPPING_VARIANT_2,
      REVIEW_CUPPING_VARIANT_3,
      REVIEW_CUPPING_VARIANT_4,
      REVIEW_CUPPING_VARIANT_5,
    ],
    fixedParts: [
      {
        label: "Which 3 review samples are shown",
        source: "Chosen at random from the 5 configured samples each time this email sends.",
      },
    ],
  },
```

16 fields total: 1 subject + 5 body fields + 10 category-variant fields.
`subjectDefault` (line 734) is a **separate** string from the `subject` field's own
`defaultValue` below — see the file's own comment at `templates-data.ts:63-76`:
`subjectDefault` feeds the real `Subject:` header via `resolveSubject()`; the `subject`
field's `defaultValue`/`placeholder` feed only the `<title>` tag and the editor preview.
Both happen to be the identical string here (`"Thank you for visiting Rahma Therapy"`),
but they are two different fields in the type, not one.

### `subject` field — via `subjectField()` factory (`templates-data.ts:121-135`)

```ts
function subjectField(defaultValue: string): SafeField {
  return {
    kind: "subject",
    label: "Subject line",
    placeholder: defaultValue,
    helper:
      "Sets the subject line shown in the recipient's inbox, and the hidden page title inside the email's HTML source.",
    maxLength: 100,
    defaultValue,
  };
}
```

Called as `subjectField("Thank you for visiting Rahma Therapy")` (line 736).
**`placeholder` and `defaultValue` are the literal same JS binding here** — `placeholder:
defaultValue` — not just equal text, the same parameter reused twice in the returned
object. There is no way for these two to diverge for this field short of editing the
factory itself.

### Five body fields (`templates-data.ts:253-305`)

Each is a standalone `const`, `placeholder` and `defaultValue` set from separately-typed
string literals (not a shared factory) — I diffed each pair character-for-character below
and they are byte-identical in every case, but that is a property of *this file's current
content*, not of the type (nothing forces it).

| kind | lines | `placeholder` (verbatim) | `defaultValue` (verbatim) | identical? |
|---|---|---|---|---|
| `body_intro` | 253-264 | `"Thank you for choosing Rahma Therapy for your {service_name}. We hope you felt looked after from start to finish."` | same string | yes |
| `body_ask` | 266-277 | `"If you have a moment, we'd be grateful for an honest review on Google. It helps other people in {city} find us."` | same string | yes |
| `body_cta_label` | 279-286 | `"Leave a Google review"` | same string | yes |
| `body_cta_url` | 288-295 | `"https://g.page/r/Ccfwk27JycKDEBM/review"` | same string | yes |
| `body_signoff` | 297-305 | `"Thank you again,\nThe Rahma Therapy team"` | same string | yes |

Full verbatim text of `REVIEW_BODY_ASK` (`templates-data.ts:266-277`) as one example of
the shape, since it is the field most likely to be touched by a client-class variation:

```ts
const REVIEW_BODY_ASK: SafeField = {
  kind: "body_ask",
  label: "Ask paragraph",
  placeholder:
    "If you have a moment, we'd be grateful for an honest review on Google. It helps other people in {city} find us.",
  helper: "The review request itself. {city} fills in automatically when known.",
  maxLength: 500,
  multiline: true,
  defaultValue:
    "If you have a moment, we'd be grateful for an honest review on Google. It helps other people in {city} find us.",
  tokens: [{ token: "{city}", label: "City", sample: SAMPLE.city }],
};
```

### Ten category-variant fields — via `reviewVariantField()` factory (`templates-data.ts:307-323`)

```ts
function reviewVariantField(
  kind: string,
  label: string,
  text: string,
  category: "massage" | "cupping"
): SafeField {
  return {
    kind,
    label,
    placeholder: text,
    helper: `One of 5 sample reviews shown to ${category === "massage" ? "massage" : "cupping/hijama"} clients; 3 are picked at random. {city} fills in automatically.`,
    maxLength: 400,
    multiline: true,
    defaultValue: text,
    tokens: [{ token: "{city}", label: "City", sample: SAMPLE.city }],
  };
}
```

Same shadowing pattern as `subjectField`: `placeholder: text` and `defaultValue: text` —
**the same `text` parameter, two keys.** Every one of the 10 calls below inherits this:

```ts
const REVIEW_MASSAGE_VARIANT_1 = reviewVariantField(
  "massage_variant_1", "Massage review sample 1",
  "I had a brilliant home massage in {city} today — really professional setup, felt completely relaxed by the end.",
  "massage"
);                                                                    // templates-data.ts:325-330
const REVIEW_MASSAGE_VARIANT_2 = reviewVariantField(
  "massage_variant_2", "Massage review sample 2",
  "Booked a home massage with Rahma Therapy in {city}. The therapist was excellent, the experience felt like a proper clinic but in the comfort of home.",
  "massage"
);                                                                    // :331-336
const REVIEW_MASSAGE_VARIANT_3 = reviewVariantField(
  "massage_variant_3", "Massage review sample 3",
  "Just had a fantastic massage at home in {city}. Highly skilled, deeply relaxing, and so easy not having to travel.",
  "massage"
);                                                                    // :337-342
const REVIEW_MASSAGE_VARIANT_4 = reviewVariantField(
  "massage_variant_4", "Massage review sample 4",
  "Tried Rahma Therapy for a mobile massage in {city} — top quality. Will definitely book again.",
  "massage"
);                                                                    // :343-348
const REVIEW_MASSAGE_VARIANT_5 = reviewVariantField(
  "massage_variant_5", "Massage review sample 5",
  "Excellent home massage experience in {city}. Calm, professional, and exactly what I needed.",
  "massage"
);                                                                    // :349-354
const REVIEW_CUPPING_VARIANT_1 = reviewVariantField(
  "cupping_variant_1", "Cupping review sample 1",
  "Had a hijama session at home in {city} with Rahma Therapy. Very clean, hygienic, and the practitioner was knowledgeable and respectful.",
  "cupping"
);                                                                    // :355-360
const REVIEW_CUPPING_VARIANT_2 = reviewVariantField(
  "cupping_variant_2", "Cupping review sample 2",
  "Booked hijama at home in {city} — proper Sunnah practice, sterile equipment, and a calming atmosphere. Highly recommend.",
  "cupping"
);                                                                    // :361-366
const REVIEW_CUPPING_VARIANT_3 = reviewVariantField(
  "cupping_variant_3", "Cupping review sample 3",
  "Excellent home hijama appointment in {city}. Felt looked after from start to finish, the setup was spotless and professional.",
  "cupping"
);                                                                    // :367-372
const REVIEW_CUPPING_VARIANT_4 = reviewVariantField(
  "cupping_variant_4", "Cupping review sample 4",
  "Tried Rahma Therapy for hijama in {city} and couldn't be happier. Knowledgeable practitioner, careful technique, and great aftercare.",
  "cupping"
);                                                                    // :373-378
const REVIEW_CUPPING_VARIANT_5 = reviewVariantField(
  "cupping_variant_5", "Cupping review sample 5",
  "First hijama session in {city} and it was a brilliant experience. Clean, professional, and the practitioner explained every step.",
  "cupping"
);                                                                    // :379-384
```

**Gotcha-41 relevance (placeholder shadowing a real defaultValue):** for this template,
`placeholder === defaultValue` on *every* field, so a naive source-text guard that greps
for "the field's placeholder text" and one that greps for "the field's defaultValue text"
happen to agree today — this template gives no way to tell them apart by symptom. That is
exactly the trap: any Step 1e guard/test that asserts "the new class-varied string appears
in the rendered output" by grepping the *registry source file* (rather than calling
`fieldDefault()`/the render function and asserting on the actual return value) cannot
distinguish "the runtime default really is this text" from "this text merely also sits in
a `placeholder:` key that render-time code never reads." `placeholder` is UI-only (used
for the empty-state hint in an `<input>`/`<textarea>`) — grep in `templates-data.ts:38-55`
(`SafeField` interface) shows it has no runtime-render role; only `defaultValue` is read
by `fieldDefault()` (`templates.ts:130-138`, quoted in §3).

---

## 3. `resolveTemplateOverrides` and the merge logic — override wins, quoted verbatim

**`resolveTemplateOverrides`** (`templates.ts:708-730`, exported, async):

```ts
export async function resolveTemplateOverrides(
  templateId: string
): Promise<Record<string, string>> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("email_template_overrides")
      .select("field_key, value")
      .eq("template_id", templateId);
    if (error) {
      console.error("resolveTemplateOverrides lookup failed:", error.message);
      return {};
    }
    const map: Record<string, string> = {};
    for (const row of (data ?? []) as { field_key: string; value: string }[]) {
      map[row.field_key] = row.value;
    }
    return map;
  } catch (error) {
    console.error("resolveTemplateOverrides threw:", error);
    return {};
  }
}
```

It is a **flat `Record<string, string>`** keyed by `field_key` — i.e. by `SafeField.kind`
(`massage_variant_1`, `body_ask`, `subject`, …), for one `template_id` at a time, with no
concept of category or class baked into the shape. Any new field kind (a class-keyed one)
slots into this same flat map automatically, with zero change to this function.

**Merge logic — proven verbatim from two call sites:**

Inside `pickReviewMessages` (`templates.ts:842-847`):

```ts
    const overrideValue = overrides[key];
    if (overrideValue) {
      pool.push({ text: overrideValue, source: "override" });
    } else {
      pool.push({ text: fieldDefault("review_request_client", key), source: "default" });
    }
```

Inside `resolveReviewRequestFields` (`templates.ts:873-890`):

```ts
function resolveReviewRequestFields(overrides: Record<string, string>) {
  const id = "review_request_client";
  return {
    subject: resolveTitleSubject(id, overrides),
    body_intro: overrides.body_intro || fieldDefault(id, "body_intro"),
    body_ask: overrides.body_ask || fieldDefault(id, "body_ask"),
    body_cta_label: overrides.body_cta_label || fieldDefault(id, "body_cta_label"),
    body_cta_url:
      overrides.body_cta_url && isHttpsUrl(overrides.body_cta_url)
        ? overrides.body_cta_url
        : fieldDefault(id, "body_cta_url"),
    body_signoff: overrides.body_signoff || fieldDefault(id, "body_signoff"),
  };
}
```

**Answer: the admin override always wins when present and truthy.** Both sites use
`overrides[key] || fieldDefault(...)` (or the equivalent truthy-check + branch), never
`??` — the file's own comment at `templates.ts:123-129` explains this was a deliberate C-15
Phase B fix: `??` only falls back on `null`/`undefined`, so a saved empty-string override
would incorrectly win and render a blank paragraph; `||` treats `""` the same as "no
override," matching `saveTemplateOverride`'s behaviour of deleting the row entirely on an
empty save. **A class-varied *default* only ever matters when no override exists for that
field key** — this is unconditional today and would remain unconditional under any of the
three seam options in §7, because all three reuse this identical `overrides[key] ||
fieldDefault(...)` idiom rather than inventing a new one.

---

## 4. `renderReviewRequestEmail` / `renderReviewRequestPlainText` — parameters, sourcing, one sentence traced end to end

**`renderReviewRequestEmail`** (`templates.ts:905-946`, exported, async):

```ts
export async function renderReviewRequestEmail(
  input: ReviewRequestEmailInput,
  providedOverrides?: Record<string, string>,
  providedVariants?: ReviewMessageVariant[]
): Promise<string> {
  const overrides = providedOverrides ?? (await resolveTemplateOverrides("review_request_client"));
  const variants = providedVariants ?? pickReviewMessages({
    groupCategory: input.groupCategory,
    city: input.city,
    overrides,
  });

  const fields = resolveReviewRequestFields(overrides);

  const vars = buildVarMap(input, {
    city: input.city ?? "",
    service_name: input.participants[0]?.services?.[0] ?? "appointment",
  });

  const intro = substituteVars(fields.body_intro, vars);
  const ask = substituteVars(fields.body_ask, vars);
  const signoff = substituteVars(fields.body_signoff, vars);

  return renderLayout(
    fields.subject,
    `<p>${escapeHtml(intro)}</p>
      <p>${escapeHtml(ask)}</p>
      <p style="margin-top:24px;font-weight:600;">Here are a few example reviews if you'd like a starting point — or write your own, whatever feels honest:</p>
      <ul style="padding-left:18px;">
        ${variants.map((v) => `<li style="margin-bottom:8px;">${escapeHtml(v.text)}</li>`).join("")}
      </ul>
      <p style="margin:24px 0;">
        <a href="${escapeHtml(fields.body_cta_url)}" ...>${escapeHtml(fields.body_cta_label)}</a>
      </p>
      <p style="white-space:pre-line;">${escapeHtml(signoff)}</p>`
  );
}
```

3 parameters: `input: ReviewRequestEmailInput` (required), `providedOverrides?` (optional
— defaults to a fresh DB read), `providedVariants?` (optional — defaults to a fresh
`pickReviewMessages` call). `ReviewRequestEmailInput` itself (`templates.ts:808-811`):

```ts
export interface ReviewRequestEmailInput extends BookingEmailTemplateInput {
  groupCategory: "massage" | "cupping" | null; // null for mixed-category bookings
  city: string | null;
}
```

**No `clientClass` field exists on this type today.**

**`renderReviewRequestPlainText`** (`templates.ts:956-991`, exported, sync — not async,
unlike the HTML leg):

```ts
export function renderReviewRequestPlainText(
  input: ReviewRequestEmailInput,
  variants: ReviewMessageVariant[],
  overrides: Record<string, string> = {}
): string {
  const fields = resolveReviewRequestFields(overrides);
  const vars = buildVarMap(input, {
    city: input.city ?? "",
    service_name: input.participants[0]?.services?.[0] ?? "appointment",
  });
  const resolveField = (template: string) =>
    substituteVars(substituteCity(template, input.city), vars);
  const intro = resolveField(fields.body_intro);
  const ask = resolveField(fields.body_ask);
  const signoff = resolveField(fields.body_signoff);
  return `${intro}\n\n${ask}\n\nHere are a few examples if you'd like a starting point, or write your own:\n${variants.map((v) => `- ${v.text}`).join("\n")}\n\n${fields.body_cta_label}: ${fields.body_cta_url}\n\n${signoff}\n`;
}
```

3 parameters, `variants` and `overrides` both **required-by-position** here (`overrides`
has a default of `{}` but `variants` does not — a caller must always pick/pass its own
variant set; there is no internal `pickReviewMessages` fallback on this leg the way the
HTML leg has one).

**Which strings come from where, per leg:**

| content | HTML leg source | Plain-text leg source |
|---|---|---|
| subject / `<title>` | `resolveReviewRequestFields` → `resolveTitleSubject` (override or `fieldDefault`) | n/a (plain text has no subject line) |
| intro / ask / signoff | `resolveReviewRequestFields` (override `\|\|` `fieldDefault`), then `substituteVars` only | same `resolveReviewRequestFields` call, then `substituteCity` **then** `substituteVars` |
| cta label / url | `resolveReviewRequestFields` (override, with an HTTPS-scheme guard on the URL) | same `fields` object, no re-resolution |
| 3 review examples | the `variants` array — from `providedVariants` if passed, else a **fresh** `pickReviewMessages` call inside this same function | the `variants` array — **must be passed in**, this function never calls `pickReviewMessages` itself |

**A verified behavioural asymmetry between the two legs** (relevant to any new
`{city}`- or class-conditioned field, since it shows the existing pattern is not
perfectly mirrored): the HTML leg's `intro`/`ask`/`signoff` go through `substituteVars`
only, with `vars.city` pre-set to `input.city ?? ""` (line 920) — so a null city collapses
`{city}` to an **empty string in place**, e.g. `body_ask`'s default becomes "...It helps
other people in  find us." (double space, no phrase-level cleanup). The plain-text leg
instead runs `substituteCity(template, input.city)` **first** (line 974), which — per its
source in §1 — explicitly strips the surrounding `" in {city}"` phrase when `city` is
null, so the same sentence there is not present at all. This split exists **today**, is
unrelated to Step 1e, and only manifests when `city` is `null` (a client with no city on
file). It is called out because it is exactly the kind of per-leg divergence a class-line
seam must not reintroduce for whatever new text it adds.

**One concrete sentence traced end to end** (`body_ask`, HTML leg, no override, city =
`"Luton"`):

1. Registry default (`templates-data.ts:274-275`): `"If you have a moment, we'd be grateful for an honest review on Google. It helps other people in {city} find us."`
2. `resolveReviewRequestFields` (`templates.ts:878`): `overrides.body_ask || fieldDefault(id, "body_ask")` → no override present → the string from step 1, unchanged.
3. `buildVarMap` (`templates.ts:91-111`, called at `templates.ts:919-922`): builds `vars.city = "Luton"`.
4. `renderReviewRequestEmail` (`templates.ts:925`): `const ask = substituteVars(fields.body_ask, vars)` → `substituteVars` (`templates.ts:69-78`) regex-replaces `{city}` → `"If you have a moment, we'd be grateful for an honest review on Google. It helps other people in Luton find us."`
5. Rendered (`templates.ts:931`): `<p>${escapeHtml(ask)}</p>` → `escapeHtml` (`templates.ts:57-64`) HTML-escapes it (no-op here, no special chars) → lands verbatim inside the returned HTML string.

---

## 5. `groupCategory` — value union, derivation, and whether copy already varies by a second dimension

**Union** (`templates.ts:809`, and independently at `notifications.ts:1635`,
`Promise<"massage" | "cupping" | null>`): `"massage" | "cupping" | null`.

**Derived by `deriveGroupCategoryForBooking`** (`notifications.ts:1632-1653`, not
exported — module-private):

```ts
async function deriveGroupCategoryForBooking(
  bookingId: string,
  supabase: SupabaseClient
): Promise<"massage" | "cupping" | null> {
  const { data: items } = await supabase
    .from("booking_items")
    .select("services(group_category)")
    .eq("booking_id", bookingId)
    .returns<BookingItemGroupCategoryRow[]>();

  const categories = new Set(
    (items ?? [])
      .map((item) => item.services?.group_category)
      .filter((cat): cat is string => cat === "massage" || cat === "cupping")
  );

  if (categories.size === 1) {
    return categories.has("massage") ? "massage" : "cupping";
  }
  // Mixed or unknown → null (variant picker falls back to massage pool).
  return null;
}
```

Called once, at `notifications.ts:1573`, inside `sendReviewRequestEmail`.

**Does copy already vary along this dimension? Yes — but only the 3-of-5 example-review
sentences, nothing else.** `resolveReviewRequestFields` (§3) takes no `groupCategory`
argument at all — `subject`, `body_intro`, `body_ask`, `body_cta_label`, `body_cta_url`,
`body_signoff` are **single global defaults regardless of category.** Only
`pickReviewMessages` reads `groupCategory`, and only to choose which one of the two
5-item pools to draw from (§1).

**Client class does NOT vary copy today, at all.** `classifyReviewClient` (§ below) exists
and is called, but only inside the cron route, only to write `client_class` into an audit
row — it is never passed into `sendReviewRequestEmail`, `pickReviewMessages`,
`renderReviewRequestEmail`, or `renderReviewRequestPlainText`. Proof —
`sendReviewRequestEmail`'s full signature (`notifications.ts:1518-1525`):

```ts
export async function sendReviewRequestEmail(
  bookingId: string,
  supabase: SupabaseClient,
  options: { ignoreClientCooldown?: boolean } = {}
): Promise<{
  sent: boolean;
  reason?: "no_email" | "already_sent" | "send_failed" | "client_recently_asked";
}>
```

No `clientClass` parameter, no `ReviewClientClass` import. And the cron route's own
`classifyReviewClient` call (`src/app/api/cron/review-emails/route.ts:159-164`) feeds only
`after_state.client_class` in an `audit_logs` insert (`route.ts:172-182`) — the result,
`clientClass`, is never threaded into the `sendReviewRequestEmail(candidate.id, supabase)`
call two lines below it (`route.ts:166`), which takes no such argument to receive it
anyway.

**Quantified — exact count of distinct copy variants that exist today:**

- **10** distinct default sentence strings total that vary by `groupCategory`: 5 massage +
  5 cupping (`REVIEW_MASSAGE_VARIANT_1..5`, `REVIEW_CUPPING_VARIANT_1..5`,
  `templates-data.ts:325-384`). For any single booking, only one 5-item pool applies (its
  category, or massage if mixed/unknown), and 3 of those 5 are shown, chosen at random per
  send.
- **6** fields that do **not** vary by category (or by anything else): `subject`,
  `body_intro`, `body_ask`, `body_cta_label`, `body_cta_url`, `body_signoff` — one global
  default each (`templates-data.ts:253-305`, `736`).
- **0** fields that vary by client class today.

So: **1 existing variation dimension (`groupCategory`, 2-valued) applied to exactly one
part of the email (the 5-of-10 example pool)**, and it is a *selection* dimension (which
pool to draw from), not a *multiplication* of every field. If Step 1e's seam is built by
literally widening `pickReviewMessages`'s registry-key formula from `${category}_variant_${i}`
to `${category}_${clientClass}_variant_${i}` (i.e. crossing the existing 2-valued category
axis with the new 3-valued class axis on the *same* 5-slot pool), the field count for that
one part of the template goes from 10 to **2 × 3 × 5 = 30** — exactly the combinatorial
multiplication this task's brief warned against. See §7(a) for the full cost of that path.

---

## 6. `pickReviewMessages.test.ts` — what it asserts, count, what a class dimension would break

**File:** `src/lib/email/__tests__/pickReviewMessages.test.ts`, 129 lines.
**Test count — measured, not estimated:** `grep -c '  it(' src/lib/email/__tests__/pickReviewMessages.test.ts` → **6**.

The 6 tests (`it(...)` block names, verbatim):
1. `"massage, no overrides: picks 3 variants from the massage pool with {city} substituted"`
2. `"cupping, no overrides: picks 3 variants from the cupping pool"`
3. `"substitutes an override that lands in the picked set"`
4. `"falls back to the massage pool when groupCategory is null"`
5. `'strips " in {city}" cleanly when city is null'`
6. `"is deterministic for an injected random function"`

All 6 call `pickReviewMessages({ groupCategory, city, overrides, random: STABLE_RANDOM })`
— **none pass a `clientClass`/similar field**, because the function has no such
parameter today (§1). `STABLE_RANDOM = () => 0.5` (line 29) is chosen specifically because
`Array.prototype.sort` is spec-stable and a constant comparator never reorders, so the
picked 3 are always `variant_1..variant_3` in insertion order — several assertions
(`picked[0].text` at line 109, the ordered `MASSAGE_TEMPLATES.slice(0, 3)` comparison at
line 125) depend on that exact insertion order.

**What would break under each seam:**

- **§7(a)** (registry keys become `${category}_${clientClass}_variant_${i}`): every one of
  the 6 tests breaks. `fieldDefault("review_request_client", "massage_variant_1")` (the
  literal key every test's expectation is built against, via the locally-duplicated
  `MASSAGE_TEMPLATES`/`CUPPING_TEMPLATES` arrays at lines 8-22) would throw — that key no
  longer exists in the registry under this option — hitting `fieldDefault`'s explicit
  `throw new Error(...)` (`templates.ts:132-136`). Separately, if `clientClass` became a
  *required* argument on `PickReviewMessagesArgs`, all 6 calls would also fail to compile
  (`npx tsc --noEmit`) before ever running, since none of them supply it.
- **§7(b) and §7(c)** (new, separate field(s)/function, `pickReviewMessages` itself
  untouched): **0 of the 6 tests are affected.** Neither the function's signature, its
  registry keys, nor its return shape changes, so this file needs no edit and every
  existing assertion — including the exact-order ones — keeps passing byte-for-byte.

**A repo-level constraint that independently rules out touching this function:** the
implementation plan's own Batch-B verification gate (`redesign/plans/POST-BAND-C-FOLLOWUP-plan.md:346`)
states, quoted verbatim: *"item 1 does not edit `sendManualBookingReminder` (RECON-untouchable)
or `pickReviewMessages`, ... so these three files' test counts and pass status must be
byte-identical to baseline."* That sentence is written about "item 1" as a whole (Step 1e
is part of item 1), not scoped to Batch B alone — see the open question in §7 about
whether the plan's own §1.6 description of Step 1e (which points at `pickReviewMessages`
by name) is actually consistent with this gate.

---

## 7. Minimal seam options

All three keep `resolveTemplateOverrides`'s flat `Record<string, string>` shape and the
`overrides[key] || fieldDefault(...)` merge idiom from §3 unchanged — that mechanism is
generic over field key and needs no modification for any option below. All three also
require solving the same *upstream* gap first, common to (a)/(b)/(c) alike: **no caller of
`sendReviewRequestEmail` currently computes or passes a client class into it.**
`classifyReviewClient`'s inputs — `recurringTemplateId` and a per-client
`completedBookingCount` — are only assembled today by the cron route's batch queries
(`route.ts:146-152`), for its own audit-log write; `sendReviewRequestEmail`'s own booking
`select` (`notifications.ts:1526-1532`) does not fetch `recurring_template_id`, and it
never calls `getCompletedBookingCountsByClient`. Any of the three options below needs
either (i) the cron route to pass its already-computed class through as a new
`sendReviewRequestEmail` parameter, and the not-yet-built manual admin send (Batch B) to
compute and pass its own, or (ii) `sendReviewRequestEmail` computing the class itself
in-function. That decision is upstream of, and common to, all three copy-seam shapes
below — I list it once here rather than under each option.

### (a) Add `clientClass` to `pickReviewMessages` and cross it into the 5-slot pool

**Shape:** widen `PickReviewMessagesArgs` with `clientClass: ReviewClientClass | null`;
change the key formula at `templates.ts:841` from `` `${category}_variant_${i}` `` to
`` `${category}_${clientClass ?? "unclassified"}_variant_${i}` ``; add the corresponding
`REVIEW_<CATEGORY>_<CLASS>_VARIANT_<N>` consts and wire them into the `fields` array in
`templates-data.ts`.

- **Files touched:** `templates.ts` (args type + key formula), `templates-data.ts` (new
  field consts — see count below — plus the `fields` array), `notifications.ts` (thread
  `clientClass` into the `pickReviewMessages` call at line 1592 and onto
  `ReviewRequestEmailInput`), `registry-defaults.test.ts` /
  `render-parity-baseline.json` (the render-parity fixture's byte-identical assertion — §
  described in that file's header comment, `registry-defaults.test.ts:8-13` — would need
  deliberate re-capture, since new registry keys mean new `fieldDefault` reads even when
  `clientClass` is `null`/`"unclassified"`), `pickReviewMessages.test.ts` (all 6 tests, per
  §6).
- **Registry field growth:** 10 → **30** (2 categories × 3 classes × 5 slots) for this one
  part of the template — the exact multiplication §5 quantified and the task brief warned
  against.
- **Admin overrides still win?** Mechanically yes (same `||` idiom), but every admin who
  had already customised e.g. `massage_variant_1` has that override **silently orphaned**
  — the runtime key that field's row lives under (`massage_variant_1`) no longer matches
  any key `pickReviewMessages` reads (which would now be
  `massage_series_variant_1`/`massage_returning_variant_1`/`massage_first_time_variant_1`).
  That is a real backward-compatibility break for any already-saved override row, not just
  a cosmetic one.
- **Does `pickReviewMessages.test.ts` survive?** No — all 6 tests break (§6).
- **Plan-consistency note:** this is the literal reading of the plan's own §1.6 sentence
  (`POST-BAND-C-FOLLOWUP-plan.md:267`) — *"The natural seam already exists:
  `pickReviewMessages({ groupCategory, city, overrides })` inside `sendReviewRequestEmail`."*
  — taken as "extend this function's own pool." Per §6, that reading directly contradicts
  the plan's own Batch-B verification gate two sections later
  (`POST-BAND-C-FOLLOWUP-plan.md:346`), which requires `pickReviewMessages`'s test file to
  be untouched by item 1. **I cannot resolve this contradiction from the source — it is an
  open question, not a fact I can assert either way** (see the end of this section).

### (b) A separate, class-keyed sentence, rendered alongside the existing variants — `pickReviewMessages` untouched

**Shape:** 3 new registry fields (e.g. kinds `class_line_series` /
`class_line_returning` / `class_line_first_time`, one `defaultValue` each), added to the
`review_request_client.fields` array in `templates-data.ts` only — `REVIEW_MASSAGE_*` /
`REVIEW_CUPPING_*` untouched. A small new resolver in `templates.ts`, next to
`resolveReviewRequestFields`, using the identical `overrides[key] || fieldDefault(...)`
idiom keyed on `clientClass` instead of on a numbered loop — e.g. `overrides[`class_line_${clientClass}`]
|| fieldDefault(id, `class_line_${clientClass}`)`, with a `clientClass === null` branch
that renders nothing (so the render-parity fixture, which passes no `clientClass`, stays
byte-identical without a re-capture). `renderReviewRequestEmail`/`renderReviewRequestPlainText`
each gain one more resolved string and one more emitted line/paragraph, gated on that
`clientClass !== null` check.

- **Files touched:** `templates-data.ts` (+3 field consts, +3 entries in the `fields`
  array), `templates.ts` (+1 small resolver function; +1-2 lines each in
  `renderReviewRequestEmail` and `renderReviewRequestPlainText`; `ReviewRequestEmailInput`
  gains an optional `clientClass?: ReviewClientClass | null`), `notifications.ts` (thread
  the class value through to the two render calls, same shape as the existing
  `groupCategory`/`city` threading at lines 1576-1580 and 1592-1594) — plus whatever
  upstream class-computation change is needed per this section's opening paragraph.
  `pickReviewMessages` and its registry keys: **0 changes.**
- **Admin overrides still win?** Yes, same idiom, and with no backward-compat break —
  every existing override key (`massage_variant_1`, `body_ask`, …) is untouched; the 3 new
  keys are additive.
- **Does `pickReviewMessages.test.ts` survive?** Yes, unmodified — that function's
  signature, registry keys and behaviour are all untouched (§6).
- **Registry-defaults render-parity survives too, conditionally:** the render-parity test
  (`registry-defaults.test.ts:127-201`) calls `renderReviewRequestEmail(REVIEW_INPUT)` /
  `renderReviewRequestPlainText(REVIEW_INPUT, variants)` with the fixture `REVIEW_INPUT`
  (`__fixtures__/parity-sample-inputs.ts:85-89`, verbatim: `{ ...BASE_INPUT, groupCategory:
  "massage" as const, city: "Luton" }` — **no `clientClass` field**). For the baseline
  fixture JSON to stay byte-identical *without re-capture*, the new class-line must render
  as empty/absent whenever `input.clientClass` is `undefined`/`null` — i.e. the seam must
  be strictly additive/opt-in, not always-on. The same applies to `SAMPLE_REVIEW_INPUT` in
  `src/lib/email/sample-data.ts:104-108` (the "Send test"/preview path), which also has no
  `clientClass` field.

### (c) Vary an existing editable field (e.g. `body_ask`) by class, with a fallback to the current single default

**Shape:** add 3 new field kinds (e.g. `body_ask_series` / `body_ask_returning` /
`body_ask_first_time`) alongside — not replacing — the existing single `body_ask` field;
`resolveReviewRequestFields` gains a `clientClass` parameter and its `body_ask` line
becomes a 3-way lookup with the *current* single field as the ultimate fallback, e.g.
`overrides[`body_ask_${clientClass}`] || overrides.body_ask || fieldDefault(id,
`body_ask_${clientClass}`) || fieldDefault(id, "body_ask")` (exact fallback chain is an
editorial/product decision, not one this derivation should pre-empt — see the brief's
instruction not to propose approved final wording).

- **Files touched:** `templates-data.ts` (+3 field consts), `templates.ts`
  (`resolveReviewRequestFields` signature + the one field's resolution line;
  `renderReviewRequestEmail`/`renderReviewRequestPlainText` each pass `input.clientClass`
  through to `resolveReviewRequestFields` — 1 line each), `notifications.ts` (same
  class-threading requirement as (b)). `pickReviewMessages`: **0 changes.**
- **Admin overrides still win?** Yes, same idiom, and an admin who already customised
  `body_ask` keeps seeing their customised text for **every** class until/unless they also
  fill in a class-specific override — no orphaning, unlike (a).
- **Does `pickReviewMessages.test.ts` survive?** Yes, unmodified — different field
  entirely (§6).
- **Registry-defaults render-parity:** same conditional-survival note as (b) — needs
  `resolveReviewRequestFields`'s behaviour with `clientClass` absent/null to reduce
  exactly to today's single-`body_ask` output, or the fixture needs re-capture.
- **Difference from (b):** (b) adds a wholly new sentence (net-new copy, additive to the
  email); (c) *replaces* an existing sentence's content per class, closer to what the
  plan's own framing at `POST-BAND-C-FOLLOWUP-plan.md:267` describes in prose ("a standing
  client should not read the same '...first visit' line as a newcomer" — describing a
  *substituted* line, not an added one) even though that same sentence names
  `pickReviewMessages` as the mechanism, which is actually option (a)'s pool, not a
  body-field. This is itself a reason to treat the plan's §1.6 prose as directional intent
  ("vary this sentence's content by class") rather than a literal implementation pointer.

### Open question this derivation cannot resolve

The plan document contains what reads as an internal contradiction between §1.6 and
§1.11, and I could not find any resolution of it elsewhere in the plan:

- §1.6 (`POST-BAND-C-FOLLOWUP-plan.md:267`) names `pickReviewMessages(...)` as "the
  natural seam" for Step 1e.
- §1.11's Batch B gate (`POST-BAND-C-FOLLOWUP-plan.md:346`) states "item 1 does not edit
  ... `pickReviewMessages`" and requires that test file's pass count to be byte-identical
  to baseline.
- §1.11 defines exactly two batches (Batch A: cooldown/classification in
  `notifications.ts`/`route.ts`; Batch B: the manual-send UI) and a full-suite gate — **no
  batch or verification gate is defined anywhere for Step 1e itself**, and §1.12's "Tests
  to add" list (`POST-BAND-C-FOLLOWUP-plan.md:370-393`) has no Step-1e-specific test names
  either, only tests for the cooldown/classification/manual-send work.

I am reporting this as an open question for the Owner/implementer to resolve, not
resolving it myself: whichever of §7(a)/(b)/(c) is chosen, (a) is the only one that
actually conflicts with §1.11's explicit "do not edit `pickReviewMessages`" gate; (b) and
(c) both satisfy it by construction, at the cost of not being the literal function §1.6
names.
