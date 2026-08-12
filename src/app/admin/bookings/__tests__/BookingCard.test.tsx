import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { BookingCard } from "../BookingCard";
import type { BookingAssignment, BookingParticipant, BookingRecord } from "../types";

/**
 * C-13 Phase B safety net (brief section 2.2, plan Step 5-7).
 *
 * `BookingCard` was extracted from `page.tsx`'s inline single-booking
 * `<article>` (the named `BookingListCard`) without touching a character of
 * that JSX - only the destructured-args list became a props object. This
 * spec is the render-level half of that proof: every booking here has
 * exactly one participant, so `isGroup` is false and the component always
 * takes the untouched branch. If the extraction had silently altered that
 * branch's output, these assertions - same headline, same status/assignment
 * badges, same "no therapist yet" fallback, no group chrome at all - would
 * fail. The source-identity half of the proof (the JSX itself is unchanged)
 * is visible in the diff: `BookingCard.tsx`'s single-booking return is a
 * byte-for-byte copy of the pre-extraction function body.
 *
 * The group cases use synthetic multi-participant fixtures because, per the
 * C-13 pre-flight (progress file section 0.2), zero group bookings exist
 * anywhere in the database - production or test.
 */

vi.mock("../actions", () => ({
  quickUpdateBooking: vi.fn(),
  claimBookingAssignment: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  }),
}));

const TODAY = "2026-06-01";

function profile(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    id: "staff-a",
    auth_user_id: "auth-a",
    name: "Staff A",
    email: "staff-a@example.test",
    role_id: "role-a",
    role_name: "Owner",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set([PERMISSIONS.CLAIM_ASSIGNMENTS]),
    ...overrides,
  };
}

function participant(overrides: Partial<BookingParticipant> = {}): BookingParticipant {
  return {
    id: "participant-1",
    participant_gender: "female",
    required_therapist_gender: "female",
    is_main_contact: true,
    display_name: "Aisha Khan",
    participant_notes: null,
    health_notes: null,
    consent_acknowledged: true,
    ...overrides,
  };
}

function assignment(overrides: Partial<BookingAssignment> = {}): BookingAssignment {
  return {
    id: "assignment-1",
    participant_id: "participant-1",
    assigned_staff_id: null,
    required_therapist_gender: "female",
    status: "unassigned",
    staff_profiles: null,
    ...overrides,
  };
}

function booking(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    id: "booking-1",
    booking_date: TODAY,
    start_time: "10:00:00",
    end_time: "11:00:00",
    total_duration_mins: 60,
    total_price: 45,
    travel_fee: 0,
    contact_full_name: "Aisha Khan",
    contact_email: "aisha@example.test",
    contact_phone: "07000000000",
    booking_source: "admin",
    amount_due: 45,
    amount_paid: 0,
    paid_at: null,
    payment_note: null,
    status: "confirmed",
    payment_status: "unpaid",
    payment_method: null,
    assignment_status: "unassigned",
    group_booking: false,
    service_address_line1: "1 Test Street",
    service_address_line2: null,
    service_city: "Luton",
    service_postcode: "LU1 1AA",
    access_notes: null,
    consent_acknowledged: true,
    customer_notes: null,
    health_notes: null,
    customer_manage_notes: null,
    cancelled_at: null,
    customer_cancelled_at: null,
    customer_cancellation_note: null,
    last_customer_manage_action_at: null,
    reschedule_requested_at: null,
    reschedule_preferred_date: null,
    reschedule_preferred_time: null,
    reschedule_note: null,
    reschedule_status: "none",
    admin_notes: null,
    treatment_notes: null,
    created_at: "2026-05-01T00:00:00.000Z",
    recurring_template_id: null,
    clients: null,
    booking_participants: [participant()],
    booking_items: [
      {
        id: "item-1",
        booking_participant_id: "participant-1",
        service_name_snapshot: "Hijama Package",
        service_price_snapshot: 45,
        service_duration_snapshot: 60,
      },
    ],
    booking_assignments: [assignment()],
    ...overrides,
  };
}

describe("BookingCard - single booking (untouched branch)", () => {
  it("renders the client name, date/service line and status badge", () => {
    render(
      <BookingCard
        booking={booking()}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    expect(screen.getByText("Aisha Khan")).toBeTruthy();
    expect(screen.getByText(/Hijama Package/)).toBeTruthy();
    expect(screen.getByText("confirmed")).toBeTruthy();
  });

  it("never renders group chrome for a one-participant booking", () => {
    const { container } = render(
      <BookingCard
        booking={booking()}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    expect(container.querySelector('[data-group-booking="true"]')).toBeNull();
    expect(container.querySelector("ul")).toBeNull();
  });

  it('shows "No therapist yet" when unassigned', () => {
    render(
      <BookingCard
        booking={booking({
          assignment_status: "unassigned",
          booking_assignments: [assignment({ status: "unassigned" })],
        })}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    expect(screen.getByText("No therapist yet")).toBeTruthy();
    expect(screen.getByText("Unassigned")).toBeTruthy();
  });

  it('shows "Partially assigned" for a partially-assigned single booking (3-state vocabulary preserved)', () => {
    render(
      <BookingCard
        booking={booking({ assignment_status: "partially_assigned" })}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    expect(screen.getByText("Partially assigned")).toBeTruthy();
  });

  it("hides the assignment badge once fully assigned (unchanged 3-state behaviour)", () => {
    render(
      <BookingCard
        booking={booking({
          assignment_status: "fully_assigned",
          booking_assignments: [
            assignment({
              assigned_staff_id: "staff-x",
              status: "assigned",
              staff_profiles: { name: "Layla Hassan" },
            }),
          ],
        })}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    expect(screen.queryByText("Unassigned")).toBeNull();
    expect(screen.queryByText("Partially assigned")).toBeNull();
    // "Layla Hassan" appears twice by design: the visible avatar-stack caption
    // and its sr-only fallback (`AvatarStack`'s own accessibility text).
    expect(screen.getAllByText("Layla Hassan").length).toBeGreaterThan(0);
  });

  it("carries Phase A's gender chip through unchanged (single female-required)", () => {
    render(
      <BookingCard
        booking={booking()}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    expect(screen.getByText("Needs female therapist")).toBeTruthy();
  });
});

describe("BookingCard - group booking (synthetic data; no group fixture exists in the DB)", () => {
  function groupBooking(overrides: Partial<BookingRecord> = {}): BookingRecord {
    const participants = [
      participant({
        id: "p-1",
        display_name: "Aisha Khan",
        is_main_contact: true,
        participant_gender: "female",
        required_therapist_gender: "female",
      }),
      participant({
        id: "p-2",
        display_name: "Yusuf Khan",
        is_main_contact: false,
        participant_gender: "male",
        required_therapist_gender: "male",
      }),
      participant({
        id: "p-3",
        display_name: "Maryam Khan",
        is_main_contact: false,
        participant_gender: "female",
        required_therapist_gender: "female",
      }),
    ];
    const assignments = [
      assignment({
        id: "a-1",
        participant_id: "p-1",
        assigned_staff_id: "staff-x",
        required_therapist_gender: "female",
        status: "assigned",
        staff_profiles: { name: "Layla Hassan" },
      }),
      assignment({
        id: "a-2",
        participant_id: "p-2",
        assigned_staff_id: null,
        required_therapist_gender: "male",
        status: "unassigned",
        staff_profiles: null,
      }),
      assignment({
        id: "a-3",
        participant_id: "p-3",
        assigned_staff_id: null,
        required_therapist_gender: "female",
        status: "unassigned",
        staff_profiles: null,
      }),
    ];
    return booking({
      booking_participants: participants,
      booking_assignments: assignments,
      assignment_status: "partially_assigned",
      ...overrides,
    });
  }

  it("renders the nested layout with one sub-row per participant", () => {
    const { container } = render(
      <BookingCard
        booking={groupBooking()}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    expect(container.querySelector('[data-group-booking="true"]')).not.toBeNull();
    const rows = container.querySelectorAll("ul > li");
    expect(rows).toHaveLength(3);
  });

  it("orders the main contact first regardless of array position", () => {
    const participants = [
      participant({ id: "p-1", display_name: "Yusuf Khan", is_main_contact: false }),
      participant({ id: "p-2", display_name: "Aisha Khan", is_main_contact: true }),
    ];
    const assignments = [
      assignment({ id: "a-1", participant_id: "p-1", required_therapist_gender: "male" }),
      assignment({ id: "a-2", participant_id: "p-2", required_therapist_gender: "female" }),
    ];

    const { container } = render(
      <BookingCard
        booking={booking({
          booking_participants: participants,
          booking_assignments: assignments,
          assignment_status: "unassigned",
        })}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    const rows = container.querySelectorAll("ul > li");
    expect(within(rows[0] as HTMLElement).getByText("Aisha Khan")).toBeTruthy();
    expect(within(rows[0] as HTMLElement).getByText("(main)")).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText("Yusuf Khan")).toBeTruthy();
  });

  it("shows a per-participant fraction badge instead of the generic 3-state badge", () => {
    render(
      <BookingCard
        booking={groupBooking()}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    // 1 of 3 assigned (Aisha) - matches the groupBooking() fixture above.
    expect(screen.getByText("1 of 3 therapists assigned")).toBeTruthy();
    expect(screen.queryByText("Partially assigned")).toBeNull();
  });

  it("shows success-tone '3 of 3' when a group is fully crewed (Q9.1 locked)", () => {
    const fullyAssignedGroup = groupBooking({
      assignment_status: "fully_assigned",
      booking_assignments: [
        assignment({
          id: "a-1",
          participant_id: "p-1",
          assigned_staff_id: "staff-x",
          status: "assigned",
          staff_profiles: { name: "Layla Hassan" },
        }),
        assignment({
          id: "a-2",
          participant_id: "p-2",
          assigned_staff_id: "staff-y",
          required_therapist_gender: "male",
          status: "assigned",
          staff_profiles: { name: "Omar Malik" },
        }),
        assignment({
          id: "a-3",
          participant_id: "p-3",
          assigned_staff_id: "staff-z",
          status: "assigned",
          staff_profiles: { name: "Sara Ahmed" },
        }),
      ],
    });

    render(
      <BookingCard
        booking={fullyAssignedGroup}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    expect(screen.getByText("3 of 3 therapists assigned")).toBeTruthy();
  });

  it("shows a warning-tone '1 of 2 therapists assigned' badge for a two-participant group not yet fully crewed (Phase D)", () => {
    const twoPersonGroup = booking({
      booking_participants: [
        participant({ id: "p-1", display_name: "Aisha Khan", is_main_contact: true }),
        participant({
          id: "p-2",
          display_name: "Yusuf Khan",
          is_main_contact: false,
          participant_gender: "male",
          required_therapist_gender: "male",
        }),
      ],
      booking_assignments: [
        assignment({
          id: "a-1",
          participant_id: "p-1",
          assigned_staff_id: "staff-x",
          status: "assigned",
          staff_profiles: { name: "Layla Hassan" },
        }),
        assignment({
          id: "a-2",
          participant_id: "p-2",
          assigned_staff_id: null,
          required_therapist_gender: "male",
          status: "unassigned",
          staff_profiles: null,
        }),
      ],
      assignment_status: "partially_assigned",
    });

    render(
      <BookingCard
        booking={twoPersonGroup}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    const badgeText = screen.getByText("1 of 2 therapists assigned");
    // Tone maps to admin-ui.tsx's `statusBgClasses` — warning is the
    // "attention" background token, distinct from success's "confirmed"
    // token asserted in the next test.
    expect(badgeText.parentElement?.className).toContain(
      "admin-status-attention-bg"
    );
  });

  it("colors the fraction badge with success tone (not warning) once the group is fully crewed (Phase D tone check)", () => {
    const fullyAssignedGroup = groupBooking({
      assignment_status: "fully_assigned",
      booking_assignments: [
        assignment({
          id: "a-1",
          participant_id: "p-1",
          assigned_staff_id: "staff-x",
          status: "assigned",
          staff_profiles: { name: "Layla Hassan" },
        }),
        assignment({
          id: "a-2",
          participant_id: "p-2",
          assigned_staff_id: "staff-y",
          required_therapist_gender: "male",
          status: "assigned",
          staff_profiles: { name: "Omar Malik" },
        }),
        assignment({
          id: "a-3",
          participant_id: "p-3",
          assigned_staff_id: "staff-z",
          status: "assigned",
          staff_profiles: { name: "Sara Ahmed" },
        }),
      ],
    });

    render(
      <BookingCard
        booking={fullyAssignedGroup}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    const badgeText = screen.getByText("3 of 3 therapists assigned");
    expect(badgeText.parentElement?.className).toContain(
      "admin-status-confirmed-bg"
    );
    expect(badgeText.parentElement?.className).not.toContain(
      "admin-status-attention-bg"
    );
  });

  it("shows per-participant assignment state: assigned name vs. open + required gender", () => {
    const { container } = render(
      <BookingCard
        booking={groupBooking()}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    const rows = Array.from(container.querySelectorAll("ul > li"));
    const assignedRow = rows.find((row) => row.textContent?.includes("Aisha Khan"));
    const openMaleRow = rows.find((row) => row.textContent?.includes("Yusuf Khan"));

    expect(assignedRow?.textContent).toContain("Assigned to Layla Hassan");
    expect(openMaleRow?.textContent).toContain("Open — needs male therapist");
  });

  it("carries the gender-clarity chip for a mixed group (Phase A helper, unchanged)", () => {
    render(
      <BookingCard
        booking={groupBooking()}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    expect(screen.getByText("Needs 2 female + 1 male")).toBeTruthy();
  });

  it("does not render the pre-existing standalone 'Group N' pill (superseded by the nested layout)", () => {
    render(
      <BookingCard
        booking={groupBooking()}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    expect(screen.queryByText(/^Group . \d+$/)).toBeNull();
  });

  it("a booking flagged group_booking=true with a single participant still renders the single layout (data-anomaly guard, brief 5.7)", () => {
    const { container } = render(
      <BookingCard
        booking={booking({ group_booking: true })}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    expect(container.querySelector('[data-group-booking="true"]')).toBeNull();
  });

  it("renders composite identity in the headline instead of the main contact's name alone (Phase C)", () => {
    render(
      <BookingCard
        booking={groupBooking()}
        profile={profile()}
        canViewAll
        today={TODAY}
      />
    );

    // groupBooking() is Aisha Khan (main) + Yusuf Khan + Maryam Khan.
    expect(screen.getByText("Aisha Khan + 2 others")).toBeTruthy();
    // The bare main-contact name should not appear as the headline text —
    // it still appears once, inside its own sub-row.
    expect(screen.queryByText("Aisha Khan", { selector: "p" })).toBeNull();
  });
});
