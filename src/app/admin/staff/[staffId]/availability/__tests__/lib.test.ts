// C-16 Phase E Step 14 (N4) — pure banner-state resolver for the staff
// availability tab's blocked-dates / hour-adjustments cap+view-all.
import { describe, it, expect } from "vitest";
import {
  STAFF_AVAILABILITY_PAST_CAP,
  STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP,
  resolveStaffAvailabilityBannerState,
} from "../lib";

describe("resolveStaffAvailabilityBannerState", () => {
  it("is 'none' when nothing is hidden and not viewing all", () => {
    expect(
      resolveStaffAvailabilityBannerState({ pastTotal: 3, pastShown: 3, viewAll: false })
    ).toEqual({ kind: "none" });
  });

  it("is 'hidden' when the default cap is truncating", () => {
    expect(
      resolveStaffAvailabilityBannerState({
        pastTotal: STAFF_AVAILABILITY_PAST_CAP + 4,
        pastShown: STAFF_AVAILABILITY_PAST_CAP,
        viewAll: false,
      })
    ).toEqual({ kind: "hidden", total: STAFF_AVAILABILITY_PAST_CAP + 4 });
  });

  it("is 'viewingAll' when the view-all cap covers everything", () => {
    expect(
      resolveStaffAvailabilityBannerState({
        pastTotal: STAFF_AVAILABILITY_PAST_CAP + 4,
        pastShown: STAFF_AVAILABILITY_PAST_CAP + 4,
        viewAll: true,
      })
    ).toEqual({ kind: "viewingAll", total: STAFF_AVAILABILITY_PAST_CAP + 4 });
  });

  it("SABOTAGE TARGET — is 'cappedOut', not 'hidden', once view-all itself is truncating", () => {
    // Same bug shape that shipped twice before this plan (privacy's notes
    // rail, then password-requests): already viewing all AND the true total
    // exceeds the view-all cap. If `hidden` were checked first, this would
    // return `hidden` pointing back at the same already-active view-all
    // state — a dead "view all" link.
    const result = resolveStaffAvailabilityBannerState({
      pastTotal: STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP + 12,
      pastShown: STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP,
      viewAll: true,
    });
    expect(result).toEqual({
      kind: "cappedOut",
      total: STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP + 12,
    });
  });
});
