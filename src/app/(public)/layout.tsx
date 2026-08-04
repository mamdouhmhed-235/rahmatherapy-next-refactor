import { BookingExperienceLoader } from "@/features/booking/BookingExperienceLoader";
import { PublicScrollbar } from "@/components/layout/PublicScrollbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { MAINTENANCE_MODE } from "@/lib/maintenance";
import { MaintenanceBanner } from "@/components/shared/MaintenanceBanner";
import { MaintenanceModal } from "@/components/shared/MaintenanceModal";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1000] focus:rounded-full focus:bg-rahma-green focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white focus:shadow-card focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-rahma-gold"
      >
        Skip to main content
      </a>
      {MAINTENANCE_MODE && <MaintenanceBanner />}
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="public-main">
        {children}
      </main>
      <SiteFooter />
      {!MAINTENANCE_MODE && <BookingExperienceLoader />}
      {MAINTENANCE_MODE && <MaintenanceModal />}
      <PublicScrollbar />
      <GoogleAnalytics />
    </>
  );
}
