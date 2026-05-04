import { describe, expect, it } from "vitest";
import {
  getPackageSelectionError,
  getPackageTotal,
  getSelectedPackages,
} from "./booking-packages";

describe("booking packages", () => {
  it("calculates the per-person package total from selected services", () => {
    expect(getPackageTotal(["hijama-package", "massage-30"])).toBe(85);
  });

  it("keeps unknown package ids out of selected packages", () => {
    expect(
      getSelectedPackages(["hijama-package", "unknown-package" as never]).map(
        (item) => item.id
      )
    ).toEqual(["hijama-package"]);
  });

  it("prevents incompatible multiple cupping or massage choices", () => {
    expect(getPackageSelectionError(["hijama-package", "fire-package"])).toMatch(
      /one hijama or cupping package/i
    );
    expect(getPackageSelectionError(["massage-30", "massage-60"])).toMatch(
      /either the 30-minute or 1-hour massage/i
    );
  });
});
