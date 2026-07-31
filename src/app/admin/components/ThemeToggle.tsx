"use client";

import { ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "./ThemeProvider";

const THEME_ICONS = {
  dark: Moon,
  light: Sun,
  system: Monitor,
} as const;

/**
 * Admin theme picker — a real <select>, so it is keyboard- and
 * screen-reader-operable for free and the OS renders the option list natively
 * at every viewport. A three-option dropdown (not a cycle button) is locked by
 * brief Q9.3: cycling hides the "System" choice.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = THEME_ICONS[theme];

  return (
    <div className="relative inline-flex items-center">
      <Icon
        className="pointer-events-none absolute left-2 size-3.5 text-[var(--admin-nav-text-muted)]"
        aria-hidden="true"
      />
      <select
        value={theme}
        onChange={(event) => setTheme(event.target.value as Theme)}
        aria-label="Theme"
        className="h-8 cursor-pointer appearance-none rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-transparent py-0 pl-7 pr-6 text-[0.8125rem] font-medium text-[var(--admin-nav-text)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        <option value="dark">Dark</option>
        <option value="light">Light</option>
        <option value="system">System</option>
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 size-3 text-[var(--admin-nav-text-muted)]"
        aria-hidden="true"
      />
    </div>
  );
}
