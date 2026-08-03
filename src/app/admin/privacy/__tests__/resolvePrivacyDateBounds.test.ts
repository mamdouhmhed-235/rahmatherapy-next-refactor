import { describe, it, expect } from "vitest";
import { resolvePrivacyDateBounds } from "../page";

// C-09 Phase D fix round — a malformed custom from/to used to hit
// `.toISOString()` on an Invalid Date and throw RangeError, 500ing the whole
// page (e.g. /admin/privacy?tab=...&range=custom&from=x). Malformed input
// must fall back to "no bound" (same as no filter) instead of throwing.
describe("resolvePrivacyDateBounds", () => {
  it("does not throw on a malformed custom `from` and ignores it", () => {
    expect(() => resolvePrivacyDateBounds("custom", "not-a-date", "2026-01-10")).not.toThrow();
    expect(resolvePrivacyDateBounds("custom", "not-a-date", "2026-01-10")).toEqual({
      fromIso: undefined,
      toIso: new Date("2026-01-10T23:59:59").toISOString(),
    });
  });

  it("does not throw on a malformed custom `to` and ignores it", () => {
    expect(() => resolvePrivacyDateBounds("custom", "2026-01-01", "not-a-date")).not.toThrow();
    expect(resolvePrivacyDateBounds("custom", "2026-01-01", "not-a-date")).toEqual({
      fromIso: new Date("2026-01-01T00:00:00").toISOString(),
      toIso: undefined,
    });
  });

  it("still resolves a valid custom range to concrete ISO bounds", () => {
    expect(resolvePrivacyDateBounds("custom", "2026-01-01", "2026-01-10")).toEqual({
      fromIso: new Date("2026-01-01T00:00:00").toISOString(),
      toIso: new Date("2026-01-10T23:59:59").toISOString(),
    });
  });
});
