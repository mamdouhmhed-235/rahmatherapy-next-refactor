# C-01 — Google review request email (2h after completion)

**Type:** Band C plan-writing brief (C-B phase)
**Date written:** 2026-05-26
**Predecessors:**
- `redesign/plans/C-phase/C-B-DECISIONS.md` §2 Q4 + §3 C-01 (locked scope — URL, 10 variants, `email_template_overrides` infrastructure)
- `redesign/audits/C-A/W03-booking-lifecycle-flow.md` §11 (C-01 scoping deliverable — lift architecture verbatim)
- `redesign/audits/C-A/19-emails-audit.md` (existing emails surface context)
**Companion files:**
- Plan: `redesign/plans/C-phase/C-01-review-request-email-plan.md`
- Progress: `redesign/per-page-progress/C-01-review-request-email-progress.md` (filled during C-C)

---

## 0 — TL;DR

C-01 ships the first **operator-tooled customer-facing growth lever** in the admin: 2 hours after a booking is marked completed, the client gets a single, idempotent Google review email with **3 service-aware sample messages they can copy** (or write their own). The email is editable end-to-end via the existing `/admin/emails` template overrides UI — no new tables, no new admin surface.

**8 ship items:**
1. **Migration** — `bookings.completed_at` + `bookings.review_email_sent_at` columns + trigger to populate `completed_at` on status transition. Add `review_request_client` to the `email_event_type` allowed set (if constrained).
2. **Renderer** — `renderReviewRequestEmail(input)` in `src/lib/email/templates.ts` integrated with `resolveTemplateOverrides('review_request_client')` for the override-able fields.
3. **Variant picker** — `pickReviewMessages({ groupCategory, city, overrides, random })` returning 3 randomly-selected sample messages from the 5-variant pool keyed by `services.group_category` (`massage` | `cupping`).
4. **Send fn** — `sendReviewRequestEmail(bookingId, supabase)` in `src/lib/email/notifications.ts` with sentinel-guard idempotency via `bookings.review_email_sent_at` + `email_delivery_events` idempotency check.
5. **Scheduler** — **Cloudflare Workers cron, not pg_cron** (see §1.4 — deviation from C-B-DECISIONS Q4 driven by code discovery). New route `src/app/api/cron/review-emails/route.ts` mirroring `booking-reminders` pattern. New cron `*/15 * * * *` added to `wrangler.jsonc`. `worker-entrypoint.ts` extended to dispatch by `event.cron`.
6. **SUBJECTS map + templates-data registration** so the new template appears in `/admin/emails` Templates tab.
7. **Quiet-hours guard** — cron skips sending between 21:00 and 08:00 Europe/London (new open question surfaced during plan-writing — see §9.1).
8. **Audit log** — new action_type `review_email_sent`.

Net effect: the clinic gains a polite, low-friction, service-tailored review-request flow that's fully editable by the Owner via the existing template UI, and that loops in the right Google review URL with the right pre-filled message.

---

## 1 — Why this plan exists (and the infrastructure clarification)

### 1.1 The greenfield state (W03 B-116)

W03 §11 catalogued the gap: no `renderReviewRequestEmail`, no `sendReviewRequestEmail`, no scheduler, no sentinel column, no `review_request_client` event type, no audit type. **Everything is greenfield.** The C-01 architecture is W03 §11; this brief lifts it directly.

### 1.2 The decisions-doc lock (C-B-DECISIONS Q4)

URL: `https://g.page/r/Ccfwk27JycKDEBM/review`. 10 variants (5 massage + 5 cupping) editable via existing `email_template_overrides` infrastructure (no new schema). 3 picked randomly per email, `{city}` injected from `clients.city`. Trigger: `bookings.status='completed'` + 2h.

Confirmed at code level:
- `email_template_overrides` table exists with schema `(id, template_id, field_key, value, updated_by, updated_at)` (`mcp__supabase__execute_sql` returned the schema).
- `resolveTemplateOverrides(templateId)` exists at `src/lib/email/templates.ts:430`. Returns `Record<string, string>`. Silent fallback to empty object on error.
- `getAllTemplateOverrides()` at `:454` is the bulk variant used by the templates UI.
- `services.group_category` exists (text, nullable). Production values: `'cupping'` (3 services) and `'massage'` (2 services).

### 1.3 The completion code path is exercised RARELY in production

W03 noted: production `audit_logs` shows `booking_quick_complete` count = 1. The completion code path has been hit exactly once. **All future completions must trigger the C-01 review email** — there's no historical-backfill concern, but the trigger semantics must be airtight from day one.

### 1.4 The scheduler deviation from C-B-DECISIONS Q4

**C-B-DECISIONS Q4 said: "via pg_cron polling every 15 min".** This is incorrect for this codebase. Verified during plan-writing:

```sql
SELECT extname FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
-- → 0 rows. pg_cron is NOT installed.
```

The codebase **already has a cron infrastructure: Cloudflare Workers scheduled triggers**, used for the daily booking-reminders cron at 08:00 UTC. Pattern documented in `worker-entrypoint.ts` + `wrangler.jsonc` + `src/app/api/cron/booking-reminders/route.ts`.

**The correct path:** add C-01's review-email cron alongside booking-reminders in the same infrastructure. **No pg_cron enablement needed.** Cleaner, consistent with the existing project pattern.

**Deviation rationale documented in this brief §1.4 and inherited into plan §1 + master plan checklist.** The Q4 decision's cadence (15 min) is preserved; only the engine changes. Surfacing for user confirmation in §9.2.

### 1.5 The independent state-machines question (W03 B-129 + C-04a interaction)

W03 B-129 + brief §5.6 (C-04a) flagged that `bookings.status` and `booking_assignments.status` are independent. **C-04a's auto-promote** flips `bookings.status` to completed when ALL assignments are terminal. C-01's trigger fires off `bookings.status='completed'` regardless of how it got there (manual admin action, quick action, or C-04a auto-promote). One path, idempotent.

**Reopen of a completed booking** (C-04a Restore on a `completed` booking with force flag): per brief §5.6 (C-04a), the sentinel `review_email_sent_at` stays set — so when the booking is re-completed later, the C-01 sentinel check correctly blocks a duplicate review email.

---

## 2 — Scope (lifted from W03 §11 + C-B-DECISIONS Q4)

### 2.1 Migration

```sql
-- 1. New columns
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS review_email_sent_at timestamptz;

-- 2. Trigger to set completed_at on transition INTO 'completed' status
CREATE OR REPLACE FUNCTION public.bookings_set_completed_at() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.completed_at = now();
  ELSIF NEW.status <> 'completed' AND OLD.completed_at IS NOT NULL THEN
    -- On reopen (completed → other), preserve the historical completed_at
    -- so the C-04a un-complete audit trail stays consistent. The sentinel
    -- review_email_sent_at also stays — so re-completion doesn't re-fire
    -- the email.
    NEW.completed_at = OLD.completed_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_completed_at_trigger
  BEFORE UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_set_completed_at();

-- 3. (conditional) Add review_request_client to email_event_type if CHECK-constrained
-- Verify at pre-flight. If text-with-check: ALTER. If text-unconstrained: no-op.
```

**Backfill consideration:** any existing booking already at `status='completed'` (2 in production per W03 §1) has `completed_at IS NULL`. **Locked decision (Open Q resolved):** backfill those rows in the migration to `completed_at = updated_at`. Sentinel `review_email_sent_at` remains NULL — but per Step 4 the cron's WHERE clause limits to `completed_at >= now() - interval '7 days'` (see §2.4) so 2026-05 backfill rows don't trigger surprise sends from a 2024 booking.

Actually — looking at this more carefully: backfill `completed_at = updated_at` is risky if `updated_at` is much older than 2 hours ago, AND we want the cron to skip such rows. The cron's WHERE includes `review_email_sent_at IS NULL`, so backfilled rows ARE candidates unless we ALSO set `review_email_sent_at = updated_at` to mark them as "already-handled". **Better:** backfill `review_email_sent_at = completed_at` for historical rows, marking them as "we don't owe you an email". Document this clearly in the migration.

### 2.2 Renderer + variant picker

In `src/lib/email/templates.ts`, add (after the existing template renderers):

```ts
export interface ReviewRequestEmailInput extends BookingEmailTemplateInput {
  groupCategory: "massage" | "cupping" | null; // null for mixed-category bookings
  city: string | null;
}

export interface ReviewMessageVariant {
  text: string;
  source: "override" | "default";
}

interface PickReviewMessagesArgs {
  groupCategory: "massage" | "cupping" | null;
  city: string | null;
  overrides: Record<string, string>;
  random?: () => number;
}

const DEFAULT_REVIEW_VARIANTS = {
  massage: [
    "I had a brilliant home massage in {city} today — really professional setup, felt completely relaxed by the end.",
    "Booked a home massage with Rahma Therapy in {city}. The therapist was excellent, the experience felt like a proper clinic but in the comfort of home.",
    "Just had a fantastic massage at home in {city}. Highly skilled, deeply relaxing, and so easy not having to travel.",
    "Tried Rahma Therapy for a mobile massage in {city} — top quality. Will definitely book again.",
    "Excellent home massage experience in {city}. Calm, professional, and exactly what I needed.",
  ],
  cupping: [
    "Had a hijama session at home in {city} with Rahma Therapy. Very clean, hygienic, and the practitioner was knowledgeable and respectful.",
    "Booked hijama at home in {city} — proper Sunnah practice, sterile equipment, and a calming atmosphere. Highly recommend.",
    "Excellent home hijama appointment in {city}. Felt looked after from start to finish, the setup was spotless and professional.",
    "Tried Rahma Therapy for hijama in {city} and couldn't be happier. Knowledgeable practitioner, careful technique, and great aftercare.",
    "First hijama session in {city} and it was a brilliant experience. Clean, professional, and the practitioner explained every step.",
  ],
} as const;

export function pickReviewMessages(args: PickReviewMessagesArgs): ReviewMessageVariant[] {
  const { groupCategory, city, overrides, random = Math.random } = args;

  // Mixed-category booking (e.g., massage + hijama in one group) → use massage pool
  // as the safer default. Open Q §9.3 — could be made explicit per-participant.
  const category = groupCategory ?? "massage";

  const pool: ReviewMessageVariant[] = [];
  for (let i = 1; i <= 5; i++) {
    const key = `${category}_variant_${i}`;
    const overrideValue = overrides[key];
    if (overrideValue) {
      pool.push({ text: overrideValue, source: "override" });
    } else {
      pool.push({ text: DEFAULT_REVIEW_VARIANTS[category][i - 1], source: "default" });
    }
  }

  // Shuffle and pick 3
  const shuffled = [...pool].sort(() => random() - 0.5);
  const picked = shuffled.slice(0, 3);

  // Substitute {city} — strip the surrounding phrase if city is null
  return picked.map((variant) => ({
    ...variant,
    text: substituteCity(variant.text, city),
  }));
}

function substituteCity(text: string, city: string | null): string {
  if (city) return text.replace(/\{city\}/g, city);
  // City null: strip " in {city}" patterns cleanly (the only template-level
  // pattern in DEFAULT_REVIEW_VARIANTS). Falls back to the variant without
  // location grounding.
  return text.replace(/\s+in\s+\{city\}/g, "").replace(/\{city\}/g, "");
}

export function renderReviewRequestEmail(input: ReviewRequestEmailInput): Promise<string> {
  return (async () => {
    const overrides = await resolveTemplateOverrides("review_request_client");
    const variants = pickReviewMessages({
      groupCategory: input.groupCategory,
      city: input.city,
      overrides,
    });

    const fields = {
      subject: overrides.subject ?? "Thank you for visiting Rahma Therapy",
      body_intro: overrides.body_intro ?? "Thank you for choosing Rahma Therapy for your {service_name}. We hope you felt looked after from start to finish.",
      body_ask: overrides.body_ask ?? "If you have a moment, we'd be grateful for an honest review on Google. It helps other people in {city} find us.",
      body_cta_label: overrides.body_cta_label ?? "Leave a Google review",
      body_cta_url: overrides.body_cta_url ?? "https://g.page/r/Ccfwk27JycKDEBM/review",
      body_signoff: overrides.body_signoff ?? "Thank you again,\nThe Rahma Therapy team",
    };

    // Build vars map for substituteVars (existing helper at templates.ts:46)
    const vars = buildVarMap(input, {
      city: input.city ?? "",
      service_name: input.participants[0]?.services?.[0] ?? "appointment",
    });

    const intro = substituteVars(fields.body_intro, vars);
    const ask = substituteVars(fields.body_ask, vars);
    const signoff = substituteVars(fields.body_signoff, vars);

    return renderLayout(fields.subject, `
      <p>${escapeHtml(intro)}</p>
      <p>${escapeHtml(ask)}</p>

      <p style="margin-top:24px;font-weight:600;">Here are a few example reviews if you'd like a starting point — or write your own, whatever feels honest:</p>
      <ul style="padding-left:18px;">
        ${variants.map((v) => `<li style="margin-bottom:8px;">${escapeHtml(v.text)}</li>`).join("")}
      </ul>

      <p style="margin:24px 0;">
        <a href="${escapeHtml(fields.body_cta_url)}" style="display:inline-block;background:#0f5e8e;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          ${escapeHtml(fields.body_cta_label)}
        </a>
      </p>

      <p style="white-space:pre-line;">${escapeHtml(signoff)}</p>
    `);
  })();
}
```

(Imports `resolveTemplateOverrides`, `substituteVars`, `buildVarMap`, `renderLayout`, `escapeHtml` — all already in `templates.ts`.)

### 2.3 Send function

In `src/lib/email/notifications.ts`, add after `sendBookingReminderEmail`:

```ts
export async function sendReviewRequestEmail(
  bookingId: string,
  supabase: SupabaseClient
): Promise<{ sent: boolean; reason?: "no_email" | "already_sent" | "send_failed" }> {
  // Idempotency check — sentinel column
  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select("id, contact_email, completed_at, review_email_sent_at, status, clients(email, city)")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingErr || !booking) {
    throw new Error(`sendReviewRequestEmail: booking ${bookingId} not found.`);
  }
  if (booking.status !== "completed") {
    return { sent: false, reason: "send_failed" };  // status flipped between cron read and now
  }
  if (booking.review_email_sent_at) {
    return { sent: false, reason: "already_sent" };
  }

  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) {
    // Mark as "handled" — don't keep retrying a no-email booking
    await supabase
      .from("bookings")
      .update({ review_email_sent_at: new Date().toISOString() })
      .eq("id", bookingId);
    return { sent: false, reason: "no_email" };
  }

  const { booking: fullBooking, settings, input } = await getBookingTemplateInput(bookingId, supabase);

  // Derive groupCategory from booking_items via services
  const groupCategory = await deriveGroupCategoryForBooking(bookingId, supabase);

  const reviewInput: ReviewRequestEmailInput = {
    ...input,
    groupCategory,
    city: booking.clients?.city ?? null,
  };

  const html = await renderReviewRequestEmail(reviewInput);

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "review_request_client",
    recipientRole: "customer",
    to: customerEmail,
    subject: "Thank you for visiting Rahma Therapy",  // SUBJECTS map authoritative
    html,
    text: renderBookingPlainText("Thank you for visiting", input),
  });

  // Mark sentinel — atomic-ish update guarded by WHERE review_email_sent_at IS NULL
  // (defense against parallel cron ticks)
  const { data: marked } = await supabase
    .from("bookings")
    .update({ review_email_sent_at: new Date().toISOString() })
    .eq("id", bookingId)
    .is("review_email_sent_at", null)
    .select("id")
    .maybeSingle();

  if (!marked) {
    // Parallel cron tick already marked. The email may have been double-sent;
    // Sentry-log for monitoring but don't fail the request.
    console.warn(`sendReviewRequestEmail: sentinel race for booking ${bookingId}`);
  }

  return { sent: true };
}

async function deriveGroupCategoryForBooking(
  bookingId: string,
  supabase: SupabaseClient
): Promise<"massage" | "cupping" | null> {
  const { data: items } = await supabase
    .from("booking_items")
    .select("services(group_category)")
    .eq("booking_id", bookingId);

  const categories = new Set(
    (items ?? [])
      .map((item) => (item.services as { group_category: string | null } | null)?.group_category)
      .filter((cat): cat is string => cat === "massage" || cat === "cupping")
  );

  if (categories.size === 1) {
    return categories.has("massage") ? "massage" : "cupping";
  }
  // Mixed or unknown → null (variant picker falls back to massage pool per §9.3)
  return null;
}
```

### 2.4 Cron route

New file `src/app/api/cron/review-emails/route.ts`. Mirror `booking-reminders/route.ts` structure:

```ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendReviewRequestEmail } from "@/lib/email/notifications";

interface ReviewEmailSummary {
  candidates: number;
  sent: number;
  skipped_no_email: number;
  skipped_already_sent: number;
  skipped_quiet_hours: number;
  failed: number;
}

const QUIET_HOURS_START = 21; // 21:00 Europe/London
const QUIET_HOURS_END = 8;    // 08:00 Europe/London

function isQuietHourLondon(): boolean {
  const londonHour = parseInt(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
    10
  );
  return londonHour >= QUIET_HOURS_START || londonHour < QUIET_HOURS_END;
}

export async function POST(request: Request): Promise<Response> {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    Sentry.captureException(new Error("CRON_SECRET not configured."));
    return NextResponse.json({ error: "Server misconfigured.", summary: empty() }, { status: 500 });
  }
  if (request.headers.get("X-Cron-Secret") !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized.", summary: empty() }, { status: 401 });
  }

  const summary = empty();

  // Quiet-hours guard — return early without claiming candidates
  if (isQuietHourLondon()) {
    return NextResponse.json({ summary, skipped_reason: "quiet_hours" }, { status: 200 });
  }

  const supabase = createSupabaseAdminClient();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error: queryErr } = await supabase
    .from("bookings")
    .select("id")
    .eq("status", "completed")
    .is("review_email_sent_at", null)
    .gte("completed_at", sevenDaysAgo)  // don't email about ancient completions
    .lte("completed_at", twoHoursAgo)    // 2-hour delay enforced
    .limit(50);                          // batch size cap

  if (queryErr) {
    Sentry.captureException(queryErr);
    return NextResponse.json({ error: queryErr.message, summary }, { status: 500 });
  }

  summary.candidates = candidates?.length ?? 0;

  for (const candidate of candidates ?? []) {
    try {
      const result = await sendReviewRequestEmail(candidate.id, supabase);
      if (result.sent) {
        summary.sent++;

        // Audit log row — review_email_sent action_type
        await supabase.from("audit_logs").insert({
          action_type: "review_email_sent",
          target_type: "bookings",
          target_id: candidate.id,
          after_state: {
            booking_id: candidate.id,
            automated: true,
            cron_trigger: "review-emails-15min",
          },
        });
      } else if (result.reason === "no_email") {
        summary.skipped_no_email++;
      } else if (result.reason === "already_sent") {
        summary.skipped_already_sent++;
      } else {
        summary.failed++;
      }
    } catch (error) {
      summary.failed++;
      Sentry.captureException(error);
    }
  }

  return NextResponse.json({ summary }, { status: 200 });
}

function empty(): ReviewEmailSummary {
  return {
    candidates: 0,
    sent: 0,
    skipped_no_email: 0,
    skipped_already_sent: 0,
    skipped_quiet_hours: 0,
    failed: 0,
  };
}
```

### 2.5 wrangler.jsonc + worker-entrypoint.ts

`wrangler.jsonc` — append the new cron trigger:

```jsonc
"triggers": {
  "crons": [
    "0 8 * * *",          // existing: daily booking-reminders at 08:00 UTC
    "*/15 * * * *"        // new: every 15 min, review-emails cron
  ]
}
```

`worker-entrypoint.ts` — extend `scheduled()` to dispatch by `event.cron`:

```ts
async scheduled(event, env, ctx) {
  if (event.cron === "0 8 * * *") {
    ctx.waitUntil(fireBookingReminders(env));
  } else if (event.cron === "*/15 * * * *") {
    ctx.waitUntil(fireReviewEmails(env));
  } else {
    console.warn(`[scheduled] unknown cron: ${event.cron}`);
  }
}

async function fireReviewEmails(env: CronEnv): Promise<void> {
  // Same pattern as fireBookingReminders — POST to /api/cron/review-emails with X-Cron-Secret
}
```

### 2.6 SUBJECTS map + templates-data registration

`src/app/admin/email-templates/actions.ts:68-78` — add to SUBJECTS map:

```ts
const SUBJECTS: Record<string, string> = {
  // existing entries...
  review_request_client: "Thank you for visiting Rahma Therapy",
};
```

`src/app/admin/emails/components/templates-data.ts` — add a new `TemplateMeta` entry to the `TEMPLATES` array. Fields include the 6 shared fields (subject, body_intro, body_ask, body_cta_label, body_cta_url, body_signoff) PLUS the 10 variant fields (massage_variant_1..5 + cupping_variant_1..5).

Note for plan: the templates UI may need adjustment to render 16+ editable fields cleanly. The variant fields could be grouped under a collapsible "Sample review variants" section. UX detail for plan.

### 2.7 Audit log type

New `action_type: "review_email_sent"`. Code constant (no schema change required — `audit_logs.action_type` is unconstrained text per the C-06 pre-flight finding). Add to the `AUDIT_PHRASING` map in `clients/[clientId]/page.tsx:127-138`:

```ts
review_email_sent: "Review request email sent",
```

---

## 3 — RBAC matrix (C-01 actions × roles)

C-01 introduces no new permissions. The existing matrix governs:

| Action | Owner | Admin | Booking Coord | Therapist |
|---|---|---|---|---|
| Receive review email (recipient) | n/a | n/a | n/a | n/a — emails go to the client only |
| Edit the review template (subject, body fields, variants) | ✅ via `manage_email_templates` | ✅ via `manage_email_templates` | ❌ | ❌ |
| Trigger the cron manually (smoke test) | n/a — cron is server-only; uses `CRON_SECRET` not user auth | same | same | same |
| See `review_email_sent` rows in audit log | ✅ | ✅ | ✅ if `MANAGE_AUDIT_LOGS` granted | ❌ |
| Inspect `email_delivery_events` row for a booking | ✅ | ✅ | ✅ if `view_email_logs` granted | ❌ |

Cron trigger is gated by `CRON_SECRET` matching, not user auth.

---

## 4 — Layout strategy

### 4.1 Email layout

Uses the existing `renderLayout(title, body)` HTML scaffold (`templates.ts:105`). Body sequence:

1. **Greeting / thanks paragraph** — substituted intro (`body_intro` field, default copy honours `{service_name}`).
2. **The ask** — `body_ask` paragraph with `{city}` substitution.
3. **Sample reviews** — 3 picked variants in a `<ul>` with framing copy: *"Here are a few example reviews if you'd like a starting point — or write your own, whatever feels honest:"*. Each variant is one `<li>`.
4. **CTA button** — `body_cta_label` text linking to `body_cta_url`.
5. **Signoff** — `body_signoff` text.

Plain-text fallback uses the existing `renderBookingPlainText("Thank you for visiting", input)` pattern. The 3 review samples render as bulleted text in the plain-text version too (separate plain-text renderer if the existing helper doesn't include them — decided at impl time).

### 4.2 Admin `/admin/emails` Templates tab integration

The new template appears in the Templates tab alongside the 9 existing templates. Click to expand reveals 16 editable fields. Grouped layout (recommended in plan):

```
SHARED FIELDS
[Subject              ] Thank you for visiting Rahma Therapy
[Body intro           ] Thank you for choosing Rahma Therapy for your {service_name}...
[Body ask             ] If you have a moment, we'd be grateful for an honest review on Google...
[Body CTA label       ] Leave a Google review
[Body CTA URL         ] https://g.page/r/Ccfwk27JycKDEBM/review
[Body signoff         ] Thank you again, The Rahma Therapy team

SAMPLE VARIANTS — MASSAGE
[Massage variant 1    ] I had a brilliant home massage in {city} today...
[Massage variant 2    ] Booked a home massage with Rahma Therapy in {city}...
[Massage variant 3    ] ...
[Massage variant 4    ] ...
[Massage variant 5    ] ...

SAMPLE VARIANTS — CUPPING
[Cupping variant 1    ] Had a hijama session at home in {city} with Rahma Therapy...
[Cupping variant 2..5 ] ...
```

A small explainer paragraph above the variants:

> *"3 of the 5 variants are picked at random per email send. `{city}` is replaced with the client's city automatically (or removed gracefully if the client has no city on file)."*

---

## 5 — States & edge cases

### 5.1 Client has no email on file

`sendReviewRequestEmail` marks `review_email_sent_at = now()` as a "handled" sentinel and returns `{ sent: false, reason: "no_email" }`. The cron summary increments `skipped_no_email`. The booking won't be re-tried on future cron ticks.

### 5.2 Client has no city on file

`substituteCity` strips the surrounding phrase (" in {city}") cleanly. Variant remains grammatically correct. No `{city}` placeholder leaks into the email body.

### 5.3 Mixed-category booking (massage + cupping in one group)

`deriveGroupCategoryForBooking` returns `null` when more than one category is present. `pickReviewMessages` falls back to the `massage` pool (per §2.2 default). **Locked decision (Open Q §9.3):** the massage fallback is safer than cupping for a generic group — massage-language reviews are appropriate for any visit.

Alternative considered: send one email per service-category. Rejected — adds complexity, multiple emails feel spammy.

### 5.4 Booking reopened (completed → confirmed) after sentinel set

Per brief §1.5: the sentinel `review_email_sent_at` stays set. When the booking is re-completed later, the cron's WHERE includes `review_email_sent_at IS NULL` — already-sent bookings are excluded. No duplicate email.

### 5.5 Booking completed during quiet hours (21:00–08:00)

`completed_at` records the actual completion. The cron's `*/15` schedule keeps firing during quiet hours but returns early with `skipped_reason: "quiet_hours"`. When 08:00 hits, the cron picks up the candidate. **The delay is 2h + (next non-quiet cron tick)** = up to 2h 15min + quiet-hour padding. Acceptable.

Example: booking completed at 19:30. `completed_at = 19:30`. Cron at 21:30 sees the candidate (`completed_at < now() - 2h`) but quiet-hours guard skips. Cron at 08:15 next morning picks it up. Email sent ~13 hours after completion. Reasonable.

### 5.6 Cron fires multiple times (parallel ticks or retry storm)

Cloudflare Workers cron typically fires once per cadence, but Cloudflare's at-least-once semantics could theoretically double-fire. Mitigations:
- `review_email_sent_at IS NULL` WHERE clause in the SELECT
- Atomic UPDATE WHERE clause: `.eq("id", bookingId).is("review_email_sent_at", null)`
- If the second tick's UPDATE affects 0 rows, log a warning (the first tick won). No duplicate audit row.
- `email_delivery_events` row from `sendTrackedEmail` is the additional defensive layer (it logs the actual send).

### 5.7 Booking with `completed_at` more than 7 days ago

Cron's `.gte("completed_at", sevenDaysAgo)` excludes ancient completions. Rationale: a 7-day window is enough for the 2h trigger; if Cloudflare cron was down for >7 days, we genuinely missed the window — sending a "thank you for visiting!" email weeks after the visit is weird. Skipped silently.

### 5.8 Owner test account is not a real customer

The Owner test account `rahmatherapy@outlook.com` is the clinic's actual email. **Don't send the Owner test bookings into the review-email queue.** Migration consideration: backfill `review_email_sent_at = completed_at` for bookings whose `contact_email = rahmatherapy@outlook.com` (or attach to test client patterns). Plan §0 pre-flight handles this.

Better long-term: a dev-mode env var `REVIEW_EMAIL_SUPPRESS_LIST` carrying emails to skip. Out of C-01 scope; defensive backfill is enough.

### 5.9 Cron auth failure

`X-Cron-Secret` mismatch → 401 immediate return, no DB work, no Sentry exception (just an unauthenticated request — common during port scans).

### 5.10 No services rows for the booking (impossibility?)

`deriveGroupCategoryForBooking` returns `null` if no rows or all NULL group_categories. Falls back to massage variants. Edge case unlikely (every booking has at least one `booking_items` row) but defensively handled.

---

## 6 — Migration footprint

Per §2.1 above. **Zone-2 operation** — explicit user confirmation per migration. C-C plan executes via `mcp__supabase__apply_migration`.

**Backfill statements** in the same migration:
```sql
-- Backfill completed_at on the 2 existing completed bookings
UPDATE public.bookings
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;

-- Mark them as "handled" so the cron doesn't email about old completions
UPDATE public.bookings
SET review_email_sent_at = completed_at
WHERE status = 'completed' AND review_email_sent_at IS NULL;
```

**Verify post-migration:**
```sql
SELECT COUNT(*) FROM bookings
WHERE status = 'completed'
  AND (completed_at IS NULL OR review_email_sent_at IS NULL);
-- Expected: 0 rows (all historical completions handled)
```

**No new permissions.** No `email_template_overrides` schema change — the existing table accepts arbitrary `(template_id, field_key)` pairs.

**Conditional:** if `email_delivery_events.event_type` has a CHECK constraint, append `'review_request_client'` to the allowed set. Verified in pre-flight (same check as C-04a).

---

## 7 — Files touched (preview — full list in plan)

### NEW (3 files)
- `src/app/api/cron/review-emails/route.ts` — the cron handler
- `src/lib/email/__tests__/pickReviewMessages.test.ts` — unit coverage for variant picker
- `supabase/migrations/<ts>_c01_review_email_infrastructure.sql` — single migration

### EDITED (~6 files)
- `src/lib/email/templates.ts` — + `renderReviewRequestEmail`, `pickReviewMessages`, `DEFAULT_REVIEW_VARIANTS`, `substituteCity`
- `src/lib/email/notifications.ts` — + `sendReviewRequestEmail`, `deriveGroupCategoryForBooking`
- `src/app/admin/email-templates/actions.ts` — + `review_request_client` entry in SUBJECTS
- `src/app/admin/emails/components/templates-data.ts` — + new `TemplateMeta` entry with 16 editable fields
- `src/app/admin/clients/[clientId]/page.tsx` — + `review_email_sent` entry in `AUDIT_PHRASING`
- `worker-entrypoint.ts` — branch `scheduled()` on `event.cron`, + `fireReviewEmails(env)` helper
- `wrangler.jsonc` — append `*/15 * * * *` to the `triggers.crons` array

### UNCHANGED (do NOT touch)
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix.
- B-1 primitives, middleware, build configs.
- Existing cron handler `src/app/api/cron/booking-reminders/route.ts` — surgical changes only to the worker-entrypoint dispatch layer.

---

## 8 — Sequencing and dependencies

**No hard dependencies on prior C-NN plans.** C-01 ships independently. But:

- **C-04a** introduces `bookings.status` transitions via Restore + auto-promote. C-01's trigger (status=completed) inherits cleanly — auto-promote produces a valid `completed_at` via the new trigger.
- **C-06's `bookings.deleted_at`** (if landed): the cron SELECT doesn't filter `deleted_at IS NULL` today. **Adding the filter is safe** — a soft-deleted client's bookings shouldn't trigger review emails. Plan §1 includes the filter null-safely.

**Cross-plan coordination:**
- C-04a + C-01: a booking reopened after the review email was already sent stays sentinel-protected. No duplicate send.
- C-08 (per Q7 decision): C-08 ships 5 OTHER templates (assignment, client_assigned_therapist, booking_confirmed_client, staff_unassignment, claim). `review_request_client` ships HERE in C-01 per Q7. No overlap.

---

## 9 — Open questions surfaced during plan-writing

**Q9.1 — Quiet hours boundary (NEW, surfaced by C-01).**

Locked in this brief at **21:00–08:00 Europe/London**. Reasoning: typical email-decency window for transactional follow-up emails. Adjustable in code constants `QUIET_HOURS_START` + `QUIET_HOURS_END`. **User override welcome** — could be 20:00–09:00 if more conservative, or removed entirely.

**Q9.2 — Cron engine deviation (Cloudflare Workers vs pg_cron).**

Locked in this brief at **Cloudflare Workers cron**, deviating from C-B-DECISIONS Q4's pg_cron recommendation. Reasoning: pg_cron is not installed (verified pre-flight); the codebase already has a Cloudflare Workers cron infrastructure pattern at `src/app/api/cron/booking-reminders/route.ts`. **The Q4 cadence (15 min) is preserved.** Plan §1 documents the deviation.

If the user prefers pg_cron, the deviation requires: (a) enable pg_cron Supabase extension (Zone-2), (b) write the polling function as a SQL stored procedure, (c) drop the Cloudflare Workers approach. **Not recommended** — adds parallel cron infrastructure.

**Q9.3 — Mixed-category booking variant pool selection.**

Locked at **massage pool fallback** when the booking spans both massage + cupping services (e.g., a couple booking gets one massage + one hijama). Reasoning: massage language is more neutral / broadly applicable than cupping-specific Sunnah phrasing. **Alternative considered:** send 2 emails (one per category). Rejected — multiple emails feel spammy.

**Q9.4 — `services.group_category` is nullable.**

If a service has `group_category = NULL` (today: none — all 5 services have values), the booking falls through to the massage fallback. Plan §1 documents.

**Q9.5 — Backfill strategy for the 2 existing completed bookings.**

Locked at "mark as handled" — set `review_email_sent_at = completed_at` for any pre-existing `status = 'completed'` row during the migration. Documented in §6.

**Q9.6 — Test account suppression.**

Locked at "backfill `review_email_sent_at` for any booking whose `contact_email` matches the Owner test account `rahmatherapy@outlook.com`". Defensive. If the Owner self-tests a real completion in production after C-01 ships, they'd get the email — fine for dogfooding.

**Q9.7 — Variant rotation determinism.**

Today: `pickReviewMessages` uses `Math.random()`. Random per-email. **Alternative:** deterministic rotation keyed on `bookingId` so repeat sends of the same booking pick the same variants. Not relevant given the sentinel guarantees one send per booking. Stick with random.

---

## 10 — Acceptance criteria (what "done" looks like)

A C-01 implementation is complete when:

1. **Migration applies cleanly** — `completed_at` + `review_email_sent_at` columns + trigger + backfill all succeed. No NULL `completed_at` on completed bookings post-migration.
2. **Email renders correctly** — preview via `/admin/email-templates/preview/review_request_client` shows the intro + ask + 3 sample variants + CTA + signoff. Substitution of `{city}` and `{service_name}` works.
3. **Variants editable end-to-end** — admin edits `massage_variant_3` via `/admin/emails` Templates tab → preview reflects the change → cron-sent email uses the override.
4. **Sentinel idempotency works** — manually triggering the cron route twice in a row for the same eligible booking produces exactly 1 `email_delivery_events` row + 1 `audit_logs` row.
5. **Quiet-hours guard works** — cron route returns `skipped_reason: "quiet_hours"` when invoked between 21:00–08:00 Europe/London.
6. **Cloudflare cron fires every 15 min** — verified via Cloudflare dashboard logs after first deploy.
7. **`worker-entrypoint.ts` dispatches correctly** — 08:00 UTC fires booking-reminders; `*/15` fires review-emails. No cross-wiring.
8. **End-to-end Playwright** — admin marks a test booking completed → wait 2h (or backdate `completed_at` for testing) → cron fires → client receives email → audit log + delivery log show the send.
9. **Static gates pass** — lint, tsc, vitest, build, bundle delta within budget.
10. **No regressions** — booking-reminders cron still fires daily at 08:00 UTC; existing 9 email templates render unchanged.
11. **Badar's `9d55ce2a`** untouched — it's a cancelled booking, won't trigger anyway.

---

## 11 — References

| Source | What it gives |
|---|---|
| `C-B-DECISIONS.md` §2 Q4 + §3 C-01 | URL + 10 variants + override-table reuse + 2h cadence |
| `W03-booking-lifecycle-flow.md` §11 | Complete C-01 architecture (lifted verbatim) |
| `19-emails-audit.md` | Existing emails surface — Templates tab + delivery log |
| `templates.ts:430` | `resolveTemplateOverrides` pattern |
| `templates.ts:46-82` | `substituteVars` + `buildVarMap` helpers to lift |
| `notifications.ts:341-429` | Email send-fn pattern (sendTrackedEmail wrapping) |
| `notifications.ts:520+` | `sendBookingReminderEmail` — the closest existing analogue |
| `src/app/api/cron/booking-reminders/route.ts` | Cron handler pattern (auth, idempotency, audit) |
| `worker-entrypoint.ts` | scheduled() dispatch + WORKER_SELF_REFERENCE pattern |
| `wrangler.jsonc` | Cron trigger config |
| `src/app/admin/email-templates/actions.ts:68-78` | SUBJECTS map |
| `src/app/admin/emails/components/templates-data.ts` | TemplateMeta registration |

---

## 12 — Out of scope (explicit non-goals)

- **Service-specific subject lines** — single shared subject. No A/B testing of subjects in C-01.
- **In-clinic variants** — all variants reference "home" / mobile setup per `HomeAppointmentProcess.tsx` (clinic is mobile-only). No clinic-based copy.
- **Resend per-event functionality** — C-08 ships the per-row Resend button on `/admin/emails`. C-01 doesn't add resend UI; admins re-trigger by clearing the sentinel via SQL (Zone-2) and waiting for the next cron tick.
- **Customer opt-out mechanism** — no unsubscribe link in C-01. Customers replying or contacting the clinic handle opt-outs manually. UK GDPR + PECR consideration for the broader compliance band — out of C-01 scope per master plan §130 ("Cupping/hijama-specific compliance is out of Band C scope").
- **Multi-language variants** — English-only.
- **Per-email click tracking / open tracking** — Resend's standard tracking applies; no custom tracking added.
- **Backfill of older completed bookings** — only the 2 existing rows handled (marked "already handled"). Older bookings without `completed_at` get the same treatment.
- **Variant performance reporting** — no "which variant was picked most often" analytics in C-01. The Resend dashboard + `email_delivery_events` table provide raw data if needed later.
- **Configurable cadence (per-clinic 2h vs 1h vs 24h)** — locked at 2h.
- **Configurable quiet hours via admin UI** — locked at code-level constants. UI-config is C-12+.

---

*End of C-01 brief. Plan file follows: `redesign/plans/C-phase/C-01-review-request-email-plan.md`.*
