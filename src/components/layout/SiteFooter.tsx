import Link from "next/link";
import { contactLinks } from "@/content/site/contact";
import { footerContent } from "@/content/site/footer";
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
                    Mobile hijama, massage, and physiotherapy across Luton and
                    surrounding areas.
                  </p>
                  <BookingTrigger label="Book a visit" className="footer_cta" />
                </div>

                <div className="footer_nav-column">
                  <div>
                    <h2 className="footer_heading">Treatments</h2>
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
                    <h2 className="footer_heading">Contact</h2>
                    <div className="footer_contact-list">
                      <Link href={contactLinks.phone.href} className="footer_link">
                        {contactLinks.phone.value}
                      </Link>
                      <Link href={contactLinks.email.href} className="footer_link">
                        {contactLinks.email.value}
                      </Link>
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
                {footerContent.legalLinks.length > 0 ? (
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
                  </nav>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
