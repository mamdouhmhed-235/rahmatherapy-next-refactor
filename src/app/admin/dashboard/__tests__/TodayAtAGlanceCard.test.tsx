// @vitest-environment jsdom
//
// C-11 Phase C (6b) — B-01 regression cover.
//
// Audit #01 recorded the Coordinator Snapshot card rendering a literal "()"
// between the "Today" heading and the value. There is no parenthesis anywhere
// in the DOM: the coordinator's zero-state drops the marquee to ~24-30px, and
// at that size `.admin-display` (Cormorant Garamond) loses the hairline apex
// and base of its `0` to antialiasing, leaving the two thick side stems — which
// read as "()". The fix keeps the deliberate zero-state downsize and renders
// that one state in the UI sans face, so the assertion that pins the bug is
// about which face the marquee uses, not about the text it contains.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { TodayAtAGlanceCard } from "../dashboard-cards";

const readiness = {
  confirmations: "All clear",
  staffCoverage: "Well covered",
  paymentCollection: "No activity yet",
};

function renderCard(props: { todayCount: number; unassignedFirst?: boolean }) {
  const { container } = render(
    <TodayAtAGlanceCard
      appointments={[]}
      rangeKind="today"
      rangeLabel="Today (Mon 25 May)"
      todayCount={props.todayCount}
      weekCount={0}
      readiness={readiness}
      unassignedFirst={props.unassignedFirst}
    />
  );
  const label = `${props.todayCount} booking${props.todayCount === 1 ? "" : "s"} today`;
  const marquee = container.querySelector<HTMLElement>(`p[aria-label="${label}"]`);
  if (!marquee) throw new Error(`marquee not found for aria-label="${label}"`);
  return { container, marquee };
}

describe("TodayAtAGlanceCard — B-01 marquee legibility", () => {
  it("renders the coordinator zero-state count in the UI face, not the hairline display face", () => {
    const { container, marquee } = renderCard({ todayCount: 0, unassignedFirst: true });

    expect(marquee.textContent).toBe("0");
    expect(marquee.classList.contains("admin-display")).toBe(false);
    expect(marquee.classList.contains("font-sans")).toBe(true);
    // The reported symptom, asserted directly: nothing in the card renders a
    // stray parenthetical around the count.
    expect(container.textContent).not.toContain("()");
    expect(container.textContent).not.toContain("( )");
  });

  it("keeps the display face for the coordinator's non-zero count", () => {
    const { marquee } = renderCard({ todayCount: 3, unassignedFirst: true });

    expect(marquee.textContent).toBe("3");
    expect(marquee.classList.contains("admin-display")).toBe(true);
  });

  it("leaves the business variant's zero-state marquee on the display face", () => {
    const { container, marquee } = renderCard({ todayCount: 0 });

    expect(marquee.textContent).toBe("0");
    expect(marquee.classList.contains("admin-display")).toBe(true);
    expect(container.textContent).not.toContain("()");
  });
});
