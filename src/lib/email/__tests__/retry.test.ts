// D-047 — the email retry, and above all THE CAP.
//
// ⛔ The cap is the part that can hurt somebody. An unbounded retry against a
// hard-bouncing address hammers the clinic's sending domain, and against an
// exhausted daily allowance (D-053) it spends the NEXT day's allowance too —
// which the Owner explicitly asked not to have spent for them.
//
// ⚠️ So these tests are weighted towards proving it STOPS, not that it retries.
// "It retried" is easy to get right and cheap to check; "it eventually gave up"
// is the assertion that protects the Owner.

import { describe, expect, it, vi } from "vitest";
import {
  MAX_EMAIL_RETRIES,
  priorAttemptsOf,
  queueEmailRetry,
  type RetryableEmail,
} from "../retry";

function fakeSupabase(insertError: { message: string } | null = null) {
  const inserted: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return Promise.resolve({ error: insertError });
      },
    }),
  };
  return { client: client as never, inserted };
}

const BASE: RetryableEmail = {
  bookingId: "b-1",
  eventType: "booking_confirmation",
  recipientEmail: "someone@example.test",
  recipientRole: "customer",
  subject: "Your booking",
  html: "<p>hello</p>",
  text: "hello",
  priorAttempts: 0,
};

describe("queueEmailRetry — the cap", () => {
  it("⛔ STOPS once the message has had its retries", async () => {
    const { client, inserted } = fakeSupabase();

    const outcome = await queueEmailRetry(client, {
      ...BASE,
      priorAttempts: MAX_EMAIL_RETRIES,
    });

    expect(outcome.queued, "a message at the cap must not be queued again").toBe(false);
    expect(
      inserted,
      "⛔ NOTHING may be written once the cap is reached — an insert here is how a retry loop becomes infinite",
    ).toEqual([]);
  });

  it("⛔ stops for any attempt count PAST the cap too, not just exactly at it", async () => {
    // ⚠️ Guards the off-by-one directly. A `=== MAX` check would let a row that
    // somehow carried a higher count slip through and retry for ever.
    for (const priorAttempts of [MAX_EMAIL_RETRIES + 1, MAX_EMAIL_RETRIES + 5, 99]) {
      const { client, inserted } = fakeSupabase();
      const outcome = await queueEmailRetry(client, { ...BASE, priorAttempts });
      expect(outcome.queued, `priorAttempts=${priorAttempts} must not queue`).toBe(false);
      expect(inserted).toEqual([]);
    }
  });

  it("✅ allows exactly MAX_EMAIL_RETRIES attempts and no more", async () => {
    // Walk the whole ladder, the way the cron would across successive ticks.
    const queuedAt: number[] = [];
    for (let prior = 0; prior <= MAX_EMAIL_RETRIES + 1; prior += 1) {
      const { client } = fakeSupabase();
      const outcome = await queueEmailRetry(client, { ...BASE, priorAttempts: prior });
      if (outcome.queued) queuedAt.push(prior);
    }
    expect(
      queuedAt.length,
      `the ladder must allow exactly ${MAX_EMAIL_RETRIES} retries, not ${queuedAt.length}`,
    ).toBe(MAX_EMAIL_RETRIES);
  });
});

describe("queueEmailRetry — what it writes", () => {
  it("✅ queues a NEW row rather than editing the failed one", async () => {
    const { client, inserted } = fakeSupabase();
    const outcome = await queueEmailRetry(client, BASE);

    expect(outcome.queued).toBe(true);
    expect(inserted).toHaveLength(1);
    // ⛔ The failed row is the clinic's record that an attempt did not land. A
    // retry that overwrote it would make a repeatedly-failing address look like
    // a single blip on /admin/emails.
    expect(inserted[0].delivery_status).toBe("queued");
    expect(inserted[0].to_email).toBe(BASE.recipientEmail);
    expect(inserted[0].html_payload).toBe(BASE.html);
    expect(inserted[0].text_payload).toBe(BASE.text);
  });

  it("⛔ carries the attempt count ON THE ROW, so the cron can count across ticks", async () => {
    const { client, inserted } = fakeSupabase();
    await queueEmailRetry(client, { ...BASE, priorAttempts: 1 });

    // ⚠️ This is the mechanism the whole cap rests on. The cron runs every
    // minute and may be a different worker each time, so a counter held in
    // memory would reset on every tick and retry for ever.
    expect(inserted[0].metadata).toMatchObject({ retry_attempt: 2 });
  });

  it("✅ schedules it in the future, not immediately", async () => {
    const { client, inserted } = fakeSupabase();
    const before = Date.now();
    await queueEmailRetry(client, BASE);

    const scheduled = new Date(String(inserted[0].scheduled_for)).getTime();
    expect(
      scheduled,
      "⛔ a retry scheduled for now would be picked up in the same tick and hammer the provider",
    ).toBeGreaterThan(before);
  });

  it("⚠️ backs off further on the second attempt than the first", async () => {
    const first = fakeSupabase();
    await queueEmailRetry(first.client, { ...BASE, priorAttempts: 0 });
    const second = fakeSupabase();
    await queueEmailRetry(second.client, { ...BASE, priorAttempts: 1 });

    expect(
      new Date(String(second.inserted[0].scheduled_for)).getTime(),
    ).toBeGreaterThan(new Date(String(first.inserted[0].scheduled_for)).getTime());
  });
});

describe("queueEmailRetry — refusing to make things worse", () => {
  it("⛔ never retries a message with no recipient", async () => {
    const { client, inserted } = fakeSupabase();
    const outcome = await queueEmailRetry(client, { ...BASE, recipientEmail: "" });

    // Such a message is `skipped`, not `failed`. Retrying it would queue an
    // undeliverable row every minute for ever.
    expect(outcome.queued).toBe(false);
    expect(inserted).toEqual([]);
  });

  it("⛔ NEVER THROWS, even when the database refuses the insert", async () => {
    const { client } = fakeSupabase({ message: "connection refused" });
    const outcome = await queueEmailRetry(client, BASE);

    // ⚠️ Every caller is already inside a failure path. An exception here would
    // replace a RECORDED email failure with an UNRECORDED crash — strictly
    // worse than not retrying at all.
    expect(outcome.queued).toBe(false);
    expect(outcome.reason).toContain("connection refused");
  });

  it("⛔ never throws even if the client itself explodes", async () => {
    const exploding = {
      from: () => {
        throw new Error("no database");
      },
    } as never;

    await expect(queueEmailRetry(exploding, BASE)).resolves.toMatchObject({
      queued: false,
    });
  });
});

describe("priorAttemptsOf", () => {
  it("✅ reads the count off a row's metadata", () => {
    expect(priorAttemptsOf({ retry_attempt: 2 })).toBe(2);
  });

  it("⛔ reads anything missing or malformed as ZERO, deliberately", () => {
    // ⚠️ The safe direction is one EXTRA attempt, not zero attempts. Treating an
    // unreadable value as "already at the cap" would silently disable the whole
    // retry — the feature would look present and do nothing.
    for (const bad of [null, undefined, {}, { retry_attempt: "x" }, { retry_attempt: -3 }, "nope", 7]) {
      expect(priorAttemptsOf(bad), `${JSON.stringify(bad)} should read as 0`).toBe(0);
    }
  });

  it("✅ round-trips with what queueEmailRetry writes", async () => {
    // ⛔ THE JOIN BETWEEN THE TWO HALVES. If the writer and the reader ever
    // disagree about the field name, the count resets every tick and the cap
    // stops working — with every individual test above still green.
    const { client, inserted } = fakeSupabase();
    await queueEmailRetry(client, { ...BASE, priorAttempts: 1 });
    expect(priorAttemptsOf(inserted[0].metadata)).toBe(2);
  });
});
