import Link from "next/link";
import { footerContent } from "@/content/site/footer";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="footer_component color-scheme-1">
      <div className="padding-global">
        <div className="container-large">
          <div className="padding-vertical padding-xxlarge">
            <div className="padding-bottom padding-xxlarge">
              <div className="footer_top-wrapper">
                <Logo size="footer" />
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
