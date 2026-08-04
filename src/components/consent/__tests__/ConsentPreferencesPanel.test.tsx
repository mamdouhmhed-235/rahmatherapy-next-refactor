// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://localhost:3000/" }
//
// C-18 Phase C — second-layer behaviour: no pre-ticks, registry-driven toggles,
// and the dialog affordances the ICO guidance and WCAG both require.
//
// The https origin is load-bearing — see the note in CookieBanner.test.tsx.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CONSENT_COOKIE, readConsent } from "@/lib/consent/consent-state";
import {
  CONSENT_BANNER_VERSION,
  COOKIE_REGISTRY,
  PURPOSE_LABELS,
} from "@/lib/consent/cookie-registry";
import { CookieBanner } from "../CookieBanner";
import { GATED_PURPOSES } from "../ConsentPreferencesPanel";
import { resetConsentStoreForTests } from "../consent-store";

const ID = "3f1d5f6e-1c2b-4a3d-9e8f-0a1b2c3d4e5f";
const TS = "2026-08-04T00:00:00.000Z";

function setRawConsentCookie(payload: unknown) {
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}; Path=/`;
}

function clearAllCookies() {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

function panel() {
  return screen.queryByRole("dialog");
}

async function openPanelFromBanner(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Cookie settings" }));
  return screen.getByRole("dialog");
}

beforeEach(() => {
  clearAllCookies();
  resetConsentStoreForTests();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  cleanup();
  clearAllCookies();
});

describe("opening the panel", () => {
  it("opens from the banner's Cookie settings control", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);

    expect(panel()).toBeNull();
    const dialog = await openPanelFromBanner(user);

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(within(dialog).getByText("Cookie settings")).toBeTruthy();
  });

  it("opens from any [data-cookie-settings-trigger] control on the page", async () => {
    // This is the path the /cookies page's "change your choices" link takes, and
    // the one Phase F's footer link will take: the trigger stays a plain server-
    // rendered anchor and this delegated listener answers the click.
    const user = userEvent.setup();
    render(
      <>
        <a href="?cookie-settings=1" data-cookie-settings-trigger="true">
          Change your choices
        </a>
        <CookieBanner />
      </>
    );

    await user.click(screen.getByRole("link", { name: "Change your choices" }));
    expect(panel()).toBeTruthy();
  });

  it("opens on load when the page is reached with ?cookie-settings=1", () => {
    window.history.replaceState({}, "", "/cookies/?cookie-settings=1");
    render(<CookieBanner />);
    expect(panel()).toBeTruthy();
  });

  it("is reachable even after a choice has been made, so a choice can be changed", async () => {
    setRawConsentCookie({
      v: CONSENT_BANNER_VERSION,
      id: ID,
      choices: { analytics: true, functional: true },
      ts: TS,
    });
    const user = userEvent.setup();
    render(
      <>
        <a href="?cookie-settings=1" data-cookie-settings-trigger="true">
          Change your choices
        </a>
        <CookieBanner />
      </>
    );

    expect(screen.queryByRole("region", { name: "Cookie choices" })).toBeNull();
    await user.click(screen.getByRole("link", { name: "Change your choices" }));
    expect(panel()).toBeTruthy();
  });
});

describe("what the panel offers", () => {
  it("renders one control per non-essential purpose in the registry — no hand-maintained list", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);
    const dialog = await openPanelFromBanner(user);

    const switchable = within(dialog)
      .getAllByRole("checkbox")
      .filter((input) => !(input as HTMLInputElement).disabled);

    expect(switchable).toHaveLength(GATED_PURPOSES.length);
    for (const purpose of GATED_PURPOSES) {
      expect(
        within(dialog).getByRole("checkbox", { name: PURPOSE_LABELS[purpose] })
      ).toBeTruthy();
    }
  });

  it("has no pre-ticks: every non-essential control is off when nothing is stored", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);
    const dialog = await openPanelFromBanner(user);

    for (const purpose of GATED_PURPOSES) {
      const input = within(dialog).getByRole("checkbox", {
        name: PURPOSE_LABELS[purpose],
      }) as HTMLInputElement;
      expect(input.checked, purpose).toBe(false);
      expect(input.disabled, purpose).toBe(false);
    }
  });

  it("locks Essential on and explains why it cannot be turned off", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);
    const dialog = await openPanelFromBanner(user);

    const essential = within(dialog).getByRole("checkbox", {
      name: PURPOSE_LABELS.essential,
    }) as HTMLInputElement;

    expect(essential.checked).toBe(true);
    expect(essential.disabled).toBe(true);
    // Locked is not enough on its own — the panel has to say what these are for,
    // or "you can't turn this off" is an instruction rather than an explanation.
    expect(
      within(dialog).getByText(/can't do what you've asked it to do/i)
    ).toBeTruthy();
  });

  it("discloses every registry entry, from the registry itself", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);
    const dialog = await openPanelFromBanner(user);

    for (const entry of COOKIE_REGISTRY) {
      expect(within(dialog).getByText(entry.name), entry.name).toBeTruthy();
      expect(within(dialog).getByText(entry.description), entry.name).toBeTruthy();
    }
  });

  it("comes up pre-filled with what was chosen last time", async () => {
    setRawConsentCookie({
      v: CONSENT_BANNER_VERSION,
      id: ID,
      choices: { analytics: true, functional: false },
      ts: TS,
    });
    const user = userEvent.setup();
    render(
      <>
        <a href="?cookie-settings=1" data-cookie-settings-trigger="true">
          Change your choices
        </a>
        <CookieBanner />
      </>
    );

    await user.click(screen.getByRole("link", { name: "Change your choices" }));
    const dialog = screen.getByRole("dialog");

    expect(
      (within(dialog).getByRole("checkbox", { name: PURPOSE_LABELS.analytics }) as HTMLInputElement)
        .checked
    ).toBe(true);
    expect(
      (
        within(dialog).getByRole("checkbox", {
          name: PURPOSE_LABELS.functional,
        }) as HTMLInputElement
      ).checked
    ).toBe(false);
  });
});

describe("saving from the panel", () => {
  it("Save choices stores exactly what the controls say", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);
    const dialog = await openPanelFromBanner(user);

    await user.click(
      within(dialog).getByRole("checkbox", { name: PURPOSE_LABELS.functional })
    );
    await user.click(within(dialog).getByRole("button", { name: "Save choices" }));

    expect(readConsent(document.cookie)?.choices).toEqual({
      analytics: false,
      functional: true,
    });
    expect(panel()).toBeNull();
  });

  it("Accept all and Reject all are offered here too, at the same weight", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);
    const dialog = await openPanelFromBanner(user);

    const accept = within(dialog).getByRole("button", { name: "Accept all" });
    const reject = within(dialog).getByRole("button", { name: "Reject all" });
    const save = within(dialog).getByRole("button", { name: "Save choices" });
    expect(accept.className).toBe(reject.className);
    expect(save.className).toBe(reject.className);

    await user.click(accept);
    expect(readConsent(document.cookie)?.choices).toEqual({
      analytics: true,
      functional: true,
    });
  });

  it("Reject all from the panel denies everything, whatever the controls were set to", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);
    const dialog = await openPanelFromBanner(user);

    await user.click(
      within(dialog).getByRole("checkbox", { name: PURPOSE_LABELS.analytics })
    );
    await user.click(within(dialog).getByRole("button", { name: "Reject all" }));

    expect(readConsent(document.cookie)?.choices).toEqual({
      analytics: false,
      functional: false,
    });
  });
});

describe("dialog accessibility", () => {
  it("moves focus into the dialog when it opens", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);
    const dialog = await openPanelFromBanner(user);

    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("closes on Escape and puts focus back on the control that opened it", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);

    const opener = screen.getByRole("button", { name: "Cookie settings" });
    await user.click(opener);
    expect(panel()).toBeTruthy();

    await user.keyboard("{Escape}");

    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("closes from its own close button without recording anything", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);
    const dialog = await openPanelFromBanner(user);

    await user.click(within(dialog).getByRole("button", { name: "Close cookie settings" }));

    expect(panel()).toBeNull();
    expect(readConsent(document.cookie)).toBeNull();
    expect(screen.queryByRole("region", { name: "Cookie choices" })).toBeTruthy();
  });
});
