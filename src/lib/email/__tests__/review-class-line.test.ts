import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// Defence in depth: this file only exercises pure render functions, but
// templates.ts pulls client.ts into the module graph, and sendEmail there is an
// unguarded wrapper over the real Resend SDK with a live key in this env.
vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn(),
  getFromEmail: vi.fn(() => "Rahma Therapy <no-reply@rahmatherapy.example.test>"),
  extractEmailAddress: vi.fn((value: string) => value),
}));

import {
  renderReviewRequestEmail,
  renderReviewRequestPlainText,
  resolveReviewClassLine,
  type ReviewMessageVariant,
  type ReviewRequestEmailInput,
} from "../templates";
import { findTemplate } from "@/app/admin/emails/components/templates-data";

/**
 * Item 1 Step 1e — the review-request email varies one line by client class
 * (Owner decision 6; wording approved 2026-08-12).
 *
 * ⛔ Copy is asserted against the REGISTRY's defaultValue, never against a
 * string typed into this file and never against the source text. These three
 * fields deliberately set `placeholder` equal to `defaultValue`, so a
 * source-text guard could match the placeholder while the real default had
 * been gutted — the exact shape that made a guard toothless last session.
 * Reading the registry is immune to that.
 */

const CLASSES = ["first_time", "returning", "series"] as const;

function registryDefault(clientClass: (typeof CLASSES)[number]): string {
  const template = findTemplate("review_request_client");
  const field = template?.fields.find((f) => f.kind === `class_line_${clientClass}`);
  if (!field?.defaultValue) {
    throw new Error(`no registry default for class_line_${clientClass}`);
  }
  return field.defaultValue;
}

/**
 * JSX and template literals wrap sentences; a reflow is not a copy change.
 * The HTML leg also escapes, so "It's" arrives as "It&#39;s" — decode first,
 * or an approved sentence containing an apostrophe fails for the wrong reason.
 */
const flatten = (s: string) =>
  s
    // templates.ts's escapeHtml emits the zero-padded &#039; form.
    .replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const BASE_INPUT: ReviewRequestEmailInput = {
  bookingReference: "RT-TEST-1",
  bookingDate: "2026-08-01",
  startTime: "10:00",
  participants: [{ name: "Sample Client", services: ["Deep tissue massage"] }],
  manageUrl: "https://rahmatherapy.example.test/booking/manage?token=stub",
  groupCategory: "massage",
  city: "Luton",
} as unknown as ReviewRequestEmailInput;

const VARIANTS: ReviewMessageVariant[] = [
  { text: "A sample review.", source: "default" },
];

describe("review-request class line (Step 1e)", () => {
  it("registers a distinct, non-empty default for each of the three classes", () => {
    const defaults = CLASSES.map(registryDefault);
    expect(new Set(defaults).size).toBe(3);
    for (const d of defaults) expect(d.trim().length).toBeGreaterThan(0);
  });

  it.each(CLASSES)("renders the %s line in BOTH the HTML and plain-text legs", async (clientClass) => {
    const input = { ...BASE_INPUT, clientClass };
    const expected = flatten(registryDefault(clientClass));

    const html = await renderReviewRequestEmail(input, {}, VARIANTS);
    const text = renderReviewRequestPlainText(input, VARIANTS, {});

    expect(flatten(html)).toContain(expected);
    expect(flatten(text)).toContain(expected);
  });

  it("never shows a class line meant for a different class", async () => {
    const html = await renderReviewRequestEmail(
      { ...BASE_INPUT, clientClass: "series" },
      {},
      VARIANTS
    );
    expect(flatten(html)).toContain(flatten(registryDefault("series")));
    expect(flatten(html)).not.toContain(flatten(registryDefault("first_time")));
    expect(flatten(html)).not.toContain(flatten(registryDefault("returning")));
  });

  it("omits the line entirely when the class is unknown, rather than defaulting", async () => {
    // A generic fallback would claim a familiarity we have not established.
    const html = await renderReviewRequestEmail(BASE_INPUT, {}, VARIANTS);
    const text = renderReviewRequestPlainText(BASE_INPUT, VARIANTS, {});
    for (const c of CLASSES) {
      expect(flatten(html)).not.toContain(flatten(registryDefault(c)));
      expect(flatten(text)).not.toContain(flatten(registryDefault(c)));
    }
  });

  it("leaves the HTML byte-identical when there is no class line", async () => {
    // The render-parity baseline fixture passes no clientClass. If the absent
    // branch emitted even whitespace, that guard would fail — it did, once.
    const withoutField = await renderReviewRequestEmail(BASE_INPUT, {}, VARIANTS);
    const withExplicitNull = await renderReviewRequestEmail(
      { ...BASE_INPUT, clientClass: null },
      {},
      VARIANTS
    );
    expect(withExplicitNull).toBe(withoutField);
  });

  it("lets an admin override beat the class default, like every other field", async () => {
    const overrides = { class_line_series: "Overridden series line." };
    const html = await renderReviewRequestEmail(
      { ...BASE_INPUT, clientClass: "series" },
      overrides,
      VARIANTS
    );
    expect(flatten(html)).toContain("Overridden series line.");
    expect(flatten(html)).not.toContain(flatten(registryDefault("series")));
  });

  it("resolveReviewClassLine returns null for an absent class, not an empty string", () => {
    // null is what the render legs branch on; "" would render an empty <p>.
    expect(resolveReviewClassLine(null, {})).toBeNull();
    expect(resolveReviewClassLine(undefined, {})).toBeNull();
    expect(resolveReviewClassLine("series", {})).toBe(registryDefault("series"));
  });

  // ⛔ Gotcha 39. Every hand-built Supabase stub returns the whole mock row
  // regardless of what the select asked for, so dropping recurring_template_id
  // from sendReviewRequestEmail's select breaks NO behavioural test while
  // silently making every series client look like a returning one. Only
  // reading the source catches it.
  it("keeps recurring_template_id in sendReviewRequestEmail's booking select", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/email/notifications.ts"),
      "utf8"
    );
    const anchor = "export async function sendReviewRequestEmail";
    expect(source.split(anchor)).toHaveLength(2);
    const select = source.split(anchor)[1].split(".maybeSingle<")[0];

    expect(select).toContain("recurring_template_id");
    expect(select).toContain("client_id");
  });
});
