// C-13 Phase H (brief §5.11 / plan Step 20) — `deriveRequiredGenderByBooking`
// coverage. No group booking exists anywhere in production (0 of 15
// bookings have >1 participant — see progress file §0.2/§3), so every case
// here is synthetic `booking_assignments`-shaped data built by hand, not a
// fixture. The function collapses a booking's per-participant assignment
// rows to a single dashboard-friendly marker: the shared gender when every
// participant needing a therapist needs the same one, `"mixed"` when they
// don't, and no entry at all when nothing in the booking has a real
// requirement.
import { describe, expect, it } from "vitest";
import { deriveRequiredGenderByBooking } from "../CoordinatorDashboard";
import type { ReportAssignment } from "../../reports/reporting";

function assignment(overrides: Partial<ReportAssignment>): ReportAssignment {
  return {
    id: "a-1",
    booking_id: "b-1",
    participant_id: null,
    assigned_staff_id: null,
    required_therapist_gender: "female",
    status: "unassigned",
    staff_profiles: null,
    ...overrides,
  };
}

describe("deriveRequiredGenderByBooking", () => {
  it("returns an empty map for no assignments", () => {
    expect(deriveRequiredGenderByBooking([])).toEqual(new Map());
  });

  it("single-participant booking — carries that participant's gender through", () => {
    const result = deriveRequiredGenderByBooking([
      assignment({ booking_id: "single", required_therapist_gender: "female" }),
    ]);
    expect(result.get("single")).toBe("female");
  });

  it("group booking, all participants need the same gender — not marked mixed", () => {
    const result = deriveRequiredGenderByBooking([
      assignment({ id: "a-1", booking_id: "group-f", required_therapist_gender: "female" }),
      assignment({ id: "a-2", booking_id: "group-f", required_therapist_gender: "female" }),
      assignment({ id: "a-3", booking_id: "group-f", required_therapist_gender: "female" }),
    ]);
    expect(result.get("group-f")).toBe("female");
  });

  it("mixed-gender group — collapses to the 'mixed' marker (§5.11 b)", () => {
    const result = deriveRequiredGenderByBooking([
      assignment({ id: "a-1", booking_id: "group-mixed", required_therapist_gender: "female" }),
      assignment({ id: "a-2", booking_id: "group-mixed", required_therapist_gender: "male" }),
      assignment({ id: "a-3", booking_id: "group-mixed", required_therapist_gender: "female" }),
    ]);
    expect(result.get("group-mixed")).toBe("mixed");
  });

  it("'any' assignments are excluded — they express no requirement", () => {
    const result = deriveRequiredGenderByBooking([
      assignment({ id: "a-1", booking_id: "group-any", required_therapist_gender: "any" }),
      assignment({ id: "a-2", booking_id: "group-any", required_therapist_gender: "any" }),
    ]);
    expect(result.has("group-any")).toBe(false);
  });

  it("a group mixing a real requirement with 'any' is not marked mixed — 'any' isn't a second gender", () => {
    const result = deriveRequiredGenderByBooking([
      assignment({ id: "a-1", booking_id: "group-any-plus", required_therapist_gender: "female" }),
      assignment({ id: "a-2", booking_id: "group-any-plus", required_therapist_gender: "any" }),
    ]);
    expect(result.get("group-any-plus")).toBe("female");
  });

  it("keeps bookings independent — one booking's mix doesn't bleed into another", () => {
    const result = deriveRequiredGenderByBooking([
      assignment({ id: "a-1", booking_id: "mixed-one", required_therapist_gender: "female" }),
      assignment({ id: "a-2", booking_id: "mixed-one", required_therapist_gender: "male" }),
      assignment({ id: "a-3", booking_id: "single-two", required_therapist_gender: "male" }),
    ]);
    expect(result.get("mixed-one")).toBe("mixed");
    expect(result.get("single-two")).toBe("male");
  });
});
