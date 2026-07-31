// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../ThemeProvider";

const saveThemePreference = vi.hoisted(() =>
  vi.fn(async () => ({ success: true as const }))
);

vi.mock("../theme-actions", () => ({ saveThemePreference }));

// ── matchMedia stub with a MUTABLE match, so a spec can simulate the user
//    switching their OS between light and dark mid-session.
let prefersDark = true;
let mediaListeners: Array<() => void> = [];
let removeListenerSpy: ReturnType<typeof vi.fn>;

function stubMatchMedia(initiallyDark: boolean) {
  prefersDark = initiallyDark;
  mediaListeners = [];
  removeListenerSpy = vi.fn();
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      get matches() {
        return prefersDark;
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => {
        mediaListeners.push(listener);
      },
      removeEventListener: removeListenerSpy,
    }))
  );
}

function fireOsChange(matches: boolean) {
  act(() => {
    prefersDark = matches;
    for (const listener of mediaListeners) listener();
  });
}

function wrapper() {
  return document.querySelector("[data-admin-theme-root]");
}

function themeAttribute() {
  return wrapper()?.getAttribute("data-theme");
}

function Probe() {
  const { theme, effectiveTheme, setTheme } = useTheme();
  return (
    <>
      <span data-testid="theme">{theme}</span>
      <span data-testid="effective">{effectiveTheme}</span>
      <button type="button" onClick={() => setTheme("light")}>
        pick light
      </button>
      <button type="button" onClick={() => setTheme("system")}>
        pick system
      </button>
    </>
  );
}

function renderProvider(initialTheme: "dark" | "light" | "system") {
  return render(
    <ThemeProvider initialTheme={initialTheme}>
      <Probe />
    </ThemeProvider>
  );
}

beforeEach(() => {
  stubMatchMedia(true);
  saveThemePreference.mockClear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ThemeProvider", () => {
  it("honours the initial theme on its own wrapper element", () => {
    renderProvider("light");
    expect(themeAttribute()).toBe("light");
    expect(screen.getByTestId("theme").textContent).toBe("light");
    expect(screen.getByTestId("effective").textContent).toBe("light");
  });

  it("defaults dark and ignores a light OS preference unless 'system' was chosen", () => {
    stubMatchMedia(false);
    renderProvider("dark");
    // Brief §1.3 — prefers-color-scheme is a TERTIARY fallback, reachable only
    // through an explicit "system" choice. It must not override the default a
    // user with no stored preference gets.
    expect(themeAttribute()).toBe("dark");
  });

  it("setTheme updates the wrapper attribute and persists to DB + localStorage", () => {
    renderProvider("dark");
    fireEvent.click(screen.getByText("pick light"));

    expect(themeAttribute()).toBe("light");
    expect(saveThemePreference).toHaveBeenCalledWith("light");
    expect(localStorage.getItem("rahma-admin-theme")).toBe("light");
  });

  it("resolves 'system' from the OS preference and reacts to an OS change", () => {
    stubMatchMedia(false);
    renderProvider("system");
    expect(themeAttribute()).toBe("light");
    expect(screen.getByTestId("theme").textContent).toBe("system");

    fireOsChange(true);
    expect(themeAttribute()).toBe("dark");
  });

  it("unsubscribes from the media query on unmount", () => {
    const view = renderProvider("system");
    view.unmount();
    expect(removeListenerSpy).toHaveBeenCalled();
  });

  // ── The regression this whole wrapper-scoping decision exists to prevent ──
  // src/components/ui/input.tsx + badge.tsx consume --admin-* tokens and render
  // on /booking/manage, a URL-token-authenticated CUSTOMER route that shares the
  // single root <html>. If the theme attribute ever lands on documentElement or
  // <body>, that page inherits admin theming. It must never happen.
  it("never writes the theme attribute to <html> or <body>", () => {
    const setAttributeSpy = vi.spyOn(Element.prototype, "setAttribute");

    renderProvider("system");
    fireEvent.click(screen.getByText("pick light"));
    fireEvent.click(screen.getByText("pick system"));
    fireOsChange(false);

    for (const root of [document.documentElement, document.body]) {
      expect(root.hasAttribute("data-theme")).toBe(false);
      expect(root.hasAttribute("data-admin-theme-root")).toBe(false);
      expect(root.dataset.theme).toBeUndefined();
    }

    const rootWrites = setAttributeSpy.mock.instances.filter(
      (instance) => instance === document.documentElement || instance === document.body
    );
    expect(rootWrites).toHaveLength(0);
    setAttributeSpy.mockRestore();
  });

  it("leaves nothing behind on <html>, <body> or the DOM after unmount", () => {
    const bodyChildrenBefore = document.body.children.length;
    const view = renderProvider("dark");
    expect(wrapper()).not.toBeNull();

    view.unmount();

    // There is no marker outside the wrapper to clean up: tokens.css keys the
    // portal arm on the wrapper itself ("<wrapper> ~ *"), so removing the
    // wrapper removes the theming. Nothing can leak onto a public route.
    expect(wrapper()).toBeNull();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(document.body.hasAttribute("data-theme")).toBe(false);
    cleanup();
    expect(document.body.children.length).toBe(bodyChildrenBefore);
  });

  it("keeps the chosen theme applied when the persistence call fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    saveThemePreference.mockResolvedValueOnce({
      success: false,
      error: "Not authenticated.",
    } as never);

    renderProvider("dark");
    fireEvent.click(screen.getByText("pick light"));
    await act(async () => {});

    expect(themeAttribute()).toBe("light");
    expect(consoleError).toHaveBeenCalledWith(
      "saveThemePreference failed:",
      "Not authenticated."
    );
    consoleError.mockRestore();
  });
});
