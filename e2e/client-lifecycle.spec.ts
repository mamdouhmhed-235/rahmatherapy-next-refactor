// ⛔ GATE 08 PHASE P2 — CLIENT LIFECYCLE. Cases E08-54, E08-56, E08-57, E08-58,
// E08-60, and the finding FIND-08-A that fell out of writing them.
//
// P2 is the first phase whose rows are real and live long enough to be seen.
// Everything before it either read, or refused. This one creates clients,
// writes notes about them, and deletes them — through the actual forms a member
// of staff uses, not through the database.
//
// ── ⛔ WHY THIS PHASE MATTERS MORE THAN IT LOOKS ───────────────────────────
//
// Client notes are where the clinic's most sensitive data lives, and
// `client_notes.is_sensitive` is not a label — it is the ACCESS CONTROL. The
// client detail page issues two separate, separately-gated reads: one over
// `is_sensitive = false`, one over `is_sensitive = true`. Whatever sets that
// column decides who can ever read the note.
//
// ⛔ And the database cannot help here. `authenticated` gets SQLSTATE 42501 on
// `client_notes`, so its RLS policies are unreachable and every application read
// goes through the service-role client. The TypeScript permission layer is the
// only guard there is.
//
// ── Safety ────────────────────────────────────────────────────────────────
//
// ⛔ Approved to write by D-015. Every row is `ZZTEST-` prefixed with a per-run
// tag, and torn down by explicit id in an `afterAll` — unconditionally, so a
// failing assertion still cleans up. ⚠️ Deleting a client is a SOFT delete by
// design, so teardown hard-deletes the fixture rows afterwards.

import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { hasBaseUrl } from "./helpers";

const AUTH_DIR = "e2e/.auth";

// ⛔ Staff ids, measured. See HANDOFF-2026-08-20-C §4: `therapist_a.json` is
// `test.therapist@rahmatherapy.example.test`, NOT `phase10.therapist.a`.
const THERAPIST_A_STAFF_ID = "884311b1-e9d0-44b9-91f3-14188a3baf59";

const SERVICE = {
  id: "9e70c3fd-b551-465e-9d7b-822398b431d7",
  name: "Hijama Package",
  price: 45,
  durationMins: 60,
};

const RUN_TAG = process.env.E2E_FIXTURE_TAG ?? String(process.pid);

// ⛔ A PHONE NUMBER NO SEEDED CLIENT ALREADY HAS.
//
// Measured, after the first run of E08-54 created nothing at all. The cause was
// not a broken form: `07700900456` is already on TWO seeded clients, so the
// app's duplicate-client guard correctly refused to create a third and asked
// for confirmation instead. ⚠️ Good behaviour — it is what stops the same
// customer being entered twice — and it is now covered by its own case below
// rather than being worked around silently.
//
// The seeded numbers are all `070…`, `071…` and `077…`; this generates `079…`,
// unique per run, so an ordinary create is testing an ordinary create.
function uniquePhone(suffix: number) {
  const base = String(Number(RUN_TAG) % 1_000_000).padStart(6, "0");
  return `079${base}${String(suffix).padStart(2, "0")}`;
}

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "P2 fixtures need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
        "Run via `pnpm test:e2e`, which passes --env-file=.env.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function insertRow(db: SupabaseClient, table: string, row: Record<string, unknown>) {
  const { data, error } = await db.from(table).insert(row).select("id").single();
  // ⛔ Loud. A half-built fixture makes "the therapist was refused" pass for the
  // wrong reason.
  if (error || !data) throw new Error(`fixture insert into ${table} failed: ${error?.message}`);
  return (data as { id: string }).id;
}

function isoDaysFromToday(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

type ClientFixture = { clientId: string; name: string; bookingIds: string[] };

/** A client, optionally with bookings — each of a chosen status — assigned to Therapist A. */
async function createClientFixture(
  db: SupabaseClient,
  label: string,
  phoneSuffix: number,
  bookings: Array<{ status: string; dayOffset: number; assign: boolean }> = [],
): Promise<ClientFixture> {
  const name = `ZZTEST-${label}-${RUN_TAG}`;
  const clientId = await insertRow(db, "clients", {
    full_name: name,
    email: `zztest-${label.toLowerCase()}-${RUN_TAG}@example.test`,
    phone: uniquePhone(phoneSuffix),
    gender_preference: "female",
    postcode: "LU1 1AA",
    // ⛔ NOT "admin" — `clients_client_source_check` rejects it, while
    // `bookings_booking_source_check` allows it. The two look alike (G-19).
    client_source: "manual",
  });

  const bookingIds: string[] = [];
  for (const spec of bookings) {
    const bookingId = await insertRow(db, "bookings", {
      client_id: clientId,
      booking_date: isoDaysFromToday(spec.dayOffset),
      start_time: "10:00:00",
      end_time: "11:00:00",
      total_duration_mins: SERVICE.durationMins,
      total_price: SERVICE.price,
      status: spec.status,
      assignment_status: spec.assign ? "fully_assigned" : "unassigned",
      contact_full_name: name,
      contact_phone: uniquePhone(phoneSuffix),
      booking_source: "admin",
      consent_acknowledged: true,
      ...(spec.status === "completed" ? { completed_at: new Date().toISOString() } : {}),
    });
    const participantId = await insertRow(db, "booking_participants", {
      booking_id: bookingId,
      participant_gender: "female",
      required_therapist_gender: "female",
      is_main_contact: true,
      display_name: name,
      consent_acknowledged: true,
    });
    await insertRow(db, "booking_items", {
      booking_id: bookingId,
      booking_participant_id: participantId,
      service_id: SERVICE.id,
      service_name_snapshot: SERVICE.name,
      service_price_snapshot: SERVICE.price,
      service_duration_snapshot: SERVICE.durationMins,
    });
    if (spec.assign) {
      await insertRow(db, "booking_assignments", {
        booking_id: bookingId,
        participant_id: participantId,
        assigned_staff_id: THERAPIST_A_STAFF_ID,
        required_therapist_gender: "female",
        status: "assigned",
      });
    }
    bookingIds.push(bookingId);
  }

  return { clientId, name, bookingIds };
}

/** Hard-delete everything this run created, child-first, by explicit id. */
async function destroyByClientIds(db: SupabaseClient, clientIds: string[]) {
  if (clientIds.length === 0) return;
  const { data: bookings } = await db.from("bookings").select("id").in("client_id", clientIds);
  const bookingIds = ((bookings ?? []) as { id: string }[]).map((b) => b.id);
  if (bookingIds.length > 0) {
    await db.from("booking_assignments").delete().in("booking_id", bookingIds);
    await db.from("booking_items").delete().in("booking_id", bookingIds);
    await db.from("booking_participants").delete().in("booking_id", bookingIds);
    await db.from("email_delivery_events").delete().in("booking_id", bookingIds);
    await db.from("bookings").delete().in("id", bookingIds);
  }
  await db.from("client_notes").delete().in("client_id", clientIds);
  await db.from("clients").delete().in("id", clientIds);
}

async function sessionFor(browser: import("@playwright/test").Browser, role: string) {
  const statePath = `${AUTH_DIR}/${role}.json`;
  // ⛔ THROW, never skip. Without a session the browser is signed out, and a
  // signed-out browser is refused everywhere — which would make every
  // "was refused" assertion here pass while proving nothing.
  if (!fs.existsSync(statePath)) {
    throw new Error(
      `${statePath} is missing. Run: node scripts/mint-e2e-session.mjs --all --write`,
    );
  }
  const context = await browser.newContext({ storageState: statePath });
  return { context, page: await context.newPage() };
}

/** Open a client record and say what the app did. */
async function openClient(page: Page, clientId: string) {
  await page.goto(`/admin/clients/${clientId}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  if (/\/admin\/login/.test(page.url())) return "redirected-to-login" as const;
  // ⛔ The component marker, never the copy (E08-19's false SECURITY finding).
  if ((await page.locator("[data-admin-access-denied]").count()) > 0) return "denied" as const;
  if ((await page.getByRole("heading", { name: /not found/i }).count()) > 0) {
    return "not-found" as const;
  }
  // ⛔ THE NEXT.JS 404, WHICH IS WHAT THIS ROUTE ACTUALLY USES.
  //
  // Measured, after this classifier reported a therapist "rendered" an
  // unassigned client's page — a security-shaped claim, and false. The page
  // calls notFound(), and Next's 404 has `<h1>404</h1>` with the words "This
  // page could not be found" in the body. A heading matched against /not found/i
  // does not match "404", so a correct refusal was being read as access.
  //
  // ⚠️ That would have been the SEVENTH false finding of this run. Refusals
  // come in more shapes than one component, and a classifier that knows only
  // some of them fails towards "access granted" — the alarming direction.
  if ((await page.getByRole("heading", { name: /^404$/ }).count()) > 0) {
    return "not-found" as const;
  }
  return "rendered" as const;
}

/** Add a note through the real form. Returns true if the app accepted it. */
async function addNoteThroughUi(page: Page, clientId: string, note: string): Promise<string[]> {
  await page.goto(`/admin/clients/${clientId}/`, { waitUntil: "domcontentloaded" });
  const trigger = page.getByRole("button", { name: /^Add note for /i });
  await expect(trigger, "the Add note control should be on the client page").toBeVisible();
  await trigger.click();

  const field = page.locator('textarea[name="note"]');
  await expect(field).toBeVisible();
  await field.fill(note);

  // ⛔ Wait for the server action to answer, never a fixed sleep — G-13. A slow
  // reply would otherwise read as "the note was not saved", the reassuring
  // direction.
  const answered = page.waitForResponse(
    (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
    { timeout: 60_000 },
  );
  // ⛔ "Save note", measured from the markup — not "Add note", which is the
  // COLLAPSED trigger. Guessing the label cost a run.
  await page.getByRole("button", { name: /^Save note$/i }).click();
  await answered;
  await page.waitForTimeout(800);
  // ⛔ Return what the page SAID, and let the caller assert on what the
  // database DID. Inferring success from "no [role=alert] on the page" was
  // wrong twice over: the client page carries live regions of its own, so the
  // absence of an alert is not evidence of a save, and its presence is not
  // evidence of a failure. The note row is the fact.
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="alert"]'))
      .map((el) => (el.textContent || '').trim())
      .filter(Boolean),
  );
}

test.describe("gate 08 P2 — the client lifecycle, through the real forms", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  const db = hasBaseUrl() ? serviceClient() : (null as unknown as SupabaseClient);

  let assigned: ClientFixture;
  let unassigned: ClientFixture;
  let deletable: ClientFixture;
  const createdThroughUi: string[] = [];

  test.beforeAll(async () => {
    // The therapist has an assigned booking for this one, and none for the next.
    assigned = await createClientFixture(db, "Assigned", 1, [
      { status: "confirmed", dayOffset: 14, assign: true },
    ]);
    unassigned = await createClientFixture(db, "Unassigned", 2, []);
    // ⛔ D-014's fixture: one OPEN booking and one COMPLETED booking.
    deletable = await createClientFixture(db, "Deletable", 3, [
      { status: "confirmed", dayOffset: 21, assign: false },
      { status: "completed", dayOffset: -30, assign: false },
    ]);
  });

  test.afterAll(async () => {
    await destroyByClientIds(db, [
      assigned?.clientId,
      unassigned?.clientId,
      deletable?.clientId,
      ...createdThroughUi,
    ].filter(Boolean) as string[]);
  });

  test("E08-54 — the Owner creates a client through the real form", async ({ browser }) => {
    const { context, page } = await sessionFor(browser, "owner");
    const name = `ZZTEST-CreatedByOwner-${RUN_TAG}`;
    try {
      await page.goto("/admin/clients/new/", { waitUntil: "domcontentloaded" });
      await page.locator('input[name="full_name"]').fill(name);
      await page.locator('select[name="client_source"]').selectOption("phone");
      // Contact details supplied deliberately: leaving both blank opens a
      // "no contact details" confirmation dialog, which is a different case.
      await page.locator('input[name="email"]').fill(`zztest-owner-${RUN_TAG}@example.test`);
      await page.locator('input[name="phone"]').fill(uniquePhone(4));

      const answered = page.waitForResponse(
        (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
        { timeout: 60_000 },
      );
      await page.getByRole("button", { name: /^Create client$/i }).click();
      await answered;
      await page.waitForTimeout(1000);

      // ⛔ Confirm in the DATABASE, not on the screen. A success banner is the
      // app's opinion; the row is the fact.
      const { data: rows } = await db.from("clients").select("id, full_name, client_source")
        .eq("full_name", name);
      expect(rows ?? [], `no client row named ${name} was created`).toHaveLength(1);
      const created = (rows ?? [])[0] as { id: string; client_source: string };
      createdThroughUi.push(created.id);

      // The form's own value reached the row — not a default.
      expect(created.client_source).toBe("phone");

      // Every mutating admin action writes an audit row (invariant 21).
      const { data: audit } = await db.from("audit_logs")
        .select("id, action_type, actor_staff_id")
        .eq("target_id", created.id)
        .eq("action_type", "client_created");
      expect(audit ?? [], "creating a client must write an audit row").toHaveLength(1);
      expect((audit ?? [])[0], "the audit row must name who did it").toHaveProperty(
        "actor_staff_id",
      );
    } finally {
      await context.close();
    }
  });

  test("E08-54b — the duplicate-client guard warns, refuses, and can be overridden", async ({
    browser,
  }) => {
    // ⛔ FOUND BY OBSERVATION, not planned. The first run of E08-54 created no
    // row at all, and the cause was not a broken form: the phone number was
    // already on two seeded clients, so this guard refused and asked for
    // confirmation. It is a real business protection — it is what stops the same
    // customer being entered twice and their history splitting in half — and
    // nothing tested it.
    const { context, page } = await sessionFor(browser, "owner");
    const name = `ZZTEST-Duplicate-${RUN_TAG}`;
    try {
      const fill = async () => {
        await page.goto("/admin/clients/new/", { waitUntil: "domcontentloaded" });
        await page.locator('input[name="full_name"]').fill(name);
        await page.locator('select[name="client_source"]').selectOption("phone");
        // ⛔ The SAME phone E08-54 just used, so this is a genuine duplicate of a
        // client this run created rather than of unrelated seed data.
        await page.locator('input[name="phone"]').fill(uniquePhone(4));
      };

      const submit = async () => {
        const answered = page.waitForResponse(
          (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
          { timeout: 60_000 },
        );
        await page.getByRole("button", { name: /^Create client$/i }).click();
        await answered;
        await page.waitForTimeout(800);
      };

      // ── First attempt: must WARN and must NOT create ──────────────────────
      await fill();
      await submit();

      await expect(
        page.getByText(/possible duplicate client/i),
        "a duplicate phone should raise the duplicate warning",
      ).toBeVisible();

      const { data: afterWarn } = await db.from("clients").select("id").eq("full_name", name);
      // ⛔ The assertion that matters. A warning that still creates the row is
      // not a guard, and the banner alone cannot tell you which happened.
      expect(afterWarn ?? [], "the duplicate warning must not create the client").toHaveLength(0);

      // ── Second attempt: acknowledge, and it must go through ───────────────
      await page.locator('input[name="confirm_duplicate"]').check();
      await submit();

      const { data: afterConfirm } = await db.from("clients").select("id").eq("full_name", name);
      expect(
        afterConfirm ?? [],
        "acknowledging the duplicate should create the client",
      ).toHaveLength(1);
      createdThroughUi.push(((afterConfirm ?? [])[0] as { id: string }).id);
    } finally {
      await context.close();
    }
  });

  test("E08-56 — an Owner's note is stored as SENSITIVE, and the audit row says so", async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, "owner");
    const note = `ZZTEST-ownernote-${RUN_TAG}`;
    try {
      const alerts = await addNoteThroughUi(page, assigned.clientId, note);

      const { data: notes } = await db.from("client_notes")
        .select("id, note, is_sensitive, author_staff_id")
        .eq("client_id", assigned.clientId).eq("note", note);
      expect(
        notes ?? [],
        `the owner's note was not saved. Page alerts: ${JSON.stringify(alerts)}`,
      ).toHaveLength(1);
      const saved = (notes ?? [])[0] as { id: string; is_sensitive: boolean };

      // The Owner holds manage_sensitive_client_notes, so this note IS sensitive.
      expect(saved.is_sensitive, "an Owner's note should be sensitive").toBe(true);

      const { data: audit } = await db.from("audit_logs")
        .select("after_state").eq("target_id", saved.id).eq("action_type", "client_note_added");
      expect(audit ?? [], "adding a note must write an audit row").toHaveLength(1);
      expect(
        ((audit ?? [])[0] as { after_state: { is_sensitive: boolean } }).after_state.is_sensitive,
        "the audit row must record the note's real sensitivity",
      ).toBe(true);
    } finally {
      await context.close();
    }
  });

  test("E08-57 + FIND-08-A — a Therapist's note is NOT sensitive, and the audit row must say so", async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, "therapist_a");
    const note = `ZZTEST-therapistnote-${RUN_TAG}`;
    try {
      // The therapist reaches this client only through their assigned booking.
      expect(
        await openClient(page, assigned.clientId),
        "a therapist should reach a client they are assigned to",
      ).toBe("rendered");

      const alerts = await addNoteThroughUi(page, assigned.clientId, note);

      const { data: notes } = await db.from("client_notes")
        .select("id, is_sensitive").eq("client_id", assigned.clientId).eq("note", note);
      expect(
        notes ?? [],
        `the therapist's note was not saved. Page alerts: ${JSON.stringify(alerts)}`,
      ).toHaveLength(1);
      const saved = (notes ?? [])[0] as { id: string; is_sensitive: boolean };

      // ⛔ A Therapist holds `create_client_session_notes` but NOT
      // `manage_sensitive_client_notes` or `manage_privacy_operations`
      // (measured against the live grants), so the note is a session note.
      expect(saved.is_sensitive, "a therapist's note is a session note").toBe(false);

      // ⛔ FIND-08-A. This is the assertion the defect was hiding from.
      //
      // `addClientNote` wrote the note with `access.canCreateSensitiveNote` and
      // wrote the AUDIT ROW with the literal `true`. For every Therapist those
      // two disagree, so the clinic's activity log recorded an ordinary session
      // note as a sensitive one.
      //
      // ⚠️ Not cosmetic: `is_sensitive` is what decides who may READ the note —
      // the client page runs two separately-gated queries, one per value. The
      // log was describing the note as being in a more restricted category than
      // the one it is actually readable in.
      const { data: audit } = await db.from("audit_logs")
        .select("after_state").eq("target_id", saved.id).eq("action_type", "client_note_added");
      expect(audit ?? [], "adding a note must write an audit row").toHaveLength(1);
      expect(
        ((audit ?? [])[0] as { after_state: { is_sensitive: boolean } }).after_state.is_sensitive,
        "FIND-08-A: the audit row must record the note's REAL sensitivity, not a hardcoded true",
      ).toBe(false);
    } finally {
      await context.close();
    }
  });

  test("E08-57b — the same Therapist is refused on a client they are NOT assigned to", async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, "therapist_a");
    try {
      // ⛔ The control for this test is the one above: the SAME therapist, in the
      // SAME session, reached the assigned client and successfully wrote a note.
      // So "refused here" cannot be a broken login or a broken page.
      const outcome = await openClient(page, unassigned.clientId);
      expect(
        ["denied", "not-found"],
        `therapist reached an unassigned client and got "${outcome}"`,
      ).toContain(outcome);

      // And nothing of that client leaked onto the refusal.
      await expect(
        page.getByText(unassigned.name, { exact: false }),
        "the refusal page showed the client's name",
      ).toHaveCount(0);

      // ⛔ The affordance being absent is not the same as the action refusing.
      // No note row may exist for this client from this therapist.
      const { data: notes } = await db.from("client_notes").select("id")
        .eq("client_id", unassigned.clientId);
      expect(notes ?? [], "no note may exist on the unassigned client").toHaveLength(0);
    } finally {
      await context.close();
    }
  });

  test("E08-60 — the Coordinator can open the client but must NOT see the sensitive note", async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      // Control: the Coordinator CAN open the record and does see the client.
      expect(
        await openClient(page, assigned.clientId),
        "a coordinator manages clients and should reach the record",
      ).toBe("rendered");
      await expect(
        page.getByText(assigned.name, { exact: false }).first(),
        "the coordinator should see the client's name",
      ).toBeVisible();

      // ⛔ The Coordinator holds neither manage_sensitive_client_notes nor
      // manage_privacy_operations, so the Owner's sensitive note must not be in
      // the DOM at all — not merely hidden with CSS.
      await expect(
        page.getByText(`ZZTEST-ownernote-${RUN_TAG}`, { exact: false }),
        "a coordinator must not see a sensitive note",
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("E08-58 — deleting a client cancels OPEN bookings and leaves COMPLETED ones alone", async ({
    browser,
  }) => {
    // ⛔ Owner ruling D-014, proven end to end for the first time. Completed
    // bookings are a tax record: a delete must not rewrite the clinic's history
    // of work actually performed.
    const [openBookingId, completedBookingId] = deletable.bookingIds;

    const before = await db.from("bookings").select("id, status")
      .in("id", [openBookingId, completedBookingId]);
    const beforeStatus = Object.fromEntries(
      ((before.data ?? []) as { id: string; status: string }[]).map((b) => [b.id, b.status]),
    );
    expect(beforeStatus[openBookingId], "fixture: the open booking").toBe("confirmed");
    expect(beforeStatus[completedBookingId], "fixture: the completed booking").toBe("completed");

    const { context, page } = await sessionFor(browser, "owner");
    try {
      await page.goto(`/admin/clients/${deletable.clientId}/`, { waitUntil: "domcontentloaded" });

      // ⛔ MEASURED LABELS, not guessed ones. On the detail page the trigger is
      // "Delete"; "Delete client" is the CONFIRM button inside the modal that
      // follows it. (In the clients-list row menu the trigger is the one
      // labelled "Delete client" — same component, different variant.) Matching
      // /delete client/i on the page found nothing at all.
      const deleteButton = page.getByRole("button", { name: /^Delete$/ }).first();
      await expect(deleteButton, "the Owner should be offered a delete control").toBeVisible();
      await deleteButton.click();

      // Destructive, so it is confirmed before it runs — assert that, rather
      // than tolerating its absence.
      const confirm = page.getByRole("button", { name: /^Delete client$/ });
      await expect(confirm, "deleting a client must ask for confirmation first").toBeVisible();

      const answered = page.waitForResponse(
        (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
        { timeout: 60_000 },
      );
      await confirm.click();
      await answered;
      await page.waitForTimeout(1500);
    } finally {
      await context.close();
    }

    const { data: clientRow } = await db.from("clients").select("deleted_at")
      .eq("id", deletable.clientId).single();
    expect(
      (clientRow as { deleted_at: string | null })?.deleted_at,
      "the client should be soft-deleted, not hard-deleted",
    ).not.toBeNull();

    const after = await db.from("bookings").select("id, status")
      .in("id", [openBookingId, completedBookingId]);
    const afterStatus = Object.fromEntries(
      ((after.data ?? []) as { id: string; status: string }[]).map((b) => [b.id, b.status]),
    );

    expect(afterStatus[openBookingId], "the OPEN booking should be cancelled").toBe("cancelled");
    // ⛔ The half that matters. This is the assertion D-014 exists for.
    expect(
      afterStatus[completedBookingId],
      "⛔ D-014: a COMPLETED booking must survive the client's deletion untouched",
    ).toBe("completed");
  });
});
