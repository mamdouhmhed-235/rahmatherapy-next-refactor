import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureBookingActive } from "../access";

/** 2026-07-29 11:00 Europe/London (BST). */
const NOW = new Date("2026-07-29T10:00:00.000Z");

const ACTIVE_BOOKING = {
  id: "booking-1",
  status: "confirmed",
  booking_date: "2026-08-01",
  start_time: "14:00:00",
  deleted_at: null,
  clients: { deleted_at: null } as { deleted_at: string | null } | null,
};

/** Minimal stand-in for the `.from("bookings").select(...).eq(...).maybeSingle()` chain. */
function stubSupabase(
  booking: Record<string, unknown> | null,
  error: { message: string } | null = null
) {
  const from = vi.fn((table: string) => {
    if (table !== "bookings") throw new Error(`unexpected table: ${table}`);
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: booking, error }),
        }),
      }),
    };
  });
  return { from } as unknown as SupabaseClient;
}

describe("ensureBookingActive", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns active for a confirmed, future-dated booking", async () => {
    const supabase = stubSupabase(ACTIVE_BOOKING);

    expect(await ensureBookingActive("booking-1", supabase)).toEqual({
      active: true,
      booking: {
        id: "booking-1",
        status: "confirmed",
        booking_date: "2026-08-01",
        start_time: "14:00:00",
      },
    });
  });

  it("blocks a cancelled booking", async () => {
    const supabase = stubSupabase({ ...ACTIVE_BOOKING, status: "cancelled" });

    expect(await ensureBookingActive("booking-1", supabase)).toEqual({
      active: false,
      reason: "cancelled",
      message: "This booking is cancelled. Restore it from the booking detail page first.",
    });
  });

  it("blocks a no_show booking", async () => {
    const supabase = stubSupabase({ ...ACTIVE_BOOKING, status: "no_show" });

    expect(await ensureBookingActive("booking-1", supabase)).toEqual({
      active: false,
      reason: "no_show",
      message: "This booking is marked no-show. Restore it from the booking detail page first.",
    });
  });

  it("blocks a past-dated booking", async () => {
    const supabase = stubSupabase({ ...ACTIVE_BOOKING, booking_date: "2026-07-28" });

    expect(await ensureBookingActive("booking-1", supabase)).toEqual({
      active: false,
      reason: "past_dated",
      message: "This booking is in the past. Actions are no longer available.",
    });
  });

  it("treats booking_date === today as active when allowToday is true", async () => {
    const supabase = stubSupabase({ ...ACTIVE_BOOKING, booking_date: "2026-07-29" });

    expect(
      await ensureBookingActive("booking-1", supabase, { allowToday: true })
    ).toMatchObject({ active: true });
  });

  it("treats booking_date === today as past_dated when allowToday is false", async () => {
    const supabase = stubSupabase({ ...ACTIVE_BOOKING, booking_date: "2026-07-29" });

    expect(
      await ensureBookingActive("booking-1", supabase, { allowToday: false })
    ).toEqual({
      active: false,
      reason: "past_dated",
      message: "This booking is in the past. Actions are no longer available.",
    });
  });

  it("returns not_found for a non-existent booking id", async () => {
    const supabase = stubSupabase(null);

    expect(await ensureBookingActive("missing-booking", supabase)).toEqual({
      active: false,
      reason: "not_found",
      message: "Booking not found.",
    });
  });

  it("returns not_found when the booking is soft-deleted", async () => {
    const supabase = stubSupabase({
      ...ACTIVE_BOOKING,
      deleted_at: "2026-07-20T00:00:00.000Z",
    });

    expect(await ensureBookingActive("booking-1", supabase)).toEqual({
      active: false,
      reason: "not_found",
      message: "Booking not found.",
    });
  });

  it("returns client_deleted when the parent client is soft-deleted", async () => {
    const supabase = stubSupabase({
      ...ACTIVE_BOOKING,
      clients: { deleted_at: "2026-07-20T00:00:00.000Z" },
    });

    expect(await ensureBookingActive("booking-1", supabase)).toEqual({
      active: false,
      reason: "client_deleted",
      message: "This booking's client has been deleted.",
    });
  });
});
