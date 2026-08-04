// C-18 Phase A — the single source of truth for cookie/storage disclosure.
//
// Every non-admin cookie or browser-storage item this site writes for an
// anonymous public/booking visitor is listed below, derived from the source
// inventory at redesign/evidence/C-18/cookie-inventory-source.md (repo
// `master` @ 70e2103). That inventory found 12 mechanisms in total; 7 are
// staff-only inside the authenticated /admin tree (out of PECR's
// visitor-consent scope, and outside this registry) and 5 reach an
// anonymous visitor.
//
// COOKIE_REGISTRY below is those 5 plus one the inventory could not have
// found, because C-18 itself introduces it: `rahma_consent`, the cookie that
// stores the visitor's own choice (added in Phase B, Step 3 —
// src/lib/consent/consent-state.ts). Six entries in total.
//
// This file drives THREE surfaces from one array: the /cookies notice page
// (src/app/(public)/cookies/page.tsx) and the preferences panel's control list
// and per-item disclosure (src/components/consent/ConsentPreferencesPanel.tsx).
// No surface may hold its own hand-maintained copy of this list; add an entry
// here and every consumer updates itself.
//
// Bump policy (brief §2.1, Q8.2): CONSENT_BANNER_VERSION is a date + a
// same-day counter ("YYYY-MM-DD.n"). Bump it whenever a change here would
// alter what a visitor was told or offered — a new entry, a purpose change,
// or a materially different description/duration. A bump invalidates every
// previously-stored consent choice (Phase B's readConsent treats a version
// mismatch as "no consent") and re-prompts every visitor. A wording-only
// typo fix that changes nothing substantive does not require a bump.
export const CONSENT_BANNER_VERSION = "2026-07-16.1";

// C-18 Phase E Step 10 — every banner_version POST /api/consent-events
// (src/app/api/consent-events/route.ts) still accepts, so a beacon fired from
// a page that loaded BEFORE a version bump — and therefore still carries the
// pre-bump version string in its inline consent-default script and its
// in-memory consent-store snapshot until the visitor reloads — still gets
// logged instead of silently dropped. A version is added here, never
// removed, in the SAME change that bumps CONSENT_BANNER_VERSION above.
export const KNOWN_BANNER_VERSIONS: readonly string[] = [CONSENT_BANNER_VERSION];

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
}

export const COOKIE_REGISTRY: CookieRegistryEntry[] = [
  {
    // src/lib/consent/consent-state.ts — CONSENT_COOKIE, written by
    // writeConsent() with Max-Age=CONSENT_MAX_AGE_S (182 days), SameSite=Lax,
    // Secure, Path=/.
    //
    // "essential" is the textbook strictly-necessary case: a record of a
    // consent choice is what makes the choice stick, and PECR cannot
    // sensibly require consent for the thing that stores the answer.
    //
    // The banner and preferences panel that write this cookie shipped in
    // Phase C (src/components/consent/), so the description below no longer
    // carries the "nothing sets this yet" sentence it was written with — that
    // was PHASE D OBLIGATION item 6, discharged in the same change that shipped
    // the banner.
    name: "rahma_consent",
    provider: "Rahma Therapy",
    type: "cookie",
    purpose: "essential",
    duration:
      "6 months (182 days) from the moment a choice is made or changed — the interval the ICO recommends before asking again",
    description:
      "Stores the cookie choices you make on this site — what you agreed to and what you refused — so every page can honour them without asking you again, and so we can show what you were asked and what you answered. It also holds a random reference number that isn't linked to your name, your email or any booking. It's written the moment you answer the cookie banner or save your settings, and not before.",
  },
  {
    // src/features/booking/store/booking-store.ts:75-79 — zustand `persist`,
    // `partialize` limits the persisted shape to `selectedPackageIds` only.
    name: "zam-therapy-booking-draft-v3",
    provider: "Rahma Therapy",
    type: "localStorage",
    purpose: "essential",
    duration:
      "No fixed expiry — stays on this device even after you submit a booking. It's only cleared when you click \"Start a new request\" on the confirmation screen, or when you clear your browser's site data yourself",
    description:
      "Remembers which treatment package(s) you've selected while you're filling in the booking form you opened, so an accidental page reload, or closing and reopening the booking dialog, doesn't lose your in-progress selection. It stores only the package selection itself — never your name, contact details, health information, or anything else you enter.",
  },
  {
    // src/features/booking/utils/returning-customer.ts:7-8,24-43 — written on
    // successful booking submission, read once per booking-dialog session
    // while the form is still pristine, self-expires after 180 days.
    //
    // Owner ruling 2026-08-04 (progress §3 #6): stays "functional" and gets a
    // real gate. Both the write and the read now go through
    // saveReturningCustomerIfConsented / loadReturningCustomerIfConsented in
    // src/features/booking/BookingExperience.tsx, tested in
    // src/features/booking/__tests__/returning-customer-consent-gate.test.ts.
    // The provisional-classification note this entry carried while that ruling
    // was outstanding has gone with it.
    name: "rahma-booking-contact-v1",
    provider: "Rahma Therapy",
    type: "localStorage",
    purpose: "functional",
    duration: "180 days, or until you clear it",
    description:
      "After you complete a booking, stores your name, phone number, email address, gender, home address (house/street, town, area and postcode), and any access or parking notes you gave, on this device so they can be pre-filled automatically if you book with us again within 180 days. This is a convenience for a future visit — completing your current booking does not depend on it. It's only stored, and only read back, if you switch Functional on; switch it off and anything already stored is deleted.",
  },
  {
    // src/components/GoogleAnalytics.tsx — loaded via Google's externally
    // hosted gtag.js, gated on NEXT_PUBLIC_GA_MEASUREMENT_ID + production;
    // mounted from src/app/(public)/layout.tsx. Set by Google, not by this
    // repo's code, so the exact attributes are Google's own defaults.
    //
    // Consent-gated since Phase D: GoogleAnalytics.tsx keeps C-17's
    // env-and-production check and adds a stored-analytics-grant check read
    // through the consent store, so it renders nothing — no script, no request
    // to any Google host — until the visitor has said yes. It is the only
    // component in the app that names a Google host, which is what makes
    // "zero Google requests before consent" true by construction rather than
    // by ordering luck. Tests:
    // src/components/__tests__/GoogleAnalytics.test.tsx.
    name: "_ga / _ga_*",
    provider: "Google (Google Analytics 4)",
    type: "cookie",
    purpose: "analytics",
    duration:
      "Up to 13 months (Google's documented default for this cookie family; this site does not set a custom expiry, and this figure has not been independently verified in production)",
    description:
      "Google Analytics 4 cookies used to distinguish visitors and sessions so we can see aggregate website-traffic patterns — for example, which pages are popular and how visitors move through the site. They only appear if you switch Analytics on: until you do, Google Analytics isn't loaded at all and your browser doesn't contact Google, so there is nothing to set them. Switch Analytics back off and we delete them.",
  },
  {
    // src/components/shared/MaintenanceModal.tsx:14,20-21 — gated behind
    // MAINTENANCE_MODE in src/app/(public)/layout.tsx.
    //
    // NOT marked as inactive, and this is deliberate. An earlier pass read
    // MAINTENANCE_MODE as `false` and described the whole feature as switched
    // off — but that `false` is an uncommitted local change; the committed
    // value (`git show HEAD:src/lib/maintenance.ts`) is `true`, so any deploy
    // ships the modal mounted and this key written. This page is a public
    // statement about what a visitor's browser actually receives, and it has to
    // describe the deployable state, not one machine's working copy.
    name: "maintenance-modal-seen",
    provider: "Rahma Therapy",
    type: "sessionStorage",
    purpose: "essential",
    duration: "Session — cleared when you close your browser tab",
    description:
      "While planned maintenance is in progress, remembers that you've already seen the one-off 'site not ready' notice this session, so it doesn't interrupt you again on every page you visit before maintenance ends.",
  },
  {
    // Written by the @sentry-internal/replay package (REPLAY_SESSION_KEY),
    // configured in sentry.client.config.ts, started via SentryProvider.tsx
    // mounted at the ROOT layout (src/app/layout.tsx). syncSessionReplay() in
    // sentry.client.config.ts blocks it unconditionally on /booking/manage
    // (never started there — commit 09b2e26, browser-confirmed by
    // redesign/evidence/C-18/cookie-inventory-browser.md §3 Scenario A) AND,
    // since Owner decision 9 (progress §3, #9, 2026-08-04), on /admin — so
    // this key now reaches (public) only, gated behind analytics consent, and
    // nowhere else. Where it is running, every visit is recorded
    // (browser-confirmed: the write happens on every page load, before any
    // sample outcome is known — cookie-inventory-browser.md §2); ~10% of
    // sessions are sampled for continuous upload and any session with an
    // error is uploaded too.
    //
    // Consent-gated since Phase D: syncSessionReplay() adds the Replay
    // integration only when the stored consent grants analytics, so on a
    // gated route nothing is started and this key is never written. Error
    // reporting is untouched and stays on for everyone, admin included
    // (Owner decisions 1 and 9). Tests:
    // src/components/__tests__/SentryProvider.test.tsx.
    //
    // /admin IS NOT a consent question, and the description below says so
    // plainly rather than describing it as an exception a visitor could ever
    // satisfy: staff never see the banner, so gating admin on a consent
    // record that can never be written there would just be a roundabout way
    // of disabling Replay. Switched off outright instead (Owner decision 9,
    // reversing Phase D's original "keeps recording on admin regardless"
    // posture — see redesign/per-page-progress/C-18-cookie-consent-progress.md
    // §3 #9 for the reasoning).
    name: "sentryReplaySession",
    provider: "Sentry (Functional Software, Inc.)",
    type: "sessionStorage",
    purpose: "analytics",
    duration: "Session — cleared when you close your browser tab",
    description:
      "Written by Sentry Session Replay, which records a replay of what you did on this site — the pages you viewed, where you clicked and scrolled, and a masked version of what you typed — so we can review it when investigating errors. It only runs on our public pages, and only once you switch Analytics on; switching Analytics back off stops it. Where it is running, every visit is recorded; what varies is whether that recording is sent to us: about 10% of visits are sent automatically, and any visit where an error occurs is sent too, even if it wasn't one of that 10%. It never runs at all on our staff-only admin area, whatever anyone's choice — we've switched it off there outright because of how sensitive the information handled on those pages is. Sentry's separate error-reporting tool, which does not use this storage item, keeps working everywhere, admin included, so we can still catch and fix bugs.",
  },
];

export const PURPOSE_LABELS: Record<CookiePurpose, string> = {
  essential: "Essential",
  functional: "Functional",
  analytics: "Analytics",
};

// GATING OBLIGATIONS — ALL SIX DISCHARGED (items 1, 3-functional and 6 in Phase
// C; items 2, 3-analytics, 4 and 5 in Phase D). Nothing on this list is
// outstanding. It is kept, rather than deleted, because the RULE it encodes
// still governs every future change:
//
//   No copy in this registry or its consumers may make a present-tense
//   "gated" / "off by default" / "waits for your choice" claim unless the real
//   gate that makes it true ships in the SAME change, together with a test that
//   asserts the gate itself exists — never a test that only re-checks copy, the
//   way the earlier PHASE D DEPENDENCY pin did before it was removed in a5b5d9c
//   for proving nothing about the world outside this file.
//
// The gates and the tests that assert they exist, as shipped:
//
//   1. PURPOSE_DESCRIPTIONS.functional (Phase C) — gate:
//      saveReturningCustomerIfConsented / loadReturningCustomerIfConsented in
//      src/features/booking/BookingExperience.tsx; test:
//      src/features/booking/__tests__/returning-customer-consent-gate.test.ts.
//   2. PURPOSE_DESCRIPTIONS.analytics, below (Phase D) — gates: the analytics
//      arm of src/components/GoogleAnalytics.tsx and of syncSessionReplay() in
//      sentry.client.config.ts; tests:
//      src/components/__tests__/GoogleAnalytics.test.tsx and
//      src/components/__tests__/SentryProvider.test.tsx, both of which assert
//      the loaders' real behaviour under each consent state.
//   3. The purpose-aware group badge in
//      src/app/(public)/cookies/CookieRegistryGroups.tsx — functional arm in
//      Phase C, analytics arm in Phase D, each with the gate above.
//   4. The "_ga / _ga_*" entry's description, above (Phase D) — gate and test
//      as in item 2, GA side.
//   5. The "sentryReplaySession" entry's description, above (Phase D, and
//      Owner decision 9 for the /admin line specifically) — gate and test as
//      in item 2, Replay side. Its wording states plainly that /admin has
//      Replay switched off outright, not gated by consent — there is no
//      "exception" left to word carefully, because nothing in this group runs
//      on /admin at all now.
//   6. The "rahma_consent" entry's description, above (Phase C) — gate: the
//      banner and panel now write the cookie; test:
//      src/components/consent/__tests__/CookieBanner.test.tsx.
export const PURPOSE_DESCRIPTIONS: Record<CookiePurpose, string> = {
  essential:
    "Needed for a function you specifically asked for — the site does not work as requested without these. You can't opt out of these here.",
  functional:
    "Make a return visit more convenient by remembering things across visits. Nothing in this group is stored, or read back, unless you switch it on — and switching it off again deletes what was stored.",
  analytics:
    "Help us understand how the site is used in aggregate, so we can improve it. Nothing in this group loads or runs on the public site unless you switch it on, and switching it back off stops it straight away. Nothing in this group runs on our staff-only admin pages either, whatever anyone's choice — the Sentry item in this group explains why.",
};

// Fixed display order — essential first (it's the one bucket that's always
// on), then the consent-gated buckets in the order they appear in
// CookiePurpose.
const PURPOSE_ORDER: CookiePurpose[] = ["essential", "functional", "analytics"];

/**
 * Every purpose a visitor can actually be asked about — CookiePurpose minus
 * "essential" — as a plain runtime value, not just a type.
 *
 * consent-store.ts's consent-proof beacon uses this for `purposes_offered`
 * instead of `Object.keys(state.choices)` (ConsentChoices,
 * consent-state.ts): the interface is hand-typed and documented as requiring
 * manual sync with this list, so deriving from the registry directly means a
 * purpose added here without a matching ConsentChoices key shows up as a
 * mismatch instead of silently going missing from the log. See
 * registry-completeness.test.ts for the test that pins the two stay in
 * agreement.
 *
 * Built from PURPOSE_ORDER, not by scanning COOKIE_REGISTRY's entries: this
 * constant is imported by consent-store.ts, which ships on every public
 * page, and COOKIE_REGISTRY's six prose descriptions are kept out of that
 * bundle on purpose — see the GatedPurpose note in consent-store.ts for the
 * same trade-off made the same way.
 */
export const NON_ESSENTIAL_PURPOSES: readonly CookiePurpose[] = PURPOSE_ORDER.filter(
  (purpose) => purpose !== "essential"
);

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
