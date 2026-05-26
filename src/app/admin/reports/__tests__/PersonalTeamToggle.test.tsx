// B-4 step 2 — PersonalTeamToggle specs.

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PersonalTeamToggle } from "../PersonalTeamToggle";

const VIEWER_ID = "viewer-1";

describe("<PersonalTeamToggle>", () => {
  it("renders nothing when visible=false (Therapist case)", () => {
    const { container } = render(
      <PersonalTeamToggle visible={false} scope="team" viewerId={VIEWER_ID} filters={{}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders two Link options labelled Team and Personal when visible", () => {
    const { container } = render(
      <PersonalTeamToggle visible scope="team" viewerId={VIEWER_ID} filters={{}} />
    );
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(2);
    expect(links[0].textContent).toBe("Team");
    expect(links[1].textContent).toBe("Personal");
  });

  it("marks the active scope with aria-current='page'", () => {
    const { container } = render(
      <PersonalTeamToggle visible scope="personal" viewerId={VIEWER_ID} filters={{}} />
    );
    const links = container.querySelectorAll("a");
    expect(links[0].getAttribute("aria-current")).toBeNull();
    expect(links[1].getAttribute("aria-current")).toBe("page");
  });

  it("Personal href adds ?scope=personal&staffId={viewerId}, preserving other filters", () => {
    const { container } = render(
      <PersonalTeamToggle
        visible
        scope="team"
        viewerId={VIEWER_ID}
        filters={{ range: "week", source: "website" }}
      />
    );
    const personalHref = container.querySelectorAll("a")[1].getAttribute("href") ?? "";
    expect(personalHref).toContain("scope=personal");
    expect(personalHref).toContain(`staffId=${VIEWER_ID}`);
    expect(personalHref).toContain("range=week");
    expect(personalHref).toContain("source=website");
  });

  it("Team href clears scope + the auto-added staffId when it equals viewerId", () => {
    const { container } = render(
      <PersonalTeamToggle
        visible
        scope="personal"
        viewerId={VIEWER_ID}
        filters={{ scope: "personal", staffId: VIEWER_ID, range: "week" }}
      />
    );
    const teamHref = container.querySelectorAll("a")[0].getAttribute("href") ?? "";
    expect(teamHref).not.toContain("scope=");
    expect(teamHref).not.toContain("staffId=");
    expect(teamHref).toContain("range=week");
  });

  it("Team href preserves a manually-drilled staffId (different from viewerId)", () => {
    const { container } = render(
      <PersonalTeamToggle
        visible
        scope="team"
        viewerId={VIEWER_ID}
        filters={{ staffId: "other-staff", range: "week" }}
      />
    );
    const teamHref = container.querySelectorAll("a")[0].getAttribute("href") ?? "";
    expect(teamHref).toContain("staffId=other-staff");
    expect(teamHref).toContain("range=week");
  });

  it("Team href falls back to /admin/reports (no querystring) when no filters remain", () => {
    const { container } = render(
      <PersonalTeamToggle
        visible
        scope="personal"
        viewerId={VIEWER_ID}
        filters={{ scope: "personal", staffId: VIEWER_ID }}
      />
    );
    expect(container.querySelectorAll("a")[0].getAttribute("href")).toBe("/admin/reports");
  });

  it("uses fieldset/legend semantics for the scope group", () => {
    const { container } = render(
      <PersonalTeamToggle visible scope="team" viewerId={VIEWER_ID} filters={{}} />
    );
    expect(container.querySelector("fieldset")).not.toBeNull();
    expect(container.querySelector("legend")?.textContent).toBe("Report scope");
  });
});
