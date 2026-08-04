import Link from "next/link";
import { contactLinks } from "@/content/site/contact";
import { footerContent } from "@/content/site/footer";
import { socialLinks } from "@/content/site/social";
import { BookingTrigger } from "./BookingTrigger";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="footer_component color-scheme-1">
      <div className="padding-global">
        <div className="container-large">
          <div className="padding-vertical padding-xxlarge">
            <div className="padding-bottom padding-xxlarge">
              <div className="footer_top-wrapper">
                <div className="footer_brand-column">
                  <Logo size="footer" />
                  <p className="footer_intro">
                    Mobile hijama, cupping, and massage across Luton and
                    surrounding areas.
                  </p>
                  <BookingTrigger label="Book Now" className="footer_cta" />
                </div>

                <div className="footer_nav-column">
                  <div>
                    <h3 className="footer_heading">Explore</h3>
                    <nav
                      className="w-layout-grid footer_link-list"
                      aria-label="Footer service navigation"
                    >
                      {footerContent.serviceLinks.map((item) => (
                        <Link key={item.href} href={item.href} className="footer_link">
                          {item.label}
                        </Link>
                      ))}
                    </nav>
                  </div>

                  <div>
                    <h3 className="footer_heading">Contact</h3>
                    <div className="footer_contact-list">
                      <Link href={contactLinks.phone.href} className="footer_link">
                        {contactLinks.phone.value}
                      </Link>
                      <Link href={contactLinks.whatsapp.href} className="footer_link">
                        WhatsApp
                      </Link>
                      <Link href={contactLinks.email.href} className="footer_link">
                        {contactLinks.email.value}
                      </Link>
                      {socialLinks.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className="footer_link"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="divider-horizontal" />

            <div className="padding-top padding-medium">
              <div className="footer_bottom-wrapper">
                <div className="footer_credit-text">
                  {footerContent.copyrightLine}
                </div>
                <nav
                  className="w-layout-grid footer_legal-list"
                  aria-label="Footer legal navigation"
                >
                  {footerContent.legalLinks.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="footer_legal-link"
                    >
                      {item.label}
                    </Link>
                  ))}
                  {/* C-18 Phase F — the persistent withdrawal surface (brief
                      §2.5), present on every public page via this shared
                      footer. A plain anchor with the trigger attribute, not a
                      generic legalLinks entry: CookieBanner
                      (mounted from src/app/(public)/layout.tsx) already
                      delegates a click on ANY [data-cookie-settings-trigger]
                      element to openConsentPanel() — the same mechanism the
                      /cookies page's own "Cookie settings" button uses
                      (src/app/(public)/cookies/page.tsx) — so this needs no
                      client island and no change to that delegation. The
                      "?cookie-settings=1" href is the no-JS fallback:
                      CookieBanner also opens the panel on load if that query
                      param is present, so a real navigation (JS not yet
                      running, or disabled) still reaches the same control. */}
                  <a
                    href="?cookie-settings=1"
                    data-cookie-settings-trigger="true"
                    className="footer_legal-link"
                  >
                    Cookie settings
                  </a>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
