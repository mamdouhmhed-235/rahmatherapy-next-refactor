// C-18 Phase A — the single source of truth for cookie/storage disclosure.
//
// Every non-admin cookie or browser-storage item this site writes for an
// anonymous public/booking visitor is listed below, derived from the source
// inventory at redesign/evidence/C-18/cookie-inventory-source.md (repo
// `master` @ 70e2103). That inventory found 12 mechanisms in total; 7 are
// staff-only inside the authenticated /admin tree (out of PECR's
// visitor-consent scope, and outside this registry) and 5 reach an
// anonymous visitor — those 5 are COOKIE_REGISTRY below.
//
// This file drives THREE surfaces from one array: the /cookies notice page
// (src/app/(public)/cookies/page.tsx), and — in later phases — the
// preferences panel's toggle list and per-cookie table. No surface may hold
// its own hand-maintained copy of this list; add an entry here and every
// consumer updates itself.
//
// Bump policy (brief §2.1, Q8.2): CONSENT_BANNER_VERSION is a date + a
// same-day counter ("YYYY-MM-DD.n"). Bump it whenever a change here would
// alter what a visitor was told or offered — a new entry, a purpose change,
// or a materially different description/duration. A bump invalidates every
// previously-stored consent choice (Phase B's readConsent treats a version
// mismatch as "no consent") and re-prompts every visitor. A wording-only
// typo fix that changes nothing substantive does not require a bump.
export const CONSENT_BANNER_VERSION = "2026-07-16.1";

// "essential" — strictly necessary for a function the visitor themselves
//   requested; exempt from consent under PECR. Every "essential" entry's
//   description must name that specific function, or it does not belong in
//   this bucket (see the entries below and the reasoning in
//   redesign/evidence/C-18/cookie-inventory-source.md §2).
// "functional" — improves the experience across visits (e.g. remembering
//   details for next time) but is not needed to complete the visit in
//   progress. Chosen over the brief's alternative name "preferences"
//   because the one entry that needs this bucket
//   (rahma-booking-contact-v1) stores contact/address details for a future
//   booking, not a display/UI preference — "functional" is the closer,
//   more honest label and matches the common ICO/IAB four-way cookie
//   taxonomy (necessary/functional/analytics/marketing) a visitor is more
//   likely to already recognise. Added because the brief's original
//   "essential" | "analytics" enum (§2.1) has no bucket for a convenience
//   item that is neither strictly necessary nor tracking.
// "analytics" — aggregate visit/behaviour measurement for the site
//   operator, gated behind analytics consent.
export type CookiePurpose = "essential" | "functional" | "analytics";

// The brief's CookieRegistryEntry (§2.1) covers cookies only (name,
// provider, purpose, duration, description). Two of this registry's five
// entries are localStorage/sessionStorage, not cookies — calling them
// "cookies" in the notice page's copy would be inaccurate, so `type` is
// added here as a minimal, necessary extension of the brief's shape. It is
// additive only: every field the brief specified is still present and
// unchanged in meaning.
export type StorageMechanism = "cookie" | "localStorage" | "sessionStorage";

export interface CookieRegistryEntry {
  /** Cookie name, or storage key for localStorage/sessionStorage entries. */
  name: string;
  /** Who sets it — "Rahma Therapy" for first-party, else the third-party provider. */
  provider: string;
  type: StorageMechanism;
  purpose: CookiePurpose;
  /** Plain-English duration, shown verbatim on the panel + /cookies page. */
  duration: string;
  /**
   * Plain-English, shown verbatim in the panel + /cookies page. For
   * purpose:"essential" entries this MUST state the specific
   * visitor-requested function the item enables — "essential" is a legal
   * claim, and an entry that cannot name that function does not belong in
   * this bucket.
   */
  description: string;
  /**
   * Set only on an entry whose underlying feature is currently switched
   * off, so nothing is being written to any visitor's browser today. The
   * entry stays registered because the code path exists and can start
   * writing again the moment the feature is switched back on.
   */
  dormant?: boolean;
  /**
   * Set only on an entry whose `purpose` has not yet received a final
   * Owner ruling. Non-empty means: treat `purpose` as a working
   * classification for registry-shape purposes only — Phase C/D must not
   * gate consent behaviour on this entry until the note is resolved and
   * removed.
   */
  provisionalNote?: string;
}

export const COOKIE_REGISTRY: CookieRegistryEntry[] = [
  {
    // src/features/booking/store/booking-store.ts:75-79 — zustand `persist`,
    // `partialize` limits the persisted shape to `selectedPackageIds` only.
    name: "zam-therapy-booking-draft-v3",
    provider: "Rahma Therapy",
    type: "localStorage",
    purpose: "essential",
    duration:
      "No fixed expiry — cleared automatically when your booking is submitted, or you can clear it yourself by clearing your browser's site data",
    description:
      "Remembers which treatment package(s) you've selected while you're filling in the booking form you opened, so an accidental page reload, or closing and reopening the booking dialog, doesn't lose your in-progress selection. It stores only the package selection itself — never your name, contact details, health information, or anything else you enter.",
  },
  {
    // src/features/booking/utils/returning-customer.ts:7-8,24-43 — written on
    // successful booking submission, read once per booking-dialog session
    // while the form is still pristine, self-expires after 180 days.
    name: "rahma-booking-contact-v1",
    provider: "Rahma Therapy",
    type: "localStorage",
    purpose: "functional",
    duration: "180 days, or until you clear it",
    description:
      "After you complete a booking, stores your name, phone number, email and address on this device so they can be pre-filled automatically if you book with us again within 180 days. This is a convenience for a future visit — completing your current booking does not depend on it.",
    provisionalNote:
      "PROVISIONAL classification pending an explicit Owner ruling before Phase C gates any consent behaviour on this entry (raised in redesign/evidence/C-18/cookie-inventory-source.md §2 and recorded as an open question in redesign/per-page-progress/C-18-cookie-consent-progress.md §1). It stores personal data (full name, phone, email, address) purely for cross-visit convenience, so it is not \"essential\" in the strict PECR sense — nothing about the booking in progress depends on it — but it is not tracking either, hence the new \"functional\" bucket rather than defaulting it into \"essential\" or \"analytics\". Do not treat this note's presence as a decision either way.",
  },
  {
    // src/components/GoogleAnalytics.tsx — loaded via Google's externally
    // hosted gtag.js, gated on NEXT_PUBLIC_GA_MEASUREMENT_ID + production;
    // mounted from src/app/(public)/layout.tsx. Set by Google, not by this
    // repo's code, so the exact attributes are Google's own defaults.
    name: "_ga / _ga_*",
    provider: "Google (Google Analytics 4)",
    type: "cookie",
    purpose: "analytics",
    duration:
      "Up to 13 months (Google's documented default for this cookie family; this site does not set a custom expiry)",
    description:
      "Google Analytics 4 cookies used to distinguish visitors and sessions so we can see aggregate website-traffic patterns — for example, which pages are popular and how visitors move through the site. Only set once you accept analytics cookies.",
  },
  {
    // src/components/shared/MaintenanceModal.tsx:14,20-21 — gated behind
    // MAINTENANCE_MODE in src/app/(public)/layout.tsx, currently `false`
    // (src/lib/maintenance.ts) so the modal never mounts today.
    name: "maintenance-modal-seen",
    provider: "Rahma Therapy",
    type: "sessionStorage",
    purpose: "essential",
    duration: "Session — cleared when you close your browser tab",
    description:
      "While planned maintenance is in progress, remembers that you've already seen the one-off 'site not ready' notice this session, so it doesn't interrupt you again on every page you visit before maintenance ends.",
    dormant: true,
  },
  {
    // Written by the @sentry-internal/replay package (REPLAY_SESSION_KEY),
    // configured in sentry.client.config.ts, started via SentryProvider.tsx
    // mounted at the ROOT layout (src/app/layout.tsx) — reaches (public),
    // /admin and /booking/manage alike. 10% of sessions sampled, 100% of
    // sessions with an error. Owner decision 2026-08-04 (progress §3, #1):
    // registered here and gated under analytics consent — the same purpose
    // as GA — rather than given its own purpose bucket.
    name: "sentryReplaySession",
    provider: "Sentry (Functional Software, Inc.)",
    type: "sessionStorage",
    purpose: "analytics",
    duration: "Session — cleared when you close your browser tab",
    description:
      "Written by Sentry Session Replay, which records a replay of what you did on this site — the pages you viewed, where you clicked and scrolled, and a masked version of what you typed — so we can review it when investigating errors. About 10% of visits are recorded, and any visit where an error occurs is always recorded. Only starts once you accept analytics cookies.",
  },
];

export const PURPOSE_LABELS: Record<CookiePurpose, string> = {
  essential: "Essential",
  functional: "Functional",
  analytics: "Analytics",
};

export const PURPOSE_DESCRIPTIONS: Record<CookiePurpose, string> = {
  essential:
    "Needed for a function you specifically asked for — the site does not work as requested without these. You can't opt out of these from the cookie banner.",
  functional:
    "Make a return visit more convenient by remembering things across visits. Off by default; only used if you say yes.",
  analytics:
    "Help us understand how the site is used in aggregate, so we can improve it. Off by default; only used if you say yes.",
};

// Fixed display order — essential first (it's the one bucket that's always
// on), then the consent-gated buckets in the order they appear in
// CookiePurpose.
const PURPOSE_ORDER: CookiePurpose[] = ["essential", "functional", "analytics"];

export interface CookieRegistryGroup {
  purpose: CookiePurpose;
  label: string;
  description: string;
  entries: CookieRegistryEntry[];
}

/**
 * Groups the registry by purpose in a fixed, stable order. The /cookies page
 * (and, from Phase C, the preferences panel) render from this — never from a
 * separately maintained list — so the three surfaces cannot drift apart.
 */
export function groupRegistryByPurpose(
  registry: CookieRegistryEntry[] = COOKIE_REGISTRY
): CookieRegistryGroup[] {
  return PURPOSE_ORDER.map((purpose) => ({
    purpose,
    label: PURPOSE_LABELS[purpose],
    description: PURPOSE_DESCRIPTIONS[purpose],
    entries: registry.filter((entry) => entry.purpose === purpose),
  })).filter((group) => group.entries.length > 0);
}

/**
 * Parses the leading YYYY-MM-DD date out of a banner-version string
 * ("2026-07-16.1" -> "16 July 2026") for the /cookies page's "last updated"
 * line. Falls back to the raw string if the format ever changes.
 */
export function formatBannerVersionDate(version: string = CONSENT_BANNER_VERSION): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(version);
  if (!match) return version;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return version;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
