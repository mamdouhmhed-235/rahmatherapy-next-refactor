import { BookingExperience } from "@/features/booking/BookingExperience";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

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
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="public-main">
        {children}
      </main>
      <SiteFooter />
      <BookingExperience />
    </>
  );
}
