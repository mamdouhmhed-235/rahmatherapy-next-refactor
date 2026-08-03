import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AdminPanel } from "../components/admin-ui";

interface QuickLink {
  label: string;
  href: string;
}

interface QuickLinksProps {
  links: QuickLink[];
  title?: string;
}

export function QuickLinks({ links, title = "Quick links" }: QuickLinksProps) {
  if (links.length === 0) return null;
  return (
    <AdminPanel title={title}>
      <ul className="grid gap-1 md:grid-cols-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-flex h-9 min-h-11 sm:min-h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-2.5 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <ArrowUpRight className="size-3.5 text-[var(--admin-text-muted)]" aria-hidden="true" />
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}

export type { QuickLink };
