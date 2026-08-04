// C-18 Phase A — Step 1 registry completeness test.
//
// Reference: redesign/evidence/C-18/cookie-inventory-source.md §1, the
// source-derived inventory of every cookie/storage mechanism that reaches an
// anonymous public/booking visitor (5 of the 12 mechanisms found; the other
// 7 are staff-only inside /admin and are explicitly out of this registry's
// scope — see that document's §5). The names below are transcribed directly
// from that inventory's table so this test fails the moment the registry and
// the inventory disagree about which items exist, in either direction.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONSENT_BANNER_VERSION,
  COOKIE_REGISTRY,
  type CookiePurpose,
  formatBannerVersionDate,
  groupRegistryByPurpose,
  type StorageMechanism,
} from "../cookie-registry";

const INVENTORY_NAMES = [
  "zam-therapy-booking-draft-v3",
  "rahma-booking-contact-v1",
  "_ga / _ga_*",
  "maintenance-modal-seen",
  "sentryReplaySession",
] as const;

const VALID_PURPOSES: CookiePurpose[] = ["essential", "functional", "analytics"];
const VALID_TYPES: StorageMechanism[] = ["cookie", "localStorage", "sessionStorage"];

describe("registry completeness (inventory <-> registry parity)", () => {
  it("has exactly the 5 visitor-facing entries the source inventory found", () => {
    expect(COOKIE_REGISTRY.length).toBe(INVENTORY_NAMES.length);
  });

  it("every inventoried item has a registry entry", () => {
    const registryNames = new Set(COOKIE_REGISTRY.map((entry) => entry.name));
    for (const name of INVENTORY_NAMES) {
      expect(registryNames.has(name), `missing registry entry for "${name}"`).toBe(true);
    }
  });

  it("has no registry entry beyond the inventoried set (symmetric check)", () => {
    const inventorySet = new Set<string>(INVENTORY_NAMES);
    for (const entry of COOKIE_REGISTRY) {
      expect(
        inventorySet.has(entry.name),
        `registry entry "${entry.name}" is not in the source inventory`
      ).toBe(true);
    }
  });

  it("has no duplicate entries", () => {
    const names = COOKIE_REGISTRY.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every entry has all required fields non-empty", () => {
    for (const entry of COOKIE_REGISTRY) {
      expect(entry.name, "name").toBeTruthy();
      expect(entry.provider, `${entry.name}.provider`).toBeTruthy();
      expect(entry.duration, `${entry.name}.duration`).toBeTruthy();
      expect(entry.description, `${entry.name}.description`).toBeTruthy();
      expect(VALID_TYPES, `${entry.name}.type`).toContain(entry.type);
      expect(VALID_PURPOSES, `${entry.name}.purpose`).toContain(entry.purpose);
    }
  });

  it("every essential entry's description names the specific function it enables", () => {
    // Not fully verifiable by machine, but a real, substantive sentence is —
    // this catches a placeholder or a one-word non-explanation, which is the
    // realistic failure mode for an "essential" claim made carelessly.
    for (const entry of COOKIE_REGISTRY.filter((e) => e.purpose === "essential")) {
      expect(
        entry.description.length,
        `${entry.name} is classified essential but its description is too short to name a specific function`
      ).toBeGreaterThan(40);
    }
  });

  it("rahma-booking-contact-v1 carries a provisional note (Owner decision pending)", () => {
    const entry = COOKIE_REGISTRY.find((e) => e.name === "rahma-booking-contact-v1");
    expect(entry).toBeDefined();
    expect(entry?.purpose).toBe("functional");
    expect(entry?.provisionalNote, "provisionalNote").toBeTruthy();
  });

  it("maintenance-modal-seen is marked dormant", () => {
    const entry = COOKIE_REGISTRY.find((e) => e.name === "maintenance-modal-seen");
    expect(entry).toBeDefined();
    expect(entry?.dormant).toBe(true);
  });

  it("sentryReplaySession is classified analytics, not a new purpose bucket", () => {
    const entry = COOKIE_REGISTRY.find((e) => e.name === "sentryReplaySession");
    expect(entry).toBeDefined();
    expect(entry?.purpose).toBe("analytics");
  });

  it("_ga / _ga_* is classified analytics", () => {
    const entry = COOKIE_REGISTRY.find((e) => e.name === "_ga / _ga_*");
    expect(entry).toBeDefined();
    expect(entry?.purpose).toBe("analytics");
    expect(entry?.type).toBe("cookie");
  });
});

describe("sentryReplaySession Phase D dependency pin", () => {
  // C-18 Phase A fix round (redesign/evidence/C-18/cookie-inventory-browser.md):
  // sentryReplaySession's description claims Replay "Only starts once you
  // accept analytics cookies" — true only once Phase D (consent-gated
  // loading) ships, which it has not as of this commit. cookie-registry.ts
  // carries a "PHASE D DEPENDENCY" marker comment next to the claim,
  // recording that it must be revisited before C-18 closes. This test fails
  // loudly if that marker is ever removed while the claim itself is still
  // present, so the dependency can't be silently forgotten and the page
  // can't end up shipping a false statement without something failing.
  const PHASE_D_CLAIM = "Only starts once you accept analytics cookies.";
  const PHASE_D_MARKER = "PHASE D DEPENDENCY";
  const registrySource = readFileSync(
    join(process.cwd(), "src", "lib", "consent", "cookie-registry.ts"),
    "utf8"
  );

  it("sanity check: the claim this test guards is still the one in the file", () => {
    expect(registrySource).toContain(PHASE_D_CLAIM);
  });

  it("keeps the PHASE D DEPENDENCY marker paired with the claim", () => {
    expect(
      registrySource.includes(PHASE_D_MARKER),
      `sentryReplaySession's description states "${PHASE_D_CLAIM}" but Phase D ` +
        "(consent-gated loading) has not shipped, so this is currently false. " +
        "The PHASE D DEPENDENCY marker comment in cookie-registry.ts must stay " +
        "next to this claim as a reminder to verify/fix it before C-18 closes — " +
        "it was removed without the claim being resolved."
    ).toBe(true);
  });
});

describe("CONSENT_BANNER_VERSION", () => {
  it("is the locked value from the plan/brief", () => {
    expect(CONSENT_BANNER_VERSION).toBe("2026-07-16.1");
  });

  it("matches the documented date + counter format", () => {
    expect(CONSENT_BANNER_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });
});

describe("formatBannerVersionDate", () => {
  it("formats the locked version's date in plain English", () => {
    expect(formatBannerVersionDate(CONSENT_BANNER_VERSION)).toBe("16 July 2026");
  });

  it("falls back to the raw string if the format is unrecognised", () => {
    expect(formatBannerVersionDate("not-a-version")).toBe("not-a-version");
  });
});

describe("groupRegistryByPurpose", () => {
  const groups = groupRegistryByPurpose();

  it("accounts for every registry entry exactly once", () => {
    const total = groups.reduce((sum, group) => sum + group.entries.length, 0);
    expect(total).toBe(COOKIE_REGISTRY.length);
  });

  it("omits purposes with no entries rather than rendering an empty group", () => {
    for (const group of groups) {
      expect(group.entries.length).toBeGreaterThan(0);
    }
  });

  it("puts essential first when present", () => {
    expect(groups[0]?.purpose).toBe("essential");
  });

  it("every group has a non-empty label and description", () => {
    for (const group of groups) {
      expect(group.label, group.purpose).toBeTruthy();
      expect(group.description, group.purpose).toBeTruthy();
    }
  });
});
