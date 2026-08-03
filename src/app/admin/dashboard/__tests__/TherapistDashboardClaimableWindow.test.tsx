// @vitest-environment jsdom
//
// C-07 Phase A fix round (FIX 1) — "Open to claim" reads
// `claimableWindowBookings` (a fetch separately bounded to [today, today+7]
// in page.tsx), not `data.bookings` (bounded by the page-level date filter,
// today-only by default). This pins the boundary the fix restores: a
// claimable booking exactly 7 days out is IN, one 8 days out is OUT.
//
// No @testing-library/jest-dom in this repo (see PractitionerTodaySection.test.tsx
// for the established convention) — assert via plain text queries.

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TherapistDashboard } from "../TherapistDashboard";
import { addBusinessDays } from "@/lib/time/london";
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

const TODAY = "2026-05-25";

function makeBooking(overrides: Partial<ReportBooking>): ReportBooking {
  return {
    id: "b-1",
    client_id: "c-1",
    booking_date: TODAY,
    start_time: "11:00:00",
    end_time: "12:00:00",
    status: "pending",
    payment_status: "unpaid",
    assignment_status: "unassigned",
    reschedule_status: "none",
    customer_cancelled_at: null,
    total_price: null,
    amount_due: null,
    amount_paid: null,
    booking_source: "website",
    contact_full_name: "Test Client",
    contact_email: null,
    contact_phone: null,
    service_city: "Luton",
    service_postcode: "LU1 1AA",
    service_address_line1: "1 Park Street",
    health_notes: null,
    created_at: "2026-05-24T10:00:00Z",
    ...overrides,
  };
}

function makeEmptyData(): ReportData {
  return {
    filters: {
      range: "today",
      from: TODAY,
      to: TODAY,
      staffId: "",
      service: "",
      source: "",
      status: "",
      paymentStatus: "",
      city: "",
    },
    bookings: [],
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

function renderDashboard(claimableWindowBookings: ReportBooking[]) {
  return render(
    <TherapistDashboard
      staffId="staff-1"
      staffName="Sara Ahmed"
      today={TODAY}
      data={makeEmptyData()}
      claimableWindowBookings={claimableWindowBookings}
      claimableWindowAssignments={[]}
      weekCount={0}
      todayAppointments={[]}
      nextAppointment={null}
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

describe("TherapistDashboard claimable 7-day window", () => {
  it("includes a claimable booking exactly 7 days out and excludes one 8 days out", () => {
    const sevenDaysOut = addBusinessDays(TODAY, 7);
    const eightDaysOut = addBusinessDays(TODAY, 8);

    const inWindow = makeBooking({
      id: "in-window",
      booking_date: sevenDaysOut,
      contact_full_name: "InWindow Client",
    });
    const outOfWindow = makeBooking({
      id: "out-of-window",
      booking_date: eightDaysOut,
      contact_full_name: "OutWindow Client",
    });

    renderDashboard([inWindow, outOfWindow]);

    expect(screen.getByText("1 available")).toBeTruthy();
    expect(screen.getByText(/InWindow/)).toBeTruthy();
    expect(screen.queryByText(/OutWindow/)).toBeNull();
  });

  it("shows the empty-state copy and browse-all link when nothing is claimable", () => {
    renderDashboard([]);

    // Scoped to the "Open to claim" section specifically — PractitionerTodaySection
    // renders its own unrelated "Nothing scheduled" empty state elsewhere on
    // the page when there's no next appointment either.
    const claimableSection = screen
      .getByRole("heading", { name: /Open to claim/ })
      .closest("section");
    expect(claimableSection).toBeTruthy();
    expect(
      within(claimableSection as HTMLElement).getByText(/Nothing scheduled/)
    ).toBeTruthy();
    expect(
      within(claimableSection as HTMLElement).getByText(
        /Browse all claimable work/
      )
    ).toBeTruthy();
  });
});
