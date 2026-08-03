import { describe, it, expect } from "vitest";
import { resolvePasswordRequestsBannerState } from "../page";
import {
  PASSWORD_REQUESTS_LIMIT,
  PASSWORD_REQUESTS_VIEW_ALL_CAP,
} from "../password-requests-data";

// Fix round — verify-FAIL on commit 66e9391 (redesign/evidence/C-16/
// steps1112-verify.md, check 6): the "hidden rows" banner computed
// `hasHiddenRequests` from `totalCount > rows.length` alone, without
// distinguishing which cap produced `rows.length`. Once an operator was
// already viewing all AND the true total exceeded PASSWORD_REQUESTS_VIEW_ALL_CAP
// (500), the banner still hardcoded PASSWORD_REQUESTS_LIMIT (100) and
// offered a "view all N" link that was already the active URL — a no-op.
// These specs pin all four reachable states so that defect shape (and its
// twin, already fixed on privacy/page.tsx in 6faf895) can't regress here.
describe("resolvePasswordRequestsBannerState", () => {
  it("shows no banner below the first cap", () => {
    expect(resolvePasswordRequestsBannerState(50, 50, false)).toEqual({ kind: "none" });
  });

  it("shows no banner when the total exactly matches what was fetched, even while viewing all", () => {
    // viewAll but nothing is actually hidden (total <= LIMIT) — no banner.
    expect(resolvePasswordRequestsBannerState(80, 80, true)).toEqual({ kind: "none" });
  });

  it("names PASSWORD_REQUESTS_LIMIT (100) and offers a working view-all link above the first cap, not viewing all", () => {
    const totalCount = 250;
    const rowsLength = PASSWORD_REQUESTS_LIMIT; // the fetch capped at 100
    expect(resolvePasswordRequestsBannerState(totalCount, rowsLength, false)).toEqual({
      kind: "hidden",
      totalCount,
    });
  });

  it("reflects everything shown with no dead link when viewing all and total is within the view-all cap", () => {
    const totalCount = 250;
    const rowsLength = totalCount; // viewAll fetched everything (<= 500)
    expect(resolvePasswordRequestsBannerState(totalCount, rowsLength, true)).toEqual({
      kind: "viewingAll",
      totalCount,
    });
  });

  it("still reports viewingAll at the exact view-all-cap boundary (total === 500)", () => {
    const totalCount = PASSWORD_REQUESTS_VIEW_ALL_CAP;
    expect(resolvePasswordRequestsBannerState(totalCount, totalCount, true)).toEqual({
      kind: "viewingAll",
      totalCount,
    });
  });

  it("names PASSWORD_REQUESTS_VIEW_ALL_CAP (500) and states the remainder is unreachable once the total exceeds it while viewing all — the exact defect scenario", () => {
    const totalCount = 650;
    const rowsLength = PASSWORD_REQUESTS_VIEW_ALL_CAP; // the fetch capped at 500
    expect(resolvePasswordRequestsBannerState(totalCount, rowsLength, true)).toEqual({
      kind: "cappedOut",
      totalCount,
    });
  });

  it("takes the cappedOut branch over the generic hidden branch when both conditions are technically true", () => {
    // Regression guard for branch ORDER: at totalCount=650/rowsLength=500/viewAll=true,
    // `totalCount > rowsLength` (650 > 500) is also true, which is exactly what
    // the original defect keyed off. cappedOut must win, not "hidden".
    const result = resolvePasswordRequestsBannerState(650, 500, true);
    expect(result.kind).toBe("cappedOut");
  });
});
