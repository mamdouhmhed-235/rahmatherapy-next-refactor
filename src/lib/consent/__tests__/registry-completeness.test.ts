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
  NON_ESSENTIAL_PURPOSES,
  formatBannerVersionDate,
  groupRegistryByPurpose,
  type StorageMechanism,
} from "../cookie-registry";
import { CONSENT_COOKIE, type ConsentChoices } from "../consent-state";

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

// C-20 Step 9 adds the Google Maps Platform disclosure — likewise a name no
// C-18 inventory pass could have found, because the address-autocomplete
// feature didn't exist when that inventory ran.
const GOOGLE_MAPS_ENTRY_NAME =
  "Google Maps Platform (Google does not publish a cookie name for this API)";
const C20_INTRODUCED_NAMES = [GOOGLE_MAPS_ENTRY_NAME] as const;

const EXPECTED_NAMES: readonly string[] = [
  ...INVENTORY_NAMES,
  ...SELF_INTRODUCED_NAMES,
  ...C20_INTRODUCED_NAMES,
];

const VALID_PURPOSES: CookiePurpose[] = ["essential", "functional", "analytics"];
const VALID_TYPES: StorageMechanism[] = ["cookie", "localStorage", "sessionStorage"];

describe("registry completeness (inventory <-> registry parity)", () => {
  it("has exactly the 5 inventoried entries plus what C-18 and C-20 each add", () => {
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

  it("rahma-booking-contact-v1 is classified functional, and no longer provisionally", () => {
    // The Owner ruled on 2026-08-04 that it stays "functional" and gets a real
    // gate (progress §3 #6), so the provisional-classification note it carried
    // while that was outstanding has gone. The gate itself is tested in
    // src/features/booking/__tests__/returning-customer-consent-gate.test.ts.
    const entry = COOKIE_REGISTRY.find((e) => e.name === "rahma-booking-contact-v1");
    expect(entry).toBeDefined();
    expect(entry?.purpose).toBe("functional");
    expect(entry).not.toHaveProperty("provisionalNote");
  });

  it("maintenance-modal-seen is not described as inactive", () => {
    // MAINTENANCE_MODE is `true` in the committed source, whatever a given
    // working copy says, so any deploy mounts the modal and writes this key.
    // An earlier pass read a local `false` and marked the entry dormant, which
    // told visitors a feature was switched off when the shipping code has it on.
    const entry = COOKIE_REGISTRY.find((e) => e.name === "maintenance-modal-seen");
    expect(entry).toBeDefined();
    expect(entry).not.toHaveProperty("dormant");
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

  it("the Google Maps Platform entry is classified essential, not functional", () => {
    // Owner decision 2026-08-09: functional-on-interaction, not consent-gated
    // — Maps loads on address-field focus regardless of the visitor's
    // functional-consent choice. "functional" would falsely imply the real
    // gate that entry's PURPOSE_DESCRIPTIONS group promises (see the entry's
    // own comment in cookie-registry.ts); "essential" is the bucket whose
    // definition — strictly necessary for a function the visitor themselves
    // requested, exempt from consent — actually matches this behaviour.
    const entry = COOKIE_REGISTRY.find((e) => e.name === GOOGLE_MAPS_ENTRY_NAME);
    expect(entry).toBeDefined();
    expect(entry?.purpose).toBe("essential");
    expect(entry?.type).toBe("cookie");
    expect(entry?.provider).toBe("Google (Google Maps Platform)");
  });
});

describe("CONSENT_BANNER_VERSION", () => {
  it("is the current value, bumped by C-20 Step 9's Google Maps entry (2026-08-09)", () => {
    expect(CONSENT_BANNER_VERSION).toBe("2026-08-09.1");
  });

  it("matches the documented date + counter format", () => {
    expect(CONSENT_BANNER_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });
});

describe("formatBannerVersionDate", () => {
  it("formats the current version's date in plain English", () => {
    expect(formatBannerVersionDate(CONSENT_BANNER_VERSION)).toBe("9 August 2026");
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

describe("ConsentChoices cannot silently drift from the registry", () => {
  it("has exactly one ConsentChoices key per purpose in NON_ESSENTIAL_PURPOSES", () => {
    // consent-store.ts's logConsentEvent derives the consent-proof beacon's
    // purposes_offered from NON_ESSENTIAL_PURPOSES rather than
    // Object.keys(state.choices) precisely so a purpose added to the registry
    // without a matching ConsentChoices key (consent-state.ts) fails here,
    // loudly, instead of silently producing an incomplete purposes_offered on
    // every beacon fired from then on. `sample` only needs to satisfy
    // ConsentChoices as it stands today — if a future purpose is added there
    // without a matching registry entry, TypeScript itself fails first,
    // before this test ever runs.
    const sample: ConsentChoices = { analytics: false, functional: false };
    expect(new Set(Object.keys(sample))).toEqual(new Set(NON_ESSENTIAL_PURPOSES));
  });
});

describe("purposes_offered (consent-proof log) cannot silently drift from the panel", () => {
  // public.consent_events.purposes_offered is a legal record of which
  // non-essential purposes a visitor was actually offered. logConsentEvent
  // (consent-store.ts) builds it from NON_ESSENTIAL_PURPOSES — the static
  // purpose TAXONOMY (cookie-registry.ts) — while the preferences panel
  // (ConsentPreferencesPanel.tsx, GATED_PURPOSES) renders one toggle per
  // purpose that groupRegistryByPurpose() actually returns, which drops any
  // purpose with zero live COOKIE_REGISTRY entries. The two sets are
  // member-identical today, but nothing enforces that: if the last registry
  // entry for a purpose were ever removed while the purpose stayed in the
  // taxonomy, the panel would render no toggle for it while the proof log
  // kept recording it as offered — a false statement in a legal record. This
  // is the opposite direction from "ConsentChoices cannot silently drift from
  // the registry" above, which pins NON_ESSENTIAL_PURPOSES against
  // ConsentChoices, not against what the panel actually renders — do not
  // delete this as a duplicate of that test.
  it("has exactly one NON_ESSENTIAL_PURPOSES entry per purpose with a live registry entry", () => {
    const offeredByPanel = groupRegistryByPurpose()
      .map((group) => group.purpose)
      .filter((purpose) => purpose !== "essential");
    expect(new Set(offeredByPanel)).toEqual(new Set(NON_ESSENTIAL_PURPOSES));
  });
});
