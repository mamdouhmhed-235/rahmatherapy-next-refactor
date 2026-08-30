import { BookingExperienceLoader } from "@/features/booking/BookingExperienceLoader";
import { MaintenanceBanner } from "@/components/shared/MaintenanceBanner";
import { MAINTENANCE_MODE } from "@/lib/maintenance";
import { getPublicBookingWindow } from "@/lib/booking/booking-window-settings";
import { getFreeTravelCities } from "@/lib/booking/free-travel-cities";
import { getBookableServiceSlugs } from "@/lib/booking/bookable-services";
import { PublicScrollbar } from "@/components/layout/PublicScrollbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { ConsentScripts } from "@/components/consent/ConsentScripts";
import { CookieBanner } from "@/components/consent/CookieBanner";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // C-14 Phase D — the booking dialog mounts client-only, so its date picker's
  // window settings enter the tree here. Cached + null-tolerant; see
  // src/lib/booking/booking-window-settings.ts.
  // Item 8 Phase 2 — the free-travel town list enters the same way, for display
  // only.
  // D-033 — `bookableSlugs` decides which packages the dialog offers. `null`
  // means the lookup failed, and the dialog then shows them all, exactly as it
  // did before this existed. ⛔ The real guard is server-side in
  // assertServicesBookable; this list is presentation only.
  const [bookingWindow, freeTravelCities, bookableSlugs] = await Promise.all([
    getPublicBookingWindow(),
    getFreeTravelCities(),
    getBookableServiceSlugs(),
  ]);

  return (
    <>
      {/* First: the consent default has to be established before anything else
          in the tree can act on it. */}
      <ConsentScripts />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1000] focus:rounded-full focus:bg-rahma-green focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white focus:shadow-card focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-rahma-gold"
      >
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="public-main">
        {children}
      </main>
      <SiteFooter />
      {/* ⛔ The banner is `position: fixed`, so it sits OUTSIDE normal flow and
          covered the footer's last line — the copyright and credit — with no way
          to scroll past it on a phone. Phase 12's own commit message records that
          an earlier version of this banner had exactly this bug and claimed a
          `.has-maintenance-banner` fix; that class was never actually written.
          This spacer is that fix: real space at the end of the document, so the
          footer can always be read in full. */}
      {MAINTENANCE_MODE && (
        <div aria-hidden className="h-[var(--maintenance-banner-h)]" />
      )}
      {/* ⛔ Under MAINTENANCE_MODE the booking dialog is NOT MOUNTED AT ALL —
          not hidden, not disabled. There is nothing on the page to open, so
          every `?booking=1` link and every "Book an appointment" button lands
          on a page with no dialog, and no partly-filled form can be abandoned
          on a step-3 dead end. The banner below says why and gives the phone
          number and email instead.
          ⚠️ This is the INTERFACE gate only. A direct POST to /api/bookings is
          refused separately by `business_settings.booking_status_enabled`. */}
      {MAINTENANCE_MODE ? (
        <MaintenanceBanner />
      ) : (
        <BookingExperienceLoader
          bookingWindowDays={bookingWindow?.bookingWindowDays}
          minimumNoticeHours={bookingWindow?.minimumNoticeHours}
          freeTravelCities={freeTravelCities}
          bookableSlugs={bookableSlugs}
        />
      )}
      <PublicScrollbar />
      {/* Last in the tree: being late in the DOM keeps the consent question
          late in the tab order rather than ahead of the page's own content. */}
      <CookieBanner />
      <GoogleAnalytics />
    </>
  );
}
