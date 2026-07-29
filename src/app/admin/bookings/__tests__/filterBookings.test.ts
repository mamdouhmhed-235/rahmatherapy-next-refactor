import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { filterBookings } from "../page";
import type { BookingRecord } from "../types";

/**
 * C-05 Phase D (Edit Point 8, brief §2.7/§9 Q9.7) — covers the status-aware
 * view filter: most views used to unconditionally exclude cancelled/no_show
 * BEFORE the status filter ran, so picking Status = Cancelled/No show on any
 * view but the dedicated "Cancelled / No-show" tab or "All" silently returned
 * 0 rows. These 10 cases lock the fix: an explicit status=cancelled/no_show
 * pick suspends that exclusion; "Any status" still hides them; `view=claimable`
 * stays unconditionally strict regardless of the status filter.
 *
 * 2026-06-01 11:00 Europe/London (BST) — pinned so `getTodayIsoDate()` (called
 * internally by `filterBookings`) resolves to "2026-06-01", matching this
 * file's fixtures. Same anchor convention as `access.test.ts`.
 */
const NOW = new Date("2026-06-01T10:00:00.000Z");
const TODAY = "2026-06-01";

function profile(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    id: "staff-a",
    auth_user_id: "auth-a",
    name: "Staff A",
    email: "staff-a@example.test",
    role_id: "role-a",
    role_name: "Therapist",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set([PERMISSIONS.CLAIM_ASSIGNMENTS]),
    ...overrides,
  };
}

function booking(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    id: "booking-1",
    booking_date: TODAY,
    start_time: "10:00",
    end_time: "11:00",
    status: "confirmed",
    booking_assignments: [],
    ...overrides,
  } as BookingRecord;
}

const claimableAssignment: BookingRecord["booking_assignments"][number] = {
  id: "assignment-1",
  participant_id: "participant-1",
  assigned_staff_id: null,
  required_therapist_gender: "female",
  status: "unassigned",
  staff_profiles: null,
};

describe("filterBookings (C-05 Phase D — status-aware view filter)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("view=attention, status='': cancelled rows excluded", () => {
    const pending = booking({ id: "pending", status: "pending" });
    const cancelled = booking({ id: "cancelled", status: "cancelled" });

    const result = filterBookings(
      [pending, cancelled],
      { view: "attention", status: "" },
      profile()
    );

    expect(result.map((b) => b.id)).toEqual(["pending"]);
  });

  it("view=attention, status='cancelled': cancelled rows included", () => {
    const pending = booking({ id: "pending", status: "pending" });
    const cancelled = booking({ id: "cancelled", status: "cancelled" });

    const result = filterBookings(
      [pending, cancelled],
      { view: "attention", status: "cancelled" },
      profile()
    );

    expect(result.map((b) => b.id)).toEqual(["cancelled"]);
  });

  it("view=attention, status='no_show': no_show rows included", () => {
    const pending = booking({ id: "pending", status: "pending" });
    const noShow = booking({ id: "no-show", status: "no_show" });

    const result = filterBookings(
      [pending, noShow],
      { view: "attention", status: "no_show" },
      profile()
    );

    expect(result.map((b) => b.id)).toEqual(["no-show"]);
  });

  it("view=upcoming, status='cancelled': cancelled future-dated rows included", () => {
    const cancelledFuture = booking({
      id: "cancelled-future",
      status: "cancelled",
      booking_date: "2026-06-15",
    });
    const confirmedFuture = booking({
      id: "confirmed-future",
      status: "confirmed",
      booking_date: "2026-06-15",
    });

    const result = filterBookings(
      [cancelledFuture, confirmedFuture],
      { view: "upcoming", status: "cancelled" },
      profile()
    );

    expect(result.map((b) => b.id)).toEqual(["cancelled-future"]);
  });

  it("view=today, status='cancelled': cancelled today rows included", () => {
    const cancelledToday = booking({
      id: "cancelled-today",
      status: "cancelled",
      booking_date: TODAY,
    });
    const cancelledTomorrow = booking({
      id: "cancelled-tomorrow",
      status: "cancelled",
      booking_date: "2026-06-02",
    });

    const result = filterBookings(
      [cancelledToday, cancelledTomorrow],
      { view: "today", status: "cancelled" },
      profile()
    );

    expect(result.map((b) => b.id)).toEqual(["cancelled-today"]);
  });

  it("view=claimable, status='cancelled': 0 rows (invariant preserved)", () => {
    const cancelledClaimable = booking({
      id: "cancelled-claimable",
      status: "cancelled",
      booking_date: "2026-06-05",
      booking_assignments: [claimableAssignment],
    });

    const result = filterBookings(
      [cancelledClaimable],
      { view: "claimable", status: "cancelled" },
      profile()
    );

    expect(result).toEqual([]);
  });

  it("view=claimable, status='': only active claimable rows (unchanged)", () => {
    const activeClaimable = booking({
      id: "active-claimable",
      status: "confirmed",
      booking_date: "2026-06-05",
      booking_assignments: [claimableAssignment],
    });
    const cancelledClaimable = booking({
      id: "cancelled-claimable",
      status: "cancelled",
      booking_date: "2026-06-05",
      booking_assignments: [claimableAssignment],
    });

    const result = filterBookings(
      [activeClaimable, cancelledClaimable],
      { view: "claimable", status: "" },
      profile()
    );

    expect(result.map((b) => b.id)).toEqual(["active-claimable"]);
  });

  it("view=cancelled, status='': shows cancelled + no_show (unchanged)", () => {
    const cancelled = booking({ id: "cancelled", status: "cancelled" });
    const noShow = booking({ id: "no-show", status: "no_show" });
    const confirmed = booking({ id: "confirmed", status: "confirmed" });

    const result = filterBookings(
      [cancelled, noShow, confirmed],
      { view: "cancelled", status: "" },
      profile()
    );

    expect(result.map((b) => b.id)).toEqual(["cancelled", "no-show"]);
  });

  it("view=cancelled, status='cancelled': shows only cancelled (status filter narrows)", () => {
    const cancelled = booking({ id: "cancelled", status: "cancelled" });
    const noShow = booking({ id: "no-show", status: "no_show" });

    const result = filterBookings(
      [cancelled, noShow],
      { view: "cancelled", status: "cancelled" },
      profile()
    );

    expect(result.map((b) => b.id)).toEqual(["cancelled"]);
  });

  it("view=all, status='': shows everything including cancelled (unchanged)", () => {
    const cancelled = booking({ id: "cancelled", status: "cancelled" });
    const confirmed = booking({ id: "confirmed", status: "confirmed" });

    const result = filterBookings(
      [cancelled, confirmed],
      { view: "all", status: "" },
      profile()
    );

    expect(result.map((b) => b.id)).toEqual(["cancelled", "confirmed"]);
  });
});
