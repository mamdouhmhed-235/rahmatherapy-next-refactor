// SERVER COMPONENT — Therapist "Need help?" links panel (brief §5.6 block 10).
//
// Renders the filtered link set from `quickHelpLinksForTherapist`. Hides the
// whole panel only when EVERY link is denied (essentially impossible for an
// active Therapist). At least one rendered link → panel mounts.

import Link from "next/link";
import { ArrowRight, LifeBuoy } from "lucide-react";
import type { QuickHelpLink } from "./therapist-fullness";

export interface QuickHelpPanelProps {
  links: QuickHelpLink[];
}

export function QuickHelpPanel({ links }: QuickHelpPanelProps) {
  if (links.length === 0) return null;
  return (
    <section
      aria-labelledby="quick-help-heading"
      className="flex flex-col gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)]/30 p-5"
    >
      <div className="flex items-center gap-2">
        <LifeBuoy
          className="size-4 text-[var(--admin-text-muted)]"
          aria-hidden="true"
        />
        <h2
          id="quick-help-heading"
          className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]"
        >
          Need help?
        </h2>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {links.map((link) => (
          <li key={link.key}>
            <Link
              href={link.href}
              className="inline-flex w-full items-center justify-between gap-2 rounded-[var(--admin-radius-control)] px-2 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
            >
              <span className="truncate">{link.label}</span>
              <ArrowRight
                className="size-4 shrink-0 text-[var(--admin-text-muted)]"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
