import Link from "next/link";
import type { NavItem, SocialLink } from "@/types/content";
import type { ContactLink } from "@/types/content";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";

interface DesktopNavProps {
  items: readonly NavItem[];
  pathname: string;
  phone: ContactLink;
  email: ContactLink;
  socialLinks: readonly SocialLink[];
  onNavigate?: () => void;
}

export function DesktopNav({
  items,
  pathname,
  phone,
  email,
  socialLinks,
  onNavigate,
}: DesktopNavProps) {
  return (
    <div className="hidden h-full flex-col justify-between md:flex">
      <nav aria-label="Primary navigation" className="grid gap-3">
        {items.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "text-lg font-semibold text-foreground/78 transition-colors hover:text-foreground",
                isActive && "text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-2 border-t border-border/70 pt-6">
        <p className="text-base font-semibold text-foreground">Get in touch</p>
        <Link
          href={phone.href}
          onClick={onNavigate}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {phone.value}
        </Link>
        <Link
          href={email.href}
          onClick={onNavigate}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {email.value}
        </Link>
        <ButtonLink
          href="#book-now"
          variant="link"
          className="justify-start text-sm font-medium"
          data-booking-trigger="true"
          onClick={onNavigate}
        >
          Book a visit
        </ButtonLink>
        {socialLinks.length > 0 ? (
          <div className="flex items-center gap-3 pt-3">
            {socialLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                onClick={onNavigate}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
