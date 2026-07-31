// @vitest-environment jsdom
//
// C-11 Phase D follow-up — the Therapist hero's dynamic eyebrow. The label is
// derived inside TherapistDashboard and threaded into PractitionerTodaySection
// through its optional `eyebrow` prop, so the only honest way to exercise the
// derivation is to render the variant and read the badge it actually produces.
//
// No @testing-library/jest-dom in this repo (see PractitionerTodaySection.test.tsx
// for the established convention) — assert via plain text queries.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TherapistDashboard } from "../TherapistDashboard";
import type { ReportBooking, ReportData } from "../../reports/reporting";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Resolves to the same src/app/admin/bookings/actions.ts module the rendered
// client buttons import via "./actions" — vitest's mock registry is keyed by
// resolved path, not by the importer's relative specifier.
vi.mock("../../bookings/actions", () => ({
  claimBookingAssignment: vi.fn(),
  quickUpdateBooking: vi.fn(),
  updateOwnAssignmentStatus: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  }),
}));

function makeBooking(overrides?: Partial<ReportBooking>): ReportBooking {
  return {
    id: "b-1",
    client_id: "c-1",
    booking_date: "2026-05-25",
    start_time: "11:00:00",
    end_time: "12:00:00",
    status: "confirmed",
    payment_status: "unpaid",
    assignment_status: "assigned",
    reschedule_status: "none",
    customer_cancelled_at: null,
    total_price: null,
    amount_due: null,
    amount_paid: null,
    booking_source: "website",
    contact_full_name: "Aisha Khan",
    contact_email: "aisha@example.test",
    contact_phone: "07700900000",
    service_city: "Luton",
    service_postcode: "LU1 1AA",
    service_address_line1: "1 Park Street",
    health_notes: null,
    created_at: "2026-05-24T10:00:00Z",
    ...overrides,
  };
}

function makeData(bookings: ReportBooking[]): ReportData {
  return {
    filters: {
      range: "today",
      from: "2026-05-25",
      to: "2026-05-25",
      staffId: "",
      service: "",
      source: "",
      status: "",
      paymentStatus: "",
      city: "",
    },
    bookings,
    cityOptions: [],
    assignments: [],
    bookingItems: [],
    clients: [],
    staff: [],
    enquiries: [],
    emailEvents: [],
    operationalEvents: [],
    staffAvailabilityRuleStaffIds: [],
  };
}

function renderDashboard({
  today,
  nextAppointment,
  bookings,
}: {
  today: string;
  nextAppointment: ReportBooking | null;
  bookings?: ReportBooking[];
}) {
  const allBookings =
    bookings ?? (nextAppointment ? [nextAppointment] : []);
  const todayAppointments = allBookings.filter(
    (booking) => booking.booking_date === today
  );
  return (
    <TherapistDashboard
      staffId="staff-1"
      staffName="Sara Ahmed"
      today={today}
      data={makeData(allBookings)}
      weekCount={0}
      todayAppointments={todayAppointments}
      nextAppointment={nextAppointment}
      profileCompletionFields={{
        phone: "07700900000",
        shortBio: "Bio",
        specialties: ["Hijama"],
        languages: ["English"],
        serviceAreas: ["Luton"],
        profileCompletedAt: "2026-01-01T00:00:00Z",
      }}
    />
  );
}

describe("TherapistDashboard hero eyebrow derivation", () => {
  it("reads 'First visit back' on a Monday whose last completed visit was a Friday", () => {
    // 2026-05-25 is a Monday; its calendar week runs Mon 25th – Sun 31st, so
    // the Friday that `completedThisWeek` can see is the 29th (weekStartDate
    // is the Monday itself, which excludes the *previous* Friday entirely).
    const next = makeBooking({ id: "next", booking_date: "2026-05-25" });
    const friday = makeBooking({
      id: "fri",
      booking_date: "2026-05-29",
      status: "completed",
      contact_full_name: "Mahmoud Hassan",
    });
    render(
      renderDashboard({
        today: "2026-05-25",
        nextAppointment: next,
        bookings: [next, friday],
      })
    );
    expect(screen.getByText(/First visit back/)).toBeTruthy();
  });

  it("reads 'Tomorrow's first visit' whenever the next appointment is not today", () => {
    const next = makeBooking({ id: "next", booking_date: "2026-05-27" });
    const { unmount } = render(
      renderDashboard({ today: "2026-05-26", nextAppointment: next })
    );
    expect(screen.getByText(/Tomorrow's first visit/)).toBeTruthy();
    unmount();

    // Restored-as-is quirk, pinned deliberately: the condition is merely
    // "not today", so the label also fires for an appointment weeks away.
    const farFuture = makeBooking({ id: "far", booking_date: "2026-06-15" });
    render(renderDashboard({ today: "2026-05-26", nextAppointment: farFuture }));
    expect(screen.getByText(/Tomorrow's first visit/)).toBeTruthy();
  });

  it("reads 'Next visit' for a today appointment outside the Monday-after-Friday case", () => {
    const next = makeBooking({ id: "next", booking_date: "2026-05-26" });
    const { unmount } = render(
      renderDashboard({ today: "2026-05-26", nextAppointment: next })
    );
    expect(screen.getByText(/Next visit/)).toBeTruthy();
    expect(screen.queryByText(/First visit back/)).toBeNull();
    expect(screen.queryByText(/Tomorrow's first visit/)).toBeNull();
    unmount();

    // Monday, but no completed Friday visit — isolates lastVisitWasFriday.
    const monday = makeBooking({ id: "mon", booking_date: "2026-05-25" });
    render(renderDashboard({ today: "2026-05-25", nextAppointment: monday }));
    expect(screen.getByText(/Next visit/)).toBeTruthy();
    expect(screen.queryByText(/First visit back/)).toBeNull();
  });
});
