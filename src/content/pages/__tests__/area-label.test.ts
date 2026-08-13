import { describe, expect, it } from "vitest";
import { areaLabel, areaPages } from "../areaPages";

/**
 * Guards the user-facing half of the geography fix.
 *
 * Phase 1b corrected `areaServed` in the JSON-LD but never reached the image
 * alt text or the map's accessible title, so production shipped "Map of Luton,
 * Luton", "Dunstable, Luton" and "Houghton Regis, Luton" to screen readers —
 * the machine-readable layer was right while the accessible layer stayed wrong.
 *
 * These assertions read the real `areaPages` data rather than a hand-written
 * list, so a new area is covered the moment it is added.
 */
describe("areaLabel", () => {
  it("suffixes ', Luton' on districts, which genuinely are in Luton", () => {
    const districts = areaPages.filter((a) => a.placeType === "district");
    expect(districts.length).toBeGreaterThan(0);
    for (const area of districts) {
      expect(areaLabel(area)).toBe(`${area.name}, Luton`);
    }
  });

  it("never claims a separate town or the hub is in Luton", () => {
    const freestanding = areaPages.filter((a) => a.placeType !== "district");
    expect(freestanding.length).toBeGreaterThan(0);
    for (const area of freestanding) {
      expect(areaLabel(area)).toBe(area.name);
      expect(areaLabel(area)).not.toMatch(/, Luton$/);
    }
  });

  it("produces no doubled place name, and no town placed inside Luton", () => {
    const labels = areaPages.map(areaLabel);
    expect(labels).not.toContain("Luton, Luton");
    expect(labels).not.toContain("Dunstable, Luton");
    expect(labels).not.toContain("Houghton Regis, Luton");
  });
});
