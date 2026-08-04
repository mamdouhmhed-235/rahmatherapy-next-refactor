// C-18 Phase A — Step 1 registry completeness test.
//
// Reference: redesign/evidence/C-18/cookie-inventory-source.md §1, the
// source-derived inventory of every cookie/storage mechanism that reaches an
// anonymous public/booking visitor (5 of the 12 mechanisms found; the other
// 7 are staff-only inside /admin and are explicitly out of this registry's
// scope — see that document's §5). The names below are transcribed directly
// from that inventory's table so this test fails the moment the registry and
// the inventory disagree about which items exist, in either direction —
// plus, separately, the cookies C-18 itself introduces, which no inventory
// pass could have observed because they did not exist when it ran.
import { describe, expect, it } from "vitest";
import {
  CONSENT_BANNER_VERSION,
  COOKIE_REGISTRY,
  type CookiePurpose,
  formatBannerVersionDate,
  groupRegistryByPurpose,
  type StorageMechanism,
} from "../cookie-registry";
import { CONSENT_COOKIE } from "../consent-state";

const INVENTORY_NAMES = [
  "zam-therapy-booking-draft-v3",
  "rahma-booking-contact-v1",
  "_ga / _ga_*",
  "maintenance-modal-seen",
  "sentryReplaySession",
] as const;

// C-18 Phase B, Step 3 adds a cookie no inventory pass could have found,
// because this plan is what introduces it: the consent cookie itself
// (CONSENT_COOKIE in src/lib/consent/consent-state.ts). It is held separately
// from INVENTORY_NAMES so the inventory list above stays a faithful
// transcription of the evidence document, and so a future inventory refresh
// can be diffed against it without this entry looking like a discrepancy.
const SELF_INTRODUCED_NAMES = ["rahma_consent"] as const;

const EXPECTED_NAMES: readonly string[] = [...INVENTORY_NAMES, ...SELF_INTRODUCED_NAMES];

const VALID_PURPOSES: CookiePurpose[] = ["essential", "functional", "analytics"];
const VALID_TYPES: StorageMechanism[] = ["cookie", "localStorage", "sessionStorage"];

describe("registry completeness (inventory <-> registry parity)", () => {
  it("has exactly the 5 inventoried entries plus the consent cookie C-18 adds", () => {
    expect(COOKIE_REGISTRY.length).toBe(EXPECTED_NAMES.length);
  });

  it("every expected item has a registry entry", () => {
    const registryNames = new Set(COOKIE_REGISTRY.map((entry) => entry.name));
    for (const name of EXPECTED_NAMES) {
      expect(registryNames.has(name), `missing registry entry for "${name}"`).toBe(true);
    }
  });

  it("has no registry entry beyond the expected set (symmetric check)", () => {
    const expected = new Set(EXPECTED_NAMES);
    for (const entry of COOKIE_REGISTRY) {
      expect(
        expected.has(entry.name),
        `registry entry "${entry.name}" is in neither the source inventory nor C-18's own additions`
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

  it("rahma_consent is registered as a first-party essential cookie", () => {
    const entry = COOKIE_REGISTRY.find((e) => e.name === CONSENT_COOKIE);
    expect(entry, `no registry entry for the consent cookie "${CONSENT_COOKIE}"`).toBeDefined();
    expect(entry?.type).toBe("cookie");
    expect(entry?.provider).toBe("Rahma Therapy");
    // Recording a consent choice is the textbook strictly-necessary case; if
    // this ever becomes anything else, the /cookies page would be offering to
    // switch off the thing that remembers the answer.
    expect(entry?.purpose).toBe("essential");
  });

  it("_ga / _ga_* is classified analytics", () => {
    const entry = COOKIE_REGISTRY.find((e) => e.name === "_ga / _ga_*");
    expect(entry).toBeDefined();
    expect(entry?.purpose).toBe("analytics");
    expect(entry?.type).toBe("cookie");
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
