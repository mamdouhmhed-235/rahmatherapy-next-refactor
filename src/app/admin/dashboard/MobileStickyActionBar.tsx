// SERVER COMPONENT — Mobile sticky bottom action bar (B-5 brief §5.8).
//
// Hidden on desktop (≥ md). Action shape is pre-computed by
// `mobileStickyActionForVariant` in `dashboard-helpers-b5.ts`. This component
// is render-only: receives the computed action (or null) and emits the bar.
//
// A11y: `role="region" aria-label="Quick actions"` per SHARED-NOTES §3.
// External hrefs (Maps / tel:) render as native <a> so the browser handles
// the protocol; internal hrefs use next/link.

import Link from "next/link";
import type {
  MobileStickyAction,
  StickyActionItem,
} from "./dashboard-helpers-b5";

export interface MobileStickyActionBarProps {
  action: MobileStickyAction | null;
}

export function MobileStickyActionBar({ action }: MobileStickyActionBarProps) {
  if (!action) return null;
  return (
    <aside
      role="region"
      aria-label="Quick actions"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 pt-3 md:hidden"
      // env(safe-area-inset-bottom) handles iOS home-bar inset; the constant
      // base padding keeps touch targets clear on Android.
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
    >
      <div className="flex items-stretch gap-2">
        <ActionItem item={action.primary} primary />
        {action.secondary ? (
          <ActionItem item={action.secondary} primary={false} />
        ) : null}
      </div>
    </aside>
  );
}

function ActionItem({
  item,
  primary,
}: {
  item: StickyActionItem;
  primary: boolean;
}) {
  const className = primary
    ? "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-3 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-primary-hover)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
    : "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none";

  if (item.external) {
    return (
      <a href={item.href} className={className}>
        {item.label}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className}>
      {item.label}
    </Link>
  );
}
