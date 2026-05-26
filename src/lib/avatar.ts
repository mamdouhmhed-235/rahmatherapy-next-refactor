/**
 * Unicode-safe display-name initial extraction for avatar tokens.
 *
 * Splits by grapheme via Array.from() so surrogate pairs (emoji, non-BMP CJK)
 * and combining marks render identically on server and client. The naive
 * `name[0]` / `parts[0].slice(0, 2)` patterns return UTF-16 code units, which
 * cuts surrogate pairs in half and produces a U+FFFD replacement char on the
 * client but the original byte on the server — i.e. a hydration mismatch.
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return Array.from(parts[0]).slice(0, 2).join("").toUpperCase();
  }
  const first = Array.from(parts[0])[0] ?? "";
  const last = Array.from(parts[parts.length - 1])[0] ?? "";
  return (first + last).toUpperCase();
}

/**
 * Single-grapheme variant. Use when only one letter is wanted (e.g. surname-
 * aware directory cards, single-author tokens).
 */
export function getInitial(name: string): string {
  const trimmed = name.trim();
  const first = Array.from(trimmed)[0];
  return first ? first.toUpperCase() : "?";
}
