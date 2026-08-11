// Item 2 — the privacy page's first test, and the first test anywhere under
// src/app/(public)/.
//
// Section 6 used to promise "7 years" and "around 12 months". Nothing in this
// codebase deletes anything by age — no cron route, no trigger, no pg_cron
// schedule — so those were durations the site could not keep. The rewrite
// states the *criteria* instead (UK GDPR Art. 13(2)(a)'s second limb).
//
// Two of these cases are red-before/green-after guards for that rewrite
// ("does not promise…", "describes retention by criteria…"). The other three
// are invariant guards: they pass before and after by design, and each was
// teeth-checked against a targeted mutant rather than against the pre-fix
// file — removing the analytics sentence, removing section 6, and removing
// the anchor each turn their case red. Evidence:
// redesign/evidence/post-band-c-impl/item-2/.
//
// No @testing-library/jest-dom in this repo (see AboutYouStep.test.tsx for the
// stated convention) — assert on plain DOM properties, never toBeInTheDocument.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import PrivacyPolicyPage from "./page";

afterEach(() => {
  cleanup();
});

function renderSectionSix() {
  const { container } = render(<PrivacyPolicyPage />);
  const section = container.querySelector("#how-long-we-keep-it");
  return { container, section, text: section?.textContent ?? "" };
}

describe("privacy policy — section 6, how long we keep it", () => {
  it("does not promise a specific retention duration in section 6", () => {
    const { text } = renderSectionSix();

    // The two the rewrite removed.
    expect(text).not.toMatch(/7 years?/i);
    expect(text).not.toMatch(/12 months?/i);
    // And any duration at all creeping back in later, digits or words —
    // "a few years" is still a promise this site cannot keep.
    expect(text).not.toMatch(/\b\d+\s*(day|week|month|year)s?\b/i);
    expect(text).not.toMatch(
      /\b(a|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|several|few)\s+(day|week|month|year)s?\b/i,
    );
  });

  it("keeps the analytics retention sentence in section 6", () => {
    const { text } = renderSectionSix();

    // Kept byte-for-byte by Owner decision. No banned-duration grep can catch
    // this sentence being silently dropped, which is why it is asserted here.
    // JSX decodes &apos; to U+0027, not the curly U+2019 — straight quotes.
    expect(text).toContain(
      "Analytics information, where you've given consent for it, is kept according to Google's own retention settings.",
    );
  });

  it("keeps section headings numbered contiguously with no gap", () => {
    const { container } = renderSectionSix();

    const numbers = Array.from(container.querySelectorAll("section[id] > h3"))
      .map((h) => h.textContent?.match(/^(\d+)\./)?.[1])
      .filter((n): n is string => n !== undefined)
      .map(Number);

    expect(numbers.length).toBe(9);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("keeps the how-long-we-keep-it anchor", () => {
    const { section } = renderSectionSix();

    expect(section).not.toBeNull();
  });

  it("describes retention by criteria, not a fixed date", () => {
    const { text } = renderSectionSix();

    // The criteria limb: a basis, what it depends on, and an explicit denial
    // that a fixed period is being promised.
    expect(text).toMatch(/for as long as they're needed/i);
    expect(text).toMatch(/depends on the type of record/i);
    expect(text).toMatch(/rather than a fixed period/i);
    // The rights pointer, which is the only real mechanism behind any of this:
    // deletion here is request-triggered and staff-actioned, never automatic.
    expect(text).toMatch(/ask us to delete it/i);
  });
});
