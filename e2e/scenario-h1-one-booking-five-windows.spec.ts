// ⛔ GATE 08 — P3, FAMILY H, SCENARIO H1: ONE BOOKING, FIVE WINDOWS.
//
//   ⛔ The Owner's question: "Does each person see exactly what they should?"
//
// ONE booking. FIVE different people open it. This is the clearest single proof
// that the permission model is coherent, because every difference between the
// five windows has to be explainable by a rule — and any difference that is not
// is a leak or a blockage.
//
// ── ⛔ THE RULE UNDER TEST, READ FROM THE DATABASE, NOT ASSUMED ──────────
//
// Health notes are the most sensitive thing in this system: allergies, injuries,
// pregnancies, medication. `canViewHealthNotes` is
//   `manage_sensitive_client_notes` OR `view_client_health_notes_assigned`
// and the roles holding those were read from the live database:
//
//   manage_sensitive_client_notes    → Admin, Owner
//   view_client_health_notes_assigned → Owner, Therapist
//
// ⛔ SO: Owner ✅, Admin ✅, the assigned Therapist ✅ — and the Booking
// Coordinator ❌. The person who takes the phone bookings can see who is coming
// and what they are paying, but NOT their medical history.
//
// ⚠️ I HAD THIS WRONG BEFORE I CHECKED. I assumed Admin could not see health
// notes because the Admin role has no `view_client_health_notes_*` permission.
// It does not need one — `manage_sensitive_client_notes` grants it. A test built
// on my assumption would have failed and I would have reported a leak that is
// not a leak. That is the fifth time this run that checking first saved a false
// finding.
//
// ── ⛔ WHY THREE "YES" ANSWERS ARE THE POINT, NOT PADDING ────────────────
//
// The only assertion that matters here is that the COORDINATOR cannot see the
// health note. ⛔ On its own that passes if the note was never saved, if the page
// is broken, or if nobody can see it. Three people seeing the SAME note on the
// SAME booking minutes apart rules all of that out.
//
// ── ⛔ AND A CACHE-POISONING CHECK, ALMOST FOR FREE ──────────────────────
//
// This page is cached. Its own source warns that the viewer's `profile` must
// never enter the cache key, and that what varies per caller is captured by
// separate flags — `canViewHealthNotes` among them. ⚠️ If that were ever got
// wrong, the SECOND person to open a booking would be served the FIRST person's
// view of it.
//
// ⛔ Opening one booking as five people in a row is exactly the shape that
// catches it, so the order below deliberately puts a viewer who CAN see the note
// immediately before the one who cannot.
//
// ── ⛔ EMAIL COST: ZERO ── nothing here is clicked.

import { expect, test, type Browser } from "@playwright/test";
import {
  destroyScenarioFixtures,
  pageAs,
  readBooking,
  RUN_TAG,
  seedWebsiteBooking,
  serviceClient,
  THERAPIST_A_STAFF_ID,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const HEALTH_MARKER = `ZZTEST-HEALTH-${RUN_TAG}-SEVERE-LATEX-ALLERGY`;

const clientIds: string[] = [];
let theBooking: SeededBooking;

type Role = "owner" | "admin" | "coordinator" | "therapist_a" | "therapist_b";

interface Window {
  role: Role;
  signedOut: boolean;
  refused: boolean;
  sawName: boolean;
  sawEmail: boolean;
  sawHealth: boolean;
  excerpt: string;
}

const windows: Window[] = [];

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (clientIds.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), clientIds);
});

async function look(browser: Browser, role: Role): Promise<Window> {
  const { context, page } = await pageAs(browser, role);
  await page.goto(`/admin/bookings/${theBooking.bookingId}/`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2_000);

  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const seen: Window = {
    role,
    signedOut: /\/admin\/login/.test(page.url()),
    refused: (await page.locator("[data-admin-access-denied]").count()) > 0,
    sawName: text.includes(theBooking.name),
    sawEmail: text.includes(theBooking.email),
    sawHealth: text.includes(HEALTH_MARKER),
    excerpt: text.slice(0, 200),
  };
  await context.close();
  return seen;
}

test.describe("H1 — one booking, five windows: does each person see exactly what they should?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ five people open the same booking", async ({ browser }) => {
    const db = serviceClient();

    theBooking = await seedWebsiteBooking(db, "H1-ONEBOOKING", {
      dayOffset: 11,
      startTime: "13:00:00",
      status: "confirmed",
      participants: [{ gender: "female", requiredGender: "female" }],
      assignTo: THERAPIST_A_STAFF_ID,
    });
    clientIds.push(theBooking.clientId);

    // ⛔ A health note that could not be mistaken for anything else on the page.
    await db
      .from("booking_participants")
      .update({ health_notes: HEALTH_MARKER })
      .eq("booking_id", theBooking.bookingId);

    // ⛔ PROVE THE NOTE IS ACTUALLY THERE before concluding anything from its
    // absence on screen. Without this, "the coordinator cannot see it" is
    // satisfied by a note that was never saved.
    const { data: check } = await db
      .from("booking_participants")
      .select("health_notes")
      .eq("booking_id", theBooking.bookingId);
    expect(
      ((check ?? []) as { health_notes: string | null }[]).some(
        (p) => p.health_notes === HEALTH_MARKER,
      ),
      "⛔ the fixture must really carry a health note, or this scenario tests nothing",
    ).toBe(true);

    // ⛔ ORDER MATTERS. The coordinator (who must NOT see the note) is opened
    // straight after the admin (who must). If the page cache ignored the
    // viewer's entitlement, she would be handed his page.
    for (const role of [
      "owner",
      "therapist_a",
      "admin",
      "coordinator",
      "therapist_b",
    ] as Role[]) {
      windows.push(await look(browser, role));
    }

    for (const w of windows) {
      console.log(
        `[H1] ${w.role.padEnd(12)} refused=${String(w.refused).padEnd(5)} name=${String(w.sawName).padEnd(5)} email=${String(w.sawEmail).padEnd(5)} healthNote=${w.sawHealth}`,
      );
    }

    // ⛔ Nobody was bounced to the login page — otherwise every "cannot see"
    // below would just mean "was not signed in".
    const signedOut = windows.filter((w) => w.signedOut).map((w) => w.role);
    expect(
      signedOut,
      `⛔ these people were SIGNED OUT, so their windows prove nothing: ${signedOut.join(", ")}`,
    ).toEqual([]);
  });

  test("step 2 — ✅ THE CONTROL: three of them CAN read the health note", async () => {
    expect(windows.length, "step 1 must have run").toBe(5);

    for (const role of ["owner", "admin", "therapist_a"] as Role[]) {
      const w = windows.find((x) => x.role === role)!;
      expect(
        w.refused,
        `⛔ ${role} must be able to open this booking at all`,
      ).toBe(false);
      expect(
        w.sawHealth,
        `⛔ WITHOUT THIS, STEP 3 PROVES NOTHING. ${role} holds a permission that grants health notes and must see it, or "the coordinator cannot see it" only means nobody can. It said: "${w.excerpt}"`,
      ).toBe(true);
    }

    console.log(
      `[H1] step 2 — control: Owner, Admin and the assigned Therapist all read the note.`,
    );
  });

  test("step 3 — ⛔ THE RULE: the coordinator cannot read the health note", async () => {
    expect(windows.length, "step 1 must have run").toBe(5);
    const coord = windows.find((w) => w.role === "coordinator")!;

    // ⛔ She is NOT shut out — she runs the diary and needs the booking.
    expect(
      coord.refused,
      "the coordinator must still be able to do her job on this booking",
    ).toBe(false);
    expect(
      coord.sawName,
      `⛔ she must see WHO is booked — she is the one who rings them. It said: "${coord.excerpt}"`,
    ).toBe(true);
    expect(
      coord.sawEmail,
      "⛔ and their contact details, which her role explicitly grants",
    ).toBe(true);

    // ⛔ BUT NOT THEIR MEDICAL HISTORY.
    expect(
      coord.sawHealth,
      `⛔ HEALTH NOTES LEAKED. The Booking Coordinator has neither manage_sensitive_client_notes nor view_client_health_notes_assigned, yet a customer's medical note was on her screen. She was looking at the SAME booking that the Owner, the Admin and the assigned Therapist just read it on, so this is not a broken page.`,
    ).toBe(false);

    console.log(
      `[H1] step 3 — the rule holds: she sees the customer and their contact details, but not their medical note.`,
    );
  });

  test("step 4 — ⛔ the therapist who is not on this job sees nothing at all", async () => {
    expect(windows.length, "step 1 must have run").toBe(5);
    const other = windows.find((w) => w.role === "therapist_b")!;

    expect(
      other.refused,
      `⛔ a therapist with no claim on this booking must be refused it. It said: "${other.excerpt}"`,
    ).toBe(true);
    expect(other.sawName, "⛔ and must not see the customer").toBe(false);
    expect(other.sawEmail, "⛔ nor their contact details").toBe(false);
    expect(other.sawHealth, "⛔ and certainly not their medical note").toBe(false);

    console.log(
      `[H1] step 4 — the unassigned therapist is shut out of all four.`,
    );
  });

  test("step 5 — ⛔ and it really was ONE booking all along", async () => {
    expect(windows.length, "step 1 must have run").toBe(5);
    const db = serviceClient();

    // ⛔ THE LAST WAY THIS COULD LIE. Five windows are only comparable if they
    // were five views of the SAME unchanged record. If any of those page loads
    // had quietly altered the booking, the differences above could be about
    // time rather than entitlement.
    const after = await readBooking(db, theBooking.bookingId);
    expect(after.status, "opening a booking must not change it").toBe("confirmed");

    const { data: parts } = await db
      .from("booking_participants")
      .select("health_notes")
      .eq("booking_id", theBooking.bookingId);
    expect(
      ((parts ?? []) as { health_notes: string | null }[]).some(
        (p) => p.health_notes === HEALTH_MARKER,
      ),
      "⛔ the health note must still be on the record after five people looked at it",
    ).toBe(true);

    console.log(
      `\n[H1] COMPLETE. One booking, five windows, every difference explained by a rule: health notes reach the Owner, the Admin and the therapist doing the visit — not the coordinator, and not a therapist who is not on the job.\n`,
    );
  });
});
