# Links CTAs Booking Audit

## Status

- Phase: 6
- Completion status: Complete for link, CTA, and booking-query checks
- Scope: Planned pages plus shared header/footer/booking surfaces used by planned pages
- Method: Static source scan, route inventory review, Phase 5 interaction result reuse for booking popup behavior.
- Runtime remediation: None.

## Booking Rules Checked

| Rule | Result | Evidence | Issue IDs |
|---|---|---|---|
| General booking uses `?booking=1` | Pass in static source | Header, final CTAs, and general planned-page booking anchors use `?booking=1`. | None |
| Package booking uses `?booking=1&services=<service-id>` | Pass in static source | Home package cards, services package cards, services finder, comparison CTAs, and package pages use `services` query values. | None |
| Valid service IDs only | Pass in scoped planned source | Found IDs: `supreme-combo`, `hijama-package`, `fire-package`, `massage-30`, `massage-60`. | None |
| No `?package=` | Pass in scoped planned source | Static scan returned no matches. | None |
| No `/book-now` path | Pass for literal path in scoped planned source; fail for visible "Book Now page" copy | No `/book-now` path found, but two planned FAQ answers imply a forbidden Book Now page. | CTA-001 |
| No `/services/mobile-massage-therapy` | Pass in scoped planned source | Static scan returned no matches. | None |
| WhatsApp links use `https://wa.me/447798897222` | Pass | Planned-page WhatsApp links use the required base number, with optional encoded `text` query strings. | None |
| Header/footer links relevant to planned pages work | Partial | Header/footer include planned routes, but also expose legacy `/` as "Home" from planned pages. | CTA-002 |
| Booking query behavior opens popup | Fail based on Phase 5 browser test | `?booking=1` and visible booking triggers updated URL but did not render the booking dialog locally. | INTERACTION-001, CTA-003 |

## Static Scan Results

Forbidden route/query scan command scope: `src/content`, `src/components`, and `src/features`.

Matches:

| Pattern | Result |
|---|---|
| `?package=` | No matches |
| `/book-now` | No literal route/path matches |
| `/services/mobile-massage-therapy` | No matches |
| `Book Now page` | Two visible-copy matches in `src/content/pages/plannedHome.ts` and `src/content/pages/faqsAftercare.ts` |

Relevant scan hits:

| File | Line | Text |
|---|---:|---|
| `src/content/pages/plannedHome.ts` | 340 | `Use the Book Now page or message Rahma Therapy on WhatsApp...` |
| `src/content/pages/faqsAftercare.ts` | 177 | `You can book through the Book Now page or message us on WhatsApp...` |

## Planned Booking Link Inventory

| Surface | Source | Observed booking target | Status |
|---|---|---|---|
| Header CTA | `src/components/layout/SiteHeader.tsx` | `?booking=1` | Static pass; runtime popup fail tracked separately |
| Shared booking trigger helper | `src/components/layout/BookingTrigger.tsx` | `?booking=1` or `?booking=1&services=<ids>` | Pass |
| Home hero/process/final CTA | `src/components/planned-home/*` | `?booking=1` | Static pass |
| Home package cards | `src/content/pages/plannedHome.ts`, `HomePackageCards.tsx` | Valid package booking URLs | Static pass |
| Services hero/process/final CTA | `src/components/services/*` | `?booking=1` | Static pass |
| Services package cards/comparison/finder | `src/content/pages/services.ts`, services components | Valid package booking URLs | Static pass |
| Focused package heroes/final CTAs | `src/content/pages/packagePages.ts`, package components | Valid package booking URLs | Static pass |
| About hero/final CTA | `src/components/about/*` | `?booking=1` | Static pass |
| Reviews hero/final CTA | `src/components/reviews/*` | `?booking=1` | Static pass |
| FAQs hero/advice/final CTA | `src/components/faqs-aftercare/*` | `?booking=1` | Static pass |

## Navigation And Footer

| Source | Planned links present | Observed issue | Issue IDs |
|---|---|---|---|
| `src/content/site/navigation.ts` | `/home-planned`, `/services`, `/about`, `/reviews`, `/faqs-aftercare` | Also includes `Home` -> `/`, which sends planned-page users to the legacy homepage that is explicitly out of audit scope. | CTA-002 |
| `src/content/site/footer.ts` | `/home-planned`, `/services`, `/about`, `/reviews`, `/faqs-aftercare` | Also includes `Home` -> `/`, which sends planned-page users to the legacy homepage that is explicitly out of audit scope. | CTA-002 |

## CTA Findings Added This Phase

### CTA-001

- Severity: Medium
- Route: `/home-planned`, `/home-planning`, `/faqs-aftercare`
- Source: `src/content/pages/plannedHome.ts`, `src/content/pages/faqsAftercare.ts`
- Observed: FAQ answers refer to a "Book Now page".
- Expected: Planned-page booking language should point to the booking popup/request flow, not a `/book-now` page concept.
- User impact: Users may look for or expect a booking page that is forbidden by the audit brief and not part of the planned route set.
- Verification method: Static source search for `Book Now page`.
- Related existing issues: PLAN-HOME-003, PLAN-FAQS-003

### CTA-002

- Severity: Medium
- Route: All planned routes through shared header/footer
- Source: `src/content/site/navigation.ts`, `src/content/site/footer.ts`
- Observed: Shared planned-page navigation and footer include `Home` -> `/`, which routes users to the legacy homepage.
- Expected: Planned-page navigation should keep users inside the planned-page experience unless a legacy route is intentionally retained.
- User impact: Users can leave the planned design system and land on an out-of-scope legacy page from the planned shell.
- Verification method: Static navigation/footer content inspection.
- Related existing issue: UX-001

### CTA-003

- Severity: High
- Route: All planned routes
- Source: `src/features/booking/hooks/useBookingUrlState.ts`, `src/features/booking/BookingExperience.tsx`, planned-page booking triggers
- Observed: Phase 5 local browser testing found `?booking=1`, `?booking=1&services=hijama-package`, and visible booking triggers did not render the booking popup.
- Expected: Allowed booking URLs and triggers should open the booking popup and preselect valid service IDs.
- User impact: Booking CTAs are statically wired but fail the primary conversion behavior at runtime.
- Verification method: Browser test documented in `05-accessibility-audit.md`.
- Related existing issue: INTERACTION-001

## Phase 6 CTA Gate

| Check | Status |
|---|---|
| General booking links checked | Complete |
| Package booking links checked | Complete |
| Service IDs checked | Complete |
| Forbidden `?package=` scan documented | Complete |
| Forbidden `/book-now` scan documented | Complete |
| Forbidden `/services/mobile-massage-therapy` scan documented | Complete |
| WhatsApp links checked | Complete |
| Header/footer planned links checked | Complete |
| Booking query behavior documented | Complete |
| CTA issues copied to master issue register | Complete |
| Runtime code changed | No |
