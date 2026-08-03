// C-16 Phase E Step 14 (N3) — pure banner-state resolver for the
// availability page's blocked-dates / hour-adjustments cap+view-all.
import { describe, it, expect } from "vitest";
import {
  AVAILABILITY_PAST_CAP,
  AVAILABILITY_PAST_VIEW_ALL_CAP,
  resolveAvailabilityBannerState,
} from "../availability-data";

describe("resolveAvailabilityBannerState", () => {
  it("is 'none' when nothing is hidden and not viewing all", () => {
    expect(
      resolveAvailabilityBannerState({ pastTotal: 5, pastShown: 5, viewAll: false })
    ).toEqual({ kind: "none" });
  });

  it("is 'hidden' when the default cap is truncating", () => {
    expect(
      resolveAvailabilityBannerState({
        pastTotal: AVAILABILITY_PAST_CAP + 10,
        pastShown: AVAILABILITY_PAST_CAP,
        viewAll: false,
      })
    ).toEqual({ kind: "hidden", total: AVAILABILITY_PAST_CAP + 10 });
  });

  it("is 'viewingAll' when the view-all cap covers everything", () => {
    expect(
      resolveAvailabilityBannerState({
        pastTotal: AVAILABILITY_PAST_CAP + 10,
        pastShown: AVAILABILITY_PAST_CAP + 10,
        viewAll: true,
      })
    ).toEqual({ kind: "viewingAll", total: AVAILABILITY_PAST_CAP + 10 });
  });

  it("SABOTAGE TARGET — is 'cappedOut', not 'hidden', once view-all itself is truncating", () => {
    // The exact bug shape that shipped twice before this plan (privacy's
    // notes rail, then password-requests): already viewing all AND the true
    // total exceeds the view-all cap. If `hidden` were checked first, this
    // would return `hidden` pointing back at the same already-active
    // view-all state — a dead "view all" link.
    const result = resolveAvailabilityBannerState({
      pastTotal: AVAILABILITY_PAST_VIEW_ALL_CAP + 30,
      pastShown: AVAILABILITY_PAST_VIEW_ALL_CAP,
      viewAll: true,
    });
    expect(result).toEqual({
      kind: "cappedOut",
      total: AVAILABILITY_PAST_VIEW_ALL_CAP + 30,
    });
  });

  it("cappedOut takes priority even when hidden's condition also holds", () => {
    // pastTotal > pastShown is ALSO true in the cappedOut case above —
    // proving branch ORDER (cappedOut before hidden), not just that each
    // condition independently exists.
    const result = resolveAvailabilityBannerState({
      pastTotal: AVAILABILITY_PAST_VIEW_ALL_CAP + 1,
      pastShown: AVAILABILITY_PAST_VIEW_ALL_CAP,
      viewAll: true,
    });
    expect(result.kind).toBe("cappedOut");
  });
});
