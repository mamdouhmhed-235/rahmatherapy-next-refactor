// ⛔ GATE 08 P2 — STANDING (REPEAT) BOOKINGS. Cases E08-52R and E08-53R.
//
// ⚠️ THE IDS CARRY AN "R" ON PURPOSE. The workflow plan assigned E08-52/53 to
// recurring series, but `booking-reschedule.spec.ts` (session G) CONSUMED those
// four numbers for its own cases. Renumbering that shipped file would break every
// reference to it in the control documents, so the recurring cases take 52R/53R
// and the collision is recorded in RUN-STATUS rather than papered over.
//
// ── WHAT THIS IS, IN THE OWNER'S TERMS ────────────────────────────────────
//
// A regular client wants the same visit every week. Staff set that up once and
// the system books the next twelve weeks, then keeps rolling the schedule
// forward on its own overnight. Four questions:
//
//   1. Does ticking "Yes, repeat this booking" actually create the whole run of
//      visits, on the right dates, for the right money?
//   2. Is the "Send confirmation email to client" tick obeyed? (It was NOT,
//      once — a series used to email regardless. Fixed 2026-08-09. Nothing has
//      re-tested it since.)
//   3. Can a standing travel charge be added to the whole series without
//      touching a visit the client has ALREADY PAID FOR, or any past visit?
//   4. When the client stops, does cancelling the series clear the future
//      visits and LEAVE THE PAST ONES ALONE (they are the clinic's records)?
//
// ── ⛔ WHY THIS ONE MATTERS MORE THAN ITS SIZE SUGGESTS ───────────────────
//
// ⛔ `recurring_booking_templates` IS EMPTY IN PRODUCTION — measured, 0 rows,
// 0 bookings carrying a `recurring_template_id`. ⛔ THIS FEATURE HAS NEVER RUN
// FOR A REAL CUSTOMER. Nothing about it has ever been exercised outside unit
// tests, and its RLS policy was rewritten two commits ago (G-08-03 / D-038).
//
// ⚠️ It is also the one feature that keeps writing after the test ends: a live
// template is picked up by the nightly `extend-recurring-horizons` cron (03:00
// UTC) and materialises MORE visits forever, and those visits would then be
// mailed to the client by the `booking-reminders` cron (08:00 UTC). ⛔ THAT IS
// WHY THE TEARDOWN BELOW DELETES THE TEMPLATE ROW ITSELF and is unconditional.
//
// ── ⚠️ EMAIL — TRACED END TO END, NOT ASSUMED ────────────────────────────
//
// ⛔ ZERO mail reaches the real business inbox (`rahmatherapy@outlook.com`),
// and that is asserted here rather than believed. The whole path was traced:
//
//   * `createRecurringSeries` sends ONLY `sendRecurringSeriesCreatedEmail`,
//     `recipientRole: "customer"`, `to` = `clients.email`. It never calls
//     `resolveBusinessNotificationRecipients`.
//   * The visits are written by the `create_recurring_booking_series` RPC
//     DIRECTLY — they do NOT pass through `createBookingTransaction`, so
//     `sendBookingCreatedEmails` (which DOES reach the business inbox) never
//     fires. ⛔ This is the exact "one file does not prove the path" trap, so
//     it was checked in the RPC body, not inferred from the action.
//   * `cancelRecurringSeries` cascades with a BULK UPDATE on `bookings`, not
//     through `cancelBooking` — so `sendBookingCancellationEmails` (also a
//     business-inbox sender) never fires either.
//   * ⛔ THE DATABASE CANNOT SEND MAIL AT ALL: `pg_net`, `http` and `pg_cron`
//     are NOT INSTALLED (measured against production), and all 11 public
//     triggers are `updated_at`/`completed_at` housekeeping. No trigger, no RPC
//     and no policy can reach a mail provider.
//
// ⛔ AND THE ASSERTIONS ARE BUILT SO THEY CAN ACTUALLY FAIL (the E08-48d
// lesson). The fixture client HAS an email address, so the customer leg really
// sends and leaves a row — that row is the CONTROL proving the mail path ran at
// all. One future visit is ASSIGNED to the test therapist, so a stray
// assigned-staff send would land in `email_delivery_events` and be caught.
// ⛔ NEVER the Owner's staff id (`01582c5d-…`): their `staff_profiles.email` IS
// the real business inbox.
//
// **Measured cost of a full run: 2 outbound sends, both to an `@example.test`
// address that belongs to nobody. 0 to the business inbox. 0 to any human.**
//
// ── ⛔ WHAT THIS DELIBERATELY DOES NOT RE-TEST (D-023) ───────────────────
//
// The four-step wizard itself is already proven by `booking-create.spec.ts`.
// What is new here is the TOGGLE: ticking "repeat this booking" swaps the whole
// server action (`createManualBooking` -> `createRecurringSeries`) and posts a
// different set of hidden inputs. ⛔ That pairing between `RecurringSection`'s
// hidden inputs and `recurringSchema` is RUNTIME-ONLY — TypeScript cannot see
// it, and a rename on either side compiles clean and fails silently at the
// desk. A browser run through the real form is the only thing that pins it.
//
// ── Safety ────────────────────────────────────────────────────────────────
//
// ⛔ Approved to write by D-015. Every row is `ZZTEST-` + a run tag, and the
// unconditional afterAll sweeps by that tag as well as by collected id, so a
// failing assertion still cleans up (G-25). ⛔ Booking ids are collected BEFORE
// the template is deleted: `bookings_recurring_template_id_fkey` is
// ON DELETE SET NULL, so dropping the template first would silently cut every
// visit loose from the only handle that groups them.

import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { hasBaseUrl } from "./helpers";

const AUTH_DIR = "e2e/.auth";
const RUN_TAG = process.env.E2E_FIXTURE_TAG ?? String(process.pid);

/** ⛔ Measured, selected by id (handoff §8 — the name is a trap: a DIFFERENT
 *  account is called "Phase10 THERAPIST A"). Female, active, takes bookings. */
const THERAPIST_A_STAFF_ID = "884311b1-e9d0-44b9-91f3-14188a3baf59";
/** phase10.owner@example.test — the account the browser signs in as below. */
const OWNER_STAFF_ID = "b0f79294-74c0-40e6-8e5f-ade81c1d4d87";
/** ⛔ The REAL business inbox. Named here only so it can be asserted ABSENT. */
const REAL_BUSINESS_INBOX = "rahmatherapy@outlook.com";

/** Measured from production: active, allow_recurrence, no gender restriction. */
const SERVICE = {
  slug: "hijama-package",
  label: "Hijama Package",
  price: 45,
  durationMins: 60,
};

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Recurring-series fixtures need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
        "Run via `pnpm test:e2e`, which passes --env-file=.env.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function isoDaysFromToday(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function sessionFor(browser: import("@playwright/test").Browser, role: string) {
  const statePath = `${AUTH_DIR}/${role}.json`;
  if (!fs.existsSync(statePath)) {
    throw new Error(`${statePath} missing. Run: node scripts/mint-e2e-session.mjs --all --write`);
  }
  const context = await browser.newContext({ storageState: statePath });
  return { context, page: await context.newPage() };
}

/**
 * ⚠️ The City field drops its first keystroke (measured in booking-create).
 * Lifted verbatim rather than re-derived.
 */
async function typeVerified(page: Page, locator: ReturnType<Page["getByLabel"]>, value: string) {
  await locator.click();
  await locator.fill(value);
  if (((await locator.inputValue()) ?? "") !== value) {
    await locator.fill("");
    await locator.type(value, { delay: 30 });
  }
  await expect(locator).toHaveValue(value);
}

test.describe("gate 08 P2 — standing (repeat) bookings, E08-52R / E08-53R", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run.");
  test.describe.configure({ mode: "serial" });
  // ⛔ 420s, not the config default of 60s: these cases drive the whole
  // four-step wizard and wait on server actions that write four bookings at a
  // time. ⚠️ Set INSIDE each test — a describe-level setTimeout did NOT take
  // effect here (measured: the runner still reported the 60s default).
  const LONG = 420_000;

  const db = hasBaseUrl() ? serviceClient() : (null as unknown as SupabaseClient);

  /** ⛔ Every email assertion is scoped to rows created after this instant —
   *  the table already holds 38 historic rows and an unscoped query would read
   *  someone else's mail as this run's. */
  const startedAt = new Date().toISOString();

  const clientName = `ZZTEST-SERIES-${RUN_TAG}`;
  const clientEmail = `zztest-series-${RUN_TAG}@example.test`;
  const noMailClientName = `ZZTEST-SERIES-NOMAIL-${RUN_TAG}`;
  const noMailClientEmail = `zztest-series-nomail-${RUN_TAG}@example.test`;

  let clientId = "";
  let noMailClientId = "";
  let templateId = "";
  let noMailTemplateId = "";
  let firstDate = "";

  test.beforeAll(async () => {
    if (!hasBaseUrl()) return;
    for (const [name, email, target] of [
      [clientName, clientEmail, "main"],
      [noMailClientName, noMailClientEmail, "nomail"],
    ] as const) {
      const { data, error } = await db
        .from("clients")
        .insert({
          full_name: name,
          email,
          // The RPC REFUSES a client with no phone — "every booking requires"
          // one. Distinct per client so the duplicate-phone guard stays quiet.
          phone: `076${String((Number(RUN_TAG) + (target === "nomail" ? 7 : 0)) % 1_000_000).padStart(6, "0")}`,
          gender_preference: "female",
          address: "1 ZZTEST Street",
          postcode: "LU1 1AA",
          city: "Luton",
          // ⛔ NOT "admin" — `clients_client_source_check` rejects it while
          // `bookings_booking_source_check` allows it. The two look alike.
          client_source: "manual",
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`client fixture failed: ${error?.message}`);
      if (target === "main") clientId = (data as { id: string }).id;
      else noMailClientId = (data as { id: string }).id;
    }
  });

  test.afterAll(async () => {
    if (!hasBaseUrl()) return;

    // ⛔ Sweep by tag as well as by collected id — an id captured only after an
    // assertion is lost when that assertion fails (G-25).
    const { data: strayClients } = await db
      .from("clients")
      .select("id")
      .like("full_name", `ZZTEST-SERIES%-${RUN_TAG}`);
    const clientIds = [
      ...new Set([
        ...(clientId ? [clientId] : []),
        ...(noMailClientId ? [noMailClientId] : []),
        ...((strayClients ?? []) as { id: string }[]).map((c) => c.id),
      ]),
    ];

    // ⛔ COLLECT THE TEMPLATES AND THE VISITS BEFORE DELETING EITHER. The
    // bookings->template foreign key is ON DELETE SET NULL, so deleting a
    // template first would quietly orphan its visits.
    const templateIds = [
      ...new Set([
        ...(templateId ? [templateId] : []),
        ...(noMailTemplateId ? [noMailTemplateId] : []),
        ...(clientIds.length
          ? (
              ((
                await db
                  .from("recurring_booking_templates")
                  .select("id")
                  .in("client_id", clientIds)
              ).data ?? []) as { id: string }[]
            ).map((t) => t.id)
          : []),
      ]),
    ];

    const bookingIds = clientIds.length
      ? [
          ...new Set(
            (
              ((await db.from("bookings").select("id").in("client_id", clientIds)).data ??
                []) as { id: string }[]
            ).map((b) => b.id),
          ),
        ]
      : [];

    // ⛔ EVERY DELETE IS CHECKED, AND THE SWEEP IS RE-VERIFIED AT THE END.
    //
    // ⚠️ An independent review (D-035) caught this: the first version ignored
    // every `error`. That is not cosmetic here, because of the FOREIGN KEYS —
    // measured against production, not assumed:
    //   * `bookings_client_id_fkey`                   -> NO ACTION  (blocks)
    //   * `recurring_booking_templates_client_id_fkey`-> RESTRICT   (blocks)
    // So one silently-failed delete BLOCKS the rest of the chain, and the suite
    // would have reported all-green while leaving a LIVE recurring template in
    // production — which the nightly cron then materialises visits from for
    // ever. ⛔ That is the exact outcome this teardown exists to prevent, so it
    // now fails loudly instead.
    const failures: string[] = [];
    async function purge(
      label: string,
      run: () => PromiseLike<{ error: { message: string } | null }>,
    ) {
      const { error } = await run();
      if (error) failures.push(`${label}: ${error.message}`);
    }

    if (bookingIds.length > 0) {
      await purge("audit_logs(bookings)", () =>
        db.from("audit_logs").delete().in("target_id", bookingIds));
      await purge("booking_assignments", () =>
        db.from("booking_assignments").delete().in("booking_id", bookingIds));
      await purge("booking_items", () =>
        db.from("booking_items").delete().in("booking_id", bookingIds));
      await purge("booking_participants", () =>
        db.from("booking_participants").delete().in("booking_id", bookingIds));
      await purge("email_delivery_events(booking)", () =>
        db.from("email_delivery_events").delete().in("booking_id", bookingIds));
      await purge("bookings", () => db.from("bookings").delete().in("id", bookingIds));
    }

    // ⛔ The series emails carry `booking_id: null`, so the sweep above cannot
    // reach them. They are addressable only by recipient.
    await purge("email_delivery_events(recipient)", () =>
      db
        .from("email_delivery_events")
        .delete()
        .in("recipient_email", [clientEmail, noMailClientEmail]));

    if (templateIds.length > 0) {
      await purge("audit_logs(templates)", () =>
        db.from("audit_logs").delete().in("target_id", templateIds));
      // ⛔ The template row itself. A survivor is picked up by the nightly
      // extend-recurring-horizons cron and books visits forever.
      await purge("recurring_booking_templates", () =>
        db.from("recurring_booking_templates").delete().in("id", templateIds));
    }

    if (clientIds.length > 0) {
      await purge("client_notes", () =>
        db.from("client_notes").delete().in("client_id", clientIds));
      await purge("clients", () => db.from("clients").delete().in("id", clientIds));
    }

    // ⛔ THE PROOF, not the attempt. A delete can report success and still leave
    // rows if a filter was wrong, so the sweep is re-read rather than trusted.
    const { count: survivingTemplates } = await db
      .from("recurring_booking_templates")
      .select("id", { count: "exact", head: true })
      .in("client_id", clientIds.length ? clientIds : [ "00000000-0000-0000-0000-000000000000" ]);
    if (survivingTemplates) {
      failures.push(
        `${survivingTemplates} recurring_booking_templates row(s) SURVIVED — the nightly ` +
          `extend-recurring-horizons cron will keep creating visits from them.`,
      );
    }

    if (failures.length > 0) {
      throw new Error(
        `⛔ TEARDOWN INCOMPLETE — production may still hold test rows:\n  ${failures.join("\n  ")}`,
      );
    }
  });

  /**
   * Drives the real four-step wizard for an existing client and ticks the
   * repeat-visits toggle. Returns the date of the first visit.
   *
   * ⛔ Opened with `?clientId=` deliberately: `RecurringSection` DISABLES its
   * own checkbox without an existing client id ("Repeat visits need an existing
   * client"), so a series can only ever be started from a client's profile.
   */
  async function createSeriesThroughForm(
    page: Page,
    opts: { clientId: string; dayOffset: number; visits: number; sendEmail: boolean },
  ): Promise<string> {
    const bookingDate = isoDaysFromToday(opts.dayOffset);

    await page.goto(`/admin/bookings/new/?clientId=${opts.clientId}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { name: /New booking/i })).toBeVisible();

    const next = page.getByRole("button", { name: /^Continue$/ }).first();

    // ── Step 1 — contact. Prefilled from the client's profile; leaving it
    // untouched is itself the check that the prefill worked.
    await expect(page.getByLabel(/Full name/i)).not.toHaveValue("");
    await expect(next, "Continue should already be unlocked by the prefill").toBeEnabled();
    await next.click();

    // ── Step 2 — participant and service.
    await page.getByLabel(/gender/i).selectOption("female");
    await page.getByText(SERVICE.label, { exact: false }).first().click();
    await expect(next, "Continue should unlock once a package is chosen").toBeEnabled();
    await next.click();

    // ── Step 3 — location, date, time.
    await page.getByLabel(/Postcode/i).fill("LU1 1AA");
    await page.getByRole("combobox", { name: /Address/i }).fill("1 ZZTEST Street");
    await typeVerified(page, page.getByLabel(/^City/i), "Luton");

    const dateField = page.getByLabel(/^Date/i);
    await expect(dateField, "the date picker appears once city, gender and service are set")
      .toBeVisible();
    await dateField.fill(bookingDate);
    await page.waitForTimeout(2500);

    const timeButton = page.getByRole("button", { name: /^\d{1,2}:\d{2}/ }).first();
    await expect(timeButton, "a start time should be offered for a future date").toBeVisible();
    await timeButton.click();
    await page.waitForTimeout(1200);
    await expect(next, "Continue should unlock once a date and time are chosen").toBeEnabled();
    await next.click();

    // ── Step 4 — consent, the email tick, then the repeat toggle.
    await page
      .getByText(/I confirm that the client's details and consent have been obtained/i)
      .click();
    await page.waitForTimeout(300);

    // ⛔ Defaults to TICKED, and only renders because the client has an email.
    // Asserting the starting state first means an unticking that silently
    // no-ops cannot pass as a pass.
    const emailTick = page.getByLabel(/Send confirmation email to client/i);
    await expect(emailTick, "the email tick only renders when the client has an address")
      .toBeVisible();
    await expect(emailTick, "it starts ticked").toBeChecked();
    if (!opts.sendEmail) {
      await emailTick.uncheck();
      await expect(emailTick).not.toBeChecked();
    }

    const recurringTick = page.locator("#is_recurring");
    await expect(
      recurringTick,
      "the repeat toggle must be enabled — it is disabled without an existing client",
    ).toBeEnabled();
    await recurringTick.check();

    // "After a set number of visits" -> N.
    await page.getByRole("radio", { name: /After a set number of visits/i }).check();
    // getByLabel matches the RADIO too — its own accessible name contains
    // "number of visits". The role separates them.
    const countField = page.getByRole("spinbutton", { name: /Number of visits/i });
    await expect(countField).toBeVisible();
    await countField.fill(String(opts.visits));

    // ⛔ THE TELL THAT THE ACTION SWAPPED. The submit is a different control
    // now: "Create repeat visits", not "Submit booking request". If the toggle
    // failed to swap `formAction`, this label never changes and the post would
    // create ONE booking instead of a series.
    const submit = page.getByRole("button", { name: /Create repeat visits/i }).first();
    await expect(submit, "the submit should rename itself once repeats are on").toBeVisible();
    await expect(submit, "consent should have unlocked it").toBeEnabled();

    const answered = page.waitForResponse(
      (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
      { timeout: 180_000 },
    );
    await submit.click();
    await answered;
    await page.waitForURL(/\/admin\/bookings\/series\/[0-9a-f-]{36}/, { timeout: 60_000 });

    return bookingDate;
  }

  async function readTemplate(id: string) {
    const { data, error } = await db
      .from("recurring_booking_templates")
      .select(
        "id, client_id, cadence, end_type, end_count, travel_fee, created_by, cancelled_at, cancelled_by, cancelled_reason, horizon_through_date, anchor_start_time, participant_gender",
      )
      .eq("id", id)
      .single();
    if (error || !data) throw new Error(`could not read template ${id}: ${error?.message}`);
    return data as Record<string, string | number | null>;
  }

  async function readVisits(id: string) {
    const { data } = await db
      .from("bookings")
      .select(
        "id, booking_date, start_time, status, booking_source, total_price, amount_due, amount_paid, travel_fee, cancelled_at, recurring_template_id",
      )
      .eq("recurring_template_id", id)
      .order("booking_date", { ascending: true });
    return (data ?? []) as Array<Record<string, string | number | null>>;
  }

  /** Every email this run produced, newest last. `booking_id` is null for the
   *  series emails, so recipient/time is the only usable handle. */
  async function mailSince() {
    const { data } = await db
      .from("email_delivery_events")
      .select("event_type, recipient_email, recipient_role, delivery_status, created_at")
      .gte("created_at", startedAt)
      .order("created_at", { ascending: true });
    return (data ?? []) as Array<Record<string, string>>;
  }

  // ── E08-52Ra ────────────────────────────────────────────────────────────
  test("E08-52Ra — a weekly standing booking is created through the real form", async ({
    browser,
  }) => {
    test.setTimeout(LONG);
    const { context, page } = await sessionFor(browser, "owner");
    try {
      firstDate = await createSeriesThroughForm(page, {
        clientId,
        dayOffset: 21,
        visits: 5,
        sendEmail: true,
      });

      const match = /\/admin\/bookings\/series\/([0-9a-f-]{36})/.exec(page.url());
      expect(match, `expected a series URL, got ${page.url()}`).not.toBeNull();
      templateId = match![1];

      // ── ⛔ THE DATABASE FIRST (G-27). The screen is an opinion.
      const template = await readTemplate(templateId);
      expect(template.client_id, "the series belongs to the client it was opened from").toBe(
        clientId,
      );
      expect(template.cadence).toBe("weekly");
      expect(template.end_type).toBe("after_count");
      expect(Number(template.end_count)).toBe(5);
      expect(template.created_by, "the acting staff member is recorded").toBe(OWNER_STAFF_ID);
      expect(template.cancelled_at, "a brand-new series is not cancelled").toBeNull();
      // 12 weeks of materialisation, inclusive of the first day.
      expect(template.horizon_through_date).toBe(addDays(firstDate, 12 * 7 - 1));

      const visits = await readVisits(templateId);
      expect(visits, "five visits were asked for and five should exist").toHaveLength(5);
      expect(
        visits.map((v) => v.booking_date),
        "weekly means every seven days from the date chosen",
      ).toEqual([
        firstDate,
        addDays(firstDate, 7),
        addDays(firstDate, 14),
        addDays(firstDate, 21),
        addDays(firstDate, 28),
      ]);

      for (const visit of visits) {
        expect(visit.status, "a new series starts every visit as pending").toBe("pending");
        expect(visit.booking_source, "the source marks them as machine-made").toBe("recurring");
        expect(Number(visit.total_price), "each visit costs the service price").toBe(SERVICE.price);
        expect(Number(visit.amount_paid), "nothing is paid yet").toBe(0);
        expect(String(visit.start_time).slice(0, 5)).toBe(
          String(template.anchor_start_time).slice(0, 5),
        );
      }

      // Each visit is a complete booking, not a bare row — one person, one
      // service line, one (unfilled) therapist slot.
      const visitIds = visits.map((v) => v.id as string);
      for (const [table, column] of [
        ["booking_participants", "booking_id"],
        ["booking_items", "booking_id"],
        ["booking_assignments", "booking_id"],
      ] as const) {
        const { count } = await db
          .from(table)
          .select("id", { count: "exact", head: true })
          .in(column, visitIds);
        expect(count, `${table} should have one row per visit`).toBe(5);
      }

      const { data: openSlots } = await db
        .from("booking_assignments")
        .select("assigned_staff_id")
        .in("booking_id", visitIds);
      expect(
        ((openSlots ?? []) as { assigned_staff_id: string | null }[]).every(
          (a) => a.assigned_staff_id === null,
        ),
        "no therapist was chosen, so every visit should be an open request",
      ).toBe(true);

      const { data: audit } = await db
        .from("audit_logs")
        .select("action_type, after_state")
        .eq("target_id", templateId);
      const created = ((audit ?? []) as Array<{ action_type: string; after_state: Record<string, unknown> }>)
        .filter((row) => row.action_type === "recurring_series_created");
      expect(created, "the series creation is recorded once, not twice").toHaveLength(1);
      expect(Number(created[0].after_state.occurrence_count)).toBe(5);
      expect(Number(created[0].after_state.skipped_count)).toBe(0);

      // ── The customer was told, and NOBODY at the business was.
      const mail = await mailSince();
      const toCustomer = mail.filter((m) => m.recipient_email === clientEmail);
      expect(
        toCustomer.map((m) => m.event_type),
        "the client is emailed once about the new standing booking",
      ).toEqual(["recurring_series_created_client"]);
      // ⛔ Assert the STATUS, not the row's existence — `failed` and `skipped`
      // live in the same table.
      expect(toCustomer[0].delivery_status).toBe("accepted");

      expect(
        mail.filter((m) => m.recipient_email === REAL_BUSINESS_INBOX),
        "⛔ nothing about a standing booking may reach the business inbox",
      ).toEqual([]);
      expect(
        mail.filter((m) => m.recipient_role !== "customer"),
        "⛔ no staff or admin notification should exist for a series creation",
      ).toEqual([]);

      // ── Only now, what the operator sees.
      // ⛔ MEASURED, not guessed. The page HEADING is "Recurring booking ·
      // <service>"; the browser-tab title is "Recurring series" and they are
      // NOT the same string. Asserting the tab title against the heading is
      // what failed here first.
      await expect(
        page.getByRole("heading", { name: new RegExp(`Recurring booking.*${SERVICE.label}`, "i") }),
      ).toBeVisible();
      await expect(page.getByText(/View all 5 visits/i)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  // ── E08-52Rb ────────────────────────────────────────────────────────────
  test("E08-52Rb — unticking 'send confirmation email' actually stops the email", async ({
    browser,
  }) => {
    test.setTimeout(LONG);
    const { context, page } = await sessionFor(browser, "owner");
    try {
      // ⛔ A DIFFERENT CLIENT, and different dates. The RPC SKIPS an occurrence
      // when the same client already holds a live booking at that date and
      // time, so reusing the first client would silently produce a short series
      // and this case would be measuring the wrong thing.
      await createSeriesThroughForm(page, {
        clientId: noMailClientId,
        dayOffset: 24,
        visits: 2,
        sendEmail: false,
      });

      const match = /\/admin\/bookings\/series\/([0-9a-f-]{36})/.exec(page.url());
      expect(match, `expected a series URL, got ${page.url()}`).not.toBeNull();
      noMailTemplateId = match![1];

      // The series really was created — otherwise "no email" would be true for
      // the boring reason (⛔ the E08-48d trap).
      const visits = await readVisits(noMailTemplateId);
      expect(visits, "the series itself must still be created").toHaveLength(2);

      const mail = await mailSince();
      expect(
        mail.filter((m) => m.recipient_email === noMailClientEmail),
        "⛔ the operator unticked the box, so the client must NOT be emailed",
      ).toEqual([]);
      // The control: the FIRST client was emailed under identical machinery, so
      // an empty result here is the tick being obeyed, not the mailer being dead.
      expect(
        mail.filter(
          (m) =>
            m.recipient_email === clientEmail &&
            m.event_type === "recurring_series_created_client",
        ),
        "control — the ticked run in E08-52Ra did email its client",
      ).toHaveLength(1);
    } finally {
      await context.close();
    }
  });

  // ── E08-53Ra ────────────────────────────────────────────────────────────
  test("E08-53Ra — a standing travel charge skips paid and past visits", async ({ browser }) => {
    test.setTimeout(LONG);
    const visits = await readVisits(templateId);
    expect(visits, "E08-52Ra must have run first").toHaveLength(5);

    // ⛔ THE FIXTURE IS SHAPED SO EVERY BRANCH CAN FAIL — INDEPENDENTLY.
    //
    // ⚠️ An independent review (D-035) caught the first version: the only past
    // visit was ALSO `completed`, and `setSeriesTravelFee` excludes candidates
    // by TWO filters — `.in("status", ["pending","confirmed"])` AND
    // `.gte("booking_date", today)`. A visit that is both is excluded twice, so
    // ⛔ THE DATE GUARD COULD BE DELETED OUTRIGHT AND EVERY TEST STAYED GREEN.
    // Measured, not argued: I removed `.gte("booking_date", today)` from
    // `recurring-actions.ts` and all four cases still passed.
    //
    //  * visit 0 — PAST and COMPLETED. Proves a finished visit is untouched.
    //  * visit 1 — PAST but still PENDING. ⛔ THIS IS THE ONE THAT ISOLATES THE
    //    DATE GUARD: the status filter cannot explain it away, so only
    //    `.gte(booking_date, today)` keeps it out. It pins the same guard in
    //    E08-53Rb's cancel cascade too.
    //  * visit 2 — FULLY PAID. Without it, "already-paid visits are left alone"
    //    is a claim about a case that does not exist.
    //  * visit 3 — ASSIGNED to the test therapist, so any stray assigned-staff
    //    email in E08-53Rb lands in `email_delivery_events` and is caught.
    //  * visit 4 — plain future visit, the ordinary case.
    const pastDone = visits[0];
    const pastLive = visits[1];
    const paid = visits[2];
    const assigned = visits[3];
    const plain = visits[4];

    await db
      .from("bookings")
      .update({ booking_date: isoDaysFromToday(-7), status: "completed" })
      .eq("id", pastDone.id as string);
    // ⛔ Deliberately left `pending`. A past visit nobody closed off is also a
    // real state — the app leaves it exactly there when staff forget.
    await db
      .from("bookings")
      .update({ booking_date: isoDaysFromToday(-3) })
      .eq("id", pastLive.id as string);
    await db
      .from("bookings")
      .update({ amount_paid: SERVICE.price, payment_status: "paid", payment_method: "cash" })
      .eq("id", paid.id as string);

    const { data: assignmentRow } = await db
      .from("booking_assignments")
      .select("id, participant_id")
      .eq("booking_id", assigned.id as string)
      .single();
    await db
      .from("booking_assignments")
      .update({ assigned_staff_id: THERAPIST_A_STAFF_ID, status: "assigned" })
      .eq("id", (assignmentRow as { id: string }).id);
    await db
      .from("bookings")
      .update({ assignment_status: "fully_assigned" })
      .eq("id", assigned.id as string);

    const { context, page } = await sessionFor(browser, "owner");
    try {
      await page.goto(`/admin/bookings/series/${templateId}/`, { waitUntil: "domcontentloaded" });

      const feeField = page.getByLabel(/Travel charge per visit/i);
      await expect(feeField).toBeVisible();
      await feeField.fill("5");

      const save = page.getByRole("button", { name: /Save travel charge/i });
      const answered = page.waitForResponse(
        (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
        { timeout: 120_000 },
      );
      await save.click();
      await answered;
      await page.waitForTimeout(2500);

      // ── ⛔ THE DATABASE FIRST.
      const template = await readTemplate(templateId);
      expect(Number(template.travel_fee), "the series now carries a standing charge").toBe(5);

      const after = await readVisits(templateId);
      const byId = new Map(after.map((v) => [v.id as string, v]));

      const pastDoneAfter = byId.get(pastDone.id as string)!;
      expect(
        Number(pastDoneAfter.travel_fee),
        "⛔ a finished visit is financial history and must not move",
      ).toBe(0);
      expect(Number(pastDoneAfter.total_price)).toBe(SERVICE.price);

      // ⛔ THE ONE THAT PINS THE DATE GUARD. This visit is still `pending`, so
      // the status filter cannot be what spares it — only the date can. Without
      // this assertion, `.gte("booking_date", today)` can be deleted outright
      // from `setSeriesTravelFee` and the whole file stays green. ⚠️ Measured,
      // not argued: an independent review (D-035) predicted it and the probe
      // confirmed it — all four cases passed with the guard removed.
      const pastLiveAfter = byId.get(pastLive.id as string)!;
      expect(pastLiveAfter.status, "the fixture must still be live, or this proves nothing")
        .toBe("pending");
      expect(
        Number(pastLiveAfter.travel_fee),
        "⛔ a visit in the PAST is not re-priced, even when it is still open",
      ).toBe(0);
      expect(Number(pastLiveAfter.total_price)).toBe(SERVICE.price);

      const paidAfter = byId.get(paid.id as string)!;
      expect(
        Number(paidAfter.travel_fee),
        "⛔ a visit the client has already paid in full must not be re-priced",
      ).toBe(0);
      expect(Number(paidAfter.total_price)).toBe(SERVICE.price);

      for (const unpaid of [assigned, plain]) {
        const row = byId.get(unpaid.id as string)!;
        expect(Number(row.travel_fee), "an unpaid future visit takes the charge").toBe(5);
        expect(Number(row.total_price), "and the charge folds into what is owed").toBe(
          SERVICE.price + 5,
        );
        expect(Number(row.amount_due)).toBe(SERVICE.price + 5);
      }

      const { data: audit } = await db
        .from("audit_logs")
        .select("action_type, before_state, after_state")
        .eq("target_id", templateId);
      const feeRows = ((audit ?? []) as Array<{
        action_type: string;
        before_state: Record<string, unknown> | null;
        after_state: Record<string, unknown>;
      }>).filter((r) => r.action_type === "recurring_series_travel_fee_updated");
      expect(feeRows, "the repricing is recorded once").toHaveLength(1);
      expect(Number(feeRows[0].after_state.updated_occurrence_count)).toBe(2);
      expect(
        Number(feeRows[0].after_state.skipped_occurrence_count),
        "⛔ the paid visit is reported as SKIPPED, not silently ignored",
      ).toBe(1);

      // ── And the operator is told about the skip, which is the whole point.
      await expect(
        page.getByText(/2 upcoming visits updated, 1 already paid and left unchanged/i),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  // ── E08-53Rb ────────────────────────────────────────────────────────────
  test("E08-53Rb — cancelling the series clears the future and preserves the past", async ({
    browser,
  }) => {
    test.setTimeout(LONG);
    const before = await readVisits(templateId);
    expect(before, "E08-53Ra must have run first").toHaveLength(5);
    const today = isoDaysFromToday(0);
    const pastDone = before.find((v) => v.status === "completed");
    // ⛔ The past-but-still-OPEN visit. It is what makes "the past is preserved"
    // mean the DATE and not merely the STATUS — the cascade filters on both, so
    // a past visit that is also finished proves only half of it.
    const pastLive = before.find(
      (v) => v.status === "pending" && String(v.booking_date) < today,
    );
    expect(pastDone, "the fixture needs one completed past visit").toBeTruthy();
    expect(pastLive, "the fixture needs one PAST visit that is still open").toBeTruthy();

    const mailBefore = (await mailSince()).length;
    const reason = `ZZTEST client moved away ${RUN_TAG}`;

    const { context, page } = await sessionFor(browser, "owner");
    try {
      await page.goto(`/admin/bookings/series/${templateId}/`, { waitUntil: "domcontentloaded" });

      // ⛔ THE TRIGGER AND THE MODAL'S CONFIRM SHARE AN ACCESSIBLE NAME
      // ("Cancel entire series"). `.first()` would click the trigger twice and
      // assert nothing, so both clicks are scoped explicitly.
      const trigger = page.getByRole("button", { name: /^Cancel entire series$/ });
      await expect(trigger).toBeVisible();
      await trigger.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByText(/3 future occurrences will be cancelled/i),
        "the modal must count the future visits, not all of them",
      ).toBeVisible();

      await dialog.getByLabel(/Reason/i).fill(reason);

      const answered = page.waitForResponse(
        (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
        { timeout: 120_000 },
      );
      await dialog.getByRole("button", { name: /^Cancel entire series$/ }).click();
      await answered;
      await page.waitForTimeout(3000);

      // ── ⛔ THE DATABASE FIRST.
      const template = await readTemplate(templateId);
      expect(template.cancelled_at, "the series itself is closed").not.toBeNull();
      expect(template.cancelled_by).toBe(OWNER_STAFF_ID);
      expect(template.cancelled_reason).toBe(reason);

      const after = await readVisits(templateId);
      const byId = new Map(after.map((v) => [v.id as string, v]));

      expect(
        byId.get(pastDone!.id as string)!.status,
        "⛔ the visit that already happened stays completed — it is a clinic record",
      ).toBe("completed");

      // ⛔ AND THE ONE THAT PINS THE DATE GUARD. This visit is still `pending`,
      // so `.in("status", ["pending","confirmed"])` would happily sweep it up.
      // Only `.gte("booking_date", today)` spares it. Without this assertion
      // the date guard could be dropped from the cascade unnoticed.
      expect(
        byId.get(pastLive!.id as string)!.status,
        "⛔ a PAST visit is left exactly as it was, even when still open",
      ).toBe("pending");
      expect(byId.get(pastLive!.id as string)!.cancelled_at).toBeNull();

      const futures = after.filter(
        (v) => v.id !== pastDone!.id && v.id !== pastLive!.id,
      );
      expect(futures, "the three future visits").toHaveLength(3);
      for (const visit of futures) {
        expect(visit.status, "every future visit is cancelled").toBe("cancelled");
        expect(
          visit.cancelled_at,
          "and stamped, so the 28-day restore window applies like any other cancellation",
        ).not.toBeNull();
      }

      const { data: audit } = await db
        .from("audit_logs")
        .select("action_type, after_state")
        .eq("target_id", templateId);
      const cancelRows = ((audit ?? []) as Array<{
        action_type: string;
        after_state: Record<string, unknown>;
      }>).filter((r) => r.action_type === "recurring_series_cancelled");
      expect(cancelRows, "the cancellation is recorded once").toHaveLength(1);
      expect(Number(cancelRows[0].after_state.cascaded_occurrence_count)).toBe(3);
      expect(cancelRows[0].after_state.reason).toBe(reason);

      // ── Exactly one email, to the client, and none to the business.
      const mail = await mailSince();
      expect(mail.length, "exactly one new email").toBe(mailBefore + 1);
      const fresh = mail[mail.length - 1];
      expect(fresh.event_type).toBe("recurring_series_cancelled_client");
      expect(fresh.recipient_email).toBe(clientEmail);
      expect(fresh.delivery_status).toBe("accepted");

      expect(
        mail.filter((m) => m.recipient_email === REAL_BUSINESS_INBOX),
        "⛔ cancelling a series must not mail the business inbox",
      ).toEqual([]);
      // ⛔ NOT vacuous: one of the cancelled visits IS assigned to the test
      // therapist, so an assigned-staff send would have left a `staff` row.
      expect(
        mail.filter((m) => m.recipient_role === "staff"),
        "⛔ the assigned therapist is not individually emailed by a series cancellation",
      ).toEqual([]);

      // ── And the screen stops offering a cancel it can no longer do.
      await expect(
        page.getByText(/This series is cancelled\. Create a new series to resume/i),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: /^Cancel entire series$/ })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
