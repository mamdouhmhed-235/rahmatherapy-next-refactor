import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FaqCategoryAccordions } from "../FaqCategoryAccordions";
import { faqCategories } from "@/content/pages/faqsAftercare";

/**
 * Guards the Phase 8 change (SEO-AEO-GEO-IMPLEMENTATION.md).
 *
 * Before it, only the ACTIVE category's panel existed in the DOM, so 4 of the
 * site's 31 FAQs reached the served HTML and the other 27 appeared only after a
 * tab click. No major AI crawler except Googlebot executes JavaScript, and
 * Google does not click tabs, so those answers were invisible to search and to
 * answer engines alike.
 *
 * The regression this file exists to catch is someone "optimising" the render
 * back to active-only. That would look completely correct in a browser — the
 * visible behaviour is identical — which is exactly why it needs a test.
 */

const allQuestions = faqCategories.flatMap((c) => c.faqs.map((f) => f.question));

describe("FaqCategoryAccordions", () => {
  it("renders every category's panel, not just the active one", () => {
    render(<FaqCategoryAccordions />);
    const panels = screen
      .getAllByRole("tabpanel", { hidden: true })
      .filter((p) => p.id.startsWith("faq-panel-"));
    expect(panels).toHaveLength(faqCategories.length);
  });

  it("puts all 31 questions in the DOM so crawlers see them without clicking", () => {
    render(<FaqCategoryAccordions />);
    expect(allQuestions.length).toBe(31);
    for (const question of allQuestions) {
      // hidden: true — present in the DOM is the whole point, visible or not
      expect(screen.getByRole("button", { name: question, hidden: true })).toBeTruthy();
    }
  });

  it("shows exactly one panel at a time, so the visible UX is unchanged", () => {
    render(<FaqCategoryAccordions />);
    const panels = screen
      .getAllByRole("tabpanel", { hidden: true })
      .filter((p) => p.id.startsWith("faq-panel-"));
    const shown = panels.filter((p) => !p.hasAttribute("hidden"));
    expect(shown).toHaveLength(1);
    expect(shown[0].id).toBe(`faq-panel-${faqCategories[0].id}`);
  });

  it("hides inactive panels with the hidden attribute, not visually only", () => {
    // Visual-only hiding would leave every panel in the accessibility tree, so
    // a screen reader would announce all seven categories at once.
    render(<FaqCategoryAccordions />);
    const panels = screen
      .getAllByRole("tabpanel", { hidden: true })
      .filter((p) => p.id.startsWith("faq-panel-"));
    const hidden = panels.filter((p) => p.hasAttribute("hidden"));
    expect(hidden).toHaveLength(faqCategories.length - 1);
  });

  it("switches which panel is revealed when a tab is clicked", async () => {
    const user = userEvent.setup();
    render(<FaqCategoryAccordions />);
    const last = faqCategories[faqCategories.length - 1];

    await user.click(screen.getByRole("tab", { name: last.label }));

    const panels = screen
      .getAllByRole("tabpanel", { hidden: true })
      .filter((p) => p.id.startsWith("faq-panel-"));
    const shown = panels.filter((p) => !p.hasAttribute("hidden"));
    expect(shown).toHaveLength(1);
    expect(shown[0].id).toBe(`faq-panel-${last.id}`);
  });
});
