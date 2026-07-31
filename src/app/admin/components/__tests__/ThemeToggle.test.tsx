// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../ThemeProvider";
import { ThemeToggle } from "../ThemeToggle";

const saveThemePreference = vi.hoisted(() =>
  vi.fn(async () => ({ success: true as const }))
);

vi.mock("../theme-actions", () => ({ saveThemePreference }));

beforeEach(() => {
  saveThemePreference.mockClear();
  localStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderToggle(initialTheme: "dark" | "light" | "system" = "dark") {
  return render(
    <ThemeProvider initialTheme={initialTheme}>
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe("ThemeToggle", () => {
  it("renders an accessible dropdown with all three options", () => {
    renderToggle();
    const select = screen.getByLabelText("Theme") as HTMLSelectElement;

    expect(select.tagName).toBe("SELECT");
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      "dark",
      "light",
      "system",
    ]);
    // Brief Q9.3 — "System" must be reachable, which is why this is a dropdown
    // and not a cycle button.
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      "Dark",
      "Light",
      "System",
    ]);
  });

  it("shows the stored preference, not the resolved theme", () => {
    renderToggle("system");
    expect((screen.getByLabelText("Theme") as HTMLSelectElement).value).toBe("system");
  });

  it("fires the server action and re-themes the wrapper on selection", () => {
    renderToggle("dark");
    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "light" } });

    expect(saveThemePreference).toHaveBeenCalledWith("light");
    expect(
      document.querySelector("[data-admin-theme-root]")?.getAttribute("data-theme")
    ).toBe("light");
  });
});
