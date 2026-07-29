import { describe, expect, it } from "vitest";
import { pickReviewMessages } from "../templates";

// Mirrors DEFAULT_REVIEW_VARIANTS in ../templates.ts (module-private, not
// exported) so these tests can assert against the real customer-facing copy
// without widening that module's public surface. Keep in sync with C-01
// brief §2.2 if the copy ever changes.
const MASSAGE_TEMPLATES = [
  "I had a brilliant home massage in {city} today — really professional setup, felt completely relaxed by the end.",
  "Booked a home massage with Rahma Therapy in {city}. The therapist was excellent, the experience felt like a proper clinic but in the comfort of home.",
  "Just had a fantastic massage at home in {city}. Highly skilled, deeply relaxing, and so easy not having to travel.",
  "Tried Rahma Therapy for a mobile massage in {city} — top quality. Will definitely book again.",
  "Excellent home massage experience in {city}. Calm, professional, and exactly what I needed.",
];

const CUPPING_TEMPLATES = [
  "Had a hijama session at home in {city} with Rahma Therapy. Very clean, hygienic, and the practitioner was knowledgeable and respectful.",
  "Booked hijama at home in {city} — proper Sunnah practice, sterile equipment, and a calming atmosphere. Highly recommend.",
  "Excellent home hijama appointment in {city}. Felt looked after from start to finish, the setup was spotless and professional.",
  "Tried Rahma Therapy for hijama in {city} and couldn't be happier. Knowledgeable practitioner, careful technique, and great aftercare.",
  "First hijama session in {city} and it was a brilliant experience. Clean, professional, and the practitioner explained every step.",
];

// pickReviewMessages shuffles via `pool.sort(() => random() - 0.5)`. A
// random fn that always returns 0.5 makes every comparison return 0, and
// Array.prototype.sort is spec-stable, so the pool never reorders — the
// picked set is always the first 3 entries (variant_1..variant_3) in
// insertion order. Used throughout for deterministic assertions.
const STABLE_RANDOM = () => 0.5;

describe("pickReviewMessages", () => {
  it("massage, no overrides: picks 3 variants from the massage pool with {city} substituted", () => {
    const picked = pickReviewMessages({
      groupCategory: "massage",
      city: "Luton",
      overrides: {},
      random: STABLE_RANDOM,
    });

    expect(picked).toHaveLength(3);
    const expectedTexts = MASSAGE_TEMPLATES.map((t) => t.replace("{city}", "Luton"));
    for (const variant of picked) {
      expect(variant.source).toBe("default");
      expect(expectedTexts).toContain(variant.text);
    }
  });

  it("cupping, no overrides: picks 3 variants from the cupping pool", () => {
    const picked = pickReviewMessages({
      groupCategory: "cupping",
      city: "Luton",
      overrides: {},
      random: STABLE_RANDOM,
    });

    expect(picked).toHaveLength(3);
    const expectedTexts = CUPPING_TEMPLATES.map((t) => t.replace("{city}", "Luton"));
    for (const variant of picked) {
      expect(variant.source).toBe("default");
      expect(expectedTexts).toContain(variant.text);
    }
  });

  it("substitutes an override that lands in the picked set", () => {
    // STABLE_RANDOM preserves insertion order, so the picked set is always
    // variant_1..variant_3 — massage_variant_2 is guaranteed to be picked.
    const picked = pickReviewMessages({
      groupCategory: "massage",
      city: "Luton",
      overrides: { massage_variant_2: "custom override" },
      random: STABLE_RANDOM,
    });

    expect(picked).toHaveLength(3);
    const overridden = picked.find((v) => v.source === "override");
    expect(overridden?.text).toBe("custom override");
    expect(picked.filter((v) => v.source === "default")).toHaveLength(2);
  });

  it("falls back to the massage pool when groupCategory is null", () => {
    const picked = pickReviewMessages({
      groupCategory: null,
      city: "Luton",
      overrides: {},
      random: STABLE_RANDOM,
    });

    expect(picked).toHaveLength(3);
    const expectedTexts = MASSAGE_TEMPLATES.map((t) => t.replace("{city}", "Luton"));
    for (const variant of picked) {
      expect(expectedTexts).toContain(variant.text);
    }
  });

  it('strips " in {city}" cleanly when city is null', () => {
    const picked = pickReviewMessages({
      groupCategory: "massage",
      city: null,
      overrides: {},
      random: STABLE_RANDOM,
    });

    expect(picked).toHaveLength(3);
    for (const variant of picked) {
      expect(variant.text).not.toContain("{city}");
      expect(variant.text).not.toMatch(/\s{2,}/); // no doubled-up spaces left behind
    }
    // variant_1 (first pick under STABLE_RANDOM) strips to this exact string.
    expect(picked[0].text).toBe(
      "I had a brilliant home massage today — really professional setup, felt completely relaxed by the end."
    );
  });

  it("is deterministic for an injected random function", () => {
    const args = {
      groupCategory: "massage" as const,
      city: "Luton",
      overrides: {},
      random: STABLE_RANDOM,
    };

    const first = pickReviewMessages(args);
    const second = pickReviewMessages(args);

    const expectedTexts = MASSAGE_TEMPLATES.slice(0, 3).map((t) => t.replace("{city}", "Luton"));
    expect(first.map((v) => v.text)).toEqual(expectedTexts);
    expect(second.map((v) => v.text)).toEqual(expectedTexts);
  });
});
