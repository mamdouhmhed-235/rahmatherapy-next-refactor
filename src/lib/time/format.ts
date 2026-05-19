/**
 * Hardened wrapper around `new Date(iso).toLocaleString(...)` that returns a
 * fallback string when the input is null, undefined, empty, or unparseable
 * instead of rendering the user-facing literal "Invalid Date".
 *
 * Use whenever the source is a DB row whose timestamp column is typed as
 * `string | null` or could carry malformed values from a future migration.
 */

type SafeFormatOptions = Intl.DateTimeFormatOptions & { locale?: string };

export function safeFormatDateTime(
  iso: string | number | Date | null | undefined,
  options: SafeFormatOptions = {},
  fallback: string = "—"
): string {
  if (iso === null || iso === undefined || iso === "") return fallback;
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  const { locale = "en-GB", ...intlOptions } = options;
  return date.toLocaleString(locale, intlOptions);
}
