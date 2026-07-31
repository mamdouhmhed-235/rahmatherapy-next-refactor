// @vitest-environment jsdom
//
// C-FIELDWORK Phase C — PractitionerTodaySection render contract: hero /
// today-list / claimable-strip / empty-state branching, the tel:/maps
// conditional CTAs (existing BookingDetailSidebar pattern), the Mark-complete
// temporal guard (new — Step 9), and the two extra optional props
// (nextAppointmentAssignmentId, serviceLookup) this phase added on top of
// the plan's locked interface.
//
// No @testing-library/jest-dom in this repo (see BookingRowActions.test.tsx
// / MobileStickyActionBar.test.tsx for the established convention) — assert
// via plain DOM properties/attributes, not `toBeDisabled()`-style matchers.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PractitionerTodaySection } from "../PractitionerTodaySection";
import type { ReportBooking } from "../../reports/reporting";
import type { ServiceMeta } from "../shared-helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

// Resolves to the same src/app/admin/bookings/actions.ts module that
// BookingActionButton.tsx imports via "./actions" — vitest's mock registry
// is keyed by resolved path, not the importer's relative specifier.
vi.mock("../../bookings/actions", () => ({
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

describe("PractitionerTodaySection", () => {
  it("renders the next-visit hero when nextAppointment is provided", () => {
    const appt = makeBooking();
    render(
      <PractitionerTodaySection
        staffName="Sara"
        todayAppointments={[appt]}
        nextAppointment={appt}
      />
    );
    expect(document.getElementById("practitioner-next-visit-heading")).not
      .toBeNull();
    expect(screen.getByText(/Aisha · Visit/)).toBeTruthy();
  });

  it("labels the hero 'Next visit' when eyebrow is omitted", () => {
    const appt = makeBooking();
    render(
      <PractitionerTodaySection
        staffName="Sara"
        todayAppointments={[appt]}
        nextAppointment={appt}
      />
    );
    expect(screen.getByText(/Next visit/)).toBeTruthy();
  });

  it("renders a caller-supplied eyebrow in place of the default label", () => {
    const appt = makeBooking();
    render(
      <PractitionerTodaySection
        staffName="Sara"
        todayAppointments={[appt]}
        nextAppointment={appt}
        eyebrow="First visit back"
      />
    );
    expect(screen.getByText(/First visit back/)).toBeTruthy();
    expect(screen.queryByText(/Next visit/)).toBeNull();
  });

  it("renders today's visits list when more than one appointment today", () => {
    const next = makeBooking({ id: "b-1", start_time: "09:00:00" });
    const other = makeBooking({
      id: "b-2",
      start_time: "14:00:00",
      contact_full_name: "Mahmoud Hassan",
    });
    render(
      <PractitionerTodaySection
        staffName="Sara"
        todayAppointments={[next, other]}
        nextAppointment={next}
      />
    );
    expect(screen.getByText("Today's visits")).toBeTruthy();
    expect(screen.getByText(/Mahmoud · Visit/)).toBeTruthy();
  });

  it("caps the today list at 5 items and shows a 'View all' link", () => {
    const next = makeBooking({ id: "next", start_time: "08:00:00" });
    // getFirstName() keeps only the first whitespace-delimited word, so each
    // fixture's contact_full_name is a single space-free token here to stay
    // distinguishable in the rendered row text (e.g. "Client0", "Client1").
    const rest = Array.from({ length: 6 }, (_, i) =>
      makeBooking({
        id: `b-${i}`,
        start_time: `1${i}:00:00`,
        contact_full_name: `Client${i}`,
      })
    );
    render(
      <PractitionerTodaySection
        staffName="Sara"
        todayAppointments={[next, ...rest]}
        nextAppointment={next}
      />
    );
    const rows = screen.getAllByRole("link", { name: /Client\d/ });
    expect(rows.length).toBe(5);
    expect(screen.getByText(/View all today's visits/)).toBeTruthy();
  });

  it("renders the empty card with R05 PE-1 copy when no appointments and no claimable work", () => {
    render(
      <PractitionerTodaySection
        staffName="Sara"
        todayAppointments={[]}
        nextAppointment={null}
      />
    );
    expect(screen.getByText("Nothing scheduled")).toBeTruthy();
    expect(screen.getByText("Quiet day. Take care of yourself.")).toBeTruthy();
  });

  it("renders the claimable strip when claimableCount > 0", () => {
    render(
      <PractitionerTodaySection
        staffName="Sara"
        todayAppointments={[]}
        nextAppointment={null}
        claimableCount={3}
      />
    );
    expect(screen.getByText(/Open to claim — 3 available/)).toBeTruthy();
    expect(screen.getByText(/Browse claimable work/)).toBeTruthy();
  });

  it("suppresses the internal claimable strip when showClaimableStrip is false, without falling back to the empty-day copy", () => {
    render(
      <PractitionerTodaySection
        staffName="Sara"
        todayAppointments={[]}
        nextAppointment={null}
        claimableCount={3}
        showClaimableStrip={false}
      />
    );
    expect(screen.queryByText(/Open to claim — 3 available/)).toBeNull();
    expect(screen.queryByText(/Browse claimable work/)).toBeNull();
    expect(screen.queryByText("Nothing scheduled")).toBeNull();
    expect(
      screen.queryByText("Quiet day. Take care of yourself.")
    ).toBeNull();
  });

  describe("Mark complete temporal guard", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("disables Mark complete before start_time", () => {
      vi.setSystemTime(new Date("2026-05-25T10:00:00"));
      const appt = makeBooking({
        booking_date: "2026-05-25",
        start_time: "11:00:00",
      });
      render(
        <PractitionerTodaySection
          staffName="Sara"
          todayAppointments={[appt]}
          nextAppointment={appt}
          nextAppointmentAssignmentId="assignment-1"
        />
      );
      const button = screen.getByRole("button", {
        name: "Mark complete",
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("enables Mark complete at/after start_time", () => {
      vi.setSystemTime(new Date("2026-05-25T11:00:00"));
      const appt = makeBooking({
        booking_date: "2026-05-25",
        start_time: "11:00:00",
      });
      render(
        <PractitionerTodaySection
          staffName="Sara"
          todayAppointments={[appt]}
          nextAppointment={appt}
          nextAppointmentAssignmentId="assignment-1"
        />
      );
      const button = screen.getByRole("button", {
        name: "Mark complete",
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });
  });

  it("omits Mark complete entirely when nextAppointmentAssignmentId is null/undefined", () => {
    const appt = makeBooking();
    render(
      <PractitionerTodaySection
        staffName="Sara"
        todayAppointments={[appt]}
        nextAppointment={appt}
      />
    );
    expect(screen.queryByText("Mark complete")).toBeNull();
  });

  it("renders a tel: link only when phone is non-null", () => {
    const withPhone = makeBooking({ contact_phone: "07700900000" });
    const { rerender } = render(
      <PractitionerTodaySection
        staffName="Sara"
        todayAppointments={[withPhone]}
        nextAppointment={withPhone}
      />
    );
    const callLink = screen.getByRole("link", {
      name: /Call Aisha/,
    }) as HTMLAnchorElement;
    expect(callLink.getAttribute("href")).toBe("tel:07700900000");

    const noPhone = makeBooking({ contact_phone: null });
    rerender(
      <PractitionerTodaySection
        staffName="Sara"
        todayAppointments={[noPhone]}
        nextAppointment={noPhone}
      />
    );
    expect(screen.queryByRole("link", { name: /Call Aisha/ })).toBeNull();
  });

  it("renders the Maps button only when an address is present", () => {
    const withAddress = makeBooking();
    const { rerender } = render(
      <PractitionerTodaySection
        staffName="Sara"
        todayAppointments={[withAddress]}
        nextAppointment={withAddress}
      />
    );
    expect(
      screen.getByRole("link", { name: "Open this address in Google Maps" })
    ).toBeTruthy();

    const noAddress = makeBooking({
      service_address_line1: null,
      service_postcode: null,
      service_city: null,
    });
    rerender(
      <PractitionerTodaySection
        staffName="Sara"
        todayAppointments={[noAddress]}
        nextAppointment={noAddress}
      />
    );
    expect(
      screen.queryByRole("link", { name: "Open this address in Google Maps" })
    ).toBeNull();
  });

  it("falls back to 'Visit' when serviceLookup is omitted", () => {
    const appt = makeBooking();
    render(
      <PractitionerTodaySection
        staffName="Sara"
        todayAppointments={[appt]}
        nextAppointment={appt}
      />
    );
    expect(screen.getByText(/Aisha · Visit/)).toBeTruthy();
  });

  it("falls back to 'Visit' when serviceLookup has no entry for this booking", () => {
    const appt = makeBooking();
    const lookup = new Map<string, ServiceMeta>();
    lookup.set("some-other-booking-id", { name: "Massage Therapy", duration: 60 });
    render(
      <PractitionerTodaySection
        staffName="Sara"
        todayAppointments={[appt]}
        nextAppointment={appt}
        serviceLookup={lookup}
      />
    );
    expect(screen.getByText(/Aisha · Visit/)).toBeTruthy();
  });

  it("uses the real service name when serviceLookup has a matching entry", () => {
    const appt = makeBooking({ id: "svc-booking" });
    const lookup = new Map<string, ServiceMeta>();
    lookup.set("svc-booking", { name: "Hijama Package", duration: 60 });
    render(
      <PractitionerTodaySection
        staffName="Sara"
        todayAppointments={[appt]}
        nextAppointment={appt}
        serviceLookup={lookup}
      />
    );
    expect(screen.getByText(/Aisha · Hijama Package/)).toBeTruthy();
  });
});
