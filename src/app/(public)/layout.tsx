import { BookingExperienceLoader } from "@/features/booking/BookingExperienceLoader";
import { getPublicBookingWindow } from "@/lib/booking/booking-window-settings";
import { getFreeTravelCities } from "@/lib/booking/free-travel-cities";
import { PublicScrollbar } from "@/components/layout/PublicScrollbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { MAINTENANCE_MODE } from "@/lib/maintenance";
import { MaintenanceBanner } from "@/components/shared/MaintenanceBanner";
import { MaintenanceModal } from "@/components/shared/MaintenanceModal";
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
  // only. Both are skipped under maintenance, where the loader never mounts.
  const [bookingWindow, freeTravelCities] = MAINTENANCE_MODE
    ? [null, [] as string[]]
    : await Promise.all([getPublicBookingWindow(), getFreeTravelCities()]);

  return (
    <>
      {/* First, unconditionally — including under MAINTENANCE_MODE below, where
          the consent default still has to be established before anything else. */}
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
      {/* The notice is pinned to the BOTTOM of the viewport, so it is rendered
          after the footer rather than before the header. Putting it above the
          header was the live bug: the header is `position: fixed` at top 0, so
          an in-flow banner could not push it down and the two shared the same
          space. See MaintenanceBanner for the full account.

          The spacer reserves the height the bar covers, so the last of the
          footer can still be scrolled clear of it. Deliberately generous — the
          bar's height depends on how the copy wraps, and a little extra
          whitespace below the footer costs nothing, whereas too little would
          clip the footer's bottom row. */}
      {MAINTENANCE_MODE && (
        <>
          <div aria-hidden className="h-24 sm:h-14" />
          <MaintenanceBanner />
        </>
      )}
      {!MAINTENANCE_MODE && (
        <BookingExperienceLoader
          bookingWindowDays={bookingWindow?.bookingWindowDays}
          minimumNoticeHours={bookingWindow?.minimumNoticeHours}
          freeTravelCities={freeTravelCities}
        />
      )}
      {MAINTENANCE_MODE && <MaintenanceModal />}
      <PublicScrollbar />
      {/* Last in the tree, and unconditional like ConsentScripts above: the
          consent question is asked in maintenance mode too, and being late in
          the DOM keeps it late in the tab order rather than ahead of the page's
          own content. */}
      <CookieBanner />
      <GoogleAnalytics />
    </>
  );
}
