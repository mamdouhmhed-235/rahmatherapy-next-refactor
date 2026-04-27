"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { contactLinks } from "@/content/site/contact";
import { primaryNavigation } from "@/content/site/navigation";
import { socialLinks } from "@/content/site/social";
import { BookingTrigger } from "./BookingTrigger";
import { Logo } from "./Logo";

function isCurrentPath(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function InstagramIcon() {
  return (
    <div className="social-icon w-embed" aria-hidden="true">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M16 3H8C5.23858 3 3 5.23858 3 8V16C3 18.7614 5.23858 21 8 21H16C18.7614 21 21 18.7614 21 16V8C21 5.23858 18.7614 3 16 3ZM19.25 16C19.2445 17.7926 17.7926 19.2445 16 19.25H8C6.20735 19.2445 4.75549 17.7926 4.75 16V8C4.75549 6.20735 6.20735 4.75549 8 4.75H16C17.7926 4.75549 19.2445 6.20735 19.25 8V16ZM16.75 8.25C17.3023 8.25 17.75 7.80228 17.75 7.25C17.75 6.69772 17.3023 6.25 16.75 6.25C16.1977 6.25 15.75 6.69772 15.75 7.25C15.75 7.80228 16.1977 8.25 16.75 8.25ZM12 7.5C9.51472 7.5 7.5 9.51472 7.5 12C7.5 14.4853 9.51472 16.5 12 16.5C14.4853 16.5 16.5 14.4853 16.5 12C16.5027 10.8057 16.0294 9.65957 15.1849 8.81508C14.3404 7.97059 13.1943 7.49734 12 7.5ZM9.25 12C9.25 13.5188 10.4812 14.75 12 14.75C13.5188 14.75 14.75 13.5188 14.75 12C14.75 10.4812 13.5188 9.25 12 9.25C10.4812 9.25 9.25 10.4812 9.25 12Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setMenuOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header
      data-animation="over-right"
      data-collapse="all"
      data-duration="0"
      data-easing="ease"
      data-easing2="ease"
      data-w-id="011b5816-f5e0-1888-2181-20f2abf1aa32"
      fs-scrolldisable-element="smart-nav"
      data-menu-open={menuOpen ? "true" : undefined}
      className="navbar31_component color-scheme-1 w-nav"
      role="banner"
      style={{ bottom: "auto", height: "4.875rem" }}
    >
      <div className="navbar31_container" style={{ height: "4.875rem" }}>
        <Logo priority />

        <div className="navbar31_wrapper">
          <BookingTrigger className="is-navbar31-button whitespace-nowrap" />

          <nav
            id="site-navigation-menu"
            role="navigation"
            aria-label="Main navigation"
            className="navbar31_menu w-nav-menu"
          >
            <div className="navbar31_menu-wrapper">
              <div className="navbar31_links-wrapper">
                {primaryNavigation.map((item) => {
                  const isActive = isCurrentPath(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`navbar31_link w-nav-link${isActive ? " w--current" : ""}`}
                      style={{ color: isActive ? "#000" : "var(--brand-deep)" }}
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>

              <div className="navbar31_menu-bottom">
                <div className="text-size-medium text-weight-semibold">
                  Get in touch
                </div>
                <div className="spacer-xxsmall" />
                <Link href={contactLinks.phone.href} className="text-size-small">
                  {contactLinks.phone.value}
                </Link>
                <div className="spacer-tiny" />
                <Link href={contactLinks.email.href} className="text-size-small">
                  {contactLinks.email.value}
                </Link>
                <div className="spacer-tiny" />
                <Link
                  href="#book-now"
                  className="text-size-small"
                  data-booking-trigger="true"
                  onClick={() => setMenuOpen(false)}
                >
                  Book a visit
                </Link>
                <div className="spacer-medium" />
                <div className="w-layout-grid navbar31_social-list">
                  {socialLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={link.label}
                      className="navbar31_social-link w-inline-block"
                    >
                      <InstagramIcon />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          <button
            type="button"
            className="navbar31_menu-button w-nav-button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-haspopup="menu"
            aria-controls="site-navigation-menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <div className="menu-icon4">
              <div className="menu-icon4_wrapper">
                <div className="menu-icon4_line-top" />
                <div className="menu-icon4_line-middle">
                  <div className="menu-icon4_line-middle-top" />
                  <div className="menu-icon4_line-middle-base" />
                </div>
                <div className="menu-icon4_line-bottom" />
              </div>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
