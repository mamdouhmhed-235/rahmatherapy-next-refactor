"use client";

import { createContext, useContext, useState, useSyncExternalStore } from "react";
import { saveThemePreference } from "./theme-actions";

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

function subscribeToColorScheme(onStoreChange: () => void) {
  const query = window.matchMedia(COLOR_SCHEME_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getColorSchemeSnapshot() {
  return window.matchMedia(COLOR_SCHEME_QUERY).matches;
}

/** The server cannot know the OS preference, so it assumes dark — which is also
 *  the no-preference default, so hydration always agrees with SSR. */
function getServerColorSchemeSnapshot() {
  return true;
}

export type Theme = "dark" | "light" | "system";

interface ThemeContextValue {
  theme: Theme;
  effectiveTheme: "dark" | "light";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  effectiveTheme: "dark",
  setTheme: () => {},
});

/** localStorage mirror of the DB preference. Read by nothing today — it exists
 *  so a future pre-hydration reader has a synchronous source. */
export const THEME_STORAGE_KEY = "rahma-admin-theme";

/**
 * Owns the admin theme AND the element the theme attribute lives on.
 *
 * ⛔ The attribute goes on THIS component's own wrapper element — never on
 * document.documentElement or <body> (Owner decision 2026-07-31, overriding
 * plan Steps 12/15). src/components/ui/input.tsx and badge.tsx consume
 * --admin-* tokens unconditionally and render on /booking/manage, a customer
 * route authenticated by a URL token that shares the single root <html>. With
 * the attribute on a wrapper inside the admin tree, public routes structurally
 * cannot inherit admin theming, whichever tokens they consume.
 *
 * Rendering the wrapper (rather than writing to a ref) is what makes that
 * guarantee mechanical: there is no imperative DOM write to get wrong, and the
 * attribute is server-rendered — this component is SSR'd with the preference
 * the admin layout already fetched, so "dark" and "light" reach the browser in
 * the first paint with no FOUC and no inline script.
 *
 * "system" is the one value the server cannot resolve, so SSR falls back to
 * dark (which is also the no-preference default) and the client snapshot
 * corrects it after hydration. Both renders agree, so there is no hydration
 * mismatch.
 */
export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  // The OS preference is an external store, so it is read through the
  // subscription primitive: React unsubscribes on unmount, and a mid-session OS
  // switch re-renders immediately.
  const systemPrefersDark = useSyncExternalStore(
    subscribeToColorScheme,
    getColorSchemeSnapshot,
    getServerColorSchemeSnapshot
  );

  // prefers-color-scheme is a TERTIARY fallback: it is consulted only when the
  // user explicitly chose "system". A NULL preference stays dark (brief §1.3).
  const effectiveTheme: "dark" | "light" =
    theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;

  const setTheme = (next: Theme) => {
    setThemeState(next);
    saveThemePreference(next)
      .then((result) => {
        if (!result.success) console.error("saveThemePreference failed:", result.error);
      })
      .catch((error) => {
        console.error("saveThemePreference failed:", error);
      });
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore — incognito/quota
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      <div data-admin-theme-root="" data-theme={effectiveTheme}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
